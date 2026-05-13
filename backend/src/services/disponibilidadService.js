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
  console.log('[disponibilidadService] calcularSlotsDisponibles — request recibido',
    '| tenant:', tenantId, '| barbero:', barberoId, '| servicio:', servicioId, '| fecha:', fecha);

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
    console.log('[disponibilidadService] calcularSlotsDisponibles — fecha pasada, devuelvo array vacío');
    return [];
  }

  // dia_semana en convención PostgreSQL/JavaScript: 0=domingo, 1=lunes, ..., 6=sábado.
  // Luxon devuelve 1=lunes...7=domingo, por eso el módulo 7.
  const diaSemana = fechaArg.weekday % 7;

  // 5 queries en paralelo. Todas filtran por tenant_id para impedir
  // cruce de datos entre tenants.
  const [tenantRes, servicioRes, horariosRes, turnosRes, suspensionesRes] = await Promise.all([
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
  ]);

  if (tenantRes.rows.length === 0) {
    throw new DisponibilidadError('tenant_no_encontrado', 'Tenant no encontrado');
  }
  if (servicioRes.rows.length === 0) {
    throw new DisponibilidadError('servicio_no_encontrado', 'Servicio no encontrado o inactivo');
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

  // Helper: ¿el rango [a,b) solapa con [c,d)?
  const solapa = (aIni, aFin, bIni, bFin) => aIni < bFin && bIni < aFin;

  const slotsDisponibles = [];

  for (const bloque of horariosRes.rows) {
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
      const chocaTurno = turnos.some(t => solapa(slotInicio, slotFin, t.inicio, t.fin));
      if (chocaTurno) {
        slotInicio = slotInicio.plus({ minutes: duracionSlotMin });
        continue;
      }

      // Solapa con una suspensión.
      const chocaSusp = suspensiones.some(s => solapa(slotInicio, slotFin, s.inicio, s.fin));
      if (chocaSusp) {
        slotInicio = slotInicio.plus({ minutes: duracionSlotMin });
        continue;
      }

      slotsDisponibles.push(slotInicio.toISO());
      slotInicio = slotInicio.plus({ minutes: duracionSlotMin });
    }
  }

  console.log('[disponibilidadService] calcularSlotsDisponibles — completado |',
    slotsDisponibles.length, 'slots');
  return slotsDisponibles;
};
