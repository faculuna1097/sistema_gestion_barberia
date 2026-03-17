// /backend/src/controllers/gastos.js
// Controlador del recurso "gasto".

import { query } from '../config/db.js';

const TENANT_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

/**
 * createGasto
 * Registra un nuevo gasto en la tabla `gasto`.
 *
 * @param {Request} req - Body esperado:
 *   {
 *     categoria_id: string (UUID),
 *     descripcion: string,
 *     monto: number,
 *     forma_pago: 'efectivo' | 'mercado_pago',
 *     usuario_registro: string | null
 *   }
 * @param {Response} res - Devuelve el gasto creado
 */
export const createGasto = async (req, res) => {
  console.log('[createGasto] Solicitud recibida — body:', req.body);

  const { categoria_id, descripcion, monto, forma_pago, usuario_registro } = req.body;

  if (!categoria_id || !descripcion || !monto || !forma_pago) {
    console.warn('[createGasto] Validación fallida — campos faltantes:', { categoria_id, descripcion, monto, forma_pago });
    return res.status(400).json({ error: 'Faltan campos requeridos: categoria_id, descripcion, monto, forma_pago' });
  }

  if (!['efectivo', 'mercado_pago'].includes(forma_pago)) {
    return res.status(400).json({ error: "forma_pago debe ser 'efectivo' o 'mercado_pago'" });
  }

  try {
    console.log('[createGasto] Insertando gasto — categoria_id:', categoria_id, '| monto:', monto, '| forma_pago:', forma_pago);

    const resultado = await query(
      `INSERT INTO gasto (tenant_id, categoria_id, descripcion, monto, forma_pago, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [TENANT_ID, categoria_id, descripcion, monto, forma_pago, usuario_registro ?? null]
    );

    const gastoCreado = resultado.rows[0];
    console.log('[createGasto] Gasto registrado correctamente — gasto_id:', gastoCreado.id);

    return res.status(201).json(gastoCreado);

  } catch (err) {
    console.error('[createGasto] Error al insertar gasto:', err);
    return res.status(500).json({ error: 'Error interno al registrar el gasto' });
  }
};

/**
 * getGastosMensual
 * Devuelve todos los gastos de un mes para el tenant actual.
 * Incluye totales por categoría y total general calculados en el servidor.
 *
 * @param {Request} req - Query param: mes (formato 'YYYY-MM'). Default: mes actual.
 * @param {Response} res - Devuelve { gastos, totalesPorCategoria, totalGeneral }
 */
export const getGastosMensual = async (req, res) => {
  console.log('[getGastosMensual] Solicitud recibida — query:', req.query);

  const mes = req.query.mes || new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires'
  }).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "El parámetro 'mes' debe tener formato YYYY-MM" });
  }

  try {
    const resultadoGastos = await query(
      `SELECT
         g.id,
         TO_CHAR(g.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') AS fecha,
         TO_CHAR(g.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI')    AS hora,
         COALESCE(cg.nombre, 'Sin categoría') AS categoria_nombre,
         g.descripcion,
         g.monto,
         g.forma_pago
       FROM gasto g
       LEFT JOIN categoria_gasto cg ON g.categoria_id = cg.id
       WHERE g.tenant_id = $1
         AND TO_CHAR(g.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') = $2
       ORDER BY g.timestamp DESC`,
      [TENANT_ID, mes]
    );

    const resultadoTotales = await query(
      `SELECT
         COALESCE(cg.nombre, 'Sin categoría') AS categoria_nombre,
         SUM(g.monto)                          AS total,
         COUNT(g.id)                           AS cantidad
       FROM gasto g
       LEFT JOIN categoria_gasto cg ON g.categoria_id = cg.id
       WHERE g.tenant_id = $1
         AND TO_CHAR(g.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') = $2
       GROUP BY cg.nombre
       ORDER BY total DESC`,
      [TENANT_ID, mes]
    );

    const totalGeneral = resultadoTotales.rows.reduce(
      (acc, row) => acc + parseFloat(row.total), 0
    );

    console.log('[getGastosMensual] Consulta completada — mes:', mes,
      '| registros:', resultadoGastos.rows.length,
      '| total general:', totalGeneral);

    return res.status(200).json({
      gastos: resultadoGastos.rows,
      totalesPorCategoria: resultadoTotales.rows,
      totalGeneral,
    });

  } catch (err) {
    console.error('[getGastosMensual] Error al consultar gastos mensuales:', err);
    return res.status(500).json({ error: 'Error interno al obtener los gastos del mes' });
  }
};

/**
 * deleteGasto
 * Elimina un gasto por su ID, verificando que pertenezca al tenant.
 *
 * @param {Request} req - Param: id (UUID del gasto a eliminar)
 * @param {Response} res - 200 con { eliminado: true, id } o error
 */
export const deleteGasto = async (req, res) => {
  const { id } = req.params;
  console.log('[deleteGasto] Solicitud recibida — id:', id);

  if (!id) {
    return res.status(400).json({ error: 'Falta el parámetro id' });
  }

  try {
    const resultado = await query(
      `DELETE FROM gasto
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [id, TENANT_ID]
    );

    if (resultado.rows.length === 0) {
      console.warn('[deleteGasto] Gasto no encontrado o no pertenece al tenant — id:', id);
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    console.log('[deleteGasto] Gasto eliminado correctamente — id:', id);
    return res.status(200).json({ eliminado: true, id });

  } catch (err) {
    console.error('[deleteGasto] Error al eliminar gasto:', err);
    return res.status(500).json({ error: 'Error interno al eliminar el gasto' });
  }
};
