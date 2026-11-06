// /frontend-barbero/src/hooks/useHover.js
// Hover de un elemento, solo en dispositivos con mouse. En una pantalla táctil
// iOS dispara mouseenter al tocar y el hover queda "pegado" hasta tocar otra
// cosa (sistema_de_disenio.md §4.2 y §9 #19): ahí el hover no se prende nunca.

import { useState } from 'react';

/**
 * PUEDE_HOVER
 * true si el dispositivo tiene hover de verdad (mouse o trackpad), según la
 * media query `(hover: hover)`. Se evalúa una sola vez, al cargar el módulo.
 * @type {boolean}
 */
export const PUEDE_HOVER = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(hover: hover)').matches;

// Sin mouse: los mismos eventos vacíos en todos los renders.
const SIN_EVENTOS = {};

/**
 * useHover
 * Estado de hover de un elemento y los eventos que lo prenden y apagan, para
 * esparcir en el elemento: `<button {...eventosHover}>`. Sin mouse
 * (PUEDE_HOVER false) el hover queda siempre en false y los eventos vienen
 * vacíos.
 * @returns {[boolean, { onMouseEnter?: () => void, onMouseLeave?: () => void }]}
 *   [hover, eventosHover]
 */
export function useHover() {
  const [hover, setHover] = useState(false);
  const eventosHover = PUEDE_HOVER
    ? { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) }
    : SIN_EVENTOS;
  return [hover, eventosHover];
}
