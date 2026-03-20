// /backend/src/controllers/balances.js
// Controller para la sección Balances del panel de administrador.

import { query } from '../config/db.js';

// ─── GET /api/balances/mensual?mes=YYYY-MM ────────────────────────────────────
/**
 * Devuelve el balance completo de un mes dado.
 * req.tenant_id inyectado por verificarToken
 * @param {string} req.query.mes - Mes en formato YYYY-MM (default: mes actual)
 */
export const getBalanceMensual = async (req, res) => {
  const mes = req.query.mes || new Date().toISOString().slice(0, 7);
  console.log('[balances] getBalanceMensual — request recibido:', { mes }, '| tenant:', req.tenant_id);

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'Formato de mes inválido. Usar YYYY-MM.' });
  }

  const fechaInicio = `${mes}-01`;
  const [anio, mesNum] = mes.split('-').map(Number);
  const fechaFin = new Date(anio, mesNum, 1).toISOString().slice(0, 10);

  try {
    const queryServicios = `
      SELECT
        b.id                          AS barbero_id,
        b.nombre                      AS nombre,
        b.comision_tipo               AS comision_tipo,
        b.comision_valor              AS comision_valor,
        COUNT(DISTINCT c.id)::int     AS cortes,
        COALESCE(SUM(cs.precio), 0)   AS monto_servicios
      FROM corte c
      JOIN barbero b ON b.id = c.barbero_id
      JOIN corte_servicio cs ON cs.corte_id = c.id
      WHERE c.tenant_id = $1
        AND c.timestamp >= $2
        AND c.timestamp < $3
      GROUP BY b.id, b.nombre, b.comision_tipo, b.comision_valor
      ORDER BY b.nombre
    `;

    const queryPropinas = `
      SELECT COALESCE(SUM(propina), 0) AS total
      FROM corte
      WHERE tenant_id = $1
        AND timestamp >= $2
        AND timestamp < $3
    `;

    const queryProductos = `
      SELECT
        p.nombre                                    AS nombre,
        SUM(v.cantidad)::int                        AS cantidad,
        COALESCE(SUM(v.cantidad * v.precio_unitario), 0) AS total
      FROM venta v
      JOIN producto p ON p.id = v.producto_id
      WHERE v.tenant_id = $1
        AND v.timestamp >= $2
        AND v.timestamp < $3
      GROUP BY p.nombre
      ORDER BY total DESC
    `;

    const queryGastos = `
      SELECT
        cg.nombre                   AS categoria,
        COALESCE(SUM(g.monto), 0)   AS total
      FROM gasto g
      JOIN categoria_gasto cg ON cg.id = g.categoria_id
      WHERE g.tenant_id = $1
        AND g.timestamp >= $2
        AND g.timestamp < $3
      GROUP BY cg.nombre
      ORDER BY total DESC
    `;

    const params = [req.tenant_id, fechaInicio, fechaFin];

    const [resServicios, resPropinas, resProductos, resGastos] = await Promise.all([
      query(queryServicios, params),
      query(queryPropinas, params),
      query(queryProductos, params),
      query(queryGastos, params),
    ]);

    const serviciosPorBarbero = resServicios.rows.map((b) => {
      const montoServicios = Number(b.monto_servicios);
      const comisionValor  = Number(b.comision_valor);
      const montoComision  = montoServicios * (comisionValor / 100);
      const netoNegocio    = montoServicios - montoComision;
      return {
        barbero_id:    b.barbero_id,
        nombre:        b.nombre,
        cortes:        b.cortes,
        monto_servicios: montoServicios,
        comision_tipo:  b.comision_tipo,
        comision_valor: comisionValor,
        monto_comision: Math.round(montoComision * 100) / 100,
        neto_negocio:   Math.round(netoNegocio * 100) / 100,
      };
    });

    const totalProductos = resProductos.rows.reduce((acc, p) => acc + Number(p.total), 0);
    const totalGastos    = resGastos.rows.reduce((acc, g) => acc + Number(g.total), 0);

    const ingresosBrutos  = serviciosPorBarbero.reduce((acc, b) => acc + b.monto_servicios, 0) + totalProductos;
    const totalComisiones = serviciosPorBarbero.reduce((acc, b) => acc + b.monto_comision, 0);
    const ingresosNetos   = ingresosBrutos - totalComisiones;
    const balanceNeto     = ingresosNetos - totalGastos;

    const respuesta = {
      mes,
      serviciosPorBarbero,
      productos: {
        total: Math.round(totalProductos * 100) / 100,
        detalle: resProductos.rows.map((p) => ({
          nombre:   p.nombre,
          cantidad: p.cantidad,
          total:    Number(p.total),
        })),
      },
      gastos: {
        total: Math.round(totalGastos * 100) / 100,
        porCategoria: resGastos.rows.map((g) => ({
          categoria: g.categoria,
          total:     Number(g.total),
        })),
      },
      propinas: { total: Number(resPropinas.rows[0].total) },
      resumen: {
        ingresos_brutos:   Math.round(ingresosBrutos * 100) / 100,
        total_comisiones:  Math.round(totalComisiones * 100) / 100,
        ingresos_netos:    Math.round(ingresosNetos * 100) / 100,
        egresos:           Math.round(totalGastos * 100) / 100,
        balance_neto:      Math.round(balanceNeto * 100) / 100,
      },
    };

    console.log('[balances] getBalanceMensual — completado:', {
      mes,
      barberos: serviciosPorBarbero.length,
      ingresos_brutos: respuesta.resumen.ingresos_brutos,
      balance_neto: respuesta.resumen.balance_neto,
    });

    res.json(respuesta);
  } catch (err) {
    console.error('[balances] Error en getBalanceMensual:', err);
    res.status(500).json({ error: 'Error al obtener el balance mensual.' });
  }
};

// ─── GET /api/balances/historico?cantidad=12 ──────────────────────────────────
/**
 * Devuelve el resumen de los últimos N meses para la tabla de histórico anual.
 * req.tenant_id inyectado por verificarToken
 * @param {number} req.query.cantidad - Cantidad de meses (default: 12, máx: 24)
 */
export const getBalanceHistorico = async (req, res) => {
  const cantidad = Math.min(parseInt(req.query.cantidad) || 12, 24);
  console.log('[balances] getBalanceHistorico — request recibido:', { cantidad }, '| tenant:', req.tenant_id);

  try {
    const queryServiciosMensuales = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', c.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'), 'YYYY-MM') AS mes,
        COALESCE(SUM(cs.precio), 0) AS ingresos_brutos_servicios,
        COALESCE(SUM(cs.precio * b.comision_valor / 100.0), 0) AS total_comisiones
      FROM corte c
      JOIN barbero b ON b.id = c.barbero_id
      JOIN corte_servicio cs ON cs.corte_id = c.id
      WHERE c.tenant_id = $1
        AND c.timestamp >= NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
                            - INTERVAL '1 month' * $2
      GROUP BY DATE_TRUNC('month', c.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
      ORDER BY DATE_TRUNC('month', c.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') DESC
    `;

    const queryProductosMensuales = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'), 'YYYY-MM') AS mes,
        COALESCE(SUM(cantidad * precio_unitario), 0) AS total_productos
      FROM venta
      WHERE tenant_id = $1
        AND timestamp >= NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
                          - INTERVAL '1 month' * $2
      GROUP BY DATE_TRUNC('month', timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
    `;

    const queryGastosMensuales = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'), 'YYYY-MM') AS mes,
        COALESCE(SUM(monto), 0) AS total_gastos
      FROM gasto
      WHERE tenant_id = $1
        AND timestamp >= NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
                          - INTERVAL '1 month' * $2
      GROUP BY DATE_TRUNC('month', timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
    `;

    const [resServicios, resProductos, resGastos] = await Promise.all([
      query(queryServiciosMensuales, [req.tenant_id, cantidad]),
      query(queryProductosMensuales, [req.tenant_id, cantidad]),
      query(queryGastosMensuales,    [req.tenant_id, cantidad]),
    ]);

    const mesesSet = new Set([
      ...resServicios.rows.map((r) => r.mes),
      ...resProductos.rows.map((r) => r.mes),
      ...resGastos.rows.map((r) => r.mes),
    ]);

    const idxServicios = Object.fromEntries(resServicios.rows.map((r) => [r.mes, r]));
    const idxProductos = Object.fromEntries(resProductos.rows.map((r) => [r.mes, r]));
    const idxGastos    = Object.fromEntries(resGastos.rows.map((r) => [r.mes, r]));

    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                          'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const historial = Array.from(mesesSet)
      .sort((a, b) => b.localeCompare(a))
      .map((mes) => {
        const s = idxServicios[mes] || {};
        const p = idxProductos[mes] || {};
        const g = idxGastos[mes]    || {};

        const ingresosBrutos  = Number(s.ingresos_brutos_servicios || 0) + Number(p.total_productos || 0);
        const totalComisiones = Number(s.total_comisiones || 0);
        const ingresosNetos   = ingresosBrutos - totalComisiones;
        const egresos         = Number(g.total_gastos || 0);
        const balanceNeto     = ingresosNetos - egresos;

        const [anio, mesNum] = mes.split('-').map(Number);
        const label = `${nombresMeses[mesNum - 1]} ${anio}`;

        return {
          mes,
          label,
          ingresos_brutos:  Math.round(ingresosBrutos * 100) / 100,
          total_comisiones: Math.round(totalComisiones * 100) / 100,
          ingresos_netos:   Math.round(ingresosNetos * 100) / 100,
          egresos:          Math.round(egresos * 100) / 100,
          balance_neto:     Math.round(balanceNeto * 100) / 100,
        };
      });

    const historialConVariacion = historial.map((mes, idx) => {
      const anterior = historial[idx + 1];
      let variacion = null;
      if (anterior && anterior.balance_neto !== 0) {
        variacion = Math.round(
          ((mes.balance_neto - anterior.balance_neto) / Math.abs(anterior.balance_neto)) * 100
        );
      }
      return { ...mes, variacion_vs_anterior: variacion };
    });

    console.log('[balances] getBalanceHistorico — completado:', {
      meses_devueltos: historialConVariacion.length,
    });

    res.json(historialConVariacion);
  } catch (err) {
    console.error('[balances] Error en getBalanceHistorico:', err);
    res.status(500).json({ error: 'Error al obtener el histórico de balances.' });
  }
};
