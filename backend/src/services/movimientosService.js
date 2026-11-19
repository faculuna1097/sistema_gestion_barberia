// /backend/src/services/movimientosService.js
// Borrado de gastos, ventas y cortes. Gastos y ventas los comparten sus propios
// controllers (gastos.js y ventas.js) y caja.eliminarMovimiento, cada uno con sus
// respuestas: acá viven las escrituras, para que un arreglo no tenga que hacerse dos
// veces. Los cortes se borran solo desde Caja, pero viven acá con los otros dos.

import { query } from '../config/db.js';
import { aplicarMutacionesStock } from '../utils/stock.js';
import { cancelarEvento } from './googleCalendar.js';

/**
 * eliminarGasto
 * Borra un gasto del tenant.
 * @param {string} gastoId
 * @param {string} tenantId
 * @returns {Promise<boolean>} true si lo borró; false si no existe en el tenant
 */
export const eliminarGasto = async (gastoId, tenantId) => {
  const result = await query(
    'DELETE FROM gasto WHERE id = $1 AND tenant_id = $2',
    [gastoId, tenantId]
  );
  return result.rowCount > 0;
};

/**
 * eliminarVenta
 * Borra una venta del tenant y le devuelve su cantidad al stock del producto.
 *
 * Orden con compensación (auditoría 6.2): restaura el stock PRIMERO y borra la venta
 * DESPUÉS. Si el DELETE falla, revierte el restore (delta conocido): no hace falta
 * reconstruir la fila de venta para compensar. Al revés (borrar y luego restaurar) un
 * fallo dejaría el stock corto sin arreglo.
 *
 * @param {string} ventaId
 * @param {string} tenantId
 * @returns {Promise<boolean>} true si la borró; false si no existe en el tenant
 * @throws relanza el error de la DB, ya con el stock compensado
 */
export const eliminarVenta = async (ventaId, tenantId) => {
  const ventaResult = await query(
    'SELECT producto_id, cantidad FROM venta WHERE id = $1 AND tenant_id = $2',
    [ventaId, tenantId]
  );
  if (ventaResult.rows.length === 0) return false;

  const { producto_id, cantidad } = ventaResult.rows[0];

  const revertirStock = await aplicarMutacionesStock([{ producto_id, delta: cantidad }], tenantId);
  let delRes;
  try {
    delRes = await query('DELETE FROM venta WHERE id = $1 AND tenant_id = $2', [ventaId, tenantId]);
  } catch (err) {
    await revertirStock();
    throw err;
  }

  // Si el DELETE no borró nada, la fila desapareció entre el SELECT y el DELETE
  // (borrado concurrente). El otro borrado ya restauró el stock, así que el restore
  // que acabamos de aplicar sobra: se revierte para no doble-sumar.
  if (delRes.rowCount === 0) {
    await revertirStock();
    console.warn('[movimientosService] eliminarVenta — venta ya no existía al borrar (carrera) | id:', ventaId);
    return false;
  }

  return true;
};

/**
 * devolverTurnoDeCorte
 * Primer paso del borrado de un corte con turno: el turno, que el corte había
 * completado, deja de estarlo. Vuelve a 'reservado' para que se pueda volver a
 * cobrar. Si su horario ya lo tiene otro turno reservado (el EXCLUDE de turno
 * rechaza con 23P01: pasa cuando el turno se cobró antes de hora y el turnero
 * volvió a ofrecer el horario), queda 'cancelado' por el admin: 'completado' sin
 * corte es la inconsistencia que se quiere evitar. Sin mail al cliente.
 *
 * El guard estado = 'completado' nunca toca un turno cancelado o "no asistió".
 * Son escrituras de valor fijo: el reintento de query() es seguro.
 *
 * @param {string} turnoId
 * @param {string} tenantId
 * @returns {Promise<{ estado: 'reservado'|'cancelado', googleEventId: string|null }|null>}
 *   el estado en que quedó el turno; null si no se tocó (no existe en el tenant o
 *   no estaba completado)
 */
const devolverTurnoDeCorte = async (turnoId, tenantId) => {
  try {
    const result = await query(
      `UPDATE turno SET estado = 'reservado'
       WHERE id = $1 AND tenant_id = $2 AND estado = 'completado'`,
      [turnoId, tenantId]
    );
    return result.rowCount > 0 ? { estado: 'reservado', googleEventId: null } : null;
  } catch (err) {
    if (err.code !== '23P01') throw err;
  }

  // El rechazo del EXCLUDE es un caso esperado, no una falla.
  console.warn('[movimientosService] eliminarCorte — el horario del turno ya está reservado por otro: se cancela | turno_id:', turnoId);
  const result = await query(
    `UPDATE turno
       SET estado = 'cancelado', cancelado_en = now(), cancelado_por = 'admin'
     WHERE id = $1 AND tenant_id = $2 AND estado = 'completado'
     RETURNING google_event_id`,
    [turnoId, tenantId]
  );
  if (result.rowCount === 0) return null;
  return { estado: 'cancelado', googleEventId: result.rows[0].google_event_id };
};

/**
 * restaurarTurnoDeCorte
 * Compensación de devolverTurnoDeCorte cuando el DELETE del corte falla: el
 * turno vuelve a 'completado'. El guard por el estado que se le había puesto
 * evita pisar un cambio que haya pasado en el medio. Best-effort: si falla, se
 * loguea y el error que se relanza es el del DELETE.
 * @param {string} turnoId
 * @param {string} tenantId
 * @param {'reservado'|'cancelado'} estadoPuesto - el estado que le dejó devolverTurnoDeCorte
 * @returns {Promise<void>}
 */
const restaurarTurnoDeCorte = async (turnoId, tenantId, estadoPuesto) => {
  const sql = estadoPuesto === 'reservado'
    ? `UPDATE turno SET estado = 'completado'
       WHERE id = $1 AND tenant_id = $2 AND estado = 'reservado'`
    : `UPDATE turno SET estado = 'completado', cancelado_en = NULL, cancelado_por = NULL
       WHERE id = $1 AND tenant_id = $2 AND estado = 'cancelado' AND cancelado_por = 'admin'`;
  try {
    await query(sql, [turnoId, tenantId]);
  } catch (err) {
    console.error('[movimientosService] eliminarCorte — error compensando el turno (best-effort) | turno_id:', turnoId, '| error:', err);
  }
};

/**
 * eliminarCorte
 * Borra un corte del tenant y deja su turno, si tenía, sin completar
 * (devolverTurnoDeCorte: 'reservado', o 'cancelado' si el horario ya es de otro).
 *
 * Orden con compensación (auditoría 6.2): el turno PRIMERO y el corte DESPUÉS. Si
 * el DELETE falla, el turno vuelve a 'completado' (delta de estado conocido). Al
 * revés, un fallo dejaría un turno completado sin corte, y compensarlo exigiría
 * reconstruir la fila del corte. Por lo mismo, el evento de Google Calendar de un
 * turno cancelado se borra recién con el corte ya borrado (best-effort): así la
 * compensación no tiene que volver a crearlo.
 *
 * @param {string} corteId
 * @param {string} tenantId
 * @returns {Promise<{ turno: { id: string, estado: 'reservado'|'cancelado' }|null }|null>}
 *   null si el corte no existe en el tenant; `turno` es null si el corte no tenía
 *   turno o el turno no se tocó
 * @throws relanza el error de la DB, ya con el turno compensado
 */
export const eliminarCorte = async (corteId, tenantId) => {
  const corteResult = await query(
    'SELECT turno_id FROM corte WHERE id = $1 AND tenant_id = $2',
    [corteId, tenantId]
  );
  if (corteResult.rows.length === 0) return null;
  const { turno_id: turnoId } = corteResult.rows[0];

  let cambioTurno = null;
  if (turnoId) {
    cambioTurno = await devolverTurnoDeCorte(turnoId, tenantId);
    if (cambioTurno) {
      console.log('[movimientosService] eliminarCorte — turno actualizado | turno_id:', turnoId, '| estado:', cambioTurno.estado);
    } else {
      console.warn('[movimientosService] eliminarCorte — turno no tocado (no existe, otro tenant, o no estaba completado) | turno_id:', turnoId);
    }
  }

  let delRes;
  try {
    delRes = await query('DELETE FROM corte WHERE id = $1 AND tenant_id = $2', [corteId, tenantId]);
  } catch (err) {
    if (cambioTurno) await restaurarTurnoDeCorte(turnoId, tenantId, cambioTurno.estado);
    throw err;
  }
  // Si no borró nada, otro borrado se adelantó entre el SELECT y el DELETE, y ese
  // ya se ocupó del turno (este no pudo tocarlo: ya no estaba completado).
  if (delRes.rowCount === 0) {
    console.warn('[movimientosService] eliminarCorte — corte ya no existía al borrar (carrera) | id:', corteId);
    return null;
  }

  if (cambioTurno?.googleEventId) {
    await cancelarEvento(cambioTurno.googleEventId);
  }

  return { turno: cambioTurno ? { id: turnoId, estado: cambioTurno.estado } : null };
};
