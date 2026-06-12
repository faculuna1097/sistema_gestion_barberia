// /backend/src/controllers/suspensiones.js
// Controller del backoffice para suspensiones de barberos.
// Thin wrapper con scoping por rol. Cobertura: plan_turnero_v2.md sección 5.

import { listarSuspensiones, crearSuspension, eliminarSuspension } from '../services/suspensionesService.js';
import { armarLinkTurnero } from '../services/turnosService.js';

/**
 * GET /api/admin/suspensiones?barbero_id=X
 * Si rol=barbero, devuelve solo las propias (ignora barbero_id del query).
 * @returns {JSON} array de suspensiones futuras
 */
export const getSuspensiones = async (req, res) => {
  try {
    let barberoId;
    if (req.rol === 'barbero') {
      barberoId = req.barbero_id;
    } else if (req.query.barbero_id) {
      barberoId = req.query.barbero_id;
    }

    const suspensiones = await listarSuspensiones(req.tenant_id, barberoId);
    res.json(suspensiones);
  } catch (err) {
    console.error('[suspensiones] Error en getSuspensiones:', err);
    res.status(500).json({ error: 'Error al listar suspensiones' });
  }
};

/**
 * POST /api/admin/suspensiones
 * Crea suspensión. Si pisa turnos reservados y no viene confirmar_cancelacion,
 * devuelve 409 con la lista de turnos afectados. Reenviar con
 * confirmar_cancelacion: true para ejecutar.
 * @param {Object} req.body - { barbero_id, desde, hasta, motivo?, confirmar_cancelacion? }
 * @returns {JSON} 201 { suspension, turnos_cancelados } o 409 { turnos_afectados }
 */
export const postSuspension = async (req, res) => {
  const { desde, hasta, motivo, confirmar_cancelacion } = req.body;

  // barbero_id: si es barbero, forzar el propio
  const barberoId = req.rol === 'barbero' ? req.barbero_id : req.body.barbero_id;
  const origen = req.rol === 'barbero' ? 'barbero' : 'admin';

  if (!barberoId || !desde || !hasta) {
    return res.status(400).json({ error: 'barbero_id, desde y hasta son requeridos' });
  }
  if (new Date(hasta) <= new Date(desde)) {
    return res.status(400).json({ error: 'hasta debe ser posterior a desde' });
  }

  try {
    const linkTurnero = armarLinkTurnero(req);
    const resultado = await crearSuspension({
      tenantId: req.tenant_id,
      barberoId,
      desde,
      hasta,
      motivo,
      origen,
      confirmarCancelacion: confirmar_cancelacion,
      linkTurnero,
    });

    // Si hay turnos afectados sin confirmación, devolver 409
    if (resultado.turnos_afectados) {
      console.log('[suspensiones] postSuspension — turnos afectados sin confirmar:',
        resultado.turnos_afectados.length);
      return res.status(409).json({
        error: 'La suspensión pisa turnos reservados. Reenviar con confirmar_cancelacion: true para cancelarlos.',
        turnos_afectados: resultado.turnos_afectados,
      });
    }

    console.log('[suspensiones] postSuspension completado | suspension_id:', resultado.suspension.id, '| turnos_cancelados:', resultado.turnos_cancelados);
    return res.status(201).json(resultado);
  } catch (err) {
    console.error('[suspensiones] Error en postSuspension:', err);
    res.status(500).json({ error: 'Error al crear suspensión' });
  }
};

/**
 * DELETE /api/admin/suspensiones/:id
 * Elimina la suspensión. No recupera turnos cancelados.
 * Si rol=barbero, solo puede eliminar las propias.
 * @returns {JSON} { ok: true }
 */
export const deleteSuspension = async (req, res) => {
  const barberoId = req.rol === 'barbero' ? req.barbero_id : null;

  try {
    await eliminarSuspension(req.params.id, req.tenant_id, barberoId);
    console.log('[suspensiones] deleteSuspension completado | suspension_id:', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'NO_ENCONTRADA') {
      return res.status(404).json({ error: err.message });
    }
    console.error('[suspensiones] Error en deleteSuspension:', err);
    res.status(500).json({ error: 'Error al eliminar suspensión' });
  }
};
