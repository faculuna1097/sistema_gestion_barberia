// /backend/src/utils/scopingRol.js
// Scoping por rol de los controllers del backoffice (admin y barbero). Un barbero
// opera siempre sobre sí mismo: el id que mande en el query o en el body se ignora y
// se usa el de su token, para que no pueda ver ni tocar lo de otro (escalada
// horizontal). El admin elige el barbero.
//
// horarios.js no lo usa a propósito: ahí pedir lo de otro barbero responde 403 en
// vez de pisar el id.

import { esUUID, MENSAJE_BARBERO_ID_INVALIDO } from './validarUuid.js';

/**
 * barberoSegunRol
 * Resuelve sobre qué barbero opera el request.
 * @param {Object} req - Request de Express, con rol y barbero_id del token.
 * @param {string|null|undefined} idDelAdmin - El id que corresponde si no es un
 *   barbero: el del body, el del query, o null si el service no debe filtrar.
 * @returns {string|null|undefined} req.barbero_id si el rol es barbero; si no, idDelAdmin.
 */
export const barberoSegunRol = (req, idDelAdmin) => (req.rol === 'barbero' ? req.barbero_id : idDelAdmin);

/**
 * filtroBarberoSegunRol
 * Resuelve el barbero_id del query. Para el admin es opcional y, si vino, se valida.
 * Con rol barbero, el del query se ignora.
 * @param {Object} req - Request de Express.
 * @returns {{ barberoId?: string, error?: string }} barberoId (undefined si el admin no
 *   filtró) o error, con el mensaje del 400 de un id mal formado.
 */
export const filtroBarberoSegunRol = (req) => {
  const barberoId = barberoSegunRol(req, req.query.barbero_id || undefined);
  if (barberoId && !esUUID(barberoId)) {
    return { error: MENSAJE_BARBERO_ID_INVALIDO };
  }
  return { barberoId };
};

/**
 * origenSegunRol
 * Quién hace la acción, para guardarlo en la fila (origen, cancelado_por, liberada_por).
 * @param {Object} req - Request de Express.
 * @returns {'barbero'|'admin'}
 */
export const origenSegunRol = (req) => (req.rol === 'barbero' ? 'barbero' : 'admin');
