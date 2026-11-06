// /backend/src/utils/validarFecha.js
// Validadores centrales de fechas de calendario ('YYYY-MM-DD'), de instantes (fecha
// y hora) y de horas del día ('HH:MM') que llegan por query string o body. Todo el
// cómputo es en hora argentina (TZ) con luxon.

import { DateTime } from 'luxon';
import { TZ } from './constantes.js';

const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
// Prefijo obligatorio de un instante: fecha + 'T' + hora y minutos. Lo que sigue
// (segundos, fracción, 'Z' u offset) lo valida luxon.
const REGEX_INSTANTE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
// Hora del día con dos dígitos: 'HH:MM' o 'HH:MM:SS'. Hasta 23:59:59: Postgres también
// acepta '24:00', pero un <input type="time"> no lo puede mandar y no hay filas así.
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * hoyISO
 * Fecha de hoy en hora argentina.
 * @returns {string} Fecha en formato 'YYYY-MM-DD'.
 */
export function hoyISO() {
  return DateTime.now().setZone(TZ).toISODate();
}

/**
 * esFechaISO
 * Valida que un valor sea una fecha de calendario real en formato 'YYYY-MM-DD'.
 * El regex solo no alcanza: '2026-02-31' cumple el formato pero no existe.
 * El año 0000 se rechaza: luxon lo acepta, pero Postgres no tiene año cero y
 * un `$n::date` con ese valor rompería la query (500 en vez de 400).
 * @param {*} valor - Valor recibido de la query o del body.
 * @returns {boolean} true si es string 'YYYY-MM-DD' y la fecha existe.
 */
export function esFechaISO(valor) {
  if (typeof valor !== 'string' || !REGEX_FECHA_ISO.test(valor)) return false;
  const fecha = DateTime.fromISO(valor, { zone: TZ });
  return fecha.isValid && fecha.year >= 1;
}

/**
 * esHoraValida
 * Valida que un valor sea una hora real del día. Sin esto, un '09:99' recién falla al
 * llegar a Postgres. Comparar los strings exige que los dos tengan el mismo formato:
 * quien los compare, antes los recorta a 'HH:MM'.
 * @param {*} valor - Valor recibido del body.
 * @returns {boolean} true si es string 'HH:MM' o 'HH:MM:SS' y la hora existe.
 */
export function esHoraValida(valor) {
  return typeof valor === 'string' && REGEX_HORA.test(valor);
}

/**
 * parsearInstante
 * Convierte un instante (fecha y hora) que llega del cliente en un DateTime en
 * hora argentina. Sin zona ('2026-10-20T10:00', lo que da un
 * <input type="datetime-local">) se interpreta en hora argentina, no en la zona
 * de la sesión de la DB (UTC). Con 'Z' u offset ('...-03:00') se respeta y se
 * convierte a TZ.
 * Exige fecha y hora: luxon también acepta '10:00' (hoy a esa hora) o una fecha
 * sola (medianoche), y ninguno de los dos es un instante válido del cliente.
 * Mismo criterio que esFechaISO con el año 0000.
 * @param {*} valor - Valor recibido de la query o del body.
 * @returns {DateTime|null} El instante en TZ, o null si no es válido.
 */
export function parsearInstante(valor) {
  if (typeof valor !== 'string' || !REGEX_INSTANTE_ISO.test(valor)) return null;
  const instante = DateTime.fromISO(valor, { zone: TZ });
  return instante.isValid && instante.year >= 1 ? instante : null;
}

/**
 * esFechaFutura
 * Indica si una fecha es posterior a hoy en hora argentina.
 * @param {string} fechaISO - Fecha 'YYYY-MM-DD' ya validada con esFechaISO.
 * @returns {boolean} true si es un día posterior a hoy.
 */
export function esFechaFutura(fechaISO) {
  // Con el formato fijo 'YYYY-MM-DD', el orden alfabético es el cronológico.
  return fechaISO > hoyISO();
}
