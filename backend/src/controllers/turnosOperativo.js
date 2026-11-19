// /backend/src/controllers/turnosOperativo.js
// Controller del recurso "turnos" para el flujo operativo (modo iPad).
// Protegido: en index.js la ruta /api/turnos se monta con verificarToken +
// requiereRol('operativo', 'admin'). Expone los turnos reservados del día de un
// barbero para que FlujoCorte permita registrar un corte vinculado al turno, y el
// aviso de turnos sin cobrar (F3) que muestran el iPad y el Inicio del panel.
// Cobertura: decisiones_turnero.md y plan_mejoras_operativas.md §4 (F3).

import { listarTurnosOperativos } from '../services/turnosService.js';
import { listarTurnosSinCobrar } from '../services/turnosSinCobrarService.js';
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

/**
 * getTurnosSinCobrar
 * GET /api/turnos/sin-cobrar — aviso de turnos sin cobrar del local (F3): los
 * 'reservado' de cualquier día cuyo fin pasó hace al menos duracion_slot_minutos
 * + 10 minutos. Con rol operativo y con rol admin devuelve lo mismo (es el aviso
 * del local), y del cliente solo el nombre. Sin log propio: es una lectura que el
 * iPad pide cada 5 minutos, y el log de acceso global ya la registra.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} 200 { turnos: [{ id, barbero_id, barbero_nombre, inicio, fin,
 *   cliente_nombre }], insistencia_minutos, cierre_hoy } (cliente_nombre null en
 *   un turno "Sin datos"; cierre_hoy null si hoy el local no abre o es feriado);
 *   404 { error } si el tenant no existe; 500 { error }.
 */
export const getTurnosSinCobrar = async (req, res) => {
  try {
    const aviso = await listarTurnosSinCobrar(req.tenant_id);
    if (!aviso) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    res.json(aviso);
  } catch (err) {
    console.error('[turnosOperativo] Error en getTurnosSinCobrar:', err);
    res.status(500).json({ error: 'Error al listar los turnos sin cobrar' });
  }
};
