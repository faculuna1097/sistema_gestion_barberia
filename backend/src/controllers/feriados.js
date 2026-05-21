// /backend/src/controllers/feriados.js
// Controller del backoffice para los feriados puntuales del tenant.
// Thin wrapper: delega la lógica de negocio a feriadosService.js.
// Cobertura: plan_horario_atencion.md sección 4.2.

import { DateTime } from 'luxon';
import { TZ } from '../utils/constantes.js';
import {
  obtenerFeriados,
  existeFeriado,
  calcularDeltaFeriado,
  ejecutarCascadaFeriado,
  insertarFeriado,
  eliminarFeriado,
} from '../services/feriadosService.js';
import { armarLinkTurnero } from '../services/turnosService.js';

// Formato esperado de una fecha de feriado: 'YYYY-MM-DD'.
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/feriados
 * Lista los feriados del tenant. Query param opcional ?desde=YYYY-MM-DD
 * (default = hoy en TZ Argentina) para acotar a los futuros.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @param {string} [req.query.desde] - fecha mínima 'YYYY-MM-DD'
 * @returns {JSON} array de feriados [{ id, fecha, descripcion }]
 */
export const getFeriados = async (req, res) => {
  console.log('[feriados] getFeriados — request recibido | tenant:', req.tenant_id);

  const hoy = DateTime.now().setZone(TZ).toISODate();
  const desde = req.query.desde || hoy;
  if (!REGEX_FECHA.test(desde)) {
    return res.status(400).json({ error: 'El parámetro "desde" debe tener formato YYYY-MM-DD' });
  }

  try {
    const feriados = await obtenerFeriados(req.tenant_id, desde);
    console.log('[feriados] getFeriados — completado |', feriados.length, 'feriados');
    res.json(feriados);
  } catch (err) {
    console.error('[feriados] Error en getFeriados:', err.message);
    res.status(500).json({ error: 'Error al obtener los feriados' });
  }
};

/**
 * POST /api/admin/feriados
 * Carga un feriado. Si el día tiene turnos reservados y el body no trae
 * confirmar_cascada=true, responde 409 con el conteo y NO toca nada. La UI
 * confirma y reenvía con confirmar_cascada=true para ejecutar la cascada.
 *
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @param {string} req.body.fecha - fecha del feriado 'YYYY-MM-DD' (hoy o futura)
 * @param {string} [req.body.descripcion] - descripción opcional
 * @param {boolean} [req.body.confirmar_cascada] - autoriza ejecutar la cascada
 * @returns {JSON} 201 { feriado, cascada } | 409 { codigo, delta? } | 400
 */
export const postFeriado = async (req, res) => {
  console.log('[feriados] postFeriado — request recibido | tenant:', req.tenant_id);

  const { fecha, descripcion, confirmar_cascada } = req.body;

  // --- Validación del shape ---
  if (!fecha || !REGEX_FECHA.test(fecha)) {
    return res.status(400).json({ error: 'fecha es requerida y debe tener formato YYYY-MM-DD' });
  }
  const hoy = DateTime.now().setZone(TZ).toISODate();
  if (fecha < hoy) {
    return res.status(400).json({ error: 'No se puede declarar feriado una fecha pasada' });
  }
  // Normalizamos la descripción: '' o sólo espacios → null.
  const descripcionNorm =
    typeof descripcion === 'string' && descripcion.trim() !== ''
      ? descripcion.trim()
      : null;

  try {
    // --- Fecha ya cargada → 409 ---
    if (await existeFeriado(req.tenant_id, fecha)) {
      console.log('[feriados] postFeriado — feriado ya existe | fecha:', fecha);
      return res.status(409).json({ codigo: 'feriado_ya_existe' });
    }

    // --- Calcular el impacto ---
    const delta = await calcularDeltaFeriado(req.tenant_id, fecha);
    const hayImpacto = delta.turnosACancelar.length > 0;

    // --- Si hay turnos y no está confirmado, devolver 409 sin tocar nada ---
    if (hayImpacto && confirmar_cascada !== true) {
      console.log('[feriados] postFeriado — requiere confirmación | turnos:',
        delta.turnosACancelar.length);
      return res.status(409).json({
        codigo: 'requiere_confirmacion',
        delta: { turnos_cancelados: delta.turnosACancelar.length },
      });
    }

    // --- Ejecutar la cascada (si la hay) e insertar el feriado ---
    let cascada = { turnos_cancelados: 0 };
    if (hayImpacto) {
      const linkTurnero = armarLinkTurnero(req);
      cascada = await ejecutarCascadaFeriado(delta.turnosACancelar, linkTurnero, descripcionNorm);
    }
    const feriado = await insertarFeriado(req.tenant_id, fecha, descripcionNorm);

    console.log('[feriados] postFeriado — completado | fecha:', fecha,
      '| turnos cancelados:', cascada.turnos_cancelados);
    res.status(201).json({ feriado, cascada });
  } catch (err) {
    console.error('[feriados] Error en postFeriado:', err.message);
    res.status(500).json({ error: 'Error al cargar el feriado' });
  }
};

/**
 * DELETE /api/admin/feriados/:id
 * Elimina un feriado. No restaura los turnos que la cascada haya cancelado.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @param {string} req.params.id - UUID del feriado
 * @returns {JSON} 200 { ok: true } | 404
 */
export const deleteFeriado = async (req, res) => {
  console.log('[feriados] deleteFeriado — request recibido | feriado:', req.params.id);

  try {
    const eliminado = await eliminarFeriado(req.tenant_id, req.params.id);
    if (!eliminado) {
      return res.status(404).json({ error: 'Feriado no encontrado' });
    }
    console.log('[feriados] deleteFeriado — completado | feriado:', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[feriados] Error en deleteFeriado:', err.message);
    res.status(500).json({ error: 'Error al eliminar el feriado' });
  }
};
