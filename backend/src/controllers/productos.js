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
  console.log('[productos] getProductos — request recibido | tenant:', req.tenant_id);
  try {
    const result = await query(
      `SELECT id, nombre, precio, stock_actual
       FROM producto
       WHERE tenant_id = $1 AND activo = true
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    console.log('[productos] getProductos — completado:', result.rows.length, 'productos encontrados');
    res.json(result.rows);
  } catch (err) {
    console.error('[productos] Error en getProductos:', err.message);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};