// backend/src/controllers/caja.js
import { query } from '../config/db.js';

const TZ = 'America/Argentina/Buenos_Aires';

/**
 * getMovimientosDia — devuelve todos los movimientos del día solicitado
 * ordenados por timestamp: cortes, ventas y gastos mergeados.
 * Query param: fecha (YYYY-MM-DD, opcional — default: hoy en timezone AR)
 * req.tenant_id inyectado por verificarToken
 * Retorna: { movimientos: [...] }
 */
export const getMovimientosDia = async (req, res) => {
  const fecha = req.query.fecha
    || new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

  console.log(`[Caja] Request recibido: GET /api/caja/movimientos-dia — fecha: ${fecha} | tenant: ${req.tenant_id}`);

  try {
    // ── Query 1: Cortes del día ──────────────────────────────────────────────
    const cortesResult = await query(
      `SELECT
         c.id,
         c.timestamp,
         TO_CHAR(c.timestamp AT TIME ZONE $2, 'HH24:MI') AS hora,
         b.nombre AS barbero_nombre,
         COALESCE(cs_agg.servicios, '') AS detalle,
         c.monto_total AS monto,
         c.forma_pago,
         b.comision_valor,
         'corte' AS tipo
       FROM corte c
       JOIN barbero b ON c.barbero_id = b.id
       LEFT JOIN (
         SELECT cs.corte_id,
                STRING_AGG(s.nombre, ' + ' ORDER BY s.nombre) AS servicios
         FROM corte_servicio cs
         JOIN servicio s ON cs.servicio_id = s.id
         GROUP BY cs.corte_id
       ) cs_agg ON cs_agg.corte_id = c.id
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
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    console.log('[Caja] Movimientos obtenidos:', movimientos.length, '| fecha:', fecha);
    res.json({ movimientos });

  } catch (err) {
    console.error('[Caja] Error al obtener movimientos:', err);
    res.status(500).json({ error: 'Error al obtener movimientos del día' });
  }
};

/**
 * eliminarMovimiento — elimina un registro del día por tipo e id.
 * - corte: borra corte_servicio primero, luego corte
 * - venta: restaura stock_actual del producto, luego borra venta
 * - gasto: borra directo
 * req.tenant_id inyectado por verificarToken
 * Params: tipo ('corte' | 'venta' | 'gasto'), id (uuid)
 */
export const eliminarMovimiento = async (req, res) => {
  const { tipo, id } = req.params;
  console.log(`[Caja] Request recibido: DELETE /api/caja/movimientos/${tipo}/${id} | tenant: ${req.tenant_id}`);

  try {
    if (tipo === 'corte') {
      await query('DELETE FROM corte_servicio WHERE corte_id = $1', [id]);
      await query('DELETE FROM corte WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      console.log('[Caja] Corte eliminado — id:', id);

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
      console.log('[Caja] Stock restaurado — producto_id:', producto_id, '| cantidad:', cantidad);
      await query('DELETE FROM venta WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      console.log('[Caja] Venta eliminada — id:', id);

    } else if (tipo === 'gasto') {
      await query('DELETE FROM gasto WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      console.log('[Caja] Gasto eliminado — id:', id);

    } else {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    res.json({ ok: true });

  } catch (err) {
    console.error(`[Caja] Error al eliminar ${tipo}:`, err);
    res.status(500).json({ error: `Error al eliminar ${tipo}` });
  }
};
