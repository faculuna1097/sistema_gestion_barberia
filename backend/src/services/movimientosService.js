// /backend/src/services/movimientosService.js
// Borrado de gastos y ventas. Lo comparten sus propios controllers (gastos.js y
// ventas.js) y caja.eliminarMovimiento, cada uno con sus respuestas: acá viven las
// escrituras, para que un arreglo no tenga que hacerse dos veces.

import { query } from '../config/db.js';
import { aplicarMutacionesStock } from '../utils/stock.js';

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
