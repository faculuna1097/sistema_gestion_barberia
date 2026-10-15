// /backend/src/services/descansosService.js
// Lógica de negocio de los descansos: el barbero (o el admin) marca slots libres
// y futuros de un día como "no atiendo". Un descanso es una fila de
// barbero_suspension con tipo = 'descanso' (plan_app_barbero.md, Feature 1, D1).
// Se libera con el mismo DELETE /api/admin/suspensiones/:id (liberarSuspension).
//
// Va en su propio archivo porque usa la grilla de disponibilidadService y el SQL
// del rango efectivo de suspensionesService; adentro de suspensionesService
// armaría un import circular (disponibilidadService ya importa de ahí).

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { TZ } from '../utils/constantes.js';
import { calcularGrillaDelDia } from './disponibilidadService.js';
import { suspensionSolapaSql } from './suspensionesService.js';

/**
 * Arma un error tipado de crearDescanso que el controller mapea a HTTP.
 * @param {string} code - 'RANGO_INVALIDO' | 'NO_FUTURO' | 'OCUPADO'
 * @param {string} mensaje - texto para el usuario
 * @returns {Error}
 */
const errorDescanso = (code, mensaje) => {
  const err = new Error(mensaje);
  err.code = code;
  return err;
};

/**
 * tramoDeLaGrilla
 * Busca en la grilla los slots que cubren exactamente [desde, hasta): el primero
 * empieza en `desde`, cada uno empieza donde terminó el anterior y el último
 * termina en `hasta`. Función pura.
 * Devuelve null si el rango está desalineado, cae fuera de un bloque, cruza el
 * hueco entre dos bloques (después del último slot de un bloque sigue el primero
 * del otro, que no es continuo) o pasa a otro día.
 *
 * @param {Array<{ inicio: DateTime, fin: DateTime, estado: string }>} grilla - De calcularGrillaDelDia, ordenada
 * @param {DateTime} desde
 * @param {DateTime} hasta
 * @returns {Array|null} los slots del tramo, o null si el rango no coincide con la grilla
 */
const tramoDeLaGrilla = (grilla, desde, hasta) => {
  const primero = grilla.findIndex(s => +s.inicio === +desde);
  if (primero === -1) return null;

  const tramo = [];
  for (let i = primero; i < grilla.length; i++) {
    const slot = grilla[i];
    if (tramo.length > 0 && +slot.inicio !== +tramo[tramo.length - 1].fin) return null;
    tramo.push(slot);
    if (+slot.fin === +hasta) return tramo;
    if (slot.fin > hasta) return null;
  }
  return null;
};

/**
 * Crea un descanso sobre slots libres y futuros de un día del barbero.
 *
 * Valida contra la grilla del barbero (calcularGrillaDelDia, el mismo anclaje que
 * el turnero): el rango tiene que coincidir con slots consecutivos de un bloque,
 * el primero tiene que empezar después de ahora y todos tienen que estar libres.
 * Un descanso nunca cancela turnos (D6).
 *
 * El INSERT repite los chequeos de ocupación en la misma sentencia (NOT EXISTS de
 * turnos reservados y de suspensiones vigentes que se superpongan): cubre una
 * reserva o un descanso que entra entre la lectura de la grilla y la escritura.
 * Queda el TOCTOU sistémico con una escritura en el mismo instante
 * (auditoria_2026-07.md). No es idempotente: va sin reintento.
 *
 * @param {Object} datos
 * @param {string} datos.tenantId
 * @param {string} datos.barberoId - Ya validado por el controller
 * @param {DateTime} datos.desde - Inicio, de parsearInstante
 * @param {DateTime} datos.hasta - Fin, de parsearInstante (posterior a desde)
 * @param {string} datos.origen - 'admin' | 'barbero'
 * @returns {Promise<Object>} la fila creada { id, barbero_id, desde, hasta, motivo, origen, tipo, created_at }
 * @throws {{ code: 'RANGO_INVALIDO' | 'NO_FUTURO' | 'OCUPADO' }}
 */
export const crearDescanso = async ({ tenantId, barberoId, desde, hasta, origen }) => {
  const { grilla } = await calcularGrillaDelDia({ tenantId, barberoId, fecha: desde.toISODate() });

  const tramo = tramoDeLaGrilla(grilla, desde, hasta);
  if (!tramo) {
    throw errorDescanso('RANGO_INVALIDO', 'El rango tiene que coincidir con slots seguidos del horario del barbero, en un mismo día');
  }
  if (tramo[0].inicio <= DateTime.now().setZone(TZ)) {
    throw errorDescanso('NO_FUTURO', 'El descanso tiene que empezar en un slot que todavía no arrancó');
  }
  if (tramo.some(s => s.estado !== 'libre')) {
    throw errorDescanso('OCUPADO', 'Algún horario del rango ya está ocupado');
  }

  const result = await query(
    `INSERT INTO barbero_suspension (tenant_id, barbero_id, desde, hasta, motivo, origen, tipo)
     SELECT $1::uuid, $2::uuid, $3::timestamptz, $4::timestamptz, NULL, $5::text, 'descanso'
     WHERE NOT EXISTS (
       SELECT 1 FROM turno t
       WHERE t.tenant_id = $1::uuid AND t.barbero_id = $2::uuid AND t.estado = 'reservado'
         AND t.inicio < $4::timestamptz AND t.fin > $3::timestamptz
     )
     AND NOT EXISTS (
       SELECT 1 FROM barbero_suspension bs
       WHERE bs.tenant_id = $1::uuid AND bs.barbero_id = $2::uuid
         AND ${suspensionSolapaSql('bs', '$3::timestamptz', '$4::timestamptz')}
     )
     RETURNING id, barbero_id, desde, hasta, motivo, origen, tipo, created_at`,
    [tenantId, barberoId, desde.toISO(), hasta.toISO(), origen],
    { reintentar: false }
  );

  // Sin filas: entre la lectura de la grilla y el INSERT se ocupó algún slot.
  if (result.rows.length === 0) {
    throw errorDescanso('OCUPADO', 'Algún horario del rango ya está ocupado');
  }
  return result.rows[0];
};
