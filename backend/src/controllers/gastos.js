// /backend/src/controllers/gastos.js
// Controlador del recurso "gasto".
// Todas las funciones usan req.tenant_id, inyectado por tenantMiddleware
// en rutas públicas (desde .env) y por verificarToken en rutas protegidas (desde JWT).

import { query } from '../config/db.js';

const TZ = 'America/Argentina/Buenos_Aires';

/**
 * createGasto
 * Registra un nuevo gasto en la tabla `gasto`.
 * Ruta pública — req.tenant_id viene del tenantMiddleware (desde .env).
 * @param {string} req.tenant_id            - Inyectado por tenantMiddleware
 * @param {string} req.body.categoria_id    - UUID de la categoría
 * @param {string} req.body.descripcion     - Descripción del gasto
 * @param {number} req.body.monto           - Monto del gasto
 * @param {string} req.body.forma_pago      - 'efectivo' | 'mercado_pago'
 * @returns {JSON} El gasto creado
 */
export const createGasto = async (req, res) => {
  console.log('[gastos] createGasto — request recibido | tenant:', req.tenant_id);

  const { categoria_id, descripcion, monto, forma_pago, usuario_registro } = req.body;

  if (!categoria_id || !descripcion || !monto || !forma_pago) {
    console.warn('[gastos] createGasto — validación fallida | campos faltantes:', { categoria_id, descripcion, monto, forma_pago });
    return res.status(400).json({ error: 'Faltan campos requeridos: categoria_id, descripcion, monto, forma_pago' });
  }

  if (!['efectivo', 'mercado_pago'].includes(forma_pago)) {
    return res.status(400).json({ error: "forma_pago debe ser 'efectivo' o 'mercado_pago'" });
  }

  try {
    const resultado = await query(
      `INSERT INTO gasto (tenant_id, categoria_id, descripcion, monto, forma_pago, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.tenant_id, categoria_id, descripcion, monto, forma_pago, usuario_registro ?? null]
    );

    const gastoCreado = resultado.rows[0];
    console.log('[gastos] createGasto — completado | gasto_id:', gastoCreado.id, '| monto:', monto);
    return res.status(201).json(gastoCreado);

  } catch (err) {
    console.error('[gastos] Error en createGasto:', err.message);
    return res.status(500).json({ error: 'Error interno al registrar el gasto' });
  }
};

/**
 * getGastosMensual
 * Devuelve todos los gastos de un mes para el tenant actual.
 * Ruta protegida — req.tenant_id inyectado por verificarToken.
 * @param {string} req.query.mes  - Mes en formato YYYY-MM (default: mes actual)
 * @param {string} req.tenant_id  - Inyectado por verificarToken
 * @returns {JSON} { gastos, totalesPorCategoria, totalGeneral }
 */
export const getGastosMensual = async (req, res) => {
  const mes = req.query.mes || new Date().toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);
  console.log('[gastos] getGastosMensual — request recibido | mes:', mes, '| tenant:', req.tenant_id);

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "El parámetro 'mes' debe tener formato YYYY-MM" });
  }

  try {
    const resultadoGastos = await query(
      `SELECT
         g.id,
         TO_CHAR(g.timestamp AT TIME ZONE $3, 'DD/MM/YYYY') AS fecha,
         TO_CHAR(g.timestamp AT TIME ZONE $3, 'HH24:MI')    AS hora,
         COALESCE(cg.nombre, 'Sin categoría') AS categoria_nombre,
         g.descripcion,
         g.monto,
         g.forma_pago
       FROM gasto g
       LEFT JOIN categoria_gasto cg ON g.categoria_id = cg.id
       WHERE g.tenant_id = $1
         AND TO_CHAR(g.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
       ORDER BY g.timestamp DESC`,
      [req.tenant_id, mes, TZ]
    );

    const resultadoTotales = await query(
      `SELECT
         COALESCE(cg.nombre, 'Sin categoría') AS categoria_nombre,
         SUM(g.monto)                          AS total,
         COUNT(g.id)                           AS cantidad
       FROM gasto g
       LEFT JOIN categoria_gasto cg ON g.categoria_id = cg.id
       WHERE g.tenant_id = $1
         AND TO_CHAR(g.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
       GROUP BY cg.nombre
       ORDER BY total DESC`,
      [req.tenant_id, mes, TZ]
    );

    const totalGeneral = resultadoTotales.rows.reduce((acc, row) => acc + parseFloat(row.total), 0);

    console.log('[gastos] getGastosMensual — completado | mes:', mes, '| registros:', resultadoGastos.rows.length, '| total:', totalGeneral);
    return res.status(200).json({
      gastos: resultadoGastos.rows,
      totalesPorCategoria: resultadoTotales.rows,
      totalGeneral,
    });

  } catch (err) {
    console.error('[gastos] Error en getGastosMensual:', err.message);
    return res.status(500).json({ error: 'Error interno al obtener los gastos del mes' });
  }
};

/**
 * deleteGasto
 * Elimina un gasto por su ID, verificando que pertenezca al tenant.
 * Ruta protegida — req.tenant_id inyectado por verificarToken.
 * @param {string} req.params.id  - UUID del gasto a eliminar
 * @param {string} req.tenant_id  - Inyectado por verificarToken
 * @returns {JSON} { eliminado: true, id } o error
 */
export const deleteGasto = async (req, res) => {
  const { id } = req.params;
  console.log('[gastos] deleteGasto — request recibido | id:', id, '| tenant:', req.tenant_id);

  if (!id) {
    return res.status(400).json({ error: 'Falta el parámetro id' });
  }

  try {
    const resultado = await query(
      `DELETE FROM gasto WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, req.tenant_id]
    );

    if (resultado.rows.length === 0) {
      console.warn('[gastos] deleteGasto — gasto no encontrado | id:', id);
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    console.log('[gastos] deleteGasto — completado | gasto_id:', id);
    return res.status(200).json({ eliminado: true, id });

  } catch (err) {
    console.error('[gastos] Error en deleteGasto:', err.message);
    return res.status(500).json({ error: 'Error interno al eliminar el gasto' });
  }
};