// /frontend/src/hooks/usePantallaAngosta.js
// Si la ventana del panel es angosta: el iPad en vertical (744 a 834 px) o una
// ventana partida en Split View. Ahí el sidebar abierto (220 px) deja muy poco
// lugar para las tablas, así que el panel se acomoda (sistema_de_disenio §4.6).
//
// Mira el ancho de la ventana y no la orientación: un iPad en horizontal con
// Split View también queda angosto.

import { useSyncExternalStore } from 'react';

/**
 * ANCHO_ANGOSTO
 * Desde este ancho (en px) la ventana deja de ser angosta. 1024 es el iPad en
 * horizontal, que se ve igual que el escritorio.
 * @type {number}
 */
export const ANCHO_ANGOSTO = 1024;

const CONSULTA = `(max-width: ${ANCHO_ANGOSTO - 1}px)`;

/**
 * suscribir
 * Avisa a React cuando la ventana cruza el corte (rotar el iPad, cambiar el
 * tamaño de la ventana).
 * @param {() => void} avisar - Callback de useSyncExternalStore
 * @returns {() => void} Función que cancela la suscripción
 */
function suscribir(avisar) {
  const consulta = window.matchMedia(CONSULTA);
  consulta.addEventListener('change', avisar);
  return () => consulta.removeEventListener('change', avisar);
}

/**
 * esAngosta
 * Lee el estado actual de la media query.
 * @returns {boolean}
 */
function esAngosta() {
  return window.matchMedia(CONSULTA).matches;
}

/**
 * usePantallaAngosta
 * true mientras la ventana mide menos de ANCHO_ANGOSTO; el componente se vuelve
 * a dibujar cuando cruza el corte.
 * @returns {boolean}
 */
export function usePantallaAngosta() {
  return useSyncExternalStore(suscribir, esAngosta);
}
