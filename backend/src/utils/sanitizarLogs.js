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
