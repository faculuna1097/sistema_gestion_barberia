// /frontend/src/screens/admin/sections/SeccionPlanillas.jsx

// Sección de planillas semanales del panel de administrador.
//
// Layout:
//   Fila 1 — título | tabs Detalle/Resumen
//   Fila 2 — toggle comisiones | selector de semana | exportar Excel
//   Fila 3 — pills de barberos (solo en tab Detalle)
//
// Tab Detalle: una tabla por día del barbero seleccionado.
//   Con comisiones ON: agrega columna "Comisión" en la fila de subtotal de cada día.
//   La comisión se calcula sobre monto_servicios del día (nunca sobre propinas).
//
// Tab Resumen: tabla consolidada por barbero.
//   Con comisiones ON: muestra columna "Comisión" con porcentaje aplicado.
//
// No recibe props de datos — carga sus propios datos con useEffect.

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from '../../../services/api';
import SelectorSemana from '../../../components/SelectorSemana';
import BotonExportarExcel from '../../../components/BotonExportarExcel';
import TogglePill from '../../../components/TogglePill';
import { getFechaHoy, formatFechaCorta, getSemanaActual, semanaAFechaLunes } from '../../../utils/fechas';
import { formatARS, formatPago } from '../../../utils/formatos';

// ─── Helpers de semana ────────────────────────────────────────────────────────


/**
 * Agrupa un array de cortes por fecha.
 * @returns {Array} [{ fecha, cortes[] }] ordenado cronológicamente
 */
function agruparPorDia(cortes) {
  const mapa = new Map();
  for (const c of cortes) {
    if (!mapa.has(c.fecha)) mapa.set(c.fecha, []);
    mapa.get(c.fecha).push(c);
  }
  return Array.from(mapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, cortes]) => ({ fecha, cortes }));
}

/**
 * Calcula la comisión sobre el monto de servicios de un día.
 * @param {number} montoServicios - Suma de precios de servicios del día
 * @param {string} tipo           - "porcentaje" | "fijo"
 * @param {number} valor          - Valor de comisión del barbero
 * @param {number} cantidadCortes - Cantidad de cortes del día (para tipo fijo)
 * @returns {number}
 */
function calcularComisionDia(montoServicios, tipo, valor, cantidadCortes) {
  if (tipo === "porcentaje") return montoServicios * valor / 100;
  return valor * cantidadCortes; // fijo por corte
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SeccionPlanillas() {
  const [semana, setSemana]               = useState(getSemanaActual);
  const [tabActiva, setTabActiva]         = useState("detalle");
  const [detalleData, setDetalleData]     = useState([]);
  const [resumenData, setResumenData]     = useState(null);
  const [barberoActivo, setBarberoActivo] = useState(null);
  const [mostrarComisiones, setMostrarComisiones] = useState(true);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  // Set de fechas (YYYY-MM-DD) actualmente expandidas en el tab Detalle.
  // Por defecto solo el día de hoy arranca expandido; el resto contraído.
  const [diasExpandidos, setDiasExpandidos] = useState(new Set());

  // ── Carga de datos ────────────────────────────────────────────────────────
  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);
      setError(null);
      try {
        const fechaLunes = semanaAFechaLunes(semana);
        const [resDetalle, resResumen] = await Promise.all([
          apiFetch(`/admin/planilla?semana=${fechaLunes}`),
          apiFetch(`/admin/planilla/resumen?semana=${fechaLunes}`),
        ]);
        if (!resDetalle.ok || !resResumen.ok) throw new Error("Error en la respuesta del servidor");
        const [detalle, resumen] = await Promise.all([
          resDetalle.json(),
          resResumen.json(),
        ]);
        setDetalleData(detalle);
        setResumenData(resumen);
        if (detalle.length > 0) setBarberoActivo(detalle[0].barbero_id);
        // Solo el día de hoy arranca expandido al cargar la semana.
        setDiasExpandidos(new Set([getFechaHoy()]));
      } catch (err) {
        console.error("[seccionPlanillas] Error en cargarDatos:", err.message);
        setError("No se pudieron cargar los datos. Revisá la conexión.");
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, [semana]);

  // ── Exportación Excel — Detalle ───────────────────────────────────────────
  const exportarDetalle = () => {
    if (!detalleData.length) return;
    const filas = [];
    detalleData.forEach((barbero) => {
      const infoComision = resumenData?.barberos.find((b) => b.barbero_id === barbero.barbero_id);
      filas.push({
        Barbero: `── ${barbero.barbero_nombre} ──`,
        Fecha: "", Hora: "", Servicio: "", "Monto ($)": "", "Propina ($)": "", "Total ($)": "",
        ...(mostrarComisiones ? { "Comisión ($)": "" } : {}),
        "Forma de pago": "",
      });
      agruparPorDia(barbero.cortes).forEach(({ fecha, cortes: cd }) => {
        cd.forEach((c) => {
          filas.push({
            Barbero: "", Fecha: formatFechaCorta(c.fecha), Hora: c.hora, Servicio: c.servicio_nombre,
            "Monto ($)": c.monto_servicios, "Propina ($)": c.propina,
            "Total ($)": c.monto_servicios + c.propina,
            ...(mostrarComisiones ? { "Comisión ($)": "" } : {}),
            "Forma de pago": formatPago(c.forma_pago),
          });
        });
        if (mostrarComisiones && infoComision) {
          const montoDelDia = cd.reduce((s, c) => s + c.monto_servicios, 0);
          const comisionDelDia = calcularComisionDia(montoDelDia, infoComision.comision_tipo, infoComision.comision_valor, cd.length);
          filas.push({
            Barbero: `Subtotal (${cd.length} cortes)`, Fecha: "", Hora: "", Servicio: "",
            "Monto ($)": montoDelDia,
            "Propina ($)": cd.reduce((s, c) => s + c.propina, 0),
            "Total ($)": montoDelDia + cd.reduce((s, c) => s + c.propina, 0),
            "Comisión ($)": comisionDelDia, "Forma de pago": "",
          });
        }
      });
      const totalMonto   = barbero.cortes.reduce((s, c) => s + c.monto_servicios, 0);
      const totalPropina = barbero.cortes.reduce((s, c) => s + c.propina, 0);
      filas.push({
        Barbero: `Subtotal semana (${barbero.cortes.length} cortes)`, Fecha: "", Hora: "", Servicio: "",
        "Monto ($)": totalMonto, "Propina ($)": totalPropina, "Total ($)": totalMonto + totalPropina,
        ...(mostrarComisiones && infoComision ? { "Comisión ($)": infoComision.comision } : {}),
        "Forma de pago": "",
      });
      filas.push({ Barbero: "", Fecha: "", Hora: "", Servicio: "", "Monto ($)": "", "Propina ($)": "", "Total ($)": "", "Forma de pago": "" });
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), "Detalle semanal");
    XLSX.writeFile(wb, `detalle-semanal-${semana}.xlsx`);
  };

  // ── Exportación Excel — Resumen ───────────────────────────────────────────
  const exportarResumen = () => {
    if (!resumenData?.barberos.length) return;
    const filas = resumenData.barberos.map((b) => ({
      Barbero: b.barbero_nombre, Cortes: b.cantidad_cortes,
      "Monto servicios ($)": b.monto_servicios, "Propinas ($)": b.propinas,
      "Total generado ($)": b.total_generado,
      ...(mostrarComisiones ? { "Comisión ($)": b.comision } : {}),
    }));
    const t = resumenData.totales;
    filas.push({
      Barbero: "TOTAL", Cortes: t.cantidad_cortes,
      "Monto servicios ($)": t.monto_servicios, "Propinas ($)": t.propinas,
      "Total generado ($)": t.total_generado,
      ...(mostrarComisiones ? { "Comisión ($)": t.comision } : {}),
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), "Resumen semanal");
    XLSX.writeFile(wb, `resumen-semanal-${semana}.xlsx`);
  };

  // ── Datos derivados ───────────────────────────────────────────────────────
  const hoy                 = getFechaHoy();
  const barberoSeleccionado = detalleData.find((b) => b.barbero_id === barberoActivo);
  const diasDelBarbero      = barberoSeleccionado ? agruparPorDia(barberoSeleccionado.cortes) : [];
  const infoComisionActiva  = resumenData?.barberos.find((b) => b.barbero_id === barberoActivo);

  /**
   * Alterna la expansión de un bloque de día.
   * Si la fecha está en el Set, la quita (contrae); si no, la agrega (expande).
   */
  const toggleDia = (fecha) => {
    setDiasExpandidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(fecha)) nuevo.delete(fecha);
      else nuevo.add(fecha);
      return nuevo;
    });
  };

  /**
   * Cambia de barbero activo y resetea los días expandidos a solo hoy.
   * Evita que quede "expandido" un día que el nuevo barbero no trabajó.
   */
  const cambiarBarbero = (barberoId) => {
    setBarberoActivo(barberoId);
    setDiasExpandidos(new Set([hoy]));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.contenedor}>

      {/* ── FILA 1: título | tabs principales ────────────────────────── */}
      <div style={styles.fila1}>
        <div>
          <h2 style={styles.titulo}>Planillas</h2>
          <p style={styles.subtitulo}>Cortes y comisiones por barbero, semana a semana</p>
        </div>
        <div style={styles.tabsContainer}>
          {[
            { id: "detalle", label: "Detalle por barbero" },
            { id: "resumen", label: "Resumen semanal" },
          ].map((tab) => (
            <button
              key={tab.id}
              style={{ ...styles.tabBtn, ...(tabActiva === tab.id ? styles.tabBtnActivo : {}) }}
              onPointerDown={() => setTabActiva(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FILA 2: toggle comisiones | selector semana | exportar Excel ─ */}
      <div style={styles.fila2}>
        <div style={{ justifySelf: "start" }}>
          <TogglePill
            activo={mostrarComisiones}
            onToggle={() => setMostrarComisiones((v) => !v)}
            labelOn="Con comisiones"
            labelOff="Sin comisiones"
          />
        </div>

        <SelectorSemana value={semana} onChange={setSemana} />

        <div style={{ justifySelf: "end" }}>
          <BotonExportarExcel onPointerDown={tabActiva === "detalle" ? exportarDetalle : exportarResumen} />
        </div>
      </div>

      {/* ── CONTENIDO ────────────────────────────────────────────────────── */}
      <div style={styles.tabContenido}>

        {loading && <p style={styles.estadoTexto}>Cargando...</p>}
        {!loading && error && <p style={styles.errorTexto}>{error}</p>}

        {/* ── TAB: DETALLE ─────────────────────────────────────────────── */}
        {!loading && !error && tabActiva === "detalle" && (
          <>
            {detalleData.length === 0 && (
              <p style={styles.estadoTexto}>No hay cortes registrados esta semana.</p>
            )}

            {detalleData.length > 0 && (
              <>
                {/* Fila 3 — pills de barberos */}
                <div style={styles.fila3}>
                  <div style={styles.tabsContainer}>
                    {detalleData.map((b) => (
                      <button
                        key={b.barbero_id}
                        style={{ ...styles.tabBtn, ...(barberoActivo === b.barbero_id ? styles.tabBtnActivo : {}) }}
                        onPointerDown={() => cambiarBarbero(b.barbero_id)}
                      >
                        {b.barbero_nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {diasDelBarbero.length === 0 && (
                  <p style={styles.estadoTexto}>Este barbero no tiene cortes esta semana.</p>
                )}

                {diasDelBarbero.map(({ fecha, cortes: cortesDelDia }) => {
                  const esHoy           = fecha === hoy;
                  const totalMonto      = cortesDelDia.reduce((s, c) => s + c.monto_servicios, 0);
                  const totalProp       = cortesDelDia.reduce((s, c) => s + c.propina, 0);
                  const totalGeneral    = totalMonto + totalProp;
                  const comisionDelDia  = infoComisionActiva
                    ? calcularComisionDia(totalMonto, infoComisionActiva.comision_tipo, infoComisionActiva.comision_valor, cortesDelDia.length)
                    : 0;

                  return (
                    <div key={fecha} style={styles.bloque}>
                      <div
                        style={{
                          ...styles.bloqueTituloRow,
                          backgroundColor: esHoy ? "#f0faf5" : "#fafafa",
                          cursor: "pointer",
                        }}
                        onPointerDown={() => toggleDia(fecha)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={styles.bloqueTituloTexto}>{formatFechaCorta(fecha)}</span>
                          {esHoy && <span style={styles.badgeHoy}>Hoy</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={styles.bloqueCantidad}>
                            {cortesDelDia.length} corte{cortesDelDia.length !== 1 ? "s" : ""}
                          </span>
                          <span style={styles.chevron}>
                            {diasExpandidos.has(fecha) ? "▼" : "▶"}
                          </span>
                        </div>
                      </div>

                      <table style={styles.tabla}>
                        {diasExpandidos.has(fecha) && (
                          <thead>
                            <tr>
                              <th style={styles.th}>Hora</th>
                              <th style={styles.th}>Servicio</th>
                              <th style={{ ...styles.th, textAlign: "right" }}>Monto</th>
                              <th style={{ ...styles.th, textAlign: "right" }}>Propina</th>
                              <th style={{ ...styles.th, textAlign: "right" }}>Total</th>
                              <th style={styles.th}>Pago</th>
                            </tr>
                          </thead>
                        )}
                        {diasExpandidos.has(fecha) && (
                          <tbody>
                            {cortesDelDia.map((c) => (
                              <tr key={c.corte_id}>
                                <td style={styles.td}>{c.hora}</td>
                                <td style={styles.td}>{c.servicio_nombre}</td>
                                <td style={{ ...styles.td, textAlign: "right" }}>{formatARS(c.monto_servicios)}</td>
                                <td style={{ ...styles.td, textAlign: "right" }}>
                                  {c.propina > 0 ? formatARS(c.propina) : <span style={styles.sinPropina}>—</span>}
                                </td>
                                <td style={{ ...styles.td, textAlign: "right", fontWeight: "600" }}>
                                  {formatARS(c.monto_servicios + c.propina)}
                                </td>
                                <td style={styles.td}>
                                  <span style={{ ...styles.badgePago, ...(c.forma_pago === "efectivo" ? styles.badgeEfectivo : styles.badgeMP) }}>
                                    {formatPago(c.forma_pago)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        )}
                        <tfoot>
                          <tr style={styles.trTotal}>
                            <td style={styles.tdTotal} colSpan={2}>
                              Subtotal — {cortesDelDia.length} corte{cortesDelDia.length !== 1 ? "s" : ""}
                            </td>
                            <td style={{ ...styles.tdTotal, textAlign: "right" }}>{formatARS(totalMonto)}</td>
                            <td style={{ ...styles.tdTotal, textAlign: "right" }}>{formatARS(totalProp)}</td>
                            <td style={{ ...styles.tdTotal, textAlign: "right", color: "#1a7a4a" }}>{formatARS(totalGeneral)}</td>
                            <td style={{ ...styles.tdTotal, textAlign: "right" }}>
                              {mostrarComisiones && infoComisionActiva ? (
                                <span style={styles.comisionValor}>
                                  {formatARS(comisionDelDia + totalProp)}
                                  <span style={styles.comisionTipo}>
                                    {infoComisionActiva.comision_tipo === "porcentaje"
                                      ? ` (${infoComisionActiva.comision_valor}% + prop)`
                                      : ` ($${infoComisionActiva.comision_valor}/c + prop)`}
                                  </span>
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ── TAB: RESUMEN ─────────────────────────────────────────────── */}
        {!loading && !error && tabActiva === "resumen" && (
          <>
            {(!resumenData || resumenData.barberos.length === 0) && (
              <p style={styles.estadoTexto}>No hay cortes registrados esta semana.</p>
            )}

            {resumenData && resumenData.barberos.length > 0 && (
              <div style={styles.bloque}>
                <table style={styles.tabla}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Barbero</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>Cortes</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>Monto servicios</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>Propinas</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>Total generado</th>
                      {mostrarComisiones && (
                        <th style={{ ...styles.th, textAlign: "right" }}>Comisión</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {resumenData.barberos.map((b) => (
                      <tr key={b.barbero_id}>
                        <td style={{ ...styles.td, fontWeight: "600" }}>{b.barbero_nombre}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>{b.cantidad_cortes}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>{formatARS(b.monto_servicios)}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>{formatARS(b.propinas)}</td>
                        <td style={{ ...styles.td, textAlign: "right", fontWeight: "600" }}>{formatARS(b.total_generado)}</td>
                        {mostrarComisiones && (
                          <td style={{ ...styles.td, textAlign: "right", color: "#1a7a4a", fontWeight: "600" }}>
                            {formatARS(b.comision)}
                            <span style={styles.comisionTipo}>
                              {b.comision_tipo === "porcentaje" ? ` (${b.comision_valor}%)` : ` ($${b.comision_valor}/c)`}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={styles.trTotal}>
                      <td style={styles.tdTotal}>TOTAL</td>
                      <td style={{ ...styles.tdTotal, textAlign: "right" }}>{resumenData.totales.cantidad_cortes}</td>
                      <td style={{ ...styles.tdTotal, textAlign: "right" }}>{formatARS(resumenData.totales.monto_servicios)}</td>
                      <td style={{ ...styles.tdTotal, textAlign: "right" }}>{formatARS(resumenData.totales.propinas)}</td>
                      <td style={{ ...styles.tdTotal, textAlign: "right" }}>{formatARS(resumenData.totales.total_generado)}</td>
                      {mostrarComisiones && (
                        <td style={{ ...styles.tdTotal, textAlign: "right", color: "#1a7a4a" }}>
                          {formatARS(resumenData.totales.comision)}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {

  contenedor: {
    padding: "36px 40px",
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    color: "#111111",
  },

  // ── Fila 1: título | tabs ────────────────────────────────────────────────
  fila1: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "16px",
  },
    titulo: {
    fontSize: '24px', fontWeight: '700', color: '#111', margin: '0 0 4px',
  },
  subtitulo: {
    fontSize: '14px', color: '#888', margin: 0,
  },

  // ── Fila 2: toggle | selector semana | exportar ──────────────────────────
  fila2: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: "16px",
    marginBottom: "20px",
  },

  // ── Fila 3: pills de barberos (solo Detalle) ─────────────────────────────
  fila3: {
    display: "flex",
    alignItems: "center",
  },


  // ── Tabs pill ─────────────────────────────────────────────────────────────
  tabsContainer: {
    display: "flex",
    gap: "4px",
    backgroundColor: "#f5f5f5",
    borderRadius: "12px",
    padding: "4px",
  },
  tabBtn: {
    padding: "8px 20px",
    borderRadius: "9px",
    border: "none",
    backgroundColor: "transparent",
    color: "#888888",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  tabBtnActivo: {
    backgroundColor: "#ffffff",
    color: "#111111",
    fontWeight: "600",
    boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
  },

  // ── Contenido ────────────────────────────────────────────────────────────
  tabContenido: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },

  // ── Bloque de día ────────────────────────────────────────────────────────
  bloque: {
    backgroundColor: "#ffffff",
    border: "1.5px solid #eeeeee",
    borderRadius: "16px",
    overflow: "hidden",
  },
  bloqueTituloRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid #f0f0f0",
  },
  bloqueTituloTexto: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#333333",
    letterSpacing: "0.01em",
  },
  bloqueCantidad: {
    fontSize: "13px",
    color: "#888888",
    fontWeight: "500",
  },
  chevron: {
    fontSize: "12px",
    color: "#888888",
    lineHeight: 1,
    userSelect: "none",
  },
  badgeHoy: {
    fontSize: "10px",
    fontWeight: "700",
    backgroundColor: "#1a7a4a",
    color: "#ffffff",
    padding: "2px 8px",
    borderRadius: "8px",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
  },

  // ── Tabla ────────────────────────────────────────────────────────────────
  tabla: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "12px 20px",
    fontSize: "11px",
    fontWeight: "700",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    textAlign: "left",
    backgroundColor: "#fafafa",
    borderBottom: "1px solid #f0f0f0",
  },
  td: {
    padding: "14px 20px",
    fontSize: "14px",
    color: "#333333",
    borderBottom: "1px solid #f7f7f7",
  },
  trTotal: {
    backgroundColor: "#eeeeee",
    borderTop: "2px solid #eeeeee",
  },
  tdTotal: {
    padding: "14px 20px",
    fontSize: "14px",
    fontWeight: "700",
    color: "#111111",
  },

  // ── Badges ───────────────────────────────────────────────────────────────
  badgePago: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeEfectivo: { backgroundColor: "#e8f5e9", color: "#2e7d32" },
  badgeMP:       { backgroundColor: "#e3f2fd", color: "#1565c0" },
  sinPropina:    { color: "#cccccc" },

  // Comisión en subtotal del día
  comisionValor: {
    color: "#1a7a4a",
    fontWeight: "600",
  },
  comisionTipo: {
    fontSize: "11px",
    fontWeight: "400",
    color: "#888888",
    marginLeft: "4px",
  },

  // ── Estados ──────────────────────────────────────────────────────────────
  estadoTexto: {
    textAlign: "center",
    color: "#999999",
    fontSize: "15px",
    padding: "40px 0",
    margin: 0,
  },
  errorTexto: {
    textAlign: "center",
    color: "#c0392b",
    fontSize: "14px",
    padding: "20px 0",
    margin: 0,
  },
};
