// /backend/src/controllers/horarios.js
// Controller del backoffice para horarios semanales de barberos.
// Thin wrapper con scoping por rol. Cobertura: decisiones_turnero.md.

import { obtenerHorarios, validarNoSolapamiento, reemplazarHorarios } from '../services/horariosService.js';
import { obtenerHorarioCrudo, validarRangoEnHorario } from '../services/horarioAtencionService.js';
import { barberoEnTenant } from '../services/barberosService.js';
import { esUUID } from '../utils/validarUuid.js';
import { esHoraValida } from '../utils/validarFecha.js';
import { cuerpoError422 } from '../utils/errores422.js';

/**
 * GET /api/admin/horarios/:barbero_id
 * Si rol=barbero y barbero_id !== req.barbero_id, devuelve 403. Vale también para
 * un barbero inactivo: el panel precarga los horarios de todos.
 * @returns {JSON} array de bloques horarios | 404 si el barbero no es del tenant o
 *   barbero_id está mal formado
 */
export const getHorarios = async (req, res) => {
  const { barbero_id } = req.params;

  if (req.rol === 'barbero' && barbero_id !== req.barbero_id) {
    return res.status(403).json({ error: 'No podés ver horarios de otro barbero' });
  }

  try {
    if (!(await barberoEnTenant(barbero_id, req.tenant_id))) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }

    const bloques = await obtenerHorarios(barbero_id, req.tenant_id);
    res.json(bloques);
  } catch (err) {
    console.error('[horarios] Error en getHorarios:', err);
    res.status(500).json({ error: 'Error al obtener horarios' });
  }
};

/**
 * PUT /api/admin/horarios/:barbero_id
 * Reemplaza completo el horario semanal. Body: array de bloques
 * { dia_semana, hora_inicio, hora_fin }.
 * Si rol=barbero y barbero_id !== req.barbero_id, devuelve 403.
 * dia_semana es un entero de 0 a 6, y las horas, horas reales ('HH:MM' o 'HH:MM:SS';
 * se guardan como 'HH:MM'). Valida no-solapamiento entre bloques del mismo día antes
 * de persistir.
 * @returns {JSON} array de bloques insertados | 400 si un bloque no es válido | 404 si
 *   el barbero no es del tenant o barbero_id está mal formado | 422 { error, codigo,
 *   limite? } si un bloque cae fuera del horario del negocio
 */
export const putHorarios = async (req, res) => {
  const { barbero_id } = req.params;

  if (req.rol === 'barbero' && barbero_id !== req.barbero_id) {
    return res.status(403).json({ error: 'No podés modificar horarios de otro barbero' });
  }
  if (!esUUID(barbero_id)) {
    return res.status(404).json({ error: 'Barbero no encontrado' });
  }

  const bloques = req.body;
  if (!Array.isArray(bloques)) {
    return res.status(400).json({ error: 'El body debe ser un array de bloques horarios' });
  }

  // Validar estructura de cada bloque
  const bloquesNorm = [];
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    if (b?.dia_semana === undefined || b.dia_semana === null || !b.hora_inicio || !b.hora_fin) {
      return res.status(400).json({
        error: `Bloque ${i}: dia_semana, hora_inicio y hora_fin son requeridos`,
      });
    }
    if (!Number.isInteger(b.dia_semana) || b.dia_semana < 0 || b.dia_semana > 6) {
      return res.status(400).json({ error: `Bloque ${i}: dia_semana debe estar entre 0 y 6` });
    }
    if (!esHoraValida(b.hora_inicio) || !esHoraValida(b.hora_fin)) {
      return res.status(400).json({ error: `Bloque ${i}: hora_inicio y hora_fin deben ser horas válidas con formato HH:MM` });
    }

    // Normalizamos a 'HH:MM' para comparar de forma consistente.
    const horaInicio = b.hora_inicio.slice(0, 5);
    const horaFin = b.hora_fin.slice(0, 5);
    if (horaFin <= horaInicio) {
      return res.status(400).json({ error: `Bloque ${i}: hora_fin debe ser mayor a hora_inicio` });
    }
    bloquesNorm.push({ dia_semana: b.dia_semana, hora_inicio: horaInicio, hora_fin: horaFin });
  }

  // Validar no-solapamiento
  const validacion = validarNoSolapamiento(bloquesNorm);
  if (!validacion.valido) {
    return res.status(400).json({ error: validacion.error });
  }

  try {
    // barbero_horario tiene FK simple: sin este chequeo, un barbero de otro tenant
    // pasaría el FK y dejaría una fila cruzada, y uno inexistente daría 500.
    if (!(await barberoEnTenant(barbero_id, req.tenant_id))) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }

    // Validar que cada bloque caiga dentro del horario de atención del tenant.
    // Una sola query del horario; validación pura por bloque.
    const horarioTenant = await obtenerHorarioCrudo(req.tenant_id);
    for (let i = 0; i < bloquesNorm.length; i++) {
      const b = bloquesNorm[i];
      const val = validarRangoEnHorario(horarioTenant, b.dia_semana, b.hora_inicio, b.hora_fin);
      if (!val.valido) {
        console.warn('[horarios] putHorarios — bloque', i,
          'fuera del horario del negocio | codigo:', val.codigo);
        return res.status(422).json(cuerpoError422(val));
      }
    }

    const insertados = await reemplazarHorarios(barbero_id, req.tenant_id, bloquesNorm);
    console.log('[horarios] putHorarios completado | bloques_insertados:', insertados.length);
    res.json(insertados);
  } catch (err) {
    console.error('[horarios] Error en putHorarios:', err);
    res.status(500).json({ error: 'Error al actualizar horarios' });
  }
};
