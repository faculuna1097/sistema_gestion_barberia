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