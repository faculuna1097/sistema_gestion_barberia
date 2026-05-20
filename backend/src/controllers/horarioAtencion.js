// /backend/src/controllers/horarioAtencion.js
// Controller del backoffice para el horario semanal de atención del tenant.
// Thin wrapper: delega la lógica de negocio a horarioAtencionService.js.
// Cobertura: plan_horario_atencion.md sección 3.3.

import {
  obtenerHorarioCompleto,
  calcularDelta,
  ejecutarCascada,
  reemplazarHorario,
} from '../services/horarioAtencionService.js';
import { armarLinkTurnero } from '../services/turnosService.js';

/**
 * GET /api/admin/horario-atencion
 * Devuelve el horario semanal del tenant como array de 7 días.
 * Los días cerrados salen como { dia_semana, abierto: false }.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} array de 7 objetos día
 */
export const getHorarioAtencion = async (req, res) => {
  console.log('[horarioAtencion] getHorarioAtencion — request recibido | tenant:', req.tenant_id);

  try {
    const semana = await obtenerHorarioCompleto(req.tenant_id);
    console.log('[horarioAtencion] getHorarioAtencion — completado |',
      semana.filter((d) => d.abierto).length, 'días abiertos');
    res.json(semana);
  } catch (err) {
    console.error('[horarioAtencion] Error en getHorarioAtencion:', err.message);
    res.status(500).json({ error: 'Error al obtener el horario de atención' });
  }
};

/**
 * PUT /api/admin/horario-atencion
 * Reemplaza el horario semanal completo (PUT total, no PATCH).
 *
 * Si el cambio achica el horario y deja bloques de barbero o turnos
 * reservados afuera, y el body no trae confirmar_cascada=true, responde
 * 409 con el delta y NO toca nada. La UI confirma y reenvía con
 * confirmar_cascada=true para ejecutar la cascada.
 *
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @param {Array}  req.body.horarios - días abiertos [{ dia_semana, hora_inicio, hora_fin }]
 * @param {boolean} [req.body.confirmar_cascada] - autoriza ejecutar la cascada
 * @returns {JSON} 200 { horarios, cascada } | 409 { codigo, delta } | 400
 */
export const putHorarioAtencion = async (req, res) => {
  console.log('[horarioAtencion] putHorarioAtencion — request recibido | tenant:', req.tenant_id);

  const { horarios, confirmar_cascada } = req.body;

  // --- Validación del shape ---
  if (!Array.isArray(horarios)) {
    return res.status(400).json({ error: 'El body debe incluir un array "horarios"' });
  }

  const diasVistos = new Set();
  const horariosNorm = [];
  for (let i = 0; i < horarios.length; i++) {
    const h = horarios[i];
    if (h.dia_semana === undefined || h.dia_semana === null || !h.hora_inicio || !h.hora_fin) {
      return res.status(400).json({ error: `Día ${i}: dia_semana, hora_inicio y hora_fin son requeridos` });
    }
    if (!Number.isInteger(h.dia_semana) || h.dia_semana < 0 || h.dia_semana > 6) {
      return res.status(400).json({ error: `Día ${i}: dia_semana debe ser un entero entre 0 y 6` });
    }
    if (diasVistos.has(h.dia_semana)) {
      return res.status(400).json({ error: `dia_semana ${h.dia_semana} aparece más de una vez` });
    }
    diasVistos.add(h.dia_semana);

    // Normalizamos a 'HH:MM' para comparar de forma consistente.
    const horaInicio = h.hora_inicio.slice(0, 5);
    const horaFin = h.hora_fin.slice(0, 5);
    if (horaFin <= horaInicio) {
      return res.status(400).json({ error: `Día ${h.dia_semana}: hora_fin debe ser mayor a hora_inicio` });
    }
    horariosNorm.push({ dia_semana: h.dia_semana, hora_inicio: horaInicio, hora_fin: horaFin });
  }

  try {
    // --- Calcular el impacto del cambio ---
    const delta = await calcularDelta(req.tenant_id, horariosNorm);
    const hayImpacto =
      delta.bloquesAEliminar.length > 0 ||
      delta.bloquesATruncar.length > 0 ||
      delta.turnosACancelar.length > 0;

    // --- Si hay impacto y no está confirmado, devolver 409 sin tocar nada ---
    if (hayImpacto && confirmar_cascada !== true) {
      console.log('[horarioAtencion] putHorarioAtencion — requiere confirmación |',
        'bloques:', delta.bloquesAEliminar.length + delta.bloquesATruncar.length,
        '| turnos:', delta.turnosACancelar.length);
      return res.status(409).json({
        codigo: 'requiere_confirmacion',
        delta: {
          bloques_truncados: delta.bloquesATruncar.length,
          bloques_eliminados: delta.bloquesAEliminar.length,
          turnos_cancelados: delta.turnosACancelar.length,
        },
      });
    }

    // --- Ejecutar la cascada (si la hay) y reemplazar el horario ---
    let cascada = { bloques_truncados: 0, bloques_eliminados: 0, turnos_cancelados: 0 };
    if (hayImpacto) {
      const linkTurnero = armarLinkTurnero(req);
      cascada = await ejecutarCascada(delta, linkTurnero);
    }
    await reemplazarHorario(req.tenant_id, horariosNorm);

    const semana = await obtenerHorarioCompleto(req.tenant_id);
    console.log('[horarioAtencion] putHorarioAtencion — completado |',
      'turnos cancelados:', cascada.turnos_cancelados,
      '| bloques eliminados:', cascada.bloques_eliminados,
      '| bloques truncados:', cascada.bloques_truncados);
    res.json({ horarios: semana, cascada });
  } catch (err) {
    console.error('[horarioAtencion] Error en putHorarioAtencion:', err.message);
    res.status(500).json({ error: 'Error al actualizar el horario de atención' });
  }
};
