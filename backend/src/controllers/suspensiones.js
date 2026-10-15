// /backend/src/controllers/suspensiones.js
// Controller del backoffice para suspensiones de barberos.
// Thin wrapper con scoping por rol. Cobertura: plan_turnero_v2.md sección 5.

import { listarSuspensiones, crearSuspension, liberarSuspension } from '../services/suspensionesService.js';
import { armarLinkTurnero } from '../services/turnosService.js';
import { esFechaISO } from '../utils/validarFecha.js';
import { TIPOS_SUSPENSION } from '../utils/constantes.js';

/**
 * GET /api/admin/suspensiones?barbero_id=X&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&tipo=suspension|descanso
 * Todos los parámetros son opcionales. Sin desde/hasta, las que todavía no
 * terminaron (comportamiento original). Si rol=barbero, devuelve solo las propias
 * (ignora barbero_id del query).
 * @returns {JSON} array de suspensiones con su rango efectivo (ver listarSuspensiones)
 */
export const getSuspensiones = async (req, res) => {
  const { desde, hasta, tipo } = req.query;
  if (desde !== undefined && !esFechaISO(desde)) {
    return res.status(400).json({ error: 'desde debe ser una fecha YYYY-MM-DD válida' });
  }
  if (hasta !== undefined && !esFechaISO(hasta)) {
    return res.status(400).json({ error: 'hasta debe ser una fecha YYYY-MM-DD válida' });
  }
  // Formato YYYY-MM-DD: comparar los strings equivale a comparar las fechas.
  if (desde && hasta && hasta < desde) {
    return res.status(400).json({ error: 'hasta debe ser igual o posterior a desde' });
  }
  if (tipo !== undefined && !TIPOS_SUSPENSION.includes(tipo)) {
    return res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS_SUSPENSION.join(', ')}` });
  }

  try {
    let barberoId;
    if (req.rol === 'barbero') {
      barberoId = req.barbero_id;
    } else if (req.query.barbero_id) {
      barberoId = req.query.barbero_id;
    }

    const suspensiones = await listarSuspensiones(req.tenant_id, { barberoId, desde, hasta, tipo });
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
 * Libera la suspensión (no la borra): completa liberada_en/liberada_por. Si está
 * en curso, termina en este momento. No recupera turnos cancelados.
 * Path y verbo se mantienen por compatibilidad con los dos fronts; el renombre a
 * POST .../:id/liberar está anotado en plan_app_barbero.md.
 * Si rol=barbero, solo puede liberar las propias, y no las cargadas por el admin.
 * @returns {JSON} 200 { ok: true, suspension } | 403 origen admin | 404 | 409 ya liberada o terminada
 */
export const deleteSuspension = async (req, res) => {
  const barberoId = req.rol === 'barbero' ? req.barbero_id : null;
  const rol = req.rol === 'barbero' ? 'barbero' : 'admin';

  try {
    const suspension = await liberarSuspension(req.params.id, req.tenant_id, rol, barberoId);
    console.log('[suspensiones] deleteSuspension — suspensión liberada | suspension_id:', req.params.id, '| por:', rol);
    res.json({ ok: true, suspension });
  } catch (err) {
    if (err.code === 'NO_ENCONTRADA') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'ORIGEN_ADMIN') {
      console.warn('[suspensiones] deleteSuspension — barbero intentó liberar una suspensión del admin | suspension_id:', req.params.id);
      return res.status(403).json({ error: err.message });
    }
    if (err.code === 'YA_LIBERADA' || err.code === 'YA_TERMINADA') {
      return res.status(409).json({ error: err.message });
    }
    console.error('[suspensiones] Error en deleteSuspension:', err);
    res.status(500).json({ error: 'Error al liberar la suspensión' });
  }
};
