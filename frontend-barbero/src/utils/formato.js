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

/**
 * capitalizar
 * Pone en mayúscula solo la primera letra del texto. Reemplaza a
 * `textTransform: 'capitalize'`, que la pone en cada palabra ("20 De Octubre").
 * @param {string} texto
 * @returns {string} Ej: "martes, 20 de octubre" → "Martes, 20 de octubre"
 */
export function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}
