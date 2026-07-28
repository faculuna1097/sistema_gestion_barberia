// /backend/src/utils/stock.js
// Helper central para mutar el stock de productos con compensación (auditoría 6.2).
//
// Problema que resuelve: los paths de venta hacen varios writes secuenciales
// (ajustar stock + escribir/borrar la fila de venta). Con el Session Pooler NO
// hay transacciones (sin BEGIN/COMMIT, ver convenciones_tecnicas §6), así que si
// un paso falla a mitad el stock queda inconsistente. Este helper espeja el
// cleanup compensatorio de createVenta y lo centraliza: aplica ajustes relativos
// de stock y, si un paso POSTERIOR falla, los revierte (best-effort, logueado).
//
// Convención de signo: cada mutación es { producto_id, delta } y se aplica como
// `stock_actual = stock_actual + delta`. delta > 0 repone; delta < 0 descuenta.
// La reversión es el delta inverso, así el llamador nunca necesita reconstruir la
// fila original para compensar — solo escribe la fila al final y, si eso falla,
// llama al revertidor.
//
// Nota de idempotencia (auditoría 4.2): estas escrituras son RELATIVAS (no
// idempotentes) → se ejecutan con { reintentar: false } para que el retry-once de
// query() no pueda doble-aplicar un descuento ante un blip de conexión (eso sería
// corrupción silenciosa del inventario). Aceptamos un fallo visible raro —que el
// usuario reintenta— en vez de una corrupción silenciosa.

import { query } from '../config/db.js';

// Las mutaciones de stock son relativas: nunca reintentar (ver nota 4.2 arriba).
const OPCIONES_STOCK = { reintentar: false };

/**
 * revertirMutaciones
 * Deshace (best-effort) una lista de mutaciones ya aplicadas, aplicando el delta
 * inverso. Cada reversión se loguea si falla pero no interrumpe las demás ni
 * propaga: estamos en un camino de compensación, la mejor jugada es intentar
 * dejar el stock lo más sano posible y registrar lo que no se pudo revertir.
 * @param {Array<{producto_id: string, delta: number}>} aplicadas
 * @returns {Promise<void>}
 */
const revertirMutaciones = async (aplicadas, tenantId) => {
  for (const m of aplicadas) {
    await query(
      'UPDATE producto SET stock_actual = stock_actual - $1 WHERE id = $2 AND tenant_id = $3',
      [m.delta, m.producto_id, tenantId],
      OPCIONES_STOCK
    ).catch((err) => {
      console.error(
        '[stock] no se pudo revertir mutación (best-effort) | producto_id:',
        m.producto_id, '| delta:', m.delta, '| error:', err
      );
    });
  }
};

/**
 * aplicarMutacionesStock
 * Aplica una lista de ajustes relativos de stock de forma secuencial. Si alguna
 * escritura falla a mitad, revierte (best-effort) las que ya se aplicaron y
 * relanza el error → el llamador ve el fallo con el stock ya restablecido.
 *
 * Si todas se aplican bien, devuelve un revertidor: una función que el llamador
 * invoca cuando un paso POSTERIOR (no de stock, p. ej. el UPDATE/DELETE de la fila
 * de venta) falla, para compensar el stock antes de propagar el error.
 *
 * @param {Array<{producto_id: string, delta: number}>} mutaciones - ajustes a aplicar
 *   (delta > 0 repone, delta < 0 descuenta). Puede venir vacío (no-op).
 * @param {string} tenantId - tenant del request; se agrega como filtro redundante
 *   `AND tenant_id` a cada UPDATE (defensa en profundidad, auditoría 2.2). El
 *   producto_id ya proviene de un SELECT scopeado por tenant en el llamador.
 * @returns {Promise<() => Promise<void>>} revertir() — deshace lo aplicado (best-effort)
 * @throws relanza el error de la primera mutación que falle (tras revertir las previas)
 */
export const aplicarMutacionesStock = async (mutaciones, tenantId) => {
  const aplicadas = [];
  try {
    for (const m of mutaciones) {
      await query(
        'UPDATE producto SET stock_actual = stock_actual + $1 WHERE id = $2 AND tenant_id = $3',
        [m.delta, m.producto_id, tenantId],
        OPCIONES_STOCK
      );
      aplicadas.push(m);
    }
  } catch (err) {
    // Falló una mutación a mitad: revertimos las previas y propagamos.
    await revertirMutaciones(aplicadas, tenantId);
    throw err;
  }
  // Éxito: entregamos el revertidor para compensar si un paso posterior falla.
  return () => revertirMutaciones(aplicadas, tenantId);
};
