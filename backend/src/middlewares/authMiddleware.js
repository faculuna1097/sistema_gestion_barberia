// /backend/src/middlewares/authMiddleware.js
// Middleware que protege las rutas autenticadas del backend.
// Verifica que el request incluya un JWT válido en el header Authorization,
// que el tenant del token coincida con el del subdominio (resuelto antes por
// tenantMiddleware), y deja en el request el rol y, si aplica, el barbero_id
// para que los controllers puedan scopear la respuesta según el consumidor.

import jwt from 'jsonwebtoken';
import { leerTokenVersionOperativo } from './tenantMiddleware.js';

/**
 * verificarToken
 * Middleware de autenticación JWT.
 * Lee el header "Authorization: Bearer <token>", verifica la firma con
 * JWT_SECRET y, si es válido:
 *   1. Compara payload.tenant_id contra req.tenant_id (el que ya inyectó
 *      tenantMiddleware desde el subdominio). Si difieren → 403. Esto evita
 *      que un JWT de tenant A se use sobre el subdominio del tenant B.
 *   2. Inyecta req.tenant_id, req.rol y, si rol === 'barbero',
 *      req.barbero_id, para que los controllers puedan scopear por rol.
 *
 * @param {Request}  req  - Express request. Se le agregan tenant_id, rol y barbero_id.
 * @param {Response} res  - Express response. Responde 401/403 si la validación falla.
 * @param {Function} next - Pasa al siguiente middleware o controller si todo es correcto.
 */
export const verificarToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  // Verificar que el header exista y tenga el formato "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso no autorizado — token requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verificar la firma del token con el secreto almacenado en .env
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Validación cruzada: el tenant del JWT debe coincidir con el del subdominio.
    // tenantMiddleware corre antes y ya inyectó req.tenant_id.
    if (payload.tenant_id !== req.tenant_id) {
      return res.status(403).json({ error: 'El token no corresponde a este tenant' });
    }

    // Inyectar identidad y rol del consumidor en el request.
    req.tenant_id  = payload.tenant_id;
    req.rol        = payload.rol;
    req.barbero_id = payload.barbero_id; // solo presente si rol === 'barbero'

    // Token version check para tokens operativos. operativo_token_version sale
    // del caché del tenantMiddleware (poblado por subdominio), NO de un SELECT
    // por request. Al rotar la password operativa, adminOperativo incrementa la
    // versión e invalida esa entrada de caché; así el próximo request re-lee la
    // versión nueva y cualquier token emitido antes (con tv menor) queda
    // rechazado al instante, sin esperar al reinicio del server ni a su
    // expiración natural de 30 días. Tokens viejos sin tv en el payload se
    // tratan como tv=0 para no romper sesiones existentes mientras nadie haya
    // rotado la password.
    if (payload.rol === 'operativo') {
      const tvActual = await leerTokenVersionOperativo(req);
      const tvToken  = payload.tv ?? 0;
      if (tvToken !== tvActual) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }
    }

    next();
  } catch (err) {
    // jwt.verify lanza error si el token está vencido, manipulado o con firma inválida
    console.error('[authMiddleware] Error en verificarToken:', err);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};
