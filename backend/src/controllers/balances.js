// /backend/src/controllers/balances.js
// Controller para la sección Balances del panel de administrador.

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { TZ } from '../utils/constantes.js';
import { esCantidadValida } from '../utils/validarNumero.js';
import { TIPOS_MOVIMIENTO_EXTRA, resumirMovimientosExtra } from '../utils/movimientos.js';

/**
 * redondear2
 * Redondea un número a 2 decimales.
 * @param {number} n
 * @returns {number}
 */
const redondear2 = (n) => Math.round(n * 100) / 100;

/**
 * variacionPorcentual
 * Variación de un balance contra el del mes anterior, como % entero. Divide por
 * el valor absoluto del anterior para que un anterior negativo no invierta el
 * signo (pasar de −100 a 50 es una mejora: +150%).
 * @param {number} actual - Balance del mes.
 * @param {number|undefined} anterior - Balance del mes anterior; undefined si no hay.
 * @returns {number|null} % entero, o null si no hay mes anterior o su balance es 0.
 */
const variacionPorcentual = (actual, anterior) => {
  if (anterior === undefined || anterior === 0) return null;
  return Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
};

/**
 * balanceSinComisiones
 * Balance de una fila del histórico sin descontar comisiones: ingresos brutos −
 * egresos. Es el número que muestra el panel con el botón en "Sin comisiones"
 * (`balanceSegunModo` en SeccionBalances.jsx).
 * @param {{ingresos_brutos: number, egresos: number}} fila - Fila del histórico.
 * @returns {number} Balance redondeado a centavos.
 */
const balanceSinComisiones = (fila) => redondear2(fila.ingresos_brutos - fila.egresos);

/**
 * mesAnterior
 * Mes calendario anterior a uno dado. En UTC para que ningún cambio de horario
 * mueva la cuenta: es aritmética de calendario, no un instante.
 * @param {string} mes - Mes 'YYYY-MM'.
 * @returns {string} Mes anterior 'YYYY-MM' (enero → diciembre del año anterior).
 */
const mesAnterior = (mes) =>
  DateTime.fromFormat(mes, 'yyyy-MM', { zone: 'utc' }).minus({ months: 1 }).toFormat('yyyy-MM');

/**
 * agruparCapitalPorSocio
 * Totaliza los movimientos de capital de un mes por socio. Si un movimiento es
 * aporte o retiro lo decide `sentido` en TIPOS_MOVIMIENTO_EXTRA, no el nombre
 * del tipo.
 * @param {Array<{tipo: string, socio_id: string, socio_nombre: string, monto: number}>} detalle -
 *   Movimientos de capital del mes (los que no afectan el resultado), con `monto` como número.
 * @returns {Array<{socio_id: string, nombre: string, aportes: number, retiros: number}>}
 *   Una entrada por socio con movimientos, ordenada por nombre.
 */
const agruparCapitalPorSocio = (detalle) => {
  const porSocio = new Map();

  for (const m of detalle) {
    if (!porSocio.has(m.socio_id)) {
      porSocio.set(m.socio_id, { socio_id: m.socio_id, nombre: m.socio_nombre, aportes: 0, retiros: 0 });
    }
    const acumulado = porSocio.get(m.socio_id);
    if (TIPOS_MOVIMIENTO_EXTRA[m.tipo].sentido === 'entrada') {
      acumulado.aportes += m.monto;
    } else {
      acumulado.retiros += m.monto;
    }
  }

  return Array.from(porSocio.values())
    .map((s) => ({ ...s, aportes: redondear2(s.aportes), retiros: redondear2(s.retiros) }))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es') || String(a.socio_id).localeCompare(String(b.socio_id)));
};

// ─── GET /api/balances/mensual?mes=YYYY-MM ────────────────────────────────────
/**
 * getBalanceMensual
 * Devuelve el balance completo de un mes dado. `serviciosPorBarbero` incluye a
 * los barberos activos que no cortaron en el mes, con sus montos en 0.
 * Los movimientos extra del mes se separan según TIPOS_MOVIMIENTO_EXTRA: los que
 * afectan el resultado van a `otrosIngresos` y suman a `ingresos_brutos` (y por
 * lo tanto al `balance_neto`); los de capital (aportes y retiros) van a
 * `capital` y no entran en ninguna fórmula del resultado.
 * @param {string} req.query.mes - Mes en formato YYYY-MM (default: mes actual)
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} {
 *   mes, serviciosPorBarbero, productos, gastos, propinas,
 *   otrosIngresos: { total, detalle: [{ id, fecha, descripcion, monto, forma_pago, sentido }] },
 *   capital: {
 *     aportes, retiros,
 *     detalle:  [{ id, fecha, tipo, socio_id, socio_nombre, descripcion, monto, forma_pago, sentido }],
 *     porSocio: [{ socio_id, nombre, aportes, retiros }]
 *   },
 *   resumen: { ingresos_brutos, total_comisiones, ingresos_netos, egresos, balance_neto,
 *              otros_ingresos, aportes, retiros }
 * } — `fecha` como YYYY-MM-DD (hora argentina) y los montos como número.
 *   400 si `mes` no tiene formato YYYY-MM.
 */
export const getBalanceMensual = async (req, res) => {
  const mes = req.query.mes || new Date().toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'Formato de mes inválido. Usar YYYY-MM.' });
  }

  // El mes se filtra en hora argentina, igual que ventas y gastos:
  // TO_CHAR(timestamp AT TIME ZONE tz, 'YYYY-MM') = mes. Antes se comparaba el
  // timestamp contra fechas sueltas, que Postgres interpreta en la zona de la
  // sesión (UTC): el mes cortaba a las 21:00 hora argentina del último día.
  const params = [req.tenant_id, mes, TZ];

  try {
    // Arranca desde barbero con LEFT JOIN a corte para listar también a los que
    // no cortaron en el mes (el filtro de fecha va en el ON: en el WHERE
    // descartaría sus filas). Qué barberos aparecen, en el HAVING — misma regla
    // que la planilla semanal (services/planillaService.js): los que cortaron en
    // el mes, aunque hoy estén dados de baja, más los activos dados de alta a
    // más tardar en ese mes.
    const queryServicios = `
      SELECT
        b.id                          AS barbero_id,
        b.nombre                      AS nombre,
        b.comision_tipo               AS comision_tipo,
        b.comision_valor              AS comision_valor,
        COUNT(c.id)::int              AS cortes,
        COALESCE(SUM(c.precio), 0)    AS monto_servicios
      FROM barbero b
      LEFT JOIN corte c
             ON c.barbero_id = b.id
            AND c.tenant_id  = $1
            AND TO_CHAR(c.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
      WHERE b.tenant_id = $1
      GROUP BY b.id, b.nombre, b.comision_tipo, b.comision_valor, b.activo, b.created_at
      HAVING COUNT(c.id) > 0
          OR (b.activo = true AND TO_CHAR(b.created_at AT TIME ZONE $3, 'YYYY-MM') <= $2)
      ORDER BY b.nombre, b.id
    `;

    const queryPropinas = `
      SELECT COALESCE(SUM(propina), 0) AS total
      FROM corte
      WHERE tenant_id = $1
        AND TO_CHAR(timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
    `;

    const queryProductos = `
      SELECT
        p.nombre                                         AS nombre,
        SUM(v.cantidad)::int                             AS cantidad,
        COALESCE(SUM(v.cantidad * v.precio_unitario), 0) AS total
      FROM venta v
      JOIN producto p ON p.id = v.producto_id
      WHERE v.tenant_id = $1
        AND TO_CHAR(v.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
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
        AND TO_CHAR(g.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
      GROUP BY cg.nombre
      ORDER BY total DESC
    `;

    // Detalle de los movimientos extra del mes, en orden cronológico. El join
    // repite tenant_id como defensa en profundidad (igual que en caja.js).
    const queryMovimientosExtra = `
      SELECT
        me.id                                                   AS id,
        me.tipo                                                 AS tipo,
        me.socio_id                                             AS socio_id,
        s.nombre                                                AS socio_nombre,
        me.descripcion                                          AS descripcion,
        me.monto                                                AS monto,
        me.forma_pago                                           AS forma_pago,
        TO_CHAR(me.timestamp AT TIME ZONE $3, 'YYYY-MM-DD')     AS fecha
      FROM movimiento_extra me
      LEFT JOIN socio s ON s.id = me.socio_id AND s.tenant_id = me.tenant_id
      WHERE me.tenant_id = $1
        AND TO_CHAR(me.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
      ORDER BY me.timestamp ASC, me.id ASC
    `;

    const [resServicios, resPropinas, resProductos, resGastos, resExtras] = await Promise.all([
      query(queryServicios, params),
      query(queryPropinas, params),
      query(queryProductos, params),
      query(queryGastos, params),
      query(queryMovimientosExtra, params),
    ]);

    const serviciosPorBarbero = resServicios.rows.map((b) => {
      const montoServicios = Number(b.monto_servicios);
      const comisionValor  = Number(b.comision_valor);
      const montoComision  = montoServicios * (comisionValor / 100);
      const netoNegocio    = montoServicios - montoComision;
      return {
        barbero_id:      b.barbero_id,
        nombre:          b.nombre,
        cortes:          b.cortes,
        monto_servicios: montoServicios,
        comision_tipo:   b.comision_tipo,
        comision_valor:  comisionValor,
        monto_comision:  redondear2(montoComision),
        neto_negocio:    redondear2(netoNegocio),
      };
    });

    // Movimientos extra: los totales salen de resumirMovimientosExtra (que además
    // rechaza un tipo desconocido) y cada fila se reparte según afectaResultado.
    // pg devuelve los NUMERIC como string: la API expone el monto como número.
    const totalesExtra = resumirMovimientosExtra(
      resExtras.rows.map((m) => ({ tipo: m.tipo, total: m.monto }))
    );
    // Cada fila lleva `sentido` resuelto, igual que las de Caja: el front no
    // decide por nombre de tipo si un movimiento suma o resta.
    const detalleOtrosIngresos = [];
    const detalleCapital       = [];
    for (const m of resExtras.rows) {
      const monto = Number(m.monto);
      const { afectaResultado, sentido } = TIPOS_MOVIMIENTO_EXTRA[m.tipo];
      if (afectaResultado) {
        detalleOtrosIngresos.push({
          id:          m.id,
          fecha:       m.fecha,
          descripcion: m.descripcion,
          monto,
          forma_pago:  m.forma_pago,
          sentido,
        });
      } else {
        detalleCapital.push({
          id:           m.id,
          fecha:        m.fecha,
          tipo:         m.tipo,
          socio_id:     m.socio_id,
          socio_nombre: m.socio_nombre,
          descripcion:  m.descripcion,
          monto,
          forma_pago:   m.forma_pago,
          sentido,
        });
      }
    }

    const totalProductos  = resProductos.rows.reduce((acc, p) => acc + Number(p.total), 0);
    const totalGastos     = resGastos.rows.reduce((acc, g) => acc + Number(g.total), 0);
    const ingresosBrutos  = serviciosPorBarbero.reduce((acc, b) => acc + b.monto_servicios, 0)
                          + totalProductos
                          + totalesExtra.otrosIngresos;
    const totalComisiones = serviciosPorBarbero.reduce((acc, b) => acc + b.monto_comision, 0);
    const ingresosNetos   = ingresosBrutos - totalComisiones;
    const balanceNeto     = ingresosNetos - totalGastos;

    const respuesta = {
      mes,
      serviciosPorBarbero,
      productos: {
        total:   redondear2(totalProductos),
        detalle: resProductos.rows.map((p) => ({
          nombre:   p.nombre,
          cantidad: p.cantidad,
          total:    Number(p.total),
        })),
      },
      gastos: {
        total:        redondear2(totalGastos),
        porCategoria: resGastos.rows.map((g) => ({
          categoria: g.categoria,
          total:     Number(g.total),
        })),
      },
      propinas: { total: Number(resPropinas.rows[0].total) },
      otrosIngresos: {
        total:   redondear2(totalesExtra.otrosIngresos),
        detalle: detalleOtrosIngresos,
      },
      capital: {
        aportes:  redondear2(totalesExtra.aportes),
        retiros:  redondear2(totalesExtra.retiros),
        detalle:  detalleCapital,
        porSocio: agruparCapitalPorSocio(detalleCapital),
      },
      resumen: {
        ingresos_brutos:  redondear2(ingresosBrutos),
        total_comisiones: redondear2(totalComisiones),
        ingresos_netos:   redondear2(ingresosNetos),
        egresos:          redondear2(totalGastos),
        balance_neto:     redondear2(balanceNeto),
        otros_ingresos:   redondear2(totalesExtra.otrosIngresos),
        aportes:          redondear2(totalesExtra.aportes),
        retiros:          redondear2(totalesExtra.retiros),
      },
    };

    res.json(respuesta);
  } catch (err) {
    console.error('[balances] Error en getBalanceMensual:', err);
    res.status(500).json({ error: 'Error al obtener el balance mensual.' });
  }
};

// ─── GET /api/balances/historico?cantidad=12 ──────────────────────────────────
/**
 * getBalanceHistorico
 * Devuelve el resumen de los últimos N meses para la tabla de histórico anual:
 * el mes en curso + los N-1 anteriores completos, con los meses en hora argentina.
 * Un mes aparece si tuvo al menos un corte, venta, gasto o movimiento extra.
 * `ingresos_brutos` incluye los otros ingresos; `balance_neto` y las variaciones
 * no incluyen aportes ni retiros (son capital, no resultado).
 * @param {number} [req.query.cantidad] - Cantidad de meses, entero >= 1 (default: 12).
 *   Lo que pase de 24 se recorta a 24.
 * @param {string} req.tenant_id     - Inyectado por tenantMiddleware
 * @returns {JSON} [{ mes, label, ingresos_brutos, total_comisiones, ingresos_netos, egresos,
 *   balance_neto, otros_ingresos, aportes, retiros, variacion_vs_anterior,
 *   variacion_vs_anterior_sin_comisiones }], del mes más reciente al más viejo.
 *   Las dos variaciones comparan contra el mes calendario anterior y son un % entero, o
 *   null si ese mes no tuvo movimientos (no está en la lista) o su balance es 0:
 *   `variacion_vs_anterior` compara `balance_neto` (con comisiones) y
 *   `variacion_vs_anterior_sin_comisiones` compara ingresos brutos − egresos, para el
 *   botón "Sin comisiones" del panel. 400 si `cantidad` viene y no es un entero >= 1.
 */
export const getBalanceHistorico = async (req, res) => {
  if (req.query.cantidad !== undefined && !esCantidadValida(req.query.cantidad)) {
    return res.status(400).json({ error: 'cantidad debe ser un entero mayor o igual a 1' });
  }
  const cantidad = Math.min(Number(req.query.cantidad ?? 12), 24);

  // Borde inferior de la ventana: día 1 a las 00:00 (hora argentina) del mes
  // más viejo, así entran exactamente `cantidad` meses. Antes restaba N meses a
  // NOW() y comparaba contra la hora UTC: el mes más viejo salía parcial.
  const params = [req.tenant_id, cantidad - 1];

  try {
    const queryServiciosMensuales = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', c.timestamp AT TIME ZONE '${TZ}'), 'YYYY-MM') AS mes,
        COALESCE(SUM(c.precio), 0)                                                 AS ingresos_brutos_servicios,
        COALESCE(SUM(c.precio * b.comision_valor / 100.0), 0)                      AS total_comisiones
      FROM corte c
      JOIN barbero b ON b.id = c.barbero_id
      WHERE c.tenant_id = $1
        AND c.timestamp AT TIME ZONE '${TZ}' >= DATE_TRUNC('month', NOW() AT TIME ZONE '${TZ}') - INTERVAL '1 month' * $2
      GROUP BY DATE_TRUNC('month', c.timestamp AT TIME ZONE '${TZ}')
      ORDER BY DATE_TRUNC('month', c.timestamp AT TIME ZONE '${TZ}') DESC
    `;

    const queryProductosMensuales = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', timestamp AT TIME ZONE '${TZ}'), 'YYYY-MM') AS mes,
        COALESCE(SUM(cantidad * precio_unitario), 0)                             AS total_productos
      FROM venta
      WHERE tenant_id = $1
        AND timestamp AT TIME ZONE '${TZ}' >= DATE_TRUNC('month', NOW() AT TIME ZONE '${TZ}') - INTERVAL '1 month' * $2
      GROUP BY DATE_TRUNC('month', timestamp AT TIME ZONE '${TZ}')
    `;

    const queryGastosMensuales = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', timestamp AT TIME ZONE '${TZ}'), 'YYYY-MM') AS mes,
        COALESCE(SUM(monto), 0)                                                  AS total_gastos
      FROM gasto
      WHERE tenant_id = $1
        AND timestamp AT TIME ZONE '${TZ}' >= DATE_TRUNC('month', NOW() AT TIME ZONE '${TZ}') - INTERVAL '1 month' * $2
      GROUP BY DATE_TRUNC('month', timestamp AT TIME ZONE '${TZ}')
    `;

    // Una fila por (mes, tipo): la clasificación por tipo se hace en JS con
    // resumirMovimientosExtra, no en el SQL.
    const queryExtrasMensuales = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', timestamp AT TIME ZONE '${TZ}'), 'YYYY-MM') AS mes,
        tipo                                                                     AS tipo,
        COALESCE(SUM(monto), 0)                                                  AS total
      FROM movimiento_extra
      WHERE tenant_id = $1
        AND timestamp AT TIME ZONE '${TZ}' >= DATE_TRUNC('month', NOW() AT TIME ZONE '${TZ}') - INTERVAL '1 month' * $2
      GROUP BY DATE_TRUNC('month', timestamp AT TIME ZONE '${TZ}'), tipo
    `;

    const [resServicios, resProductos, resGastos, resExtras] = await Promise.all([
      query(queryServiciosMensuales, params),
      query(queryProductosMensuales, params),
      query(queryGastosMensuales,    params),
      query(queryExtrasMensuales,    params),
    ]);

    const mesesSet = new Set([
      ...resServicios.rows.map((r) => r.mes),
      ...resProductos.rows.map((r) => r.mes),
      ...resGastos.rows.map((r) => r.mes),
      ...resExtras.rows.map((r) => r.mes),
    ]);

    const idxServicios = Object.fromEntries(resServicios.rows.map((r) => [r.mes, r]));
    const idxProductos = Object.fromEntries(resProductos.rows.map((r) => [r.mes, r]));
    const idxGastos    = Object.fromEntries(resGastos.rows.map((r) => [r.mes, r]));

    // Los movimientos extra traen varias filas por mes (una por tipo): se agrupan.
    const extrasPorMes = {};
    for (const r of resExtras.rows) {
      (extrasPorMes[r.mes] ||= []).push(r);
    }

    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                          'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const historial = Array.from(mesesSet)
      .sort((a, b) => b.localeCompare(a))
      .map((mes) => {
        const s = idxServicios[mes] || {};
        const p = idxProductos[mes] || {};
        const g = idxGastos[mes]    || {};

        const e = resumirMovimientosExtra(extrasPorMes[mes] || []);

        const ingresosBrutos  = Number(s.ingresos_brutos_servicios || 0)
                              + Number(p.total_productos || 0)
                              + e.otrosIngresos;
        const totalComisiones = Number(s.total_comisiones || 0);
        const ingresosNetos   = ingresosBrutos - totalComisiones;
        const egresos         = Number(g.total_gastos || 0);
        const balanceNeto     = ingresosNetos - egresos;

        const [anio, mesNum] = mes.split('-').map(Number);
        const label = `${nombresMeses[mesNum - 1]} ${anio}`;

        return {
          mes,
          label,
          ingresos_brutos:  redondear2(ingresosBrutos),
          total_comisiones: redondear2(totalComisiones),
          ingresos_netos:   redondear2(ingresosNetos),
          egresos:          redondear2(egresos),
          balance_neto:     redondear2(balanceNeto),
          otros_ingresos:   redondear2(e.otrosIngresos),
          aportes:          redondear2(e.aportes),
          retiros:          redondear2(e.retiros),
        };
      });

    // Se compara contra el mes calendario anterior. Si no tuvo movimientos no
    // está en la lista y la variación queda en null: no se salta a uno más
    // viejo (pasa con el primer mes de uso del sistema).
    const historialPorMes = new Map(historial.map((fila) => [fila.mes, fila]));
    const historialConVariacion = historial.map((mes) => {
      const anterior = historialPorMes.get(mesAnterior(mes.mes));
      return {
        ...mes,
        variacion_vs_anterior: variacionPorcentual(mes.balance_neto, anterior?.balance_neto),
        variacion_vs_anterior_sin_comisiones: variacionPorcentual(
          balanceSinComisiones(mes),
          anterior ? balanceSinComisiones(anterior) : undefined,
        ),
      };
    });

    res.json(historialConVariacion);
  } catch (err) {
    console.error('[balances] Error en getBalanceHistorico:', err);
    res.status(500).json({ error: 'Error al obtener el histórico de balances.' });
  }
};