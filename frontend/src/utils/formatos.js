// /frontend/src/utils/formatos.js

/**
 * Formatea un valor numérico como pesos argentinos sin decimales.
 * @param {number|string} valor
 * @param {object} [options]
 * @param {boolean} [options.prefijo=true] — si false, devuelve solo el número formateado.
 * @returns {string}
 */
export function formatARS(valor, { prefijo = true } = {}) {
  const n = Number(valor).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return prefijo ? `$ ${n}` : n;
}

/**
 * Convierte el código de forma de pago al label legible.
 * @param {string} forma — 'efectivo' o cualquier otro valor (default: 'Mercado Pago').
 * @returns {string}
 */
export function formatPago(forma) {
  return forma === 'efectivo' ? 'Efectivo' : 'Mercado Pago';
}
