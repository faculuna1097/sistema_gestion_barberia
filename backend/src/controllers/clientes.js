// /backend/src/controllers/clientes.js
// Controller del backoffice para búsqueda de clientes.
// Cobertura: plan_turnero_v2.md sección 5 (/api/admin/clientes).

import { query } from '../config/db.js';

/**
 * GET /api/admin/clientes?busqueda=X
 * Busca clientes del tenant por nombre, email o teléfono (ILIKE).
 * Disponible para ambos roles (admin y barbero).
 * @param {string} req.query.busqueda - texto de búsqueda (mínimo 2 caracteres)
 * @returns {JSON} array de clientes
 */
export const getClientes = async (req, res) => {
  console.log('[clientes] getClientes — request recibido | tenant:', req.tenant_id,
    '| busqueda:', req.query.busqueda ?? '(vacía)');

  const { busqueda } = req.query;
  if (!busqueda || busqueda.trim().length < 2) {
    return res.status(400).json({ error: 'busqueda debe tener al menos 2 caracteres' });
  }

  const patron = `%${busqueda.trim()}%`;

  try {
    const result = await query(
      `SELECT id, nombre, email, telefono, created_at
       FROM cliente
       WHERE tenant_id = $1
         AND (nombre ILIKE $2 OR email ILIKE $2 OR telefono ILIKE $2)
       ORDER BY nombre ASC
       LIMIT 50`,
      [req.tenant_id, patron]
    );
    console.log('[clientes] getClientes — completado |', result.rows.length, 'resultados');
    res.json(result.rows);
  } catch (err) {
    console.error('[clientes] Error en getClientes:', err.message);
    res.status(500).json({ error: 'Error al buscar clientes' });
  }
};
