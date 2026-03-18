// /backend/src/controllers/balances.js
// Controller para la sección Balances del panel de administrador.
// Expone dos endpoints:
//   - getBalanceMensual: desglose completo de un mes (servicios por barbero,
//     productos, gastos, propinas). Incluye cálculo de comisiones.
//   - getBalanceHistorico: resumen de los últimos N meses para la tabla anual.

import { query } from '../config/db.js';

const TENANT_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

// ─── GET /api/balances/mensual?mes=YYYY-MM ────────────────────────────────────
/**
 * Devuelve el balance completo de un mes dado.
 * @param {string} req.query.mes - Mes en formato YYYY-MM (default: mes actual)
 * @returns {object} {
 *   serviciosPorBarbero: [{ barbero_id, nombre, cortes, monto_servicios,
 *                           comision_tipo, comision_valor, monto_comision, neto_negocio }],
 *   productos: { total, detalle: [{ nombre, cantidad, total }] },
 *   gastos: { total, porCategoria: [{ categoria, total }] },
 *   propinas: { total },
 *   resumen: { ingresos_brutos, total_comisiones, ingresos_netos, egresos, balance_neto }
 * }
 */
export const getBalanceMensual = async (req, res) => {
  const mes = req.query.mes || new Date().toISOString().slice(0, 7); // YYYY-MM
  console.log('[balances] getBalanceMensual — request recibido:', { mes });

  // Validar formato del parámetro
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'Formato de mes inválido. Usar YYYY-MM.' });
  }

  const fechaInicio = `${mes}-01`;
  // Primer día del mes siguiente (para filtro < en lugar de BETWEEN)
  const [anio, mesNum] = mes.split('-').map(Number);
  const fechaFin = new Date(anio, mesNum, 1).toISOString().slice(0, 10);

  try {
    // ── Query 1: Servicios agrupados por barbero ──────────────────────────────
    // Obtiene cortes + precio de servicio + datos de comisión del barbero.
    // Agrupa por barbero para calcular total de servicios por cada uno.
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

    // ── Query 2: Propinas totales del mes ─────────────────────────────────────
    // Suma de propinas — se muestra como dato informativo, no entra al balance.
    const queryPropinas = `
      SELECT COALESCE(SUM(propina), 0) AS total
      FROM corte
      WHERE tenant_id = $1
        AND timestamp >= $2
        AND timestamp < $3
    `;

    // ── Query 3: Ventas de productos agrupadas ────────────────────────────────
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

    // ── Query 4: Gastos agrupados por categoría ───────────────────────────────
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

    const params = [TENANT_ID, fechaInicio, fechaFin];

    // Ejecutar las 4 queries en paralelo
    const [resServicios, resPropinas, resProductos, resGastos] = await Promise.all([
      query(queryServicios, params),
      query(queryPropinas, params),
      query(queryProductos, params),
      query(queryGastos, params),
    ]);

    // ── Calcular comisiones por barbero ───────────────────────────────────────
    const serviciosPorBarbero = resServicios.rows.map((b) => {
      const montoServicios = Number(b.monto_servicios);
      const comisionValor = Number(b.comision_valor);
      // Por ahora solo soportamos tipo 'porcentaje'
      const montoComision = montoServicios * (comisionValor / 100);
      const netoNegocio = montoServicios - montoComision;
      return {
        barbero_id: b.barbero_id,
        nombre: b.nombre,
        cortes: b.cortes,
        monto_servicios: montoServicios,
        comision_tipo: b.comision_tipo,
        comision_valor: comisionValor,
        monto_comision: Math.round(montoComision * 100) / 100,
        neto_negocio: Math.round(netoNegocio * 100) / 100,
      };
    });

    // ── Totales de productos ──────────────────────────────────────────────────
    const totalProductos = resProductos.rows.reduce(
      (acc, p) => acc + Number(p.total), 0
    );

    // ── Totales de gastos ─────────────────────────────────────────────────────
    const totalGastos = resGastos.rows.reduce(
      (acc, g) => acc + Number(g.total), 0
    );

    // ── Resumen general ───────────────────────────────────────────────────────
    const ingresosBrutos =
      serviciosPorBarbero.reduce((acc, b) => acc + b.monto_servicios, 0) +
      totalProductos;
    const totalComisiones = serviciosPorBarbero.reduce(
      (acc, b) => acc + b.monto_comision, 0
    );
    const ingresosNetos = ingresosBrutos - totalComisiones;
    const balanceNeto = ingresosNetos - totalGastos;

    const respuesta = {
      mes,
      serviciosPorBarbero,
      productos: {
        total: Math.round(totalProductos * 100) / 100,
        detalle: resProductos.rows.map((p) => ({
          nombre: p.nombre,
          cantidad: p.cantidad,
          total: Number(p.total),
        })),
      },
      gastos: {
        total: Math.round(totalGastos * 100) / 100,
        porCategoria: resGastos.rows.map((g) => ({
          categoria: g.categoria,
          total: Number(g.total),
        })),
      },
      propinas: {
        total: Number(resPropinas.rows[0].total),
      },
      resumen: {
        ingresos_brutos: Math.round(ingresosBrutos * 100) / 100,
        total_comisiones: Math.round(totalComisiones * 100) / 100,
        ingresos_netos: Math.round(ingresosNetos * 100) / 100,
        egresos: Math.round(totalGastos * 100) / 100,
        balance_neto: Math.round(balanceNeto * 100) / 100,
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
 * @param {number} req.query.cantidad - Cantidad de meses a traer (default: 12)
 * @returns {Array} [{
 *   mes: 'YYYY-MM', label: 'Ene 2026',
 *   ingresos_brutos, total_comisiones, ingresos_netos,
 *   egresos, balance_neto
 * }]
 */
export const getBalanceHistorico = async (req, res) => {
  const cantidad = Math.min(parseInt(req.query.cantidad) || 12, 24);
  console.log('[balances] getBalanceHistorico — request recibido:', { cantidad });

  try {
    // ── Servicios + comisiones agrupados por mes ──────────────────────────────
    // Calcula monto de servicios y comisión de cada corte, agrupa por mes.
    // Usa subconsulta para poder aplicar la comisión a nivel de fila antes de agrupar.
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

    // ── Productos agrupados por mes ───────────────────────────────────────────
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

    // ── Gastos agrupados por mes ──────────────────────────────────────────────
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
      query(queryServiciosMensuales, [TENANT_ID, cantidad]),
      query(queryProductosMensuales, [TENANT_ID, cantidad]),
      query(queryGastosMensuales, [TENANT_ID, cantidad]),
    ]);

    // ── Combinar los tres resultados por mes ──────────────────────────────────
    // Recolectar todos los meses que aparecen en alguna de las tres queries
    const mesesSet = new Set([
      ...resServicios.rows.map((r) => r.mes),
      ...resProductos.rows.map((r) => r.mes),
      ...resGastos.rows.map((r) => r.mes),
    ]);

    // Índices para lookup rápido
    const idxServicios = Object.fromEntries(resServicios.rows.map((r) => [r.mes, r]));
    const idxProductos = Object.fromEntries(resProductos.rows.map((r) => [r.mes, r]));
    const idxGastos = Object.fromEntries(resGastos.rows.map((r) => [r.mes, r]));

    // Nombres de meses en español para el label
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                          'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const historial = Array.from(mesesSet)
      .sort((a, b) => b.localeCompare(a)) // más reciente primero
      .map((mes, idx, arr) => {
        const s = idxServicios[mes] || {};
        const p = idxProductos[mes] || {};
        const g = idxGastos[mes] || {};

        const ingresosBrutos =
          Number(s.ingresos_brutos_servicios || 0) + Number(p.total_productos || 0);
        const totalComisiones = Number(s.total_comisiones || 0);
        const ingresosNetos = ingresosBrutos - totalComisiones;
        const egresos = Number(g.total_gastos || 0);
        const balanceNeto = ingresosNetos - egresos;

        // Label legible: "Mar 2026"
        const [anio, mesNum] = mes.split('-').map(Number);
        const label = `${nombresMeses[mesNum - 1]} ${anio}`;

        return {
          mes,
          label,
          ingresos_brutos: Math.round(ingresosBrutos * 100) / 100,
          total_comisiones: Math.round(totalComisiones * 100) / 100,
          ingresos_netos: Math.round(ingresosNetos * 100) / 100,
          egresos: Math.round(egresos * 100) / 100,
          balance_neto: Math.round(balanceNeto * 100) / 100,
        };
      });

    // Agregar variación vs mes anterior (el siguiente en el array = el anterior en el tiempo)
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
