// /backend/src/controllers/turnero.js
// Controlador de los endpoints públicos del turnero (cliente anónimo).
// Todos los handlers reciben req.tenant_id inyectado por tenantMiddleware
// y filtran todas las queries por ese tenant_id. Sin token: no hay req.rol
// ni req.barbero_id acá.
//
// Cobertura: ver plan_turnero_v2.md sección 4.

import crypto from 'crypto';
import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { calcularSlotsDisponibles, DisponibilidadError } from '../services/disponibilidadService.js';
import { crearEvento, cancelarEvento, actualizarEvento } from '../services/googleCalendar.js';
import { enviarConfirmacion, enviarCancelacion, enviarReprogramacion } from '../services/mailer.js';
import { TZ, ANTELACION_MINIMA_MINUTOS } from '../utils/constantes.js';

// Regex YYYY-MM-DD para validar el query param ?fecha.
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Regex mínimo de email — solo formato superficial.
// La verificación real (envío + click) está fuera de scope.
const REGEX_EMAIL = /.+@.+\..+/;

/**
 * Construye el link de gestión del turno que va en los mails.
 * Lee el subdominio del header X-Tenant-Subdomain (lo que el frontend envía
 * en cada request) y arma la URL pública. En dev local (sin subdominio en
 * el header) cae a PUBLIC_BASE_URL del .env, o a localhost como último
 * recurso.
 *
 * @param {Object} req - request de Express
 * @param {string} token - token_gestion del turno
 * @returns {string} URL completa
 */
/**
 * Verifica que un inicio sea posterior a ahora + el margen mínimo. Mantiene
 * coherencia con el algoritmo de disponibilidad: si un slot no aparece como
 * disponible (por estar en el pasado o demasiado pegado al ahora), tampoco
 * debe poder reservarse/reprogramarse directamente.
 *
 * @param {DateTime} inicioDT
 * @returns {boolean} true si el inicio es válido (futuro con margen)
 */
const inicioPosteriorAhora = (inicioDT) => {
  const umbral = DateTime.now().setZone(TZ).plus({ minutes: ANTELACION_MINIMA_MINUTOS });
  return inicioDT > umbral;
};

const armarLinkGestion = (req, token) => {
  const subdominio = req.headers['x-tenant-subdomain'];
  if (subdominio) {
    return `https://${subdominio}.barbermanager.app/turnos/${token}`;
  }
  const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173';
  return `${base}/turnos/${token}`;
};

/**
 * getTenant
 * Devuelve los datos públicos del tenant para la landing del turnero.
 * No incluye PIN, suscripción ni datos sensibles.
 *
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} { id, nombre, logo_url }
 */
export const getTenant = async (req, res) => {
  console.log('[turnero] getTenant — request recibido | tenant:', req.tenant_id);
  try {
    const result = await query(
      `SELECT id, nombre_negocio, logo
       FROM tenant
       WHERE id = $1 AND activo = true`,
      [req.tenant_id]
    );
    if (result.rows.length === 0) {
      console.warn('[turnero] getTenant — tenant no encontrado:', req.tenant_id);
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    const row = result.rows[0];
    console.log('[turnero] getTenant — completado | nombre:', row.nombre_negocio);
    res.json({ id: row.id, nombre: row.nombre_negocio, logo_url: row.logo });
  } catch (err) {
    console.error('[turnero] Error en getTenant:', err.message);
    res.status(500).json({ error: 'Error al obtener tenant' });
  }
};

/**
 * getServicios
 * Lista los servicios activos del tenant con precio y duración real en minutos.
 * La duración se calcula como tenant.duracion_slot_minutos * servicio.cantidad_slots.
 *
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} [{ id, nombre, precio, duracion_minutos }]
 */
export const getServicios = async (req, res) => {
  console.log('[turnero] getServicios — request recibido | tenant:', req.tenant_id);
  try {
    const result = await query(
      `SELECT s.id,
              s.nombre,
              s.precio,
              (t.duracion_slot_minutos * s.cantidad_slots) AS duracion_minutos
       FROM servicio s
       JOIN tenant t ON t.id = s.tenant_id
       WHERE s.tenant_id = $1 AND s.activo = true
       ORDER BY (s.nombre = 'Corte') ASC, s.precio ASC`,
      [req.tenant_id]
    );
    console.log('[turnero] getServicios — completado |', result.rows.length, 'servicios');
    res.json(result.rows);
  } catch (err) {
    console.error('[turnero] Error en getServicios:', err.message);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
};

/**
 * getBarberos
 * Lista los barberos activos del tenant. Acepta query param ?servicio_id
 * pero lo ignora por ahora: todos los barberos atienden todos los servicios.
 * El param queda preparado para reglas futuras de "qué barbero atiende qué"
 * (ver plan_turnero_v2.md sección 12).
 *
 * @param {string} req.tenant_id      - Inyectado por tenantMiddleware
 * @param {string} req.query.servicio_id - (ignorado) filtro futuro
 * @returns {JSON} [{ id, nombre }]
 */
export const getBarberos = async (req, res) => {
  console.log('[turnero] getBarberos — request recibido | tenant:', req.tenant_id,
    '| servicio_id (ignorado):', req.query.servicio_id ?? '(ninguno)');
  try {
    const result = await query(
      `SELECT id, nombre
       FROM barbero
       WHERE tenant_id = $1 AND activo = true
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    console.log('[turnero] getBarberos — completado |', result.rows.length, 'barberos');
    res.json(result.rows);
  } catch (err) {
    console.error('[turnero] Error en getBarberos:', err.message);
    res.status(500).json({ error: 'Error al obtener barberos' });
  }
};

/**
 * getDisponibilidad
 * Calcula los slots de inicio disponibles para un (barbero, servicio, fecha).
 * Delega la lógica al disponibilidadService.
 *
 * @param {string} req.tenant_id            - Inyectado por tenantMiddleware
 * @param {string} req.query.barbero_id
 * @param {string} req.query.servicio_id
 * @param {string} req.query.fecha          - 'YYYY-MM-DD'
 * @returns {JSON} { slots: [ISO,...] }
 */
export const getDisponibilidad = async (req, res) => {
  const { barbero_id, servicio_id, fecha } = req.query;
  console.log('[turnero] getDisponibilidad — request recibido | tenant:', req.tenant_id,
    '| barbero:', barbero_id, '| servicio:', servicio_id, '| fecha:', fecha);

  if (!barbero_id || !servicio_id || !fecha) {
    return res.status(400).json({ error: 'barbero_id, servicio_id y fecha son requeridos' });
  }
  if (!REGEX_FECHA.test(fecha)) {
    return res.status(400).json({ error: 'fecha debe tener formato YYYY-MM-DD' });
  }

  try {
    const slots = await calcularSlotsDisponibles({
      tenantId: req.tenant_id,
      barberoId: barbero_id,
      servicioId: servicio_id,
      fecha,
    });
    console.log('[turnero] getDisponibilidad — completado |', slots.length, 'slots');
    res.json({ slots });
  } catch (err) {
    if (err instanceof DisponibilidadError) {
      console.warn('[turnero] getDisponibilidad — error de dominio:', err.codigo, err.message);
      const status = err.codigo === 'fecha_invalida' ? 400 : 404;
      return res.status(status).json({ error: err.message });
    }
    console.error('[turnero] Error en getDisponibilidad:', err.message);
    res.status(500).json({ error: 'Error al calcular disponibilidad' });
  }
};
/**
 * crearTurno
 * Crea un turno desde el turnero público. Hace upsert del cliente por
 * (tenant_id, email) y dispara best-effort la integración con Google
 * Calendar y el mail de confirmación.
 *
 * El constraint EXCLUDE GIST `turno_no_solapamiento` previene a nivel DB
 * que dos turnos del mismo barbero se pisen. Su violación (código 23P01)
 * se mapea a HTTP 409.
 *
 * @param {string} req.tenant_id      - Inyectado por tenantMiddleware
 * @param {string} req.body.servicio_id
 * @param {string} req.body.barbero_id
 * @param {string} req.body.inicio    - ISO con offset (ej: el formato que devuelve /disponibilidad)
 * @param {string} req.body.nombre
 * @param {string} req.body.telefono  - obligatorio en este controller
 * @param {string} req.body.email     - obligatorio en este controller
 * @returns {JSON} 201 { turno_id, token_gestion }
 */
export const crearTurno = async (req, res) => {
  console.log('[turnero] crearTurno — request recibido | tenant:', req.tenant_id);

  const { servicio_id, barbero_id, inicio, nombre, telefono, email } = req.body;

  // ── Validaciones de presencia ─────────────────────────────────────────────
  if (!servicio_id || !barbero_id || !inicio || !nombre || !telefono || !email) {
    return res.status(400).json({
      error: 'servicio_id, barbero_id, inicio, nombre, telefono y email son requeridos',
    });
  }
  if (!REGEX_EMAIL.test(email)) {
    return res.status(400).json({ error: 'Email con formato inválido' });
  }

  const inicioDT = DateTime.fromISO(inicio, { zone: TZ });
  if (!inicioDT.isValid) {
    return res.status(400).json({ error: 'inicio debe ser un ISO timestamp válido' });
  }
  if (!inicioPosteriorAhora(inicioDT)) {
    return res.status(400).json({ error: 'inicio debe ser futuro' });
  }

  const emailNormalizado = email.trim().toLowerCase();

  try {
    // ── Calcular duración del servicio ──────────────────────────────────────
    const duracionRes = await query(
      `SELECT (t.duracion_slot_minutos * s.cantidad_slots) AS duracion_minutos
       FROM servicio s
       JOIN tenant t ON t.id = s.tenant_id
       WHERE s.id = $1 AND s.tenant_id = $2 AND s.activo = true`,
      [servicio_id, req.tenant_id]
    );
    if (duracionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado o inactivo' });
    }
    const duracionMin = duracionRes.rows[0].duracion_minutos;
    const finDT = inicioDT.plus({ minutes: duracionMin });

    // ── Upsert cliente ──────────────────────────────────────────────────────
    const clienteRes = await query(
      `INSERT INTO cliente (tenant_id, nombre, telefono, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, email) DO UPDATE
         SET nombre = EXCLUDED.nombre, telefono = EXCLUDED.telefono
       RETURNING id`,
      [req.tenant_id, nombre, telefono, emailNormalizado]
    );
    const cliente_id = clienteRes.rows[0].id;

    // ── INSERT turno ────────────────────────────────────────────────────────
    const token_gestion = crypto.randomUUID();
    let turnoRes;
    try {
      turnoRes = await query(
        `INSERT INTO turno
           (tenant_id, cliente_id, barbero_id, servicio_id, inicio, fin,
            estado, origen_creacion, token_gestion)
         VALUES ($1, $2, $3, $4, $5, $6, 'reservado', 'turnero', $7)
         RETURNING id`,
        [req.tenant_id, cliente_id, barbero_id, servicio_id,
         inicioDT.toISO(), finDT.toISO(), token_gestion]
      );
    } catch (err) {
      if (err.code === '23P01') {
        console.warn('[turnero] crearTurno — slot ya reservado (constraint 23P01)');
        return res.status(409).json({ error: 'El slot elegido ya no está disponible' });
      }
      throw err;
    }
    const turno_id = turnoRes.rows[0].id;
    console.log('[turnero] crearTurno — turno insertado | turno_id:', turno_id);

    // ── SELECT enriquecido para Calendar + mail ─────────────────────────────
    let enriquecido = null;
    try {
      const enrichRes = await query(
        `SELECT t.inicio, t.fin,
                b.nombre AS barbero_nombre, b.email AS barbero_email,
                s.nombre AS servicio_nombre,
                c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono
         FROM turno t
         JOIN barbero  b ON b.id = t.barbero_id
         JOIN servicio s ON s.id = t.servicio_id
         JOIN cliente  c ON c.id = t.cliente_id
         WHERE t.id = $1`,
        [turno_id]
      );
      enriquecido = enrichRes.rows[0];
    } catch (err) {
      // No rompemos el flujo: el turno ya está creado. Solo logueamos
      // y nos saltamos Calendar y mail.
      console.error('[turnero] crearTurno — fallo SELECT enriquecido:', err.message);
    }

    // ── Best-effort: Google Calendar ────────────────────────────────────────
    if (enriquecido) {
      const turnoParaServices = { inicio: enriquecido.inicio, fin: enriquecido.fin };
      const barbero  = { nombre: enriquecido.barbero_nombre, email: enriquecido.barbero_email };
      const servicio = { nombre: enriquecido.servicio_nombre };
      const cliente  = { nombre: enriquecido.cliente_nombre, email: enriquecido.cliente_email, telefono: enriquecido.cliente_telefono };

      const eventId = await crearEvento(turnoParaServices, barbero, servicio, cliente);
      if (eventId) {
        try {
          await query(`UPDATE turno SET google_event_id = $1 WHERE id = $2`, [eventId, turno_id]);
        } catch (err) {
          console.error('[turnero] crearTurno — fallo UPDATE google_event_id:', err.message);
        }
      }

      // ── Best-effort: mail de confirmación ────────────────────────────────
      const linkGestion = armarLinkGestion(req, token_gestion);
      await enviarConfirmacion(turnoParaServices, barbero, servicio, cliente, linkGestion);
    }

    console.log('[turnero] crearTurno — completado | turno_id:', turno_id);
    return res.status(201).json({ turno_id, token_gestion });

  } catch (err) {
    console.error('[turnero] Error en crearTurno:', err.message);
    return res.status(500).json({ error: 'Error al crear el turno' });
  }
};
/**
 * getTurnoPorToken
 * Devuelve datos del turno por token_gestion. Sirve a la página de gestión
 * del turno linkeada desde el mail.
 * Filtra por tenant_id además del token (defensa multi-tenant aunque el
 * token sea UNIQUE global).
 *
 * @param {string} req.tenant_id     - Inyectado por tenantMiddleware
 * @param {string} req.params.token
 * @returns {JSON} { turno, barbero, servicio, cliente }
 */
export const getTurnoPorToken = async (req, res) => {
  console.log('[turnero] getTurnoPorToken — request recibido | tenant:', req.tenant_id,
    '| token:', req.params.token);

  try {
    const result = await query(
      `SELECT t.id, t.inicio, t.fin, t.estado,
              b.id AS barbero_id, b.nombre AS barbero_nombre,
              s.id AS servicio_id, s.nombre AS servicio_nombre, s.precio AS servicio_precio,
              (tn.duracion_slot_minutos * s.cantidad_slots) AS servicio_duracion_minutos,
              c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono
       FROM turno t
       JOIN barbero  b  ON b.id  = t.barbero_id
       JOIN servicio s  ON s.id  = t.servicio_id
       JOIN tenant   tn ON tn.id = t.tenant_id
       JOIN cliente  c  ON c.id  = t.cliente_id
       WHERE t.token_gestion = $1 AND t.tenant_id = $2`,
      [req.params.token, req.tenant_id]
    );
    if (result.rows.length === 0) {
      console.warn('[turnero] getTurnoPorToken — turno no encontrado');
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    const r = result.rows[0];
    console.log('[turnero] getTurnoPorToken — completado | turno_id:', r.id, '| estado:', r.estado);
    res.json({
      turno:    { id: r.id, inicio: r.inicio, fin: r.fin, estado: r.estado },
      barbero:  { id: r.barbero_id, nombre: r.barbero_nombre },
      servicio: { id: r.servicio_id, nombre: r.servicio_nombre, precio: r.servicio_precio, duracion_minutos: r.servicio_duracion_minutos },
      cliente:  { nombre: r.cliente_nombre, email: r.cliente_email, telefono: r.cliente_telefono },
    });
  } catch (err) {
    console.error('[turnero] Error en getTurnoPorToken:', err.message);
    res.status(500).json({ error: 'Error al obtener turno' });
  }
};

/**
 * cancelarTurno
 * Cancela un turno reservado desde la página pública de gestión.
 * Setea cancelado_por='cliente' y dispara best-effort la cancelación del
 * evento de Google Calendar y el mail de cancelación.
 *
 * @param {string} req.tenant_id     - Inyectado por tenantMiddleware
 * @param {string} req.params.token
 * @returns {JSON} { ok: true }
 */
export const cancelarTurno = async (req, res) => {
  console.log('[turnero] cancelarTurno — request recibido | tenant:', req.tenant_id,
    '| token:', req.params.token);

  try {
    // ── Buscar turno + datos enriquecidos en una sola query ────────────────
    const lookupRes = await query(
      `SELECT t.id, t.estado, t.google_event_id, t.inicio, t.fin,
              b.nombre AS barbero_nombre, b.email AS barbero_email,
              s.nombre AS servicio_nombre,
              c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono
       FROM turno t
       JOIN barbero  b ON b.id = t.barbero_id
       JOIN servicio s ON s.id = t.servicio_id
       JOIN cliente  c ON c.id = t.cliente_id
       WHERE t.token_gestion = $1 AND t.tenant_id = $2`,
      [req.params.token, req.tenant_id]
    );
    if (lookupRes.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    const r = lookupRes.rows[0];
    if (r.estado !== 'reservado') {
      console.warn('[turnero] cancelarTurno — estado no cancelable:', r.estado);
      return res.status(409).json({ error: `El turno está en estado "${r.estado}" y no se puede cancelar` });
    }

    // ── UPDATE estado ──────────────────────────────────────────────────────
    await query(
      `UPDATE turno
         SET estado = 'cancelado',
             cancelado_en = now(),
             cancelado_por = 'cliente'
       WHERE id = $1`,
      [r.id]
    );
    console.log('[turnero] cancelarTurno — turno cancelado | turno_id:', r.id);

    // ── Best-effort: Google Calendar + mail ────────────────────────────────
    if (r.google_event_id) {
      await cancelarEvento(r.google_event_id);
    }
    const turnoParaServices = { inicio: r.inicio, fin: r.fin };
    const barbero  = { nombre: r.barbero_nombre, email: r.barbero_email };
    const servicio = { nombre: r.servicio_nombre };
    const cliente  = { nombre: r.cliente_nombre, email: r.cliente_email, telefono: r.cliente_telefono };
    await enviarCancelacion(turnoParaServices, barbero, servicio, cliente, 'cliente');

    console.log('[turnero] cancelarTurno — completado | turno_id:', r.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[turnero] Error en cancelarTurno:', err.message);
    res.status(500).json({ error: 'Error al cancelar el turno' });
  }
};

/**
 * reprogramarTurno
 * Cambia inicio/fin del turno. El constraint EXCLUDE GIST también aplica
 * al UPDATE: si el nuevo rango choca con otro turno reservado del mismo
 * barbero, devuelve 409.
 *
 * @param {string} req.tenant_id     - Inyectado por tenantMiddleware
 * @param {string} req.params.token
 * @param {string} req.body.inicio   - ISO con offset
 * @returns {JSON} { ok: true, turno: { id, inicio, fin } }
 */
export const reprogramarTurno = async (req, res) => {
  console.log('[turnero] reprogramarTurno — request recibido | tenant:', req.tenant_id,
    '| token:', req.params.token);

  const { inicio } = req.body;
  if (!inicio) {
    return res.status(400).json({ error: 'inicio es requerido' });
  }
  const inicioDT = DateTime.fromISO(inicio, { zone: TZ });
  if (!inicioDT.isValid) {
    return res.status(400).json({ error: 'inicio debe ser un ISO timestamp válido' });
  }
  if (!inicioPosteriorAhora(inicioDT)) {
    return res.status(400).json({ error: 'inicio debe ser futuro' });
  }

  try {
    // ── Lookup turno + duración del servicio + datos para services ─────────
    const lookupRes = await query(
      `SELECT t.id, t.estado, t.google_event_id,
              (tn.duracion_slot_minutos * s.cantidad_slots) AS duracion_minutos,
              b.nombre AS barbero_nombre, b.email AS barbero_email,
              s.nombre AS servicio_nombre,
              c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono
       FROM turno t
       JOIN tenant   tn ON tn.id = t.tenant_id
       JOIN barbero  b  ON b.id  = t.barbero_id
       JOIN servicio s  ON s.id  = t.servicio_id
       JOIN cliente  c  ON c.id  = t.cliente_id
       WHERE t.token_gestion = $1 AND t.tenant_id = $2`,
      [req.params.token, req.tenant_id]
    );
    if (lookupRes.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    const r = lookupRes.rows[0];
    if (r.estado !== 'reservado') {
      console.warn('[turnero] reprogramarTurno — estado no reprogramable:', r.estado);
      return res.status(409).json({ error: `El turno está en estado "${r.estado}" y no se puede reprogramar` });
    }

    const finDT = inicioDT.plus({ minutes: r.duracion_minutos });

    // ── UPDATE con captura de 23P01 ────────────────────────────────────────
    try {
      await query(
        `UPDATE turno SET inicio = $1, fin = $2 WHERE id = $3`,
        [inicioDT.toISO(), finDT.toISO(), r.id]
      );
    } catch (err) {
      if (err.code === '23P01') {
        console.warn('[turnero] reprogramarTurno — slot ya reservado (constraint 23P01)');
        return res.status(409).json({ error: 'El slot elegido ya no está disponible' });
      }
      throw err;
    }
    console.log('[turnero] reprogramarTurno — turno actualizado | turno_id:', r.id);

    // ── Best-effort: Google Calendar + mail ────────────────────────────────
    const nuevoTurno = { inicio: inicioDT.toISO(), fin: finDT.toISO() };
    const barbero  = { nombre: r.barbero_nombre, email: r.barbero_email };
    const servicio = { nombre: r.servicio_nombre };
    const cliente  = { nombre: r.cliente_nombre, email: r.cliente_email, telefono: r.cliente_telefono };

    if (r.google_event_id) {
      await actualizarEvento(r.google_event_id, nuevoTurno, barbero, servicio, cliente);
    }
    const linkGestion = armarLinkGestion(req, req.params.token);
    await enviarReprogramacion(nuevoTurno, barbero, servicio, cliente, linkGestion);

    console.log('[turnero] reprogramarTurno — completado | turno_id:', r.id);
    res.json({ ok: true, turno: { id: r.id, inicio: nuevoTurno.inicio, fin: nuevoTurno.fin } });
  } catch (err) {
    console.error('[turnero] Error en reprogramarTurno:', err.message);
    res.status(500).json({ error: 'Error al reprogramar el turno' });
  }
};
