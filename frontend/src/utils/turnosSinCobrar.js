// /frontend/src/utils/turnosSinCobrar.js
// Cálculos del aviso de turnos sin cobrar (F3 de plan_mejoras_operativas.md),
// que comparten el iPad (MainScreen) y el Inicio del panel. Son funciones puras:
// reciben el instante o el día de hoy por parámetro, así se pueden probar con
// valores armados a mano.

import { fechaDeInstante, formatFechaCorta, formatHora, getFechaHoy } from './fecha.js';

/**
 * MINUTOS_ALERTA_ANTES_DEL_CIERRE
 * Cuántos minutos antes del cierre del local el aviso pasa a modo alerta (color
 * de alerta, avisa que a la noche se cierran solos y ya no se puede ocultar).
 * @type {number}
 */
export const MINUTOS_ALERTA_ANTES_DEL_CIERRE = 20;

/**
 * estaEnModoAlerta
 * Si el aviso tiene que estar en modo alerta: desde MINUTOS_ALERTA_ANTES_DEL_CIERRE
 * antes del cierre de hoy en adelante (también después del cierre, hasta que el
 * cron de la noche cierra los turnos).
 * @param {string|null} cierreHoy - Instante ISO del cierre de hoy (`cierre_hoy`
 *   del endpoint), o null si hoy el local no abre o es feriado.
 * @param {number} ahoraMs - Instante actual en milisegundos (Date.now()).
 * @returns {boolean} false si no hay cierre hoy o el instante no se puede leer.
 */
export function estaEnModoAlerta(cierreHoy, ahoraMs) {
  if (!cierreHoy) return false;
  const cierreMs = Date.parse(cierreHoy);
  if (Number.isNaN(cierreMs)) return false;
  return ahoraMs >= cierreMs - MINUTOS_ALERTA_ANTES_DEL_CIERRE * 60_000;
}

/**
 * textoCantidadSinCobrar
 * El texto del aviso con la cantidad, en singular o plural.
 * @param {number} cantidad - Cantidad de turnos sin cobrar.
 * @returns {string} Ej.: "1 turno sin cobrar", "3 turnos sin cobrar".
 */
export function textoCantidadSinCobrar(cantidad) {
  return `${cantidad} ${cantidad === 1 ? 'turno' : 'turnos'} sin cobrar`;
}

/**
 * agruparPorBarbero
 * Agrupa los turnos por barbero, para el detalle del aviso (una columna por
 * barbero). Barberos por nombre; los turnos de cada uno, por hora de inicio (así
 * un turno de otro día, que es anterior, queda arriba).
 * @param {Array<{ barbero_id: string, barbero_nombre: string, inicio: string }>} turnos
 *   Turnos del endpoint.
 * @param {string} [hoy] - Día de hoy 'YYYY-MM-DD'; por defecto, el de Argentina.
 * @returns {Array<{ barbero_id: string, barbero_nombre: string,
 *   turnos: Array<Object & { hora: string, dia: string|null }> }>} Un grupo por
 *   barbero. Cada turno suma `hora` ('HH:MM' de inicio, hora argentina) y `dia`:
 *   null si es de hoy, o la fecha corta ("Martes 17/11") si es de otro día.
 */
export function agruparPorBarbero(turnos, hoy = getFechaHoy()) {
  const porBarbero = new Map();
  for (const turno of turnos) {
    if (!porBarbero.has(turno.barbero_id)) {
      porBarbero.set(turno.barbero_id, {
        barbero_id: turno.barbero_id,
        barbero_nombre: turno.barbero_nombre,
        turnos: [],
      });
    }
    const fecha = fechaDeInstante(turno.inicio);
    porBarbero.get(turno.barbero_id).turnos.push({
      ...turno,
      hora: formatHora(turno.inicio),
      dia: fecha === hoy ? null : formatFechaCorta(fecha),
    });
  }
  return [...porBarbero.values()]
    .sort((a, b) => a.barbero_nombre.localeCompare(b.barbero_nombre, 'es'))
    .map((grupo) => ({
      ...grupo,
      turnos: grupo.turnos.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio)),
    }));
}
