// /backend/src/services/disponibilidadService.js
// Algoritmo de cálculo de slots disponibles para un (barbero, servicio, fecha).
// Cobertura: plan_turnero_v2.md sección 7.
//
// Toda la aritmética de fechas se hace con luxon en TZ Argentina para evitar
// confusiones con UTC al sumar minutos y cruzar bloques horarios.

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { TZ, ANTELACION_MINIMA_MINUTOS } from '../utils/constantes.js';

/**
 * Errores tipados que el controller mapea a códigos HTTP.
 */
export class DisponibilidadError extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo; // 'tenant_no_encontrado' | 'servicio_no_encontrado' | 'barbero_no_encontrado'
  }
}

/**
 * Convierte una hora "HH:MM:SS" + una fecha YYYY-MM-DD en un DateTime
 * de luxon en TZ Argentina.
 */
const armarDateTime = (fecha, hora) => {
  // hora puede venir como "HH:MM:SS" o "HH:MM"
  const [h, m] = hora.split(':').map(Number);
  return DateTime.fromObject(
    {
      year: fecha.year,
      month: fecha.month,
      day: fecha.day,
      hour: h,
      minute: m,
      second: 0,
      millisecond: 0,
    },
    { zone: TZ }
  );
};

/**
 * computarSlotsDeUnDia
 * Recorre los bloques horarios de un día y arma los inicios de slot
 * reservables. Es cómputo puro en memoria: no toca la DB. Lo usan tanto
 * `calcularSlotsDisponibles` (un día) como `calcularDiasConDisponibilidad`
 * (rango), para no duplicar el algoritmo.
 *
 * @param {Object} params
 * @param {DateTime} params.fechaArg - Fecha del día, en TZ Argentina
 * @param {Array<{hora_inicio:string,hora_fin:string}>} params.bloquesHorario - Bloques del barbero ese día
 * @param {Array<{inicio:DateTime,fin:DateTime}>} params.turnos - Turnos reservados a evitar
 * @param {Array<{inicio:DateTime,fin:DateTime}>} params.suspensiones - Suspensiones a evitar
 * @param {number} params.duracionSlotMin - Minutos por slot del tenant
 * @param {number} params.duracionServicioMin - Minutos que ocupa el servicio
 * @param {DateTime|null} params.umbralMinimo - Inicio mínimo permitido (hoy: now+margen); null si no aplica
 * @param {boolean} [params.soloPrimero=false] - Si es true, corta y devuelve apenas encuentra el primer slot
 * @returns {string[]} array de ISO strings (con offset Argentina)
 */
const computarSlotsDeUnDia = ({
  fechaArg, bloquesHorario, turnos, suspensiones,
  duracionSlotMin, duracionServicioMin, umbralMinimo, soloPrimero = false,
}) => {
  // ¿el rango [aIni,aFin) solapa con [bIni,bFin)?
  const solapa = (aIni, aFin, bIni, bFin) => aIni < bFin && bIni < aFin;

  const slots = [];

  for (const bloque of bloquesHorario) {
    const bloqueInicio = armarDateTime(fechaArg, bloque.hora_inicio);
    const bloqueFin    = armarDateTime(fechaArg, bloque.hora_fin);

    let slotInicio = bloqueInicio;
    while (true) {
      const slotFin = slotInicio.plus({ minutes: duracionServicioMin });

      // El servicio se pasa del bloque → fin del bloque, salimos.
      if (slotFin > bloqueFin) break;

      // Margen mínimo cuando la fecha es hoy.
      if (umbralMinimo && slotInicio <= umbralMinimo) {
        slotInicio = slotInicio.plus({ minutes: duracionSlotMin });
        continue;
      }

      // Solapa con un turno reservado.
      if (turnos.some(t => solapa(slotInicio, slotFin, t.inicio, t.fin))) {
        slotInicio = slotInicio.plus({ minutes: duracionSlotMin });
        continue;
      }

      // Solapa con una suspensión.
      if (suspensiones.some(s => solapa(slotInicio, slotFin, s.inicio, s.fin))) {
        slotInicio = slotInicio.plus({ minutes: duracionSlotMin });
        continue;
      }

      slots.push(slotInicio.toISO());
      if (soloPrimero) return slots;
      slotInicio = slotInicio.plus({ minutes: duracionSlotMin });
    }
  }

  return slots;
};

/**
 * Calcula el array de inicios de slots disponibles para reservar.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.barberoId
 * @param {string} params.servicioId
 * @param {string} params.fecha - 'YYYY-MM-DD'
 * @returns {Promise<string[]>} array de ISO strings (con offset Argentina)
 */
export const calcularSlotsDisponibles = async ({ tenantId, barberoId, servicioId, fecha }) => {
  // Fecha base en TZ Argentina, a las 00:00.
  const fechaArg = DateTime.fromISO(fecha, { zone: TZ });
  if (!fechaArg.isValid) {
    throw new DisponibilidadError('fecha_invalida', 'Fecha inválida');
  }
  const inicioDia = fechaArg.startOf('day');
  const finDia    = fechaArg.endOf('day');

  // Corto temprano si la fecha consultada ya pasó. Sin este check, fechas
  // pasadas devuelven todos los slots del día como reservables, porque el
  // margen ANTELACION_MINIMA_MINUTOS solo se aplica cuando la fecha es hoy.
  const ahoraTemprano = DateTime.now().setZone(TZ);
  if (finDia < ahoraTemprano) {
    return [];
  }

  // dia_semana en convención PostgreSQL/JavaScript: 0=domingo, 1=lunes, ..., 6=sábado.
  // Luxon devuelve 1=lunes...7=domingo, por eso el módulo 7.
  const diaSemana = fechaArg.weekday % 7;

  // 7 queries en paralelo. Todas filtran por tenant_id para impedir
  // cruce de datos entre tenants.
  const [tenantRes, servicioRes, horariosRes, turnosRes, suspensionesRes, horarioTenantRes, feriadoRes] = await Promise.all([
    query(
      `SELECT duracion_slot_minutos FROM tenant WHERE id = $1 AND activo = true`,
      [tenantId]
    ),
    query(
      `SELECT cantidad_slots FROM servicio WHERE id = $1 AND tenant_id = $2 AND activo = true`,
      [servicioId, tenantId]
    ),
    query(
      `SELECT hora_inicio, hora_fin
       FROM barbero_horario
       WHERE tenant_id = $1 AND barbero_id = $2 AND dia_semana = $3
       ORDER BY hora_inicio ASC`,
      [tenantId, barberoId, diaSemana]
    ),
    query(
      `SELECT inicio, fin
       FROM turno
       WHERE tenant_id = $1
         AND barbero_id = $2
         AND estado = 'reservado'
         AND inicio < $4
         AND fin    > $3`,
      [tenantId, barberoId, inicioDia.toISO(), finDia.toISO()]
    ),
    query(
      `SELECT desde, hasta
       FROM barbero_suspension
       WHERE tenant_id = $1
         AND barbero_id = $2
         AND desde < $4
         AND hasta > $3`,
      [tenantId, barberoId, inicioDia.toISO(), finDia.toISO()]
    ),
    query(
      `SELECT hora_inicio, hora_fin
       FROM tenant_horario_atencion
       WHERE tenant_id = $1 AND dia_semana = $2`,
      [tenantId, diaSemana]
    ),
    query(
      `SELECT 1 FROM tenant_feriado WHERE tenant_id = $1 AND fecha = $2::date`,
      [tenantId, fecha]
    ),
  ]);

  if (tenantRes.rows.length === 0) {
    throw new DisponibilidadError('tenant_no_encontrado', 'Tenant no encontrado');
  }
  if (servicioRes.rows.length === 0) {
    throw new DisponibilidadError('servicio_no_encontrado', 'Servicio no encontrado o inactivo');
  }

  // El negocio no abre ese día (sin fila en tenant_horario_atencion) → no hay slots.
  if (horarioTenantRes.rows.length === 0) {
    return [];
  }

  // La fecha es feriado → el negocio cierra el día completo, no hay slots.
  if (feriadoRes.rows.length > 0) {
    return [];
  }
  // No hace falta verificar que el barbero exista: si no tiene horarios para
  // ese día (o no existe), horariosRes.rows estará vacío y la respuesta será [].

  const duracionSlotMin    = tenantRes.rows[0].duracion_slot_minutos;
  const cantidadSlots      = servicioRes.rows[0].cantidad_slots;
  const duracionServicioMin = duracionSlotMin * cantidadSlots;

  // Convertir turnos y suspensiones a Intervals de luxon una sola vez.
  const turnos = turnosRes.rows.map(t => ({
    inicio: DateTime.fromJSDate(t.inicio, { zone: TZ }),
    fin:    DateTime.fromJSDate(t.fin,    { zone: TZ }),
  }));
  const suspensiones = suspensionesRes.rows.map(s => ({
    inicio: DateTime.fromJSDate(s.desde, { zone: TZ }),
    fin:    DateTime.fromJSDate(s.hasta, { zone: TZ }),
  }));

  // Si la fecha es hoy, calcular el umbral mínimo de inicio (now + margen).
  const ahora = DateTime.now().setZone(TZ);
  const esHoy = ahora.hasSame(fechaArg, 'day');
  const umbralMinimo = esHoy ? ahora.plus({ minutes: ANTELACION_MINIMA_MINUTOS }) : null;

  const slotsDisponibles = computarSlotsDeUnDia({
    fechaArg,
    bloquesHorario: horariosRes.rows,
    turnos,
    suspensiones,
    duracionSlotMin,
    duracionServicioMin,
    umbralMinimo,
  });

  return slotsDisponibles;
};

/**
 * Calcula qué días de un rango tienen al menos un slot reservable para un
 * (barbero, servicio). Pensado para grisar días en el calendario del turnero.
 *
 * A diferencia de llamar `calcularSlotsDisponibles` una vez por día, esta
 * función hace un set fijo de queries (independiente del tamaño del rango):
 * trae los datos compartidos una sola vez y los turnos/suspensiones de todo
 * el rango en una query cada uno, después recorre los días en memoria.
 *
 * El resultado ya excluye días cerrados del negocio, feriados, fechas
 * pasadas y "hoy ya cerrado" (lo cubre el umbral mínimo): es la fuente
 * única de verdad sobre qué días son reservables.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.barberoId
 * @param {string} params.servicioId
 * @param {string} params.desde - 'YYYY-MM-DD' (inclusive)
 * @param {string} params.hasta - 'YYYY-MM-DD' (inclusive)
 * @returns {Promise<string[]>} array de fechas 'YYYY-MM-DD' con ≥1 slot
 */
export const calcularDiasConDisponibilidad = async ({ tenantId, barberoId, servicioId, desde, hasta }) => {
  const desdeArg = DateTime.fromISO(desde, { zone: TZ });
  const hastaArg = DateTime.fromISO(hasta, { zone: TZ });
  if (!desdeArg.isValid || !hastaArg.isValid) {
    throw new DisponibilidadError('fecha_invalida', 'Fecha inválida');
  }
  if (hastaArg < desdeArg) {
    throw new DisponibilidadError('fecha_invalida', 'hasta debe ser posterior o igual a desde');
  }

  const inicioRango = desdeArg.startOf('day');
  const finRango    = hastaArg.endOf('day');

  // Set fijo de queries para todo el rango. Las dependientes de fecha
  // (turnos, suspensiones, feriados) se piden por rango, no por día.
  const [tenantRes, servicioRes, horariosRes, turnosRes, suspensionesRes, horarioTenantRes, feriadoRes] = await Promise.all([
    query(
      `SELECT duracion_slot_minutos FROM tenant WHERE id = $1 AND activo = true`,
      [tenantId]
    ),
    query(
      `SELECT cantidad_slots FROM servicio WHERE id = $1 AND tenant_id = $2 AND activo = true`,
      [servicioId, tenantId]
    ),
    query(
      `SELECT dia_semana, hora_inicio, hora_fin
       FROM barbero_horario
       WHERE tenant_id = $1 AND barbero_id = $2
       ORDER BY hora_inicio ASC`,
      [tenantId, barberoId]
    ),
    query(
      `SELECT inicio, fin
       FROM turno
       WHERE tenant_id = $1
         AND barbero_id = $2
         AND estado = 'reservado'
         AND inicio < $4
         AND fin    > $3`,
      [tenantId, barberoId, inicioRango.toISO(), finRango.toISO()]
    ),
    query(
      `SELECT desde, hasta
       FROM barbero_suspension
       WHERE tenant_id = $1
         AND barbero_id = $2
         AND desde < $4
         AND hasta > $3`,
      [tenantId, barberoId, inicioRango.toISO(), finRango.toISO()]
    ),
    query(
      `SELECT dia_semana, hora_inicio, hora_fin
       FROM tenant_horario_atencion
       WHERE tenant_id = $1`,
      [tenantId]
    ),
    query(
      `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha
       FROM tenant_feriado
       WHERE tenant_id = $1 AND fecha BETWEEN $2::date AND $3::date`,
      [tenantId, desde, hasta]
    ),
  ]);

  if (tenantRes.rows.length === 0) {
    throw new DisponibilidadError('tenant_no_encontrado', 'Tenant no encontrado');
  }
  if (servicioRes.rows.length === 0) {
    throw new DisponibilidadError('servicio_no_encontrado', 'Servicio no encontrado o inactivo');
  }

  const duracionSlotMin     = tenantRes.rows[0].duracion_slot_minutos;
  const cantidadSlots       = servicioRes.rows[0].cantidad_slots;
  const duracionServicioMin = duracionSlotMin * cantidadSlots;

  // Días de semana en que el negocio abre (0=domingo..6=sábado).
  const diasAbiertosNegocio = new Set(horarioTenantRes.rows.map(r => r.dia_semana));
  // Feriados del rango como 'YYYY-MM-DD'.
  const feriados = new Set(feriadoRes.rows.map(r => r.fecha));

  // Bloques del barbero agrupados por día de semana.
  const horariosPorDia = new Map();
  for (const r of horariosRes.rows) {
    if (!horariosPorDia.has(r.dia_semana)) horariosPorDia.set(r.dia_semana, []);
    horariosPorDia.get(r.dia_semana).push(r);
  }

  // Turnos y suspensiones del rango → Intervals de luxon, una sola vez.
  const turnos = turnosRes.rows.map(t => ({
    inicio: DateTime.fromJSDate(t.inicio, { zone: TZ }),
    fin:    DateTime.fromJSDate(t.fin,    { zone: TZ }),
  }));
  const suspensiones = suspensionesRes.rows.map(s => ({
    inicio: DateTime.fromJSDate(s.desde, { zone: TZ }),
    fin:    DateTime.fromJSDate(s.hasta, { zone: TZ }),
  }));

  const ahora = DateTime.now().setZone(TZ);
  const diasDisponibles = [];

  // Recorrido en memoria, día por día.
  for (let dia = inicioRango; dia <= finRango; dia = dia.plus({ days: 1 })) {
    const fechaArg = dia.startOf('day');
    const fechaISO = fechaArg.toISODate();

    // Fecha pasada → no reservable.
    if (fechaArg.endOf('day') < ahora) continue;
    // Feriado → el negocio cierra el día completo.
    if (feriados.has(fechaISO)) continue;

    const diaSemana = fechaArg.weekday % 7;
    // El negocio no abre ese día de semana.
    if (!diasAbiertosNegocio.has(diaSemana)) continue;
    // El barbero no tiene bloques horarios ese día.
    const bloques = horariosPorDia.get(diaSemana);
    if (!bloques || bloques.length === 0) continue;

    // Umbral mínimo solo si el día es hoy.
    const umbralMinimo = ahora.hasSame(fechaArg, 'day')
      ? ahora.plus({ minutes: ANTELACION_MINIMA_MINUTOS })
      : null;

    const slots = computarSlotsDeUnDia({
      fechaArg,
      bloquesHorario: bloques,
      turnos,
      suspensiones,
      duracionSlotMin,
      duracionServicioMin,
      umbralMinimo,
      soloPrimero: true, // solo nos interesa si hay ≥1 slot
    });

    if (slots.length > 0) diasDisponibles.push(fechaISO);
  }

  return diasDisponibles;
};
