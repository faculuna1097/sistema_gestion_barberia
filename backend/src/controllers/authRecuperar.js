// /backend/src/controllers/authRecuperar.js
// Recuperación por mail de la contraseña del iPad (modo operativo) y del PIN de admin
// (plan_mejoras_operativas.md, F6). Tres endpoints públicos bajo /api/auth/recuperar,
// con limiterLogin (index.js):
//   - solicitar: manda el mail al dueño (tenant.email_duenio) con un link de un solo uso.
//   - validar:   dice si un token sirve y de qué tipo es (el front elige la pantalla).
//   - usar:      cambia la credencial y consume el token.
//
// Un tenant dado de baja no llega acá: tenantMiddleware solo resuelve tenants activos.
//
// Privacidad: ni el token, ni el mail del dueño, ni la credencial nueva van a un log ni
// a Sentry. El log de acceso global tapa `token` y `nueva` (utils/sanitizarLogs.js), y
// los logs de acá llevan solo el tenant y el tipo. Un token que no sirve es un rechazo
// esperado: console.warn, que no llega a Sentry.
//
// Lo que no es HTTP (token, hash, link, queries) vive en services/recuperacionService.js.

import { query } from '../config/db.js';
import { invalidar } from '../middlewares/tenantMiddleware.js';
import { enviarRecuperacion } from '../services/mail/mailer.js';
import {
  TIPOS_RECUPERACION,
  generarToken,
  hashToken,
  esFormatoToken,
  enmascararEmail,
  armarLinkRecuperacion,
  emitirToken,
  leerTipoTokenVigente,
  usarToken,
} from '../services/recuperacionService.js';
import {
  esPasswordOperativaValida,
  hashearPasswordOperativa,
  PASSWORD_MIN_CARACTERES,
} from '../utils/credencialesOperativas.js';
import { esPinValido, hashearPin, pinColisiona } from '../utils/pin.js';

// Mismo mensaje para todo token que no sirve (inexistente, de otro tenant, usado o
// vencido): no se le dice a nadie cuál de los casos es.
const MENSAJE_TOKEN_INVALIDO = 'El link venció o ya se usó. Pedí uno nuevo.';
// Para que el front distinga este 400 del de `nueva` sin comparar textos.
const CODIGO_TOKEN_INVALIDO = 'token_invalido';

/**
 * rechazarToken (interna)
 * Responde el 400 genérico de token inválido (con codigo 'token_invalido') y deja
 * el warn de seguridad.
 * @param {Response} res
 * @param {string} nombreFuncion - Para el log.
 * @param {string} tenantId - Para el log.
 * @returns {Response} La respuesta 400.
 */
const rechazarToken = (res, nombreFuncion, tenantId) => {
  console.warn(`[authRecuperar] ${nombreFuncion} — token inválido, vencido o usado | tenant:`, tenantId);
  return res.status(400).json({ error: MENSAJE_TOKEN_INVALIDO, codigo: CODIGO_TOKEN_INVALIDO });
};

/**
 * solicitarRecuperacion
 * POST /api/auth/recuperar/solicitar — manda el link de recuperación al mail del dueño.
 * - Sin mail del dueño cargado: 200 { enviado: false } (el front dice que no hay mail
 *   y a quién escribir). No se genera nada.
 * - Con mail: genera el token (anula los anteriores sin usar de ese tipo), manda el
 *   mail y responde el mail enmascarado. Si ya se mandó uno hace menos de 2 minutos,
 *   responde lo mismo sin generar ni mandar nada (freno anti-spam).
 * El envío es best-effort como el resto del mailer: si Resend falla, el error llega a
 * Sentry (console.error de enviarMail) y la respuesta es la misma (decidido con el
 * usuario el 2026-11-13).
 *
 * @param {Request}  req - body: { tipo: 'operativo' | 'pin_admin' }; tenant_id de tenantMiddleware.
 * @param {Response} res - 200 { enviado: false } | 200 { enviado: true, email } | 400 | 404 | 500.
 */
export async function solicitarRecuperacion(req, res) {
  const { tipo } = req.body ?? {};
  const tenantId = req.tenant_id;

  if (!TIPOS_RECUPERACION.includes(tipo)) {
    return res.status(400).json({ error: 'tipo debe ser operativo o pin_admin' });
  }

  try {
    const resultado = await query(
      `SELECT nombre_negocio, email_duenio, operativo_usuario
       FROM tenant WHERE id = $1 AND activo = true`,
      [tenantId]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    const { nombre_negocio, email_duenio, operativo_usuario } = resultado.rows[0];

    if (!email_duenio) {
      console.warn('[authRecuperar] solicitarRecuperacion — el tenant no tiene mail del dueño | tenant:', tenantId, '| tipo:', tipo);
      return res.json({ enviado: false });
    }

    const email = enmascararEmail(email_duenio);
    const token = generarToken();
    const creado = await emitirToken(tenantId, tipo, hashToken(token));

    if (!creado) {
      console.warn('[authRecuperar] solicitarRecuperacion — frenado: ya se mandó un link hace menos de 2 minutos | tenant:', tenantId, '| tipo:', tipo);
      return res.json({ enviado: true, email });
    }

    await enviarRecuperacion({
      tipo,
      destino: email_duenio,
      destinoEnmascarado: email,
      link: armarLinkRecuperacion(req, token),
      nombreNegocio: nombre_negocio,
      usuarioOperativo: operativo_usuario,
    });

    console.log('[authRecuperar] solicitarRecuperacion completado | tenant:', tenantId, '| tipo:', tipo);
    return res.json({ enviado: true, email });
  } catch (err) {
    console.error('[authRecuperar] Error en solicitarRecuperacion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * validarRecuperacion
 * POST /api/auth/recuperar/validar — dice si el token del link sirve, sin consumirlo,
 * para que el front muestre la pantalla que corresponde.
 *
 * @param {Request}  req - body: { token }; tenant_id de tenantMiddleware.
 * @param {Response} res - 200 { tipo } | 400 { error, codigo: 'token_invalido' } | 500.
 */
export async function validarRecuperacion(req, res) {
  const { token } = req.body ?? {};
  const tenantId = req.tenant_id;

  if (!esFormatoToken(token)) {
    return rechazarToken(res, 'validarRecuperacion', tenantId);
  }

  try {
    const tipo = await leerTipoTokenVigente(tenantId, hashToken(token));
    if (!tipo) {
      return rechazarToken(res, 'validarRecuperacion', tenantId);
    }
    return res.json({ tipo });
  } catch (err) {
    console.error('[authRecuperar] Error en validarRecuperacion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * usarRecuperacion
 * POST /api/auth/recuperar/usar — cambia la credencial del tipo del token y lo consume.
 * 1. Lee el token sin consumirlo (para saber el tipo y validar `nueva` con sus reglas).
 * 2. Valida `nueva`: si no cumple, responde sin consumir el token (el dueño corrige y
 *    vuelve a probar con el mismo link).
 * 3. Consume el token y cambia la credencial con su token_version + 1 en una sola
 *    sentencia (usarToken). Si otro request lo usó en el medio, 400 genérico.
 * 4. Invalida el caché del tenant: authMiddleware lee el token_version de ahí, y así
 *    las otras sesiones de ese rol quedan cerradas al instante (mismo patrón que
 *    adminOperativo y cambiarPinAdmin).
 *
 * @param {Request}  req - body: { token, nueva }; tenant_id de tenantMiddleware.
 *   'operativo': nueva = contraseña con las reglas de la operativa (8+ caracteres).
 *   'pin_admin': nueva = 4 dígitos que no choquen con el PIN de un barbero (puede
 *                ser el mismo PIN que tenía el admin).
 * @param {Response} res - 200 { ok: true } | 400 { error, codigo: 'token_invalido' } (token)
 *   | 400 { error } (`nueva` no cumple) | 409 { error } (PIN en uso) | 500.
 */
export async function usarRecuperacion(req, res) {
  const { token, nueva } = req.body ?? {};
  const tenantId = req.tenant_id;

  if (!esFormatoToken(token)) {
    return rechazarToken(res, 'usarRecuperacion', tenantId);
  }

  try {
    const tokenHash = hashToken(token);
    const tipo = await leerTipoTokenVigente(tenantId, tokenHash);
    if (!tipo) {
      return rechazarToken(res, 'usarRecuperacion', tenantId);
    }

    let hashNuevo;
    if (tipo === 'operativo') {
      if (!esPasswordOperativaValida(nueva)) {
        return res.status(400).json({ error: `La contraseña tiene que tener al menos ${PASSWORD_MIN_CARACTERES} caracteres` });
      }
      hashNuevo = await hashearPasswordOperativa(nueva);
    } else {
      if (!esPinValido(nueva)) {
        return res.status(400).json({ error: 'El PIN tiene que tener 4 números' });
      }
      // Unicidad: el PIN del admin no puede chocar con el de un barbero (si chocara,
      // ese barbero entraría como admin). Contra el PIN actual del admin no se
      // compara: quien lo olvidó puede volver a elegir el mismo, como con la
      // contraseña del iPad (decidido con el usuario el 2026-11-13).
      if (await pinColisiona(nueva, { tenantId, incluirAdmin: false })) {
        return res.status(409).json({ error: 'Ese PIN ya lo usa un barbero del local. Elegí otro.' });
      }
      hashNuevo = await hashearPin(nueva);
    }

    const cambiado = await usarToken(tenantId, tokenHash, tipo, hashNuevo);
    if (!cambiado) {
      return rechazarToken(res, 'usarRecuperacion', tenantId);
    }

    invalidar(req.headers['x-tenant-subdomain']);

    console.log('[authRecuperar] usarRecuperacion completado | tenant:', tenantId, '| tipo:', tipo);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[authRecuperar] Error en usarRecuperacion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
