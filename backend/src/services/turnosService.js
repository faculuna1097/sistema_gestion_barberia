// /backend/src/services/turnosService.js
// Lógica de negocio de turnos. Contiene helpers compartidos entre el turnero
// público (controllers/turnero.js) y el backoffice (controllers/turnos.js),
// más las operaciones propias del backoffice (listar, cambiar estado, cancelar
// por id).

import crypto from 'crypto';
import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { crearEvento, cancelarEvento, actualizarEvento } from './googleCalendar.js';
import { enviarConfirmacion, enviarCancelacion, construirContextoMail } from './mail/mailer.js';
import { TZ, ANTELACION_MINIMA_MINUTOS, DIAS_RESERVABLES } from '../utils/constantes.js';
import { esUUID } from '../utils/validarUuid.js';
import { registrarCorte } from './cortesService.js';
import { suspensionSolapaSql } from './suspensionesService.js';
import { sqlTurnoEnriquecido } from './sqlTurnoEnriquecido.js';

// ─── Helpers compartidos ─────────────────────────────────────────────────────

/**
 * Calcula la duración real de un servicio en minutos.
 * @param {string} servicioId - UUID del servicio (puede venir del cliente)
 * @param {string} tenantId   - UUID del tenant
 * @returns {Promise<number|null>} duracion en minutos, o null si no existe, está
 *   inactivo o el id está mal formado (el caller responde 404)
 */
export const calcularDuracionServicio = async (servicioId, tenantId) => {
  if (!esUUID(servicioId)) return null;

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

// Mensaje del 409 cuando el horario ya no se puede reservar (otro turno o una
// suspensión). Lo comparten insertarTurno y reprogramarTurno (controllers/turnero.js
// y turnos.js). Lo lee el cliente en el turnero: sin la palabra "slot".
export const MENSAJE_SLOT_OCUPADO = 'Ese horario ya no está disponible. Elegí otro.';

// 409 cuando el cliente quiere cancelar o reprogramar desde el turnero un turno
// que ya empezó (cancelarTurno y reprogramarTurno de controllers/turnero.js). Un
// turno se completa recién al registrar su corte: uno que ya empezó y todavía no
// se cobró sigue 'reservado', y el cliente no lo puede tocar. El turnero usa el
// código para dejar de ofrecer las acciones y mostrar el contacto del local.
export const MENSAJE_TURNO_YA_EMPEZO =
  'Este turno ya pasó, así que no se puede cancelar ni reprogramar. Si necesitás algo, comunicate con el local.';
export const CODIGO_TURNO_YA_EMPEZO = 'turno_ya_empezo';
export const CUERPO_409_TURNO_YA_EMPEZO = Object.freeze({
  error: MENSAJE_TURNO_YA_EMPEZO,
  codigo: CODIGO_TURNO_YA_EMPEZO,
});

/**
 * Arma el error tipado que los controllers mapean a 409.
 * @returns {Error} error con code 'SLOT_OCUPADO'
 */
const errorSlotOcupado = () => {
  const slotError = new Error(MENSAJE_SLOT_OCUPADO);
  slotError.code = 'SLOT_OCUPADO';
  return slotError;
};

/**
 * Inserta un turno en la DB. Captura la violación del constraint EXCLUDE GIST
 * (código 23P01) y la devuelve como error tipado en vez de propagarla.
 *
 * Tampoco inserta si el barbero tiene una suspensión vigente (rango efectivo) que
 * se superpone: el chequeo va en la misma sentencia (INSERT ... SELECT ... WHERE
 * NOT EXISTS), así no hay ventana entre leer y escribir dentro de este request.
 * Queda la del TOCTOU sistémico con una suspensión creada en el mismo instante
 * (auditoria_2026-07.md). Si no inserta, tira el mismo SLOT_OCUPADO.
 * @param {Object} datos
 * @param {string} datos.origenCreacion - Quién lo crea: 'turnero' | 'barbero' | 'admin'
 * @param {string|null} [datos.origenLink=null] - Por qué link llegó el cliente
 *   al turnero (`turno.origen_link`, ej. 'instagram'), ya normalizado con
 *   `normalizarOrigen`. Solo lo manda el turnero público.
 * @returns {Promise<{ turno_id: string, token_gestion: string }>}
 * @throws {{ code: 'SLOT_OCUPADO' }} si se superpone con otro turno o con una suspensión
 */
export const insertarTurno = async ({
  tenantId, clienteId, barberoId, servicioId, inicioDT, finDT, origenCreacion, origenLink = null,
}) => {
  const token_gestion = crypto.randomUUID();
  let result;
  try {
    // Los casts son explícitos: en un INSERT ... SELECT Postgres no siempre
    // deduce el tipo de los parámetros a partir de la columna destino.
    result = await query(
      `INSERT INTO turno
         (tenant_id, cliente_id, barbero_id, servicio_id, inicio, fin,
          estado, origen_creacion, token_gestion, origen_link)
       SELECT $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::timestamptz, $6::timestamptz,
              'reservado', $7::text, $8::text, $9::text
       WHERE NOT EXISTS (
         SELECT 1 FROM barbero_suspension bs
         WHERE bs.tenant_id = $1::uuid AND bs.barbero_id = $3::uuid
           AND ${suspensionSolapaSql('bs', '$5::timestamptz', '$6::timestamptz')}
       )
       RETURNING id`,
      [tenantId, clienteId, barberoId, servicioId,
       inicioDT.toISO(), finDT.toISO(), origenCreacion, token_gestion, origenLink]
    );
  } catch (err) {
    if (err.code === '23P01') {
      throw errorSlotOcupado();
    }
    // Backstop de carrera: FK compuesto (tenant_id, barbero_id|servicio_id)
    // violado. El controller ya valida barbero y servicio antes del insert, pero
    // si una carrera se escapa, traducimos la violación cruda (23503) a un error
    // tipado que el controller mapea a 404 en vez de 500. (Auditoría 2.1.)
    if (err.code === '23503') {
      const refError = new Error('El barbero o servicio indicado no existe en este negocio');
      refError.code = 'REFERENCIA_INVALIDA';
      throw refError;
    }
    throw err;
  }

  // Sin filas: el NOT EXISTS encontró una suspensión vigente que se superpone.
  if (result.rows.length === 0) {
    throw errorSlotOcupado();
  }
  return { turno_id: result.rows[0].id, token_gestion };
};

/**
 * SELECT enriquecido con JOINs a barbero, servicio, cliente y tenant.
 * Usado para armar los datos que necesitan Google Calendar y mailer.
 * @param {string} turnoId
 * @returns {Promise<Object|null>}
 */
export const enriquecerTurno = async (turnoId) => {
  const result = await query(
    sqlTurnoEnriquecido('t.google_event_id, t.token_gestion', 'WHERE t.id = $1'),
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
  const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5175';
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
  const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5175';
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

// Mensaje del 400 de un turno público fuera de la ventana de reserva.
export const MENSAJE_FUERA_DE_VENTANA =
  `Solo se puede reservar dentro de los próximos ${DIAS_RESERVABLES} días`;

/**
 * Verifica que el día de un inicio, en hora argentina, caiga dentro de la ventana
 * de reserva del turnero público. Hoy cuenta como el día 1: el último es
 * hoy + DIAS_RESERVABLES - 1. Con el formato 'YYYY-MM-DD', comparar los strings
 * equivale a comparar las fechas.
 * @param {DateTime} inicioDT - Instante en TZ (lo que devuelve parsearInstante)
 * @returns {boolean}
 */
export const inicioDentroDeVentana = (inicioDT) => {
  const ultimoDia = DateTime.now().setZone(TZ).plus({ days: DIAS_RESERVABLES - 1 }).toISODate();
  return inicioDT.toISODate() <= ultimoDia;
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
  // LEFT JOIN cliente: un turno "Sin datos" (cliente_id NULL, F1) trae cliente_id,
  // cliente_nombre, cliente_email y cliente_telefono en null; el front muestra "Sin datos".
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
     LEFT JOIN cliente c ON c.id = t.cliente_id
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
 * @returns {Promise<Array>} [{ id, inicio, cliente_nombre, servicio_id }];
 *   cliente_nombre es null en un turno "Sin datos" (cliente_id NULL, F1)
 */
export const listarTurnosOperativos = async ({ tenantId, barberoId, fecha }) => {
  const result = await query(
    `SELECT t.id, t.inicio, t.servicio_id,
            c.nombre AS cliente_nombre
     FROM turno t
     LEFT JOIN cliente c ON c.id = t.cliente_id
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
 * Cambia el estado de un turno a mano. El único estado permitido es
 * 'no_asistio', y solo en un turno reservado que ya empezó.
 * 'completado' se rechaza: un turno se completa solo al registrar su corte
 * (completarTurnoConCorte o el iPad). Completarlo acá lo dejaba completado sin
 * corte y, como el iPad lista solo los reservados, el cobro terminaba cargado
 * como un cliente sin turno.
 * @param {string} turnoId
 * @param {string} nuevoEstado - 'no_asistio'
 * @param {string} tenantId
 * @param {string|null} barberoId - si es barbero, solo puede cambiar los suyos
 * @returns {Promise<Object>} { id, estado }
 * @throws {{ code: 'ESTADO_NO_PERMITIDO' | 'NO_ENCONTRADO' | 'ESTADO_INVALIDO' | 'TURNO_NO_EMPEZO' }}
 */
export const cambiarEstado = async (turnoId, nuevoEstado, tenantId, barberoId) => {
  if (nuevoEstado === 'completado') {
    const err = new Error('Un turno se completa registrando su corte, desde el iPad o el panel');
    err.code = 'ESTADO_NO_PERMITIDO';
    throw err;
  }
  if (nuevoEstado !== 'no_asistio') {
    const err = new Error(`Estado "${nuevoEstado}" no es válido. El único permitido es 'no_asistio'`);
    err.code = 'ESTADO_NO_PERMITIDO';
    throw err;
  }

  // Buscar turno con scoping. Si ya empezó se calcula en la base, con su reloj.
  const params = [turnoId, tenantId];
  let where = 't.id = $1 AND t.tenant_id = $2';
  if (barberoId) {
    where += ' AND t.barbero_id = $3';
    params.push(barberoId);
  }

  const lookupRes = await query(
    `SELECT t.id, t.estado, t.inicio > now() AS no_empezo FROM turno t WHERE ${where}`,
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
  if (turno.no_empezo) {
    const err = new Error('El turno todavía no empezó: no se puede marcar que el cliente no asistió');
    err.code = 'TURNO_NO_EMPEZO';
    throw err;
  }

  // estado = 'reservado' en el WHERE: si entre el lookup y acá el turno cambió
  // (se canceló, se registró su corte), no se pisa. tenant_id redundante
  // (defensa en profundidad, auditoría 2.2): el turnoId ya vino del lookup
  // scopeado por tenant de arriba.
  const updateRes = await query(
    `UPDATE turno SET estado = $1 WHERE id = $2 AND tenant_id = $3 AND estado = 'reservado'`,
    [nuevoEstado, turnoId, tenantId]
  );
  if (updateRes.rowCount === 0) {
    console.warn('[turnosService] cambiarEstado — el turno dejó de estar reservado antes del UPDATE | turno_id:', turnoId);
    const err = new Error('El turno cambió de estado mientras se procesaba');
    err.code = 'ESTADO_INVALIDO';
    throw err;
  }

  return { id: turnoId, estado: nuevoEstado };
};

/**
 * Completa un turno registrando su corte. Es la única vía del backoffice para
 * completar un turno (cambiarEstado rechaza 'completado'), y deja el registro
 * financiero del turno — es el equivalente backoffice del flujo operativo del
 * iPad: completar = registrar el corte. Valida (scoped) que el turno exista y siga
 * 'reservado'; el admin también puede completar uno marcado 'no_asistio' (el
 * cliente vino y la falta estaba mal marcada). El servicio
 * del corte es por defecto el del turno; opcionalmente se acepta un override
 * (servicioId) que se valida contra el catálogo (tenant + activo). Delega en
 * registrarCorte (cortesService), que inserta el corte, marca el turno
 * 'completado' y sincroniza turno.servicio_id, todo en una sola operación.
 * @param {Object} datos
 * @param {string} datos.turnoId
 * @param {string} datos.tenantId
 * @param {string|null} datos.barberoId - si es barbero, solo completa los suyos
 *   (y solo reservados); null = admin
 * @param {string} datos.formaPago - 'efectivo' | 'mercado_pago'
 * @param {number} datos.precio    - monto cobrado por el servicio
 * @param {number} [datos.propina] - propina (default 0)
 * @param {string} [datos.servicioId] - override del servicio (default: el del turno)
 * @returns {Promise<{ id, estado: 'completado', servicio_id, corte_id, monto_total }>}
 * @throws {{ code: 'NO_ENCONTRADO' | 'ESTADO_INVALIDO' | 'SERVICIO_INVALIDO' |
 *   'TURNO_YA_VINCULADO' | 'TURNO_YA_COMPLETADO' | 'TURNO_INEXISTENTE' }}
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

  // Estados que se pueden completar: reservado y, solo el admin, no_asistio (este
  // solo el mismo día del turno: lo controla registrarCorte en la misma sentencia).
  const estadosCompletables = barberoId ? ['reservado'] : ['reservado', 'no_asistio'];

  const turno = lookupRes.rows[0];
  if (!estadosCompletables.includes(turno.estado)) {
    const err = new Error(`El turno está en estado "${turno.estado}" y no se puede completar`);
    err.code = 'ESTADO_INVALIDO';
    throw err;
  }

  // Servicio del corte: por defecto el del turno (autoritativo). Si el backoffice
  // manda un override (cambió el servicio al completar), se valida que pertenezca al
  // tenant y esté activo, con calcularDuracionServicio. Sin override
  // no hay validación nueva → comportamiento idéntico al anterior (retrocompat).
  let servicioFinal = turno.servicio_id;
  if (servicioId !== undefined && servicioId !== null && servicioId !== '') {
    if ((await calcularDuracionServicio(servicioId, tenantId)) === null) {
      const e = new Error('Servicio no encontrado o inactivo');
      e.code = 'SERVICIO_INVALIDO';
      throw e;
    }
    servicioFinal = servicioId;
  }

  // Insertador central compartido con el flujo del iPad. barbero_id sale del turno
  // (autoritativo); servicioFinal es el override validado o el del turno. registrarCorte
  // marca el turno 'completado' y sincroniza turno.servicio_id en la misma sentencia.
  // Sin canceladoComoSinTurno: acá se completa ESE turno; si entre el lookup y el
  // insert cambió (se canceló, el iPad registró el corte), no se inserta nada y
  // lanza ESTADO_INVALIDO / TURNO_YA_COMPLETADO → el controller lo mapea a 409.
  const { corte_id, monto_total } = await registrarCorte({
    tenantId,
    barberoId: turno.barbero_id,
    servicioId: servicioFinal,
    precio,
    formaPago,
    propina,
    turnoId,
    estadosCompletables,
  });

  return { id: turnoId, estado: 'completado', servicio_id: servicioFinal, corte_id, monto_total };
};

/**
 * Cancela un turno por id (desde backoffice). Solo un turno reservado que todavía
 * no empezó: uno que ya empezó se marca "no asistió", no se cancela. Dispara
 * best-effort Calendar y mail de cancelación, solo si el UPDATE canceló de verdad.
 * La cancelación del cliente desde el turnero va por otro camino, con sus reglas.
 * @param {string} turnoId
 * @param {string} canceladoPor - 'admin' | 'barbero'
 * @param {string} tenantId
 * @param {string|null} barberoId - si es barbero, solo puede cancelar los suyos
 * @returns {Promise<Object>} { id, estado: 'cancelado' }
 * @throws {{ code: 'NO_ENCONTRADO' | 'ESTADO_INVALIDO' | 'TURNO_YA_EMPEZO' }}
 */
export const cancelarTurnoPorId = async (turnoId, canceladoPor, tenantId, barberoId) => {
  // Buscar turno con scoping + datos enriquecidos para services. Si ya empezó se
  // calcula en la base, con su reloj (como en cambiarEstado).
  const params = [turnoId, tenantId];
  let where = 't.id = $1 AND t.tenant_id = $2';
  if (barberoId) {
    where += ' AND t.barbero_id = $3';
    params.push(barberoId);
  }

  const lookupRes = await query(
    sqlTurnoEnriquecido('t.id, t.estado, t.google_event_id, t.inicio <= now() AS empezo', `WHERE ${where}`),
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
  if (r.empezo) {
    const err = new Error('El turno ya empezó: marcalo como "no asistió"');
    err.code = 'TURNO_YA_EMPEZO';
    throw err;
  }

  // Las dos reglas también en el WHERE: si entre el lookup y acá el turno cambió
  // (lo canceló el cliente, se registró su corte), no se pisa ni se avisa nada.
  // tenant_id redundante (defensa en profundidad, auditoría 2.2): el turnoId ya
  // salió del lookup scopeado por tenant de arriba.
  const updateRes = await query(
    `UPDATE turno
       SET estado = 'cancelado',
           cancelado_en = now(),
           cancelado_por = $1
     WHERE id = $2 AND tenant_id = $3 AND estado = 'reservado' AND inicio > now()`,
    [canceladoPor, turnoId, tenantId]
  );
  if (updateRes.rowCount === 0) {
    console.warn('[turnosService] cancelarTurnoPorId — el turno cambió antes del UPDATE | turno_id:', turnoId);
    const err = new Error('El turno cambió de estado mientras se procesaba');
    err.code = 'ESTADO_INVALIDO';
    throw err;
  }
  console.log('[turnosService] cancelarTurnoPorId — turno cancelado | turno_id:', turnoId);

  // Best-effort: Google Calendar + mail
  if (r.google_event_id) {
    await cancelarEvento(r.google_event_id);
  }
  const { turno, barbero, servicio, cliente, tenant } = construirContextoMail(r);
  await enviarCancelacion(turno, barbero, servicio, cliente, canceladoPor, tenant);

  return { id: turnoId, estado: 'cancelado' };
};

// ─── Asignar un cliente a un turno "Sin datos" (F1) ──────────────────────────

// Estados en los que un turno sin cliente puede recibir uno: reservado (todavía no
// vino) y completado (se anota al cliente después de cobrar). Un turno cancelado o
// con "no asistió" ya no se toca.
const ESTADOS_ASIGNABLES = ['reservado', 'completado'];

/**
 * Fragmento SQL que dice si un cliente es "del barbero": tuvo al menos un turno
 * reservado o completado con él. Es el mismo criterio que getMisClientes
 * (controllers/clientes.js): si cambia uno, cambia el otro.
 * @param {string} aliasCliente - alias de la tabla cliente en la query (ej. 'c')
 * @param {string} paramBarbero - placeholder del barbero_id (ej. '$3')
 * @returns {string} condición EXISTS lista para un WHERE
 */
const sqlClienteDelBarbero = (aliasCliente, paramBarbero) =>
  `EXISTS (
     SELECT 1 FROM turno tb
     WHERE tb.cliente_id = ${aliasCliente}.id
       AND tb.tenant_id  = ${aliasCliente}.tenant_id
       AND tb.barbero_id = ${paramBarbero}
       AND tb.estado IN ('completado', 'reservado')
   )`;

/**
 * Dice si un cliente existente se puede usar en un turno: es del local y, si quien
 * lo elige es un barbero, es "suyo" (sqlClienteDelBarbero). Lo usan el alta del
 * turno con `cliente_id` y la asignación de un cliente a un turno "Sin datos".
 * @param {Object} datos
 * @param {string} datos.clienteId - id ya validado como UUID
 * @param {string} datos.tenantId
 * @param {string|null} datos.barberoId - el barbero del token con rol barbero; null para admin
 * @returns {Promise<boolean>} true si el cliente se puede usar
 */
export const clienteUsable = async ({ clienteId, tenantId, barberoId }) => {
  const params = [clienteId, tenantId];
  let where = 'c.id = $1 AND c.tenant_id = $2';
  if (barberoId) {
    where += ` AND ${sqlClienteDelBarbero('c', '$3')}`;
    params.push(barberoId);
  }
  const res = await query(`SELECT 1 FROM cliente c WHERE ${where}`, params);
  return res.rows.length > 0;
};

/**
 * Cleanup manual (sin transacción, convenciones §6): borra un cliente recién
 * creado que se quedó sin turno porque lo que venía después falló (el insert del
 * turno dio 409, o la asignación perdió una carrera). Solo si no tiene ningún
 * turno: nunca toca un cliente en uso. No propaga errores: si falla, queda un
 * cliente sin turnos y se avisa a Sentry.
 * @param {string} clienteId
 * @param {string} tenantId
 * @param {string} origen - quién llama, para el log (ej. 'crearTurnoAdmin')
 * @returns {Promise<void>}
 */
export const borrarClienteSinTurnos = async (clienteId, tenantId, origen) => {
  try {
    await query(
      `DELETE FROM cliente c
        WHERE c.id = $1 AND c.tenant_id = $2
          AND NOT EXISTS (SELECT 1 FROM turno t WHERE t.cliente_id = c.id)`,
      [clienteId, tenantId]
    );
  } catch (err) {
    console.error(`[turnosService] ${origen} — falló el cleanup del cliente creado:`, err);
  }
};

/**
 * Arma un error tipado de la asignación de cliente, que el controller mapea a su status.
 * @param {string} code    - 'NO_ENCONTRADO' | 'CLIENTE_NO_ENCONTRADO' | 'TURNO_CON_CLIENTE' | 'ESTADO_INVALIDO'
 * @param {string} mensaje - texto para el usuario
 * @returns {Error}
 */
const errorAsignacion = (code, mensaje) => {
  const err = new Error(mensaje);
  err.code = code;
  return err;
};

/**
 * Lee un turno con el scoping del rol y, si no admite que se le asigne un cliente,
 * tira el error que corresponde.
 * @param {string} turnoId
 * @param {string} tenantId
 * @param {string|null} barberoId - con rol barbero, solo sus turnos (uno ajeno = no encontrado)
 * @returns {Promise<void>}
 * @throws {{ code: 'NO_ENCONTRADO' | 'TURNO_CON_CLIENTE' | 'ESTADO_INVALIDO' }}
 */
const verificarTurnoAsignable = async (turnoId, tenantId, barberoId) => {
  const params = [turnoId, tenantId];
  let where = 't.id = $1 AND t.tenant_id = $2';
  if (barberoId) {
    where += ' AND t.barbero_id = $3';
    params.push(barberoId);
  }
  const res = await query(`SELECT t.estado, t.cliente_id FROM turno t WHERE ${where}`, params);
  if (res.rows.length === 0) {
    throw errorAsignacion('NO_ENCONTRADO', 'Turno no encontrado');
  }
  const { estado, cliente_id } = res.rows[0];
  if (cliente_id !== null) {
    throw errorAsignacion('TURNO_CON_CLIENTE', 'El turno ya tiene un cliente asignado');
  }
  if (!ESTADOS_ASIGNABLES.includes(estado)) {
    throw errorAsignacion('ESTADO_INVALIDO', `El turno está en estado "${estado}" y no se le puede asignar un cliente`);
  }
};

/**
 * Asigna un cliente a un turno que no tiene (turno "Sin datos", cliente_id NULL).
 * El cliente es uno existente (clienteId) o uno nuevo (contacto, que pasa por
 * upsertCliente como en el alta: con un email que ya existe en el local, devuelve
 * ese cliente).
 *
 * Scoping: todo por tenant. Con rol barbero, solo turnos propios y, si el cliente
 * es existente, solo uno "suyo" (sqlClienteDelBarbero); uno ajeno responde igual
 * que uno inexistente.
 *
 * La asignación es una sola sentencia (UPDATE ... FROM cliente) con todas las
 * reglas en el WHERE, incluido cliente_id IS NULL: si dos asignaciones llegan a la
 * vez, la segunda espera a la primera, vuelve a evaluar la fila y no la pisa. La
 * lectura previa solo sirve para devolver el error justo; si el UPDATE no toca
 * nada (perdió una carrera), se relee para elegir el error. Si en ese caso se había
 * creado un cliente sin email (siempre es una fila nueva), se borra: cleanup manual
 * en vez de transacción (Session Pooler, convenciones §6).
 *
 * @param {Object} datos
 * @param {string} datos.turnoId
 * @param {string} datos.tenantId
 * @param {string|null} datos.barberoId - id del barbero si el rol es barbero; null = admin
 * @param {string} [datos.clienteId] - cliente existente (UUID ya validado)
 * @param {Object} [datos.contacto] - cliente nuevo, ya normalizado por validarContacto
 * @returns {Promise<{ id, cliente_id, cliente_nombre, cliente_email, cliente_telefono }>}
 * @throws {{ code: 'NO_ENCONTRADO' | 'CLIENTE_NO_ENCONTRADO' | 'TURNO_CON_CLIENTE' | 'ESTADO_INVALIDO' }}
 */
export const asignarClienteATurno = async ({ turnoId, tenantId, barberoId, clienteId, contacto }) => {
  await verificarTurnoAsignable(turnoId, tenantId, barberoId);

  // El filtro de "cliente suyo" se aplica solo a un cliente existente que elige un
  // barbero: uno nuevo lo está cargando él.
  const filtrarClienteDelBarbero = Boolean(barberoId && clienteId);

  if (clienteId && !(await clienteUsable({ clienteId, tenantId, barberoId }))) {
    throw errorAsignacion('CLIENTE_NO_ENCONTRADO', 'Cliente no encontrado');
  }

  let idCliente = clienteId;
  let clienteCreadoAca = false;
  if (contacto) {
    idCliente = await upsertCliente(tenantId, contacto);
    clienteCreadoAca = !contacto.email;
  }

  const params = [turnoId, tenantId, idCliente, ESTADOS_ASIGNABLES];
  let filtros = '';
  if (barberoId) {
    params.push(barberoId);
    filtros += ` AND t.barbero_id = $${params.length}`;
    if (filtrarClienteDelBarbero) {
      filtros += ` AND ${sqlClienteDelBarbero('c', `$${params.length}`)}`;
    }
  }

  const updateRes = await query(
    `UPDATE turno t
        SET cliente_id = c.id
       FROM cliente c
      WHERE t.id = $1 AND t.tenant_id = $2
        AND c.id = $3 AND c.tenant_id = $2
        AND t.cliente_id IS NULL
        AND t.estado = ANY($4::text[])${filtros}
     RETURNING t.id, c.id AS cliente_id, c.nombre AS cliente_nombre,
               c.email AS cliente_email, c.telefono AS cliente_telefono`,
    params
  );
  if (updateRes.rows.length > 0) {
    return updateRes.rows[0];
  }

  // Perdió una carrera: el turno cambió entre la lectura y el UPDATE.
  console.warn('[turnosService] asignarClienteATurno — el turno cambió antes del UPDATE | turno_id:', turnoId);
  if (clienteCreadoAca) {
    await borrarClienteSinTurnos(idCliente, tenantId, 'asignarClienteATurno');
  }
  await verificarTurnoAsignable(turnoId, tenantId, barberoId);
  // El turno sigue asignable: lo que dejó de valer es el cliente.
  throw errorAsignacion('CLIENTE_NO_ENCONTRADO', 'Cliente no encontrado');
};

/**
 * Best-effort: después de asignarle un cliente a un turno, actualiza su evento de
 * Google Calendar (el título pasa de "Sin datos" al nombre del cliente). Si el turno
 * no tiene evento, no hace nada. actualizarEvento no propaga errores.
 * @param {string} turnoId
 * @returns {Promise<void>}
 */
export const sincronizarCalendarCliente = async (turnoId) => {
  const enriquecido = await enriquecerTurno(turnoId);
  if (!enriquecido?.google_event_id) return;
  const { turno, barbero, servicio, cliente } = construirContextoMail(enriquecido);
  await actualizarEvento(enriquecido.google_event_id, turno, barbero, servicio, cliente);
};
