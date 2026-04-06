// /backend/src/controllers/planillas.js
// Controlador para los endpoints de planillas semanales.

import { query } from '../config/db.js';

const TZ = 'America/Argentina/Buenos_Aires';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * semanaAFechas
 * Convierte un string de semana ISO (ej: "2025-W12") a fechas lunes y domingo.
 * Usa el estándar ISO 8601: la semana empieza el lunes y la semana 1
 * es la que contiene el 4 de enero.
 * @param {string} semanaStr - Formato "YYYY-WNN"
 * @returns {{ lunes: string, domingo: string }} Fechas en formato "YYYY-MM-DD"
 */
function semanaAFechas(semanaStr) {
  const [yearStr, wStr] = semanaStr.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(wStr);

  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() === 0 ? 7 : jan4.getDay();

  const lunesSemana1 = new Date(jan4);
  lunesSemana1.setDate(jan4.getDate() - (jan4Day - 1));

  const lunes = new Date(lunesSemana1);
  lunes.setDate(lunesSemana1.getDate() + (week - 1) * 7);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const fmt = (d) => d.toISOString().split('T')[0];
  return { lunes: fmt(lunes), domingo: fmt(domingo) };
}

// ─── GET /api/planillas/detalle-semanal ───────────────────────────────────────
/**
 * getDetalleSemanal
 * Devuelve el detalle de cortes de la semana, agrupado por barbero.
 * @param {string} req.query.semana - Formato "YYYY-WNN"
 * @param {string} req.tenant_id   - Inyectado por tenantMiddleware
 * @returns {JSON} Array de { barbero_id, barbero_nombre, cortes: [...] }
 */
export const getDetalleSemanal = async (req, res) => {
  const { semana } = req.query;
  console.log('[planillas] getDetalleSemanal — request recibido | semana:', semana, '| tenant:', req.tenant_id);

  if (!semana || !/^\d{4}-W\d{1,2}$/.test(semana)) {
    return res.status(400).json({ error: 'Parámetro semana inválido. Formato esperado: YYYY-WNN' });
  }

  const { lunes, domingo } = semanaAFechas(semana);

  try {
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
       ORDER BY b.nombre, c.timestamp`,
      [req.tenant_id, lunes, domingo, TZ]
    );

    const mapa = new Map();
    for (const row of result.rows) {
      if (!mapa.has(row.barbero_id)) {
        mapa.set(row.barbero_id, {
          barbero_id:     row.barbero_id,
          barbero_nombre: row.barbero_nombre,
          cortes:         [],
        });
      }
      mapa.get(row.barbero_id).cortes.push({
        corte_id:        row.corte_id,
        fecha:           row.fecha,
        hora:            row.hora,
        servicio_nombre: row.servicio_nombre,
        monto_servicios: Number(row.monto_servicios),
        propina:         Number(row.propina),
        forma_pago:      row.forma_pago,
      });
    }

    const barberos = Array.from(mapa.values());
    console.log('[planillas] getDetalleSemanal — completado | barberos:', barberos.length, '| semana:', semana);
    res.json(barberos);
  } catch (err) {
    console.error('[planillas] Error en getDetalleSemanal:', err.message);
    res.status(500).json({ error: 'Error al obtener el detalle semanal' });
  }
};

// ─── GET /api/planillas/resumen-semanal ───────────────────────────────────────
/**
 * getResumenSemanal
 * Devuelve el resumen consolidado de la semana: una fila por barbero con totales y comisión.
 * @param {string} req.query.semana - Formato "YYYY-WNN"
 * @param {string} req.tenant_id   - Inyectado por tenantMiddleware
 * @returns {JSON} { barberos: Array, totales: Object }
 */
export const getResumenSemanal = async (req, res) => {
  const { semana } = req.query;
  console.log('[planillas] getResumenSemanal — request recibido | semana:', semana, '| tenant:', req.tenant_id);

  if (!semana || !/^\d{4}-W\d{1,2}$/.test(semana)) {
    return res.status(400).json({ error: 'Parámetro semana inválido. Formato esperado: YYYY-WNN' });
  }

  const { lunes, domingo } = semanaAFechas(semana);

  try {
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
       GROUP BY b.id, b.nombre, b.comision_tipo, b.comision_valor
       ORDER BY b.nombre`,
      [req.tenant_id, lunes, domingo, TZ]
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
        barbero_id:      b.barbero_id,
        barbero_nombre:  b.barbero_nombre,
        comision_tipo:   b.comision_tipo,
        comision_valor:  comisionValor,
        cantidad_cortes: cantidadCortes,
        monto_servicios: montoServicios,
        propinas,
        total_generado:  totalGenerado,
        comision:        Math.round(comision * 100) / 100,
      };
    });

    const totales = {
      cantidad_cortes: barberos.reduce((s, b) => s + b.cantidad_cortes, 0),
      monto_servicios: barberos.reduce((s, b) => s + b.monto_servicios, 0),
      propinas:        barberos.reduce((s, b) => s + b.propinas, 0),
      total_generado:  barberos.reduce((s, b) => s + b.total_generado, 0),
      comision:        barberos.reduce((s, b) => s + b.comision, 0),
    };

    console.log('[planillas] getResumenSemanal — completado | barberos:', barberos.length, '| semana:', semana);
    res.json({ barberos, totales });
  } catch (err) {
    console.error('[planillas] Error en getResumenSemanal:', err.message);
    res.status(500).json({ error: 'Error al obtener el resumen semanal' });
  }
};
