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
 * fmtPorcentaje
 * Formatea un porcentaje con hasta un decimal, en formato es-AR.
 * @param {number} n - Porcentaje (ej. 4.5 = 4,5 %)
 * @returns {string} Ej: "4,5 %", "12 %"
 */
export function fmtPorcentaje(n) {
  return `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;
}

// Formas de pago del sistema como opciones { value, label }: la única fuente de
// sus nombres. La usan los selectores y grupos de botones de los formularios,
// formatPago (Excel) y BadgeFormaPago. Las columnas forma_pago de la DB solo
// aceptan estos dos valores (CHECK). Sus colores viven en
// components/ui/tonosFormaPago.js.
export const OPCIONES_FORMA_PAGO = [
  { value: 'efectivo',     label: 'Efectivo' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
];

/**
 * formatPago
 * Convierte el código de forma de pago al label legible. Un código desconocido
 * se devuelve tal cual, para que un dato raro se vea y no pase por otro.
 * @param {string} forma - 'efectivo' | 'mercado_pago'
 * @returns {string} Ej: "Efectivo", "Mercado Pago"; "—" si viene vacío.
 */
export function formatPago(forma) {
  return OPCIONES_FORMA_PAGO.find((o) => o.value === forma)?.label ?? (forma || '—');
}
