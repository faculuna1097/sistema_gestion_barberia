// /backend/src/middlewares/plataformaAuthMiddleware.js
// Protege los endpoints de plataforma (operación manual, fuera de la cadena
// tenant/JWT). Autentica con un secreto único de plataforma que viaja en el
// header X-Platform-Key (NO en body/query, para que no quede en logs de URL),
// comparado en tiempo constante contra el env var PLATFORM_ADMIN_KEY.
//
// FAIL-SAFE: si PLATFORM_ADMIN_KEY no está seteado, se rechaza TODO (503). Nunca
// hay un default abierto: sin secreto configurado, el endpoint queda inutilizable.

import crypto from 'crypto';

/**
 * clavesCoinciden
 * Compara dos strings en tiempo constante (no corta antes ante el primer byte
 * distinto), para no filtrar info por timing. Se hashea cada una con SHA-256 y
 * se comparan los dos digests de 32 bytes: así timingSafeEqual nunca recibe
 * buffers de distinta longitud (no tira excepción) y tampoco se filtra el largo
 * de la clave.
 *
 * @param {string} provista - clave recibida en el header.
 * @param {string} esperada - clave esperada (env var).
 * @returns {boolean} true si coinciden exactamente.
 */
function clavesCoinciden(provista, esperada) {
  const hashProvista = crypto.createHash('sha256').update(String(provista)).digest();
  const hashEsperada = crypto.createHash('sha256').update(String(esperada)).digest();
  return crypto.timingSafeEqual(hashProvista, hashEsperada);
}

/**
 * verificarClavePlataforma
 * Middleware que exige el secreto de plataforma en el header X-Platform-Key.
 *
 * @param {Request}  req  - Express request. Lee req.headers['x-platform-key'].
 * @param {Response} res  - 503 si el secreto no está configurado, 401 si la clave es inválida/ausente.
 * @param {Function} next - pasa al handler si la clave es válida.
 */
export const verificarClavePlataforma = (req, res, next) => {
  const esperada = process.env.PLATFORM_ADMIN_KEY;

  // Fail-safe: sin secreto configurado, el endpoint no está disponible.
  if (!esperada) {
    console.error('[plataformaAuth] PLATFORM_ADMIN_KEY no configurada — endpoint deshabilitado, se rechaza todo');
    return res.status(503).json({ error: 'Endpoint no disponible' });
  }

  const provista = req.headers['x-platform-key'];
  if (!provista || !clavesCoinciden(provista, esperada)) {
    console.warn('[plataformaAuth] clave de plataforma inválida o ausente — acceso rechazado');
    return res.status(401).json({ error: 'No autorizado' });
  }

  next();
};
