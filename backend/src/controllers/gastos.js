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

  // Validación de campos requeridos
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
