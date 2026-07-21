// /backend/src/controllers/caja.js
import { query } from '../config/db.js';
import { aplicarMutacionesStock } from '../utils/stock.js';
import { TZ } from '../utils/constantes.js';

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

      // Orden con compensación (auditoría 6.2): revertimos el turno PRIMERO y
      // borramos el corte DESPUÉS. Si el DELETE del corte falla, devolvemos el
      // turno a 'completado' (compensación con delta de estado conocido). Al revés
      // (borrar corte y luego revertir turno) un fallo dejaría un turno 'completado'
      // huérfano sin corte, y compensarlo exigiría reconstruir la fila del corte.
      //
      // El guard estado = 'completado' hace el revert defensivo (espejo del
      // registro, que solo completa turnos 'reservado'): nunca toca turnos
      // cancelados/no_asistio. Estas escrituras son de VALOR FIJO (idempotentes),
      // así que el retry-once de query() es seguro (no aplica la excepción de 4.2).
      let turnoRevertido = false;
      if (turno_id) {
        const turnoResult = await query(
          `UPDATE turno SET estado = 'reservado'
           WHERE id = $1 AND tenant_id = $2 AND estado = 'completado'`,
          [turno_id, req.tenant_id]
        );
        turnoRevertido = turnoResult.rowCount > 0;
        if (!turnoRevertido) {
          console.warn('[caja] eliminarMovimiento — turno no revertido (no existe, otro tenant, o no estaba completado) | turno_id:', turno_id);
        } else {
          console.log('[caja] eliminarMovimiento — turno revertido a reservado | turno_id:', turno_id);
        }
      }

      try {
        await query('DELETE FROM corte WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      } catch (err) {
        // Compensa el revert del turno si el borrado del corte falló. El guard
        // estado = 'reservado' evita pisar un cambio concurrente.
        if (turnoRevertido) {
          await query(
            `UPDATE turno SET estado = 'completado'
             WHERE id = $1 AND tenant_id = $2 AND estado = 'reservado'`,
            [turno_id, req.tenant_id]
          ).catch((compErr) => {
            console.error('[caja] eliminarMovimiento — error compensando revert de turno (best-effort) | turno_id:', turno_id, '| error:', compErr);
          });
        }
        throw err;
      }
      console.log('[caja] eliminarMovimiento — corte eliminado | id:', id);

    } else if (tipo === 'venta') {
      const ventaResult = await query(
        'SELECT producto_id, cantidad FROM venta WHERE id = $1 AND tenant_id = $2',
        [id, req.tenant_id]
      );
      if (ventaResult.rows.length === 0) {
        return res.status(404).json({ error: 'Venta no encontrada' });
      }
      const { producto_id, cantidad } = ventaResult.rows[0];

      // Restaurar stock primero (helper con compensación) y borrar la venta
      // después; si el DELETE falla, revertimos el restore (auditoría 6.2).
      const revertirStock = await aplicarMutacionesStock([{ producto_id, delta: cantidad }], req.tenant_id);
      console.log('[caja] eliminarMovimiento — stock restaurado | producto_id:', producto_id, '| cantidad:', cantidad);
      let ventaDelRes;
      try {
        ventaDelRes = await query('DELETE FROM venta WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      } catch (err) {
        await revertirStock();
        throw err;
      }
      // Igual que deleteVenta: si el DELETE no borró nada (fila desaparecida entre
      // el SELECT y el DELETE por un borrado concurrente), el restore que ya
      // aplicamos sobra → lo revertimos para no doble-sumar el stock.
      if (ventaDelRes.rowCount === 0) {
        await revertirStock();
        console.warn('[caja] eliminarMovimiento — venta ya no existía al borrar (carrera) | id:', id);
        return res.status(404).json({ error: 'Venta no encontrada' });
      }
      console.log('[caja] eliminarMovimiento — venta eliminada | id:', id);

    } else if (tipo === 'gasto') {
      const gastoDelRes = await query('DELETE FROM gasto WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      // Contrato consistente con las ramas corte/venta: 404 si no borró nada
      // (id inexistente o de otro tenant) en vez de un 200 engañoso.
      if (gastoDelRes.rowCount === 0) {
        return res.status(404).json({ error: 'Gasto no encontrado' });
      }
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
