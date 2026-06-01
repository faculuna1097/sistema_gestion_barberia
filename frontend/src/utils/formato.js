// /frontend/src/utils/formato.js
// Helpers de formateo (texto, dinero). Sin estado, sin dependencias.

/**
 * fmtPesos
 * Formatea un valor numérico como pesos argentinos sin decimales.
 * @param {number|string} n - Monto en pesos
 * @returns {string} Ej: "$ 8.000"
 */
export function fmtPesos(n) {
  const formateado = Number(n).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `$ ${formateado}`;
}

/**
 * formatPago
 * Convierte el código de forma de pago al label legible.
 * @param {string} forma — 'efectivo' o cualquier otro valor (default: 'Mercado Pago').
 * @returns {string}
 */
export function formatPago(forma) {
  return forma === 'efectivo' ? 'Efectivo' : 'Mercado Pago';
}
