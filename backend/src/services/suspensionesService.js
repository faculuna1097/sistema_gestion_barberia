// /backend/src/services/suspensionesService.js
// Lógica de negocio de suspensiones de barberos.
// Cobertura: plan_turnero_v2.md sección 5 (/api/admin/suspensiones).

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { TZ } from '../utils/constantes.js';
import { cancelarEvento } from './googleCalendar.js';
import { enviarCancelacionAutomatica, construirContextoMail } from './mail/mailer.js';

// ─── Rango efectivo (helper SQL) ─────────────────────────────────────────────
// Una fila de barbero_suspension bloquea [desde, LEAST(hasta, COALESCE(liberada_en, hasta))).
// Liberar (o terminar antes) solo completa liberada_en: el fin efectivo pasa a ser
// ese momento, y si fue antes de `desde` el rango queda vacío y no bloquea nada.
// Esta es la ÚNICA definición del rango en el backend: toda lectura de la tabla
// (disponibilidad, listado, validación de reservas, liberar) usa estos helpers.
// Ver plan_app_barbero.md → Feature 1 → "Modelo de datos".

/**
 * Expresión SQL del fin efectivo de una suspensión.
 * @param {string} a - Alias de barbero_suspension en la consulta (ej. 'bs')
 * @returns {string} fragmento SQL, ej. `LEAST(bs.hasta, COALESCE(bs.liberada_en, bs.hasta))`
 */
export const finEfectivoSql = (a) =>
  `LEAST(${a}.hasta, COALESCE(${a}.liberada_en, ${a}.hasta))`;

/**
 * Condición SQL "la suspensión bloquea algo dentro de [ini, fin)": su rango efectivo
 * no es vacío y se superpone con el rango dado. `ini` y `fin` son placeholders
 * ('$3') o columnas ('t.inicio'), nunca valores del usuario: es seguro interpolarlos.
 * @param {string} a - Alias de barbero_suspension en la consulta
 * @param {string} ini - Placeholder o columna del inicio del rango a comparar
 * @param {string} fin - Placeholder o columna del fin del rango a comparar
 * @returns {string} fragmento SQL entre paréntesis, para usar en un WHERE
 */
export const suspensionSolapaSql = (a, ini, fin) =>
  `(${a}.desde < ${finEfectivoSql(a)} AND ${a}.desde < ${fin} AND ${finEfectivoSql(a)} > ${ini})`;

/**
 * Lista las suspensiones (y descansos) cuyo rango efectivo se superpone con el
 * rango pedido. Sin `desde` el rango arranca ahora; sin `hasta`, no tiene fin: sin
 * filtros devuelve las que todavía no terminaron. Excluye las liberadas antes de
 * empezar. `hasta` es el fin efectivo; `hasta_programada`, el original de la fila.
 * @param {string} tenantId
 * @param {Object} [filtros]
 * @param {string} [filtros.barberoId] - Solo las de ese barbero; si se omite, todas
 * @param {string} [filtros.desde] - 'YYYY-MM-DD' ya validada (inclusive, TZ Argentina)
 * @param {string} [filtros.hasta] - 'YYYY-MM-DD' ya validada (inclusive, TZ Argentina)
 * @param {string} [filtros.tipo] - 'suspension' | 'descanso'; si se omite, los dos
 * @returns {Promise<Array>}
 */
export const listarSuspensiones = async (tenantId, { barberoId, desde, hasta, tipo } = {}) => {
  // Días completos en TZ Argentina: [00:00 de desde, 00:00 del día después de hasta).
  const inicioRango = desde ? DateTime.fromISO(desde, { zone: TZ }).startOf('day').toISO() : null;
  const finRango = hasta ? DateTime.fromISO(hasta, { zone: TZ }).plus({ days: 1 }).startOf('day').toISO() : null;

  const params = [tenantId, inicioRango, finRango];
  let where = `bs.tenant_id = $1
    AND ${suspensionSolapaSql('bs', 'COALESCE($2::timestamptz, now())', "COALESCE($3::timestamptz, 'infinity')")}`;

  if (barberoId) {
    params.push(barberoId);
    where += ` AND bs.barbero_id = $${params.length}`;
  }
  if (tipo) {
    params.push(tipo);
    where += ` AND bs.tipo = $${params.length}`;
  }

  const result = await query(
    `SELECT bs.id, bs.barbero_id, bs.desde, ${finEfectivoSql('bs')} AS hasta,
            bs.hasta AS hasta_programada, bs.motivo, bs.origen, bs.tipo,
            bs.liberada_en, bs.liberada_por, bs.created_at,
            b.nombre AS barbero_nombre
     FROM barbero_suspension bs
     JOIN barbero b ON b.id = bs.barbero_id
     WHERE ${where}
     ORDER BY bs.desde ASC`,
    params
  );
  return result.rows;
};

// SELECT de un turno con los datos que necesitan el mail y Calendar. Lo comparten
// buscarTurnosAfectados (por rango) y crearSuspension (por ids cancelados).
const SELECT_TURNO_ENRIQUECIDO = `
  SELECT t.id, t.inicio, t.fin, t.google_event_id,
         b.nombre AS barbero_nombre, b.email AS barbero_email,
         s.nombre AS servicio_nombre,
         c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono,
         tn.nombre_negocio AS tenant_nombre
  FROM turno t
  JOIN barbero  b ON b.id = t.barbero_id
  JOIN servicio s ON s.id = t.servicio_id
  JOIN cliente  c ON c.id = t.cliente_id
  JOIN tenant   tn ON tn.id = t.tenant_id`;

/**
 * Busca turnos reservados que caen dentro del rango de la suspensión.
 * @param {string} tenantId
 * @param {string} barberoId
 * @param {string} desde - ISO timestamp
 * @param {string} hasta - ISO timestamp
 * @returns {Promise<Array>} turnos afectados con datos enriquecidos
 */
export const buscarTurnosAfectados = async (tenantId, barberoId, desde, hasta) => {
  const result = await query(
    `${SELECT_TURNO_ENRIQUECIDO}
     WHERE t.tenant_id = $1
       AND t.barbero_id = $2
       AND t.estado = 'reservado'
       AND t.inicio < $4
       AND t.fin > $3`,
    [tenantId, barberoId, desde, hasta]
  );
  return result.rows;
};

/**
 * Da forma a la lista de turnos afectados que devuelve el 409.
 * @param {Array} turnos - filas de buscarTurnosAfectados
 * @returns {{ turnos_afectados: Array<{id, inicio, fin, cliente_nombre}> }}
 */
const respuestaTurnosAfectados = (turnos) => ({
  turnos_afectados: turnos.map(t => ({
    id: t.id, inicio: t.inicio, fin: t.fin,
    cliente_nombre: t.cliente_nombre,
  })),
});

/**
 * Avisa la cancelación de turnos por suspensión: borra el evento de Calendar y
 * manda el mail al cliente. Best-effort: un fallo se loguea y no corta el resto,
 * porque la suspensión y las cancelaciones ya están grabadas.
 * @param {Array} turnos - filas con SELECT_TURNO_ENRIQUECIDO de turnos ya cancelados
 * @param {string|null} motivo - motivo de la suspensión, para el mail
 * @param {string} linkTurnero - link para reservar de nuevo
 * @returns {Promise<void>}
 */
const notificarCancelaciones = async (turnos, motivo, linkTurnero) => {
  for (const t of turnos) {
    try {
      if (t.google_event_id) {
        await cancelarEvento(t.google_event_id);
      }
      if (t.cliente_email) {
        const { turno, barbero, servicio, cliente, tenant } = construirContextoMail(t);
        await enviarCancelacionAutomatica(
          turno, barbero, servicio, cliente,
          {
            intro: `Hola ${cliente.nombre ?? ''}, el barbero suspendió su agenda y tuvimos que cancelar este turno. Podés reservar uno nuevo cuando quieras.`,
            motivo: motivo || 'Sin motivo especificado',
          },
          linkTurnero,
          tenant,
        );
      }
    } catch (err) {
      console.error('[suspensionesService] Error en notificarCancelaciones | turno_id:', t.id, err);
    }
  }
};

/**
 * Crea una suspensión. Si hay turnos afectados y no viene confirmar_cancelacion,
 * devuelve la lista de turnos afectados para que el frontend confirme.
 * Si viene confirmar_cancelacion, crea la suspensión y cancela los turnos que pisa
 * en UNA sola sentencia (CTEs que modifican datos: o se aplica todo o nada, sin
 * BEGIN/COMMIT, convenciones §6). Recién después, best-effort, avisa a los clientes
 * y a Calendar, solo por los ids que devolvió el UPDATE.
 *
 * El INSERT solo ocurre si se confirmó o si no hay turnos reservados en el rango:
 * si alguien reservó entre la lectura y la escritura sin confirmación, no se
 * cancela nada y se devuelve la lista otra vez (mismo 409).
 * @param {Object} datos
 * @returns {Promise<{ suspension?: Object, turnos_cancelados?: number, turnos_afectados?: Array }>}
 */
export const crearSuspension = async ({
  tenantId, barberoId, desde, hasta, motivo, origen, confirmarCancelacion, linkTurnero,
}) => {
  // Buscar turnos que pisa la suspensión
  const turnosAfectados = await buscarTurnosAfectados(tenantId, barberoId, desde, hasta);

  if (turnosAfectados.length > 0 && !confirmarCancelacion) {
    return respuestaTurnosAfectados(turnosAfectados);
  }

  // Una sola sentencia: `nueva` inserta la suspensión y `canceladas` cancela los
  // turnos que pisa. El UPDATE hace FROM nueva: si no se insertó nada, no cancela
  // nada. El SELECT final devuelve 0 filas si no se insertó, o 1 con los ids
  // cancelados. No es idempotente (un reintento duplicaría la suspensión).
  const result = await query(
    `WITH nueva AS (
       INSERT INTO barbero_suspension (tenant_id, barbero_id, desde, hasta, motivo, origen)
       SELECT $1::uuid, $2::uuid, $3::timestamptz, $4::timestamptz, $5::text, $6::text
       WHERE $7::boolean
          OR NOT EXISTS (
            SELECT 1 FROM turno t
            WHERE t.tenant_id = $1::uuid AND t.barbero_id = $2::uuid AND t.estado = 'reservado'
              AND t.inicio < $4::timestamptz AND t.fin > $3::timestamptz
          )
       RETURNING id, barbero_id, desde, hasta, motivo, origen, tipo, created_at
     ), canceladas AS (
       UPDATE turno t
          SET estado = 'cancelado', cancelado_en = now(), cancelado_por = 'suspension'
         FROM nueva
        WHERE t.tenant_id = $1::uuid AND t.barbero_id = $2::uuid AND t.estado = 'reservado'
          AND t.inicio < $4::timestamptz AND t.fin > $3::timestamptz
       RETURNING t.id
     )
     SELECT n.id, n.barbero_id, n.desde, n.hasta, n.motivo, n.origen, n.tipo, n.created_at,
            COALESCE((SELECT array_agg(id) FROM canceladas), '{}') AS turnos_cancelados
     FROM nueva n`,
    [tenantId, barberoId, desde, hasta, motivo || null, origen, Boolean(confirmarCancelacion)],
    { reintentar: false }
  );

  // No se insertó: entró una reserva en el rango y no hubo confirmación.
  if (result.rows.length === 0) {
    const afectadosAhora = await buscarTurnosAfectados(tenantId, barberoId, desde, hasta);
    return respuestaTurnosAfectados(afectadosAhora);
  }

  const { turnos_cancelados: idsCancelados, ...suspension } = result.rows[0];
  for (const id of idsCancelados) {
    console.log('[suspensionesService] turno cancelado por suspensión | turno_id:', id);
  }

  // Best-effort, después de la escritura y solo sobre lo que se canceló de verdad.
  if (idsCancelados.length > 0) {
    try {
      const cancelados = await query(
        `${SELECT_TURNO_ENRIQUECIDO} WHERE t.id = ANY($1::uuid[]) AND t.tenant_id = $2`,
        [idsCancelados, tenantId]
      );
      await notificarCancelaciones(cancelados.rows, motivo, linkTurnero);
    } catch (err) {
      console.error('[suspensionesService] Error al leer los turnos cancelados para avisar:', err);
    }
  }

  return {
    suspension,
    turnos_cancelados: idsCancelados.length,
  };
};

/**
 * Arma un error tipado de liberarSuspension que el controller mapea a HTTP.
 * @param {string} code - 'NO_ENCONTRADA' | 'ORIGEN_ADMIN' | 'YA_LIBERADA' | 'YA_TERMINADA'
 * @param {string} mensaje - texto para el usuario
 * @returns {Error}
 */
const errorLiberar = (code, mensaje) => {
  const err = new Error(mensaje);
  err.code = code;
  return err;
};

/**
 * Libera una suspensión (o descanso): completa liberada_en = now() y liberada_por.
 * La fila no se borra (registro para el dueño, plan_app_barbero.md D7). Si todavía
 * no empezó, deja de bloquear entera; si está en curso, termina en este momento
 * (D8). No recupera turnos cancelados.
 *
 * Todas las reglas van en el WHERE del UPDATE, así dos pedidos simultáneos no
 * pueden liberarla dos veces. Si no actualiza nada, una lectura posterior solo
 * decide qué error devolver.
 * @param {string} suspensionId
 * @param {string} tenantId
 * @param {string} rol - 'admin' | 'barbero' (se graba en liberada_por)
 * @param {string|null} barberoId - si es barbero, solo puede liberar las propias
 * @returns {Promise<Object>} { id, desde, hasta, liberada_en, liberada_por }
 * @throws {{ code: 'NO_ENCONTRADA' | 'ORIGEN_ADMIN' | 'YA_LIBERADA' | 'YA_TERMINADA' }}
 */
export const liberarSuspension = async (suspensionId, tenantId, rol, barberoId) => {
  // $1 id, $2 tenant, $3 barbero (o NULL si es admin: no filtra), $4 rol.
  const params = [suspensionId, tenantId, barberoId ?? null, rol];
  const scoping = 'bs.id = $1 AND bs.tenant_id = $2 AND ($3::uuid IS NULL OR bs.barbero_id = $3::uuid)';

  let result;
  try {
    result = await query(
      `UPDATE barbero_suspension bs
          SET liberada_en = now(), liberada_por = $4::text
        WHERE ${scoping}
          AND NOT ($4::text = 'barbero' AND bs.origen = 'admin')
          AND bs.liberada_en IS NULL
          AND ${finEfectivoSql('bs')} > now()
        RETURNING bs.id, bs.desde, bs.hasta, bs.liberada_en, bs.liberada_por`,
      params
    );
  } catch (err) {
    // UUID mal formado (22P02): no puede ser ninguna suspensión → 404, no 500.
    if (err.code === '22P02') throw errorLiberar('NO_ENCONTRADA', 'Suspensión no encontrada');
    throw err;
  }
  if (result.rows.length > 0) return result.rows[0];

  // No se liberó: averiguar por qué (mismo scoping que el UPDATE).
  const fila = await query(
    `SELECT bs.origen, bs.liberada_en FROM barbero_suspension bs WHERE ${scoping}`,
    params.slice(0, 3)
  );
  const s = fila.rows[0];
  if (!s) throw errorLiberar('NO_ENCONTRADA', 'Suspensión no encontrada');
  if (rol === 'barbero' && s.origen === 'admin') {
    throw errorLiberar('ORIGEN_ADMIN', 'Esta suspensión la cargó el administrador; no la podés liberar');
  }
  if (s.liberada_en) throw errorLiberar('YA_LIBERADA', 'La suspensión ya fue liberada');
  throw errorLiberar('YA_TERMINADA', 'La suspensión ya terminó');
};
