// /backend/src/services/planillaService.js
// Lógica de negocio de planillas semanales con scoping por rol.
// Cobertura: plan_turnero_v2.md sección 5 (/api/admin/planilla).
// Acepta semana como YYYY-MM-DD (se toma la semana que contiene esa fecha).

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { TZ } from '../utils/constantes.js';
import { listarBloquesDescanso } from './descansosService.js';
import { suspensionSolapaSql, finEfectivoSql } from './suspensionesService.js';

/**
 * Calcula el lunes y domingo de la semana que contiene la fecha dada.
 * Usa convención ISO: semana empieza el lunes.
 * @param {string} fechaStr - YYYY-MM-DD
 * @returns {{ lunes: string, domingo: string }} en formato YYYY-MM-DD
 */
export const semanaDesde = (fechaStr) => {
  const dt = DateTime.fromISO(fechaStr, { zone: TZ });
  const lunes = dt.startOf('week');
  const domingo = lunes.plus({ days: 6 });
  return { lunes: lunes.toISODate(), domingo: domingo.toISODate() };
};

// Regla de qué barberos aparecen en la planilla de una semana: los que tuvieron
// cortes en ella (aunque hoy estén dados de baja: se les paga igual y el
// desglose tiene que cuadrar con el total) + esta condición: activos y dados de
// alta a más tardar el domingo (así no aparecen en semanas en que no existían).
// La comparten detalleSemanal y resumenSemanal para devolver siempre el mismo
// conjunto de barberos: el front cruza ambas respuestas por barbero_id.
// Usa los placeholders comunes de las dos queries: $3 = domingo, $4 = TZ.
// Balances aplica la misma regla por mes (controllers/balances.js).
const BARBERO_VIGENTE_EN_SEMANA =
  '(b.activo = true AND DATE(b.created_at AT TIME ZONE $4) <= $3)';

/**
 * Detalle semanal de cortes, opcionalmente filtrado por barbero.
 * Incluye a los barberos vigentes sin cortes en la semana, con `cortes: []`.
 * @param {Object} filtros - { tenantId, semana (YYYY-MM-DD), barberoId? }
 * @returns {Promise<Array>} agrupado por barbero
 */
export const detalleSemanal = async ({ tenantId, semana, barberoId }) => {
  const { lunes, domingo } = semanaDesde(semana);

  const params = [tenantId, lunes, domingo, TZ];
  let filtroExtra = '';
  if (barberoId) {
    filtroExtra = ' AND b.id = $5';
    params.push(barberoId);
  }

  // Arranca desde barbero con LEFT JOIN a corte: un barbero sin cortes en la
  // semana llega como una sola fila con las columnas del corte en NULL. Por eso
  // el filtro de fecha va en el ON — en el WHERE descartaría esa fila.
  const result = await query(
    `SELECT
       b.id                                                AS barbero_id,
       b.nombre                                            AS barbero_nombre,
       TO_CHAR(c.timestamp AT TIME ZONE $4, 'YYYY-MM-DD') AS fecha,
       TO_CHAR(c.timestamp AT TIME ZONE $4, 'HH24:MI')    AS hora,
       s.nombre                                            AS servicio_nombre,
       cl.nombre                                           AS cliente_nombre,
       c.precio                                            AS monto_servicios,
       c.propina,
       c.forma_pago,
       (c.turno_id IS NOT NULL)                            AS con_turno,
       c.id                                                AS corte_id,
       c.timestamp
     FROM barbero b
     LEFT JOIN corte c
            ON c.barbero_id = b.id
           AND c.tenant_id  = $1
           AND DATE(c.timestamp AT TIME ZONE $4) BETWEEN $2 AND $3
     LEFT JOIN servicio s  ON s.id  = c.servicio_id
     LEFT JOIN turno    t  ON t.id  = c.turno_id
     LEFT JOIN cliente  cl ON cl.id = t.cliente_id
     WHERE b.tenant_id = $1
       AND (c.id IS NOT NULL OR ${BARBERO_VIGENTE_EN_SEMANA})
       ${filtroExtra}
     ORDER BY b.nombre, b.id, c.timestamp`,
    params
  );

  const mapa = new Map();
  for (const row of result.rows) {
    if (!mapa.has(row.barbero_id)) {
      mapa.set(row.barbero_id, {
        barbero_id: row.barbero_id,
        barbero_nombre: row.barbero_nombre,
        cortes: [],
      });
    }
    // Barbero vigente sin cortes: su única fila trae el corte en NULL.
    if (row.corte_id === null) continue;
    mapa.get(row.barbero_id).cortes.push({
      corte_id: row.corte_id,
      fecha: row.fecha,
      hora: row.hora,
      servicio_nombre: row.servicio_nombre,
      cliente_nombre: row.cliente_nombre,
      monto_servicios: Number(row.monto_servicios),
      propina: Number(row.propina),
      forma_pago: row.forma_pago,
      // true si el corte vino de un turno; false si fue un cliente sin turno.
      con_turno: row.con_turno,
    });
  }

  return Array.from(mapa.values());
};

/**
 * Resumen semanal consolidado (una fila por barbero con totales y comisión).
 * Incluye a los barberos vigentes sin cortes en la semana, con totales en 0.
 * @param {Object} filtros - { tenantId, semana (YYYY-MM-DD), barberoId? }
 * @returns {Promise<{ barberos: Array, totales: Object }>}
 */
export const resumenSemanal = async ({ tenantId, semana, barberoId }) => {
  const { lunes, domingo } = semanaDesde(semana);

  const params = [tenantId, lunes, domingo, TZ];
  let filtroExtra = '';
  if (barberoId) {
    filtroExtra = ' AND b.id = $5';
    params.push(barberoId);
  }

  // Mismo LEFT JOIN que detalleSemanal (filtro de fecha en el ON); acá la
  // regla de visibilidad va en el HAVING porque la query agrega por barbero.
  const result = await query(
    `SELECT
       b.id                                      AS barbero_id,
       b.nombre                                  AS barbero_nombre,
       b.comision_tipo,
       b.comision_valor,
       COUNT(c.id)::int                          AS cantidad_cortes,
       COUNT(c.id) FILTER (WHERE c.turno_id IS NOT NULL)::int AS cortes_con_turno,
       COUNT(c.id) FILTER (WHERE c.turno_id IS NULL)::int     AS cortes_sin_turno,
       COALESCE(SUM(c.precio), 0)                AS monto_servicios,
       COALESCE(SUM(c.propina), 0)               AS propinas
     FROM barbero b
     LEFT JOIN corte c
            ON c.barbero_id = b.id
           AND c.tenant_id  = $1
           AND DATE(c.timestamp AT TIME ZONE $4) BETWEEN $2 AND $3
     WHERE b.tenant_id = $1
       ${filtroExtra}
     GROUP BY b.id, b.nombre, b.comision_tipo, b.comision_valor, b.activo, b.created_at
     HAVING COUNT(c.id) > 0 OR ${BARBERO_VIGENTE_EN_SEMANA}
     ORDER BY b.nombre, b.id`,
    params
  );

  const barberos = result.rows.map((b) => {
    const cantidadCortes = Number(b.cantidad_cortes);
    const montoServicios = Number(b.monto_servicios);
    const propinas       = Number(b.propinas);
    const totalGenerado  = montoServicios + propinas;
    const comisionValor  = Number(b.comision_valor);

    // La rama `fijo` no se usa hoy: no hay barberos con comisión fija, toda
    // comisión es porcentaje (ver la deuda en docs/estado_actual.md).
    const comision =
      b.comision_tipo === 'porcentaje'
        ? montoServicios * comisionValor / 100 + propinas
        : comisionValor * cantidadCortes;

    return {
      barbero_id: b.barbero_id,
      barbero_nombre: b.barbero_nombre,
      comision_tipo: b.comision_tipo,
      comision_valor: comisionValor,
      cantidad_cortes: cantidadCortes,
      // Desglose de cantidad_cortes: siempre suman lo mismo.
      cortes_con_turno: Number(b.cortes_con_turno),
      cortes_sin_turno: Number(b.cortes_sin_turno),
      monto_servicios: montoServicios,
      propinas,
      total_generado: totalGenerado,
      comision: Math.round(comision * 100) / 100,
    };
  });

  const totales = {
    cantidad_cortes: barberos.reduce((s, b) => s + b.cantidad_cortes, 0),
    cortes_con_turno: barberos.reduce((s, b) => s + b.cortes_con_turno, 0),
    cortes_sin_turno: barberos.reduce((s, b) => s + b.cortes_sin_turno, 0),
    monto_servicios: barberos.reduce((s, b) => s + b.monto_servicios, 0),
    propinas:        barberos.reduce((s, b) => s + b.propinas, 0),
    total_generado:  barberos.reduce((s, b) => s + b.total_generado, 0),
    comision:        barberos.reduce((s, b) => s + b.comision, 0),
  };

  return { barberos, totales };
};

/**
 * Antelación de la parte de un bloque de descanso que se marcó más tarde: en un
 * descanso unido es la que delata una extensión de último momento ("marcó 13:00
 * con un día de anticipación y 13:30 cinco minutos antes"). Si el bloque tiene
 * una sola parte, coincide con la del bloque. Función pura.
 * @param {{ partes: Array<{ creado_en, antelacion_minutos }> }} bloque - de listarBloquesDescanso
 * @returns {number} minutos
 */
const antelacionUltimaParte = (bloque) =>
  bloque.partes.reduce((ultima, p) => (+p.creado_en > +ultima.creado_en ? p : ultima))
    .antelacion_minutos;

/**
 * Registro semanal de descansos por barbero (Planillas; decisiones_descansos.md →
 * "Registro del dueño"). Los descansos pegados llegan como un solo bloque (regla en
 * descansosService → unirDescansos) e incluye los liberados antes de empezar,
 * que se listan pero no cuentan en cantidad ni en minutos.
 *
 * La jornada (divisor del %) son los minutos de los bloques de horario del
 * barbero en los días de la semana en que el local atiende y no es feriado,
 * menos sus ausencias (rango efectivo). Usa el horario ACTUAL del barbero:
 * barbero_horario no guarda historial, así que en una semana pasada en la que
 * tenía otro horario el % es aproximado.
 *
 * Devuelve el mismo conjunto de barberos que detalleSemanal y resumenSemanal
 * (vigentes en la semana o con cortes en ella): el front cruza las tres
 * respuestas por barbero_id.
 * @param {Object} filtros - { tenantId, semana (YYYY-MM-DD), barberoId? }
 * @returns {Promise<Array<{
 *   barbero_id, barbero_nombre,
 *   cantidad: number, minutos: number, minutos_jornada: number,
 *   porcentaje: number|null,
 *   bloques: Array<Object>
 * }>>} `porcentaje` con un decimal, null si la jornada es 0; `bloques`, los de
 *   listarBloquesDescanso más `antelacion_ultima_minutos`, ordenados por desde
 */
export const descansosSemanal = async ({ tenantId, semana, barberoId }) => {
  const { lunes, domingo } = semanaDesde(semana);

  const params = [tenantId, lunes, domingo, TZ];
  let filtroExtra = '';
  if (barberoId) {
    filtroExtra = ' AND b.id = $5';
    params.push(barberoId);
  }

  // Jornada: cada bloque de barbero_horario de los días abiertos y no feriados,
  // como rango de instantes (fecha + hora, en hora argentina), menos la unión de
  // sus ausencias (multirange: dos ausencias superpuestas no se restan dos veces).
  const [barberosRes, bloques] = await Promise.all([
    query(
      `WITH dias AS (
         SELECT d::date AS fecha
         FROM generate_series($2::date, $3::date, interval '1 day') AS d
       ),
       horario AS (
         SELECT bh.barbero_id,
                tstzrange((dias.fecha + bh.hora_inicio) AT TIME ZONE $4,
                          (dias.fecha + bh.hora_fin)    AT TIME ZONE $4) AS r
         FROM dias
         JOIN barbero_horario bh
           ON bh.tenant_id = $1 AND bh.dia_semana = EXTRACT(DOW FROM dias.fecha)
         WHERE EXISTS (SELECT 1 FROM tenant_horario_atencion h
                       WHERE h.tenant_id = $1 AND h.dia_semana = bh.dia_semana)
           AND NOT EXISTS (SELECT 1 FROM tenant_feriado f
                           WHERE f.tenant_id = $1 AND f.fecha = dias.fecha)
       ),
       trabajable AS (
         SELECT h.barbero_id,
                unnest(tstzmultirange(h.r) - COALESCE((
                  SELECT range_agg(tstzrange(bs.desde, ${finEfectivoSql('bs')}))
                  FROM barbero_suspension bs
                  WHERE bs.tenant_id = $1 AND bs.barbero_id = h.barbero_id
                    AND bs.tipo = 'suspension'
                    AND ${suspensionSolapaSql('bs', 'lower(h.r)', 'upper(h.r)')}
                ), '{}'::tstzmultirange)) AS r
         FROM horario h
       )
       SELECT b.id AS barbero_id, b.nombre AS barbero_nombre,
              COALESCE((SELECT SUM(EXTRACT(EPOCH FROM upper(t.r) - lower(t.r)))
                        FROM trabajable t WHERE t.barbero_id = b.id), 0) / 60 AS minutos_jornada
       FROM barbero b
       WHERE b.tenant_id = $1
         AND (${BARBERO_VIGENTE_EN_SEMANA}
              OR EXISTS (SELECT 1 FROM corte c
                         WHERE c.barbero_id = b.id AND c.tenant_id = $1
                           AND DATE(c.timestamp AT TIME ZONE $4) BETWEEN $2 AND $3))
         ${filtroExtra}
       ORDER BY b.nombre, b.id`,
      params
    ),
    listarBloquesDescanso(tenantId, { desde: lunes, hasta: domingo, barberoId }),
  ]);

  return barberosRes.rows.map((b) => {
    const suyos = bloques
      .filter((bl) => bl.barbero_id === b.barbero_id)
      .map((bl) => ({ ...bl, antelacion_ultima_minutos: antelacionUltimaParte(bl) }));
    const contados = suyos.filter((bl) => bl.estado !== 'liberado');
    const minutos = contados.reduce((total, bl) => total + bl.minutos, 0);
    const minutosJornada = Math.round(Number(b.minutos_jornada));
    return {
      barbero_id: b.barbero_id,
      barbero_nombre: b.barbero_nombre,
      cantidad: contados.length,
      minutos,
      minutos_jornada: minutosJornada,
      porcentaje: minutosJornada > 0 ? Math.round((minutos / minutosJornada) * 1000) / 10 : null,
      bloques: suyos,
    };
  });
};
