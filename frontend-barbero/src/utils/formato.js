// /frontend-barbero/src/utils/formato.js
// Helpers de formateo (texto, dinero). Sin estado, sin dependencias.

/**
 * fmtPesos
 * Formatea un número como pesos argentinos sin decimales.
 * @param {number} n - Monto en pesos
 * @returns {string} Ej: "$8.000"
 */
export function fmtPesos(n) {
  return '$' + Number(n).toLocaleString('es-AR');
}
