// /backend/src/controllers/ventas.js
// Controlador del recurso "venta".
// Todas las funciones usan req.tenant_id, inyectado por tenantMiddleware
// en rutas públicas (desde .env) y por verificarToken en rutas protegidas (desde JWT).

import { query } from '../config/db.js';

const TZ = 'America/Argentina/Buenos_Aires';

/**
 * createVenta
 * Registra una nueva venta y descuenta el stock del producto.
 * Ruta pública — req.tenant_id viene del tenantMiddleware (desde .env).
 * Si el descuento de stock falla, elimina la venta registrada (cleanup manual).
 * @param {string} req.tenant_id              - Inyectado por tenantMiddleware
 * @param {string} req.body.producto_id       - UUID del producto
 * @param {number} req.body.cantidad          - Cantidad vendida
 * @param {number} req.body.precio_unitario   - Precio unitario al momento de la venta
 * @param {string} req.body.forma_pago        - 'efectivo' | 'mercado_pago'
 * @returns {JSON} { message, venta_id, monto_total }
 */
export const createVenta = async (req, res) => {
  console.log('[ventas] createVenta — request recibido | tenant:', req.tenant_id);

  const { producto_id, cantidad, precio_unitario, forma_pago } = req.body;

  if (!producto_id || !cantidad || !precio_unitario || !forma_pago) {
    console.warn('[ventas] createVenta — validación fallida | campos faltantes:', { producto_id, cantidad, precio_unitario, forma_pago });
    return res.status(400).json({
      error: 'Faltan campos requeridos: producto_id, cantidad, precio_unitario, forma_pago'
    });
  }

  let ventaId = null;

  try {
    // 1. Verificar stock disponible antes de registrar
    const stockResult = await query(
      `SELECT stock_actual FROM producto WHERE id = $1 AND tenant_id = $2`,
      [producto_id, req.tenant_id]
    );

    if (!stockResult.rows.length) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const stockActual = stockResult.rows[0].stock_actual;

    if (stockActual < cantidad) {
      console.warn('[ventas] createVenta — stock insuficiente | disponible:', stockActual, '| solicitado:', cantidad);
      return res.status(400).json({
        error: `Stock insuficiente. Disponible: ${stockActual}, solicitado: ${cantidad}`
      });
    }

    // 2. Registrar la venta
    const ventaResult = await query(
      `INSERT INTO venta (tenant_id, producto_id, cantidad, precio_unitario, forma_pago, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.tenant_id, producto_id, cantidad, precio_unitario, forma_pago, null]
    );

    ventaId = ventaResult.rows[0].id;

    // 3. Descontar stock del producto
    await query(
      `UPDATE producto SET stock_actual = stock_actual - $1 WHERE id = $2`,
      [cantidad, producto_id]
    );

    console.log('[ventas] createVenta — completado | venta_id:', ventaId, '| producto_id:', producto_id, '| cantidad:', cantidad);
    res.status(201).json({
      message: 'Venta registrada correctamente',
      venta_id: ventaId,
      monto_total: cantidad * precio_unitario
    });

  } catch (err) {
    console.error('[ventas] Error en createVenta | venta_id al momento del fallo:', ventaId, '| error:', err.message);

    // Si la venta se insertó pero el UPDATE de stock falló, eliminamos la venta
    if (ventaId) {
      console.warn('[ventas] createVenta — iniciando cleanup | eliminando venta huérfana:', ventaId);
      await query('DELETE FROM venta WHERE id = $1', [ventaId]).catch((cleanupErr) => {
        console.error('[ventas] createVenta — error en cleanup:', cleanupErr.message);
      });
      console.log('[ventas] createVenta — cleanup completado | venta eliminada:', ventaId);
    }

    res.status(500).json({ error: 'Error al registrar la venta' });
  }
};

/**
 * getVentasMensual
 * Devuelve todos los productos vendidos en un mes.
 * Ruta protegida — req.tenant_id inyectado por verificarToken.
 * @param {string} req.query.mes - Mes en formato YYYY-MM (default: mes actual)
 * @param {string} req.tenant_id - Inyectado por verificarToken
 * @returns {JSON} { ventas, totalesPorProducto, totalGeneral }
 */
export const getVentasMensual = async (req, res) => {
  const mes = req.query.mes || new Date().toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);
  console.log('[ventas] getVentasMensual — request recibido | mes:', mes, '| tenant:', req.tenant_id);

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "El parámetro 'mes' debe tener formato YYYY-MM" });
  }

  try {
    const resultadoVentas = await query(
      `SELECT
         v.id,
         TO_CHAR(v.timestamp AT TIME ZONE $3, 'DD/MM/YYYY') AS fecha,
         p.nombre                                            AS producto_nombre,
         v.cantidad,
         v.precio_unitario,
         (v.cantidad * v.precio_unitario)                    AS total,
         v.forma_pago
       FROM venta v
       JOIN producto p ON v.producto_id = p.id
       WHERE v.tenant_id = $1
         AND TO_CHAR(v.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
       ORDER BY v.timestamp DESC`,
      [req.tenant_id, mes, TZ]
    );

    const resultadoTotales = await query(
      `SELECT
         p.nombre                              AS producto_nombre,
         SUM(v.cantidad)                       AS cantidad_total,
         SUM(v.cantidad * v.precio_unitario)   AS monto_total
       FROM venta v
       JOIN producto p ON v.producto_id = p.id
       WHERE v.tenant_id = $1
         AND TO_CHAR(v.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
       GROUP BY p.nombre
       ORDER BY monto_total DESC`,
      [req.tenant_id, mes, TZ]
    );

    const totalGeneral = resultadoTotales.rows.reduce(
      (acc, row) => acc + parseFloat(row.monto_total), 0
    );

    console.log('[ventas] getVentasMensual — completado | mes:', mes, '| registros:', resultadoVentas.rows.length, '| total:', totalGeneral);
    return res.status(200).json({
      ventas: resultadoVentas.rows,
      totalesPorProducto: resultadoTotales.rows,
      totalGeneral,
    });

  } catch (err) {
    console.error('[ventas] Error en getVentasMensual:', err.message);
    return res.status(500).json({ error: 'Error interno al obtener las ventas del mes' });
  }
};

/**
 * deleteVenta
 * Elimina una venta y restaura el stock del producto.
 * Ruta protegida — req.tenant_id inyectado por verificarToken.
 * @param {string} req.params.id - UUID de la venta a eliminar
 * @param {string} req.tenant_id - Inyectado por verificarToken
 * @returns {JSON} { eliminado: true, id } o error
 */
export const deleteVenta = async (req, res) => {
  const { id } = req.params;
  console.log('[ventas] deleteVenta — request recibido | id:', id, '| tenant:', req.tenant_id);

  if (!id) {
    return res.status(400).json({ error: 'Falta el parámetro id' });
  }

  try {
    const ventaResult = await query(
      `SELECT producto_id, cantidad FROM venta WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenant_id]
    );

    if (ventaResult.rows.length === 0) {
      console.warn('[ventas] deleteVenta — venta no encontrada | id:', id);
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const { producto_id, cantidad } = ventaResult.rows[0];

    await query('DELETE FROM venta WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
    await query(
      'UPDATE producto SET stock_actual = stock_actual + $1 WHERE id = $2',
      [cantidad, producto_id]
    );

    console.log('[ventas] deleteVenta — completado | venta_id:', id, '| stock restaurado | producto_id:', producto_id, '| cantidad:', cantidad);
    return res.status(200).json({ eliminado: true, id });

  } catch (err) {
    console.error('[ventas] Error en deleteVenta:', err.message);
    return res.status(500).json({ error: 'Error interno al eliminar la venta' });
  }
};