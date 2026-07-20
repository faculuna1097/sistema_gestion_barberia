// /backend/src/middlewares/authMiddleware.js
// Middleware que protege las rutas autenticadas del backend.
// Verifica que el request incluya un JWT válido en el header Authorization,
// que el tenant del token coincida con el del subdominio (resuelto antes por
// tenantMiddleware), y deja en el request el rol y, si aplica, el barbero_id
// para que los controllers puedan scopear la respuesta según el consumidor.

import { verificarFirmaToken } from '../config/jwt.js';
import { leerTokenVersionOperativo, leerTokenVersionAdmin } from './tenantMiddleware.js';
import { query } from '../config/db.js';

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
    // Verificar firma y expiración (algoritmo fijado en HS256; ver config/jwt.js)
    const payload = verificarFirmaToken(token);

    // Validación cruzada: el tenant del JWT debe coincidir con el del subdominio.
    // tenantMiddleware corre antes y ya inyectó req.tenant_id.
    if (payload.tenant_id !== req.tenant_id) {
      return res.status(403).json({ error: 'El token no corresponde a este tenant' });
    }

    // Inyectar identidad y rol del consumidor en el request.
    req.tenant_id  = payload.tenant_id;
    req.rol        = payload.rol;
    req.barbero_id = payload.barbero_id; // solo presente si rol === 'barbero'

    // Token version check por rol — revocación anticipada de sesiones sin
    // esperar la expiración natural de 30 días. En los tres casos, un token
    // viejo sin tv en el payload se trata como tv=0 para no romper sesiones
    // vigentes mientras nadie haya rotado su credencial.
    const tvToken = payload.tv ?? 0;

    // Operativo y admin: la versión vive en `tenant` y sale del caché del
    // tenantMiddleware (poblado por subdominio), NO de un SELECT por request.
    // Al rotar la credencial (password operativa / PIN admin), el controller
    // incrementa la versión e invalida esa entrada de caché; el próximo
    // request re-lee la versión nueva y cualquier token emitido antes (con tv
    // menor) queda rechazado al instante.
    if (payload.rol === 'operativo') {
      const tvActual = await leerTokenVersionOperativo(req);
      if (tvToken !== tvActual) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }
    }

    if (payload.rol === 'admin') {
      const tvActual = await leerTokenVersionAdmin(req);
      if (tvToken !== tvActual) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }
    }

    // Barbero: la versión es POR BARBERO (barbero.token_version), no por
    // tenant, así que no entra en el caché por subdominio — se resuelve con
    // UNA query por request que trae versión Y estado activo. Esto también
    // corta la sesión de un barbero desactivado (activo=false) al instante.
    // A este volumen (pocos barberos, requests esporádicos) la query por
    // request es aceptable; si algún día pesa, cachear por barbero_id con
    // invalidación desde editarBarbero (mismo patrón que el caché de tenant).
    if (payload.rol === 'barbero') {
      const barberoRes = await query(
        'SELECT token_version, activo FROM barbero WHERE id = $1 AND tenant_id = $2',
        [payload.barbero_id, req.tenant_id]
      );
      const barbero = barberoRes.rows[0];
      if (!barbero || !barbero.activo || tvToken !== (barbero.token_version ?? 0)) {
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
