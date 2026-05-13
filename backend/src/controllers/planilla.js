// /backend/src/controllers/planilla.js
// Controller del backoffice para planilla semanal con scoping por rol.
// Thin wrapper. Cobertura: plan_turnero_v2.md sección 5 (/api/admin/planilla).

import { detalleSemanal, resumenSemanal } from '../services/planillaService.js';

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/planilla?semana=YYYY-MM-DD&barbero_id=X
 * Si rol=barbero, barbero_id del query se ignora y se usa req.barbero_id.
 * @returns {JSON} array de { barbero_id, barbero_nombre, cortes: [...] }
 */
export const getPlanilla = async (req, res) => {
  console.log('[planilla] getPlanilla — request recibido | tenant:', req.tenant_id,
    '| semana:', req.query.semana, '| rol:', req.rol);

  const { semana } = req.query;
  if (!semana || !REGEX_FECHA.test(semana)) {
    return res.status(400).json({ error: 'semana debe tener formato YYYY-MM-DD' });
  }

  let barberoId;
  if (req.rol === 'barbero') {
    barberoId = req.barbero_id;
  } else if (req.query.barbero_id) {
    barberoId = req.query.barbero_id;
  }

  try {
    const resultado = await detalleSemanal({ tenantId: req.tenant_id, semana, barberoId });
    console.log('[planilla] getPlanilla — completado |', resultado.length, 'barberos');
    res.json(resultado);
  } catch (err) {
    console.error('[planilla] Error en getPlanilla:', err.message);
    res.status(500).json({ error: 'Error al obtener planilla' });
  }
};

/**
 * GET /api/admin/planilla/resumen?semana=YYYY-MM-DD&barbero_id=X
 * Misma regla de scoping que getPlanilla.
 * @returns {JSON} { barberos: [...], totales: {...} }
 */
export const getResumen = async (req, res) => {
  console.log('[planilla] getResumen — request recibido | tenant:', req.tenant_id,
    '| semana:', req.query.semana, '| rol:', req.rol);

  const { semana } = req.query;
  if (!semana || !REGEX_FECHA.test(semana)) {
    return res.status(400).json({ error: 'semana debe tener formato YYYY-MM-DD' });
  }

  let barberoId;
  if (req.rol === 'barbero') {
    barberoId = req.barbero_id;
  } else if (req.query.barbero_id) {
    barberoId = req.query.barbero_id;
  }

  try {
    const resultado = await resumenSemanal({ tenantId: req.tenant_id, semana, barberoId });
    console.log('[planilla] getResumen — completado |', resultado.barberos.length, 'barberos');
    res.json(resultado);
  } catch (err) {
    console.error('[planilla] Error en getResumen:', err.message);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
};
