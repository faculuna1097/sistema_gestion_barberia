// /backend/src/controllers/ventas.js
import { query } from '../config/db.js';

const TZ = 'America/Argentina/Buenos_Aires';

export const createVenta = async (req, res) => {
  const { producto_id, cantidad, precio_unitario, forma_pago } = req.body;

  if (!producto_id || !cantidad || !precio_unitario || !forma_pago) {
    return res.status(400).json({
      error: 'Faltan campos requeridos: producto_id, cantidad, precio_unitario, forma_pago'
    });
  }

  let ventaId = null;

  try {
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
        error: `Stock insuficiente. Disponible: ${stockActual}`
      });
    }

    const ventaResult = await query(
      `INSERT INTO venta (tenant_id, producto_id, cantidad, precio_unitario, forma_pago)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.tenant_id, producto_id, cantidad, precio_unitario, forma_pago]
    );

    ventaId = ventaResult.rows[0].id;

    await query(
      `UPDATE producto SET stock_actual = stock_actual - $1 WHERE id = $2`,
      [cantidad, producto_id]
    );

    console.log('[ventas] createVenta completado | venta_id:', ventaId);
    res.status(201).json({
      message: 'Venta registrada correctamente',
      venta_id: ventaId,
      monto_total: cantidad * precio_unitario
    });

  } catch (err) {
    console.error('[ventas] Error en createVenta | venta_id al momento del fallo:', ventaId, '| error:', err);

    if (ventaId) {
      await query('DELETE FROM venta WHERE id = $1', [ventaId]).catch((cleanupErr) => {
        console.error('[ventas] createVenta — error en cleanup:', cleanupErr);
      });
    }

    res.status(500).json({ error: 'Error al registrar la venta' });
  }
};

export const getVentasMensual = async (req, res) => {
  const mes = req.query.mes || new Date().toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "El parámetro 'mes' debe tener formato YYYY-MM" });
  }

  try {
    const resultadoVentas = await query(
      `SELECT
         v.id,
         v.producto_id,
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

    return res.status(200).json({
      ventas: resultadoVentas.rows,
      totalesPorProducto: resultadoTotales.rows,
      totalGeneral,
    });

  } catch (err) {
    console.error('[ventas] Error en getVentasMensual:', err);
    return res.status(500).json({ error: 'Error interno al obtener las ventas del mes' });
  }
};

export const deleteVenta = async (req, res) => {
  const { id } = req.params;

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

    console.log('[ventas] deleteVenta completado | venta_id:', id);
    return res.status(200).json({ eliminado: true, id });

  } catch (err) {
    console.error('[ventas] Error en deleteVenta:', err);
    return res.status(500).json({ error: 'Error interno al eliminar la venta' });
  }
};

export const updateVenta = async (req, res) => {
  const { id } = req.params;

  const { producto_id, cantidad, precio_unitario, forma_pago } = req.body;

  if (!producto_id || !cantidad || !precio_unitario || !forma_pago) {
    return res.status(400).json({
      error: 'Faltan campos requeridos: producto_id, cantidad, precio_unitario, forma_pago'
    });
  }

  if (!['efectivo', 'mercado_pago'].includes(forma_pago)) {
    return res.status(400).json({ error: "forma_pago debe ser 'efectivo' o 'mercado_pago'" });
  }

  try {
    const ventaOriginal = await query(
      `SELECT producto_id, cantidad FROM venta WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenant_id]
    );

    if (ventaOriginal.rows.length === 0) {
      console.warn('[ventas] updateVenta — venta no encontrada | id:', id);
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const { producto_id: productoIdViejo, cantidad: cantidadVieja } = ventaOriginal.rows[0];

    const stockResult = await query(
      `SELECT stock_actual FROM producto WHERE id = $1 AND tenant_id = $2`,
      [producto_id, req.tenant_id]
    );

    if (stockResult.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const stockActual = stockResult.rows[0].stock_actual;
    const mismoProducto = producto_id === productoIdViejo;
    const stockDisponible = mismoProducto ? stockActual + cantidadVieja : stockActual;

    if (stockDisponible < cantidad) {
      console.warn('[ventas] updateVenta — stock insuficiente | disponible:', stockDisponible, '| solicitado:', cantidad);
      return res.status(400).json({
        error: `Stock insuficiente. Disponible: ${stockDisponible}`
      });
    }

    await query(
      `UPDATE producto SET stock_actual = stock_actual + $1 WHERE id = $2`,
      [cantidadVieja, productoIdViejo]
    );

    await query(
      `UPDATE venta
       SET producto_id = $1, cantidad = $2, precio_unitario = $3, forma_pago = $4
       WHERE id = $5 AND tenant_id = $6`,
      [producto_id, cantidad, precio_unitario, forma_pago, id, req.tenant_id]
    );

    await query(
      `UPDATE producto SET stock_actual = stock_actual - $1 WHERE id = $2`,
      [cantidad, producto_id]
    );

    console.log('[ventas] updateVenta completado | venta_id:', id);
    return res.status(200).json({ id, producto_id, cantidad, precio_unitario, forma_pago });

  } catch (err) {
    console.error('[ventas] Error en updateVenta:', err);
    return res.status(500).json({ error: 'Error interno al editar la venta' });
  }
};