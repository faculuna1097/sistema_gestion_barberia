// /frontend-turnero/src/utils/formato.js
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
 * Pone en mayúscula la primera letra del texto y deja el resto igual.
 * @param {string} texto
 * @returns {string} Ej: "octubre" → "Octubre"
 */
export function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * textoBarbero
 * Quién atiende el turno, dicho para el cliente. Lo usan el resumen del turno
 * (ResumenTurno) y el éxito de la reserva (TurnoConfirmado).
 * @param {Object} barbero - { id, nombre }; `nombre` es null si "Cualquiera"
 *   asignó un barbero que no está en la lista de App
 * @param {boolean} asignado - true si lo asignó "Cualquiera"
 * @returns {string} "Te atiende Juan" (asignado), "Con Juan" (elegido a mano)
 *   o "Te asignamos un barbero" (sin nombre)
 */
export function textoBarbero(barbero, asignado) {
  if (!barbero.nombre) return 'Te asignamos un barbero';
  return asignado ? `Te atiende ${barbero.nombre}` : `Con ${barbero.nombre}`;
}
