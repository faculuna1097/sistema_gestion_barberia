// /backend/src/middlewares/requiereRolMiddleware.js
// Middleware factory que restringe una ruta a uno o más roles.
// Se monta DESPUÉS de verificarToken, que ya inyectó req.rol en el request.
// Si el rol del request no está en la lista de roles permitidos, responde 403.
// Se usa para rutas exclusivas de admin (ej: ABM de barberos y servicios).
// Las rutas que aceptan ambos roles (admin y barbero) NO usan este middleware;
// el scoping fino se hace dentro del controller mirando req.rol y req.barbero_id.

/**
 * requiereRol
 * Devuelve un middleware Express que solo deja pasar requests cuyo req.rol
 * esté incluido en rolesPermitidos. Para usarlo después de verificarToken.
 *
 * @param  {...string} rolesPermitidos - Lista de roles autorizados (ej: 'admin', 'barbero').
 * @returns {Function} middleware Express (req, res, next).
 */
export const requiereRol = (...rolesPermitidos) => (req, res, next) => {
  if (!rolesPermitidos.includes(req.rol)) {
    console.error('[requiereRol] Acceso denegado | rol:', req.rol, '| requeridos:', rolesPermitidos);
    return res.status(403).json({ error: 'No tenés permiso para esta acción' });
  }
  next();
};
