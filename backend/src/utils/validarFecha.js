// /backend/src/utils/validarFecha.js
// Validadores centrales de fechas de calendario ('YYYY-MM-DD') que llegan por
// query string o body. Todo el cómputo es en hora argentina (TZ) con luxon.

import { DateTime } from 'luxon';
import { TZ } from './constantes.js';

const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

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
 * esFechaFutura
 * Indica si una fecha es posterior a hoy en hora argentina.
 * @param {string} fechaISO - Fecha 'YYYY-MM-DD' ya validada con esFechaISO.
 * @returns {boolean} true si es un día posterior a hoy.
 */
export function esFechaFutura(fechaISO) {
  // Con el formato fijo 'YYYY-MM-DD', el orden alfabético es el cronológico.
  return fechaISO > hoyISO();
}
