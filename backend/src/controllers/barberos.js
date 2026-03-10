// /backend/src/controllers/barberos.js
// Controlador del recurso "barbero".
// Contiene la lógica de negocio para cada endpoint de /api/barberos.

import { query } from '../config/db.js';

// TENANT TEMPORAL — en producción esto vendrá del token JWT del usuario autenticado
const TENANT_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

/**
 * getBarberos
 * Devuelve la lista de barberos activos del tenant.
 * @param {Request} req - Request HTTP (no se usa por ahora)
 * @param {Response} res - Response HTTP
 * @returns {JSON} Array de barberos con id y nombre
 */
export const getBarberos = async (req, res) => {
  console.log('[getBarberos] Solicitud recibida — tenant_id:', TENANT_ID);
  try {
    const result = await query(
      `SELECT id, nombre 
       FROM barbero 
       WHERE tenant_id = $1 AND activo = true 
       ORDER BY (nombre = 'Teton') ASC, nombre ASC`,
      [TENANT_ID]
    );
    console.log('[getBarberos] Barberos encontrados:', result.rows.length, result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('[getBarberos] Error al consultar la base de datos:', error);
    res.status(500).json({ error: 'Error al obtener barberos' });
  }
};