// /backend/src/services/cortesService.js
// Lógica de negocio del recurso "corte". El insertador central registrarCorte
// es el ÚNICO punto del sistema que crea un corte: lo usan el flujo operativo
// del iPad (controllers/cortes.js → createCorte) y la completación de un turno
// desde el backoffice (services/turnosService.js → completarTurnoConCorte).
// Tener un solo insertador garantiza que "registrar el corte" y "marcar el turno
// completado" no puedan divergir entre las dos vías.
//
// El corte y el cambio de estado del turno van en una sola sentencia (CTEs que
// modifican datos) en lugar de una transacción formal, por compatibilidad con
// Supabase Session Pooler (PgBouncer, ver convenciones §6).

import { query } from '../config/db.js';
import { TZ } from '../utils/constantes.js';

// Mensaje del 404 de un turno que no existe o no es de ese barbero. Lo comparten
// registrarCorte y el controller, que responde lo mismo ante un turno_id mal formado.
export const MENSAJE_TURNO_INEXISTENTE = 'El turno no existe o es de otro barbero';

// Mensaje del 400 de un corte cuyo total no entra en corte.monto_total. Lo comparten
// los dos controllers que llaman a registrarCorte.
export const MENSAJE_TOTAL_EXCEDIDO = 'precio más propina no puede superar 99.999.999,99';

/**
 * Arma un error tipado de registrarCorte que cada controller mapea a HTTP.
 * @param {string} code - código del error (ver @throws de registrarCorte)
 * @param {string} mensaje - texto para el usuario
 * @returns {Error}
 */
const errorCorte = (code, mensaje) => {
  const e = new Error(mensaje);
  e.code = code;
  return e;
};

/**
 * registrarCorte
 * Inserta un corte y, si viene turnoId, marca ese turno como 'completado' y
 * sincroniza turno.servicio_id con el servicio del corte (consistencia corte↔turno).
 * Insertador central de cortes (ver cabecera del archivo).
 *
 * Todo va en UNA sola sentencia (CTEs que modifican datos, atómica sin
 * BEGIN/COMMIT, convenciones §6): `completado` pasa el turno a completado solo si
 * es de ese barbero y está en uno de `estadosCompletables`, y `nuevo` inserta el
 * corte vinculado a ese turno. Si el turno no se pudo completar:
 * - si está cancelado y `canceladoComoSinTurno`, el corte entra igual, sin turno
 *   (el iPad: el cobro existió y no se puede perder; el turno no se revive porque
 *   el cliente ya recibió el mail de cancelación);
 * - si no, no se inserta nada y una lectura posterior elige el error. Un turno ya
 *   completado nunca cae en "sin turno": su cobro ya está registrado, y un doble
 *   toque cargaría el corte dos veces.
 * El UNIQUE parcial en corte.turno_id sigue como red ante una carrera.
 *
 * @param {Object} datos
 * @param {string} datos.tenantId    - UUID del tenant (multi-tenancy, §5)
 * @param {string} datos.barberoId   - UUID del barbero
 * @param {string} datos.servicioId  - UUID del servicio
 * @param {number} datos.precio      - Precio del servicio al momento del registro
 * @param {string} datos.formaPago   - 'efectivo' | 'mercado_pago'
 * @param {number} [datos.propina]   - Monto de propina (default: 0)
 * @param {string} [datos.turnoId]   - UUID del turno asociado (null para walk-ins)
 * @param {string[]} [datos.estadosCompletables] - estados del turno que pasan a
 *   completado (default: solo 'reservado'). 'no_asistio' corrige una falta mal
 *   marcada: el cliente vino.
 * @param {boolean} [datos.canceladoComoSinTurno] - si el turno está cancelado,
 *   registrar el corte sin turno en vez de rechazarlo (default: false)
 * @returns {Promise<{ corte_id: string, monto_total: number, turno_vinculado: boolean }>}
 *   turno_vinculado es false si vino turnoId y el corte entró sin turno.
 * @throws {{ code: 'TURNO_YA_VINCULADO' | 'TURNO_YA_COMPLETADO' | 'ESTADO_INVALIDO' |
 *   'TURNO_INEXISTENTE' | 'BARBERO_INVALIDO' | 'SERVICIO_INVALIDO' }}
 *   para los conflictos conocidos; cualquier otro error se propaga crudo.
 */
export const registrarCorte = async ({
  tenantId, barberoId, servicioId, precio, formaPago, propina, turnoId,
  estadosCompletables = ['reservado'], canceladoComoSinTurno = false,
}) => {
  const monto_total = Number(precio) + Number(propina || 0);

  let result;
  try {
    // $8 es el turno (o NULL si es walk-in). Con NULL el UPDATE no toca nada y
    // el INSERT entra por la primera condición. No es idempotente: va sin reintento.
    // Un turno marcado 'no_asistio' solo se completa el mismo día del turno (hora
    // argentina, $11): pasado ese día, la marca queda como está.
    result = await query(
      `WITH completado AS (
         UPDATE turno SET estado = 'completado', servicio_id = $3::uuid
          WHERE id = $8::uuid AND tenant_id = $1::uuid AND barbero_id = $2::uuid
            AND estado = ANY($9::text[])
            AND (estado <> 'no_asistio'
                 OR (inicio AT TIME ZONE $11)::date = (now() AT TIME ZONE $11)::date)
         RETURNING id
       ), nuevo AS (
         INSERT INTO corte (tenant_id, barbero_id, servicio_id, precio, forma_pago, propina, monto_total, turno_id)
         SELECT $1::uuid, $2::uuid, $3::uuid, $4::numeric, $5::text, $6::numeric, $7::numeric,
                (SELECT id FROM completado)
          WHERE $8::uuid IS NULL
             OR EXISTS (SELECT 1 FROM completado)
             OR ($10::boolean AND EXISTS (
                  SELECT 1 FROM turno t
                   WHERE t.id = $8::uuid AND t.tenant_id = $1::uuid AND t.barbero_id = $2::uuid
                     AND t.estado = 'cancelado'))
         RETURNING id, turno_id
       )
       SELECT id, turno_id FROM nuevo`,
      [tenantId, barberoId, servicioId, Number(precio), formaPago, Number(propina || 0),
        monto_total, turnoId || null, estadosCompletables, Boolean(canceladoComoSinTurno), TZ],
      { reintentar: false }
    );
  } catch (err) {
    // Traducción de códigos PG → errores tipados (cada controller mapea a HTTP).
    // UNIQUE parcial violado: turno_id ya vinculado a otro corte (red ante una carrera).
    if (err.code === '23505' && err.constraint === 'corte_turno_unico') {
      console.warn('[cortesService] registrarCorte — turno ya vinculado a otro corte | turno_id:', turnoId);
      throw errorCorte('TURNO_YA_VINCULADO', 'Este turno ya tiene un corte registrado');
    }
    // FK compuesto (tenant_id, X) violado (23503): la referencia no existe en
    // este tenant. Con los FK compuestos de la auditoría 2.1, el nombre del
    // constraint identifica cuál referencia falló — más robusto que parsear el
    // mensaje. Backstop de carrera: el controller (createCorte) ya valida barbero
    // y servicio antes; en completarTurnoConCorte el barbero sale del turno y el
    // servicio está validado, así que en la práctica esto casi nunca dispara.
    if (err.code === '23503') {
      if (err.constraint === 'corte_barbero_tenant_fkey') {
        console.warn('[cortesService] registrarCorte — barbero inexistente o de otro tenant | barbero_id:', barberoId);
        throw errorCorte('BARBERO_INVALIDO', 'El barbero no existe o no pertenece a este negocio');
      }
      if (err.constraint === 'corte_servicio_tenant_fkey') {
        console.warn('[cortesService] registrarCorte — servicio inexistente o de otro tenant | servicio_id:', servicioId);
        throw errorCorte('SERVICIO_INVALIDO', 'El servicio no existe o no pertenece a este negocio');
      }
      // Otro FK inesperado → se propaga crudo abajo.
    }
    // Cualquier otro error se propaga crudo (el controller lo loguea + responde 500).
    throw err;
  }

  if (result.rows.length > 0) {
    const { id: corteId, turno_id: turnoVinculado } = result.rows[0];
    if (turnoId && turnoVinculado) {
      console.log('[cortesService] registrarCorte — turno marcado como completado | turno_id:', turnoId);
    } else if (turnoId) {
      console.warn('[cortesService] registrarCorte — turno cancelado, corte registrado sin turno | turno_id:', turnoId);
    }
    console.log('[cortesService] registrarCorte completado | corte_id:', corteId);
    return { corte_id: corteId, monto_total, turno_vinculado: Boolean(turnoVinculado) };
  }

  // No se insertó (solo pasa con turnoId): averiguar por qué, con el mismo scoping.
  const fila = await query(
    `SELECT estado,
            (inicio AT TIME ZONE $4)::date = (now() AT TIME ZONE $4)::date AS es_de_hoy
     FROM turno WHERE id = $1 AND tenant_id = $2 AND barbero_id = $3`,
    [turnoId, tenantId, barberoId, TZ]
  );
  const estado = fila.rows[0]?.estado;
  console.warn('[cortesService] registrarCorte — turno no completable, corte no registrado | turno_id:', turnoId, '| estado:', estado ?? 'inexistente');
  if (!estado) {
    throw errorCorte('TURNO_INEXISTENTE', MENSAJE_TURNO_INEXISTENTE);
  }
  if (estado === 'completado') {
    throw errorCorte('TURNO_YA_COMPLETADO', 'Este turno ya figura como completado. Si su cobro no está cargado, registralo como cliente sin turno');
  }
  if (estado === 'no_asistio' && estadosCompletables.includes('no_asistio') && !fila.rows[0].es_de_hoy) {
    throw errorCorte('ESTADO_INVALIDO', 'Un turno marcado como "no asistió" solo se puede completar el mismo día del turno');
  }
  if (estado === 'reservado') {
    // Seguía reservado: cambió entre que empezó la sentencia y el UPDATE (carrera de ms).
    throw errorCorte('ESTADO_INVALIDO', 'El turno cambió mientras se registraba el corte. Intentá de nuevo');
  }
  throw errorCorte('ESTADO_INVALIDO', `El turno está en estado "${estado}" y no se puede completar`);
};
