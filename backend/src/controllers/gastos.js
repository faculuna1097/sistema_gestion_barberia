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
  console.log('[createGasto] Solicitud recibida — body:', req.body);

  const { categoria_id, descripcion, monto, pagado_por } = req.body;

  if (!categoria_id || !descripcion || !monto || !pagado_por) {
    console.warn('[createGasto] Validación fallida — campos faltantes:', { categoria_id, descripcion, monto, pagado_por });
    return res.status(400).json({ error: 'Faltan campos requeridos: categoria_id, descripcion, monto, pagado_por' });
  }

  try {
    console.log('[createGasto] Insertando gasto — categoria_id:', categoria_id, '| monto:', monto, '| pagado_por:', pagado_por);
    const result = await query(
      `INSERT INTO gasto (tenant_id, categoria_id, descripcion, monto, pagado_por, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [TENANT_ID, categoria_id, descripcion, monto, pagado_por, null]
    );

    const gasto_id = result.rows[0].id;
    console.log('[createGasto] Gasto registrado correctamente — gasto_id:', gasto_id);

    res.status(201).json({
      message: 'Gasto registrado correctamente',
      gasto_id
    });

  } catch (error) {
    console.error('[createGasto] Error al insertar en la base de datos:', error);
    res.status(500).json({ error: 'Error al registrar el gasto' });
  }
};