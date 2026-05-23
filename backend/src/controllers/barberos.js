// /backend/src/controllers/barberos.js
// Controlador del recurso "barbero".
// Contiene la lógica de negocio para cada endpoint de /api/barberos.

import { query } from '../config/db.js';

/**
 * getBarberos
 * Devuelve la lista de barberos activos del tenant, ordenada alfabéticamente.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} Array de barberos con id y nombre
 */
export const getBarberos = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre
       FROM barbero
       WHERE tenant_id = $1 AND activo = true
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[barberos] Error en getBarberos:', err);
    res.status(500).json({ error: 'Error al obtener barberos' });
  }
};