// /frontend/src/screens/admin/sections/SeccionPlanillas.jsx
// Sección de planillas semanales del panel de administrador.
//
// Contiene dos tabs:
//   - Detalle semanal: un bloque por barbero con todos sus cortes de la semana
//   - Resumen semanal: una tabla consolidada con totales y comisiones
//
// El selector de semana (← / →) controla qué semana se carga.
// Exporta a Excel con SheetJS (una sola hoja con todos los barberos).
//
// No recibe props de datos — carga sus propios datos con useEffect.

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

// ─── Helpers de semana ────────────────────────────────────────────────────────

/**
 * Calcula el número de semana ISO y año para una fecha dada.
 * @param {Date} date
 * @returns {[number, number]} [año, numeroSemana]
 */
function getISOWeekNum(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return [d.getFullYear(), weekNum];
}

/**
 * Devuelve el string de semana ISO para la fecha actual.
 * @returns {string} ej: "2025-W12"
 */
function getSemanaActual() {
  const [year, week] = getISOWeekNum(new Date());
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Convierte un string de semana ISO a la Date del lunes correspondiente.
 * @param {string} semanaStr - ej: "2025-W12"
 * @returns {Date}
 */
function semanaALunes(semanaStr) {
  const [yearStr, wStr] = semanaStr.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(wStr);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const lunesSemana1 = new Date(jan4);
  lunesSemana1.setDate(jan4.getDate() - (jan4Day - 1));
  const lunes = new Date(lunesSemana1);
  lunes.setDate(lunesSemana1.getDate() + (week - 1) * 7);
  return lunes;
}

/**
 * Avanza o retrocede una semana desde el string dado.
 * @param {string} semanaStr
 * @param {number} delta - 1 o -1
 * @returns {string} nuevo string de semana
 */
function navegarSemana(semanaStr, delta) {
  const lunes = semanaALunes(semanaStr);
  lunes.setDate(lunes.getDate() + delta * 7);
  const [year, week] = getISOWeekNum(lunes);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Devuelve el rango de fechas legible para mostrar en el selector.
 * @param {string} semanaStr
 * @returns {string} ej: "10/03 → 16/03/2025"
 */
function formatRangoSemana(semanaStr) {
  const lunes = semanaALunes(semanaStr);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  const fmtCorto = (d) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const año = domingo.getFullYear();
  return `${fmtCorto(lunes)} → ${fmtCorto(domingo)}/${año}`;
}

/**
 * Formatea una fecha "YYYY-MM-DD" como "Lun 10/03".
 * Construye la fecha desde componentes locales para evitar problemas de timezone.
 * @param {string} fechaStr
 * @returns {string}
 */
function formatFecha(fechaStr) {
  const [year, month, day] = fechaStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return `${dias[d.getDay()]} ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

/** Formatea un número como moneda ARS. */
const ars = (n) => `$ ${Number(n).toLocaleString("es-AR")}`;

/** Capitaliza la forma de pago para mostrarla en la tabla. */
const fmtPago = (p) => (p === "efectivo" ? "Efectivo" : "Mercado Pago");

// ─── Constantes de la API ─────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SeccionPlanillas() {
  const [semana, setSemana]           = useState(getSemanaActual);
  const [tabActiva, setTabActiva]     = useState("detalle"); // "detalle" | "resumen"
  const [detalleData, setDetalleData] = useState([]);
  const [resumenData, setResumenData] = useState(null);   // { barberos, totales }
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  // ── Carga de datos al cambiar la semana ──────────────────────────────────────
  useEffect(() => {
    const cargarDatos = async () => {
      console.log("[SeccionPlanillas] Cargando datos — semana:", semana);
      setLoading(true);
      setError(null);
      try {
        const [resDetalle, resResumen] = await Promise.all([
          fetch(`${BASE_URL}/api/planillas/detalle-semanal?semana=${semana}`),
          fetch(`${BASE_URL}/api/planillas/resumen-semanal?semana=${semana}`),
        ]);
        if (!resDetalle.ok || !resResumen.ok) throw new Error("Error en la respuesta del servidor");
        const [detalle, resumen] = await Promise.all([
          resDetalle.json(),
          resResumen.json(),
        ]);
        console.log("[SeccionPlanillas] Datos cargados — barberos en detalle:", detalle.length);
        setDetalleData(detalle);
        setResumenData(resumen);
      } catch (err) {
        console.error("[SeccionPlanillas] Error al cargar datos:", err);
        setError("No se pudieron cargar los datos. Revisá la conexión.");
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, [semana]);

  // ── Exportación Excel — Detalle semanal ──────────────────────────────────────
  const exportarDetalle = () => {
    if (!detalleData.length) return;
    console.log("[SeccionPlanillas] Exportando detalle a Excel — semana:", semana);

    const filas = [];
    detalleData.forEach((barbero) => {
      // Fila de encabezado del bloque del barbero
      filas.push({
        Barbero: `── ${barbero.barbero_nombre} ──`,
        Fecha: "", Hora: "", Servicio: "",
        "Monto ($)": "", "Propina ($)": "", "Total ($)": "", "Forma de pago": "",
      });
      // Una fila por corte
      barbero.cortes.forEach((c) => {
        filas.push({
          Barbero: "",
          Fecha:           formatFecha(c.fecha),
          Hora:            c.hora,
          Servicio:        c.servicio_nombre,
          "Monto ($)":     c.monto_servicios,
          "Propina ($)":   c.propina,
          "Total ($)":     c.monto_servicios + c.propina,
          "Forma de pago": fmtPago(c.forma_pago),
        });
      });
      // Fila de subtotales del barbero
      const totalMonto   = barbero.cortes.reduce((s, c) => s + c.monto_servicios, 0);
      const totalPropina = barbero.cortes.reduce((s, c) => s + c.propina, 0);
      filas.push({
        Barbero:         `Subtotal (${barbero.cortes.length} cortes)`,
        Fecha: "", Hora: "", Servicio: "",
        "Monto ($)":     totalMonto,
        "Propina ($)":   totalPropina,
        "Total ($)":     totalMonto + totalPropina,
        "Forma de pago": "",
      });
      // Fila vacía separadora entre barberos
      filas.push({ Barbero: "", Fecha: "", Hora: "", Servicio: "", "Monto ($)": "", "Propina ($)": "", "Total ($)": "", "Forma de pago": "" });
    });

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalle semanal");
    XLSX.writeFile(wb, `detalle-semanal-${semana}.xlsx`);
  };

  // ── Exportación Excel — Resumen semanal ──────────────────────────────────────
  const exportarResumen = () => {
    if (!resumenData?.barberos.length) return;
    console.log("[SeccionPlanillas] Exportando resumen a Excel — semana:", semana);

    const filas = resumenData.barberos.map((b) => ({
      Barbero:                b.barbero_nombre,
      Cortes:                 b.cantidad_cortes,
      "Monto servicios ($)":  b.monto_servicios,
      "Propinas ($)":         b.propinas,
      "Total generado ($)":   b.total_generado,
      "Comisión ($)":         b.comision,
    }));
    // Fila de totales generales
    const t = resumenData.totales;
    filas.push({
      Barbero:               "TOTAL",
      Cortes:                t.cantidad_cortes,
      "Monto servicios ($)": t.monto_servicios,
      "Propinas ($)":        t.propinas,
      "Total generado ($)":  t.total_generado,
      "Comisión ($)":        t.comision,
    });

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resumen semanal");
    XLSX.writeFile(wb, `resumen-semanal-${semana}.xlsx`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const esSemanaActual = semana === getSemanaActual();

  return (
    <div style={styles.contenedor}>

      {/* ── ENCABEZADO ────────────────────────────────────────────────────── */}
      <div style={styles.header}>

        {/* Selector de semana */}
        <div style={{ ...styles.selectorSemana, ...(esSemanaActual ? styles.selectorActual : styles.selectorPasado) }}>
          <button
            style={styles.btnNavSemana}
            onPointerDown={() => setSemana((s) => navegarSemana(s, -1))}
            title="Semana anterior"
          >
            ‹
          </button>
          <div style={styles.rangoSemanaWrapper}>
            <span style={{ ...styles.rangoSemana, ...(esSemanaActual ? styles.rangoActual : styles.rangoPasado) }}>
              {formatRangoSemana(semana)}
            </span>
            {esSemanaActual && (
              <span style={styles.badgeSemanaActual}>Esta semana</span>
            )}
          </div>
          <button
            style={{
              ...styles.btnNavSemana,
              ...(esSemanaActual ? styles.btnNavDeshabilitado : {}),
            }}
            onPointerDown={() => {
              if (!esSemanaActual) setSemana((s) => navegarSemana(s, 1));
            }}
            title={esSemanaActual ? "Ya estás en la semana actual" : "Semana siguiente"}
          >
            ›
          </button>
        </div>
      </div>

      {/* ── TABS ──────────────────────────────────────────────────────────── */}
      <div style={styles.tabsBar}>
        {[
          { id: "detalle", label: "Detalle por barbero" },
          { id: "resumen", label: "Resumen semanal" },
        ].map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(tabActiva === tab.id ? styles.tabActivo : {}),
            }}
            onPointerDown={() => setTabActiva(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── CONTENIDO ─────────────────────────────────────────────────────── */}
      <div style={styles.cuerpo}>

        {/* Estado de carga */}
        {loading && (
          <div style={styles.estadoCenter}>
            <span style={styles.loadingText}>Cargando...</span>
          </div>
        )}

        {/* Estado de error */}
        {!loading && error && (
          <div style={styles.estadoCenter}>
            <span style={styles.errorText}>{error}</span>
          </div>
        )}

        {/* ── TAB: DETALLE ─────────────────────────────────────────────── */}
        {!loading && !error && tabActiva === "detalle" && (
          <>
            {/* Sin datos */}
            {detalleData.length === 0 && (
              <div style={styles.estadoCenter}>
                <span style={styles.sinDatosText}>No hay cortes registrados esta semana.</span>
              </div>
            )}

            {/* Botón exportar (solo si hay datos) */}
            {detalleData.length > 0 && (
              <div style={styles.barraAcciones}>
                <button style={styles.btnExportar} onPointerDown={exportarDetalle}>
                  ↓ Exportar Excel
                </button>
              </div>
            )}

            {/* Un bloque por barbero */}
            {detalleData.map((barbero) => {
              const totalMonto   = barbero.cortes.reduce((s, c) => s + c.monto_servicios, 0);
              const totalPropina = barbero.cortes.reduce((s, c) => s + c.propina, 0);
              const totalGeneral = totalMonto + totalPropina;
              return (
                <div key={barbero.barbero_id} style={styles.bloqueBarberо}>
                  {/* Nombre del barbero */}
                  <div style={styles.bloqueHeader}>
                    <span style={styles.bloqueNombre}>{barbero.barbero_nombre}</span>
                    <span style={styles.bloqueCantidad}>{barbero.cortes.length} cortes</span>
                  </div>

                  {/* Tabla de cortes */}
                  <div style={styles.tablaWrapper}>
                    <table style={styles.tabla}>
                      <thead>
                        <tr>
                          {["Fecha", "Hora", "Servicio", "Monto", "Propina", "Total", "Pago"].map((col) => (
                            <th key={col} style={styles.th}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {barbero.cortes.map((c, i) => (
                          <tr key={c.corte_id} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                            <td style={styles.td}>{formatFecha(c.fecha)}</td>
                            <td style={styles.td}>{c.hora}</td>
                            <td style={{ ...styles.td, textAlign: "left" }}>{c.servicio_nombre}</td>
                            <td style={{ ...styles.td, ...styles.tdMonto }}>{ars(c.monto_servicios)}</td>
                            <td style={{ ...styles.td, ...styles.tdMonto }}>
                              {c.propina > 0 ? ars(c.propina) : <span style={styles.sinPropina}>—</span>}
                            </td>
                            <td style={{ ...styles.td, ...styles.tdMonto, fontWeight: "600" }}>
                              {ars(c.monto_servicios + c.propina)}
                            </td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.badgePago,
                                ...(c.forma_pago === "efectivo" ? styles.badgeEfectivo : styles.badgeMP),
                              }}>
                                {fmtPago(c.forma_pago)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Fila de subtotales al pie */}
                      <tfoot>
                        <tr style={styles.trSubtotal}>
                          <td style={styles.tdSubtotal} colSpan={3}>
                            Subtotal — {barbero.cortes.length} cortes
                          </td>
                          <td style={{ ...styles.tdSubtotal, ...styles.tdMonto }}>{ars(totalMonto)}</td>
                          <td style={{ ...styles.tdSubtotal, ...styles.tdMonto }}>{ars(totalPropina)}</td>
                          <td style={{ ...styles.tdSubtotal, ...styles.tdMonto, color: "#1a7a4a" }}>{ars(totalGeneral)}</td>
                          <td style={styles.tdSubtotal} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── TAB: RESUMEN ─────────────────────────────────────────────── */}
        {!loading && !error && tabActiva === "resumen" && (
          <>
            {/* Sin datos */}
            {(!resumenData || resumenData.barberos.length === 0) && (
              <div style={styles.estadoCenter}>
                <span style={styles.sinDatosText}>No hay cortes registrados esta semana.</span>
              </div>
            )}

            {/* Tabla de resumen */}
            {resumenData && resumenData.barberos.length > 0 && (
              <>
                <div style={styles.barraAcciones}>
                  <button style={styles.btnExportar} onPointerDown={exportarResumen}>
                    ↓ Exportar Excel
                  </button>
                </div>

                <div style={styles.tablaWrapper}>
                  <table style={styles.tabla}>
                    <thead>
                      <tr>
                        {["Barbero", "Cortes", "Monto servicios", "Propinas", "Total generado", "Comisión"].map((col) => (
                          <th key={col} style={col === "Barbero" ? { ...styles.th, textAlign: "left" } : styles.th}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resumenData.barberos.map((b, i) => (
                        <tr key={b.barbero_id} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                          <td style={{ ...styles.td, textAlign: "left", fontWeight: "600" }}>{b.barbero_nombre}</td>
                          <td style={styles.td}>{b.cantidad_cortes}</td>
                          <td style={{ ...styles.td, ...styles.tdMonto }}>{ars(b.monto_servicios)}</td>
                          <td style={{ ...styles.td, ...styles.tdMonto }}>{ars(b.propinas)}</td>
                          <td style={{ ...styles.td, ...styles.tdMonto, fontWeight: "600" }}>{ars(b.total_generado)}</td>
                          <td style={{ ...styles.td, ...styles.tdMonto, color: "#1a7a4a", fontWeight: "600" }}>
                            {ars(b.comision)}
                            <span style={styles.comisionTipo}>
                              {b.comision_tipo === "porcentaje" ? ` (${b.comision_valor}%)` : ` ($${b.comision_valor}/c)`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Fila de totales generales */}
                    <tfoot>
                      <tr style={styles.trSubtotal}>
                        <td style={{ ...styles.tdSubtotal, textAlign: "left" }}>TOTAL</td>
                        <td style={styles.tdSubtotal}>{resumenData.totales.cantidad_cortes}</td>
                        <td style={{ ...styles.tdSubtotal, ...styles.tdMonto }}>{ars(resumenData.totales.monto_servicios)}</td>
                        <td style={{ ...styles.tdSubtotal, ...styles.tdMonto }}>{ars(resumenData.totales.propinas)}</td>
                        <td style={{ ...styles.tdSubtotal, ...styles.tdMonto }}>{ars(resumenData.totales.total_generado)}</td>
                        <td style={{ ...styles.tdSubtotal, ...styles.tdMonto, color: "#1a7a4a" }}>{ars(resumenData.totales.comision)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
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
    display: "flex",
    flexDirection: "column",
    //height: "100%",
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    backgroundColor: "#f4f4f5",
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px 40px 0",
    flexShrink: 0,
  },

  // Selector de semana — base
  selectorSemana: {
    display: "flex",
    alignItems: "center",
    gap: "0",
    borderRadius: "12px",
    overflow: "hidden",
  },
  // Variante semana actual (verde)
  selectorActual: {
    border: "1.5px solid #1a7a4a",
    backgroundColor: "#f0faf5",
  },
  // Variante semana pasada (gris)
  selectorPasado: {
    border: "1.5px solid #e0e0e0",
    backgroundColor: "#ffffff",
  },
  btnNavSemana: {
    width: "44px",
    height: "44px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontSize: "22px",
    color: "#555555",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
  },
  // Flecha › deshabilitada cuando es semana actual
  btnNavDeshabilitado: {
    color: "#cccccc",
    cursor: "default",
  },
  // Wrapper interno: apila el rango y el badge verticalmente
  rangoSemanaWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 16px",
    borderLeft: "1px solid #e0e0e0",
    borderRight: "1px solid #e0e0e0",
    minWidth: "180px",
    gap: "3px",
  },
  // Texto del rango — solo font y whitespace, el color lo pone la variante
  rangoSemana: {
    fontSize: "14px",
    whiteSpace: "nowrap",
  },
  // Variante texto semana actual
  rangoActual: {
    color: "#1a7a4a",
    fontWeight: "700",
  },
  // Variante texto semana pasada
  rangoPasado: {
    color: "#333333",
    fontWeight: "600",
  },
  // Badge "Esta semana"
  badgeSemanaActual: {
    fontSize: "10px",
    fontWeight: "600",
    color: "#1a7a4a",
    backgroundColor: "#c8ead8",
    padding: "2px 8px",
    borderRadius: "20px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },

  // ── Tabs ────────────────────────────────────────────────────────────────
  tabsBar: {
    display: "flex",
    gap: "4px",
    padding: "16px 40px 0",
    flexShrink: 0,
  },
  tab: {
    padding: "10px 24px",
    borderRadius: "10px 10px 0 0",
    border: "1.5px solid #e0e0e0",
    borderBottom: "none",
    backgroundColor: "#ececec",
    color: "#777777",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  tabActivo: {
    backgroundColor: "#ffffff",
    color: "#111111",
    fontWeight: "600",
    borderColor: "#e0e0e0",
  },

  // ── Cuerpo ───────────────────────────────────────────────────────────────
  cuerpo: {
    //flex: 1,
    //overflowY: "auto",
    padding: "24px 40px 40px",
    backgroundColor: "#ffffff",
    borderTop: "1.5px solid #e0e0e0",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },

  // Estados vacíos / carga / error
  estadoCenter: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "60px 0",
  },
  loadingText: { fontSize: "16px", color: "#888888" },
  errorText:   { fontSize: "16px", color: "#c0392b" },
  sinDatosText:{ fontSize: "16px", color: "#aaaaaa" },

  // Barra de acciones (botón exportar)
  barraAcciones: {
    display: "flex",
    justifyContent: "flex-end",
  },
  btnExportar: {
    padding: "10px 22px",
    borderRadius: "10px",
    border: "1.5px solid #1a7a4a",
    backgroundColor: "#ffffff",
    color: "#1a7a4a",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
  },

  // ── Bloque por barbero (tab detalle) ─────────────────────────────────────
  bloqueBarberо: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
    borderRadius: "12px",
    border: "1.5px solid #e8e8e8",
    overflow: "hidden",
  },
  bloqueHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    backgroundColor: "#f8f8f8",
    borderBottom: "1.5px solid #e8e8e8",
  },
  bloqueNombre: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#111111",
  },
  bloqueCantidad: {
    fontSize: "13px",
    color: "#888888",
    fontWeight: "500",
  },

  // ── Tabla compartida ─────────────────────────────────────────────────────
  tablaWrapper: {
    overflowX: "auto",
    width: "100%",
  },
  tabla: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
    tableLayout: "auto",
  },
  th: {
    padding: "12px 16px",
    backgroundColor: "#f0f0f0",
    color: "#555555",
    fontWeight: "600",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    textAlign: "center",
    borderBottom: "1.5px solid #e0e0e0",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 16px",
    color: "#333333",
    textAlign: "center",
    borderBottom: "1px solid #f0f0f0",
    whiteSpace: "nowrap",
  },
  tdMonto: {
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  trPar:    { backgroundColor: "#ffffff" },
  trImpar:  { backgroundColor: "#fafafa" },
  trSubtotal: {
    backgroundColor: "#f5f5f5",
    borderTop: "2px solid #e0e0e0",
  },
  tdSubtotal: {
    padding: "12px 16px",
    fontWeight: "700",
    color: "#333333",
    textAlign: "center",
    fontSize: "13px",
  },

  // Badges de forma de pago
  badgePago: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeEfectivo: {
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
  },
  badgeMP: {
    backgroundColor: "#e3f2fd",
    color: "#1565c0",
  },

  sinPropina: {
    color: "#cccccc",
  },

  // Indicador de tipo de comisión en la tabla de resumen
  comisionTipo: {
    fontSize: "11px",
    fontWeight: "400",
    color: "#888888",
    marginLeft: "4px",
  },
};
