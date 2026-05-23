// /backend/src/controllers/servicios.js
import { query } from '../config/db.js';

/**
 * getServicios
 * Devuelve la lista de servicios activos del tenant con nombre y precio.
 * "Corte" se mueve al final por convención del negocio.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} Array de servicios con id, nombre y precio
 */
export const getServicios = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre, precio
       FROM servicio
       WHERE tenant_id = $1 AND activo = true
       ORDER BY precio ASC`,
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[servicios] Error en getServicios:', err);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
};