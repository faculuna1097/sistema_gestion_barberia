// /backend/src/controllers/cortes.js
// Controlador del recurso "corte".
// Usa inserts secuenciales con cleanup manual en lugar de transacciones formales,
// por compatibilidad con Supabase Session Pooler (PgBouncer).

import { query } from '../config/db.js';

/**
 * createCorte
 * Registra un nuevo corte con su servicio asociado.
 * Si viene turno_id, vincula el corte al turno y marca el turno como 'completado'.
 * Usa inserts secuenciales con cleanup manual (Session Pooler no soporta transacciones).
 * El UNIQUE parcial en corte.turno_id previene doble vinculación por doble click.
 * @param {string}   req.tenant_id         - Inyectado por tenantMiddleware
 * @param {string}   req.body.barbero_id   - UUID del barbero
 * @param {string}   req.body.servicio_id  - UUID del servicio
 * @param {number}   req.body.precio       - Precio del servicio al momento del registro
 * @param {string}   req.body.forma_pago   - 'efectivo' | 'mercado_pago'
 * @param {number}   req.body.propina      - Monto de propina (default: 0)
 * @param {string}   [req.body.turno_id]   - UUID del turno asociado (opcional, null para walk-ins)
 * @returns {JSON} { message, corte_id, monto_total }
 */
export const createCorte = async (req, res) => {
  console.log('[cortes] createCorte — request recibido | tenant:', req.tenant_id);

  const { barbero_id, servicio_id, precio, forma_pago, propina, turno_id } = req.body;

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
    // 1. INSERT del corte (con turno_id si viene, null si es walk-in)
    const corteResult = await query(
      `INSERT INTO corte (tenant_id, barbero_id, servicio_id, precio, forma_pago, propina, monto_total, turno_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [req.tenant_id, barbero_id, servicio_id, Number(precio), forma_pago, Number(propina || 0), monto_total, turno_id || null]
    );

    corteId = corteResult.rows[0].id;

    // 2. Si hay turno vinculado, marcar como completado
    if (turno_id) {
      const updateResult = await query(
        `UPDATE turno SET estado = 'completado'
         WHERE id = $1 AND tenant_id = $2 AND estado = 'reservado'`,
        [turno_id, req.tenant_id]
      );

      if (updateResult.rowCount === 0) {
        console.warn('[cortes] createCorte — turno no actualizado (no existe, otro tenant, o ya no está reservado) | turno_id:', turno_id);
      } else {
        console.log('[cortes] createCorte — turno marcado como completado | turno_id:', turno_id);
      }
    }

    console.log('[cortes] createCorte — completado | corte_id:', corteId, '| monto_total:', monto_total, '| turno_id:', turno_id || 'walk-in');
    res.status(201).json({
      message: 'Corte registrado correctamente',
      corte_id: corteId,
      monto_total
    });

  } catch (err) {
    // UNIQUE parcial violado: turno_id ya vinculado a otro corte
    if (err.code === '23505' && err.constraint === 'corte_turno_unico') {
      console.warn('[cortes] createCorte — turno ya vinculado a otro corte | turno_id:', turno_id);
      return res.status(409).json({ error: 'Este turno ya tiene un corte registrado' });
    }

    // UUID con formato inválido
    if (err.code === '22P02') {
      console.warn('[cortes] createCorte — UUID con formato inválido | turno_id:', turno_id);
      return res.status(400).json({ error: 'El turno_id tiene un formato inválido' });
    }

    // FK violation: turno_id no existe en la tabla turno
    if (err.code === '23503' && err.message.includes('turno_id')) {
      console.warn('[cortes] createCorte — turno_id inexistente | turno_id:', turno_id);
      return res.status(400).json({ error: 'El turno_id proporcionado no existe' });
    }

    console.error('[cortes] Error en createCorte | corte_id al momento del fallo:', corteId, '| error:', err.message);

    // Cleanup: si el corte se insertó pero el UPDATE del turno falló, eliminar el corte huérfano
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
