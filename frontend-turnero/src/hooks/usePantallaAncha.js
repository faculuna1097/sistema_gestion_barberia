// /frontend-turnero/src/hooks/usePantallaAncha.js
// Si la ventana es "ancha" (theme.anchoPantallaAncha): ahí el turnero pone el
// panel del local a la izquierda y la columna de cada pantalla a la derecha
// (MarcoLocal). Mira el ancho, no la orientación: el iPad vertical (768 a
// 834 px) también es ancho, y un celular acostado (~812) también.
//
// Hook y no CSS (sistema_de_disenio.md §4.6): el turnero no se pre-renderiza,
// los estilos son inline (§4.1) y lo que cambia es qué se dibuja (el hero en la
// columna o en el panel), no solo cómo se ve.

import { useEffect, useState } from 'react';
import { theme } from '../theme/tokens.js';

/**
 * CONSULTA_ANCHA
 * Media query de la pantalla ancha.
 */
const CONSULTA_ANCHA = `(min-width: ${theme.anchoPantallaAncha}px)`;

/**
 * esPantallaAncha
 * Lee ahora si la ventana es ancha.
 * @returns {boolean}
 */
function esPantallaAncha() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(CONSULTA_ANCHA).matches;
}

/**
 * usePantallaAncha
 * True con la ventana de al menos `theme.anchoPantallaAncha` px. Se lee al
 * montar, antes del primer pintado (sin un salto de layout), y se actualiza al
 * cruzar el corte (rotar el celular, achicar la ventana).
 * @returns {boolean}
 */
export function usePantallaAncha() {
  const [ancha, setAncha] = useState(esPantallaAncha);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const consulta = window.matchMedia(CONSULTA_ANCHA);
    const actualizar = () => setAncha(consulta.matches);
    consulta.addEventListener('change', actualizar);
    // Por si cambió entre el primer render y el efecto.
    actualizar();
    return () => consulta.removeEventListener('change', actualizar);
  }, []);

  return ancha;
}
