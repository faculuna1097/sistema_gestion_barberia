// /backend/src/controllers/planillas.js
// Controlador para los endpoints de planillas semanales.
// Maneja detalle por barbero y resumen consolidado de la semana.

//import pool from "../config/db.js";
import { query } from '../config/db.js';

const TENANT_ID = "a1b2c3d4-0000-0000-0000-000000000001";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convierte un string de semana ISO (ej: "2025-W12") a fechas lunes y domingo.
 * Usa el estándar ISO 8601: la semana empieza el lunes y la semana 1
 * es la que contiene el 4 de enero.
 *
 * @param {string} semanaStr - Formato "YYYY-WNN" ej: "2025-W12"
 * @returns {{ lunes: string, domingo: string }} - Fechas en formato "YYYY-MM-DD"
 */
function semanaAFechas(semanaStr) {
  const [yearStr, wStr] = semanaStr.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(wStr);

  // El 4 de enero siempre pertenece a la semana 1 (ISO 8601)
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() === 0 ? 7 : jan4.getDay(); // 1=Lun, 7=Dom

  // Calculamos el lunes de la semana 1
  const lunesSemana1 = new Date(jan4);
  lunesSemana1.setDate(jan4.getDate() - (jan4Day - 1));

  // Lunes de la semana pedida
  const lunes = new Date(lunesSemana1);
  lunes.setDate(lunesSemana1.getDate() + (week - 1) * 7);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  // Formato YYYY-MM-DD para usar en queries SQL
  const fmt = (d) => d.toISOString().split("T")[0];

  return { lunes: fmt(lunes), domingo: fmt(domingo) };
}

// ─── GET /api/planillas/detalle-semanal ───────────────────────────────────────
/**
 * Devuelve el detalle de cortes de la semana, agrupado por barbero.
 * Cada corte incluye los servicios realizados (concatenados si hay más de uno),
 * monto, propina y forma de pago.
 *
 * Query param: semana (string "YYYY-WNN", default: semana actual)
 * Retorna: [{ barbero_id, barbero_nombre, cortes: [...] }]
 */
export const getDetalleSemanal = async (req, res) => {
  console.log("[planillas] GET detalle-semanal — query:", req.query);

  const semana = req.query.semana;
  if (!semana || !/^\d{4}-W\d{1,2}$/.test(semana)) {
    return res.status(400).json({ error: "Parámetro semana inválido. Formato esperado: YYYY-WNN" });
  }

  const { lunes, domingo } = semanaAFechas(semana);
  console.log("[planillas] Rango de fechas:", lunes, "→", domingo);

  try {
    // Un row por corte (si tiene múltiples servicios, se concatenan con STRING_AGG)
    const result = await query(
      `SELECT
         b.id                                                         AS barbero_id,
         b.nombre                                                      AS barbero_nombre,
         TO_CHAR(c.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')
                                                             AS fecha,
         TO_CHAR(c.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI')
                                                                      AS hora,
         STRING_AGG(s.nombre, ', ' ORDER BY s.nombre)                 AS servicio_nombre,
         SUM(cs.precio)                                               AS monto_servicios,
         c.propina,
         c.forma_pago,
         c.id                                                         AS corte_id,
         c.timestamp
       FROM corte c
       JOIN barbero b        ON b.id  = c.barbero_id
       JOIN corte_servicio cs ON cs.corte_id = c.id
       JOIN servicio s        ON s.id  = cs.servicio_id
       WHERE c.tenant_id = $1
         AND DATE(c.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
             BETWEEN $2 AND $3
       GROUP BY c.id, b.id, b.nombre, c.timestamp, c.propina, c.forma_pago
       ORDER BY b.nombre, c.timestamp`,
      [TENANT_ID, lunes, domingo]
    );

    // Agrupamos los rows por barbero en JavaScript
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
        corte_id:       row.corte_id,
        fecha:          row.fecha,
        hora:           row.hora,
        servicio_nombre: row.servicio_nombre,
        monto_servicios: Number(row.monto_servicios),
        propina:        Number(row.propina),
        forma_pago:     row.forma_pago,
      });
    }

    const barberos = Array.from(mapa.values());
    console.log("[planillas] Detalle semanal — barberos con cortes:", barberos.length);
    res.json(barberos);
  } catch (err) {
    console.error("[planillas] Error en detalle-semanal:", err);
    res.status(500).json({ error: "Error al obtener el detalle semanal" });
  }
};

// ─── GET /api/planillas/resumen-semanal ───────────────────────────────────────
/**
 * Devuelve el resumen consolidado de la semana: una fila por barbero
 * con totales y comisión calculada.
 *
 * La comisión se calcula según el campo comision_tipo del barbero:
 *   - 'porcentaje': total_generado * comision_valor / 100
 *   - 'fijo':       comision_valor * cantidad_cortes
 *
 * Query param: semana (string "YYYY-WNN", default: semana actual)
 * Retorna: { barberos: [...], totales: { ... } }
 */
export const getResumenSemanal = async (req, res) => {
  console.log("[planillas] GET resumen-semanal — query:", req.query);

  const semana = req.query.semana;
  if (!semana || !/^\d{4}-W\d{1,2}$/.test(semana)) {
    return res.status(400).json({ error: "Parámetro semana inválido. Formato esperado: YYYY-WNN" });
  }

  const { lunes, domingo } = semanaAFechas(semana);
  console.log("[planillas] Rango de fechas:", lunes, "→", domingo);

  try {
    const result = await query(
      `SELECT
         b.id                                                         AS barbero_id,
         b.nombre                                                      AS barbero_nombre,
         b.comision_tipo,
         b.comision_valor,
         COUNT(DISTINCT c.id)                                         AS cantidad_cortes,
         COALESCE(SUM(cs.precio), 0)                                  AS monto_servicios,
         COALESCE(SUM(c.propina), 0)                                  AS propinas
       FROM corte c
       JOIN barbero b        ON b.id  = c.barbero_id
       JOIN corte_servicio cs ON cs.corte_id = c.id
       WHERE c.tenant_id = $1
         AND DATE(c.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
             BETWEEN $2 AND $3
       GROUP BY b.id, b.nombre, b.comision_tipo, b.comision_valor
       ORDER BY b.nombre`,
      [TENANT_ID, lunes, domingo]
    );

    // Calculamos total_generado y comisión en JavaScript para cada barbero
    const barberos = result.rows.map((b) => {
      const cantidadCortes  = Number(b.cantidad_cortes);
      const montoServicios  = Number(b.monto_servicios);
      const propinas        = Number(b.propinas);
      const totalGenerado   = montoServicios + propinas;
      const comisionValor   = Number(b.comision_valor);

      const comision =
        b.comision_tipo === "porcentaje"
          ? montoServicios * comisionValor / 100 + propinas
          : comisionValor * cantidadCortes; // fijo por corte

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

    // Fila de totales generales
    const totales = {
      cantidad_cortes: barberos.reduce((s, b) => s + b.cantidad_cortes, 0),
      monto_servicios: barberos.reduce((s, b) => s + b.monto_servicios, 0),
      propinas:        barberos.reduce((s, b) => s + b.propinas, 0),
      total_generado:  barberos.reduce((s, b) => s + b.total_generado, 0),
      comision:        barberos.reduce((s, b) => s + b.comision, 0),
    };

    console.log("[planillas] Resumen semanal — barberos:", barberos.length);
    res.json({ barberos, totales });
  } catch (err) {
    console.error("[planillas] Error en resumen-semanal:", err);
    res.status(500).json({ error: "Error al obtener el resumen semanal" });
  }
};
