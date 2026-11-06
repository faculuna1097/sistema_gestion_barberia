// /backend/src/controllers/turnosOperativo.js
// Controller del recurso "turnos" para el flujo operativo (modo iPad).
// Protegido: en index.js la ruta /api/turnos se monta con verificarToken +
// requiereRol('operativo', 'admin'). Expone los turnos reservados del día de un
// barbero para que FlujoCorte permita registrar un corte vinculado al turno.
// Cobertura: decisiones_turnero.md.

import { listarTurnosOperativos } from '../services/turnosService.js';
import { esFechaISO } from '../utils/validarFecha.js';
import { esUUID, MENSAJE_BARBERO_ID_INVALIDO } from '../utils/validarUuid.js';

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
  if (!esFechaISO(fecha)) {
    return res.status(400).json({ error: 'fecha debe tener formato YYYY-MM-DD' });
  }
  if (!esUUID(barbero_id)) {
    return res.status(400).json({ error: MENSAJE_BARBERO_ID_INVALIDO });
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
