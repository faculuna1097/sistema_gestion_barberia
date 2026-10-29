// /backend/src/services/disponibilidadService.js
// Algoritmo de cálculo de slots disponibles para un (barbero, servicio, fecha)
// y su variante "Cualquier barbero": la unión de los horarios de todos los
// barberos activos, con el barbero que se asigna a cada horario. También arma
// la grilla de slots de la Agenda del barbero (calcularGrillaDelDia).
// Decisiones: docs/decisiones_turnero.md, docs/decisiones_turnero_ux.md
// ("Decisiones técnicas — backend") y docs/decisiones_descansos.md.
//
// Toda la aritmética de fechas se hace con luxon en TZ Argentina para evitar
// confusiones con UTC al sumar minutos y cruzar bloques horarios.

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { listarBarberosActivos } from './barberosService.js';
import { finEfectivoSql, suspensionSolapaSql } from './suspensionesService.js';
import { TZ, ANTELACION_MINIMA_MINUTOS, DIAS_MAXIMOS_RANGO_DISPONIBILIDAD } from '../utils/constantes.js';

/**
 * Errores tipados que el controller mapea a códigos HTTP.
 */
export class DisponibilidadError extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo; // 'fecha_invalida' | 'tenant_no_encontrado' | 'servicio_no_encontrado'
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
 * ¿El rango [aIni, aFin) se superpone con [bIni, bFin)? Rangos semiabiertos: dos
 * rangos que solo se tocan en un extremo (uno termina cuando empieza el otro) no
 * se superponen. Lo comparten el cálculo de slots reservables y la grilla.
 * @param {DateTime} aIni @param {DateTime} aFin @param {DateTime} bIni @param {DateTime} bFin
 * @returns {boolean}
 */
const solapa = (aIni, aFin, bIni, bFin) => aIni < bFin && bIni < aFin;

/**
 * computarSlotsDeUnDia
 * Recorre los bloques horarios de un día y arma los inicios de slot
 * reservables. Es cómputo puro en memoria: no toca la DB. Lo usan
 * `calcularSlotsDisponibles` (un día), `calcularDiasConDisponibilidad`
 * (rango) y `calcularGrillaDelDia` (sin turnos ni suspensiones, para el
 * esqueleto de la grilla), para no duplicar el algoritmo.
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
 * parsearFecha
 * Convierte la fecha de la consulta en el DateTime de ese día a las 00:00
 * en TZ Argentina.
 *
 * @param {string} fecha - 'YYYY-MM-DD'
 * @returns {DateTime} el día, a las 00:00 en TZ Argentina
 * @throws {DisponibilidadError} 'fecha_invalida' si no es una fecha real
 */
const parsearFecha = (fecha) => {
  const fechaArg = DateTime.fromISO(fecha, { zone: TZ });
  if (!fechaArg.isValid) {
    throw new DisponibilidadError('fecha_invalida', 'Fecha inválida');
  }
  return fechaArg;
};

/**
 * parsearRango
 * Valida un rango de fechas y devuelve sus extremos en TZ Argentina. El rango
 * no puede superar DIAS_MAXIMOS_RANGO_DISPONIBILIDAD días: el cálculo lo
 * recorre día por día, y sin tope un rango de años bloquearía el proceso.
 *
 * @param {string} desde - 'YYYY-MM-DD' (inclusive)
 * @param {string} hasta - 'YYYY-MM-DD' (inclusive)
 * @returns {{ inicioRango: DateTime, finRango: DateTime }} 00:00 de `desde` y 23:59:59.999 de `hasta`
 * @throws {DisponibilidadError} 'fecha_invalida' si alguna fecha no es real, `hasta` < `desde`
 *   o el rango supera el tope
 */
const parsearRango = (desde, hasta) => {
  const desdeArg = DateTime.fromISO(desde, { zone: TZ });
  const hastaArg = DateTime.fromISO(hasta, { zone: TZ });
  if (!desdeArg.isValid || !hastaArg.isValid) {
    throw new DisponibilidadError('fecha_invalida', 'Fecha inválida');
  }
  if (hastaArg < desdeArg) {
    throw new DisponibilidadError('fecha_invalida', 'hasta debe ser posterior o igual a desde');
  }
  // +1 porque los dos extremos cuentan.
  if (hastaArg.diff(desdeArg, 'days').days + 1 > DIAS_MAXIMOS_RANGO_DISPONIBILIDAD) {
    throw new DisponibilidadError(
      'fecha_invalida',
      `El rango no puede superar los ${DIAS_MAXIMOS_RANGO_DISPONIBILIDAD} días`
    );
  }
  return { inicioRango: desdeArg.startOf('day'), finRango: hastaArg.endOf('day') };
};

/**
 * cargarDatosAgenda
 * Trae de la DB todo lo que necesita el cálculo de disponibilidad de uno o
 * varios barberos en un rango de días. Es un set fijo de 7 queries en
 * paralelo: la cantidad no depende ni del largo del rango ni de cuántos
 * barberos sean (filtran con `barbero_id = ANY($2)`). Todas filtran por
 * tenant_id para impedir el cruce de datos entre tenants.
 *
 * Con `barberoIds` explícitos no verifica que existan ni que estén activos
 * (como antes del refactor): un barbero sin bloques horarios no tiene slots.
 * Sin `barberoIds` ("Cualquier barbero"), primero busca los barberos activos
 * del tenant, porque sus ids filtran el resto de las queries.
 *
 * Sin `servicioId` (la grilla de la Agenda) no consulta el servicio y la
 * duración a reservar es un slot. El turnero siempre lo pasa.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} [params.servicioId] - Si se omite, la duración es de un slot
 * @param {string[]} [params.barberoIds] - Barberos a cargar; si se omite, todos los activos del tenant
 * @param {string} params.desde - 'YYYY-MM-DD' (inclusive), ya validada
 * @param {string} params.hasta - 'YYYY-MM-DD' (inclusive), ya validada
 * @returns {Promise<Object>} {
 *   agendas: [{ id, nombre, bloquesPorDia, turnos, suspensiones }] — una por barbero;
 *     `nombre` solo viene cuando se cargan los activos; `bloquesPorDia` es un
 *     Map dia_semana (0=domingo..6=sábado) → bloques ordenados por hora_inicio;
 *     `turnos` son [{ inicio, fin }] y `suspensiones` [{ inicio, fin, tipo }],
 *     en DateTime de luxon (las suspensiones con su rango efectivo),
 *   diasAbiertosNegocio: Set<number> — días de semana en que abre el negocio,
 *   horarioNegocioPorDia: Map<number, { hora_inicio, hora_fin }> — horario del
 *     local por día de semana, en 'HH:MM' (solo los días que abre),
 *   feriados: Set<string> — feriados del rango, 'YYYY-MM-DD',
 *   duracionSlotMin: number, duracionServicioMin: number }
 * @throws {DisponibilidadError} 'tenant_no_encontrado' | 'servicio_no_encontrado'
 */
const cargarDatosAgenda = async ({ tenantId, servicioId, barberoIds, desde, hasta }) => {
  const barberos = barberoIds
    ? barberoIds.map(id => ({ id }))
    : await listarBarberosActivos(tenantId);

  // Una agenda vacía por barbero, indexada por id en minúscula: pg devuelve los
  // uuid en minúscula, y el barbero_id de la query string puede venir en
  // mayúscula (Postgres lo acepta igual).
  const agendas = barberos.map(b => ({ ...b, bloquesPorDia: new Map(), turnos: [], suspensiones: [] }));
  const agendaPorId = new Map(agendas.map(a => [String(a.id).toLowerCase(), a]));
  const ids = [...agendaPorId.keys()];

  const inicioRango = DateTime.fromISO(desde, { zone: TZ }).startOf('day').toISO();
  const finRango    = DateTime.fromISO(hasta, { zone: TZ }).endOf('day').toISO();

  const [tenantRes, servicioRes, horariosRes, turnosRes, suspensionesRes, horarioTenantRes, feriadoRes] = await Promise.all([
    query(
      `SELECT duracion_slot_minutos FROM tenant WHERE id = $1 AND activo = true`,
      [tenantId]
    ),
    servicioId
      ? query(
        `SELECT cantidad_slots FROM servicio WHERE id = $1 AND tenant_id = $2 AND activo = true`,
        [servicioId, tenantId]
      )
      : null,
    query(
      `SELECT barbero_id, dia_semana, hora_inicio, hora_fin
       FROM barbero_horario
       WHERE tenant_id = $1 AND barbero_id = ANY($2::uuid[])
       ORDER BY hora_inicio ASC`,
      [tenantId, ids]
    ),
    query(
      `SELECT barbero_id, inicio, fin
       FROM turno
       WHERE tenant_id = $1
         AND barbero_id = ANY($2::uuid[])
         AND estado = 'reservado'
         AND inicio < $4
         AND fin    > $3`,
      [tenantId, ids, inicioRango, finRango]
    ),
    // Rango efectivo: una suspensión liberada (o terminada antes) solo bloquea
    // hasta liberada_en, y si se liberó antes de empezar no bloquea nada.
    query(
      `SELECT bs.barbero_id, bs.desde, ${finEfectivoSql('bs')} AS hasta, bs.tipo
       FROM barbero_suspension bs
       WHERE bs.tenant_id = $1
         AND bs.barbero_id = ANY($2::uuid[])
         AND ${suspensionSolapaSql('bs', '$3', '$4')}`,
      [tenantId, ids, inicioRango, finRango]
    ),
    query(
      `SELECT dia_semana, to_char(hora_inicio, 'HH24:MI') AS hora_inicio, to_char(hora_fin, 'HH24:MI') AS hora_fin
       FROM tenant_horario_atencion WHERE tenant_id = $1`,
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
  if (servicioRes && servicioRes.rows.length === 0) {
    throw new DisponibilidadError('servicio_no_encontrado', 'Servicio no encontrado o inactivo');
  }

  // Bloques de cada barbero agrupados por día de semana (llegan ya ordenados por hora_inicio).
  for (const r of horariosRes.rows) {
    const { bloquesPorDia } = agendaPorId.get(r.barbero_id);
    if (!bloquesPorDia.has(r.dia_semana)) bloquesPorDia.set(r.dia_semana, []);
    bloquesPorDia.get(r.dia_semana).push(r);
  }
  // Turnos y suspensiones del rango → DateTime de luxon una sola vez.
  for (const t of turnosRes.rows) {
    agendaPorId.get(t.barbero_id).turnos.push({
      inicio: DateTime.fromJSDate(t.inicio, { zone: TZ }),
      fin:    DateTime.fromJSDate(t.fin,    { zone: TZ }),
    });
  }
  for (const s of suspensionesRes.rows) {
    agendaPorId.get(s.barbero_id).suspensiones.push({
      inicio: DateTime.fromJSDate(s.desde, { zone: TZ }),
      fin:    DateTime.fromJSDate(s.hasta, { zone: TZ }),
      tipo:   s.tipo,
    });
  }

  const duracionSlotMin = tenantRes.rows[0].duracion_slot_minutos;
  const cantidadSlots = servicioRes ? servicioRes.rows[0].cantidad_slots : 1;
  return {
    agendas,
    diasAbiertosNegocio: new Set(horarioTenantRes.rows.map(r => r.dia_semana)),
    horarioNegocioPorDia: new Map(horarioTenantRes.rows.map(r =>
      [r.dia_semana, { hora_inicio: r.hora_inicio, hora_fin: r.hora_fin }]
    )),
    feriados: new Set(feriadoRes.rows.map(r => r.fecha)),
    duracionSlotMin,
    duracionServicioMin: duracionSlotMin * cantidadSlots,
  };
};

/**
 * negocioAtiendeElDia
 * Indica si el negocio atiende un día, sin mirar si ya pasó ni a ningún
 * barbero: no es feriado y el negocio abre ese día de la semana.
 *
 * @param {Object} datos - Resultado de cargarDatosAgenda
 * @param {DateTime} fechaArg - Día a evaluar, a las 00:00 en TZ Argentina
 * @returns {boolean} true si el negocio atiende ese día
 */
const negocioAtiendeElDia = (datos, fechaArg) => {
  // Feriado → el negocio cierra el día completo.
  if (datos.feriados.has(fechaArg.toISODate())) return false;
  // dia_semana en convención PostgreSQL/JavaScript: 0=domingo..6=sábado.
  // Luxon devuelve 1=lunes...7=domingo, por eso el módulo 7.
  return datos.diasAbiertosNegocio.has(fechaArg.weekday % 7);
};

/**
 * negocioAbreElDia
 * Indica si un día es reservable a nivel negocio, sin mirar a ningún barbero:
 * no pasó y el negocio atiende ese día (negocioAtiendeElDia).
 *
 * @param {Object} datos - Resultado de cargarDatosAgenda
 * @param {DateTime} fechaArg - Día a evaluar, a las 00:00 en TZ Argentina
 * @param {DateTime} ahora - Momento actual en TZ Argentina
 * @returns {boolean} true si el día es reservable
 */
const negocioAbreElDia = (datos, fechaArg, ahora) => {
  // Fecha pasada → no reservable.
  if (fechaArg.endOf('day') < ahora) return false;
  return negocioAtiendeElDia(datos, fechaArg);
};

/**
 * slotsDelBarberoEnElDia
 * Slots reservables de un barbero en un día en que el negocio abre. Si el
 * barbero no tiene bloques horarios ese día de la semana, devuelve []. Si el
 * día es hoy, descarta lo que empieza antes de ahora + ANTELACION_MINIMA_MINUTOS.
 *
 * @param {Object} params
 * @param {Object} params.datos - Resultado de cargarDatosAgenda
 * @param {Object} params.agenda - Una de `datos.agendas`
 * @param {DateTime} params.fechaArg - Día a evaluar, a las 00:00 en TZ Argentina
 * @param {DateTime} params.ahora - Momento actual en TZ Argentina
 * @param {boolean} [params.soloPrimero=false] - Corta en el primer slot (alcanza con saber si hay lugar)
 * @returns {string[]} array de ISO strings (con offset Argentina)
 */
const slotsDelBarberoEnElDia = ({ datos, agenda, fechaArg, ahora, soloPrimero = false }) => {
  const bloques = agenda.bloquesPorDia.get(fechaArg.weekday % 7);
  if (!bloques || bloques.length === 0) return [];

  const umbralMinimo = ahora.hasSame(fechaArg, 'day')
    ? ahora.plus({ minutes: ANTELACION_MINIMA_MINUTOS })
    : null;

  return computarSlotsDeUnDia({
    fechaArg,
    bloquesHorario: bloques,
    turnos: agenda.turnos,
    suspensiones: agenda.suspensiones,
    duracionSlotMin: datos.duracionSlotMin,
    duracionServicioMin: datos.duracionServicioMin,
    umbralMinimo,
    soloPrimero,
  });
};

/**
 * contarTurnosDelDia
 * Cuenta los turnos reservados que empiezan en un día (TZ Argentina). Usa los
 * turnos que ya trajo cargarDatosAgenda: no hace queries.
 *
 * @param {Array<{inicio:DateTime,fin:DateTime}>} turnos - Turnos reservados de un barbero
 * @param {DateTime} fechaArg - Día a contar, en TZ Argentina
 * @returns {number} cantidad de turnos de ese día
 */
const contarTurnosDelDia = (turnos, fechaArg) =>
  turnos.filter(t => t.inicio.hasSame(fechaArg, 'day')).length;

/**
 * elegirBarbero
 * Regla de asignación de "Cualquier barbero": entre los barberos libres en un
 * horario, gana el que tenga menos turnos reservados ese día; si empatan, el
 * primero por orden alfabético de nombre (sin distinguir mayúsculas ni
 * tildes). Si también empatan en nombre, desempata el id, para que el
 * resultado nunca dependa del orden en que llegan los candidatos.
 * Función pura: no toca la DB.
 *
 * @param {Array<{id:string, nombre:string, turnosDelDia:number}>} candidatos - Barberos libres en el horario
 * @returns {{id:string, nombre:string, turnosDelDia:number}|null} el elegido; null si no hay candidatos
 */
export const elegirBarbero = (candidatos) => {
  if (candidatos.length === 0) return null;
  const comparar = (a, b) =>
    a.turnosDelDia - b.turnosDelDia
    || a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return candidatos.reduce((mejor, c) => (comparar(c, mejor) < 0 ? c : mejor));
};

/**
 * calcularDias
 * Días de un rango con al menos un slot reservable en alguno de los barberos
 * cargados. Con un solo barbero son sus días; con todos, la unión. Hace un
 * set fijo de queries (cargarDatosAgenda) y después recorre los días en memoria.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.servicioId
 * @param {string[]} [params.barberoIds] - Si se omite, todos los barberos activos
 * @param {string} params.desde - 'YYYY-MM-DD' (inclusive)
 * @param {string} params.hasta - 'YYYY-MM-DD' (inclusive)
 * @returns {Promise<string[]>} array de fechas 'YYYY-MM-DD' con ≥1 slot
 */
const calcularDias = async ({ tenantId, servicioId, barberoIds, desde, hasta }) => {
  const { inicioRango, finRango } = parsearRango(desde, hasta);
  const datos = await cargarDatosAgenda({ tenantId, servicioId, barberoIds, desde, hasta });

  const ahora = DateTime.now().setZone(TZ);
  const diasDisponibles = [];

  // Recorrido en memoria, día por día.
  for (let dia = inicioRango; dia <= finRango; dia = dia.plus({ days: 1 })) {
    const fechaArg = dia.startOf('day');
    if (!negocioAbreElDia(datos, fechaArg, ahora)) continue;

    // Alcanza con que un barbero tenga un slot (soloPrimero: no hace falta la lista).
    const hayLugar = datos.agendas.some(agenda =>
      slotsDelBarberoEnElDia({ datos, agenda, fechaArg, ahora, soloPrimero: true }).length > 0
    );
    if (hayLugar) diasDisponibles.push(fechaArg.toISODate());
  }

  return diasDisponibles;
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
  const fechaArg = parsearFecha(fecha);

  // Corto temprano si la fecha consultada ya pasó. Sin este check, fechas
  // pasadas devuelven todos los slots del día como reservables, porque el
  // margen ANTELACION_MINIMA_MINUTOS solo se aplica cuando la fecha es hoy.
  if (fechaArg.endOf('day') < DateTime.now().setZone(TZ)) {
    return [];
  }

  const datos = await cargarDatosAgenda({
    tenantId, servicioId, barberoIds: [barberoId], desde: fecha, hasta: fecha,
  });
  const ahora = DateTime.now().setZone(TZ);
  if (!negocioAbreElDia(datos, fechaArg, ahora)) return [];

  // No hace falta verificar que el barbero exista: si no tiene horarios para
  // ese día (o no existe), su agenda está vacía y la respuesta es [].
  return slotsDelBarberoEnElDia({ datos, agenda: datos.agendas[0], fechaArg, ahora });
};

/**
 * Calcula, para "Cualquier barbero", los horarios libres de un día y a qué
 * barbero se asigna cada uno. Los horarios son la unión de los de todos los
 * barberos activos; el barbero de cada horario sale de `elegirBarbero` (menos
 * turnos reservados ese día; empate → alfabético).
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.servicioId
 * @param {string} params.fecha - 'YYYY-MM-DD'
 * @returns {Promise<{ slots: string[], asignaciones: Object<string, string> }>}
 *   slots: ISO strings ordenados y sin repetidos; asignaciones: ISO del slot → barbero_id
 *   (cada clave es exactamente un string de `slots`)
 */
export const calcularSlotsCualquiera = async ({ tenantId, servicioId, fecha }) => {
  const fechaArg = parsearFecha(fecha);
  const vacio = { slots: [], asignaciones: {} };

  // Mismo corte temprano que calcularSlotsDisponibles.
  if (fechaArg.endOf('day') < DateTime.now().setZone(TZ)) {
    return vacio;
  }

  const datos = await cargarDatosAgenda({ tenantId, servicioId, desde: fecha, hasta: fecha });
  const ahora = DateTime.now().setZone(TZ);
  if (!negocioAbreElDia(datos, fechaArg, ahora)) return vacio;

  // Cada horario → los barberos libres en él, con sus turnos del día para la regla.
  const candidatosPorSlot = new Map();
  for (const agenda of datos.agendas) {
    const slotsBarbero = slotsDelBarberoEnElDia({ datos, agenda, fechaArg, ahora });
    if (slotsBarbero.length === 0) continue;
    const candidato = {
      id: agenda.id,
      nombre: agenda.nombre,
      turnosDelDia: contarTurnosDelDia(agenda.turnos, fechaArg),
    };
    for (const slot of slotsBarbero) {
      if (!candidatosPorSlot.has(slot)) candidatosPorSlot.set(slot, []);
      candidatosPorSlot.get(slot).push(candidato);
    }
  }

  const slots = [...candidatosPorSlot.keys()].sort((a, b) => Date.parse(a) - Date.parse(b));
  const asignaciones = {};
  for (const slot of slots) {
    asignaciones[slot] = elegirBarbero(candidatosPorSlot.get(slot)).id;
  }
  return { slots, asignaciones };
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
export const calcularDiasConDisponibilidad = ({ tenantId, barberoId, servicioId, desde, hasta }) =>
  calcularDias({ tenantId, servicioId, barberoIds: [barberoId], desde, hasta });

/**
 * Calcula, para "Cualquier barbero", qué días de un rango tienen al menos un
 * slot reservable en alguno de los barberos activos (la unión de los días de
 * cada uno). Mismos cortes y mismo set fijo de queries que
 * `calcularDiasConDisponibilidad`.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.servicioId
 * @param {string} params.desde - 'YYYY-MM-DD' (inclusive)
 * @param {string} params.hasta - 'YYYY-MM-DD' (inclusive)
 * @returns {Promise<string[]>} array de fechas 'YYYY-MM-DD' con ≥1 slot
 */
export const calcularDiasCualquiera = ({ tenantId, servicioId, desde, hasta }) =>
  calcularDias({ tenantId, servicioId, desde, hasta });

// ─── Grilla de la Agenda (app del barbero) ──────────────────────────────────
// La dibuja la Agenda y valida la creación de un descanso.
// Ver decisiones_descansos.md.

/**
 * estadoDelSlot
 * Estado de un slot de la grilla según lo que se le superpone. Si cae en más de
 * uno, gana turno, después descanso, después suspensión.
 *
 * @param {DateTime} inicio - Inicio del slot
 * @param {DateTime} fin - Fin del slot
 * @param {Object} agenda - Una de `datos.agendas` (turnos reservados y suspensiones
 *   con su rango efectivo, en DateTime)
 * @returns {'libre'|'turno'|'descanso'|'suspension'}
 */
const estadoDelSlot = (inicio, fin, agenda) => {
  if (agenda.turnos.some(t => solapa(inicio, fin, t.inicio, t.fin))) return 'turno';
  const suspensiones = agenda.suspensiones.filter(s => solapa(inicio, fin, s.inicio, s.fin));
  if (suspensiones.some(s => s.tipo === 'descanso')) return 'descanso';
  if (suspensiones.length > 0) return 'suspension';
  return 'libre';
};

/**
 * calcularGrillaDelDia
 * Todos los slots de los bloques horarios de un barbero en un día, cada uno con
 * su estado. Usa el mismo anclaje que el turnero (computarSlotsDeUnDia): cada
 * bloque arranca en su hora_inicio y avanza de a duracion_slot_minutos, y un
 * slot existe si entra completo en el bloque. Un slot `libre` es uno que el
 * turnero ofrecería con un servicio de un slot, sin contar la antelación mínima.
 *
 * No decide pasado o futuro (lo resuelven el front y quien valida) ni verifica
 * que el barbero exista: sin bloques ese día, la grilla es vacía. Día cerrado o
 * feriado: grilla vacía y horarioLocal null.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.barberoId
 * @param {string} params.fecha - 'YYYY-MM-DD', ya validada
 * @returns {Promise<{ grilla: Array<{ inicio: DateTime, fin: DateTime, estado: string }>,
 *   duracionSlotMin: number, horarioLocal: { hora_inicio: string, hora_fin: string } | null }>}
 *   grilla ordenada por inicio; horarioLocal en 'HH:MM'
 * @throws {DisponibilidadError} 'fecha_invalida' | 'tenant_no_encontrado'
 */
export const calcularGrillaDelDia = async ({ tenantId, barberoId, fecha }) => {
  const fechaArg = parsearFecha(fecha);
  const datos = await cargarDatosAgenda({ tenantId, barberoIds: [barberoId], desde: fecha, hasta: fecha });
  const { duracionSlotMin } = datos;

  if (!negocioAtiendeElDia(datos, fechaArg)) {
    return { grilla: [], duracionSlotMin, horarioLocal: null };
  }

  const diaSemana = fechaArg.weekday % 7;
  const agenda = datos.agendas[0];

  // Esqueleto: todos los inicios de slot, sin turnos ni suspensiones que descartar.
  const inicios = computarSlotsDeUnDia({
    fechaArg,
    bloquesHorario: agenda.bloquesPorDia.get(diaSemana) ?? [],
    turnos: [],
    suspensiones: [],
    duracionSlotMin,
    duracionServicioMin: duracionSlotMin,
    umbralMinimo: null,
  });

  const grilla = inicios.map((iso) => {
    const inicio = DateTime.fromISO(iso, { zone: TZ });
    const fin = inicio.plus({ minutes: duracionSlotMin });
    return { inicio, fin, estado: estadoDelSlot(inicio, fin, agenda) };
  });

  return { grilla, duracionSlotMin, horarioLocal: datos.horarioNegocioPorDia.get(diaSemana) };
};
