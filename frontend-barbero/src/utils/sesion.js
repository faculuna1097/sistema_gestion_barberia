// /frontend-barbero/src/utils/sesion.js
// Lo que la app del barbero guarda en el celular (localStorage):
//   - la sesión (token + { id, nombre } del barbero), para no pedir el PIN cada
//     vez que se abre la app. Dura lo que el token: 30 días desde el login
//     (backend/src/config/jwt.js). Si el dueño le cambia el PIN o lo da de baja,
//     el backend responde 401 y la app vuelve al login (onUnauthorized en App).
//   - el id del último barbero que entró desde este celular, que el selector
//     del login muestra primero.
//   - los avisos de traspasos que cada barbero ya vio (abajo de todo).
// Mismo criterio que el token del iPad en el panel (frontend/src/App.jsx).
// Agregado el 2026-11-13 (F5 de plan_mejoras_operativas.md).
//
// localStorage puede no estar disponible (modo privado, datos del sitio
// bloqueados): cada acceso va en try/catch y, si falla, la app funciona como
// antes (sesión solo en memoria, lista en orden alfabético).

const CLAVE_SESION = 'barbero_sesion';
const CLAVE_ULTIMO = 'barbero_ultimo_id';

/**
 * vencimientoDeToken
 * Lee el vencimiento (`exp`) del payload de un JWT, sin verificar la firma: la
 * firma la verifica el backend en cada pedido. Sirve solo para no abrir la app
 * con un token que ya se sabe vencido.
 * @param {string} token - JWT
 * @returns {number|null} Milisegundos epoch del vencimiento, o null si no se
 *   puede leer
 */
function vencimientoDeToken(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json);
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * leerSesion
 * Sesión guardada en el celular, si hay una vigente. Una sesión vencida o mal
 * formada se borra y cuenta como que no hay.
 * @returns {{ token: string, barbero: { id: string, nombre: string } } | null}
 */
export function leerSesion() {
  let crudo;
  try {
    crudo = localStorage.getItem(CLAVE_SESION);
  } catch (err) {
    console.warn('[sesion] leerSesion — localStorage inaccesible, sesión solo en memoria:', err.message);
    return null;
  }
  if (!crudo) return null;

  let sesion;
  try {
    sesion = JSON.parse(crudo);
  } catch {
    sesion = null;
  }
  const valida = sesion
    && typeof sesion.token === 'string'
    && typeof sesion.barbero?.id === 'string'
    && typeof sesion.barbero?.nombre === 'string';
  const vence = valida ? vencimientoDeToken(sesion.token) : null;
  if (!valida || vence === null || vence <= Date.now()) {
    borrarSesion();
    return null;
  }
  return { token: sesion.token, barbero: { id: sesion.barbero.id, nombre: sesion.barbero.nombre } };
}

/**
 * guardarSesion
 * Guarda la sesión después de un login correcto.
 * @param {string} token - JWT del barbero
 * @param {{ id: string, nombre: string }} barbero
 */
export function guardarSesion(token, barbero) {
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify({
      token,
      barbero: { id: barbero.id, nombre: barbero.nombre },
    }));
  } catch (err) {
    console.warn('[sesion] guardarSesion — localStorage inaccesible, sesión solo en memoria:', err.message);
  }
}

/**
 * borrarSesion
 * Borra la sesión guardada (cerrar sesión, 401 del backend, token vencido).
 * No borra el último barbero: el próximo login lo sigue mostrando primero.
 */
export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE_SESION);
  } catch (err) {
    console.warn('[sesion] borrarSesion — localStorage inaccesible:', err.message);
  }
}

/**
 * leerUltimoBarbero
 * Id del último barbero que entró desde este celular.
 * @returns {string|null}
 */
export function leerUltimoBarbero() {
  try {
    return localStorage.getItem(CLAVE_ULTIMO);
  } catch (err) {
    console.warn('[sesion] leerUltimoBarbero — localStorage inaccesible:', err.message);
    return null;
  }
}

/**
 * guardarUltimoBarbero
 * Anota el barbero que acaba de entrar, para mostrarlo primero en el próximo login.
 * @param {string} barberoId
 */
export function guardarUltimoBarbero(barberoId) {
  try {
    localStorage.setItem(CLAVE_ULTIMO, barberoId);
  } catch (err) {
    console.warn('[sesion] guardarUltimoBarbero — localStorage inaccesible:', err.message);
  }
}

// ─── Avisos ya vistos ───────────────────────────────────────────────────────
// Los resultados de los traspasos que ofreció el barbero (aceptado, rechazado,
// vencido) dejan de sumar en el contador de la campanita cuando los vio. Se
// guardan los ids por barbero: en un mismo celular pueden entrar varios.
// Si localStorage falla, vuelven a contar como nuevos (se ven una vez más).

const PREFIJO_AVISOS_VISTOS = 'barbero_avisos_vistos:';

/**
 * leerAvisosVistos
 * Ids de los avisos que el barbero ya vio en este celular.
 * @param {string} barberoId
 * @returns {string[]}
 */
export function leerAvisosVistos(barberoId) {
  try {
    const crudo = localStorage.getItem(PREFIJO_AVISOS_VISTOS + barberoId);
    const ids = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
  } catch (err) {
    console.warn('[sesion] leerAvisosVistos — localStorage inaccesible o dato roto:', err.message);
    return [];
  }
}

/**
 * guardarAvisosVistos
 * Reemplaza los ids de avisos vistos del barbero.
 * @param {string} barberoId
 * @param {string[]} ids
 */
export function guardarAvisosVistos(barberoId, ids) {
  try {
    localStorage.setItem(PREFIJO_AVISOS_VISTOS + barberoId, JSON.stringify(ids));
  } catch (err) {
    console.warn('[sesion] guardarAvisosVistos — localStorage inaccesible:', err.message);
  }
}
