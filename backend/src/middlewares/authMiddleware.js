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
 * @param {Response} res  - Express response. 401 si la auth falla (firma/expiración/
 *   revocación), 403 si el tenant no coincide, 500 si la consulta de revocación
 *   falla por un problema de servidor (blip de DB) — un error transitorio NO debe
 *   desloguear.
 * @param {Function} next - Pasa al siguiente middleware o controller si todo es correcto.
 */
export const verificarToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  // Verificar que el header exista y tenga el formato "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso no autorizado — token requerido' });
  }

  const token = authHeader.split(' ')[1];

  // ── Paso 1: autenticación (firma + expiración). Un fallo acá es auth real
  // (token vencido, manipulado o con firma inválida) → 401. No toca la DB.
  let payload;
  try {
    // Algoritmo fijado en HS256; ver config/jwt.js.
    payload = verificarFirmaToken(token);
  } catch (err) {
    console.error('[authMiddleware] verificarToken — firma inválida o token expirado:', err);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  // Validación cruzada: el tenant del JWT debe coincidir con el del subdominio.
  // tenantMiddleware corre antes y ya inyectó req.tenant_id.
  if (payload.tenant_id !== req.tenant_id) {
    return res.status(403).json({ error: 'El token no corresponde a este tenant' });
  }

  // Inyectar identidad y rol del consumidor en el request.
  req.tenant_id  = payload.tenant_id;
  req.rol        = payload.rol;
  req.barbero_id = payload.barbero_id; // solo presente si rol === 'barbero'

  // ── Paso 2: revocación por token_version (consulta la DB). Se separa del
  // paso 1 a propósito: acá un error de la query es un fallo de SERVIDOR (blip
  // de conexión al pooler, etc.), NO de auth. Devolverlo como 401 deslogueaba
  // al usuario por un problema transitorio (y con el manejo de 401 del front,
  // lo mandaba al login). Por eso la lectura de versión va en su propio try:
  // cualquier throw → 500 (recuperable); solo un mismatch de tv o activo=false
  // es un rechazo REAL → 401 explícito. (No se usa esErrorDeConexion: llegado
  // acá, todo throw de la DB es server-side, sea de red o de SQL; el reintento
  // de errores de conexión ya lo hace query() internamente.)
  //
  // En los tres roles, un token viejo sin tv en el payload se trata como tv=0
  // para no romper sesiones vigentes mientras nadie haya rotado su credencial.
  const tvToken = payload.tv ?? 0;
  try {
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
  } catch (err) {
    // La consulta de revocación falló (conexión al pooler, etc.): problema de
    // servidor, no de auth. 500 (recuperable) en vez de 401 (que deslogueaba).
    console.error('[authMiddleware] verificarToken — error en la consulta de revocación:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  next();
};
