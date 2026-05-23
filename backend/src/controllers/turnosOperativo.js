// /backend/src/controllers/turnosOperativo.js
// Controller del recurso "turnos" para el flujo operativo público (modo iPad).
// Sin auth — solo tenantMiddleware. Expone los turnos reservados del día de un
// barbero para que FlujoCorte permita registrar un corte vinculado al turno.
// Cobertura: plan_turnero_v2.md sección 9.4 (pantalla "registrar corte").

import { listarTurnosOperativos } from '../services/turnosService.js';

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * getTurnosOperativos
 * Lista los turnos reservados de un barbero en una fecha puntual.
 * @param {string} req.tenant_id        - Inyectado por tenantMiddleware
 * @param {string} req.query.barbero_id - UUID del barbero (requerido)
 * @param {string} req.query.fecha      - Fecha YYYY-MM-DD (requerida)
 * @returns {JSON} array de { id, inicio, cliente_nombre, servicio_id }
 */
export const getTurnosOperativos = async (req, res) => {
  const { barbero_id, fecha } = req.query;

  if (!barbero_id || !fecha) {
    return res.status(400).json({ error: 'barbero_id y fecha son requeridos' });
  }
  if (!REGEX_FECHA.test(fecha)) {
    return res.status(400).json({ error: 'fecha debe tener formato YYYY-MM-DD' });
  }

  try {
    const turnos = await listarTurnosOperativos({
      tenantId: req.tenant_id,
      barberoId: barbero_id,
      fecha,
    });
    res.json(turnos);
  } catch (err) {
    console.error('[turnosOperativo] Error en getTurnosOperativos:', err);
    res.status(500).json({ error: 'Error al listar turnos del día' });
  }
};
