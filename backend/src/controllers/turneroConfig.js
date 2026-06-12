// /backend/src/controllers/turneroConfig.js
// Handlers para la configuración del turnero a nivel tenant.
// Solo admin (requiereRol('admin') se aplica en index.js).

import { query } from '../config/db.js';

/**
 * getConfig — obtiene la configuración actual del turnero del tenant.
 * @param {string} req.tenant_id - inyectado por verificarToken
 * @returns {JSON} { duracion_slot_minutos }
 */
export const getConfig = async (req, res) => {
  try {
    const result = await query(
      `SELECT duracion_slot_minutos FROM tenant WHERE id = $1`,
      [req.tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[turneroConfig] Error en getConfig:', err);
    res.status(500).json({ error: 'Error al obtener configuración del turnero' });
  }
};

/**
 * putConfig — actualiza la configuración del turnero del tenant.
 * @param {string} req.tenant_id - inyectado por verificarToken
 * @param {number} req.body.duracion_slot_minutos - duración en minutos (1-240)
 * @returns {JSON} { duracion_slot_minutos }
 */
export const putConfig = async (req, res) => {
  const { duracion_slot_minutos } = req.body;

  if (duracion_slot_minutos == null) {
    return res.status(400).json({ error: 'duracion_slot_minutos es requerido' });
  }

  const valor = Number(duracion_slot_minutos);
  if (!Number.isInteger(valor) || valor < 1 || valor > 240) {
    return res.status(400).json({ error: 'duracion_slot_minutos debe ser un entero entre 1 y 240' });
  }

  try {
    const result = await query(
      `UPDATE tenant
       SET duracion_slot_minutos = $1
       WHERE id = $2
       RETURNING duracion_slot_minutos`,
      [valor, req.tenant_id]
    );
    console.log('[turneroConfig] putConfig completado | duracion_slot_minutos:', result.rows[0].duracion_slot_minutos);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[turneroConfig] Error en putConfig:', err);
    res.status(500).json({ error: 'Error al actualizar configuración del turnero' });
  }
};
