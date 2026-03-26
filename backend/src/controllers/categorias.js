// /backend/src/controllers/categorias.js
import { query } from '../config/db.js';

/**
 * getCategorias
 * Devuelve las categorías de gasto activas del tenant, ordenadas alfabéticamente.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} Array de categorías con id y nombre
 */
export const getCategorias = async (req, res) => {
  console.log('[categorias] getCategorias — request recibido | tenant:', req.tenant_id);
  try {
    const result = await query(
      `SELECT id, nombre FROM categoria_gasto WHERE tenant_id = $1 ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    console.log('[categorias] getCategorias — completado:', result.rows.length, 'categorías encontradas');
    res.json(result.rows);
  } catch (err) {
    console.error('[categorias] Error en getCategorias:', err.message);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};