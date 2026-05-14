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
/**
 * GET /api/admin/clientes/mis-clientes
 * Devuelve los clientes que tuvieron al menos un turno con el barbero autenticado.
 * Si rol=admin y se pasa barbero_id como query param, filtra por ese barbero.
 * Si rol=barbero, usa req.barbero_id (ignora query param).
 * @param {string} req.tenant_id - inyectado por tenantMiddleware
 * @param {string} req.barbero_id - inyectado por verificarToken (solo rol=barbero)
 * @param {string} [req.query.barbero_id] - opcional, solo para admin
 * @returns {JSON} array de { id, nombre, email, telefono, total_visitas, ultima_visita }
 */
export const getMisClientes = async (req, res) => {
  const barbero_id = req.rol === 'barbero'
    ? req.barbero_id
    : req.query.barbero_id;

  console.log('[clientes] getMisClientes — request recibido | tenant:', req.tenant_id,
    '| barbero_id:', barbero_id ?? '(todos)');

  if (!barbero_id) {
    return res.status(400).json({ error: 'barbero_id es requerido' });
  }

  try {
    const result = await query(
      `SELECT c.id, c.nombre, c.email, c.telefono,
              COUNT(t.id)::int AS total_visitas,
              MAX(t.inicio)    AS ultima_visita
       FROM cliente c
       JOIN turno t ON t.cliente_id = c.id
       WHERE t.barbero_id = $1
         AND t.tenant_id  = $2
         AND t.estado IN ('completado', 'reservado')
       GROUP BY c.id, c.nombre, c.email, c.telefono
       ORDER BY ultima_visita DESC`,
      [barbero_id, req.tenant_id]
    );
    console.log('[clientes] getMisClientes — completado |', result.rows.length, 'clientes');
    res.json(result.rows);
  } catch (err) {
    console.error('[clientes] Error en getMisClientes:', err.message);
    res.status(500).json({ error: 'Error al obtener clientes del barbero' });
  }
};

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
