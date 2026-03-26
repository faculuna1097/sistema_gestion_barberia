// /backend/src/middlewares/authMiddleware.js
// Middleware que protege las rutas del panel admin.
// Verifica que el request incluya un JWT válido en el header Authorization.
// Si es válido, inyecta req.tenant_id para que los controllers lo usen.

import jwt from 'jsonwebtoken';

/**
 * verificarToken
 * Middleware de autenticación JWT.
 * Lee el header "Authorization: Bearer <token>", verifica la firma con JWT_SECRET
 * y, si es válido, agrega req.tenant_id antes de llamar a next().
 * Si no hay token o es inválido, responde 401 sin continuar.
 *
 * @param {Request}  req  - Express request. Agrega req.tenant_id si el token es válido.
 * @param {Response} res  - Express response. Responde 401 si la validación falla.
 * @param {Function} next - Pasa al siguiente middleware o controller si todo es correcto.
 */
export const verificarToken = (req, res, next) => {
  console.log('[authMiddleware] verificarToken — request recibido | ruta:', req.method, req.url);

  const authHeader = req.headers['authorization'];

  // Verificar que el header exista y tenga el formato "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[authMiddleware] Error en verificarToken: header Authorization ausente o con formato incorrecto');
    return res.status(401).json({ error: 'Acceso no autorizado — token requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verificar la firma del token con el secreto almacenado en .env
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Inyectar el tenant_id en el request para que los controllers lo usen
    req.tenant_id = payload.tenant_id;
    console.log('[authMiddleware] verificarToken — completado | tenant_id:', req.tenant_id);
    next();
  } catch (err) {
    // jwt.verify lanza error si el token está vencido, manipulado o con firma inválida
    console.error('[authMiddleware] Error en verificarToken:', err.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};
