// /backend/src/controllers/servicios.js
import { query } from '../config/db.js';

const TENANT_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

/**
 * getServicios
 * Devuelve la lista de servicios activos del tenant con nombre y precio.
 * @param {Request} req - Request HTTP
 * @param {Response} res - Response HTTP
 * @returns {JSON} Array de servicios con id, nombre y precio
 */
export const getServicios = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre, precio 
       FROM servicio 
       WHERE tenant_id = $1 AND activo = true 
       ORDER BY nombre ASC`,
      [TENANT_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getServicios:', error);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
};