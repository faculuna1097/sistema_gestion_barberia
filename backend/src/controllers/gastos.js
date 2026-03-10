// /backend/src/controllers/gastos.js
// Controlador del recurso "gasto".
// Registra un nuevo gasto con su categoría y pagador.

import { query } from '../config/db.js';

const TENANT_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

/**
 * createGasto
 * Registra un nuevo gasto en la base de datos.
 * No requiere transacción porque solo escribe en una tabla.
 *
 * @param {Request} req - Body esperado:
 *   {
 *     categoria_id: string (UUID),
 *     descripcion: string,
 *     monto: number,
 *     pagado_por: string (ej: 'negocio' | 'administrador')
 *   }
 * @param {Response} res - Devuelve el gasto creado con su id
 */
export const createGasto = async (req, res) => {
  const { categoria_id, descripcion, monto, pagado_por } = req.body;

  if (!categoria_id || !descripcion || !monto || !pagado_por) {
    return res.status(400).json({ error: 'Faltan campos requeridos: categoria_id, descripcion, monto, pagado_por' });
  }

  try {
    const result = await query(
      `INSERT INTO gasto (tenant_id, categoria_id, descripcion, monto, pagado_por, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [TENANT_ID, categoria_id, descripcion, monto, pagado_por, null]
    );

    res.status(201).json({
      message: 'Gasto registrado correctamente',
      gasto_id: result.rows[0].id
    });

  } catch (error) {
    console.error('Error en createGasto:', error);
    res.status(500).json({ error: 'Error al registrar el gasto' });
  }
};