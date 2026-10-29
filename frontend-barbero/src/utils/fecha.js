// /frontend-barbero/src/utils/fecha.js
// Helpers de fecha/hora. Todo en zona local del navegador.
// Convención del proyecto: el backend manda ISO y YYYY-MM-DD; el front muestra siempre en es-AR.

/**
 * fechaLocalISO
 * Devuelve el YYYY-MM-DD de un Date según la zona local del navegador.
 * No usar `toISOString().slice(0, 10)`: eso da la fecha UTC, que en Argentina
 * (UTC-3) ya es "mañana" a partir de las 21:00.
 * @param {Date} date - Fecha/instante a convertir
 * @returns {string} Ej: '2026-05-19'
 */
export function fechaLocalISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * fechaDeISO
 * Devuelve el YYYY-MM-DD local de un instante ISO (con offset o con Z).
 * Red defensiva: no depende de que el backend mande el offset local, a
 * diferencia de recortar el string con `slice(0, 10)`.
 * @param {string} iso - ISO timestamp (ej. '2026-10-07T00:30:00.000Z')
 * @returns {string} Ej: '2026-10-06' (en Argentina)
 */
export function fechaDeISO(iso) {
  return fechaLocalISO(new Date(iso));
}

/**
 * fechaHoyISO
 * Devuelve el YYYY-MM-DD de hoy según la zona local del navegador.
 * @returns {string} Ej: '2026-10-20'
 */
export function fechaHoyISO() {
  return fechaLocalISO(new Date());
}

/**
 * sumarDias
 * Suma (o resta) días a una fecha de calendario. Parte del mediodía para que un
 * cambio de horario no corra el día.
 * @param {string} fecha - 'YYYY-MM-DD'
 * @param {number} dias - negativo para restar
 * @returns {string} 'YYYY-MM-DD'
 */
export function sumarDias(fecha, dias) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return fechaLocalISO(d);
}

/**
 * fmtFechaCorta
 * Formato corto de fecha YYYY-MM-DD.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {string} Ej: "lun 19/05"
 */
export function fmtFechaCorta(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dia = date.toLocaleDateString('es-AR', { weekday: 'short' });
  return `${dia.replace('.', '')} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/**
 * fmtFechaLarga
 * Formato largo de fecha YYYY-MM-DD con día de semana y mes completo.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {string} Ej: "lunes, 19 de mayo"
 */
export function fmtFechaLarga(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' });
}

/**
 * fmtHora
 * Convierte un ISO timestamp a HH:mm 24hs.
 * @param {string} iso - ISO timestamp
 * @returns {string} Ej: "15:30"
 */
export function fmtHora(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * fmtFechaHora
 * Combina fecha larga y hora desde un ISO.
 * @param {string} iso - ISO timestamp
 * @returns {string} Ej: "lunes, 19 de mayo · 15:30 hs"
 */
export function fmtFechaHora(iso) {
  return `${fmtFechaLarga(fechaDeISO(iso))} · ${fmtHora(iso)} hs`;
}

/**
 * diaSemana
 * Devuelve la letra del día de semana (narrow) para un YYYY-MM-DD.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {string} Ej: "L"
 */
export function diaSemana(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'narrow' });
}

/**
 * diaNumero
 * Devuelve el día del mes como número (sin padding).
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {number} Ej: 19
 */
export function diaNumero(fechaStr) {
  return Number(fechaStr.split('-')[2]);
}

/**
 * nombreMes
 * Devuelve el nombre corto del mes para un YYYY-MM-DD.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {string} Ej: "may"
 */
export function nombreMes(fechaStr) {
  const [y, m] = fechaStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
}

/**
 * esHoy
 * True si fechaStr corresponde al día de hoy local.
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function esHoy(fechaStr) {
  return fechaStr === fechaLocalISO(new Date());
}
