// /backend/src/services/turnosService.js
// Lógica de negocio de turnos. Contiene helpers compartidos entre el turnero
// público (controllers/turnero.js) y el backoffice (controllers/turnos.js),
// más las operaciones propias del backoffice (listar, cambiar estado, cancelar
// por id).

import crypto from 'crypto';
import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { crearEvento, cancelarEvento } from './googleCalendar.js';
import { enviarConfirmacion, enviarCancelacion, construirContextoMail } from './mail/mailer.js';
import { TZ, ANTELACION_MINIMA_MINUTOS } from '../utils/constantes.js';
import { registrarCorte } from './cortesService.js';

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
 * SELECT enriquecido con JOINs a barbero, servicio, cliente y tenant.
 * Usado para armar los datos que necesitan Google Calendar y mailer.
 * @param {string} turnoId
 * @returns {Promise<Object|null>}
 */
export const enriquecerTurno = async (turnoId) => {
  const result = await query(
    `SELECT t.inicio, t.fin, t.google_event_id, t.token_gestion,
            b.nombre AS barbero_nombre, b.email AS barbero_email,
            s.nombre AS servicio_nombre,
            c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono,
            tn.nombre_negocio AS tenant_nombre, tn.direccion AS tenant_direccion
     FROM turno t
     JOIN barbero  b ON b.id = t.barbero_id
     JOIN servicio s ON s.id = t.servicio_id
     JOIN cliente  c ON c.id = t.cliente_id
     JOIN tenant   tn ON tn.id = t.tenant_id
     WHERE t.id = $1`,
    [turnoId]
  );
  return result.rows[0] || null;
};

/**
 * Construye el link de gestión del turno a partir del subdominio del tenant
 * (no del request). Versión pura, reutilizable desde contextos sin `req` como
 * el job de recordatorios, que arma el link con tenant.subdominio de la fila.
 * @param {string|undefined} subdominio - subdominio del tenant (ej. 'demo')
 * @param {string} token - token_gestion del turno
 * @returns {string} URL completa de gestión
 */
export const construirLinkGestion = (subdominio, token) => {
  if (subdominio) {
    return `https://${subdominio}.barbermanager.app/turnos/gestionar/${token}`;
  }
  const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173';
  return `${base}/turnos/gestionar/${token}`;
};

/**
 * Construye el link de gestión del turno para los mails, leyendo el subdominio
 * del header del request. Delega en construirLinkGestion (helper puro).
 * @param {Object} req   - request de Express (para leer X-Tenant-Subdomain)
 * @param {string} token - token_gestion del turno
 * @returns {string} URL completa
 */
export const armarLinkGestion = (req, token) =>
  construirLinkGestion(req.headers['x-tenant-subdomain'], token);

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
  const { turno, barbero, servicio, cliente } = construirContextoMail(enriquecido);

  const eventId = await crearEvento(turno, barbero, servicio, cliente);
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
  const { turno, barbero, servicio, cliente, tenant } = construirContextoMail(enriquecido);

  await enviarConfirmacion(turno, barbero, servicio, cliente, linkGestion, tenant);
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

  // LEFT JOIN corte: un turno completado tiene un corte vinculado (corte.turno_id),
  // del que salen la forma de pago y el monto cobrado (deuda #32). El UNIQUE parcial
  // en corte.turno_id garantiza ≤1 corte por turno → no multiplica filas. Turnos no
  // completados (o completados sin corte) devuelven forma_pago/monto_total = null.
  const result = await query(
    `SELECT t.id, t.inicio, t.fin, t.estado, t.origen_creacion,
            b.id AS barbero_id, b.nombre AS barbero_nombre,
            s.id AS servicio_id, s.nombre AS servicio_nombre,
            c.id AS cliente_id, c.nombre AS cliente_nombre,
            c.email AS cliente_email, c.telefono AS cliente_telefono,
            co.forma_pago, co.monto_total
     FROM turno t
     JOIN barbero  b ON b.id = t.barbero_id
     JOIN servicio s ON s.id = t.servicio_id
     JOIN cliente  c ON c.id = t.cliente_id
     LEFT JOIN corte co ON co.turno_id = t.id
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
 * Completa un turno registrando su corte. A diferencia de cambiarEstado (que
 * solo cambia el estado), esta vía deja el registro financiero del turno — es
 * el equivalente backoffice del flujo operativo del iPad: completar = registrar
 * el corte. Valida (scoped) que el turno exista y siga 'reservado'. El servicio
 * del corte es por defecto el del turno; opcionalmente se acepta un override
 * (servicioId) que se valida contra el catálogo (tenant + activo). Delega en
 * registrarCorte (cortesService), que inserta el corte, marca el turno
 * 'completado' y sincroniza turno.servicio_id, todo en una sola operación.
 * @param {Object} datos
 * @param {string} datos.turnoId
 * @param {string} datos.tenantId
 * @param {string|null} datos.barberoId - si es barbero, solo completa los suyos
 * @param {string} datos.formaPago - 'efectivo' | 'mercado_pago'
 * @param {number} datos.precio    - monto cobrado por el servicio
 * @param {number} [datos.propina] - propina (default 0)
 * @param {string} [datos.servicioId] - override del servicio (default: el del turno)
 * @returns {Promise<{ id, estado: 'completado', servicio_id, corte_id, monto_total }>}
 * @throws {{ code: 'NO_ENCONTRADO' | 'ESTADO_INVALIDO' | 'SERVICIO_INVALIDO' | 'TURNO_YA_VINCULADO' }}
 */
export const completarTurnoConCorte = async ({ turnoId, tenantId, barberoId, formaPago, precio, propina, servicioId }) => {
  // Lookup con scoping: el barbero solo puede completar los suyos
  const params = [turnoId, tenantId];
  let where = 't.id = $1 AND t.tenant_id = $2';
  if (barberoId) {
    where += ' AND t.barbero_id = $3';
    params.push(barberoId);
  }

  const lookupRes = await query(
    `SELECT t.id, t.estado, t.barbero_id, t.servicio_id FROM turno t WHERE ${where}`,
    params
  );
  if (lookupRes.rows.length === 0) {
    const err = new Error('Turno no encontrado');
    err.code = 'NO_ENCONTRADO';
    throw err;
  }

  const turno = lookupRes.rows[0];
  if (turno.estado !== 'reservado') {
    const err = new Error(`El turno está en estado "${turno.estado}" y no se puede completar`);
    err.code = 'ESTADO_INVALIDO';
    throw err;
  }

  // Servicio del corte: por defecto el del turno (autoritativo). Si el backoffice
  // manda un override (cambió el servicio al completar), se valida que pertenezca al
  // tenant y esté activo (mismo criterio que calcularDuracionServicio). Sin override
  // no hay validación nueva → comportamiento idéntico al anterior (retrocompat).
  let servicioFinal = turno.servicio_id;
  if (servicioId !== undefined && servicioId !== null && servicioId !== '') {
    let servRes;
    try {
      servRes = await query(
        `SELECT 1 FROM servicio WHERE id = $1 AND tenant_id = $2 AND activo = true`,
        [servicioId, tenantId]
      );
    } catch (err) {
      if (err.code === '22P02') { // UUID con formato inválido
        const e = new Error('El servicio_id tiene un formato inválido');
        e.code = 'SERVICIO_INVALIDO';
        throw e;
      }
      throw err;
    }
    if (servRes.rows.length === 0) {
      const e = new Error('Servicio no encontrado o inactivo');
      e.code = 'SERVICIO_INVALIDO';
      throw e;
    }
    servicioFinal = servicioId;
  }

  // Insertador central compartido con el flujo del iPad. barbero_id sale del turno
  // (autoritativo); servicioFinal es el override validado o el del turno. registrarCorte
  // marca el turno 'completado' y sincroniza turno.servicio_id. Puede lanzar
  // TURNO_YA_VINCULADO si entre el lookup y el insert el iPad registró el corte
  // (carrera) → el controller lo mapea a 409.
  const { corte_id, monto_total } = await registrarCorte({
    tenantId,
    barberoId: turno.barbero_id,
    servicioId: servicioFinal,
    precio,
    formaPago,
    propina,
    turnoId,
  });

  return { id: turnoId, estado: 'completado', servicio_id: servicioFinal, corte_id, monto_total };
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
            c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono,
            tn.nombre_negocio AS tenant_nombre
     FROM turno t
     JOIN barbero  b ON b.id = t.barbero_id
     JOIN servicio s ON s.id = t.servicio_id
     JOIN cliente  c ON c.id = t.cliente_id
     JOIN tenant   tn ON tn.id = t.tenant_id
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
  const { turno, barbero, servicio, cliente, tenant } = construirContextoMail(r);
  await enviarCancelacion(turno, barbero, servicio, cliente, canceladoPor, tenant);

  return { id: turnoId, estado: 'cancelado' };
};
