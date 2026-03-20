// /backend/src/controllers/cortes.js
// Controlador del recurso "corte".
// Usa inserts secuenciales con cleanup manual en lugar de transacciones formales,
// por compatibilidad con Supabase Session Pooler (PgBouncer).
// req.tenant_id inyectado por tenantMiddleware (desde .env).

import { query } from '../config/db.js';

/**
 * createCorte
 * Registra un nuevo corte y sus servicios asociados.
 * Flujo: inserta corte → inserta cada servicio → si algo falla, borra el corte.
 *
 * @param {Request} req - Body esperado:
 *   {
 *     barbero_id: string (UUID),
 *     servicios: Array<{ id: string, precio: number }>,
 *     forma_pago: 'efectivo' | 'mercado_pago',
 *     propina: number
 *   }
 * @param {Response} res - Devuelve { message, corte_id, monto_total }
 */
export const createCorte = async (req, res) => {
  console.log('[createCorte] Solicitud recibida — body:', req.body);

  const { barbero_id, servicios, forma_pago, propina } = req.body;

  if (!barbero_id || !servicios || !servicios.length || !forma_pago) {
    console.warn('[createCorte] Validación fallida — campos faltantes:', { barbero_id, servicios, forma_pago });
    return res.status(400).json({
      error: 'Faltan campos requeridos: barbero_id, servicios, forma_pago'
    });
  }

  const monto_total = servicios.reduce((sum, s) => sum + Number(s.precio), 0);
  console.log('[createCorte] Monto total calculado:', monto_total, '| tenant:', req.tenant_id);

  let corteId = null;

  try {
    // 1. Insertar el corte principal
    console.log('[createCorte] Insertando corte — barbero_id:', barbero_id, '| forma_pago:', forma_pago, '| propina:', propina || 0);
    const corteResult = await query(
      `INSERT INTO corte (tenant_id, barbero_id, forma_pago, propina, monto_total, usuario_registro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.tenant_id, barbero_id, forma_pago, propina || 0, monto_total, null]
    );

    corteId = corteResult.rows[0].id;
    console.log('[createCorte] Corte insertado — corte_id:', corteId);

    // 2. Insertar cada servicio del corte
    for (const servicio of servicios) {
      console.log('[createCorte] Insertando corte_servicio — corte_id:', corteId, '| servicio_id:', servicio.id, '| precio:', servicio.precio);
      await query(
        `INSERT INTO corte_servicio (corte_id, servicio_id, precio)
         VALUES ($1, $2, $3)`,
        [corteId, servicio.id, servicio.precio]
      );
    }

    console.log('[createCorte] Todos los servicios insertados correctamente — corte_id:', corteId);
    res.status(201).json({
      message: 'Corte registrado correctamente',
      corte_id: corteId,
      monto_total
    });

  } catch (error) {
    console.error('[createCorte] Error durante el registro — corte_id al momento del fallo:', corteId, '| error:', error);

    // Si algo falló después de insertar el corte, lo eliminamos para evitar registros huérfanos
    if (corteId) {
      console.warn('[createCorte] Iniciando cleanup — eliminando corte huérfano con id:', corteId);
      await query(`DELETE FROM corte WHERE id = $1`, [corteId]).catch((cleanupError) => {
        console.error('[createCorte] Error en cleanup de corte huérfano:', cleanupError.message);
      });
      console.log('[createCorte] Cleanup completado — corte eliminado:', corteId);
    }

    res.status(500).json({ error: 'Error al registrar el corte' });
  }
};
