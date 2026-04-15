// /backend/src/controllers/inicio.js
// Endpoints para la SeccionInicio del panel de administrador.

import { query } from '../config/db.js';

const TZ = 'America/Argentina/Buenos_Aires';

// ─── GET /api/inicio/resumen-dia ──────────────────────────────────────────────
/**
 * getResumenDia
 * Devuelve la actividad del día actual, semana y mes en curso.
 * @param {string} req.tenant_id - Inyectado por verificarToken
 */
export const getResumenDia = async (req, res) => {
  console.log('[inicio] getResumenDia — request recibido | tenant:', req.tenant_id);
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
        [req.tenant_id, TZ]
      ),
      query(
        `SELECT
           COALESCE(SUM(precio_unitario * cantidad), 0) AS monto,
           COALESCE(SUM(cantidad), 0)                   AS unidades
         FROM venta
         WHERE tenant_id = $1
           AND DATE(timestamp AT TIME ZONE $2) = (NOW() AT TIME ZONE $2)::date`,
        [req.tenant_id, TZ]
      ),
    ]);

    // ── Semana actual (lunes a hoy) ───────────────────────────────────────────
    const [cortesSemana, ventasSemana] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(monto_total), 0) AS monto
         FROM corte
         WHERE tenant_id = $1
           AND DATE(timestamp AT TIME ZONE $2) >= DATE_TRUNC('week', (NOW() AT TIME ZONE $2)::date)`,
        [req.tenant_id, TZ]
      ),
      query(
        `SELECT COALESCE(SUM(precio_unitario * cantidad), 0) AS monto
         FROM venta
         WHERE tenant_id = $1
           AND DATE(timestamp AT TIME ZONE $2) >= DATE_TRUNC('week', (NOW() AT TIME ZONE $2)::date)`,
        [req.tenant_id, TZ]
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
        [req.tenant_id, TZ]
      ),
      query(
        `SELECT COALESCE(SUM(precio_unitario * cantidad), 0) AS monto
         FROM venta
         WHERE tenant_id = $1
           AND DATE_TRUNC('month', timestamp AT TIME ZONE $2) = DATE_TRUNC('month', (NOW() AT TIME ZONE $2)::date)`,
        [req.tenant_id, TZ]
      ),
    ]);

    const resultado = {
      monto_dia:     Number(cortesHoy.rows[0].monto)    + Number(ventasHoy.rows[0].monto),
      clientes_dia:  Number(cortesHoy.rows[0].clientes),
      productos_dia: Number(ventasHoy.rows[0].unidades),
      monto_semana:  Number(cortesSemana.rows[0].monto) + Number(ventasSemana.rows[0].monto),
      monto_mes:     Number(cortesMes.rows[0].monto)    + Number(ventasMes.rows[0].monto),
      clientes_mes:  Number(cortesMes.rows[0].clientes),
    };

    console.log('[inicio] getResumenDia — completado | monto_dia:', resultado.monto_dia, '| clientes_dia:', resultado.clientes_dia);
    res.json(resultado);
  } catch (err) {
    console.error('[inicio] Error en getResumenDia:', err.message);
    res.status(500).json({ error: 'Error al obtener resumen del día' });
  }
};

// ─── GET /api/inicio/comparativo-mes ─────────────────────────────────────────
/**
 * getComparativoMes
 * Compara la facturación del mes actual hasta hoy con el mismo período del mes anterior.
 * @param {string} req.tenant_id - Inyectado por verificarToken
 */
export const getComparativoMes = async (req, res) => {
  console.log('[inicio] getComparativoMes — request recibido | tenant:', req.tenant_id);
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
        [req.tenant_id, TZ]
      ),
      query(
        `SELECT COALESCE(SUM(precio_unitario * cantidad), 0) AS monto
         FROM venta
         WHERE tenant_id = $1
           AND DATE_TRUNC('month', timestamp AT TIME ZONE $2) = DATE_TRUNC('month', (NOW() AT TIME ZONE $2)::date)
           AND DATE(timestamp AT TIME ZONE $2) <= (NOW() AT TIME ZONE $2)::date`,
        [req.tenant_id, TZ]
      ),
    ]);

    const [cortesAnterior, ventasAnterior] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(monto_total), 0) AS monto
         FROM corte
         WHERE tenant_id = $1
           AND DATE_TRUNC('month', timestamp AT TIME ZONE $2) = DATE_TRUNC('month', ((NOW() AT TIME ZONE $2)::date - INTERVAL '1 month'))
           AND EXTRACT(DAY FROM timestamp AT TIME ZONE $2) <= EXTRACT(DAY FROM (NOW() AT TIME ZONE $2)::date)`,
        [req.tenant_id, TZ]
      ),
      query(
        `SELECT COALESCE(SUM(precio_unitario * cantidad), 0) AS monto
         FROM venta
         WHERE tenant_id = $1
           AND DATE_TRUNC('month', timestamp AT TIME ZONE $2) = DATE_TRUNC('month', ((NOW() AT TIME ZONE $2)::date - INTERVAL '1 month'))
           AND EXTRACT(DAY FROM timestamp AT TIME ZONE $2) <= EXTRACT(DAY FROM (NOW() AT TIME ZONE $2)::date)`,
        [req.tenant_id, TZ]
      ),
    ]);

    const montoActual   = Number(cortesActual.rows[0].monto)   + Number(ventasActual.rows[0].monto);
    const montoAnterior = Number(cortesAnterior.rows[0].monto) + Number(ventasAnterior.rows[0].monto);

    const diferenciaPct = montoAnterior === 0
      ? null
      : Math.round(((montoActual - montoAnterior) / montoAnterior) * 100);

    const ahora = new Date();
    const mesActualNombre   = ahora.toLocaleString('es-AR', { month: 'long', timeZone: TZ });
    const mesAnteriorDate   = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 15);
    const mesAnteriorNombre = mesAnteriorDate.toLocaleString('es-AR', { month: 'long', timeZone: TZ });

    const resultado = {
      monto_actual:    montoActual,
      clientes_actual: Number(cortesActual.rows[0].clientes),
      monto_anterior:  montoAnterior,
      diferencia_pct:  diferenciaPct,
      dia_corte:       ahora.getDate(),
      mes_actual:      mesActualNombre.charAt(0).toUpperCase()   + mesActualNombre.slice(1),
      mes_anterior:    mesAnteriorNombre.charAt(0).toUpperCase() + mesAnteriorNombre.slice(1),
    };

    console.log('[inicio] getComparativoMes — completado | monto_actual:', resultado.monto_actual, '| diferencia_pct:', resultado.diferencia_pct);
    res.json(resultado);
  } catch (err) {
    console.error('[inicio] Error en getComparativoMes:', err.message);
    res.status(500).json({ error: 'Error al obtener comparativo mensual' });
  }
};

// ─── GET /api/inicio/stock-bajo ───────────────────────────────────────────────
/**
 * getStockBajo
 * Devuelve los productos activos cuyo stock_actual es menor o igual a su stock_minimo.
 * @param {string} req.tenant_id - Inyectado por verificarToken
 * @returns {JSON} { productos: Array }
 */
export const getStockBajo = async (req, res) => {
  console.log('[inicio] getStockBajo — request recibido | tenant:', req.tenant_id);
  try {
    const resultado = await query(
      `SELECT id, nombre, stock_actual, stock_minimo
       FROM producto
       WHERE tenant_id = $1
         AND activo = true
         AND stock_actual <= stock_minimo
       ORDER BY (stock_actual - stock_minimo) ASC, nombre ASC`,
      [req.tenant_id]
    );

    console.log('[inicio] getStockBajo — completado | productos con stock bajo:', resultado.rows.length);
    res.json({ productos: resultado.rows });
  } catch (err) {
    console.error('[inicio] Error en getStockBajo:', err.message);
    res.status(500).json({ error: 'Error al obtener alertas de stock' });
  }
};