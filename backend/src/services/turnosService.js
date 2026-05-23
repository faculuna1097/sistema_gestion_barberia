// /backend/src/services/turnosService.js
// Lógica de negocio de turnos. Contiene helpers compartidos entre el turnero
// público (controllers/turnero.js) y el backoffice (controllers/turnos.js),
// más las operaciones propias del backoffice (listar, cambiar estado, cancelar
// por id).

import crypto from 'crypto';
import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { crearEvento, cancelarEvento } from './googleCalendar.js';
import { enviarConfirmacion, enviarCancelacion } from './mailer.js';
import { TZ, ANTELACION_MINIMA_MINUTOS } from '../utils/constantes.js';

// ─── Helpers compartidos ─────────────────────────────────────────────────────

/**
 * Calcula la duración real de un servicio en minutos.
 * @param {string} servicioId - UUID del servicio
 * @param {string} tenantId   - UUID del tenant
 * @returns {Promise<number|null>} duracion en minutos, o null si no existe
 */
export const calcularDuracionServicio = async (servicioId, tenantId) => {
  const result = await query(
    `SELECT (t.duracion_slot_minutos * s.cantidad_slots) AS duracion_minutos
     FROM servicio s
     JOIN tenant t ON t.id = s.tenant_id
     WHERE s.id = $1 AND s.tenant_id = $2 AND s.activo = true`,
    [servicioId, tenantId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].duracion_minutos;
};

/**
 * Upsert de cliente por (tenant_id, email). Si email es null/undefined,
 * siempre inserta un cliente nuevo (no puede hacer ON CONFLICT sin email).
 * @param {string} tenantId
 * @param {Object} datos - { nombre, telefono?, email? }
 * @returns {Promise<string>} cliente_id
 */
export const upsertCliente = async (tenantId, { nombre, telefono, email }) => {
  const emailNormalizado = email ? email.trim().toLowerCase() : null;

  if (emailNormalizado) {
    const result = await query(
      `INSERT INTO cliente (tenant_id, nombre, telefono, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, email) DO UPDATE
         SET nombre = EXCLUDED.nombre, telefono = EXCLUDED.telefono
       RETURNING id`,
      [tenantId, nombre, telefono || null, emailNormalizado]
    );
    return result.rows[0].id;
  }

  // Sin email: siempre INSERT nuevo (no hay clave para upsert)
  const result = await query(
    `INSERT INTO cliente (tenant_id, nombre, telefono)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [tenantId, nombre, telefono || null]
  );
  return result.rows[0].id;
};

/**
 * Inserta un turno en la DB. Captura la violación del constraint EXCLUDE GIST
 * (código 23P01) y la devuelve como error tipado en vez de propagarla.
 * @param {Object} datos
 * @returns {Promise<{ turno_id: string, token_gestion: string }>}
 * @throws {{ code: 'SLOT_OCUPADO' }} si hay solapamiento
 */
export const insertarTurno = async ({
  tenantId, clienteId, barberoId, servicioId, inicioDT, finDT, origenCreacion,
}) => {
  const token_gestion = crypto.randomUUID();
  try {
    const result = await query(
      `INSERT INTO turno
         (tenant_id, cliente_id, barbero_id, servicio_id, inicio, fin,
          estado, origen_creacion, token_gestion)
       VALUES ($1, $2, $3, $4, $5, $6, 'reservado', $7, $8)
       RETURNING id`,
      [tenantId, clienteId, barberoId, servicioId,
       inicioDT.toISO(), finDT.toISO(), origenCreacion, token_gestion]
    );
    return { turno_id: result.rows[0].id, token_gestion };
  } catch (err) {
    if (err.code === '23P01') {
      const slotError = new Error('El slot elegido ya no está disponible');
      slotError.code = 'SLOT_OCUPADO';
      throw slotError;
    }
    throw err;
  }
};

/**
 * SELECT enriquecido con JOINs a barbero, servicio y cliente.
 * Usado para armar los datos que necesitan Google Calendar y mailer.
 * @param {string} turnoId
 * @returns {Promise<Object|null>}
 */
export const enriquecerTurno = async (turnoId) => {
  const result = await query(
    `SELECT t.inicio, t.fin, t.google_event_id, t.token_gestion,
            b.nombre AS barbero_nombre, b.email AS barbero_email,
            s.nombre AS servicio_nombre,
            c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono
     FROM turno t
     JOIN barbero  b ON b.id = t.barbero_id
     JOIN servicio s ON s.id = t.servicio_id
     JOIN cliente  c ON c.id = t.cliente_id
     WHERE t.id = $1`,
    [turnoId]
  );
  return result.rows[0] || null;
};

/**
 * Construye el link de gestión del turno para los mails.
 * @param {Object} req   - request de Express (para leer X-Tenant-Subdomain)
 * @param {string} token - token_gestion del turno
 * @returns {string} URL completa
 */
export const armarLinkGestion = (req, token) => {
  const subdominio = req.headers['x-tenant-subdomain'];
  if (subdominio) {
    return `https://${subdominio}.barbermanager.app/turnos/gestionar/${token}`;
  }
  const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173';
  return `${base}/turnos/gestionar/${token}`;
};

/**
 * Construye el link al turnero público (sin token). Se usa en mails de
 * cancelación por suspensión para invitar al cliente a reservar de nuevo.
 * @param {Object} req - request de Express
 * @returns {string} URL base del turnero
 */
export const armarLinkTurnero = (req) => {
  const subdominio = req.headers['x-tenant-subdomain'];
  if (subdominio) {
    return `https://${subdominio}.barbermanager.app/turnos`;
  }
  const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173';
  return `${base}/turnos`;
};

/**
 * Best-effort: crea el evento en Google Calendar y persiste el google_event_id.
 * No propaga errores.
 * @param {string} turnoId
 * @param {Object} enriquecido - resultado de enriquecerTurno
 */
export const sincronizarCalendarCreacion = async (turnoId, enriquecido) => {
  const turnoData = { inicio: enriquecido.inicio, fin: enriquecido.fin };
  const barbero   = { nombre: enriquecido.barbero_nombre, email: enriquecido.barbero_email };
  const servicio  = { nombre: enriquecido.servicio_nombre };
  const cliente   = { nombre: enriquecido.cliente_nombre, email: enriquecido.cliente_email, telefono: enriquecido.cliente_telefono };

  const eventId = await crearEvento(turnoData, barbero, servicio, cliente);
  if (eventId) {
    try {
      await query(`UPDATE turno SET google_event_id = $1 WHERE id = $2`, [eventId, turnoId]);
    } catch (err) {
      console.error('[turnosService] sincronizarCalendarCreacion — fallo UPDATE google_event_id:', err);
    }
  }
};

/**
 * Best-effort: envía mail de confirmación al cliente.
 * @param {Object} enriquecido - resultado de enriquecerTurno
 * @param {string} linkGestion - URL de gestión del turno
 */
export const notificarConfirmacion = async (enriquecido, linkGestion) => {
  const turnoData = { inicio: enriquecido.inicio, fin: enriquecido.fin };
  const barbero   = { nombre: enriquecido.barbero_nombre, email: enriquecido.barbero_email };
  const servicio  = { nombre: enriquecido.servicio_nombre };
  const cliente   = { nombre: enriquecido.cliente_nombre, email: enriquecido.cliente_email, telefono: enriquecido.cliente_telefono };

  await enviarConfirmacion(turnoData, barbero, servicio, cliente, linkGestion);
};

/**
 * Verifica que un inicio sea posterior a ahora + margen mínimo.
 * @param {DateTime} inicioDT
 * @returns {boolean}
 */
export const inicioPosteriorAhora = (inicioDT) => {
  const umbral = DateTime.now().setZone(TZ).plus({ minutes: ANTELACION_MINIMA_MINUTOS });
  return inicioDT > umbral;
};

// ─── Operaciones del backoffice ──────────────────────────────────────────────

/**
 * Lista turnos filtrados por tenant, fecha o rango, y opcionalmente barbero.
 * @param {Object} filtros - { tenantId, fecha?, desde?, hasta?, barberoId? }
 * @returns {Promise<Array>}
 */
export const listarTurnos = async ({ tenantId, fecha, desde, hasta, barberoId }) => {
  const params = [tenantId];
  let where = 't.tenant_id = $1';
  let paramIndex = 2;

  if (barberoId) {
    where += ` AND t.barbero_id = $${paramIndex}`;
    params.push(barberoId);
    paramIndex++;
  }

  if (fecha) {
    where += ` AND DATE(t.inicio AT TIME ZONE '${TZ}') = $${paramIndex}::date`;
    params.push(fecha);
    paramIndex++;
  } else if (desde && hasta) {
    where += ` AND t.inicio >= $${paramIndex} AND t.inicio < $${paramIndex + 1}`;
    params.push(desde, hasta);
    paramIndex += 2;
  }

  const result = await query(
    `SELECT t.id, t.inicio, t.fin, t.estado, t.origen_creacion,
            b.id AS barbero_id, b.nombre AS barbero_nombre,
            s.id AS servicio_id, s.nombre AS servicio_nombre,
            c.id AS cliente_id, c.nombre AS cliente_nombre,
            c.email AS cliente_email, c.telefono AS cliente_telefono
     FROM turno t
     JOIN barbero  b ON b.id = t.barbero_id
     JOIN servicio s ON s.id = t.servicio_id
     JOIN cliente  c ON c.id = t.cliente_id
     WHERE ${where}
     ORDER BY t.inicio ASC`,
    params
  );
  return result.rows;
};

/**
 * Lista los turnos reservados de un barbero en un día puntual, con datos
 * mínimos para el flujo operativo público (registrar corte desde el iPad).
 * No expone email ni teléfono del cliente — solo lo que la pantalla necesita.
 * @param {Object} filtros - { tenantId, barberoId, fecha (YYYY-MM-DD) }
 * @returns {Promise<Array>} [{ id, inicio, cliente_nombre, servicio_id }]
 */
export const listarTurnosOperativos = async ({ tenantId, barberoId, fecha }) => {
  const result = await query(
    `SELECT t.id, t.inicio, t.servicio_id,
            c.nombre AS cliente_nombre
     FROM turno t
     JOIN cliente c ON c.id = t.cliente_id
     WHERE t.tenant_id = $1
       AND t.barbero_id = $2
       AND t.estado = 'reservado'
       AND DATE(t.inicio AT TIME ZONE '${TZ}') = $3::date
     ORDER BY t.inicio ASC`,
    [tenantId, barberoId, fecha]
  );
  return result.rows;
};

/**
 * Cambia el estado de un turno a 'completado' o 'no_asistio'.
 * @param {string} turnoId
 * @param {string} nuevoEstado - 'completado' | 'no_asistio'
 * @param {string} tenantId
 * @param {string|null} barberoId - si es barbero, solo puede cambiar los suyos
 * @returns {Promise<Object>} turno actualizado
 * @throws {{ code: 'NO_ENCONTRADO' | 'ESTADO_INVALIDO' }}
 */
export const cambiarEstado = async (turnoId, nuevoEstado, tenantId, barberoId) => {
  const estadosPermitidos = ['completado', 'no_asistio'];
  if (!estadosPermitidos.includes(nuevoEstado)) {
    const err = new Error(`Estado "${nuevoEstado}" no es válido. Permitidos: ${estadosPermitidos.join(', ')}`);
    err.code = 'ESTADO_INVALIDO';
    throw err;
  }

  // Buscar turno con scoping
  const params = [turnoId, tenantId];
  let where = 't.id = $1 AND t.tenant_id = $2';
  if (barberoId) {
    where += ' AND t.barbero_id = $3';
    params.push(barberoId);
  }

  const lookupRes = await query(
    `SELECT t.id, t.estado FROM turno t WHERE ${where}`,
    params
  );
  if (lookupRes.rows.length === 0) {
    const err = new Error('Turno no encontrado');
    err.code = 'NO_ENCONTRADO';
    throw err;
  }

  const turno = lookupRes.rows[0];
  if (turno.estado !== 'reservado') {
    const err = new Error(`El turno está en estado "${turno.estado}" y no se puede cambiar`);
    err.code = 'ESTADO_INVALIDO';
    throw err;
  }

  await query(
    `UPDATE turno SET estado = $1 WHERE id = $2`,
    [nuevoEstado, turnoId]
  );

  return { id: turnoId, estado: nuevoEstado };
};

/**
 * Cancela un turno por id (desde backoffice). Dispara best-effort Calendar
 * y mail de cancelación.
 * @param {string} turnoId
 * @param {string} canceladoPor - 'admin' | 'barbero'
 * @param {string} tenantId
 * @param {string|null} barberoId - si es barbero, solo puede cancelar los suyos
 * @returns {Promise<Object>} { id, estado: 'cancelado' }
 * @throws {{ code: 'NO_ENCONTRADO' | 'ESTADO_INVALIDO' }}
 */
export const cancelarTurnoPorId = async (turnoId, canceladoPor, tenantId, barberoId) => {
  // Buscar turno con scoping + datos enriquecidos para services
  const params = [turnoId, tenantId];
  let where = 't.id = $1 AND t.tenant_id = $2';
  if (barberoId) {
    where += ' AND t.barbero_id = $3';
    params.push(barberoId);
  }

  const lookupRes = await query(
    `SELECT t.id, t.estado, t.google_event_id, t.inicio, t.fin,
            b.nombre AS barbero_nombre, b.email AS barbero_email,
            s.nombre AS servicio_nombre,
            c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono
     FROM turno t
     JOIN barbero  b ON b.id = t.barbero_id
     JOIN servicio s ON s.id = t.servicio_id
     JOIN cliente  c ON c.id = t.cliente_id
     WHERE ${where}`,
    params
  );
  if (lookupRes.rows.length === 0) {
    const err = new Error('Turno no encontrado');
    err.code = 'NO_ENCONTRADO';
    throw err;
  }

  const r = lookupRes.rows[0];
  if (r.estado !== 'reservado') {
    const err = new Error(`El turno está en estado "${r.estado}" y no se puede cancelar`);
    err.code = 'ESTADO_INVALIDO';
    throw err;
  }

  await query(
    `UPDATE turno
       SET estado = 'cancelado',
           cancelado_en = now(),
           cancelado_por = $1
     WHERE id = $2`,
    [canceladoPor, turnoId]
  );
  console.log('[turnosService] cancelarTurnoPorId — turno cancelado | turno_id:', turnoId);

  // Best-effort: Google Calendar + mail
  if (r.google_event_id) {
    await cancelarEvento(r.google_event_id);
  }
  const turnoData = { inicio: r.inicio, fin: r.fin };
  const barbero   = { nombre: r.barbero_nombre, email: r.barbero_email };
  const servicio  = { nombre: r.servicio_nombre };
  const cliente   = { nombre: r.cliente_nombre, email: r.cliente_email, telefono: r.cliente_telefono };
  await enviarCancelacion(turnoData, barbero, servicio, cliente, canceladoPor);

  return { id: turnoId, estado: 'cancelado' };
};
