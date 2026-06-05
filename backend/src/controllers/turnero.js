// /backend/src/controllers/turnero.js
// Controlador de los endpoints públicos del turnero (cliente anónimo).
// Todos los handlers reciben req.tenant_id inyectado por tenantMiddleware
// y filtran todas las queries por ese tenant_id. Sin token: no hay req.rol
// ni req.barbero_id acá.
//
// Cobertura: ver plan_turnero_v2.md sección 4.

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { calcularSlotsDisponibles, calcularDiasConDisponibilidad, DisponibilidadError } from '../services/disponibilidadService.js';
import { actualizarEvento, cancelarEvento } from '../services/googleCalendar.js';
import { enviarCancelacion, enviarReprogramacion, construirContextoMail } from '../services/mailer.js';
import {
  calcularDuracionServicio, upsertCliente, insertarTurno, enriquecerTurno,
  armarLinkGestion, sincronizarCalendarCreacion, notificarConfirmacion,
  inicioPosteriorAhora,
} from '../services/turnosService.js';
import { obtenerHorarioCrudo, validarTurnoEnHorario } from '../services/horarioAtencionService.js';
import { obtenerFeriados, existeFeriado } from '../services/feriadosService.js';
import { TZ } from '../utils/constantes.js';

// Regex YYYY-MM-DD para validar el query param ?fecha.
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Regex mínimo de email — solo formato superficial.
const REGEX_EMAIL = /.+@.+\..+/;

/**
 * getTenant
 * Devuelve los datos públicos del tenant para la landing del turnero.
 * No incluye PIN, suscripción ni datos sensibles.
 *
 * El logo y demás imágenes del tenant ya no viajan acá: se sirven por
 * GET /api/negocio/imagenes (los frontends los consumen desde ese endpoint).
 *
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} { id, nombre, telefono, direccion, horario_atencion, feriados }
 */
export const getTenant = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre_negocio, telefono, direccion
       FROM tenant
       WHERE id = $1 AND activo = true`,
      [req.tenant_id]
    );
    if (result.rows.length === 0) {
      console.warn('[turnero] getTenant — tenant no encontrado:', req.tenant_id);
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    const row = result.rows[0];
    // Horario semanal de atención: sólo los días abiertos. El cliente lo usa
    // para grisar días cerrados sin pegarle al endpoint de disponibilidad.
    const horarioAtencion = await obtenerHorarioCrudo(req.tenant_id);
    // Feriados futuros (fecha >= hoy): el cliente los usa para grisar días.
    const hoy = DateTime.now().setZone(TZ).toISODate();
    const feriados = await obtenerFeriados(req.tenant_id, hoy);
    res.json({
      id: row.id,
      nombre: row.nombre_negocio,
      telefono: row.telefono,
      direccion: row.direccion,
      horario_atencion: horarioAtencion,
      feriados,
    });
  } catch (err) {
    console.error('[turnero] Error en getTenant:', err);
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
  try {
    const result = await query(
      `SELECT s.id,
              s.nombre,
              s.precio,
              (t.duracion_slot_minutos * s.cantidad_slots) AS duracion_minutos
       FROM servicio s
       JOIN tenant t ON t.id = s.tenant_id
       WHERE s.tenant_id = $1 AND s.activo = true
       ORDER BY s.precio ASC`,
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[turnero] Error en getServicios:', err);
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
  try {
    const result = await query(
      `SELECT id, nombre
       FROM barbero
       WHERE tenant_id = $1 AND activo = true
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[turnero] Error en getBarberos:', err);
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
    res.json({ slots });
  } catch (err) {
    if (err instanceof DisponibilidadError) {
      console.warn('[turnero] getDisponibilidad — error de dominio:', err.codigo, err);
      const status = err.codigo === 'fecha_invalida' ? 400 : 404;
      return res.status(status).json({ error: err.message });
    }
    console.error('[turnero] Error en getDisponibilidad:', err);
    res.status(500).json({ error: 'Error al calcular disponibilidad' });
  }
};
/**
 * getDiasDisponibles
 * Devuelve qué días de un rango tienen al menos un slot reservable para un
 * (barbero, servicio). El calendario del turnero lo usa para grisar los días
 * sin disponibilidad. Delega la lógica al disponibilidadService.
 *
 * @param {string} req.tenant_id          - Inyectado por tenantMiddleware
 * @param {string} req.query.barbero_id
 * @param {string} req.query.servicio_id
 * @param {string} req.query.desde         - 'YYYY-MM-DD' (inclusive)
 * @param {string} req.query.hasta         - 'YYYY-MM-DD' (inclusive)
 * @returns {JSON} { dias: ['YYYY-MM-DD', ...] }
 */
export const getDiasDisponibles = async (req, res) => {
  const { barbero_id, servicio_id, desde, hasta } = req.query;

  if (!barbero_id || !servicio_id || !desde || !hasta) {
    return res.status(400).json({ error: 'barbero_id, servicio_id, desde y hasta son requeridos' });
  }
  if (!REGEX_FECHA.test(desde) || !REGEX_FECHA.test(hasta)) {
    return res.status(400).json({ error: 'desde y hasta deben tener formato YYYY-MM-DD' });
  }

  try {
    const dias = await calcularDiasConDisponibilidad({
      tenantId: req.tenant_id,
      barberoId: barbero_id,
      servicioId: servicio_id,
      desde,
      hasta,
    });
    res.json({ dias });
  } catch (err) {
    if (err instanceof DisponibilidadError) {
      console.warn('[turnero] getDiasDisponibles — error de dominio:', err.codigo, err);
      const status = err.codigo === 'fecha_invalida' ? 400 : 404;
      return res.status(status).json({ error: err.message });
    }
    console.error('[turnero] Error en getDiasDisponibles:', err);
    res.status(500).json({ error: 'Error al calcular días disponibles' });
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

  try {
    // ── Calcular duración del servicio ──────────────────────────────────────
    const duracionMin = await calcularDuracionServicio(servicio_id, req.tenant_id);
    if (duracionMin === null) {
      return res.status(404).json({ error: 'Servicio no encontrado o inactivo' });
    }
    const finDT = inicioDT.plus({ minutes: duracionMin });

    // ── Validar que el turno caiga dentro del horario de atención ───────────
    const valHorario = await validarTurnoEnHorario(req.tenant_id, inicioDT, finDT);
    if (!valHorario.valido) {
      console.warn('[turnero] crearTurno — turno fuera del horario del negocio | codigo:', valHorario.codigo);
      return res.status(422).json({
        codigo: valHorario.codigo,
        mensaje: valHorario.mensaje,
        ...(valHorario.limite && { limite: valHorario.limite }),
      });
    }

    // ── Validar que el turno no caiga en un feriado ─────────────────────────
    if (await existeFeriado(req.tenant_id, inicioDT.toISODate())) {
      console.warn('[turnero] crearTurno — turno en día feriado');
      return res.status(422).json({ codigo: 'feriado', mensaje: 'El negocio está cerrado por feriado ese día' });
    }

    // ── Upsert cliente ──────────────────────────────────────────────────────
    const cliente_id = await upsertCliente(req.tenant_id, { nombre, telefono, email });

    // ── INSERT turno ────────────────────────────────────────────────────────
    let resultado;
    try {
      resultado = await insertarTurno({
        tenantId: req.tenant_id, clienteId: cliente_id, barberoId: barbero_id,
        servicioId: servicio_id, inicioDT, finDT, origenCreacion: 'turnero',
      });
    } catch (err) {
      if (err.code === 'SLOT_OCUPADO') {
        console.warn('[turnero] crearTurno — slot ya reservado (constraint 23P01)');
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }
    const { turno_id, token_gestion } = resultado;
    console.log('[turnero] crearTurno — turno insertado | turno_id:', turno_id);

    // ── Best-effort: Calendar + mail ────────────────────────────────────────
    try {
      const enriquecido = await enriquecerTurno(turno_id);
      if (enriquecido) {
        await sincronizarCalendarCreacion(turno_id, enriquecido);
        const linkGestion = armarLinkGestion(req, token_gestion);
        await notificarConfirmacion(enriquecido, linkGestion);
      }
    } catch (err) {
      console.error('[turnero] crearTurno — fallo best-effort (Calendar/mail):', err);
    }

    console.log('[turnero] crearTurno completado | turno_id:', turno_id);
    return res.status(201).json({ turno_id, token_gestion });

  } catch (err) {
    console.error('[turnero] Error en crearTurno:', err);
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
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    const r = result.rows[0];
    res.json({
      turno:    { id: r.id, inicio: r.inicio, fin: r.fin, estado: r.estado },
      barbero:  { id: r.barbero_id, nombre: r.barbero_nombre },
      servicio: { id: r.servicio_id, nombre: r.servicio_nombre, precio: r.servicio_precio, duracion_minutos: r.servicio_duracion_minutos },
      cliente:  { nombre: r.cliente_nombre, email: r.cliente_email, telefono: r.cliente_telefono },
    });
  } catch (err) {
    console.error('[turnero] Error en getTurnoPorToken:', err);
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
    const { turno, barbero, servicio, cliente } = construirContextoMail(r);
    await enviarCancelacion(turno, barbero, servicio, cliente, 'cliente');

    console.log('[turnero] cancelarTurno completado | turno_id:', r.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[turnero] Error en cancelarTurno:', err);
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

    // ── Validar que el nuevo horario caiga dentro del horario de atención ──
    const valHorario = await validarTurnoEnHorario(req.tenant_id, inicioDT, finDT);
    if (!valHorario.valido) {
      console.warn('[turnero] reprogramarTurno — turno fuera del horario del negocio | codigo:', valHorario.codigo);
      return res.status(422).json({
        codigo: valHorario.codigo,
        mensaje: valHorario.mensaje,
        ...(valHorario.limite && { limite: valHorario.limite }),
      });
    }

    // ── Validar que el nuevo horario no caiga en un feriado ─────────────────
    if (await existeFeriado(req.tenant_id, inicioDT.toISODate())) {
      console.warn('[turnero] reprogramarTurno — turno en día feriado');
      return res.status(422).json({ codigo: 'feriado', mensaje: 'El negocio está cerrado por feriado ese día' });
    }

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
    const { barbero, servicio, cliente } = construirContextoMail(r);

    if (r.google_event_id) {
      await actualizarEvento(r.google_event_id, nuevoTurno, barbero, servicio, cliente);
    }
    const linkGestion = armarLinkGestion(req, req.params.token);
    await enviarReprogramacion(nuevoTurno, barbero, servicio, cliente, linkGestion);

    console.log('[turnero] reprogramarTurno completado | turno_id:', r.id);
    res.json({ ok: true, turno: { id: r.id, inicio: nuevoTurno.inicio, fin: nuevoTurno.fin } });
  } catch (err) {
    console.error('[turnero] Error en reprogramarTurno:', err);
    res.status(500).json({ error: 'Error al reprogramar el turno' });
  }
};
