// /backend/src/controllers/alta.js
// Controlador del formulario de alta de clientes (frontend-alta). El cliente nuevo
// entra con un link privado: el token es el `id` (uuid) de su fila en
// solicitud_alta. Sin tenant ni login: estas rutas se montan antes de
// tenantMiddleware y del log de acceso global (ver index.js).
//
// Reglas comunes a los cuatro endpoints:
//   - Un token mal formado, inexistente o vencido (vence_en <= now()) da 404.
//   - Solo se escribe mientras la solicitud está en 'borrador': después, 409.
//   - Los logs llevan la `referencia` de la solicitud, nunca el id (es el token
//     del link) ni datos del cliente.
// Cobertura: plan_alta_clientes.md §5.5.

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { TZ } from '../utils/constantes.js';
import { esUUID } from '../utils/validarUuid.js';
import { esObjetoPlano, validarSolicitudAlta } from '../utils/validarSolicitudAlta.js';
import { motivoFormatoSubdominio, subdominioOcupado } from '../utils/subdominio.js';
import { enviarAvisoSolicitudAlta } from '../services/mail/mailer.js';

const CUERPO_404 = { error: 'Este link no existe o ya venció.', codigo: 'solicitud_no_encontrada' };
const CUERPO_409 = { error: 'Esta solicitud ya fue enviada y no se puede modificar.', codigo: 'solicitud_ya_enviada' };
const CUERPO_DATOS_INVALIDOS = { error: 'Los datos del formulario no tienen el formato esperado.', codigo: 'formato_invalido' };

/**
 * aInstanteTZ
 * Serializa un timestamptz de pg (objeto Date) en hora argentina con offset
 * (convenciones §4: los instantes salen de la API en TZ).
 * @param {Date} fecha
 * @returns {string} ISO con offset, ej. '2026-12-10T14:30:00.000-03:00'.
 */
const aInstanteTZ = (fecha) => DateTime.fromJSDate(fecha, { zone: TZ }).toISO();

/**
 * buscarSolicitudVigente
 * Lee una solicitud que existe y no venció.
 * @param {string} id - Token del link, ya validado con esUUID.
 * @returns {Promise<{estado: string, referencia: string}|null>} La fila, o null si no existe o venció.
 */
const buscarSolicitudVigente = async (id) => {
  const result = await query(
    'SELECT estado, referencia FROM solicitud_alta WHERE id = $1 AND vence_en > now()',
    [id]
  );
  return result.rows[0] ?? null;
};

/**
 * responderSinActualizar
 * Después de un UPDATE condicional que no tocó ninguna fila, lee la solicitud
 * para responder lo que corresponde: 404 si no existe o venció, 409 si ya no
 * está en borrador.
 * @param {Object} res - Response de Express.
 * @param {string} id - Token del link, ya validado.
 * @param {string} nombreFuncion - Para el log del 409.
 * @returns {Promise<Object>} La respuesta enviada.
 */
const responderSinActualizar = async (res, id, nombreFuncion) => {
  const solicitud = await buscarSolicitudVigente(id);
  if (!solicitud) return res.status(404).json(CUERPO_404);
  console.warn(`[alta] ${nombreFuncion} — la solicitud ya no está en borrador | referencia: ${solicitud.referencia} | estado: ${solicitud.estado}`);
  return res.status(409).json(CUERPO_409);
};

/**
 * avisarEnvio
 * Manda el aviso de solicitud enviada (best-effort): nunca lanza. La solicitud ya
 * quedó enviada, así que una falla del mail solo se loguea.
 * @param {Object} solicitud - { id, referencia, nombreNegocio }
 * @returns {Promise<void>}
 */
const avisarEnvio = async (solicitud) => {
  try {
    await enviarAvisoSolicitudAlta(solicitud);
  } catch (err) {
    console.error(`[alta] Error en avisarEnvio | referencia: ${solicitud.referencia}:`, err);
  }
};

/**
 * obtenerSolicitud — GET /api/alta/:token
 * Devuelve la solicitud para que el formulario la muestre o la retome.
 * @param {string} req.params.token - id de la solicitud.
 * @returns {JSON} 200 { estado, datos, vence_en } | 404
 */
export const obtenerSolicitud = async (req, res) => {
  const { token } = req.params;
  if (!esUUID(token)) return res.status(404).json(CUERPO_404);
  try {
    const result = await query(
      'SELECT estado, datos, vence_en FROM solicitud_alta WHERE id = $1 AND vence_en > now()',
      [token]
    );
    if (result.rows.length === 0) return res.status(404).json(CUERPO_404);
    const fila = result.rows[0];
    return res.json({ estado: fila.estado, datos: fila.datos, vence_en: aInstanteTZ(fila.vence_en) });
  } catch (err) {
    console.error('[alta] Error en obtenerSolicitud:', err);
    return res.status(500).json({ error: 'No pudimos cargar tu solicitud. Probá de nuevo en un rato.' });
  }
};

/**
 * guardarBorrador — PUT /api/alta/:token
 * Autoguardado: reemplaza `datos` entero mientras la solicitud está en borrador.
 * Solo valida la forma (un objeto); las reglas completas corren al enviar. El
 * tamaño lo limita express.json (100 kB). No loguea los guardados exitosos: el
 * front guarda cada pocos segundos.
 * @param {string} req.params.token - id de la solicitud.
 * @param {Object} req.body.datos - El formulario completo, tal como está.
 * @returns {JSON} 200 { updated_at } | 400 | 404 | 409
 */
export const guardarBorrador = async (req, res) => {
  const { token } = req.params;
  if (!esUUID(token)) return res.status(404).json(CUERPO_404);
  const { datos } = req.body;
  if (!esObjetoPlano(datos)) return res.status(400).json(CUERPO_DATOS_INVALIDOS);
  try {
    // Una sola sentencia condicional: si entre medio se envió o venció, no escribe.
    const result = await query(
      `UPDATE solicitud_alta
       SET datos = $2::jsonb, updated_at = now()
       WHERE id = $1 AND estado = 'borrador' AND vence_en > now()
       RETURNING updated_at`,
      [token, JSON.stringify(datos)]
    );
    if (result.rows.length === 0) return await responderSinActualizar(res, token, 'guardarBorrador');
    return res.json({ updated_at: aInstanteTZ(result.rows[0].updated_at) });
  } catch (err) {
    console.error('[alta] Error en guardarBorrador:', err);
    return res.status(500).json({ error: 'No pudimos guardar. Probá de nuevo en un rato.' });
  }
};

/**
 * consultarSubdominio — GET /api/alta/:token/subdominio/:valor
 * Dice si un subdominio se puede usar. Exige un token vigente, para que no sirva
 * de enumerador público de los subdominios de los clientes.
 * @param {string} req.params.token - id de la solicitud.
 * @param {string} req.params.valor - Subdominio pedido, ya normalizado por el front.
 * @returns {JSON} 200 { disponible, motivo: null | 'formato' | 'reservado' | 'ocupado' } | 404
 */
export const consultarSubdominio = async (req, res) => {
  const { token, valor } = req.params;
  if (!esUUID(token)) return res.status(404).json(CUERPO_404);
  try {
    const motivoFormato = motivoFormatoSubdominio(valor);
    // La solicitud y el tenant se consultan en paralelo: una sola espera a la DB.
    const [solicitud, ocupado] = await Promise.all([
      buscarSolicitudVigente(token),
      motivoFormato ? false : subdominioOcupado(valor),
    ]);
    if (!solicitud) return res.status(404).json(CUERPO_404);
    const motivo = motivoFormato ?? (ocupado ? 'ocupado' : null);
    return res.json({ disponible: motivo === null, motivo });
  } catch (err) {
    console.error('[alta] Error en consultarSubdominio:', err);
    return res.status(500).json({ error: 'No pudimos revisar el link. Probá de nuevo en un rato.' });
  }
};

/**
 * enviarSolicitud — POST /api/alta/:token/enviar
 * Envío final. El body trae `datos` entero: se valida con todas las reglas
 * (validarSolicitudAlta, incluido el subdominio libre) y lo normalizado se guarda
 * en la misma sentencia que pasa la solicitud a 'enviada'. Así lo validado es
 * exactamente lo que queda guardado. Después manda el aviso por mail
 * (best-effort, ya con la respuesta enviada). Un segundo envío da 409 y no avisa.
 * @param {string} req.params.token - id de la solicitud.
 * @param {Object} req.body.datos - El formulario completo.
 * @returns {JSON} 200 { estado: 'enviada' } | 400 { error, codigo, errores: [{ campo, mensaje }] } | 404 | 409
 */
export const enviarSolicitud = async (req, res) => {
  const { token } = req.params;
  if (!esUUID(token)) return res.status(404).json(CUERPO_404);
  const { datos } = req.body;
  if (!esObjetoPlano(datos)) return res.status(400).json(CUERPO_DATOS_INVALIDOS);

  let solicitud;
  try {
    // Primero el token: sin uno vigente y en borrador no se valida nada (la
    // validación consulta los subdominios de los tenants).
    const vigente = await buscarSolicitudVigente(token);
    if (!vigente) return res.status(404).json(CUERPO_404);
    if (vigente.estado !== 'borrador') {
      console.warn(`[alta] enviarSolicitud — la solicitud ya no está en borrador | referencia: ${vigente.referencia} | estado: ${vigente.estado}`);
      return res.status(409).json(CUERPO_409);
    }

    const { errores, datos: normalizado } = await validarSolicitudAlta(datos);
    if (errores.length > 0) {
      return res.status(400).json({ error: 'Hay datos para revisar.', codigo: 'datos_invalidos', errores });
    }

    const result = await query(
      `UPDATE solicitud_alta
       SET datos = $2::jsonb, estado = 'enviada', enviada_en = now(), updated_at = now()
       WHERE id = $1 AND estado = 'borrador' AND vence_en > now()
       RETURNING referencia`,
      [token, JSON.stringify(normalizado)]
    );
    if (result.rows.length === 0) return await responderSinActualizar(res, token, 'enviarSolicitud');

    solicitud = { id: token, referencia: result.rows[0].referencia, nombreNegocio: normalizado.local.nombre };
    console.log('[alta] enviarSolicitud completada | referencia:', solicitud.referencia);
    res.json({ estado: 'enviada' });
  } catch (err) {
    console.error('[alta] Error en enviarSolicitud:', err);
    return res.status(500).json({ error: 'No pudimos enviar tu solicitud. Probá de nuevo en un rato.' });
  }

  await avisarEnvio(solicitud);
};
