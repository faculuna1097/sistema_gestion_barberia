// backend/src/controllers/inicio.js
// Endpoints para la SeccionInicio del panel de administrador.
// Provee resumen del día, comparativo mensual y alertas de stock bajo.

import { query } from '../config/db.js';

const TENANT_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
const TZ = 'America/Argentina/Buenos_Aires';

// ─── GET /api/inicio/resumen-dia ──────────────────────────────────────────────
/**
 * getResumenDia — devuelve la actividad del día actual comparada con ayer
 * a la misma hora, más los totales de semana y mes.
 *
 * Patrón correcto para comparar fechas en timezone argentino:
 *   DATE(timestamp AT TIME ZONE tz) = (NOW() AT TIME ZONE tz)::date
 * NUNCA usar CURRENT_DATE AT TIME ZONE tz (CURRENT_DATE es tipo date, no timestamp).
 *
 * Responde con:
 *   monto_dia          — facturación de hoy (cortes + ventas)
 *   clientes_dia       — cantidad de cortes de hoy
 *   productos_dia      — unidades de productos vendidas hoy
 *   monto_ayer         — facturación de ayer hasta la misma hora
 *   clientes_ayer      — cantidad de cortes de ayer hasta la misma hora
 *   diferencia_pct_dia — variación % monto hoy vs ayer (null si ayer fue 0)
 *   monto_semana       — facturación de la semana actual (lunes a hoy)
 *   monto_mes          — facturación del mes actual
 *   clientes_mes       — cantidad de cortes del mes actual
 */
export const getResumenDia = async (req, res) => {
  console.log('[Inicio] getResumenDia — request recibido');
  try {

    // ── Hoy ───────────────────────────────────────────────────────────────────
    const [cortesHoy, ventasHoy] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(monto_total), 0) AS monto,
           COUNT(id)                     AS clientes
         FROM corte
         WHERE tenant_id = $1
           AND DATE(timestamp AT TIME ZONE $2) = (NOW() AT TIME ZONE $2)::date`,
        [TENANT_ID, TZ]
      ),
      query(
        `SELECT
           COALESCE(SUM(precio_unitario * cantidad), 0) AS monto,
           COALESCE(SUM(cantidad), 0)                   AS unidades
         FROM venta
         WHERE tenant_id = $1
           AND DATE(timestamp AT TIME ZONE $2) = (NOW() AT TIME ZONE $2)::date`,
        [TENANT_ID, TZ]
      ),
    ]);

    // ── Ayer hasta la misma hora ──────────────────────────────────────────────
    // Comparamos la parte horaria del timestamp contra la hora actual
    // para que sea una comparación justa (ej: si son las 14:00, solo
    // traemos registros de ayer que sean anteriores a las 14:00)
    const [cortesAyer, ventasAyer] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(monto_total), 0) AS monto,
           COUNT(id)                     AS clientes
         FROM corte
         WHERE tenant_id = $1
           AND DATE(timestamp AT TIME ZONE $2) = (NOW() AT TIME ZONE $2)::date - INTERVAL '1 day'
           AND (timestamp AT TIME ZONE $2)::time <= (NOW() AT TIME ZONE $2)::time`,
        [TENANT_ID, TZ]
      ),
      query(
        `SELECT
           COALESCE(SUM(precio_unitario * cantidad), 0) AS monto,
           COALESCE(SUM(cantidad), 0)                   AS unidades
         FROM venta
         WHERE tenant_id = $1
           AND DATE(timestamp AT TIME ZONE $2) = (NOW() AT TIME ZONE $2)::date - INTERVAL '1 day'
           AND (timestamp AT TIME ZONE $2)::time <= (NOW() AT TIME ZONE $2)::time`,
        [TENANT_ID, TZ]
      ),
    ]);

    // ── Semana actual (lunes a hoy) ───────────────────────────────────────────
    const [cortesSemana, ventasSemana] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(monto_total), 0) AS monto
         FROM corte
         WHERE tenant_id = $1
           AND DATE(timestamp AT TIME ZONE $2) >= DATE_TRUNC('week', (NOW() AT TIME ZONE $2)::date)`,
        [TENANT_ID, TZ]
      ),
      query(
        `SELECT COALESCE(SUM(precio_unitario * cantidad), 0) AS monto
         FROM venta
         WHERE tenant_id = $1
           AND DATE(timestamp AT TIME ZONE $2) >= DATE_TRUNC('week', (NOW() AT TIME ZONE $2)::date)`,
        [TENANT_ID, TZ]
      ),
    ]);

    // ── Mes actual ────────────────────────────────────────────────────────────
    const [cortesMes, ventasMes] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(monto_total), 0) AS monto,
           COUNT(id)                     AS clientes
         FROM corte
         WHERE tenant_id = $1
           AND DATE_TRUNC('month', timestamp AT TIME ZONE $2) = DATE_TRUNC('month', (NOW() AT TIME ZONE $2)::date)`,
        [TENANT_ID, TZ]
      ),
      query(
        `SELECT COALESCE(SUM(precio_unitario * cantidad), 0) AS monto
         FROM venta
         WHERE tenant_id = $1
           AND DATE_TRUNC('month', timestamp AT TIME ZONE $2) = DATE_TRUNC('month', (NOW() AT TIME ZONE $2)::date)`,
        [TENANT_ID, TZ]
      ),
    ]);

    const montoDia  = Number(cortesHoy.rows[0].monto)  + Number(ventasHoy.rows[0].monto);
    const montoAyer = Number(cortesAyer.rows[0].monto) + Number(ventasAyer.rows[0].monto);

    const diferenciaPctDia = montoAyer === 0
      ? null
      : Math.round(((montoDia - montoAyer) / montoAyer) * 100);

    const resultado = {
      monto_dia:           montoDia,
      clientes_dia:        Number(cortesHoy.rows[0].clientes),
      productos_dia:       Number(ventasHoy.rows[0].unidades),
      monto_ayer:          montoAyer,
      clientes_ayer:       Number(cortesAyer.rows[0].clientes),
      diferencia_pct_dia:  diferenciaPctDia,
      monto_semana:        Number(cortesSemana.rows[0].monto) + Number(ventasSemana.rows[0].monto),
      monto_mes:           Number(cortesMes.rows[0].monto)    + Number(ventasMes.rows[0].monto),
      clientes_mes:        Number(cortesMes.rows[0].clientes),
    };

    console.log('[Inicio] getResumenDia — completado:', resultado);
    res.json(resultado);
  } catch (err) {
    console.error('[Inicio] getResumenDia — error:', err);
    res.status(500).json({ error: 'Error al obtener resumen del día' });
  }
};

// ─── GET /api/inicio/comparativo-mes ─────────────────────────────────────────
/**
 * getComparativoMes — compara la facturación del mes actual hasta hoy
 * con el mismo período del mes anterior.
 *
 * Responde con:
 *   monto_actual     — facturación mes actual hasta hoy
 *   clientes_actual  — cortes del mes actual
 *   monto_anterior   — facturación mes anterior hasta el mismo día
 *   diferencia_pct   — variación porcentual (null si mes anterior fue 0)
 *   dia_corte        — día del mes usado como corte (ej: 19)
 *   mes_actual       — nombre del mes actual (ej: "Marzo")
 *   mes_anterior     — nombre del mes anterior (ej: "Febrero")
 */
export const getComparativoMes = async (req, res) => {
  console.log('[Inicio] getComparativoMes — request recibido');
  try {
    const [cortesActual, ventasActual] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(monto_total), 0) AS monto,
           COUNT(id)                     AS clientes
         FROM corte
         WHERE tenant_id = $1
           AND DATE_TRUNC('month', timestamp AT TIME ZONE $2) = DATE_TRUNC('month', (NOW() AT TIME ZONE $2)::date)
           AND DATE(timestamp AT TIME ZONE $2) <= (NOW() AT TIME ZONE $2)::date`,
        [TENANT_ID, TZ]
      ),
      query(
        `SELECT COALESCE(SUM(precio_unitario * cantidad), 0) AS monto
         FROM venta
         WHERE tenant_id = $1
           AND DATE_TRUNC('month', timestamp AT TIME ZONE $2) = DATE_TRUNC('month', (NOW() AT TIME ZONE $2)::date)
           AND DATE(timestamp AT TIME ZONE $2) <= (NOW() AT TIME ZONE $2)::date`,
        [TENANT_ID, TZ]
      ),
    ]);

    const [cortesAnterior, ventasAnterior] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(monto_total), 0) AS monto
         FROM corte
         WHERE tenant_id = $1
           AND DATE_TRUNC('month', timestamp AT TIME ZONE $2) = DATE_TRUNC('month', ((NOW() AT TIME ZONE $2)::date - INTERVAL '1 month'))
           AND EXTRACT(DAY FROM timestamp AT TIME ZONE $2) <= EXTRACT(DAY FROM (NOW() AT TIME ZONE $2)::date)`,
        [TENANT_ID, TZ]
      ),
      query(
        `SELECT COALESCE(SUM(precio_unitario * cantidad), 0) AS monto
         FROM venta
         WHERE tenant_id = $1
           AND DATE_TRUNC('month', timestamp AT TIME ZONE $2) = DATE_TRUNC('month', ((NOW() AT TIME ZONE $2)::date - INTERVAL '1 month'))
           AND EXTRACT(DAY FROM timestamp AT TIME ZONE $2) <= EXTRACT(DAY FROM (NOW() AT TIME ZONE $2)::date)`,
        [TENANT_ID, TZ]
      ),
    ]);

    const montoActual   = Number(cortesActual.rows[0].monto)   + Number(ventasActual.rows[0].monto);
    const montoAnterior = Number(cortesAnterior.rows[0].monto) + Number(ventasAnterior.rows[0].monto);

    const diferenciaPct = montoAnterior === 0
      ? null
      : Math.round(((montoActual - montoAnterior) / montoAnterior) * 100);

    const ahora = new Date();
    const mesActualNombre   = ahora.toLocaleString('es-AR', { month: 'long', timeZone: TZ });
    const mesAnteriorDate   = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const mesAnteriorNombre = mesAnteriorDate.toLocaleString('es-AR', { month: 'long', timeZone: TZ });

    const resultado = {
      monto_actual:    montoActual,
      clientes_actual: Number(cortesActual.rows[0].clientes),
      monto_anterior:  montoAnterior,
      diferencia_pct:  diferenciaPct,
      dia_corte:       ahora.getDate(),
      mes_actual:      mesActualNombre.charAt(0).toUpperCase() + mesActualNombre.slice(1),
      mes_anterior:    mesAnteriorNombre.charAt(0).toUpperCase() + mesAnteriorNombre.slice(1),
    };

    console.log('[Inicio] getComparativoMes — completado:', resultado);
    res.json(resultado);
  } catch (err) {
    console.error('[Inicio] getComparativoMes — error:', err);
    res.status(500).json({ error: 'Error al obtener comparativo mensual' });
  }
};

// ─── GET /api/inicio/stock-bajo ───────────────────────────────────────────────
/**
 * getStockBajo — devuelve los productos activos cuyo stock_actual
 * es menor o igual a su stock_minimo.
 *
 * Responde con:
 *   productos — array de { id, nombre, stock_actual, stock_minimo }
 */
export const getStockBajo = async (req, res) => {
  console.log('[Inicio] getStockBajo — request recibido');
  try {
    const resultado = await query(
      `SELECT id, nombre, stock_actual, stock_minimo
       FROM producto
       WHERE tenant_id = $1
         AND activo = true
         AND stock_actual <= stock_minimo
       ORDER BY (stock_actual - stock_minimo) ASC, nombre ASC`,
      [TENANT_ID]
    );

    console.log('[Inicio] getStockBajo — productos con stock bajo:', resultado.rows.length);
    res.json({ productos: resultado.rows });
  } catch (err) {
    console.error('[Inicio] getStockBajo — error:', err);
    res.status(500).json({ error: 'Error al obtener alertas de stock' });
  }
};
