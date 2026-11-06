// /frontend-barbero/src/utils/formato.js
// Helpers de formateo (texto, dinero). Sin estado, sin dependencias.

/**
 * fmtPesos
 * Formatea un valor numérico como pesos argentinos sin decimales. Un negativo
 * lleva el signo adelante del "$", como el formato de moneda de es-AR
 * (`Intl.NumberFormat` con `style: 'currency'`). Copia del `fmtPesos` del panel
 * (`frontend/src/utils/formato.js`): los cuatro fronts muestran la plata igual.
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
 * capitalizar
 * Pone en mayúscula solo la primera letra del texto. Reemplaza a
 * `textTransform: 'capitalize'`, que la pone en cada palabra ("20 De Octubre").
 * @param {string} texto
 * @returns {string} Ej: "martes, 20 de octubre" → "Martes, 20 de octubre"
 */
export function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}
