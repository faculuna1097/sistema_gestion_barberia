// /backend/src/utils/sanitizarLogs.js
// Helpers para sanitizar datos sensibles antes de loguearlos.
// Se usa principalmente en el middleware de logging global de index.js,
// para evitar que credenciales (PIN admin, PIN barbero, contraseñas) viajen
// a los logs de Railway en texto plano.

// Lista de keys cuyo valor se reemplaza por '***' al sanitizar un objeto.
// Comparación case-insensitive. Agregar acá nuevas keys cuando aparezcan
// (ej: 'token', 'secret', si alguna vez viajan en body).
const KEYS_SENSIBLES = ['pin', 'pin_admin', 'pin_actual', 'pin_nuevo', 'password'];

/**
 * sanitizarObjeto
 * Devuelve una copia superficial de `obj` con los valores de las keys
 * sensibles reemplazados por '***'. No muta el objeto original.
 * Recursivo un nivel para cubrir bodies anidados (ej: { datos: { pin: ... } }).
 *
 * @param {object} obj - El objeto a sanitizar (típicamente req.body).
 * @returns {object} Una copia con los valores sensibles tachados.
 */
export function sanitizarObjeto(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const copia = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key of Object.keys(copia)) {
    if (KEYS_SENSIBLES.includes(key.toLowerCase())) {
      copia[key] = '***';
    } else if (copia[key] && typeof copia[key] === 'object') {
      copia[key] = sanitizarObjeto(copia[key]);
    }
  }

  return copia;
}

// Rutas con un secreto en el path: el token_gestion del turnero (con él cualquiera
// ve y cancela el turno). Matchea el segmento siguiente a /api/turnero/turnos/.
const RUTA_TOKEN_TURNERO = /(\/api\/turnero\/turnos\/)[^/?#]+/;

/**
 * enmascararTokenTurnero
 * Devuelve la URL con el token_gestion del turnero reemplazado por ':token' y
 * todo lo demás intacto (query string incluido). Es para los logs de Railway:
 * ahí el query string sirve para diagnosticar, pero el token no tiene que
 * quedar escrito (los logs los lee la sesión de diagnóstico de Claude).
 * Ej.: '/api/turnero/turnos/abc123/cancelar?x=1' → '/api/turnero/turnos/:token/cancelar?x=1'.
 *
 * @param {string} url - URL o path del request (ej. req.url, req.originalUrl).
 * @returns {string} la URL con el token enmascarado (string vacío si url no es un string).
 */
export function enmascararTokenTurnero(url) {
  if (typeof url !== 'string') return '';
  return url.replace(RUTA_TOKEN_TURNERO, '$1:token');
}

/**
 * rutaSinDatosSensibles
 * Devuelve la ruta de un request lista para mandar a un servicio externo (Sentry):
 * sin query string ni fragmento, y con el token_gestion del turnero reemplazado
 * por ':token'. Acepta una URL absoluta o solo el path.
 * Ej.: '/api/turnero/turnos/abc123/cancelar?x=1' → '/api/turnero/turnos/:token/cancelar'.
 *
 * @param {string} url - URL o path del request (ej. req.originalUrl).
 * @returns {string} la ruta limpia (string vacío si url no es un string).
 */
export function rutaSinDatosSensibles(url) {
  if (typeof url !== 'string') return '';
  return enmascararTokenTurnero(url.split(/[?#]/)[0]);
}
