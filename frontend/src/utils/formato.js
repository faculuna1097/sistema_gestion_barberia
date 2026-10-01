// /frontend/src/utils/formato.js
// Helpers de formateo (texto, dinero). Sin estado, sin dependencias.

/**
 * fmtPesos
 * Formatea un valor numérico como pesos argentinos sin decimales. Un negativo
 * lleva el signo adelante del "$", como el formato de moneda de es-AR
 * (`Intl.NumberFormat` con `style: 'currency'`).
 * @param {number|string} n - Monto en pesos
 * @returns {string} Ej: "$ 8.000", "-$ 130.000"
 */
export function fmtPesos(n) {
  // El signo se decide sobre el valor ya redondeado: así un -0,3 sale "$ 0" y
  // no "-$ 0".
  const redondeado = Math.round(Number(n));
  const formateado = Math.abs(redondeado).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return redondeado < 0 ? `-$ ${formateado}` : `$ ${formateado}`;
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

// Formas de pago del sistema como opciones { value, label }, para selectores
// y grupos de botones de los formularios.
export const OPCIONES_FORMA_PAGO = [
  { value: 'efectivo',     label: 'Efectivo' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
];
