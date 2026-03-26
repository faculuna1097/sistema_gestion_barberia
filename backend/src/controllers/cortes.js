// /backend/src/controllers/cortes.js
// Controlador del recurso "corte".
// Usa inserts secuenciales con cleanup manual en lugar de transacciones formales,
// por compatibilidad con Supabase Session Pooler (PgBouncer).

import { query } from '../config/db.js';

/**
 * createCorte
 * Registra un nuevo corte y sus servicios asociados.
 * Flujo: inserta corte → inserta cada servicio en corte_servicio →
 * si algo falla después del primer insert, borra el corte para evitar huérfanos.
 * @param {string}   req.tenant_id       - Inyectado por tenantMiddleware
 * @param {string}   req.body.barbero_id - UUID del barbero
 * @param {Array}    req.body.servicios  - Array de { id: string, precio: number }
 * @param {string}   req.body.forma_pago - 'efectivo' | 'mercado_pago'
 * @param {number}   req.body.propina    - Monto de propina (default: 0)
 * @returns {JSON} { message, corte_id, monto_total }
 */
export const createCorte = async (req, res) => {
  console.log('[cortes] createCorte — request recibido | tenant:', req.tenant_id);

  const { barbero_id, servicios, forma_pago, propina } = req.body;

  if (!barbero_id || !servicios || !servicios.length || !forma_pago) {
    console.warn('[cortes] createCorte — validación fallida | campos faltantes:', { barbero_id, forma_pago, servicios_length: servicios?.length });
    return res.status(400).json({
      error: 'Faltan campos requeridos: barbero_id, servicios, forma_pago'
    });
  }

  const monto_total = servicios.reduce((sum, s) => sum + Number(s.precio), 0);
  let corteId = null;

  try {
    // 1. Insertar el corte principal
    const corteResult = await query(
      `INSERT INTO corte (tenant_id, barbero_id, forma_pago, propina, monto_total, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.tenant_id, barbero_id, forma_pago, propina || 0, monto_total, null]
    );

    corteId = corteResult.rows[0].id;
    console.log('[cortes] createCorte — corte insertado | corte_id:', corteId);

    // 2. Insertar cada servicio del corte
    for (const servicio of servicios) {
      await query(
        `INSERT INTO corte_servicio (corte_id, servicio_id, precio)
         VALUES ($1, $2, $3)`,
        [corteId, servicio.id, servicio.precio]
      );
    }

    console.log('[cortes] createCorte — completado | corte_id:', corteId, '| monto_total:', monto_total, '| servicios:', servicios.length);
    res.status(201).json({
      message: 'Corte registrado correctamente',
      corte_id: corteId,
      monto_total
    });

  } catch (err) {
    console.error('[cortes] Error en createCorte | corte_id al momento del fallo:', corteId, '| error:', err.message);

    // Si algo falló después de insertar el corte, lo eliminamos para evitar registros huérfanos
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