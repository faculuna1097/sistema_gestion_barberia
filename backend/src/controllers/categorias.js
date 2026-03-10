import { query } from '../config/db.js';

const TENANT_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

/**
 * getCategorias
 * Devuelve las categorías de gasto activas del tenant.
 * @param {Request} req
 * @param {Response} res
 * @returns {JSON} Array de categorías con id y nombre
 */
export const getCategorias = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre FROM categoria_gasto WHERE tenant_id = $1 ORDER BY nombre ASC`,
      [TENANT_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getCategorias:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};