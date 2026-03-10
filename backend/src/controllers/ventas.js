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
  const { producto_id, cantidad, precio_unitario, forma_pago } = req.body;

  if (!producto_id || !cantidad || !precio_unitario || !forma_pago) {
    return res.status(400).json({ 
      error: 'Faltan campos requeridos: producto_id, cantidad, precio_unitario, forma_pago' 
    });
  }

  let ventaId = null;

  try {
    // 1. Verificar stock disponible antes de registrar
    const stockResult = await query(
      `SELECT stock_actual FROM producto WHERE id = $1 AND tenant_id = $2`,
      [producto_id, TENANT_ID]
    );

    if (!stockResult.rows.length) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const stockActual = stockResult.rows[0].stock_actual;

    if (stockActual < cantidad) {
      return res.status(400).json({ 
        error: `Stock insuficiente. Disponible: ${stockActual}, solicitado: ${cantidad}` 
      });
    }

    // 2. Registrar la venta
    const ventaResult = await query(
      `INSERT INTO venta (tenant_id, producto_id, cantidad, precio_unitario, forma_pago, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [TENANT_ID, producto_id, cantidad, precio_unitario, forma_pago, null]
    );

    ventaId = ventaResult.rows[0].id;

    // 3. Descontar stock del producto
    await query(
      `UPDATE producto SET stock_actual = stock_actual - $1 WHERE id = $2`,
      [cantidad, producto_id]
    );

    res.status(201).json({
      message: 'Venta registrada correctamente',
      venta_id: ventaId,
      monto_total: cantidad * precio_unitario
    });

  } catch (error) {
    // Si la venta se insertó pero el UPDATE de stock falló, eliminamos la venta
    if (ventaId) {
      await query(`DELETE FROM venta WHERE id = $1`, [ventaId]).catch((cleanupError) => {
        console.error('Error en cleanup de venta huérfana:', cleanupError.message);
      });
    }
    console.error('Error en createVenta:', error);
    res.status(500).json({ error: 'Error al registrar la venta' });
  }
};