// /backend/src/controllers/descansos.js
// Controller del backoffice para crear descansos (/api/admin/descansos).
// Thin wrapper con scoping por rol; la lógica vive en descansosService.
// Liberar un descanso es DELETE /api/admin/suspensiones/:id (controllers/suspensiones.js).
// Plan: plan_app_barbero.md → Feature 1 → 2.5.

import { crearDescanso } from '../services/descansosService.js';
import { barberoActivoEnTenant } from '../services/barberosService.js';
import { parsearInstante } from '../utils/validarFecha.js';

/**
 * POST /api/admin/descansos
 * Crea un descanso sobre slots libres y futuros de un día. Si rol=barbero, es
 * siempre propio (ignora barbero_id del body); si rol=admin, barbero_id es
 * obligatorio y tiene que ser un barbero activo del tenant.
 * @param {Object} req.body - { desde, hasta, barbero_id? (solo admin) };
 *   desde/hasta: 'YYYY-MM-DDTHH:MM' en hora argentina, o ISO con 'Z' u offset (parsearInstante)
 * @returns {JSON} 201 { descanso } | 400 rango inválido, desalineado o no futuro |
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

  try {
    // El barbero_id del admin llega del body: tiene que ser un barbero activo del
    // tenant. El del barbero viene del token.
    if (!esBarbero && !(await barberoActivoEnTenant(barberoId, req.tenant_id))) {
      console.warn('[descansos] postDescanso — barbero no pertenece al tenant o inactivo | barbero_id:', barberoId);
      return res.status(404).json({ error: 'Barbero no encontrado o inactivo' });
    }

    const descanso = await crearDescanso({ tenantId: req.tenant_id, barberoId, desde, hasta, origen });
    console.log('[descansos] postDescanso completado | suspension_id:', descanso.id, '| barbero_id:', barberoId, '| origen:', origen);
    return res.status(201).json({ descanso });
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
};
