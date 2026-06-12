// /backend/src/controllers/productos.js
import { query } from '../config/db.js';

/**
 * getProductos
 * Devuelve la lista de productos activos del tenant con stock actual.
 * Solo devuelve productos con stock > 0 para el flujo de venta.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} Array de productos con id, nombre, precio y stock_actual
 */
export const getProductos = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre, precio, stock_actual
       FROM producto
       WHERE tenant_id = $1 AND activo = true
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[productos] Error en getProductos:', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};