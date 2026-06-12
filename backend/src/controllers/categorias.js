// /backend/src/controllers/categorias.js
import { query } from '../config/db.js';

/**
 * getCategorias
 * Devuelve las categorías de gasto activas del tenant, ordenadas alfabéticamente.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} Array de categorías con id y nombre
 */
export const getCategorias = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre FROM categoria_gasto WHERE tenant_id = $1 ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[categorias] Error en getCategorias:', err);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};