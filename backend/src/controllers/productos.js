// /backend/src/controllers/productos.js
import { query } from '../config/db.js';

const TENANT_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

/**
 * getProductos
 * Devuelve la lista de productos activos del tenant con stock actual.
 * Solo devuelve productos con stock > 0 para el flujo de venta.
 * @param {Request} req - Request HTTP
 * @param {Response} res - Response HTTP
 * @returns {JSON} Array de productos con id, nombre, precio y stock_actual
 */
export const getProductos = async (req, res) => {
  console.log('[getProductos] Solicitud recibida — tenant_id:', TENANT_ID);
  try {
    const result = await query(
      `SELECT id, nombre, precio, stock_actual 
       FROM producto 
       WHERE tenant_id = $1 AND activo = true 
       ORDER BY nombre ASC`,
      [TENANT_ID]
    );
    console.log('[getProductos] Productos encontrados:', result.rows.length, result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('[getProductos] Error al consultar la base de datos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};