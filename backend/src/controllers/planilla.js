// /backend/src/controllers/planilla.js
// Controller del backoffice para planilla semanal con scoping por rol.
// Thin wrapper. Cobertura: decisiones_turnero.md.

import { detalleSemanal, resumenSemanal, descansosSemanal } from '../services/planillaService.js';
import { esFechaISO } from '../utils/validarFecha.js';
import { esUUID, MENSAJE_BARBERO_ID_INVALIDO } from '../utils/validarUuid.js';

/**
 * GET /api/admin/planilla?semana=YYYY-MM-DD&barbero_id=X
 * Si rol=barbero, barbero_id del query se ignora y se usa req.barbero_id.
 * @returns {JSON} array de { barbero_id, barbero_nombre, cortes: [...] }
 */
export const getPlanilla = async (req, res) => {
  const { semana } = req.query;
  if (!esFechaISO(semana)) {
    return res.status(400).json({ error: 'semana debe tener formato YYYY-MM-DD' });
  }

  let barberoId;
  if (req.rol === 'barbero') {
    barberoId = req.barbero_id;
  } else if (req.query.barbero_id) {
    if (!esUUID(req.query.barbero_id)) {
      return res.status(400).json({ error: MENSAJE_BARBERO_ID_INVALIDO });
    }
    barberoId = req.query.barbero_id;
  }

  try {
    const resultado = await detalleSemanal({ tenantId: req.tenant_id, semana, barberoId });
    res.json(resultado);
  } catch (err) {
    console.error('[planilla] Error en getPlanilla:', err);
    res.status(500).json({ error: 'Error al obtener planilla' });
  }
};

/**
 * GET /api/admin/planilla/resumen?semana=YYYY-MM-DD&barbero_id=X
 * Misma regla de scoping que getPlanilla.
 * @returns {JSON} { barberos: [...], totales: {...} }
 */
export const getResumen = async (req, res) => {
  const { semana } = req.query;
  if (!esFechaISO(semana)) {
    return res.status(400).json({ error: 'semana debe tener formato YYYY-MM-DD' });
  }

  let barberoId;
  if (req.rol === 'barbero') {
    barberoId = req.barbero_id;
  } else if (req.query.barbero_id) {
    if (!esUUID(req.query.barbero_id)) {
      return res.status(400).json({ error: MENSAJE_BARBERO_ID_INVALIDO });
    }
    barberoId = req.query.barbero_id;
  }

  try {
    const resultado = await resumenSemanal({ tenantId: req.tenant_id, semana, barberoId });
    res.json(resultado);
  } catch (err) {
    console.error('[planilla] Error en getResumen:', err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
};

/**
 * GET /api/admin/planilla/descansos?semana=YYYY-MM-DD&barbero_id=X
 * Registro de descansos de la semana por barbero (decisiones_descansos.md → "Registro del dueño").
 * Misma regla de scoping que getPlanilla: el barbero ve solo el suyo.
 * @returns {JSON} array de { barbero_id, barbero_nombre, cantidad, minutos,
 *   minutos_jornada, porcentaje, bloques: [...] } (ver descansosSemanal)
 */
export const getDescansosSemana = async (req, res) => {
  const { semana } = req.query;
  if (!esFechaISO(semana)) {
    return res.status(400).json({ error: 'semana debe tener formato YYYY-MM-DD' });
  }

  let barberoId;
  if (req.rol === 'barbero') {
    barberoId = req.barbero_id;
  } else if (req.query.barbero_id) {
    if (!esUUID(req.query.barbero_id)) {
      return res.status(400).json({ error: MENSAJE_BARBERO_ID_INVALIDO });
    }
    barberoId = req.query.barbero_id;
  }

  try {
    const resultado = await descansosSemanal({ tenantId: req.tenant_id, semana, barberoId });
    res.json(resultado);
  } catch (err) {
    console.error('[planilla] Error en getDescansosSemana:', err);
    res.status(500).json({ error: 'Error al obtener el registro de descansos' });
  }
};
