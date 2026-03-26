// /backend/src/middlewares/tenantMiddleware.js
// Middleware que establece req.tenant_id en todas las rutas.
//
// Opción A — tenant por deploy: cada instancia del backend tiene su propio
// TENANT_ID en .env, apuntando a un negocio específico en la base de datos.
//
// Cuando escale a multi-tenant por subdominio (Opción B), solo cambia este
// archivo: leer req.hostname, buscar el tenant en DB, asignar req.tenant_id.
// Ningún controller cambia.
//
// Orden de precedencia en el pipeline de middlewares:
//   1. tenantMiddleware  → pone req.tenant_id desde .env (todas las rutas)
//   2. verificarToken    → sobreescribe req.tenant_id con el valor del JWT (rutas protegidas)
// En rutas protegidas el JWT siempre gana. En rutas públicas queda el valor del .env.

/**
 * tenantMiddleware
 * Lee TENANT_ID desde process.env y lo inyecta en req.tenant_id.
 * Si la variable no está configurada, responde 500 para evitar que
 * cualquier query corra sin tenant_id y potencialmente exponga datos.
 *
 * @param {Request}  req  - Express request. Agrega req.tenant_id.
 * @param {Response} res  - Express response. Responde 500 si falta TENANT_ID.
 * @param {Function} next - Pasa al siguiente middleware si todo es correcto.
 */
export const tenantMiddleware = (req, res, next) => {
  const tenantId = process.env.TENANT_ID;

  if (!tenantId) {
    console.error('[tenantMiddleware] Error en tenantMiddleware: TENANT_ID no definido en .env');
    return res.status(500).json({ error: 'Configuración de tenant inválida' });
  }

  req.tenant_id = tenantId;
  next();
};
