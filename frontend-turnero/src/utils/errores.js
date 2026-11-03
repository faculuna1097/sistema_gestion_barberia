// /frontend-turnero/src/utils/errores.js
// Texto que ve el cliente cuando falla un pedido a la API. Lo comparten la
// reserva ("Confirmá tu turno") y la gestión del turno.

/**
 * TEXTO_SIN_CONEXION
 * Texto cuando el pedido no llega al backend (sin conexión, timeout): el
 * mensaje del navegador ("Failed to fetch") no le dice nada al cliente.
 */
export const TEXTO_SIN_CONEXION = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';

/**
 * TEXTO_DEMASIADOS_INTENTOS
 * Texto de un 429 (el backend limita las reservas por IP: 3 por minuto y 10
 * por hora). Es del turnero y no depende del cuerpo de la respuesta: si el 429
 * llega sin JSON (ej. de un proxy), igual se dice qué hacer.
 */
export const TEXTO_DEMASIADOS_INTENTOS = 'Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.';

/**
 * mensajeDeError
 * Elige el texto de un error de la API para mostrarlo: el del backend si el
 * pedido llegó (el error trae `status`, ver services/api.js), o el de sin
 * conexión si no llegó.
 * @param {Error} err - Error lanzado por una función de services/api.js
 * @returns {string}
 */
export function mensajeDeError(err) {
  return err.status ? err.message : TEXTO_SIN_CONEXION;
}
