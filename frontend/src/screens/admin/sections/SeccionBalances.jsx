// /frontend/src/screens/admin/sections/SeccionBalances.jsx

// Sección Balances del panel de administrador.
// Tab 1 — Balance mensual: cards resumen + desglose por barbero + gastos por categoría.
// Tab 2 — Histórico anual: tabla de los últimos 12 meses con variación vs mes anterior.
// Toggle de comisiones: muestra/oculta columnas de comisión y ajusta los totales.

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../../../services/api';
import SelectorMes from '../../../components/SelectorMes';
import BotonExportarExcel from '../../../components/BotonExportarExcel';
import TogglePill from '../../../components/TogglePill';
import { getMesActual, mesALabel } from '../../../utils/fechas';
import { formatARS } from '../../../utils/formatos';

// ─── Subcomponentes ───────────────────────────────────────────────────────────

/** Card de KPI grande con título, valor y color de acento */
const KpiCard = ({ titulo, valor, color, subtitulo }) => (
  <div style={styles.kpiCard}>
    <span style={styles.kpiTitulo}>{titulo}</span>
    <span style={{ ...styles.kpiValor, color }}>{formatARS(valor)}</span>
    {subtitulo && <span style={styles.kpiSubtitulo}>{subtitulo}</span>}
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SeccionBalances() {
  const [tabActivo, setTabActivo]             = useState('mensual');
  const [mesSeleccionado, setMesSeleccionado] = useState(getMesActual());
  const [mostrarComisiones, setMostrarComisiones] = useState(true);

  // Estado Tab 1
  const [datosMensual, setDatosMensual]       = useState(null);
  const [cargandoMensual, setCargandoMensual] = useState(false);
  const [errorMensual, setErrorMensual]       = useState(null);

  // Estado Tab 2
  const [datosHistorico, setDatosHistorico]       = useState(null);
  const [cargandoHistorico, setCargandoHistorico] = useState(false);
  const [errorHistorico, setErrorHistorico]       = useState(null);

  // ── Carga de datos ────────────────────────────────────────────────────────

  /** Carga el balance del mes seleccionado */
  const cargarMensual = async (mes) => {
    setCargandoMensual(true);
    setErrorMensual(null);
    try {
      const res = await apiFetch(`/balances/mensual?mes=${mes}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const datos = await res.json();
      setDatosMensual(datos);
    } catch (err) {
      console.error('[seccionBalances] Error en cargarMensual:', err.message);
      setErrorMensual('No se pudo cargar el balance. Intentá de nuevo.');
    } finally {
      setCargandoMensual(false);
    }
  };

  /** Carga el histórico anual (solo la primera vez que se abre el tab) */
  const cargarHistorico = async () => {
    if (datosHistorico) return; // Ya cargado
    setCargandoHistorico(true);
    setErrorHistorico(null);
    try {
      const res = await apiFetch('/balances/historico?cantidad=12');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const datos = await res.json();
      setDatosHistorico(datos);
    } catch (err) {
      console.error('[seccionBalances] Error en cargarHistorico:', err.message);
      setErrorHistorico('No se pudo cargar el histórico. Intentá de nuevo.');
    } finally {
      setCargandoHistorico(false);
    }
  };

  // Cargar mensual al montar y cuando cambia el mes
  useEffect(() => {
    cargarMensual(mesSeleccionado);
  }, [mesSeleccionado]);

  // Cargar histórico cuando el usuario cambia al tab
  useEffect(() => {
    if (tabActivo === 'historico') cargarHistorico();
  }, [tabActivo]);

  // ── Navegación de mes ─────────────────────────────────────────────────────
  const esMesActual = mesSeleccionado >= getMesActual();

  // ── Exportar Excel ────────────────────────────────────────────────────────
  /**
   * exportarExcel — exporta los datos del tab activo.
   * Tab mensual: hoja "Ingresos" + hoja "Egresos".
   * Tab histórico: hoja "Histórico" con los últimos 12 meses.
   */
  const exportarExcel = () => {
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

      XLSX.writeFile(wb, `Balance_${mesSeleccionado}.xlsx`);
    }

    if (tabActivo === 'historico' && datosHistorico) {
      const filas = datosHistorico.map((f) => ({
        Mes:                f.label,
        'Ingresos brutos':  f.ingresos_brutos,
        Comisiones:         f.total_comisiones,
        'Ingresos netos':   f.ingresos_netos,
        Egresos:            f.egresos,
        'Balance neto':     f.balance_neto,
        'Var. vs anterior': f.variacion_vs_anterior !== null ? `${f.variacion_vs_anterior}%` : '—',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Histórico');
      XLSX.writeFile(wb, 'Balances_historico.xlsx');
    }
  };

  // Determina si hay datos para habilitar el botón exportar
  const puedeExportar =
    (tabActivo === 'mensual'   && datosMensual !== null) ||
    (tabActivo === 'historico' && datosHistorico !== null && datosHistorico.length > 0);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={styles.contenedor}>

      {/* ── Encabezado ────────────────────────────────────────────────────── */}
      <div style={styles.encabezado}>
        <div>
          <h2 style={styles.titulo}>Balances</h2>
          <p style={styles.subtitulo}>Visualización mensual de la economía del negocio</p>
        </div>
        <div style={styles.tabsContainer}>
          {[
            { key: 'mensual',   label: 'Balance mensual' },
            { key: 'historico', label: 'Histórico anual' },
          ].map((tab) => (
            <button
              key={tab.key}
              onPointerDown={() => setTabActivo(tab.key)}
              style={{
                ...styles.tabBtn,
                ...(tabActivo === tab.key ? styles.tabBtnActivo : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — BALANCE MENSUAL
      ══════════════════════════════════════════════════════════════════════ */}
      {tabActivo === 'mensual' && (
        <div style={styles.tabContenido}>

          {/* Controles: toggle comisiones | selector de mes | exportar Excel */}
          <div style={styles.controlesRow}>
            <div>
              <TogglePill
                activo={mostrarComisiones}
                onToggle={() => setMostrarComisiones((v) => !v)}
                labelOn="Con comisiones"
                labelOff="Sin comisiones"
              />
            </div>

            <div style={styles.selectorMesWrapper}>
              <SelectorMes value={mesSeleccionado} onChange={setMesSeleccionado} />
            </div>

            <div style={{ justifySelf: 'end' }}>
              <BotonExportarExcel onClick={exportarExcel} disabled={!puedeExportar} />
            </div>
          </div>

          {cargandoMensual && <p style={styles.estadoTexto}>Cargando...</p>}
          {errorMensual    && <p style={styles.errorTexto}>{errorMensual}</p>}

          {datosMensual && !cargandoMensual && (
            <>
              {/* ── Cards KPI ──────────────────────────────────────────── */}
              <div style={styles.kpiGrid}>
                <KpiCard
                  titulo="Ingresos del negocio"
                  valor={mostrarComisiones
                    ? datosMensual.resumen.ingresos_netos
                    : datosMensual.resumen.ingresos_brutos}
                  color="#1a7a4a"
                  subtitulo={mostrarComisiones ? 'Después de comisiones' : 'Bruto sin descontar comisiones'}
                />
                <KpiCard
                  titulo="Egresos"
                  valor={datosMensual.resumen.egresos}
                  color="#c0392b"
                  subtitulo="Gastos del mes"
                />
                <KpiCard
                  titulo="Balance neto"
                  valor={mostrarComisiones
                    ? datosMensual.resumen.balance_neto
                    : datosMensual.resumen.ingresos_brutos - datosMensual.resumen.egresos}
                  color={
                    (mostrarComisiones
                      ? datosMensual.resumen.balance_neto
                      : datosMensual.resumen.ingresos_brutos - datosMensual.resumen.egresos) >= 0
                      ? '#1a7a4a' : '#c0392b'
                  }
                  subtitulo="Ingresos − Egresos"
                />
              </div>

              {/* ── Desglose por barbero ────────────────────────────────── */}
              <div style={styles.bloque}>
                <h3 style={styles.bloqueTitulo}>Ingresos por barbero</h3>
                <table style={styles.tabla}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Barbero</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Cortes</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Monto</th>
                      {mostrarComisiones && <>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Comisión %</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Monto comisión</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Neto negocio</th>
                      </>}
                    </tr>
                  </thead>
                  <tbody>
                    {datosMensual.serviciosPorBarbero.map((b) => (
                      <tr key={b.barbero_id} style={styles.trHover}>
                        <td style={styles.td}>{b.nombre}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{b.cortes}</td>
                        <td style={{ ...styles.td, textAlign: 'right', color: '#1a7a4a', fontWeight: 600 }}>
                          {formatARS(b.monto_servicios)}
                        </td>
                        {mostrarComisiones && <>
                          <td style={{ ...styles.td, textAlign: 'right' }}>{b.comision_valor}%</td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#c0392b' }}>
                            {formatARS(b.monto_comision)}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>
                            {formatARS(b.neto_negocio)}
                          </td>
                        </>}
                      </tr>
                    ))}

                    {/* Fila de productos */}
                    {datosMensual.productos.total > 0 && (
                      <tr style={{ ...styles.trHover, backgroundColor: '#f9f9f9' }}>
                        <td style={{ ...styles.td, color: '#555', fontStyle: 'italic' }}>Productos vendidos</td>
                        <td style={{ ...styles.td, textAlign: 'right', color: '#888' }}>—</td>
                        <td style={{ ...styles.td, textAlign: 'right', color: '#1a7a4a', fontWeight: 600 }}>
                          {formatARS(datosMensual.productos.total)}
                        </td>
                        {mostrarComisiones && <>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#888' }}>—</td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#888' }}>—</td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>
                            {formatARS(datosMensual.productos.total)}
                          </td>
                        </>}
                      </tr>
                    )}

                    {/* Fila total */}
                    <tr style={styles.trTotal}>
                      <td style={styles.tdTotal}>Total</td>
                      <td style={{ ...styles.tdTotal, textAlign: 'right' }}>
                        {datosMensual.serviciosPorBarbero.reduce((a, b) => a + b.cortes, 0)}
                      </td>
                      <td style={{ ...styles.tdTotal, textAlign: 'right', color: '#1a7a4a' }}>
                        {formatARS(datosMensual.resumen.ingresos_brutos)}
                      </td>
                      {mostrarComisiones && <>
                        <td style={styles.tdTotal} />
                        <td style={{ ...styles.tdTotal, textAlign: 'right', color: '#c0392b' }}>
                          {formatARS(datosMensual.resumen.total_comisiones)}
                        </td>
                        <td style={{ ...styles.tdTotal, textAlign: 'right', color: '#1a7a4a' }}>
                          {formatARS(datosMensual.resumen.ingresos_netos)}
                        </td>
                      </>}
                    </tr>
                  </tbody>
                </table>

                {/* Nota propinas */}
                {datosMensual.propinas.total > 0 && (
                  <p style={styles.notaPropinas}>
                    💡 Propinas generadas en el período: <strong>{formatARS(datosMensual.propinas.total)}</strong> — van al barbero, no incluidas en el balance.
                  </p>
                )}
              </div>

              {/* ── Desglose de egresos ─────────────────────────────────── */}
              {datosMensual.gastos.porCategoria.length > 0 && (
                <div style={styles.bloque}>
                  <h3 style={styles.bloqueTitulo}>Egresos por categoría</h3>
                  <table style={styles.tabla}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Categoría</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosMensual.gastos.porCategoria.map((g) => (
                        <tr key={g.categoria} style={styles.trHover}>
                          <td style={styles.td}>{g.categoria}</td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#c0392b', fontWeight: 600 }}>
                            {formatARS(g.total)}
                          </td>
                        </tr>
                      ))}
                      <tr style={styles.trTotal}>
                        <td style={styles.tdTotal}>Total egresos</td>
                        <td style={{ ...styles.tdTotal, textAlign: 'right', color: '#c0392b' }}>
                          {formatARS(datosMensual.resumen.egresos)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {datosMensual.serviciosPorBarbero.length === 0 &&
               datosMensual.gastos.porCategoria.length === 0 && (
                <p style={styles.estadoTexto}>Sin movimientos en {labelMes(mesSeleccionado)}.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — HISTÓRICO ANUAL
      ══════════════════════════════════════════════════════════════════════ */}
      {tabActivo === 'historico' && (
        <div style={styles.tabContenido}>

          <div style={styles.controlesRow}>
            <div>
              <TogglePill
                activo={mostrarComisiones}
                onToggle={() => setMostrarComisiones((v) => !v)}
                labelOn="Con comisiones"
                labelOff="Sin comisiones"
              />
            </div>

            <span style={styles.labelSecundario}>Últimos 12 meses</span>

            <div style={{ justifySelf: 'end' }}>
              <BotonExportarExcel onClick={exportarExcel} disabled={!puedeExportar} />
            </div>
          </div>

          {cargandoHistorico && <p style={styles.estadoTexto}>Cargando...</p>}
          {errorHistorico    && <p style={styles.errorTexto}>{errorHistorico}</p>}

          {datosHistorico && !cargandoHistorico && (
            <div style={styles.bloque}>
              <table style={styles.tabla}>
                <thead>
                  <tr>
                    <th style={styles.th}>Mes</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Ingresos brutos</th>
                    {mostrarComisiones && <>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Comisiones</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Ingresos netos</th>
                    </>}
                    <th style={{ ...styles.th, textAlign: 'right' }}>Egresos</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Balance</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>vs anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {datosHistorico.map((fila) => {
                    const balance = mostrarComisiones
                      ? fila.balance_neto
                      : fila.ingresos_brutos - fila.egresos;
                    const esMesActualFila = fila.mes === getMesActual();

                    return (
                      <tr key={fila.mes} style={{
                        ...styles.trHover,
                        ...(esMesActualFila ? styles.trMesActual : {}),
                      }}>
                        <td style={{ ...styles.td, fontWeight: esMesActualFila ? 700 : 400 }}>
                          {fila.label}
                          {esMesActualFila && (
                            <span style={styles.badgeMesActual}>Actual</span>
                          )}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          {formatARS(fila.ingresos_brutos)}
                        </td>
                        {mostrarComisiones && <>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#c0392b' }}>
                            {formatARS(fila.total_comisiones)}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#1a7a4a', fontWeight: 600 }}>
                            {formatARS(fila.ingresos_netos)}
                          </td>
                        </>}
                        <td style={{ ...styles.td, textAlign: 'right', color: '#c0392b' }}>
                          {formatARS(fila.egresos)}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700,
                          color: balance >= 0 ? '#1a7a4a' : '#c0392b' }}>
                          {formatARS(balance)}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          {fila.variacion_vs_anterior !== null ? (
                            <span style={{
                              ...styles.badgeVariacion,
                              backgroundColor: fila.variacion_vs_anterior >= 0 ? '#e8f5e9' : '#fdecea',
                              color: fila.variacion_vs_anterior >= 0 ? '#2e7d32' : '#c0392b',
                            }}>
                              {fila.variacion_vs_anterior >= 0 ? '▲' : '▼'} {Math.abs(fila.variacion_vs_anterior)}%
                            </span>
                          ) : (
                            <span style={{ color: '#ccc' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {datosHistorico.length === 0 && (
                <p style={styles.estadoTexto}>Sin datos históricos todavía.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  contenedor: {
    padding: '36px 40px',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    color: '#111111',
  },
  encabezado: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  titulo: {
    fontSize: '24px', fontWeight: '700', color: '#111', margin: '0 0 4px',
  },
  subtitulo: {
    fontSize: '14px', color: '#888', margin: 0,
  },
  tabsContainer: {
    display: 'flex',
    gap: '8px',
    backgroundColor: '#f5f5f5',
    borderRadius: '12px',
    padding: '4px',
  },
  tabBtn: {
    padding: '8px 20px',
    borderRadius: '9px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#888888',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
    transition: 'all 0.15s',
  },
  tabBtnActivo: {
    backgroundColor: '#ffffff',
    color: '#111111',
    fontWeight: '600',
    boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
  },
  tabContenido: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  controlesRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: '16px',
  },
  selectorMesWrapper: {
    display: 'flex',
    justifyContent: 'center',
  },
  labelSecundario: {
    fontSize: '14px',
    color: '#888',
    fontWeight: '500',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  kpiCard: {
    backgroundColor: '#fafafa',
    border: '1.5px solid #eeeeee',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  kpiTitulo: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  kpiValor: {
    fontSize: '28px',
    fontWeight: '700',
    letterSpacing: '-0.02em',
  },
  kpiSubtitulo: {
    fontSize: '12px',
    color: '#aaaaaa',
  },
  bloque: {
    backgroundColor: '#ffffff',
    border: '1.5px solid #eeeeee',
    borderRadius: '16px',
    overflow: 'hidden',
  },
  bloqueTitulo: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: 0,
    padding: '16px 20px',
    borderBottom: '1px solid #f0f0f0',
    backgroundColor: '#fafafa',
  },
  tabla: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 20px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textAlign: 'left',
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '14px 20px',
    fontSize: '14px',
    color: '#333333',
    borderBottom: '1px solid #f7f7f7',
  },
  trHover: {
    transition: 'background 0.1s',
  },
  trTotal: {
    backgroundColor: '#f7f7f7',
    borderTop: '2px solid #eeeeee',
  },
  tdTotal: {
    padding: '14px 20px',
    fontSize: '14px',
    fontWeight: '700',
    color: '#111111',
  },
  trMesActual: {
    backgroundColor: '#f0faf5',
  },
  badgeMesActual: {
    marginLeft: '8px',
    fontSize: '10px',
    fontWeight: '700',
    backgroundColor: '#1a7a4a',
    color: '#ffffff',
    padding: '2px 7px',
    borderRadius: '8px',
    verticalAlign: 'middle',
  },
  badgeVariacion: {
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: '700',
  },
  notaPropinas: {
    fontSize: '13px',
    color: '#888888',
    margin: '0',
    padding: '12px 20px',
    borderTop: '1px solid #f0f0f0',
    backgroundColor: '#fafafa',
  },
  estadoTexto: {
    textAlign: 'center',
    color: '#999999',
    fontSize: '15px',
    padding: '40px 0',
  },
  errorTexto: {
    textAlign: 'center',
    color: '#c0392b',
    fontSize: '14px',
    padding: '20px 0',
  },
};
