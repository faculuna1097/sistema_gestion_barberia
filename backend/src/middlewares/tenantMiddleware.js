// /backend/src/middlewares/tenantMiddleware.js
// Lee el subdominio del header X-Tenant-Subdomain enviado por el frontend,
// busca el tenant en DB (con caché en memoria), e inyecta req.tenant_id.

import { query } from '../config/db.js';

const TZ = 'America/Argentina/Buenos_Aires';

// Caché en memoria: { subdominio: tenant_id }
// Evita ir a la DB en cada request. Se resetea al reiniciar el servidor.
const tenantCache = {};

export const tenantMiddleware = async (req, res, next) => {
  const subdominio = req.headers['x-tenant-subdomain'];

  // Fallback para desarrollo local (localhost no tiene subdominio)
  if (!subdominio) {
    const fallback = process.env.TENANT_ID;
    if (fallback) {
      req.tenant_id = fallback;
      return next();
    }
    console.error('[tenantMiddleware] tenantMiddleware — sin subdominio y sin TENANT_ID en .env');
    return res.status(400).json({ error: 'Tenant no identificado' });
  }

  // Si ya está en caché, no va a la DB
  if (tenantCache[subdominio]) {
    req.tenant_id = tenantCache[subdominio];
    return next();
  }

  try {
    console.log('[tenantMiddleware] tenantMiddleware — request recibido | subdominio:', subdominio);

    const resultado = await query(
      'SELECT id FROM tenant WHERE subdominio = $1 AND activo = true',
      [subdominio]
    );

    if (resultado.rows.length === 0) {
      console.error('[tenantMiddleware] tenantMiddleware — tenant no encontrado | subdominio:', subdominio);
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    const tenant_id = resultado.rows[0].id;
    tenantCache[subdominio] = tenant_id;

    console.log('[tenantMiddleware] tenantMiddleware — completado | tenant_id:', tenant_id);

    req.tenant_id = tenant_id;
    next();

  } catch (err) {
    console.error('[tenantMiddleware] Error en tenantMiddleware:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};