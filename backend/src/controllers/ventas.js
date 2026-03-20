// /backend/src/controllers/ventas.js
// Controlador del recurso "venta".
//
// Todas las funciones usan req.tenant_id, inyectado por tenantMiddleware
// en rutas públicas (desde .env) y por verificarToken en rutas protegidas (desde JWT).

import { query } from '../config/db.js';

/**
 * createVenta
 * Registra una nueva venta y descuenta el stock del producto.
 * Ruta pública — req.tenant_id viene del tenantMiddleware (desde .env).
 * Si el descuento de stock falla, elimina la venta registrada (cleanup manual).
 *
 * @param {Request} req - Body: { producto_id, cantidad, precio_unitario, forma_pago }
 * @param {Response} res - Devuelve { message, venta_id, monto_total }
 */
export const createVenta = async (req, res) => {
  console.log('[createVenta] Solicitud recibida — body:', req.body);

  const { producto_id, cantidad, precio_unitario, forma_pago } = req.body;

  if (!producto_id || !cantidad || !precio_unitario || !forma_pago) {
    console.warn('[createVenta] Validación fallida — campos faltantes:', { producto_id, cantidad, precio_unitario, forma_pago });
    return res.status(400).json({
      error: 'Faltan campos requeridos: producto_id, cantidad, precio_unitario, forma_pago'
    });
  }

  let ventaId = null;

  try {
    // 1. Verificar stock disponible antes de registrar
    console.log('[createVenta] Verificando stock — producto_id:', producto_id, '| tenant:', req.tenant_id);
    const stockResult = await query(
      `SELECT stock_actual FROM producto WHERE id = $1 AND tenant_id = $2`,
      [producto_id, req.tenant_id]
    );

    if (!stockResult.rows.length) {
      console.warn('[createVenta] Producto no encontrado — producto_id:', producto_id);
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const stockActual = stockResult.rows[0].stock_actual;
    console.log('[createVenta] Stock actual:', stockActual, '| Cantidad solicitada:', cantidad);

    if (stockActual < cantidad) {
      console.warn('[createVenta] Stock insuficiente — disponible:', stockActual, '| solicitado:', cantidad);
      return res.status(400).json({
        error: `Stock insuficiente. Disponible: ${stockActual}, solicitado: ${cantidad}`
      });
    }

    // 2. Registrar la venta
    console.log('[createVenta] Insertando venta — producto_id:', producto_id, '| cantidad:', cantidad);
    const ventaResult = await query(
      `INSERT INTO venta (tenant_id, producto_id, cantidad, precio_unitario, forma_pago, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.tenant_id, producto_id, cantidad, precio_unitario, forma_pago, null]
    );

    ventaId = ventaResult.rows[0].id;
    console.log('[createVenta] Venta insertada — venta_id:', ventaId);

    // 3. Descontar stock del producto
    console.log('[createVenta] Descontando stock — producto_id:', producto_id, '| cantidad:', cantidad);
    await query(
      `UPDATE producto SET stock_actual = stock_actual - $1 WHERE id = $2`,
      [cantidad, producto_id]
    );
    console.log('[createVenta] Stock actualizado — stock nuevo estimado:', stockActual - cantidad);

    res.status(201).json({
      message: 'Venta registrada correctamente',
      venta_id: ventaId,
      monto_total: cantidad * precio_unitario
    });

  } catch (error) {
    console.error('[createVenta] Error durante el registro — venta_id al momento del fallo:', ventaId, '| error:', error);

    // Si la venta se insertó pero el UPDATE de stock falló, eliminamos la venta
    if (ventaId) {
      console.warn('[createVenta] Iniciando cleanup — eliminando venta huérfana con id:', ventaId);
      await query(`DELETE FROM venta WHERE id = $1`, [ventaId]).catch((cleanupError) => {
        console.error('[createVenta] Error en cleanup de venta huérfana:', cleanupError.message);
      });
      console.log('[createVenta] Cleanup completado — venta eliminada:', ventaId);
    }

    res.status(500).json({ error: 'Error al registrar la venta' });
  }
};

/**
 * getVentasMensual
 * Devuelve todos los productos vendidos en un mes.
 * Ruta protegida — req.tenant_id inyectado por verificarToken.
 *
 * @param {Request} req - Query param: mes (YYYY-MM). Default: mes actual.
 * @param {Response} res - Devuelve { ventas, totalesPorProducto, totalGeneral }
 */
export const getVentasMensual = async (req, res) => {
  console.log('[getVentasMensual] Solicitud recibida — query:', req.query, '| tenant:', req.tenant_id);

  const mes = req.query.mes || new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires'
  }).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "El parámetro 'mes' debe tener formato YYYY-MM" });
  }

  try {
    const resultadoVentas = await query(
      `SELECT
         v.id,
         TO_CHAR(v.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') AS fecha,
         p.nombre                              AS producto_nombre,
         v.cantidad,
         v.precio_unitario,
         (v.cantidad * v.precio_unitario)      AS total,
         v.forma_pago
       FROM venta v
       JOIN producto p ON v.producto_id = p.id
       WHERE v.tenant_id = $1
         AND TO_CHAR(v.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') = $2
       ORDER BY v.timestamp DESC`,
      [req.tenant_id, mes]
    );

    const resultadoTotales = await query(
      `SELECT
         p.nombre                              AS producto_nombre,
         SUM(v.cantidad)                       AS cantidad_total,
         SUM(v.cantidad * v.precio_unitario)   AS monto_total
       FROM venta v
       JOIN producto p ON v.producto_id = p.id
       WHERE v.tenant_id = $1
         AND TO_CHAR(v.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') = $2
       GROUP BY p.nombre
       ORDER BY monto_total DESC`,
      [req.tenant_id, mes]
    );

    const totalGeneral = resultadoTotales.rows.reduce(
      (acc, row) => acc + parseFloat(row.monto_total), 0
    );

    console.log('[getVentasMensual] Consulta completada — mes:', mes,
      '| registros:', resultadoVentas.rows.length,
      '| total general:', totalGeneral);

    return res.status(200).json({
      ventas: resultadoVentas.rows,
      totalesPorProducto: resultadoTotales.rows,
      totalGeneral,
    });

  } catch (err) {
    console.error('[getVentasMensual] Error al consultar ventas mensuales:', err);
    return res.status(500).json({ error: 'Error interno al obtener las ventas del mes' });
  }
};

/**
 * deleteVenta
 * Elimina una venta y restaura el stock del producto.
 * Ruta protegida — req.tenant_id inyectado por verificarToken.
 *
 * @param {Request} req - Param: id (UUID de la venta)
 * @param {Response} res - 200 con { eliminado: true, id } o error
 */
export const deleteVenta = async (req, res) => {
  const { id } = req.params;
  console.log('[deleteVenta] Solicitud recibida — id:', id, '| tenant:', req.tenant_id);

  if (!id) {
    return res.status(400).json({ error: 'Falta el parámetro id' });
  }

  try {
    const ventaResult = await query(
      `SELECT producto_id, cantidad FROM venta WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenant_id]
    );

    if (ventaResult.rows.length === 0) {
      console.warn('[deleteVenta] Venta no encontrada o no pertenece al tenant — id:', id);
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const { producto_id, cantidad } = ventaResult.rows[0];

    await query(
      `DELETE FROM venta WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenant_id]
    );
    console.log('[deleteVenta] Venta eliminada — id:', id);

    await query(
      `UPDATE producto SET stock_actual = stock_actual + $1 WHERE id = $2`,
      [cantidad, producto_id]
    );
    console.log('[deleteVenta] Stock restaurado — producto_id:', producto_id, '| cantidad restaurada:', cantidad);

    return res.status(200).json({ eliminado: true, id });

  } catch (err) {
    console.error('[deleteVenta] Error al eliminar venta:', err);
    return res.status(500).json({ error: 'Error interno al eliminar la venta' });
  }
};
