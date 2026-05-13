// /backend/src/services/planillaService.js
// Lógica de negocio de planillas semanales con scoping por rol.
// Cobertura: plan_turnero_v2.md sección 5 (/api/admin/planilla).
// Acepta semana como YYYY-MM-DD (se toma la semana que contiene esa fecha).

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { TZ } from '../utils/constantes.js';

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

/**
 * Detalle semanal de cortes, opcionalmente filtrado por barbero.
 * @param {Object} filtros - { tenantId, semana (YYYY-MM-DD), barberoId? }
 * @returns {Promise<Array>} agrupado por barbero
 */
export const detalleSemanal = async ({ tenantId, semana, barberoId }) => {
  const { lunes, domingo } = semanaDesde(semana);

  const params = [tenantId, lunes, domingo, TZ];
  let filtroExtra = '';
  if (barberoId) {
    filtroExtra = ' AND c.barbero_id = $5';
    params.push(barberoId);
  }

  const result = await query(
    `SELECT
       b.id                                                AS barbero_id,
       b.nombre                                            AS barbero_nombre,
       TO_CHAR(c.timestamp AT TIME ZONE $4, 'YYYY-MM-DD') AS fecha,
       TO_CHAR(c.timestamp AT TIME ZONE $4, 'HH24:MI')    AS hora,
       s.nombre                                            AS servicio_nombre,
       c.precio                                            AS monto_servicios,
       c.propina,
       c.forma_pago,
       c.id                                                AS corte_id,
       c.timestamp
     FROM corte c
     JOIN barbero b  ON b.id = c.barbero_id
     JOIN servicio s ON s.id = c.servicio_id
     WHERE c.tenant_id = $1
       AND DATE(c.timestamp AT TIME ZONE $4) BETWEEN $2 AND $3
       ${filtroExtra}
     ORDER BY b.nombre, c.timestamp`,
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
    mapa.get(row.barbero_id).cortes.push({
      corte_id: row.corte_id,
      fecha: row.fecha,
      hora: row.hora,
      servicio_nombre: row.servicio_nombre,
      monto_servicios: Number(row.monto_servicios),
      propina: Number(row.propina),
      forma_pago: row.forma_pago,
    });
  }

  return Array.from(mapa.values());
};

/**
 * Resumen semanal consolidado (una fila por barbero con totales y comisión).
 * @param {Object} filtros - { tenantId, semana (YYYY-MM-DD), barberoId? }
 * @returns {Promise<{ barberos: Array, totales: Object }>}
 */
export const resumenSemanal = async ({ tenantId, semana, barberoId }) => {
  const { lunes, domingo } = semanaDesde(semana);

  const params = [tenantId, lunes, domingo, TZ];
  let filtroExtra = '';
  if (barberoId) {
    filtroExtra = ' AND c.barbero_id = $5';
    params.push(barberoId);
  }

  const result = await query(
    `SELECT
       b.id                                      AS barbero_id,
       b.nombre                                  AS barbero_nombre,
       b.comision_tipo,
       b.comision_valor,
       COUNT(c.id)::int                          AS cantidad_cortes,
       COALESCE(SUM(c.precio), 0)                AS monto_servicios,
       COALESCE(SUM(c.propina), 0)               AS propinas
     FROM corte c
     JOIN barbero b ON b.id = c.barbero_id
     WHERE c.tenant_id = $1
       AND DATE(c.timestamp AT TIME ZONE $4) BETWEEN $2 AND $3
       ${filtroExtra}
     GROUP BY b.id, b.nombre, b.comision_tipo, b.comision_valor
     ORDER BY b.nombre`,
    params
  );

  const barberos = result.rows.map((b) => {
    const cantidadCortes = Number(b.cantidad_cortes);
    const montoServicios = Number(b.monto_servicios);
    const propinas       = Number(b.propinas);
    const totalGenerado  = montoServicios + propinas;
    const comisionValor  = Number(b.comision_valor);

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
      monto_servicios: montoServicios,
      propinas,
      total_generado: totalGenerado,
      comision: Math.round(comision * 100) / 100,
    };
  });

  const totales = {
    cantidad_cortes: barberos.reduce((s, b) => s + b.cantidad_cortes, 0),
    monto_servicios: barberos.reduce((s, b) => s + b.monto_servicios, 0),
    propinas:        barberos.reduce((s, b) => s + b.propinas, 0),
    total_generado:  barberos.reduce((s, b) => s + b.total_generado, 0),
    comision:        barberos.reduce((s, b) => s + b.comision, 0),
  };

  return { barberos, totales };
};
