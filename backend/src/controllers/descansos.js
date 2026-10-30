// /backend/src/controllers/descansos.js
// Controller del backoffice de descansos (/api/admin/descansos): listarlos como
// bloques y crearlos. Thin wrapper con scoping por rol; la lógica vive en
// descansosService.
// Liberar un descanso es DELETE /api/admin/suspensiones/:id (controllers/suspensiones.js).
// Decisiones: docs/decisiones_descansos.md.

import { crearDescanso, listarBloquesDescanso, bloqueDelDescanso } from '../services/descansosService.js';
import { barberoActivoEnTenant } from '../services/barberosService.js';
import { esFechaISO, parsearInstante } from '../utils/validarFecha.js';
import { esUUID, MENSAJE_BARBERO_ID_INVALIDO } from '../utils/validarUuid.js';

/**
 * GET /api/admin/descansos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&barbero_id=X
 * Descansos de un rango de días como bloques: los pegados van unidos en uno solo
 * (regla en descansosService → unirDescansos), con su estado, minutos, antelación
 * y partes. Incluye los liberados antes de empezar (estado 'liberado').
 * Si rol=barbero, son los propios (ignora barbero_id); si rol=admin, barbero_id es
 * opcional (sin él, los de todos).
 * @returns {JSON} 200 Array de bloques (ver listarBloquesDescanso) | 400 fechas o barbero_id
 */
export const getDescansos = async (req, res) => {
  const { desde, hasta } = req.query;
  if (!esFechaISO(desde) || !esFechaISO(hasta)) {
    return res.status(400).json({ error: 'desde y hasta son requeridas y deben ser fechas YYYY-MM-DD válidas' });
  }
  // Formato YYYY-MM-DD: comparar los strings equivale a comparar las fechas.
  if (hasta < desde) {
    return res.status(400).json({ error: 'hasta debe ser igual o posterior a desde' });
  }
  const barberoId = req.rol === 'barbero' ? req.barbero_id : (req.query.barbero_id || undefined);
  if (barberoId && !esUUID(barberoId)) {
    return res.status(400).json({ error: MENSAJE_BARBERO_ID_INVALIDO });
  }

  try {
    const bloques = await listarBloquesDescanso(req.tenant_id, { desde, hasta, barberoId });
    res.json(bloques);
  } catch (err) {
    console.error('[descansos] Error en getDescansos:', err);
    res.status(500).json({ error: 'Error al listar los descansos' });
  }
};

/**
 * POST /api/admin/descansos
 * Crea un descanso sobre slots libres y futuros de un día. Si rol=barbero, es
 * siempre propio (ignora barbero_id del body); si rol=admin, barbero_id es
 * obligatorio y tiene que ser un barbero activo del tenant.
 * Devuelve también el bloque que lo contiene (unido con los descansos pegados),
 * para que el front lo dibuje al instante; null si no se pudo leer (el descanso
 * ya está creado, así que no es un error: el front recarga).
 * @param {Object} req.body - { desde, hasta, barbero_id? (solo admin) };
 *   desde/hasta: 'YYYY-MM-DDTHH:MM' en hora argentina, o ISO con 'Z' u offset (parsearInstante)
 * @returns {JSON} 201 { descanso, bloque } | 400 rango inválido, desalineado o no futuro |
 *   404 barbero | 409 algún slot ocupado
 */
export const postDescanso = async (req, res) => {
  const esBarbero = req.rol === 'barbero';
  const barberoId = esBarbero ? req.barbero_id : req.body.barbero_id;
  const origen = esBarbero ? 'barbero' : 'admin';

  if (!barberoId) {
    return res.status(400).json({ error: 'barbero_id es requerido' });
  }
  const desde = parsearInstante(req.body.desde);
  const hasta = parsearInstante(req.body.hasta);
  if (!desde || !hasta) {
    return res.status(400).json({ error: 'desde y hasta deben ser fecha y hora válidas (YYYY-MM-DDTHH:MM)' });
  }
  if (hasta <= desde) {
    return res.status(400).json({ error: 'hasta debe ser posterior a desde' });
  }

  let descanso;
  try {
    // El barbero_id del admin llega del body: tiene que ser un barbero activo del
    // tenant. El del barbero viene del token.
    if (!esBarbero && !(await barberoActivoEnTenant(barberoId, req.tenant_id))) {
      console.warn('[descansos] postDescanso — barbero no pertenece al tenant o inactivo | barbero_id:', barberoId);
      return res.status(404).json({ error: 'Barbero no encontrado o inactivo' });
    }

    descanso = await crearDescanso({ tenantId: req.tenant_id, barberoId, desde, hasta, origen });
    console.log('[descansos] postDescanso completado | suspension_id:', descanso.id, '| barbero_id:', barberoId, '| origen:', origen);
  } catch (err) {
    if (err.code === 'RANGO_INVALIDO' || err.code === 'NO_FUTURO') {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'OCUPADO') {
      console.warn('[descansos] postDescanso — algún slot del rango ya está ocupado | barbero_id:', barberoId);
      return res.status(409).json({ error: err.message });
    }
    console.error('[descansos] Error en postDescanso:', err);
    return res.status(500).json({ error: 'Error al crear el descanso' });
  }

  // Best-effort: el descanso ya existe; si falla la lectura del bloque, va null.
  let bloque = null;
  try {
    bloque = await bloqueDelDescanso(req.tenant_id, barberoId, desde.toISODate(), descanso.id);
  } catch (err) {
    console.error('[descansos] postDescanso — no se pudo leer el bloque | suspension_id:', descanso.id, err);
  }
  return res.status(201).json({ descanso, bloque });
};
