// /frontend-barbero/src/utils/fecha.js
// Helpers de fecha/hora. Todo en zona local del navegador.
// Convención del proyecto: el backend manda ISO y YYYY-MM-DD; el front muestra siempre en es-AR.

/**
 * generarProximosDias
 * Array de strings YYYY-MM-DD desde hoy (inclusive) por N días.
 * @param {number} cantidad - Cantidad de días a generar
 * @returns {Array<string>} Ej: ['2026-05-19', '2026-05-20', ...]
 */
export function generarProximosDias(cantidad) {
  const dias = [];
  const hoy = new Date();
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
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
  const fecha = iso.slice(0, 10);
  return `${fmtFechaLarga(fecha)} · ${fmtHora(iso)} hs`;
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
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return fechaStr === hoyStr;
}

/**
 * esDomingo
 * True si la fecha cae en domingo (asumiendo barbería cerrada los domingos).
 * @param {string} fechaStr - 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function esDomingo(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 0;
}
