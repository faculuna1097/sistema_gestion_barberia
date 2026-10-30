// /backend/src/controllers/barberos.js
// Controlador del recurso "barbero".
// Contiene la lógica de negocio para cada endpoint de /api/barberos.

import { listarBarberosActivos } from '../services/barberosService.js';

/**
 * getBarberos
 * Devuelve la lista de barberos activos del tenant, ordenada alfabéticamente.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} Array de barberos con id y nombre
 */
export const getBarberos = async (req, res) => {
  try {
    const barberos = await listarBarberosActivos(req.tenant_id);
    res.json(barberos);
  } catch (err) {
    console.error('[barberos] Error en getBarberos:', err);
    res.status(500).json({ error: 'Error al obtener barberos' });
  }
};