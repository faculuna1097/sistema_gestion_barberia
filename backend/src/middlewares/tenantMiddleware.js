// /backend/src/middlewares/tenantMiddleware.js
// Lee el subdominio del header X-Tenant-Subdomain enviado por el frontend,
// busca el tenant en DB (con caché en memoria), e inyecta req.tenant_id.
//
// El caché guarda, por subdominio, un objeto
// { tenant_id, operativo_token_version, admin_token_version }.
// Se popula la primera vez que se ve un subdominio y vive hasta que se reinicia
// el server o hasta que se llama invalidar(subdominio). Guardar también las
// versiones de token (operativa y admin) permite que authMiddleware valide la
// revocación de esos tokens sin un SELECT por request (las lee de acá).
// La versión de token del barbero NO vive acá: es por barbero (no por tenant),
// así que authMiddleware la resuelve con su propia query.
//
// LIMITACIÓN CONOCIDA (multi-instancia): el caché es por proceso. Si algún día
// Railway corre más de una instancia, invalidar en una NO limpia las otras
// (haría falta un store compartido tipo Redis + pub/sub). Hoy corre 1 instancia,
// así que es overkill. Ver docs/estado_actual.md.

import { query } from '../config/db.js';

// Caché en memoria: { [subdominio]: { tenant_id, operativo_token_version, admin_token_version } }
const tenantCache = {};

/**
 * resolverPorSubdominio
 * Cache-aside: devuelve la entrada de caché de un subdominio, poblándola desde
 * la DB en el primer miss. Es el ÚNICO lugar donde vive la query de resolución
 * del tenant por subdominio — tanto tenantMiddleware como leerTokenVersionOperativo
 * la reusan para no duplicarla.
 *
 * @param {string} subdominio - subdominio del tenant (header X-Tenant-Subdomain).
 * @returns {Promise<{tenant_id: string, operativo_token_version: number, admin_token_version: number}|null>}
 *          La entrada de caché, o null si no existe un tenant activo con ese subdominio.
 */
async function resolverPorSubdominio(subdominio) {
  if (tenantCache[subdominio]) {
    return tenantCache[subdominio];
  }

  const resultado = await query(
    'SELECT id, operativo_token_version, admin_token_version FROM tenant WHERE subdominio = $1 AND activo = true',
    [subdominio]
  );

  if (resultado.rows.length === 0) {
    return null; // No se cachea el miss: un alta/activación posterior se resuelve sola.
  }

  const entrada = {
    tenant_id: resultado.rows[0].id,
    operativo_token_version: resultado.rows[0].operativo_token_version ?? 0,
    admin_token_version: resultado.rows[0].admin_token_version ?? 0,
  };
  tenantCache[subdominio] = entrada;
  return entrada;
}

/**
 * invalidar
 * Borra la entrada de caché de un subdominio. Idempotente: invalidar algo que no
 * está cacheado es un no-op exitoso. Sincrónico (es un delete en memoria).
 * Reutilizada por el endpoint de plataforma, por adminOperativo al rotar la
 * password operativa y por gestion.cambiarPinAdmin al rotar el PIN admin
 * (ambos bumpean su token_version y dejan el caché stale).
 *
 * @param {string} subdominio - subdominio cuya entrada se descarta del caché.
 * @returns {void}
 */
export function invalidar(subdominio) {
  delete tenantCache[subdominio];
}

/**
 * leerTokenVersion (interna)
 * Devuelve la versión de token vigente de una columna de `tenant` para el
 * tenant del request, leyéndola del caché (sin SELECT por request en
 * producción). En el primer miss la resuelve reusando resolverPorSubdominio
 * (misma query que tenantMiddleware).
 *
 * Caso dev local: si no llega subdominio (fallback a TENANT_ID), no hay clave de
 * caché posible, así que cae a un SELECT directo por id. Inofensivo (1 dev, 1
 * tenant) y mantiene la revocación inmediata también en local.
 *
 * Preserva el comportamiento previo: tenant inexistente / columna NULL ⇒ 0.
 *
 * @param {Request} req     - Express request (se usan headers y req.tenant_id).
 * @param {string}  columna - 'operativo_token_version' | 'admin_token_version'.
 *                            Constante interna, NUNCA input del usuario (se
 *                            interpola en el SQL del fallback).
 * @returns {Promise<number>} la versión de token vigente.
 */
async function leerTokenVersion(req, columna) {
  const subdominio = req.headers['x-tenant-subdomain'];

  if (subdominio) {
    const entrada = await resolverPorSubdominio(subdominio);
    return entrada ? entrada[columna] : 0;
  }

  // Fallback dev local (sin subdominio): no hay clave de caché, resolver por id.
  const resultado = await query(
    `SELECT ${columna} FROM tenant WHERE id = $1`,
    [req.tenant_id]
  );
  return resultado.rows[0]?.[columna] ?? 0;
}

/**
 * leerTokenVersionOperativo
 * Versión de token operativa vigente del tenant del request (para que
 * authMiddleware valide la revocación de tokens operativos).
 * @param {Request} req - Express request.
 * @returns {Promise<number>}
 */
export async function leerTokenVersionOperativo(req) {
  return leerTokenVersion(req, 'operativo_token_version');
}

/**
 * leerTokenVersionAdmin
 * Versión de token admin vigente del tenant del request (para que
 * authMiddleware valide la revocación de tokens admin).
 * @param {Request} req - Express request.
 * @returns {Promise<number>}
 */
export async function leerTokenVersionAdmin(req) {
  return leerTokenVersion(req, 'admin_token_version');
}

/**
 * tenantMiddleware
 * Resuelve el tenant del request desde el header X-Tenant-Subdomain (con caché)
 * e inyecta req.tenant_id. Corre global, antes de cualquier controller.
 *
 * @param {Request}  req  - Express request. Se le agrega req.tenant_id.
 * @param {Response} res  - Express response. 400 si no hay tenant, 404 si no existe, 500 si falla la DB.
 * @param {Function} next - pasa al siguiente middleware/controller si resuelve.
 */
export const tenantMiddleware = async (req, res, next) => {
  const subdominio = req.headers['x-tenant-subdomain'];

  // Fallback para desarrollo local (localhost no tiene subdominio)
  if (!subdominio) {
    const fallback = process.env.TENANT_ID;
    if (fallback) {
      req.tenant_id = fallback;
      return next();
    }
    return res.status(400).json({ error: 'Tenant no identificado' });
  }

  try {
    const entrada = await resolverPorSubdominio(subdominio);

    if (!entrada) {
      // Evento de seguridad/operación (convención de logs §1.4: "tenant no
      // encontrado" va con console.warn). Es el ÚNICO log de este middleware:
      // la convención prohíbe loguear la entrada/salida de middlewares que
      // corren en cada request, pero este camino es el rechazo, no el flujo
      // normal. Señal alta y volumen bajo — un subdominio que no resuelve es
      // o un tenant dado de baja, o un subdominio mal escrito, o (como pasó
      // acá) una fila de `tenant` editada a mano que dejó la URL de producción
      // apuntando a la nada. Sin este log, el síntoma en el front es un
      // genérico "Tenant no encontrado" imposible de rastrear.
      //
      // El camino del 400 (sin header) NO se loguea a propósito: la convención
      // excluye las validaciones de input faltante, y el dominio de la API
      // recibe escaneo automatizado constante que lo convertiría en ruido. El
      // log de acceso global ya deja constancia de esos requests.
      console.warn('[tenantMiddleware] tenantMiddleware — subdominio no resuelve a un tenant activo | subdominio:', subdominio);
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    req.tenant_id = entrada.tenant_id;
    next();

  } catch (err) {
    console.error('[tenantMiddleware] Error en tenantMiddleware:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
