// /backend/src/controllers/socios.js
import { query } from '../config/db.js';

/**
 * getSocios
 * Devuelve los socios (dueños) activos del tenant, ordenados por nombre. Los
 * consume el selector de dueño al cargar un aporte o un retiro en Caja.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} [{ id, nombre }]
 */
export const getSocios = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre
       FROM socio
       WHERE tenant_id = $1 AND activo = true
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    return res.json(result.rows);

  } catch (err) {
    console.error('[socios] Error en getSocios:', err);
    return res.status(500).json({ error: 'Error al obtener los socios' });
  }
};
