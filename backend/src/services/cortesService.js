// /backend/src/services/cortesService.js
// Lógica de negocio del recurso "corte". El insertador central registrarCorte
// es el ÚNICO punto del sistema que crea un corte: lo usan el flujo operativo
// del iPad (controllers/cortes.js → createCorte) y la completación de un turno
// desde el backoffice (services/turnosService.js → completarTurnoConCorte).
// Tener un solo insertador garantiza que "registrar el corte" y "marcar el turno
// completado" no puedan divergir entre las dos vías.
//
// Usa inserts secuenciales con cleanup manual en lugar de transacciones formales,
// por compatibilidad con Supabase Session Pooler (PgBouncer, ver convenciones §6).

import { query } from '../config/db.js';

/**
 * registrarCorte
 * Inserta un corte y, si viene turnoId, marca ese turno como 'completado' y
 * sincroniza turno.servicio_id con el servicio del corte (consistencia corte↔turno).
 * Insertador central de cortes (ver cabecera del archivo). El UNIQUE parcial en
 * corte.turno_id previene doble vinculación por doble click o por carrera entre
 * el iPad y el backoffice. Traduce los códigos de error de Postgres a errores
 * tipados (err.code) para que cada controller los mapee a su status HTTP,
 * siguiendo el mismo idiom que el resto de turnosService.
 *
 * @param {Object} datos
 * @param {string} datos.tenantId    - UUID del tenant (multi-tenancy, §5)
 * @param {string} datos.barberoId   - UUID del barbero
 * @param {string} datos.servicioId  - UUID del servicio
 * @param {number} datos.precio      - Precio del servicio al momento del registro
 * @param {string} datos.formaPago   - 'efectivo' | 'mercado_pago'
 * @param {number} [datos.propina]   - Monto de propina (default: 0)
 * @param {string} [datos.turnoId]   - UUID del turno asociado (null para walk-ins)
 * @returns {Promise<{ corte_id: string, monto_total: number }>}
 * @throws {{ code: 'TURNO_YA_VINCULADO' | 'TURNO_INEXISTENTE' | 'UUID_INVALIDO' }}
 *         para los conflictos conocidos; cualquier otro error se propaga crudo.
 */
export const registrarCorte = async ({
  tenantId, barberoId, servicioId, precio, formaPago, propina, turnoId,
}) => {
  const monto_total = Number(precio) + Number(propina || 0);
  let corteId = null;

  try {
    // 1. INSERT del corte (con turno_id si viene, null si es walk-in)
    const corteResult = await query(
      `INSERT INTO corte (tenant_id, barbero_id, servicio_id, precio, forma_pago, propina, monto_total, turno_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [tenantId, barberoId, servicioId, Number(precio), formaPago, Number(propina || 0), monto_total, turnoId || null]
    );
    corteId = corteResult.rows[0].id;

    // 2. Si hay turno vinculado, marcarlo como completado (solo si seguía reservado).
    //    Sincroniza también turno.servicio_id con el servicio del corte: el iPad y el
    //    backoffice permiten cambiar el servicio al completar, y así el turno queda
    //    consistente con lo que realmente se hizo. Una sola UPDATE = atómica (§6).
    if (turnoId) {
      const updateResult = await query(
        `UPDATE turno SET estado = 'completado', servicio_id = $3
         WHERE id = $1 AND tenant_id = $2 AND estado = 'reservado'`,
        [turnoId, tenantId, servicioId]
      );

      if (updateResult.rowCount === 0) {
        console.warn('[cortesService] registrarCorte — turno no actualizado (no existe, otro tenant, o ya no está reservado) | turno_id:', turnoId);
      } else {
        console.log('[cortesService] registrarCorte — turno marcado como completado | turno_id:', turnoId);
      }
    }

    console.log('[cortesService] registrarCorte completado | corte_id:', corteId);
    return { corte_id: corteId, monto_total };

  } catch (err) {
    // Cleanup: si el corte se insertó pero el UPDATE del turno falló, borrar el
    // corte huérfano. (En los conflictos de INSERT de abajo corteId sigue null,
    // así que este guard es no-op para esos casos.)
    if (corteId) {
      await query('DELETE FROM corte WHERE id = $1', [corteId]).catch((cleanupErr) => {
        console.error('[cortesService] registrarCorte — error en cleanup:', cleanupErr);
      });
    }

    // Traducción de códigos PG → errores tipados (cada controller mapea a HTTP).
    // UNIQUE parcial violado: turno_id ya vinculado a otro corte.
    if (err.code === '23505' && err.constraint === 'corte_turno_unico') {
      console.warn('[cortesService] registrarCorte — turno ya vinculado a otro corte | turno_id:', turnoId);
      const e = new Error('Este turno ya tiene un corte registrado');
      e.code = 'TURNO_YA_VINCULADO';
      throw e;
    }
    // FK violation: turno_id no existe en la tabla turno.
    if (err.code === '23503' && err.message.includes('turno_id')) {
      console.warn('[cortesService] registrarCorte — turno_id inexistente | turno_id:', turnoId);
      const e = new Error('El turno_id proporcionado no existe');
      e.code = 'TURNO_INEXISTENTE';
      throw e;
    }
    // UUID con formato inválido.
    if (err.code === '22P02') {
      console.warn('[cortesService] registrarCorte — UUID con formato inválido | turno_id:', turnoId);
      const e = new Error('El turno_id tiene un formato inválido');
      e.code = 'UUID_INVALIDO';
      throw e;
    }

    // Cualquier otro error se propaga crudo (el controller lo loguea + responde 500).
    throw err;
  }
};
