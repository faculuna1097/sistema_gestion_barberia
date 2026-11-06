// /frontend/src/utils/cargarChunk.js
// Carga de módulos diferidos (import dinámico) con manejo de error uniforme.
//
// Por qué existe: los handlers de "Exportar a Excel" hacen `import('xlsx')`
// dentro de un onClick. Esa promesa rechaza FUERA del ciclo de render de React
// (red caída a mitad de sesión, o —lo más común— un hash de archivo viejo en el
// HTML cacheado tras un redeploy), así que un error boundary de render NO la
// agarra: sin esto, la promesa queda como unhandled rejection y el botón "no
// hace nada" en silencio. Este helper centraliza el log y el aviso al usuario
// (un toast flotante, sistema_de_disenio.md §4.8) para los 6 call-sites.

import { toast } from './toast.js';

/**
 * cargarChunk
 * Ejecuta un import dinámico y, si falla la descarga del chunk, loguea el error
 * y le avisa al usuario con un toast de error.
 *
 * @param {() => Promise<any>} importFn - Función que dispara el import, p.ej.
 *   `() => import('xlsx')`. Se recibe como función (no la promesa ya iniciada)
 *   para que la descarga recién arranque al invocar cargarChunk.
 * @param {string} etiqueta - Nombre del módulo, solo para el log.
 * @returns {Promise<any|null>} El módulo cargado (idéntico al valor que devolvería
 *   el import), o null si la carga falló (el aviso ya se mostró).
 */
export async function cargarChunk(importFn, etiqueta) {
  try {
    return await importFn();
  } catch (err) {
    console.error(`[cargarChunk] Falló la carga de "${etiqueta}":`, err.message);
    toast.error('No se pudo cargar el exportador. Revisá tu conexión o, si acabás de actualizar, recargá la página.');
    return null;
  }
}
