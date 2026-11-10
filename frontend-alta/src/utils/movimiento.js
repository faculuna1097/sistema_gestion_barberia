// /frontend-alta/src/utils/movimiento.js
// Parámetros de movimiento que necesita JS (los de CSS viven en index.css,
// bloque "Movimiento del formulario de alta", clases al-). Sin estado, sin
// dependencias. Copia idéntica de frontend-turnero/src/utils/movimiento.js: no
// tiene colores, así que el acento de Luz solo cambia en index.css.

/**
 * PAUSA_ELECCION_MS
 * Cuánto se ve marcada la opción tocada (ej. el largo del turno)
 * antes de avanzar de pantalla: lo justo para que el cliente vea que se
 * registró su elección.
 */
export const PAUSA_ELECCION_MS = 150;

/**
 * prefiereMenosMovimiento
 * True si el sistema tiene activado "reducir movimiento"
 * (`prefers-reduced-motion: reduce`). Se consulta en el momento, así respeta
 * un cambio de ajuste sin recargar.
 * @returns {boolean}
 */
export function prefiereMenosMovimiento() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * pausaEleccionMs
 * Pausa a aplicar después de una elección: PAUSA_ELECCION_MS, o 0 si el
 * cliente pidió reducir el movimiento.
 * @returns {number} Milisegundos
 */
export function pausaEleccionMs() {
  return prefiereMenosMovimiento() ? 0 : PAUSA_ELECCION_MS;
}
