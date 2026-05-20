// /backend/src/controllers/horarios.js
// Controller del backoffice para horarios semanales de barberos.
// Thin wrapper con scoping por rol. Cobertura: plan_turnero_v2.md sección 5.

import { obtenerHorarios, validarNoSolapamiento, reemplazarHorarios } from '../services/horariosService.js';
import { obtenerHorarioCrudo, validarRangoEnHorario } from '../services/horarioAtencionService.js';

/**
 * GET /api/admin/horarios/:barbero_id
 * Si rol=barbero y barbero_id !== req.barbero_id, devuelve 403.
 * @returns {JSON} array de bloques horarios
 */
export const getHorarios = async (req, res) => {
  const { barbero_id } = req.params;
  console.log('[horarios] getHorarios — request recibido | tenant:', req.tenant_id,
    '| barbero:', barbero_id, '| rol:', req.rol);

  if (req.rol === 'barbero' && barbero_id !== req.barbero_id) {
    return res.status(403).json({ error: 'No podés ver horarios de otro barbero' });
  }

  try {
    const bloques = await obtenerHorarios(barbero_id, req.tenant_id);
    console.log('[horarios] getHorarios — completado |', bloques.length, 'bloques');
    res.json(bloques);
  } catch (err) {
    console.error('[horarios] Error en getHorarios:', err.message);
    res.status(500).json({ error: 'Error al obtener horarios' });
  }
};

/**
 * PUT /api/admin/horarios/:barbero_id
 * Reemplaza completo el horario semanal. Body: array de bloques
 * { dia_semana, hora_inicio, hora_fin }.
 * Si rol=barbero y barbero_id !== req.barbero_id, devuelve 403.
 * Valida no-solapamiento entre bloques del mismo día antes de persistir.
 * @returns {JSON} array de bloques insertados
 */
export const putHorarios = async (req, res) => {
  const { barbero_id } = req.params;
  console.log('[horarios] putHorarios — request recibido | tenant:', req.tenant_id,
    '| barbero:', barbero_id, '| rol:', req.rol);

  if (req.rol === 'barbero' && barbero_id !== req.barbero_id) {
    return res.status(403).json({ error: 'No podés modificar horarios de otro barbero' });
  }

  const bloques = req.body;
  if (!Array.isArray(bloques)) {
    return res.status(400).json({ error: 'El body debe ser un array de bloques horarios' });
  }

  // Validar estructura de cada bloque
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    if (b.dia_semana === undefined || b.dia_semana === null || !b.hora_inicio || !b.hora_fin) {
      return res.status(400).json({
        error: `Bloque ${i}: dia_semana, hora_inicio y hora_fin son requeridos`,
      });
    }
    if (b.dia_semana < 0 || b.dia_semana > 6) {
      return res.status(400).json({ error: `Bloque ${i}: dia_semana debe estar entre 0 y 6` });
    }
    if (b.hora_fin <= b.hora_inicio) {
      return res.status(400).json({ error: `Bloque ${i}: hora_fin debe ser mayor a hora_inicio` });
    }
  }

  // Validar no-solapamiento
  const validacion = validarNoSolapamiento(bloques);
  if (!validacion.valido) {
    return res.status(400).json({ error: validacion.error });
  }

  try {
    // Validar que cada bloque caiga dentro del horario de atención del tenant.
    // Una sola query del horario; validación pura por bloque.
    const horarioTenant = await obtenerHorarioCrudo(req.tenant_id);
    for (let i = 0; i < bloques.length; i++) {
      const b = bloques[i];
      const val = validarRangoEnHorario(
        horarioTenant, b.dia_semana,
        b.hora_inicio.slice(0, 5), b.hora_fin.slice(0, 5),
      );
      if (!val.valido) {
        console.warn('[horarios] putHorarios — bloque', i,
          'fuera del horario del negocio | codigo:', val.codigo);
        return res.status(422).json({
          codigo: val.codigo,
          mensaje: val.mensaje,
          ...(val.limite && { limite: val.limite }),
        });
      }
    }

    const insertados = await reemplazarHorarios(barbero_id, req.tenant_id, bloques);
    console.log('[horarios] putHorarios — completado |', insertados.length, 'bloques insertados');
    res.json(insertados);
  } catch (err) {
    console.error('[horarios] Error en putHorarios:', err.message);
    res.status(500).json({ error: 'Error al actualizar horarios' });
  }
};
