// /frontend/src/screens/admin/sections/SeccionBalances.jsx
//
// Sección Balances del panel de administrador.
//   Tab 1 — Balance mensual: 3 KPI (ingresos / egresos / ganancia del mes) +
//   tabla por barbero (con toggle de comisiones, más las filas de productos y
//   otros ingresos) + tabla por categoría de gasto + bloque "Aportes y retiros".
//   La tabla por barbero lista a los activos aunque no hayan cortado (en 0),
//   más los dados de baja que cortaron en el mes (regla en controllers/balances.js).
//   Tab 2 — Histórico anual: tabla de los últimos 12 meses con variación %
//   contra el mes anterior (BadgeVariacion primitivo).
//
// El toggle "Con/Sin comisiones" recalcula los KPI, los totales por barbero y
// el balance del histórico — la regla es: si "sin comisiones", el negocio se
// queda con el bruto (ingresos_brutos − egresos), no se descuenta la comisión.
//
// Aportes y retiros de los dueños son capital, no resultado: no entran en la
// ganancia del mes. Se muestran aparte, cerrando en "Queda en el negocio"
// (ganancia + aportes − retiros). Ver docs/plan_movimientos_extra.md §5.

import { useState, useEffect } from 'react';
import {
  Banknote,
  Receipt,
  Wallet,
  Info,
  BarChart3,
  RefreshCw,
} from 'lucide-react';

import { apiFetch } from '../../../services/api';
import { fmtPesos, formatPago } from '../../../utils/formato';
import { getMesActual, mesALabel } from '../../../utils/fecha';
import { labelTipoMovimiento } from '../../../utils/movimientos';
import { cargarChunk } from '../../../utils/cargarChunk';
import { theme } from '../../../theme/tokens.js';

import {
  Tabs,
  Card,
  EmptyState,
  IconoAlerta,
  Button,
  LoadingState,
  Toast,
  BadgeVariacion,
  BotonExportarExcel,
  TogglePill,
  SelectorMes,
} from '../../../components/ui';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * balanceSegunModo
 * Calcula el balance neto de una fila/resumen según el toggle de comisiones.
 *   - Con comisiones → ingresos_netos − egresos (lo que pidió hist.) o
 *     balance_neto (lo que ya viene precalculado en el resumen mensual).
 *   - Sin comisiones → ingresos_brutos − egresos.
 * Se centraliza acá para evitar reproducir la fórmula en 3 lugares.
 *
 * @param {object} fila - Fila del histórico o `datosMensual.resumen`.
 * @param {boolean} mostrarComisiones
 * @param {boolean} [usarBalancePrecalculado] - Si true, usa `balance_neto`
 *   cuando mostrarComisiones=true (caso del resumen mensual).
 */
function balanceSegunModo(fila, mostrarComisiones, usarBalancePrecalculado = false) {
  if (mostrarComisiones) {
    return usarBalancePrecalculado
      ? fila.balance_neto
      : fila.ingresos_netos - fila.egresos;
  }
  return fila.ingresos_brutos - fila.egresos;
}

/**
 * quedaEnElNegocio
 * Lo que queda en el negocio después de los movimientos de los dueños:
 * ganancia del mes + aportes − retiros. Lo calcula el front porque la ganancia
 * depende del toggle de comisiones (plan §5). Se redondea a centavos para no
 * arrastrar errores de coma flotante al Excel.
 *
 * @param {number} ganancia - Ganancia del mes (según el modo de comisiones).
 * @param {number} aportes  - Total de aportes de capital del período.
 * @param {number} retiros  - Total de retiros de los dueños del período.
 * @returns {number} Monto que queda en el negocio (puede ser negativo).
 */
function quedaEnElNegocio(ganancia, aportes, retiros) {
  return Math.round((ganancia + aportes - retiros) * 100) / 100;
}

/**
 * esSalida
 * Indica si un movimiento extra resta plata al negocio. Lo usa el Excel para el
 * signo del monto. El sentido llega resuelto desde el backend: el front no lo
 * decide por el nombre del tipo (ver utils/movimientos.js).
 *
 * @param {{sentido: 'entrada'|'salida'}} movimiento - Fila de `otrosIngresos.detalle`
 *   o de `capital.detalle`.
 * @returns {boolean} true si el movimiento es una salida.
 */
function esSalida(movimiento) {
  return movimiento.sentido === 'salida';
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

/**
 * KpiCard
 * Card de KPI grande con eyebrow + ícono + valor en color de acento.
 * @param {string} props.titulo - Eyebrow uppercase mono.
 * @param {number} props.valor - Monto a formatear con fmtPesos.
 * @param {string} props.color - Color del valor (accent/danger/ink).
 * @param {string} [props.subtitulo] - Texto auxiliar abajo en muted.
 * @param {React.ComponentType} props.icon - Componente Lucide.
 */
function KpiCard({ titulo, valor, color, subtitulo, icon: Icon }) {
  return (
    <Card padding={20} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{
          fontFamily: theme.mono,
          fontWeight: theme.weightMedium,
          fontSize: theme.sizeMicro,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: theme.muted,
        }}>{titulo}</span>

        <div style={{
          width: 28,
          height: 28,
          borderRadius: theme.radius,
          background: theme.surfaceAlt,
          color: theme.muted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={16} strokeWidth={1.75} />
        </div>
      </div>

      <span style={{
        fontFamily: theme.body,
        fontSize: 26,
        fontWeight: theme.weightHeading,
        color,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}>{fmtPesos(valor)}</span>

      {subtitulo && (
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.muted,
        }}>{subtitulo}</span>
      )}
    </Card>
  );
}

/**
 * BloqueTabla
 * Card con header (eyebrow uppercase mono) + children (tabla densa).
 * Se usa para los dos bloques del tab mensual y el del tab histórico.
 */
function BloqueTabla({ titulo, children, footer }) {
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      {titulo && (
        <div style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${theme.hairline}`,
          fontFamily: theme.mono,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeMicro,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: theme.inkSoft,
        }}>
          {titulo}
        </div>
      )}
      {children}
      {footer && (
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${theme.hairline}`,
        }}>
          {footer}
        </div>
      )}
    </Card>
  );
}

/**
 * NotaAlPie
 * Nota informativa para el footer de un BloqueTabla: ícono Info + texto muted.
 * La usan la nota de propinas y la de aportes y retiros.
 * @param {React.ReactNode} props.children - Texto de la nota.
 */
function NotaAlPie({ children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
      color: theme.muted,
    }}>
      <Info size={14} strokeWidth={1.75} />
      <span>{children}</span>
    </div>
  );
}

// Estilos compartidos para celdas densas (Caja/Ventas/Gastos/Planillas pattern).
// Headers de columna: eyebrow mono uppercase sobre fondo blanco, con
// border-bottom hairline. Sin banda gris.
const thStyle = {
  padding: '10px 14px',
  fontFamily: theme.mono,
  fontWeight: theme.weightHeading,
  fontSize: theme.sizeMicro,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: theme.inkSoft,
  textAlign: 'left',
  borderBottom: `1px solid ${theme.hairline}`,
};

// Filas de datos: separadores casi imperceptibles entre filas.
const tdStyle = {
  padding: '10px 14px',
  fontFamily: theme.body,
  fontSize: theme.sizeBody,
  color: theme.ink,
  borderBottom: `1px solid ${theme.hairlineSoft}`,
};

// Fila TOTAL — ancla visual de la tabla.
// Línea indigo de 2px arriba (border-top accent) + texto ink bold; el monto
// se pinta en accent en el caller (mantiene la regla "totales en indigo").
// Sin bg: la jerarquía la da la línea, no una banda gris.
const tdTotalStyle = {
  padding: '14px 14px',
  fontFamily: theme.body,
  fontSize: theme.sizeBody,
  fontWeight: theme.weightHeading,
  color: theme.ink,
  borderTop: `2px solid ${theme.accent}`,
};

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * SeccionBalances
 * Sección Balances del panel admin: tabs "Balance mensual" e "Histórico anual",
 * toggle de comisiones compartido y export a Excel del tab activo.
 * @returns {JSX.Element}
 */
export default function SeccionBalances() {
  const [tabActivo, setTabActivo]                 = useState('mensual');
  const [mesSeleccionado, setMesSeleccionado]     = useState(getMesActual());
  const [mostrarComisiones, setMostrarComisiones] = useState(true);
  const [errorExport, setErrorExport]             = useState(null);

  // Tab mensual.
  const [datosMensual, setDatosMensual]   = useState(null);
  const [cargandoMensual, setCargandoMensual] = useState(false);
  const [errorMensual, setErrorMensual]   = useState(null);
  const [intentoMensual, setIntentoMensual] = useState(0);

  // Tab histórico (lazy load al abrir el tab por primera vez).
  const [datosHistorico, setDatosHistorico]       = useState(null);
  const [cargandoHistorico, setCargandoHistorico] = useState(false);
  const [errorHistorico, setErrorHistorico]       = useState(null);
  const [intentoHistorico, setIntentoHistorico]   = useState(0);

  // ── Carga del balance mensual ──────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargandoMensual(true);
      setErrorMensual(null);
      try {
        const res = await apiFetch(`/balances/mensual?mes=${mesSeleccionado}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const datos = await res.json();
        if (cancelado) return;
        setDatosMensual(datos);
      } catch (err) {
        if (cancelado) return;
        console.error('[seccionBalances] Error en cargarMensual:', err.message);
        setErrorMensual('No se pudo cargar el balance. Probá de nuevo.');
      } finally {
        if (!cancelado) setCargandoMensual(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [mesSeleccionado, intentoMensual]);

  // ── Carga del histórico anual ──────────────────────────────────────────────
  useEffect(() => {
    if (tabActivo !== 'historico') return;
    // Si ya hay datos y no es un reintento explícito, no recargamos.
    if (datosHistorico && intentoHistorico === 0) return;

    let cancelado = false;
    const cargar = async () => {
      setCargandoHistorico(true);
      setErrorHistorico(null);
      try {
        const res = await apiFetch('/balances/historico?cantidad=12');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const datos = await res.json();
        if (cancelado) return;
        setDatosHistorico(datos);
      } catch (err) {
        if (cancelado) return;
        console.error('[seccionBalances] Error en cargarHistorico:', err.message);
        setErrorHistorico('No se pudo cargar el histórico. Probá de nuevo.');
      } finally {
        if (!cancelado) setCargandoHistorico(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [tabActivo, intentoHistorico]);

  // ── Exportar Excel ─────────────────────────────────────────────────────────
  /**
   * exportarExcel — genera un xlsx con los datos del tab activo.
   * Tab mensual: hojas Ingresos y Egresos, más "Otros ingresos" y "Aportes y
   * retiros" si el mes los tiene. Tab histórico: 1 hoja.
   * Los montos van siempre con comisiones, sin importar el toggle.
   * @returns {Promise<void>} Descarga el archivo; si falla la carga de xlsx,
   *   deja el mensaje en `errorExport`.
   */
  const exportarExcel = async () => {
    // El chunk de xlsx se baja recién acá (lazy, #3). Si la descarga falla,
    // cargarChunk lo convierte en un error con mensaje al usuario en vez de
    // un unhandled rejection silencioso.
    let XLSX;
    try {
      XLSX = await cargarChunk(() => import('xlsx'), 'xlsx');
    } catch (err) {
      setErrorExport(err.message);
      return;
    }
    const wb = XLSX.utils.book_new();

    if (tabActivo === 'mensual' && datosMensual) {
      const filasBarberos = datosMensual.serviciosPorBarbero.map((b) => ({
        Barbero:           b.nombre,
        Cortes:            b.cortes,
        'Monto servicios': b.monto_servicios,
        'Comisión %':      b.comision_valor,
        'Monto comisión':  b.monto_comision,
        'Neto negocio':    b.neto_negocio,
      }));
      if (datosMensual.productos.total > 0) {
        filasBarberos.push({
          Barbero: 'Productos vendidos',
          Cortes: '—',
          'Monto servicios': datosMensual.productos.total,
          'Comisión %': '—',
          'Monto comisión': 0,
          'Neto negocio': datosMensual.productos.total,
        });
      }
      if (datosMensual.otrosIngresos.total > 0) {
        filasBarberos.push({
          Barbero: 'Otros ingresos',
          Cortes: '—',
          'Monto servicios': datosMensual.otrosIngresos.total,
          'Comisión %': '—',
          'Monto comisión': 0,
          'Neto negocio': datosMensual.otrosIngresos.total,
        });
      }
      filasBarberos.push({
        Barbero: 'TOTAL',
        Cortes: datosMensual.serviciosPorBarbero.reduce((a, b) => a + b.cortes, 0),
        'Monto servicios': datosMensual.resumen.ingresos_brutos,
        'Comisión %': '—',
        'Monto comisión': datosMensual.resumen.total_comisiones,
        'Neto negocio': datosMensual.resumen.ingresos_netos,
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasBarberos), 'Ingresos');

      const filasEgresos = datosMensual.gastos.porCategoria.map((g) => ({
        Categoría: g.categoria,
        Total:     g.total,
      }));
      filasEgresos.push({ Categoría: 'TOTAL EGRESOS', Total: datosMensual.resumen.egresos });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasEgresos), 'Egresos');

      if (datosMensual.otrosIngresos.detalle.length > 0) {
        const filasOtros = datosMensual.otrosIngresos.detalle.map((m) => ({
          Fecha:           m.fecha,
          Descripción:     m.descripcion,
          'Forma de pago': formatPago(m.forma_pago),
          Monto:           esSalida(m) ? -m.monto : m.monto,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasOtros), 'Otros ingresos');
      }

      const { capital, resumen } = datosMensual;
      if (capital.detalle.length > 0) {
        const filasCapital = capital.detalle.map((m) => ({
          Fecha:           m.fecha,
          Dueño:           m.socio_nombre,
          Tipo:            labelTipoMovimiento(m.tipo),
          Descripción:     m.descripcion ?? '',
          'Forma de pago': formatPago(m.forma_pago),
          Monto:           esSalida(m) ? -m.monto : m.monto,
        }));
        // Cierre: fila en blanco y la cuenta completa, con el rótulo en la
        // primera columna y el monto en "Monto" (mismo criterio que TOTAL EGRESOS).
        filasCapital.push(
          {},
          { Fecha: 'Ganancia del mes',    Monto: resumen.balance_neto },
          { Fecha: 'Aportes',             Monto: capital.aportes },
          { Fecha: 'Retiros',             Monto: -capital.retiros },
          {
            Fecha: 'Queda en el negocio',
            Monto: quedaEnElNegocio(resumen.balance_neto, capital.aportes, capital.retiros),
          },
        );
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasCapital), 'Aportes y retiros');
      }

      XLSX.writeFile(wb, `Balance_${mesSeleccionado}.xlsx`);
    }

    if (tabActivo === 'historico' && datosHistorico) {
      const filas = datosHistorico.map((f) => ({
        Mes:                f.label,
        'Ingresos brutos':  f.ingresos_brutos,
        'Otros ingresos':   f.otros_ingresos,
        Comisiones:         f.total_comisiones,
        'Ingresos netos':   f.ingresos_netos,
        Egresos:            f.egresos,
        Ganancia:           f.balance_neto,
        'Var. vs anterior': f.variacion_vs_anterior !== null ? `${f.variacion_vs_anterior}%` : '—',
        Aportes:            f.aportes,
        Retiros:            f.retiros,
        'Queda en el negocio': quedaEnElNegocio(f.balance_neto, f.aportes, f.retiros),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Histórico');
      XLSX.writeFile(wb, 'Balances_historico.xlsx');
    }
  };

  const puedeExportar =
    (tabActivo === 'mensual'   && datosMensual !== null) ||
    (tabActivo === 'historico' && datosHistorico !== null && datosHistorico.length > 0);

  // ─── Render ────────────────────────────────────────────────────────────────
  const contenedor = {
    padding: 24,
    fontFamily: theme.body,
    color: theme.ink,
  };

  return (
    <div style={contenedor}>

      <Tabs
        items={[
          { key: 'mensual',   label: 'Balance mensual' },
          { key: 'historico', label: 'Histórico anual' },
        ]}
        value={tabActivo}
        onChange={setTabActivo}
        style={{ marginBottom: 20 }}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — BALANCE MENSUAL
      ══════════════════════════════════════════════════════════════════════ */}
      {tabActivo === 'mensual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Controles: 3 slots con el selector centrado entre los dos extremos. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{ justifySelf: 'start' }}>
              <TogglePill
                activo={mostrarComisiones}
                onToggle={() => setMostrarComisiones((v) => !v)}
                labelOn="Con comisiones"
                labelOff="Sin comisiones"
              />
            </div>
            <SelectorMes value={mesSeleccionado} onChange={setMesSeleccionado} />
            <div style={{ justifySelf: 'end' }}>
              <BotonExportarExcel onClick={exportarExcel} disabled={!puedeExportar} />
            </div>
          </div>

          {errorExport && (
            <Toast tone="danger" dismissible onDismiss={() => setErrorExport(null)}>
              {errorExport}
            </Toast>
          )}

          {cargandoMensual && <LoadingState />}

          {errorMensual && !cargandoMensual && (
            <EmptyState
              tone="danger"
              glyph={<IconoAlerta />}
              title="No se pudo cargar"
              body={errorMensual}
              action={
                <Button
                  variant="secondary"
                  full={false}
                  onClick={() => setIntentoMensual(n => n + 1)}
                >
                  <RefreshCw size={16} strokeWidth={1.75} />
                  Reintentar
                </Button>
              }
            />
          )}

          {datosMensual && !cargandoMensual && !errorMensual && (
            <ContenidoMensual
              datos={datosMensual}
              mostrarComisiones={mostrarComisiones}
              mesSeleccionado={mesSeleccionado}
            />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — HISTÓRICO ANUAL
      ══════════════════════════════════════════════════════════════════════ */}
      {tabActivo === 'historico' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{ justifySelf: 'start' }}>
              <TogglePill
                activo={mostrarComisiones}
                onToggle={() => setMostrarComisiones((v) => !v)}
                labelOn="Con comisiones"
                labelOff="Sin comisiones"
              />
            </div>
            <span style={{
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.muted,
            }}>
              Últimos 12 meses
            </span>
            <div style={{ justifySelf: 'end' }}>
              <BotonExportarExcel onClick={exportarExcel} disabled={!puedeExportar} />
            </div>
          </div>

          {errorExport && (
            <Toast tone="danger" dismissible onDismiss={() => setErrorExport(null)}>
              {errorExport}
            </Toast>
          )}

          {cargandoHistorico && <LoadingState />}

          {errorHistorico && !cargandoHistorico && (
            <EmptyState
              tone="danger"
              glyph={<IconoAlerta />}
              title="No se pudo cargar"
              body={errorHistorico}
              action={
                <Button
                  variant="secondary"
                  full={false}
                  onClick={() => setIntentoHistorico(n => n + 1)}
                >
                  <RefreshCw size={16} strokeWidth={1.75} />
                  Reintentar
                </Button>
              }
            />
          )}

          {datosHistorico && !cargandoHistorico && !errorHistorico && (
            datosHistorico.length === 0 ? (
              <EmptyState
                glyph={<BarChart3 size={28} strokeWidth={1.75} color={theme.muted} />}
                title="Sin datos históricos"
                body="Todavía no hay meses cerrados para comparar."
              />
            ) : (
              <TablaHistorico
                filas={datosHistorico}
                mostrarComisiones={mostrarComisiones}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 1 — Contenido ────────────────────────────────────────────────────────

/**
 * ContenidoMensual
 * Render del tab "Balance mensual" cuando ya hay datos cargados.
 * Separado del root para evitar un árbol JSX gigante en el componente principal.
 * @param {object}  props.datos             - Respuesta de GET /balances/mensual.
 * @param {boolean} props.mostrarComisiones - Estado del toggle de comisiones.
 * @param {string}  props.mesSeleccionado   - Mes visto, 'YYYY-MM'.
 */
function ContenidoMensual({ datos, mostrarComisiones, mesSeleccionado }) {
  const ingresosKpi = mostrarComisiones
    ? datos.resumen.ingresos_netos
    : datos.resumen.ingresos_brutos;
  const balance = balanceSegunModo(datos.resumen, mostrarComisiones, true);
  const tieneCapital = datos.capital.detalle.length > 0;

  // Solo si no hay nada que mostrar: con barberos activos, un mes sin cortes
  // igual lista a todos en 0. Productos, otros ingresos y aportes/retiros
  // también cuentan: un mes que solo tiene uno de esos movimientos no puede
  // quedar oculto detrás del EmptyState.
  const sinMovimientos =
    datos.serviciosPorBarbero.length === 0 &&
    datos.productos.detalle.length === 0 &&
    datos.gastos.porCategoria.length === 0 &&
    datos.otrosIngresos.detalle.length === 0 &&
    !tieneCapital;

  if (sinMovimientos) {
    return (
      <EmptyState
        glyph={<Wallet size={28} strokeWidth={1.75} color={theme.muted} />}
        title={`Sin movimientos en ${mesALabel(mesSeleccionado)}`}
        body="Cuando se carguen cortes, ventas, gastos u otros movimientos vas a verlos acá."
      />
    );
  }

  return (
    <>
      {/* ── 3 KPI Cards ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
      }}>
        <KpiCard
          titulo="Ingresos del negocio"
          valor={ingresosKpi}
          color={theme.accent}
          subtitulo={mostrarComisiones ? 'Después de comisiones' : 'Bruto sin descontar comisiones'}
          icon={Banknote}
        />
        <KpiCard
          titulo="Egresos"
          valor={datos.resumen.egresos}
          color={theme.danger}
          subtitulo="Gastos del mes"
          icon={Receipt}
        />
        <KpiCard
          titulo="Ganancia del mes"
          valor={balance}
          color={balance >= 0 ? theme.accent : theme.danger}
          subtitulo="Ingresos − Egresos"
          icon={Wallet}
        />
      </div>

      {/* ── Tabla: ingresos por barbero ─────────────────────────────────── */}
      <BloqueTabla
        titulo="Ingresos por barbero"
        footer={datos.propinas.total > 0 ? (
          <NotaAlPie>
            Propinas generadas: <strong style={{ color: theme.ink, fontVariantNumeric: 'tabular-nums' }}>
              {fmtPesos(datos.propinas.total)}
            </strong> — van al barbero, no se incluyen en el balance.
          </NotaAlPie>
        ) : null}
      >
        <TablaPorBarbero datos={datos} mostrarComisiones={mostrarComisiones} />
      </BloqueTabla>

      {/* ── Tabla: egresos por categoría ────────────────────────────────── */}
      {datos.gastos.porCategoria.length > 0 && (
        <BloqueTabla titulo="Egresos por categoría">
          <TablaPorCategoria
            categorias={datos.gastos.porCategoria}
            totalEgresos={datos.resumen.egresos}
          />
        </BloqueTabla>
      )}

      {/* ── Tabla: aportes y retiros de los dueños ──────────────────────── */}
      {tieneCapital && (
        <BloqueTabla
          titulo="Aportes y retiros"
          footer={
            <NotaAlPie>
              Los aportes y retiros no son ingresos ni gastos del negocio: no
              cambian la ganancia del mes.
            </NotaAlPie>
          }
        >
          <TablaCapital capital={datos.capital} ganancia={balance} />
        </BloqueTabla>
      )}
    </>
  );
}

// ─── Tabla densa: ingresos por barbero ────────────────────────────────────────

/**
 * FilaIngresoSinComision
 * Fila de TablaPorBarbero para un ingreso que no paga comisión ("Productos
 * vendidos", "Otros ingresos"): "—" en Cortes, Comisión % y Monto comisión, y
 * el monto entero en Neto negocio.
 * @param {string}  props.label             - Texto de la primera columna.
 * @param {number}  props.monto             - Total del ingreso en el mes.
 * @param {boolean} props.mostrarComisiones - Si se muestran las columnas de comisión.
 */
function FilaIngresoSinComision({ label, monto, mostrarComisiones }) {
  return (
    <tr className="om-fila-hover">
      <td style={{ ...tdStyle, color: theme.muted }}>{label}</td>
      <td style={{ ...tdStyle, textAlign: 'right', color: theme.mutedSoft }}>—</td>
      <td style={{
        ...tdStyle,
        textAlign: 'right',
        color: theme.accent,
        fontWeight: theme.weightHeading,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {fmtPesos(monto)}
      </td>
      {mostrarComisiones && (
        <>
          <td style={{ ...tdStyle, textAlign: 'right', color: theme.mutedSoft }}>—</td>
          <td style={{ ...tdStyle, textAlign: 'right', color: theme.mutedSoft }}>—</td>
          <td style={{
            ...tdStyle,
            textAlign: 'right',
            fontWeight: theme.weightHeading,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtPesos(monto)}
          </td>
        </>
      )}
    </tr>
  );
}

/**
 * TablaPorBarbero
 * Filas por barbero + filas opcionales "Productos vendidos" y "Otros ingresos"
 * + fila TOTAL (sale de `resumen`, que ya incluye productos y otros ingresos).
 * Las columnas de comisión solo se renderizan cuando mostrarComisiones=true.
 * @param {object}  props.datos             - Respuesta de GET /balances/mensual.
 * @param {boolean} props.mostrarComisiones - Estado del toggle de comisiones.
 */
function TablaPorBarbero({ datos, mostrarComisiones }) {
  const totalCortes = datos.serviciosPorBarbero.reduce((a, b) => a + b.cortes, 0);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thStyle}>Barbero</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Cortes</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Monto</th>
          {mostrarComisiones && (
            <>
              <th style={{ ...thStyle, textAlign: 'right' }}>Comisión %</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Monto comisión</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Neto negocio</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {datos.serviciosPorBarbero.map((b) => (
          <tr key={b.barbero_id} className="om-fila-hover">
            <td style={tdStyle}>{b.nombre}</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {b.cortes}
            </td>
            <td style={{
              ...tdStyle,
              textAlign: 'right',
              color: theme.accent,
              fontWeight: theme.weightHeading,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtPesos(b.monto_servicios)}
            </td>
            {mostrarComisiones && (
              <>
                <td style={{
                  ...tdStyle,
                  textAlign: 'right',
                  color: theme.muted,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {b.comision_valor}%
                </td>
                <td style={{
                  ...tdStyle,
                  textAlign: 'right',
                  color: theme.danger,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtPesos(b.monto_comision)}
                </td>
                <td style={{
                  ...tdStyle,
                  textAlign: 'right',
                  fontWeight: theme.weightHeading,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtPesos(b.neto_negocio)}
                </td>
              </>
            )}
          </tr>
        ))}

        {/* Filas sin comisión — solo cuando hay monto. */}
        {datos.productos.total > 0 && (
          <FilaIngresoSinComision
            label="Productos vendidos"
            monto={datos.productos.total}
            mostrarComisiones={mostrarComisiones}
          />
        )}
        {datos.otrosIngresos.total > 0 && (
          <FilaIngresoSinComision
            label="Otros ingresos"
            monto={datos.otrosIngresos.total}
            mostrarComisiones={mostrarComisiones}
          />
        )}

        {/* Fila TOTAL */}
        <tr>
          <td style={tdTotalStyle}>Total</td>
          <td style={{ ...tdTotalStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {totalCortes}
          </td>
          <td style={{
            ...tdTotalStyle,
            textAlign: 'right',
            color: theme.accent,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtPesos(datos.resumen.ingresos_brutos)}
          </td>
          {mostrarComisiones && (
            <>
              <td style={tdTotalStyle} />
              <td style={{
                ...tdTotalStyle,
                textAlign: 'right',
                color: theme.danger,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtPesos(datos.resumen.total_comisiones)}
              </td>
              <td style={{
                ...tdTotalStyle,
                textAlign: 'right',
                color: theme.accent,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtPesos(datos.resumen.ingresos_netos)}
              </td>
            </>
          )}
        </tr>
      </tbody>
    </table>
  );
}

// ─── Tabla densa: egresos por categoría ───────────────────────────────────────

/**
 * TablaPorCategoria
 * Egresos del mes agrupados por categoría de gasto + fila "Total egresos".
 * @param {Array<{categoria: string, total: number}>} props.categorias - `gastos.porCategoria`.
 * @param {number} props.totalEgresos - `resumen.egresos`.
 */
function TablaPorCategoria({ categorias, totalEgresos }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thStyle}>Categoría</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {categorias.map((g) => (
          <tr key={g.categoria} className="om-fila-hover">
            <td style={tdStyle}>{g.categoria}</td>
            <td style={{
              ...tdStyle,
              textAlign: 'right',
              color: theme.danger,
              fontWeight: theme.weightHeading,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtPesos(g.total)}
            </td>
          </tr>
        ))}
        <tr>
          <td style={tdTotalStyle}>Total egresos</td>
          <td style={{
            ...tdTotalStyle,
            textAlign: 'right',
            color: theme.danger,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtPesos(totalEgresos)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ─── Tabla densa: aportes y retiros ───────────────────────────────────────────

/**
 * celdaMontoCapital
 * Contenido y color de una celda de aportes o retiros por dueño: un cero se
 * muestra como "—" en gris; si no, el monto en el color del tipo.
 * @param {number} monto - Total del dueño en esa columna.
 * @param {string} color - Color del monto cuando no es cero (token de theme).
 * @returns {{texto: string, color: string}}
 */
function celdaMontoCapital(monto, color) {
  return monto === 0
    ? { texto: '—', color: theme.mutedSoft }
    : { texto: fmtPesos(monto), color };
}

/**
 * TablaCapital
 * Aportes y retiros del mes, una fila por dueño, y el cierre con la cuenta
 * completa: Ganancia del mes + Aportes − Retiros = Queda en el negocio.
 * Aportes en ink, retiros en danger; "Queda en el negocio" es la fila total
 * (línea accent), en accent si es positivo y en danger si es negativo.
 * @param {object} props.capital  - `capital` de GET /balances/mensual
 *   ({ aportes, retiros, porSocio }).
 * @param {number} props.ganancia - Ganancia del mes según el toggle de comisiones.
 */
function TablaCapital({ capital, ganancia }) {
  const queda = quedaEnElNegocio(ganancia, capital.aportes, capital.retiros);

  // Renglones intermedios del cierre: rótulo en muted, monto a la derecha.
  const renglonesCierre = [
    { label: 'Ganancia del mes', monto: ganancia,         color: ganancia >= 0 ? theme.ink : theme.danger },
    { label: '+ Aportes',        monto: capital.aportes,  color: theme.ink },
    { label: '− Retiros',        monto: capital.retiros,  color: theme.danger },
  ];

  const montoStyle = {
    ...tdStyle,
    textAlign: 'right',
    fontWeight: theme.weightHeading,
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thStyle}>Dueño</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Aportes</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Retiros</th>
        </tr>
      </thead>
      <tbody>
        {capital.porSocio.map((s) => {
          const aportes = celdaMontoCapital(s.aportes, theme.ink);
          const retiros = celdaMontoCapital(s.retiros, theme.danger);
          return (
            <tr key={s.socio_id} className="om-fila-hover">
              <td style={tdStyle}>{s.nombre}</td>
              <td style={{ ...montoStyle, color: aportes.color }}>{aportes.texto}</td>
              <td style={{ ...montoStyle, color: retiros.color }}>{retiros.texto}</td>
            </tr>
          );
        })}

        {renglonesCierre.map((r, idx) => (
          <tr key={r.label}>
            <td
              colSpan={2}
              style={{
                ...tdStyle,
                color: theme.muted,
                // Separa el cierre de las filas por dueño.
                ...(idx === 0 && { borderTop: `1px solid ${theme.hairline}` }),
              }}
            >
              {r.label}
            </td>
            <td style={{
              ...montoStyle,
              color: r.color,
              ...(idx === 0 && { borderTop: `1px solid ${theme.hairline}` }),
            }}>
              {fmtPesos(r.monto)}
            </td>
          </tr>
        ))}

        <tr>
          <td colSpan={2} style={tdTotalStyle}>Queda en el negocio</td>
          <td style={{
            ...tdTotalStyle,
            textAlign: 'right',
            color: queda >= 0 ? theme.accent : theme.danger,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtPesos(queda)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ─── Tabla densa: histórico anual ─────────────────────────────────────────────

/**
 * TablaHistorico
 * 12 filas (una por mes). La fila del mes actual se destaca con bg accentSoft
 * + pill "Actual" (mismo patrón visual que pill "HOY" de Planillas).
 * Aportes y retiros no tienen columna en pantalla: solo van al Excel.
 * @param {Array<object>} props.filas             - Respuesta de GET /balances/historico.
 * @param {boolean}       props.mostrarComisiones - Estado del toggle de comisiones.
 */
function TablaHistorico({ filas, mostrarComisiones }) {
  const mesActual = getMesActual();

  return (
    <BloqueTabla>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Mes</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Ingresos brutos</th>
            {mostrarComisiones && (
              <>
                <th style={{ ...thStyle, textAlign: 'right' }}>Comisiones</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Ingresos netos</th>
              </>
            )}
            <th style={{ ...thStyle, textAlign: 'right' }}>Egresos</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Ganancia</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>vs anterior</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const balance = balanceSegunModo(fila, mostrarComisiones);
            const esActual = fila.mes === mesActual;

            return (
              <tr
                key={fila.mes}
                className="om-fila-hover"
                style={esActual ? { background: theme.accentSoft } : undefined}
              >
                <td style={{
                  ...tdStyle,
                  fontWeight: esActual ? theme.weightHeading : theme.weightRegular,
                }}>
                  {fila.label}
                  {esActual && (
                    <span style={{
                      marginLeft: 8,
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: theme.accent,
                      color: theme.accentInk,
                      fontFamily: theme.mono,
                      fontSize: theme.sizeMicro,
                      fontWeight: theme.weightHeading,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      verticalAlign: 'middle',
                    }}>
                      Actual
                    </span>
                  )}
                </td>
                <td style={{
                  ...tdStyle,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtPesos(fila.ingresos_brutos)}
                </td>
                {mostrarComisiones && (
                  <>
                    <td style={{
                      ...tdStyle,
                      textAlign: 'right',
                      color: theme.danger,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {fmtPesos(fila.total_comisiones)}
                    </td>
                    <td style={{
                      ...tdStyle,
                      textAlign: 'right',
                      color: theme.accent,
                      fontWeight: theme.weightHeading,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {fmtPesos(fila.ingresos_netos)}
                    </td>
                  </>
                )}
                <td style={{
                  ...tdStyle,
                  textAlign: 'right',
                  color: theme.danger,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtPesos(fila.egresos)}
                </td>
                <td style={{
                  ...tdStyle,
                  textAlign: 'right',
                  color: balance >= 0 ? theme.accent : theme.danger,
                  fontWeight: theme.weightHeading,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtPesos(balance)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <BadgeVariacion
                    pct={fila.variacion_vs_anterior}
                    sinDatosLabel="—"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </BloqueTabla>
  );
}
