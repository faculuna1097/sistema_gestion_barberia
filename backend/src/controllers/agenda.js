// /backend/src/controllers/agenda.js
// Controller de la Agenda del día de un barbero (/api/admin/agenda): turnos,
// suspensiones/descansos y la grilla de slots en una sola respuesta, para que el
// front haga una llamada en vez de cuatro.
// Plan: plan_app_barbero.md → Feature 1 → 2.6.

import { listarTurnos } from '../services/turnosService.js';
import { listarSuspensiones } from '../services/suspensionesService.js';
import { calcularGrillaDelDia, DisponibilidadError } from '../services/disponibilidadService.js';
import { barberoActivoEnTenant } from '../services/barberosService.js';
import { esFechaISO } from '../utils/validarFecha.js';

/**
 * GET /api/admin/agenda?fecha=YYYY-MM-DD&barbero_id=X
 * Agenda de un día de un barbero. Si rol=barbero, es la propia (ignora
 * barbero_id del query); si rol=admin, barbero_id es obligatorio y tiene que ser
 * un barbero activo del tenant.
 * @returns {JSON} {
 *   fecha, barbero_id, duracion_slot_minutos,
 *   horario_atencion: { hora_inicio, hora_fin } | null — horario del local ese día
 *     ('HH:MM'); null si cierra o es feriado,
 *   turnos: [...] — misma forma que GET /api/admin/turnos?fecha= (todos los estados),
 *   suspensiones: [...] — los dos tipos, con su rango efectivo (ver listarSuspensiones),
 *   grilla: [{ inicio, fin, estado }] — todos los slots de los bloques del barbero,
 *     inicio/fin ISO con offset argentino; estado 'libre' | 'turno' | 'descanso' | 'suspension'
 * }
 */
export const getAgenda = async (req, res) => {
  const { fecha } = req.query;
  const esBarbero = req.rol === 'barbero';
  const barberoId = esBarbero ? req.barbero_id : req.query.barbero_id;

  if (!esFechaISO(fecha)) {
    return res.status(400).json({ error: 'fecha es requerida y debe ser una fecha YYYY-MM-DD válida' });
  }
  if (!barberoId) {
    return res.status(400).json({ error: 'barbero_id es requerido' });
  }

  try {
    // El barbero_id del admin llega del query: se valida antes de las queries en
    // paralelo (un uuid mal formado las rompería). El del barbero viene del token.
    if (!esBarbero && !(await barberoActivoEnTenant(barberoId, req.tenant_id))) {
      return res.status(404).json({ error: 'Barbero no encontrado o inactivo' });
    }

    const [turnos, suspensiones, { grilla, duracionSlotMin, horarioLocal }] = await Promise.all([
      listarTurnos({ tenantId: req.tenant_id, fecha, barberoId }),
      listarSuspensiones(req.tenant_id, { barberoId, desde: fecha, hasta: fecha }),
      calcularGrillaDelDia({ tenantId: req.tenant_id, barberoId, fecha }),
    ]);

    res.json({
      fecha,
      barbero_id: barberoId,
      duracion_slot_minutos: duracionSlotMin,
      horario_atencion: horarioLocal,
      turnos,
      suspensiones,
      // Los instantes de la grilla se serializan recién acá, con offset argentino.
      grilla: grilla.map(s => ({ inicio: s.inicio.toISO(), fin: s.fin.toISO(), estado: s.estado })),
    });
  } catch (err) {
    if (err instanceof DisponibilidadError) {
      console.warn('[agenda] getAgenda — error de dominio:', err.codigo);
      return res.status(err.codigo === 'fecha_invalida' ? 400 : 404).json({ error: err.message });
    }
    console.error('[agenda] Error en getAgenda:', err);
    res.status(500).json({ error: 'Error al obtener la agenda' });
  }
};
