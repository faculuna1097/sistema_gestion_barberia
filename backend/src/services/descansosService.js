// /backend/src/services/descansosService.js
// Lógica de negocio de los descansos: el barbero (o el admin) marca slots libres
// y futuros de un día como "no atiendo". Un descanso es una fila de
// barbero_suspension con tipo = 'descanso' (decisiones_descansos.md).
// Se libera con el mismo POST /api/admin/suspensiones/:id/liberar (liberarSuspension).
//
// Acá vive también la ÚNICA definición de "descansos pegados = un solo bloque"
// (unirDescansos): la usan la Agenda de los dos fronts y el registro de Planillas.
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
 * Un descanso nunca cancela turnos (decisiones_descansos.md).
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

// ─── Bloques de descanso (descansos pegados = uno solo) ──────────────────────

/**
 * Fin efectivo de una parte en ms: el horario original, o el momento en que se
 * liberó si fue antes (mismo criterio que finEfectivoSql).
 * @param {{ hasta: Date, liberada_en: Date|null }} f - fila de barbero_suspension
 * @returns {number} ms epoch
 */
const finEfectivoMs = (f) => (f.liberada_en ? Math.min(+f.hasta, +f.liberada_en) : +f.hasta);

/**
 * Minutos entre dos instantes en ms, redondeados.
 * @param {number} desdeMs
 * @param {number} hastaMs
 * @returns {number}
 */
const minutosEntre = (desdeMs, hastaMs) => Math.round((hastaMs - desdeMs) / 60000);

/**
 * ¿La parte `b` (que empieza después) se une al bloque que termina en la parte `a`?
 * Además de ser del mismo barbero y origen:
 * - pegadas por su horario ORIGINAL (a.hasta = b.desde): así un bloque liberado
 *   entero antes de empezar sigue siendo uno solo, aunque su rango efectivo sea vacío;
 * - existieron a la vez: la que se creó después se creó antes de que la otra
 *   terminara o se liberara. Una parte liberada a las 12:50 y otra marcada a las
 *   12:55 justo después nunca fueron un bloque, y no se unen.
 * @param {Object} a - fila de barbero_suspension (la última parte del bloque)
 * @param {Object} b - fila siguiente, ordenada por desde
 * @returns {boolean}
 */
const seUnen = (a, b) =>
  a.barbero_id === b.barbero_id
  && a.origen === b.origen
  && +a.hasta === +b.desde
  && Math.max(+a.created_at, +b.created_at) < Math.min(finEfectivoMs(a), finEfectivoMs(b));

/**
 * Arma un bloque a partir de sus partes (filas ya unidas por seUnen) y le calcula
 * el rango efectivo, los minutos y el estado.
 * Estado:
 * - 'liberado': todas las partes se liberaron antes de empezar (no bloqueó nada);
 * - 'terminado_antes': terminó antes de su horario original (en `liberado_en`);
 * - si no, según `ahora`: 'pendiente', 'en_curso' o 'cumplido'.
 * @param {Array<Object>} partes - filas de barbero_suspension, ordenadas por desde
 * @param {number} ahoraMs - "ahora" de la base, en ms
 * @returns {Object} el bloque (forma en listarBloquesDescanso)
 */
const armarBloque = (partes, ahoraMs) => {
  const primera = partes[0];
  const ultima = partes[partes.length - 1];
  const conRango = partes.filter(p => finEfectivoMs(p) > +p.desde);

  const desdeMs = conRango.length ? +conRango[0].desde : +primera.desde;
  const hastaMs = conRango.length ? Math.max(...conRango.map(finEfectivoMs)) : desdeMs;
  const liberadas = partes.filter(p => p.liberada_en);

  let estado;
  let liberadoEn = null;
  if (conRango.length === 0) {
    estado = 'liberado';
    liberadoEn = new Date(Math.max(...liberadas.map(p => +p.liberada_en)));
  } else if (hastaMs < +ultima.hasta) {
    estado = 'terminado_antes';
    liberadoEn = new Date(hastaMs);
  } else if (ahoraMs < desdeMs) {
    estado = 'pendiente';
  } else if (ahoraMs < hastaMs) {
    estado = 'en_curso';
  } else {
    estado = 'cumplido';
  }

  return {
    id: primera.id,
    barbero_id: primera.barbero_id,
    barbero_nombre: primera.barbero_nombre,
    origen: primera.origen,
    desde: new Date(desdeMs),
    hasta: new Date(hastaMs),
    hasta_programada: ultima.hasta,
    estado,
    liberado_en: liberadoEn,
    liberado_por: liberadas.length ? liberadas[liberadas.length - 1].liberada_por : null,
    minutos: conRango.reduce((total, p) => total + minutosEntre(+p.desde, finEfectivoMs(p)), 0),
    creado_en: primera.created_at,
    antelacion_minutos: minutosEntre(+primera.created_at, +primera.desde),
    partes: partes.map(p => ({
      id: p.id,
      desde: p.desde,
      hasta: new Date(finEfectivoMs(p)),
      hasta_programada: p.hasta,
      liberada_en: p.liberada_en,
      creado_en: p.created_at,
      antelacion_minutos: minutosEntre(+p.created_at, +p.desde),
    })),
  };
};

/**
 * unirDescansos
 * Junta en un solo bloque los descansos pegados: marcar 13:00 y después 13:30 es
 * lo mismo que marcar 13:00–14:00 de una vez. En la base siguen siendo filas
 * separadas, cada una con su antelación (van en `partes`). Regla en seUnen.
 * Función pura.
 * @param {Array<Object>} filas - filas de barbero_suspension de tipo descanso (todas,
 *   también las liberadas), con { id, barbero_id, barbero_nombre, origen, desde,
 *   hasta, liberada_en, liberada_por, created_at }
 * @param {number} ahoraMs - "ahora" en ms, para el estado
 * @returns {Array<Object>} bloques ordenados por barbero y desde (ver armarBloque)
 */
export const unirDescansos = (filas, ahoraMs) => {
  const ordenadas = [...filas].sort((a, b) =>
    a.barbero_id.localeCompare(b.barbero_id) || (+a.desde - +b.desde));

  // Cada parte se suma al bloque cuya última parte se une con ella, que no es
  // siempre el anterior: un horario liberado se puede volver a marcar, y la fila
  // nueva queda ordenada entre la liberada y su continuación.
  const grupos = [];
  for (const f of ordenadas) {
    const grupo = grupos.findLast(g => seUnen(g[g.length - 1], f));
    if (grupo) grupo.push(f);
    else grupos.push([f]);
  }
  grupos.sort((a, b) =>
    a[0].barbero_id.localeCompare(b[0].barbero_id) || (+a[0].desde - +b[0].desde));
  return grupos.map(g => armarBloque(g, ahoraMs));
};

/**
 * Lista los descansos de un rango de días como bloques (descansos pegados = uno
 * solo, ver unirDescansos). A diferencia de listarSuspensiones, incluye los
 * liberados antes de empezar (estado 'liberado'): el registro de Planillas los
 * necesita. Quien dibuja una agenda los descarta.
 * @param {string} tenantId
 * @param {Object} filtros
 * @param {string} filtros.desde - 'YYYY-MM-DD' ya validada (inclusive, TZ Argentina)
 * @param {string} filtros.hasta - 'YYYY-MM-DD' ya validada (inclusive, TZ Argentina)
 * @param {string} [filtros.barberoId] - solo los de ese barbero; si se omite, todos
 * @returns {Promise<Array<{
 *   id, barbero_id, barbero_nombre, origen, desde, hasta, hasta_programada,
 *   estado: 'pendiente'|'en_curso'|'cumplido'|'terminado_antes'|'liberado',
 *   liberado_en, liberado_por, minutos, creado_en, antelacion_minutos,
 *   partes: Array<{ id, desde, hasta, hasta_programada, liberada_en, creado_en, antelacion_minutos }>
 * }>>} `id` es el de la primera parte; `hasta`, el fin efectivo (igual a `desde`
 *   si se liberó antes de empezar); `minutos`, el tiempo que bloqueó (o va a
 *   bloquear); `antelacion_minutos`, la de la primera parte.
 */
export const listarBloquesDescanso = async (tenantId, { desde, hasta, barberoId }) => {
  const inicioRango = DateTime.fromISO(desde, { zone: TZ }).startOf('day').toISO();
  const finRango = DateTime.fromISO(hasta, { zone: TZ }).plus({ days: 1 }).startOf('day').toISO();

  const params = [tenantId, inicioRango, finRango];
  let filtroBarbero = '';
  if (barberoId) {
    params.push(barberoId);
    filtroBarbero = `AND bs.barbero_id = $${params.length}`;
  }

  // Por el rango ORIGINAL (no el efectivo): así entran los liberados antes de empezar.
  const result = await query(
    `SELECT bs.id, bs.barbero_id, b.nombre AS barbero_nombre, bs.origen,
            bs.desde, bs.hasta, bs.liberada_en, bs.liberada_por, bs.created_at,
            now() AS ahora
     FROM barbero_suspension bs
     JOIN barbero b ON b.id = bs.barbero_id
     WHERE bs.tenant_id = $1 AND bs.tipo = 'descanso'
       AND bs.desde < $3::timestamptz AND bs.hasta > $2::timestamptz
       ${filtroBarbero}`,
    params
  );
  if (result.rows.length === 0) return [];
  return unirDescansos(result.rows, +result.rows[0].ahora);
};

/**
 * Busca el bloque que contiene un descanso recién creado, para devolverlo junto
 * con la fila: el front lo dibuja al instante ya unido con los pegados, sin
 * rearmar la regla.
 * @param {string} tenantId
 * @param {string} barberoId
 * @param {string} fecha - 'YYYY-MM-DD' del descanso
 * @param {string} descansoId - id de la fila creada
 * @returns {Promise<Object|null>} el bloque (forma de listarBloquesDescanso), o null
 */
export const bloqueDelDescanso = async (tenantId, barberoId, fecha, descansoId) => {
  const bloques = await listarBloquesDescanso(tenantId, { desde: fecha, hasta: fecha, barberoId });
  return bloques.find(b => b.partes.some(p => p.id === descansoId)) ?? null;
};
