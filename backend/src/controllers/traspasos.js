// /backend/src/controllers/traspasos.js
// Controller del traspaso de turnos entre barberos (/api/admin/traspasos, F2 de
// mejoras operativas). Solo rol barbero (requiereRol en index.js): cada barbero
// opera con el barbero_id de su token, y una solicitud o un turno ajeno da 404.
// Thin wrapper: la lógica vive en traspasosService. Los errores salen como
// { error, codigo, ...extra }; los textos de los motivos los arma la app del barbero.

import {
  listarCandidatos, crearTraspaso, cerrarTraspaso, aceptarTraspaso, listarTraspasos,
  actualizarCalendarDelTraspaso, TraspasoError, errorNoEncontrado,
} from '../services/traspasosService.js';
import { esUUID } from '../utils/validarUuid.js';

/**
 * Responde el error de un handler: un TraspasoError con su status y código (con
 * console.warn si es un 404 o un 409, que son rechazos esperados), y cualquier
 * otro como 500 con console.error (llega a Sentry).
 * @param {Response} res
 * @param {Error} err
 * @param {string} funcion - Nombre del handler, para el log
 * @param {string} mensaje500 - Texto del 500
 * @param {string} [contexto] - Ids para el log del warn (ej. 'traspaso_id: …')
 * @returns {Response}
 */
const responderError = (res, err, funcion, mensaje500, contexto = '') => {
  if (err instanceof TraspasoError) {
    if (err.status !== 400) {
      console.warn(`[traspasos] ${funcion} — ${err.codigo} | ${contexto}`);
    }
    return res.status(err.status).json({ error: err.message, codigo: err.codigo, ...err.extra });
  }
  console.error(`[traspasos] Error en ${funcion}:`, err);
  return res.status(500).json({ error: mensaje500 });
};

/**
 * GET /api/admin/traspasos
 * Los traspasos del barbero del token: los que envió y los que recibió, con el
 * estado efectivo, solo de turnos que todavía no empezaron y, de cada turno, el
 * más nuevo de cada lista. La app lo pide al abrir y en el refresco de la Agenda.
 * @returns {JSON} 200 { enviados: [solicitud], recibidos: [solicitud] }, con
 *   solicitud = { id, estado, motivo, turno_inicio, created_at, respondido_en,
 *   turno: { id, inicio, fin, servicio_nombre, cliente_nombre }, de_barbero: { id, nombre },
 *   a_barbero: { id, nombre } }
 */
export const getTraspasos = async (req, res) => {
  try {
    res.json(await listarTraspasos({ tenantId: req.tenant_id, barberoId: req.barbero_id }));
  } catch (err) {
    responderError(res, err, 'getTraspasos', 'Error al listar los traspasos');
  }
};

/**
 * GET /api/admin/traspasos/candidatos?turno_id=…
 * Barberos a los que se le puede ofrecer el turno: activos, distintos del que
 * pide y con el horario del turno libre.
 * @returns {JSON} 200 [{ barbero_id, nombre }] por nombre | 400 turno_id falta o
 *   no es un UUID | 404 turno_no_encontrado (no existe o no es del barbero) |
 *   409 turno_no_traspasable (con estado)
 */
export const getCandidatos = async (req, res) => {
  const { turno_id: turnoId } = req.query;
  if (!turnoId) {
    return res.status(400).json({ error: 'turno_id es requerido' });
  }
  if (!esUUID(turnoId)) {
    return res.status(400).json({ error: 'turno_id debe ser un UUID válido' });
  }

  try {
    res.json(await listarCandidatos({ tenantId: req.tenant_id, barberoId: req.barbero_id, turnoId }));
  } catch (err) {
    responderError(res, err, 'getCandidatos', 'Error al buscar los barberos disponibles', `turno_id: ${turnoId}`);
  }
};

/**
 * POST /api/admin/traspasos
 * El barbero del token le ofrece uno de sus turnos a otro barbero.
 * @param {Object} req.body - { turno_id, a_barbero_id }
 * @returns {JSON} 201 solicitud (ver getTraspasos) | 400 falta un dato o
 *   mismo_barbero | 404 turno_no_encontrado | barbero_no_encontrado (también con un
 *   id mal formado) | 409 turno_no_traspasable | traspaso_pendiente (con
 *   traspaso_id) | no_es_candidato
 */
export const postTraspaso = async (req, res) => {
  const { turno_id: turnoId, a_barbero_id: aBarberoId } = req.body ?? {};
  if (!turnoId || !aBarberoId) {
    return res.status(400).json({ error: 'turno_id y a_barbero_id son requeridos' });
  }
  const contexto = `turno_id: ${turnoId} | a_barbero_id: ${aBarberoId}`;
  // Ids del body: uno mal formado cuenta como "no existe" (convenciones §2).
  if (!esUUID(turnoId)) return responderError(res, errorNoEncontrado('turno'), 'postTraspaso', '', contexto);
  if (!esUUID(aBarberoId)) return responderError(res, errorNoEncontrado('barbero'), 'postTraspaso', '', contexto);
  if (aBarberoId.toLowerCase() === String(req.barbero_id).toLowerCase()) {
    return res.status(400).json({ error: 'No podés traspasarte un turno a vos mismo', codigo: 'mismo_barbero' });
  }

  try {
    const solicitud = await crearTraspaso({
      tenantId: req.tenant_id, deBarberoId: req.barbero_id, turnoId, aBarberoId,
    });
    console.log('[traspasos] postTraspaso completado | traspaso_id:', solicitud.id, '|', contexto);
    res.status(201).json(solicitud);
  } catch (err) {
    responderError(res, err, 'postTraspaso', 'Error al pedir el traspaso', contexto);
  }
};

/**
 * Arma el handler de POST /api/admin/traspasos/:id/retirar y /rechazar: cierra
 * una solicitud pendiente (A la retira, B la rechaza).
 * @param {'retirado'|'rechazado'} estado - El estado en que queda
 * @param {string} funcion - Nombre del handler, para el log
 * @returns {Function} handler de Express. Responde 200 solicitud (ver
 *   getTraspasos) | 404 traspaso_no_encontrado (no existe, id mal formado o el
 *   barbero no es el que la puede cerrar) | 409 traspaso_ya_respondido (con
 *   estado) | traspaso_vencido (con motivo)
 */
const handlerCerrar = (estado, funcion) => async (req, res) => {
  const traspasoId = req.params.id;
  const contexto = `traspaso_id: ${traspasoId}`;
  if (!esUUID(traspasoId)) return responderError(res, errorNoEncontrado('traspaso'), funcion, '', contexto);

  try {
    const solicitud = await cerrarTraspaso({ tenantId: req.tenant_id, barberoId: req.barbero_id, traspasoId, estado });
    console.log(`[traspasos] ${funcion} completado |`, contexto);
    res.json(solicitud);
  } catch (err) {
    responderError(res, err, funcion, 'Error al actualizar el traspaso', contexto);
  }
};

/** POST /api/admin/traspasos/:id/retirar — solo A (el que lo pidió). Ver handlerCerrar. */
export const retirarTraspaso = handlerCerrar('retirado', 'retirarTraspaso');

/** POST /api/admin/traspasos/:id/rechazar — solo B (el que lo recibió). Ver handlerCerrar. */
export const rechazarTraspaso = handlerCerrar('rechazado', 'rechazarTraspaso');

/**
 * POST /api/admin/traspasos/:id/aceptar — solo B (el que lo recibió).
 * El turno pasa a ser de B. Después, best-effort, se actualiza el evento de Google
 * Calendar: si falla, va a Sentry y el traspaso queda hecho.
 * @returns {JSON} 200 solicitud (ver getTraspasos), con estado 'aceptado' |
 *   404 traspaso_no_encontrado | 409 traspaso_ya_respondido (con estado) |
 *   traspaso_vencido (con motivo; también si B se ocupó entre medio)
 */
export const postAceptarTraspaso = async (req, res) => {
  const traspasoId = req.params.id;
  const contexto = `traspaso_id: ${traspasoId}`;
  if (!esUUID(traspasoId)) {
    return responderError(res, errorNoEncontrado('traspaso'), 'aceptarTraspaso', '', contexto);
  }

  try {
    const solicitud = await aceptarTraspaso({ tenantId: req.tenant_id, barberoId: req.barbero_id, traspasoId });
    console.log('[traspasos] aceptarTraspaso completado |', contexto, '| turno_id:', solicitud.turno.id,
      '| de:', solicitud.de_barbero.id, '| a:', solicitud.a_barbero.id);
    await actualizarCalendarDelTraspaso(req.tenant_id, solicitud.turno.id);
    res.json(solicitud);
  } catch (err) {
    responderError(res, err, 'aceptarTraspaso', 'Error al aceptar el traspaso', contexto);
  }
};
