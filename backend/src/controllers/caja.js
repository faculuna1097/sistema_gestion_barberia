// /backend/src/controllers/caja.js
import { query } from '../config/db.js';

const TZ = 'America/Argentina/Buenos_Aires';

/**
 * getMovimientosDia
 * Devuelve todos los movimientos del día (cortes, ventas y gastos) ordenados por timestamp.
 * @param {string} req.query.fecha - Fecha en formato YYYY-MM-DD (default: hoy en timezone AR)
 * @param {string} req.tenant_id  - Inyectado por tenantMiddleware
 * @returns {JSON} { movimientos: [...] }
 */
export const getMovimientosDia = async (req, res) => {
  const fecha = req.query.fecha
    || new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

  try {
    // ── Query 1: Cortes del día ──────────────────────────────────────────────
    const cortesResult = await query(
      `SELECT
         c.id,
         c.timestamp,
         TO_CHAR(c.timestamp AT TIME ZONE $2, 'HH24:MI') AS hora,
         b.nombre  AS barbero_nombre,
         s.nombre  AS detalle,
         c.monto_total AS monto,
         c.forma_pago,
         c.turno_id,
         b.comision_valor,
         'corte' AS tipo
       FROM corte c
       JOIN barbero b  ON c.barbero_id  = b.id
       JOIN servicio s ON c.servicio_id = s.id
       WHERE c.tenant_id = $1
         AND DATE(c.timestamp AT TIME ZONE $2) = $3::date
       ORDER BY c.timestamp ASC`,
      [req.tenant_id, TZ, fecha]
    );

    // ── Query 2: Ventas del día ──────────────────────────────────────────────
    const ventasResult = await query(
      `SELECT
         v.id,
         v.timestamp,
         TO_CHAR(v.timestamp AT TIME ZONE $2, 'HH24:MI') AS hora,
         NULL AS barbero_nombre,
         p.nombre || ' x' || v.cantidad AS detalle,
         (v.precio_unitario * v.cantidad) AS monto,
         v.forma_pago,
         NULL AS comision_valor,
         'venta' AS tipo
       FROM venta v
       JOIN producto p ON v.producto_id = p.id
       WHERE v.tenant_id = $1
         AND DATE(v.timestamp AT TIME ZONE $2) = $3::date
       ORDER BY v.timestamp ASC`,
      [req.tenant_id, TZ, fecha]
    );

    // ── Query 3: Gastos del día ──────────────────────────────────────────────
    const gastosResult = await query(
      `SELECT
         g.id,
         g.timestamp,
         TO_CHAR(g.timestamp AT TIME ZONE $2, 'HH24:MI') AS hora,
         NULL AS barbero_nombre,
         cg.nombre || ': ' || g.descripcion AS detalle,
         g.monto AS monto,
         g.forma_pago,
         NULL AS comision_valor,
         'gasto' AS tipo
       FROM gasto g
       JOIN categoria_gasto cg ON g.categoria_id = cg.id
       WHERE g.tenant_id = $1
         AND DATE(g.timestamp AT TIME ZONE $2) = $3::date
       ORDER BY g.timestamp ASC`,
      [req.tenant_id, TZ, fecha]
    );

    // ── Merge y orden cronológico ────────────────────────────────────────────
    const movimientos = [
      ...cortesResult.rows,
      ...ventasResult.rows,
      ...gastosResult.rows,
    ].sort((b, a) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({ movimientos });

  } catch (err) {
    console.error('[caja] Error en getMovimientosDia:', err);
    res.status(500).json({ error: 'Error al obtener movimientos del día' });
  }
};

/**
 * eliminarMovimiento
 * Elimina un registro del día por tipo e id.
 * - corte: borra el corte y, si completaba un turno, lo devuelve a 'reservado'
 * - venta: restaura stock_actual del producto, luego borra venta
 * - gasto: borra directo
 * @param {string} req.params.tipo - 'corte' | 'venta' | 'gasto'
 * @param {string} req.params.id   - UUID del registro
 * @param {string} req.tenant_id   - Inyectado por tenantMiddleware
 */
export const eliminarMovimiento = async (req, res) => {
  const { tipo, id } = req.params;

  try {
    if (tipo === 'corte') {
      // Recuperamos el turno vinculado (si lo hay) antes de borrar el corte, y
      // de paso validamos existencia (404 si no existe en este tenant).
      const corteResult = await query(
        'SELECT turno_id FROM corte WHERE id = $1 AND tenant_id = $2',
        [id, req.tenant_id]
      );
      if (corteResult.rows.length === 0) {
        return res.status(404).json({ error: 'Corte no encontrado' });
      }
      const { turno_id } = corteResult.rows[0];

      await query('DELETE FROM corte WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      console.log('[caja] eliminarMovimiento — corte eliminado | id:', id);

      // Si el corte completaba un turno, lo devolvemos a 'reservado'. El guard
      // estado = 'completado' hace el revert defensivo (espejo del registro, que
      // solo completa turnos 'reservado'): nunca toca turnos cancelados/no_asistio.
      if (turno_id) {
        const turnoResult = await query(
          `UPDATE turno SET estado = 'reservado'
           WHERE id = $1 AND tenant_id = $2 AND estado = 'completado'`,
          [turno_id, req.tenant_id]
        );
        if (turnoResult.rowCount === 0) {
          console.warn('[caja] eliminarMovimiento — turno no revertido (no existe, otro tenant, o no estaba completado) | turno_id:', turno_id);
        } else {
          console.log('[caja] eliminarMovimiento — turno revertido a reservado | turno_id:', turno_id);
        }
      }

    } else if (tipo === 'venta') {
      const ventaResult = await query(
        'SELECT producto_id, cantidad FROM venta WHERE id = $1 AND tenant_id = $2',
        [id, req.tenant_id]
      );
      if (ventaResult.rows.length === 0) {
        return res.status(404).json({ error: 'Venta no encontrada' });
      }
      const { producto_id, cantidad } = ventaResult.rows[0];
      await query(
        'UPDATE producto SET stock_actual = stock_actual + $1 WHERE id = $2',
        [cantidad, producto_id]
      );
      console.log('[caja] eliminarMovimiento — stock restaurado | producto_id:', producto_id, '| cantidad:', cantidad);
      await query('DELETE FROM venta WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      console.log('[caja] eliminarMovimiento — venta eliminada | id:', id);

    } else if (tipo === 'gasto') {
      await query('DELETE FROM gasto WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      console.log('[caja] eliminarMovimiento — gasto eliminado | id:', id);

    } else {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    res.json({ ok: true });

  } catch (err) {
    console.error(`[caja] Error en eliminarMovimiento (${tipo}):`, err);
    res.status(500).json({ error: `Error al eliminar ${tipo}` });
  }
};
