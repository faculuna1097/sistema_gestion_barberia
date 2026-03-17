// /backend/src/controllers/ventas.js
// Controlador del recurso "venta".
// Verifica stock, registra la venta y descuenta stock en secuencia.

import { query } from '../config/db.js';

const TENANT_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

/**
 * createVenta
 * Registra una nueva venta y descuenta el stock del producto.
 * Si el descuento de stock falla, elimina la venta registrada (cleanup manual).
 *
 * @param {Request} req - Body esperado:
 *   {
 *     producto_id: string (UUID),
 *     cantidad: number,
 *     precio_unitario: number,
 *     forma_pago: 'efectivo' | 'mercado_pago'
 *   }
 * @param {Response} res - Devuelve la venta creada con su id y monto total
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
    console.log('[createVenta] Verificando stock — producto_id:', producto_id);
    const stockResult = await query(
      `SELECT stock_actual FROM producto WHERE id = $1 AND tenant_id = $2`,
      [producto_id, TENANT_ID]
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
    console.log('[createVenta] Insertando venta — producto_id:', producto_id, '| cantidad:', cantidad, '| forma_pago:', forma_pago);
    const ventaResult = await query(
      `INSERT INTO venta (tenant_id, producto_id, cantidad, precio_unitario, forma_pago, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [TENANT_ID, producto_id, cantidad, precio_unitario, forma_pago, null]
    );

    ventaId = ventaResult.rows[0].id;
    console.log('[createVenta] Venta insertada — venta_id:', ventaId);

    // 3. Descontar stock del producto
    console.log('[createVenta] Descontando stock — producto_id:', producto_id, '| cantidad a descontar:', cantidad);
    await query(
      `UPDATE producto SET stock_actual = stock_actual - $1 WHERE id = $2`,
      [cantidad, producto_id]
    );
    console.log('[createVenta] Stock actualizado correctamente — stock nuevo estimado:', stockActual - cantidad);

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
 * Devuelve todos los productos vendidos en un mes para el tenant actual.
 * Incluye totales por producto y total general.
 *
 * @param {Request} req - Query param: mes (formato 'YYYY-MM'). Default: mes actual.
 * @param {Response} res - Devuelve:
 *   {
 *     ventas: Array<{ id, fecha, producto_nombre, cantidad, precio_unitario, total, forma_pago }>,
 *     totalesPorProducto: Array<{ producto_nombre, cantidad_total, monto_total }>,
 *     totalGeneral: number
 *   }
 */
export const getVentasMensual = async (req, res) => {
  console.log('[getVentasMensual] Solicitud recibida — query:', req.query);

  const mes = req.query.mes || new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires'
  }).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "El parámetro 'mes' debe tener formato YYYY-MM" });
  }

  try {
    // ── Query principal: todas las ventas del mes ────────────────────────────
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
      [TENANT_ID, mes]
    );

    // ── Query de totales por producto ────────────────────────────────────────
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
      [TENANT_ID, mes]
    );

    // ── Total general ────────────────────────────────────────────────────────
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
 * Elimina una venta por su ID y restaura el stock del producto.
 * Mismo comportamiento que la eliminación en SeccionCaja.
 *
 * @param {Request} req - Param: id (UUID de la venta a eliminar)
 * @param {Response} res - 200 con { eliminado: true, id } o error
 */
export const deleteVenta = async (req, res) => {
  const { id } = req.params;
  console.log('[deleteVenta] Solicitud recibida — id:', id);

  if (!id) {
    return res.status(400).json({ error: 'Falta el parámetro id' });
  }

  try {
    // 1. Obtener datos de la venta antes de eliminar (necesitamos cantidad y producto_id)
    const ventaResult = await query(
      `SELECT producto_id, cantidad FROM venta WHERE id = $1 AND tenant_id = $2`,
      [id, TENANT_ID]
    );

    if (ventaResult.rows.length === 0) {
      console.warn('[deleteVenta] Venta no encontrada o no pertenece al tenant — id:', id);
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const { producto_id, cantidad } = ventaResult.rows[0];

    // 2. Eliminar la venta
    await query(
      `DELETE FROM venta WHERE id = $1 AND tenant_id = $2`,
      [id, TENANT_ID]
    );
    console.log('[deleteVenta] Venta eliminada — id:', id);

    // 3. Restaurar stock del producto
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
