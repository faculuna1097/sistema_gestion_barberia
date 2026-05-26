// /frontend/src/utils/formato.js
// Helpers de formateo (texto, dinero). Sin estado, sin dependencias.
//
// Convención: este archivo es el sucesor consolidado de `utils/formatos.js`
// (plural, legacy). Mientras la migración de Fase 4 esté en curso, ambos
// conviven y el viejo se elimina en Fase 6 (ver docs/plan_redisenio_frontend_gestion.md §2.1).

/**
 * formatARS
 * Formatea un valor numérico como pesos argentinos sin decimales.
 * @param {number|string} valor
 * @param {object} [options]
 * @param {boolean} [options.prefijo=true] — si false, devuelve solo el número formateado.
 * @returns {string} Ej: "$ 8.000"  (o "8.000" sin prefijo)
 */
export function formatARS(valor, { prefijo = true } = {}) {
  const n = Number(valor).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return prefijo ? `$ ${n}` : n;
}

/**
 * fmtPesos
 * Alias delgado equivalente a `formatARS(n)`. Existe para compatibilidad
 * con el nombre usado en frontend-turnero.
 * Pendiente Fase 6: unificar un único nombre en todos los fronts.
 * @param {number|string} n - Monto en pesos
 * @returns {string} Ej: "$ 8.000"
 */
export function fmtPesos(n) {
  return formatARS(n);
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
