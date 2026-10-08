// /frontend-turnero/src/utils/rutas.js
// Rutas del turnero. Una sola fuente para no escribir "/turnos/" a mano.
// El turnero se sirve bajo el `base` de Vite (vite.config.js → '/turnos/'):
// en producción, `/` es el panel de gestión, no el turnero.

/**
 * RUTA_TURNERO
 * Ruta de inicio del turnero, con barra final (ej. '/turnos/').
 * Sale del `base` de Vite, así que sigue andando si el base cambia.
 */
export const RUTA_TURNERO = import.meta.env.BASE_URL;

// Prefijo de la página de gestión de un turno (link del mail).
const PREFIJO_GESTION = `${RUTA_TURNERO}gestionar/`;

/**
 * rutaGestion
 * Arma la ruta de la página de gestión de un turno.
 * @param {string} token - token_gestion del turno, tal como lo devuelve el backend
 * @returns {string} Ej: '/turnos/gestionar/3f9a…'
 */
export function rutaGestion(token) {
  return `${PREFIJO_GESTION}${encodeURIComponent(token)}`;
}

/**
 * extraerTokenGestion
 * Si el pathname es el de la gestión de un turno, devuelve el token.
 * El segmento se devuelve tal como viene en la URL (sin decodificar): así se
 * puede volver a usar como segmento de otra ruta (la de la API) sin
 * re-codificarlo.
 * @param {string} pathname - window.location.pathname
 * @returns {string|null} El token, o null si la ruta no es la de gestión
 */
export function extraerTokenGestion(pathname) {
  if (!pathname.startsWith(PREFIJO_GESTION)) return null;
  const token = pathname.slice(PREFIJO_GESTION.length).split('/')[0];
  return token || null;
}

/**
 * RUTA_RESENA
 * Ruta que redirige al formulario de reseñas de Google del local
 * (`tenant.resena_url`). La usan el link de la landing y el QR de la puerta:
 * pasar por una ruta propia permite cambiar el link de Google sin reimprimir
 * el QR.
 */
export const RUTA_RESENA = `${RUTA_TURNERO}resena`;

/**
 * rutaResena
 * Arma la ruta de reseñas con el origen del pedido (de dónde llegó el cliente).
 * @param {string} origen - Ej: 'landing' o 'qr'
 * @returns {string} Ej: '/turnos/resena?origen=landing'
 */
export function rutaResena(origen) {
  return `${RUTA_RESENA}?${new URLSearchParams({ origen })}`;
}

/**
 * esRutaResena
 * True si el pathname es el de la ruta de reseñas (con o sin barra final).
 * @param {string} pathname - window.location.pathname
 * @returns {boolean}
 */
export function esRutaResena(pathname) {
  return pathname === RUTA_RESENA || pathname === `${RUTA_RESENA}/`;
}
