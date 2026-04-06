// /backend/src/controllers/cortes.js
// Controlador del recurso "corte".
// Usa inserts secuenciales con cleanup manual en lugar de transacciones formales,
// por compatibilidad con Supabase Session Pooler (PgBouncer).

import { query } from '../config/db.js';

/**
 * createCorte
 * Registra un nuevo corte con su servicio asociado.
 * Flujo: inserta el corte con servicio_id y precio directamente.
 * Si algo falla, borra el corte para evitar huérfanos.
 * @param {string}   req.tenant_id        - Inyectado por tenantMiddleware
 * @param {string}   req.body.barbero_id  - UUID del barbero
 * @param {string}   req.body.servicio_id - UUID del servicio
 * @param {number}   req.body.precio      - Precio del servicio al momento del registro
 * @param {string}   req.body.forma_pago  - 'efectivo' | 'mercado_pago'
 * @param {number}   req.body.propina     - Monto de propina (default: 0)
 * @returns {JSON} { message, corte_id, monto_total }
 */
export const createCorte = async (req, res) => {
  console.log('[cortes] createCorte — request recibido | tenant:', req.tenant_id);

  const { barbero_id, servicio_id, precio, forma_pago, propina } = req.body;

  if (!barbero_id || !servicio_id || precio === undefined || !forma_pago) {
    console.warn('[cortes] createCorte — validación fallida | campos faltantes:', {
      barbero_id, servicio_id, precio, forma_pago
    });
    return res.status(400).json({
      error: 'Faltan campos requeridos: barbero_id, servicio_id, precio, forma_pago'
    });
  }

  const monto_total = Number(precio) + Number(propina || 0);
  let corteId = null;

  try {
    const corteResult = await query(
      `INSERT INTO corte (tenant_id, barbero_id, servicio_id, precio, forma_pago, propina, monto_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [req.tenant_id, barbero_id, servicio_id, Number(precio), forma_pago, Number(propina || 0), monto_total]
    );

    corteId = corteResult.rows[0].id;

    console.log('[cortes] createCorte — completado | corte_id:', corteId, '| monto_total:', monto_total);
    res.status(201).json({
      message: 'Corte registrado correctamente',
      corte_id: corteId,
      monto_total
    });

  } catch (err) {
    console.error('[cortes] Error en createCorte | corte_id al momento del fallo:', corteId, '| error:', err.message);

    if (corteId) {
      console.warn('[cortes] createCorte — iniciando cleanup | eliminando corte huérfano:', corteId);
      await query('DELETE FROM corte WHERE id = $1', [corteId]).catch((cleanupErr) => {
        console.error('[cortes] createCorte — error en cleanup:', cleanupErr.message);
      });
      console.log('[cortes] createCorte — cleanup completado | corte eliminado:', corteId);
    }

    res.status(500).json({ error: 'Error al registrar el corte' });
  }
};
