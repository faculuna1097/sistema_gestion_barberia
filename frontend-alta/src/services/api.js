// /frontend-alta/src/services/api.js
// Llamadas HTTP al backend del formulario de alta (/api/alta, routes/alta.js).
// Sin tenant ni login: el acceso es el token del link, que es el primer
// segmento del path (alta.barbermanager.app/<token>). Por eso no se manda
// X-Tenant-Subdomain: estas rutas van antes de tenantMiddleware.
//
// Todas las funciones lanzan:
//   - ErrorApi si el backend respondió con error (status, codigo y errores del
//     backend, ver utils/errores.js);
//   - ErrorSinRespuesta si el pedido no llegó (sin red o servidor caído);
//   - el AbortError del navegador si el pedido se canceló con `signal`.

import {
  ErrorApi, ErrorSinRespuesta, TEXTO_DEMASIADOS_INTENTOS, TEXTO_RESPUESTA_INESPERADA,
  diagnosticarSinRespuesta,
} from '../utils/errores.js';

const BASE_API = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:3001/api';

const BASE_URL = `${BASE_API}/alta`;

// Para diagnosticar un pedido que no recibió respuesta.
const URL_HEALTH = `${BASE_API}/health`;

// keepalive limita el body: el navegador rechaza los pedidos keepalive que
// suman más de 64 kB en vuelo. Por encima de este tope se guarda sin keepalive.
const TOPE_KEEPALIVE_BYTES = 60 * 1024;

/**
 * leerToken (interna)
 * Lee el token del link: el primer segmento del path. No valida el formato: lo
 * valida el backend (uno mal formado da 404, igual que uno que no existe).
 * @returns {string|null} El token, o null si se abrió la raíz sin token o el
 *   segmento trae un escape % roto (decodeURIComponent lanzaría).
 */
function leerToken() {
  const segmento = window.location.pathname.split('/').filter(Boolean)[0];
  if (!segmento) return null;
  try {
    return decodeURIComponent(segmento);
  } catch {
    return null;
  }
}

/**
 * TOKEN
 * Token del link (leerToken), o null si no hay. Se lee una vez al cargar: la
 * navegación del formulario no cambia el path.
 * @type {string|null}
 */
export const TOKEN = leerToken();

/**
 * urlSolicitud (interna)
 * @param {string} [sufijo=''] - Lo que va después del token (ej. '/enviar')
 * @returns {string} URL absoluta del recurso de la solicitud.
 */
function urlSolicitud(sufijo = '') {
  return `${BASE_URL}/${encodeURIComponent(TOKEN ?? '')}${sufijo}`;
}

/**
 * pedir (interna)
 * fetch con la forma de error de este front. Con `diagnosticar`, un pedido sin
 * respuesta averigua si fue la red o el servidor (cuesta dos pedidos más a
 * /api/health, solo cuando ya falló).
 * @param {string} url
 * @param {Object} opciones - opciones de fetch
 * @param {Object} [extra]
 * @param {boolean} [extra.diagnosticar=false]
 * @returns {Promise<Object>} El JSON de la respuesta.
 * @throws {ErrorApi|ErrorSinRespuesta|DOMException}
 */
async function pedir(url, opciones, { diagnosticar = false } = {}) {
  let res;
  try {
    res = await fetch(url, opciones);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ErrorSinRespuesta(diagnosticar ? await diagnosticarSinRespuesta(URL_HEALTH) : null);
  }
  if (!res.ok) {
    // Un error sin JSON (ej. el 413 de express.json, en HTML) llega con el cuerpo vacío.
    const body = await res.json().catch(() => ({}));
    throw new ErrorApi({
      status: res.status,
      mensaje: res.status === 429
        ? TEXTO_DEMASIADOS_INTENTOS
        : (typeof body.error === 'string' ? body.error : TEXTO_RESPUESTA_INESPERADA),
      codigo: typeof body.codigo === 'string' ? body.codigo : null,
      errores: Array.isArray(body.errores) ? body.errores : null,
    });
  }
  return res.json();
}

/**
 * obtenerSolicitud — GET /api/alta/:token
 * Trae la solicitud para mostrarla o retomarla. Si no llega respuesta,
 * diagnostica si fue la red o el servidor (la pantalla de error lo dice).
 * @returns {Promise<{estado: 'borrador'|'enviada'|'cargada', datos: Object, vence_en: string}>}
 * @throws {ErrorApi} 404 (codigo solicitud_no_encontrada) si no existe, venció o el token está mal formado
 */
export async function obtenerSolicitud() {
  return pedir(urlSolicitud(), { cache: 'no-store' }, { diagnosticar: true });
}

/**
 * guardarSolicitud — PUT /api/alta/:token
 * Autoguardado: reemplaza `datos` entero mientras la solicitud está en borrador.
 * Va con keepalive (si entra en su tope): así un guardado que sale justo antes
 * de cerrar la pestaña o WhatsApp llega igual.
 * @param {Object} datos - El formulario completo (forma de utils/datosSolicitud.js)
 * @param {Object} [opciones]
 * @param {AbortSignal} [opciones.signal] - Para cancelarlo (lo usa el autoguardado)
 * @returns {Promise<{updated_at: string}>}
 * @throws {ErrorApi} 409 (solicitud_ya_enviada), 404 (venció), 400 (formato_invalido), 413, 429
 */
export async function guardarSolicitud(datos, { signal } = {}) {
  const body = JSON.stringify({ datos });
  return pedir(urlSolicitud(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: body.length <= TOPE_KEEPALIVE_BYTES,
    signal,
  });
}

/**
 * consultarSubdominio — GET /api/alta/:token/subdominio/:valor
 * Dice si un subdominio se puede usar. El front ya revisó el formato
 * (utils/subdominio.js): esto suma si lo usa otra barbería.
 * @param {string} valor - Subdominio ya normalizado
 * @param {Object} [opciones]
 * @param {AbortSignal} [opciones.signal] - Para descartar una consulta vieja mientras se escribe
 * @returns {Promise<{disponible: boolean, motivo: null|'formato'|'reservado'|'ocupado'}>}
 * @throws {ErrorApi} 404 si el link ya no sirve
 */
export async function consultarSubdominio(valor, { signal } = {}) {
  return pedir(urlSolicitud(`/subdominio/${encodeURIComponent(valor)}`), { cache: 'no-store', signal });
}

/**
 * enviarSolicitud — POST /api/alta/:token/enviar
 * Envío final (fase 5): el backend valida todo y pasa la solicitud a 'enviada'.
 * @param {Object} datos - El formulario completo
 * @returns {Promise<{estado: 'enviada'}>}
 * @throws {ErrorApi} 400 datos_invalidos (con `errores: [{ campo, mensaje }]`), 404, 409, 429
 */
export async function enviarSolicitud(datos) {
  return pedir(urlSolicitud('/enviar'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datos }),
  });
}
