// /backend/src/services/traspasosService.js
// Traspaso de turnos entre barberos (F2 de mejoras operativas): el barbero A le
// ofrece uno de sus turnos a otro barbero B, que lo acepta o lo rechaza. Tabla
// turno_traspaso (SQL_Schema.md). Plan: docs/plan_mejoras_operativas.md §4 F2.
//
// Reglas que sostiene este archivo:
//   - Solo se ofrece un turno 'reservado' que no empezó (inicio > now(), sin el
//     margen de ANTELACION_MINIMA_MINUTOS), y solo a un barbero activo que tenga
//     libre el [inicio, fin) real del turno (barberoLibreEnRango).
//   - Estado efectivo, calculado al leer (como el rango efectivo de los descansos):
//     una 'pendiente' guardada vale mientras el turno siga reservado, futuro, de A
//     y con el inicio que tenía al pedirse (turno_inicio), y B siga activo y libre.
//     Si no, se muestra 'vencido' con su motivo, sin escribirlo.
//   - Aceptar es una sola sentencia que mueve el turno y cierra la solicitud.
//   - Nunca se cancela un turno ni se manda un mail al cliente.

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { TZ } from '../utils/constantes.js';
import { cargarDatosAgenda, barberoLibreEnRango } from './disponibilidadService.js';
import { suspensionSolapaSql } from './suspensionesService.js';
import { sqlTurnoEnriquecido } from './sqlTurnoEnriquecido.js';
import { actualizarEvento } from './googleCalendar.js';
import { construirContextoMail } from './mail/mailer.js';

// Motivos de turno_traspaso.motivo_vencimiento (mismo CHECK que la DB). Los textos
// para el usuario los arma la app del barbero.
export const MOTIVOS_VENCIMIENTO = {
  TURNO_NO_RESERVADO: 'turno_no_reservado', // se canceló, se cobró o quedó como no asistió
  TURNO_REASIGNADO: 'turno_reasignado',     // el turno ya no es de A
  TURNO_REPROGRAMADO: 'turno_reprogramado', // el inicio ya no es turno_inicio
  TURNO_EMPEZADO: 'turno_empezado',         // llegó la hora sin respuesta
  BARBERO_INACTIVO: 'barbero_inactivo',     // B se desactivó
  HORARIO_OCUPADO: 'horario_ocupado',       // B ya no tiene libre el horario
};

/**
 * Error de negocio del traspaso, con el status HTTP y el código que devuelve el
 * controller como { error, codigo, ...extra }.
 */
export class TraspasoError extends Error {
  /**
   * @param {number} status - Status HTTP (400, 404 o 409)
   * @param {string} codigo - Código para el front (ej. 'traspaso_pendiente')
   * @param {string} mensaje - Texto para el usuario
   * @param {Object} [extra] - Datos que van al lado de error y codigo (ej. { motivo })
   */
  constructor(status, codigo, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.extra = extra;
  }
}

/**
 * Arma el 404 de algo que no existe o es ajeno (para el barbero, es lo mismo).
 * @param {'turno'|'barbero'|'traspaso'} recurso
 * @returns {TraspasoError}
 */
export const errorNoEncontrado = (recurso) => {
  const mensajes = { turno: 'Turno no encontrado', barbero: 'Barbero no encontrado', traspaso: 'Traspaso no encontrado' };
  return new TraspasoError(404, `${recurso}_no_encontrado`, mensajes[recurso]);
};

/**
 * 409 de una solicitud que ya no está pendiente en la tabla: si quedó vencida,
 * con su motivo; si no, con el estado en que quedó.
 * @param {{ estado: string, motivo_vencimiento: string|null }} fila
 * @returns {TraspasoError}
 */
const errorYaNoPendiente = (fila) => (fila.estado === 'vencido'
  ? new TraspasoError(409, 'traspaso_vencido', 'El traspaso venció', { motivo: fila.motivo_vencimiento })
  : new TraspasoError(409, 'traspaso_ya_respondido', 'El traspaso ya fue respondido', { estado: fila.estado }));

/**
 * 409 de una solicitud que venció (guardada o en los hechos).
 * @param {string} motivo - Uno de MOTIVOS_VENCIMIENTO
 * @returns {TraspasoError}
 */
const errorVencido = (motivo) => new TraspasoError(409, 'traspaso_vencido', 'El traspaso venció', { motivo });

// Motivo por el que una 'pendiente' guardada ya no vale, según lo que se puede ver
// en SQL (null si pasa todos esos chequeos; falta ver si B sigue libre, que se hace
// con la lógica de disponibilidad). El orden decide el motivo cuando hay más de uno.
// Usa los alias de SQL_TRASPASO (tt, t, ba) y el reloj de la base.
const MOTIVO_SQL = `
  CASE
    WHEN tt.estado <> 'pendiente'        THEN NULL
    WHEN t.estado <> 'reservado'         THEN '${MOTIVOS_VENCIMIENTO.TURNO_NO_RESERVADO}'
    WHEN t.barbero_id <> tt.de_barbero_id THEN '${MOTIVOS_VENCIMIENTO.TURNO_REASIGNADO}'
    WHEN t.inicio <> tt.turno_inicio     THEN '${MOTIVOS_VENCIMIENTO.TURNO_REPROGRAMADO}'
    WHEN t.inicio <= now()               THEN '${MOTIVOS_VENCIMIENTO.TURNO_EMPEZADO}'
    WHEN NOT ba.activo                   THEN '${MOTIVOS_VENCIMIENTO.BARBERO_INACTIVO}'
  END`;

/**
 * SELECT de solicitudes con su turno (inicio, fin, servicio y cliente), los dos
 * barberos y el motivo de SQL (motivo_sql). Todas las lecturas de la tabla pasan
 * por acá, así el estado efectivo se calcula siempre igual.
 * @param {string} condiciones - WHERE (y ORDER BY); fragmento fijo del código
 * @returns {string} la sentencia SQL
 */
const sqlTraspaso = (condiciones) => `
  SELECT tt.id, tt.turno_id, tt.de_barbero_id, tt.a_barbero_id, tt.turno_inicio,
         tt.estado, tt.motivo_vencimiento, tt.created_at, tt.respondido_en,
         t.inicio, t.fin, s.nombre AS servicio_nombre, c.nombre AS cliente_nombre,
         bd.nombre AS de_barbero_nombre, ba.nombre AS a_barbero_nombre,
         ${MOTIVO_SQL} AS motivo_sql
  FROM turno_traspaso tt
  JOIN turno t        ON t.id = tt.turno_id AND t.tenant_id = tt.tenant_id
  JOIN servicio s     ON s.id = t.servicio_id
  LEFT JOIN cliente c ON c.id = t.cliente_id
  JOIN barbero bd     ON bd.id = tt.de_barbero_id
  JOIN barbero ba     ON ba.id = tt.a_barbero_id
  ${condiciones}`;

/**
 * Pasa un instante de pg (Date) a ISO con offset argentino.
 * @param {Date|null} fecha
 * @returns {string|null}
 */
const aIso = (fecha) => (fecha ? DateTime.fromJSDate(fecha).setZone(TZ).toISO() : null);

/**
 * Pasa un instante de pg (Date) a DateTime de luxon en TZ Argentina.
 * @param {Date} fecha
 * @returns {DateTime}
 */
const aDateTime = (fecha) => DateTime.fromJSDate(fecha, { zone: TZ });

/**
 * Agenda de un barbero dentro de lo que cargó cargarDatosAgenda, por id.
 * @param {Object} datos - Resultado de cargarDatosAgenda
 * @param {string} barberoId
 * @returns {Object|undefined}
 */
const agendaDe = (datos, barberoId) =>
  datos.agendas.find(a => String(a.id).toLowerCase() === String(barberoId).toLowerCase());

/**
 * Indica si un barbero tiene libre el [inicio, fin) de un turno. Hace el set fijo
 * de queries de cargarDatosAgenda para ese día y ese barbero.
 * @param {string} tenantId
 * @param {string} barberoId
 * @param {Date} inicio - Inicio del turno, como llega de pg
 * @param {Date} fin - Fin del turno, como llega de pg
 * @returns {Promise<boolean>}
 */
const barberoLibreParaTurno = async (tenantId, barberoId, inicio, fin) => {
  const ini = aDateTime(inicio);
  const fecha = ini.toISODate();
  const datos = await cargarDatosAgenda({ tenantId, barberoIds: [barberoId], desde: fecha, hasta: fecha });
  return barberoLibreEnRango({ datos, agenda: datos.agendas[0], inicio: ini, fin: aDateTime(fin) });
};

/**
 * Calcula el estado efectivo de las solicitudes leídas con sqlTraspaso y las arma
 * con la forma de la API. Las pendientes que pasan los chequeos de SQL se
 * verifican contra la disponibilidad de B con una sola carga (cargarDatosAgenda)
 * para todos los B y todos los días: sin pendientes, no hace queries.
 * @param {string} tenantId
 * @param {Array<Object>} filas - Filas de sqlTraspaso
 * @returns {Promise<Array<Object>>} solicitudes (ver armarSolicitud), en el mismo orden
 */
const resolverEstados = async (tenantId, filas) => {
  const aVerificar = filas.filter(f => f.estado === 'pendiente' && !f.motivo_sql);
  const libres = new Map();

  if (aVerificar.length > 0) {
    const fechas = aVerificar.map(f => aDateTime(f.inicio).toISODate()).sort();
    const datos = await cargarDatosAgenda({
      tenantId,
      barberoIds: [...new Set(aVerificar.map(f => f.a_barbero_id))],
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
    });
    for (const f of aVerificar) {
      libres.set(f.id, barberoLibreEnRango({
        datos, agenda: agendaDe(datos, f.a_barbero_id), inicio: aDateTime(f.inicio), fin: aDateTime(f.fin),
      }));
    }
  }

  return filas.map((f) => {
    if (f.estado !== 'pendiente') return armarSolicitud(f, f.estado, f.motivo_vencimiento);
    if (f.motivo_sql) return armarSolicitud(f, 'vencido', f.motivo_sql);
    if (!libres.get(f.id)) return armarSolicitud(f, 'vencido', MOTIVOS_VENCIMIENTO.HORARIO_OCUPADO);
    return armarSolicitud(f, 'pendiente', null);
  });
};

/**
 * Arma una solicitud con la forma de la API.
 * @param {Object} f - Fila de sqlTraspaso
 * @param {string} estado - Estado efectivo
 * @param {string|null} motivo - Motivo, solo en un vencido
 * @returns {{ id, estado, motivo, turno_inicio, created_at, respondido_en,
 *   turno: { id, inicio, fin, servicio_nombre, cliente_nombre },
 *   de_barbero: { id, nombre }, a_barbero: { id, nombre } }}
 *   cliente_nombre es null en un turno "Sin datos"
 */
const armarSolicitud = (f, estado, motivo) => ({
  id: f.id,
  estado,
  motivo: estado === 'vencido' ? motivo : null,
  turno_inicio: aIso(f.turno_inicio),
  created_at: aIso(f.created_at),
  respondido_en: aIso(f.respondido_en),
  turno: {
    id: f.turno_id,
    inicio: aIso(f.inicio),
    fin: aIso(f.fin),
    servicio_nombre: f.servicio_nombre,
    cliente_nombre: f.cliente_nombre ?? null,
  },
  de_barbero: { id: f.de_barbero_id, nombre: f.de_barbero_nombre },
  a_barbero: { id: f.a_barbero_id, nombre: f.a_barbero_nombre },
});

/**
 * Lee una solicitud por id y la devuelve con su estado efectivo.
 * @param {string} tenantId
 * @param {string} traspasoId
 * @returns {Promise<Object>} la solicitud (armarSolicitud)
 */
const obtenerTraspaso = async (tenantId, traspasoId) => {
  const res = await query(sqlTraspaso('WHERE tt.id = $1 AND tt.tenant_id = $2'), [traspasoId, tenantId]);
  const [solicitud] = await resolverEstados(tenantId, res.rows);
  return solicitud;
};

/**
 * Cierra como 'vencido' una solicitud que en los hechos ya no vale. Solo si sigue
 * 'pendiente' en la tabla: si entre medio la respondieron, no la pisa.
 * @param {string} tenantId
 * @param {string} traspasoId
 * @param {string} motivo - Uno de MOTIVOS_VENCIMIENTO
 * @returns {Promise<void>}
 */
const marcarVencido = async (tenantId, traspasoId, motivo) => {
  await query(
    `UPDATE turno_traspaso SET estado = 'vencido', motivo_vencimiento = $3, respondido_en = now()
     WHERE id = $1 AND tenant_id = $2 AND estado = 'pendiente'`,
    [traspasoId, tenantId, motivo]
  );
};

/**
 * Lee un turno del barbero y verifica que se pueda traspasar: 'reservado' y sin
 * empezar (con el reloj de la base).
 * @param {string} tenantId
 * @param {string} barberoId - El barbero A, el del token
 * @param {string} turnoId - UUID ya validado
 * @returns {Promise<{ id: string, inicio: Date, fin: Date }>}
 * @throws {TraspasoError} 404 turno_no_encontrado (no existe o es de otro) |
 *   409 turno_no_traspasable, con el estado del turno
 */
const leerTurnoTraspasable = async (tenantId, barberoId, turnoId) => {
  const res = await query(
    `SELECT id, estado, inicio, fin, inicio <= now() AS empezo
     FROM turno WHERE id = $1 AND tenant_id = $2 AND barbero_id = $3`,
    [turnoId, tenantId, barberoId]
  );
  const turno = res.rows[0];
  if (!turno) throw errorNoEncontrado('turno');
  if (turno.estado !== 'reservado' || turno.empezo) {
    throw new TraspasoError(409, 'turno_no_traspasable',
      'Solo se puede traspasar un turno reservado que todavía no empezó', { estado: turno.estado });
  }
  return turno;
};

/**
 * Barberos a los que A puede ofrecerle un turno: los activos, distintos de A, con
 * el [inicio, fin) del turno libre. Carga a todos los barberos de una vez (como
 * calcularSlotsCualquiera).
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.barberoId - El barbero A, el del token
 * @param {string} params.turnoId - UUID ya validado
 * @returns {Promise<Array<{ barbero_id: string, nombre: string }>>} por nombre
 * @throws {TraspasoError} los de leerTurnoTraspasable
 */
export const listarCandidatos = async ({ tenantId, barberoId, turnoId }) => {
  const turno = await leerTurnoTraspasable(tenantId, barberoId, turnoId);
  const inicio = aDateTime(turno.inicio);
  const fin = aDateTime(turno.fin);
  const fecha = inicio.toISODate();

  // Sin barberoIds: los activos del tenant, con nombre y ordenados por nombre.
  const datos = await cargarDatosAgenda({ tenantId, desde: fecha, hasta: fecha });
  return datos.agendas
    .filter(a => String(a.id).toLowerCase() !== String(barberoId).toLowerCase())
    .filter(agenda => barberoLibreEnRango({ datos, agenda, inicio, fin }))
    .map(a => ({ barbero_id: a.id, nombre: a.nombre }));
};

/**
 * A le ofrece su turno a B. Si el turno ya tiene una 'pendiente' guardada que en
 * los hechos venció, la cierra como 'vencido' y crea la nueva; si sigue vigente,
 * 409. El índice único parcial (una pendiente por turno) frena dos pedidos a la
 * vez. No le cambia nada al turno.
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.deBarberoId - El barbero A, el del token
 * @param {string} params.turnoId - UUID ya validado
 * @param {string} params.aBarberoId - UUID ya validado, distinto de A
 * @returns {Promise<Object>} la solicitud creada (armarSolicitud)
 * @throws {TraspasoError} 404 turno_no_encontrado | barbero_no_encontrado;
 *   409 turno_no_traspasable | traspaso_pendiente (con traspaso_id) | no_es_candidato
 */
export const crearTraspaso = async ({ tenantId, deBarberoId, turnoId, aBarberoId }) => {
  const turno = await leerTurnoTraspasable(tenantId, deBarberoId, turnoId);

  const barberoRes = await query(
    'SELECT activo FROM barbero WHERE id = $1 AND tenant_id = $2',
    [aBarberoId, tenantId]
  );
  if (barberoRes.rows.length === 0) throw errorNoEncontrado('barbero');

  // ── La pendiente guardada del turno, si hay: vigente → 409; vencida → se cierra.
  const previaRes = await query(
    sqlTraspaso(`WHERE tt.tenant_id = $1 AND tt.turno_id = $2 AND tt.estado = 'pendiente'`),
    [tenantId, turnoId]
  );
  if (previaRes.rows.length > 0) {
    const [previa] = await resolverEstados(tenantId, previaRes.rows);
    if (previa.estado === 'pendiente') {
      throw new TraspasoError(409, 'traspaso_pendiente',
        'El turno ya tiene un traspaso pendiente: retiralo antes de pedir otro', { traspaso_id: previa.id });
    }
    await marcarVencido(tenantId, previa.id, previa.motivo);
  }

  // ── B tiene que ser candidato: activo y con el horario del turno libre.
  const esCandidato = barberoRes.rows[0].activo
    && await barberoLibreParaTurno(tenantId, aBarberoId, turno.inicio, turno.fin);
  if (!esCandidato) {
    throw new TraspasoError(409, 'no_es_candidato', 'Ese barbero no tiene libre el horario del turno');
  }

  // ── Alta, en una sola sentencia con las condiciones del turno: si entre la
  // lectura y acá lo cancelaron, empezó o lo movieron, no se crea.
  let insertRes;
  try {
    insertRes = await query(
      `INSERT INTO turno_traspaso (tenant_id, turno_id, de_barbero_id, a_barbero_id, turno_inicio)
       SELECT t.tenant_id, t.id, t.barbero_id, $4, t.inicio
       FROM turno t
       WHERE t.id = $1 AND t.tenant_id = $2 AND t.barbero_id = $3
         AND t.estado = 'reservado' AND t.inicio > now() AND t.inicio = $5
       RETURNING id`,
      [turnoId, tenantId, deBarberoId, aBarberoId, turno.inicio]
    );
  } catch (err) {
    // Índice único parcial: otro pedido creó una pendiente entre medio.
    if (err.code === '23505') {
      const otraRes = await query(
        `SELECT id FROM turno_traspaso WHERE tenant_id = $1 AND turno_id = $2 AND estado = 'pendiente'`,
        [tenantId, turnoId]
      );
      throw new TraspasoError(409, 'traspaso_pendiente',
        'El turno ya tiene un traspaso pendiente: retiralo antes de pedir otro', { traspaso_id: otraRes.rows[0]?.id ?? null });
    }
    throw err;
  }
  if (insertRes.rows.length === 0) {
    throw new TraspasoError(409, 'turno_no_traspasable',
      'Solo se puede traspasar un turno reservado que todavía no empezó');
  }

  return obtenerTraspaso(tenantId, insertRes.rows[0].id);
};

/**
 * Cierra una solicitud pendiente por decisión de un barbero: A la retira o B la
 * rechaza. Una solicitud que en los hechos ya venció también se puede cerrar así.
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.barberoId - El del token: A para retirar, B para rechazar
 * @param {string} params.traspasoId - UUID ya validado
 * @param {'retirado'|'rechazado'} params.estado - El estado en que queda
 * @returns {Promise<Object>} la solicitud cerrada (armarSolicitud)
 * @throws {TraspasoError} 404 traspaso_no_encontrado (no existe o el barbero no es
 *   el que la puede cerrar) | 409 traspaso_ya_respondido | traspaso_vencido
 */
export const cerrarTraspaso = async ({ tenantId, barberoId, traspasoId, estado }) => {
  // Fragmento fijo, nunca input del usuario: A retira lo que envió, B rechaza lo que recibió.
  const columna = estado === 'retirado' ? 'de_barbero_id' : 'a_barbero_id';

  const res = await query(
    `UPDATE turno_traspaso SET estado = $4, respondido_en = now()
     WHERE id = $1 AND tenant_id = $2 AND ${columna} = $3 AND estado = 'pendiente'
     RETURNING id`,
    [traspasoId, tenantId, barberoId, estado]
  );
  if (res.rows.length === 0) {
    // Una lectura solo decide qué responder.
    const actualRes = await query(
      `SELECT estado, motivo_vencimiento FROM turno_traspaso WHERE id = $1 AND tenant_id = $2 AND ${columna} = $3`,
      [traspasoId, tenantId, barberoId]
    );
    if (actualRes.rows.length === 0) throw errorNoEncontrado('traspaso');
    throw errorYaNoPendiente(actualRes.rows[0]);
  }
  return obtenerTraspaso(tenantId, traspasoId);
};

/**
 * Lee una solicitud recibida por B y, si ya no vale (en la tabla o en los hechos),
 * tira el 409 que corresponde, cerrándola como 'vencido' si hace falta.
 * @param {string} tenantId
 * @param {string} barberoId - El barbero B, el del token
 * @param {string} traspasoId
 * @returns {Promise<Object>} la fila de sqlTraspaso, todavía pendiente
 * @throws {TraspasoError} 404 traspaso_no_encontrado | 409 traspaso_ya_respondido | traspaso_vencido
 */
const leerRecibidaVigenteSql = async (tenantId, barberoId, traspasoId) => {
  const res = await query(
    sqlTraspaso('WHERE tt.id = $1 AND tt.tenant_id = $2 AND tt.a_barbero_id = $3'),
    [traspasoId, tenantId, barberoId]
  );
  const fila = res.rows[0];
  if (!fila) throw errorNoEncontrado('traspaso');
  if (fila.estado !== 'pendiente') throw errorYaNoPendiente(fila);
  if (fila.motivo_sql) {
    await marcarVencido(tenantId, traspasoId, fila.motivo_sql);
    throw errorVencido(fila.motivo_sql);
  }
  return fila;
};

/**
 * B acepta una solicitud: el turno pasa a ser suyo. Antes revalida con la lógica de
 * disponibilidad que B tenga el horario libre. Después, una sola sentencia (CTE)
 * mueve el turno y marca la solicitud 'aceptado', solo si la solicitud sigue
 * pendiente y el turno sigue 'reservado', sin empezar, de A y con el inicio que
 * tenía al pedirse, y sin una suspensión o descanso de B en ese horario. Si B se
 * ocupó entre medio (el EXCLUDE de turno da 23P01) o la sentencia no toca nada, la
 * solicitud queda 'vencido' y se responde 409. Nunca cancela el turno.
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.barberoId - El barbero B, el del token
 * @param {string} params.traspasoId - UUID ya validado
 * @returns {Promise<Object>} la solicitud aceptada (armarSolicitud)
 * @throws {TraspasoError} 404 traspaso_no_encontrado | 409 traspaso_ya_respondido |
 *   traspaso_vencido (con motivo)
 */
export const aceptarTraspaso = async ({ tenantId, barberoId, traspasoId }) => {
  const fila = await leerRecibidaVigenteSql(tenantId, barberoId, traspasoId);

  if (!(await barberoLibreParaTurno(tenantId, barberoId, fila.inicio, fila.fin))) {
    await marcarVencido(tenantId, traspasoId, MOTIVOS_VENCIMIENTO.HORARIO_OCUPADO);
    throw errorVencido(MOTIVOS_VENCIMIENTO.HORARIO_OCUPADO);
  }

  // La solicitud se bloquea primero (FOR UPDATE): un retirar o un rechazar que
  // llegue a la vez espera y después ve que ya no está pendiente. Si el UPDATE del
  // turno no toca nada, la solicitud no se marca (FROM movido): queda todo igual.
  let res;
  try {
    res = await query(
      `WITH tr AS (
         SELECT id, turno_id, de_barbero_id, a_barbero_id, turno_inicio
         FROM turno_traspaso
         WHERE id = $1 AND tenant_id = $2 AND a_barbero_id = $3 AND estado = 'pendiente'
         FOR UPDATE
       ),
       movido AS (
         UPDATE turno t SET barbero_id = tr.a_barbero_id
         FROM tr
         WHERE t.id = tr.turno_id AND t.tenant_id = $2
           AND t.estado = 'reservado' AND t.inicio > now()
           AND t.barbero_id = tr.de_barbero_id AND t.inicio = tr.turno_inicio
           AND NOT EXISTS (
             SELECT 1 FROM barbero_suspension bs
             WHERE bs.tenant_id = t.tenant_id AND bs.barbero_id = tr.a_barbero_id
               AND ${suspensionSolapaSql('bs', 't.inicio', 't.fin')}
           )
         RETURNING t.id
       )
       UPDATE turno_traspaso tt SET estado = 'aceptado', respondido_en = now()
       FROM tr, movido
       WHERE tt.id = tr.id
       RETURNING tt.id`,
      [traspasoId, tenantId, barberoId]
    );
  } catch (err) {
    // EXCLUDE turno_no_solapamiento: B tomó otro turno en ese horario entre medio.
    if (err.code === '23P01') {
      await marcarVencido(tenantId, traspasoId, MOTIVOS_VENCIMIENTO.HORARIO_OCUPADO);
      throw errorVencido(MOTIVOS_VENCIMIENTO.HORARIO_OCUPADO);
    }
    throw err;
  }

  if (res.rows.length === 0) {
    // Algo cambió entre la lectura y la sentencia. La misma lectura decide qué
    // responder; si pasa todos sus chequeos, lo que frenó fue una suspensión o un
    // descanso de B.
    await leerRecibidaVigenteSql(tenantId, barberoId, traspasoId);
    await marcarVencido(tenantId, traspasoId, MOTIVOS_VENCIMIENTO.HORARIO_OCUPADO);
    throw errorVencido(MOTIVOS_VENCIMIENTO.HORARIO_OCUPADO);
  }

  return obtenerTraspaso(tenantId, traspasoId);
};

/**
 * Lo que la app del barbero necesita de sus traspasos: los que envió y los que
 * recibió, con el estado efectivo. Ventana: solicitudes de turnos que todavía no
 * empezaron (turno_inicio > now()) y, de cada turno, solo la más nueva de cada
 * lista (si a A le rechazaron una y la pidió a otro, ve la nueva). Pensado para
 * el refresco de la Agenda: una query y, solo si hay pendientes que verificar, la
 * carga de disponibilidad de sus B.
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.barberoId - El del token
 * @returns {Promise<{ enviados: Array<Object>, recibidos: Array<Object> }>}
 *   cada lista ordenada por el inicio del turno (armarSolicitud)
 */
export const listarTraspasos = async ({ tenantId, barberoId }) => {
  const res = await query(
    sqlTraspaso(`WHERE tt.tenant_id = $1 AND (tt.de_barbero_id = $2 OR tt.a_barbero_id = $2)
                   AND tt.turno_inicio > now()
                 ORDER BY tt.created_at DESC`),
    [tenantId, barberoId]
  );

  const id = String(barberoId).toLowerCase();
  // La más nueva de cada turno: las filas llegan de la más nueva a la más vieja.
  const masNuevaPorTurno = (filas) => {
    const vistos = new Set();
    return filas.filter(f => (vistos.has(f.turno_id) ? false : vistos.add(f.turno_id)));
  };
  const enviadas = masNuevaPorTurno(res.rows.filter(f => f.de_barbero_id === id));
  const recibidas = masNuevaPorTurno(res.rows.filter(f => f.a_barbero_id === id));

  // Una sola resolución para las dos listas (una sola carga de disponibilidad).
  const resueltas = await resolverEstados(tenantId, [...enviadas, ...recibidas]);
  const porInicio = (a, b) => Date.parse(a.turno.inicio) - Date.parse(b.turno.inicio);
  return {
    enviados: resueltas.slice(0, enviadas.length).sort(porInicio),
    recibidos: resueltas.slice(enviadas.length).sort(porInicio),
  };
};

/**
 * Best-effort, después de aceptar: pasa el evento de Google Calendar del turno al
 * barbero B. Si B no tiene mail no lo toca (Calendar no acepta un invitado sin
 * mail). Si falla, va a Sentry (console.error) y el traspaso queda hecho.
 * @param {string} tenantId
 * @param {string} turnoId
 * @returns {Promise<void>} nunca tira
 */
export const actualizarCalendarDelTraspaso = async (tenantId, turnoId) => {
  try {
    const res = await query(
      sqlTurnoEnriquecido('t.google_event_id', 'WHERE t.id = $1 AND t.tenant_id = $2'),
      [turnoId, tenantId]
    );
    const fila = res.rows[0];
    if (!fila?.google_event_id) return;
    if (!fila.barbero_email) {
      console.warn('[traspasosService] actualizarCalendarDelTraspaso — saltado: el barbero nuevo no tiene mail | turno_id:', turnoId);
      return;
    }
    const { turno, barbero, servicio, cliente } = construirContextoMail(fila);
    await actualizarEvento(fila.google_event_id, turno, barbero, servicio, cliente);
  } catch (err) {
    console.error('[traspasosService] Error en actualizarCalendarDelTraspaso:', err);
  }
};
