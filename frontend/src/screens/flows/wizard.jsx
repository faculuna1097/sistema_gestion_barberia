// /frontend/src/screens/flows/wizard.jsx
// Piezas compartidas por los 3 flujos operativos del local (Corte/Venta/Gasto).
// Son específicas de la SUPERFICIE KIOSKO-WIZARD (panel claro sobre FondoLocal,
// pasos con barra de progreso, botones táctiles grandes): por eso viven acá, en
// la carpeta de los flujos, y NO en `components/ui/` — mismo criterio que el
// sistema usa para los primitivos wizard-only del turnero (§6.2).
//
// Exporta:
//   PanelWizard   — marco de un paso (FondoLocal + panel + header + progreso).
//   BotonOpcion   — card táctil de selección.
//   CampoTexto    — textarea con el lenguaje visual de Field.
//   CampoMonto    — input numérico grande ($).
//   FilaResumen   — fila label/valor del resumen (densidad kiosko).
//   FilaTotal     — fila de total (color parametrizable: accent ingreso / danger egreso).
//   PantallaExito — confirmación con checkmark animado + monto.
//   wizardStyles  — estilos de layout reusables por los flujos (grillas, botón grande, etc.).

import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { theme } from "../../theme/tokens.js";
import { fmtPesos } from "../../utils/formato.js";
import { FondoLocal } from "../../components/ui";

// ─── PanelWizard ──────────────────────────────────────────────────────────────
/**
 * PanelWizard
 * Marco visual de un paso: FondoLocal + panel claro casi full-screen con barra
 * de progreso, header (volver · título centrado · "Paso X de Y") y contenido.
 * El contenido se remonta con `key={paso}` para reproducir la animación
 * funcional `om-fade` en cada cambio de paso (transición simple, no decorativa).
 *
 * @param {Object} props
 * @param {number} props.paso        — paso actual (1-based)
 * @param {number} props.total       — cantidad total de pasos
 * @param {string} props.titulo      — título del paso (centrado en el header)
 * @param {string} [props.subtitulo] — subtítulo opcional bajo el título
 * @param {Function} props.onVolver  — handler del botón volver
 * @param {string|null} [props.imagenLocal] — foto de fondo (FondoLocal)
 * @param {number} [props.maxAncho=960] — ancho máximo del contenido centrado.
 *   Ancho (~960) para grillas de muchas opciones; angosto (~520) para pasos de
 *   un solo campo (input/resumen) y que no queden absurdamente anchos.
 * @param {React.ReactNode} props.children   — contenido del paso
 * @returns {JSX.Element}
 */
export function PanelWizard({ paso, total, titulo, subtitulo, onVolver, imagenLocal, maxAncho = 960, children }) {
  return (
    <FondoLocal imagenLocal={imagenLocal}>
      {/* Press feedback de los botones de opción: scale al tocar, sin onPointerDown.
          Pseudo-clases no expresables inline (misma excepción que §4.1 / MainScreen). */}
      <style>{`
        .om-opcion { transition: transform .1s ease, border-color .12s ease, background-color .12s ease; }
        .om-opcion:hover { border-color: ${theme.mutedSoft}; }
        .om-opcion:active { transform: scale(.97); }
      `}</style>

      <div style={styles.panel}>
        {/* Barra de progreso (fija arriba del panel). */}
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${(paso / total) * 100}%` }} />
        </div>

        {/* Header (fijo): volver (izq) · título (centro) · paso (der).
            Grilla 1fr/auto/1fr → el título queda centrado real respecto al panel,
            sin importar el ancho distinto de la flecha y el indicador. */}
        <div style={styles.panelHeader}>
          <button
            className="om-opcion"
            onClick={onVolver}
            aria-label="Volver"
            style={styles.btnVolver}
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <div style={styles.tituloArea}>
            <h1 style={styles.titulo}>{titulo}</h1>
            {subtitulo && <p style={styles.subtitulo}>{subtitulo}</p>}
          </div>
          <span style={styles.indicadorPaso}>Paso {paso} de {total}</span>
        </div>

        {/* Cuerpo del paso (se anima en cada cambio de paso). */}
        <div key={paso} style={styles.pasoBody}>
          <div style={{ ...styles.pasoInner, maxWidth: maxAncho }}>
            <div style={styles.contenido}>{children}</div>
          </div>
        </div>
      </div>
    </FondoLocal>
  );
}

// ─── BotonOpcion ────────────────────────────────────────────────────────────────
/**
 * BotonOpcion
 * Card táctil de selección (barbero, turno, servicio, forma de pago, etc.).
 * Activo = accentSoft + border/texto accent. Press vía clase scoped `om-opcion`
 * (sin onPointerDown).
 *
 * @param {Object} props
 * @param {boolean} [props.activo=false]  — estado seleccionado
 * @param {Function} props.onClick        — acción al activar
 * @param {'normal'|'grande'} [props.variante='normal'] — alto del card
 * @param {boolean} [props.dashed=false]  — border punteado oscuro (ej. opción "Sin turno")
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export function BotonOpcion({ activo = false, onClick, variante = "normal", dashed = false, children }) {
  const grande = variante === "grande";
  // Color del borde: accent si está seleccionado; el walk-in (dashed) usa un trazo
  // oscuro (ink) para diferenciarse de los turnos reales, que llevan hairline claro.
  const colorBorde = activo ? theme.accent : dashed ? theme.ink : theme.hairline;
  return (
    <button
      className="om-opcion"
      onClick={onClick}
      style={{
        // flex-basis: en las grillas (flex wrap) los botones no crecen y mantienen
        // ~240px, así la última fila incompleta queda centrada. En `gridDos` (CSS
        // grid) estas props se ignoran y el card llena su columna.
        flex: "0 1 240px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: grande ? 14 : 8,
        minHeight: grande ? 180 : 120,
        padding: grande ? "32px 20px" : "22px 16px",
        borderRadius: theme.radius,
        border: `1.5px ${dashed ? "dashed" : "solid"} ${colorBorde}`,
        background: activo ? theme.accentSoft : theme.surface,
        color: activo ? theme.accent : theme.ink,
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: 19,
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}

// ─── CampoTexto ─────────────────────────────────────────────────────────────────
/**
 * CampoTexto
 * Textarea controlado con el lenguaje visual de `Field` (border hairline, focus
 * ring indigo). No existe un primitivo textarea; se mantiene en el wizard.
 *
 * @param {Object} props
 * @param {string} props.value
 * @param {Function} props.onChange  — recibe el string nuevo
 * @param {string} [props.placeholder]
 * @param {number} [props.rows=5]
 * @param {boolean} [props.autoFocus=false]
 * @returns {JSX.Element}
 */
export function CampoTexto({ value, onChange, placeholder, rows = 5, autoFocus = false }) {
  const [focus, setFocus] = useState(false);
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      autoFocus={autoFocus}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: "100%",
        padding: "18px 20px",
        background: theme.surface,
        border: `1.5px solid ${focus ? theme.accent : theme.hairline}`,
        borderRadius: theme.radius,
        fontFamily: theme.body,
        fontSize: 19,
        color: theme.ink,
        resize: "none",
        outline: "none",
        lineHeight: 1.5,
        boxShadow: focus ? `0 0 0 3px ${theme.accent}26` : "none",
        transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
        boxSizing: "border-box",
      }}
    />
  );
}

// ─── CampoMonto ─────────────────────────────────────────────────────────────────
/**
 * CampoMonto
 * Input numérico grande ($). Usa type="text" + inputMode="numeric" + filtro `\D`
 * (abre el numpad en iPad sin los efectos colaterales de type="number").
 *
 * @param {Object} props
 * @param {string} props.value      — solo dígitos (string)
 * @param {Function} props.onChange — recibe el string ya filtrado
 * @returns {JSX.Element}
 */
export function CampoMonto({ value, onChange }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "20px 28px",
          borderRadius: theme.radiusLg,
          border: `1.5px solid ${focus ? theme.accent : theme.hairline}`,
          background: theme.surface,
          boxShadow: focus ? `0 0 0 3px ${theme.accent}26` : "none",
          transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
        }}
      >
        <span style={{ fontSize: 40, fontWeight: theme.weightRegular, color: theme.muted }}>$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder="0"
          autoFocus
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: 280,
            border: "none",
            outline: "none",
            background: "transparent",
            textAlign: "center",
            fontFamily: theme.body,
            fontSize: 56,
            fontWeight: theme.weightHeading,
            color: theme.ink,
            letterSpacing: "-0.02em",
          }}
        />
      </div>
    </div>
  );
}

// ─── FilaResumen ────────────────────────────────────────────────────────────────
/**
 * FilaResumen
 * Fila label/valor del resumen, dimensionada para el kiosko (más grande que el
 * primitivo `SummaryRow`, que es de densidad admin).
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {string|React.ReactNode} props.value
 * @param {boolean} [props.ultima=false] — si true, no dibuja el separador inferior
 * @returns {JSX.Element}
 */
export function FilaResumen({ label, value, ultima = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 16,
        padding: "16px 0",
        borderBottom: ultima ? "none" : `1px solid ${theme.hairline}`,
      }}
    >
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: 13,
          fontWeight: theme.weightMedium,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: theme.muted,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: theme.body,
          fontSize: 18,
          fontWeight: theme.weightMedium,
          color: theme.ink,
          textAlign: "right",
          minWidth: 0,
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── FilaTotal ──────────────────────────────────────────────────────────────────
/**
 * FilaTotal
 * Fila de total del resumen: line indigo arriba (ancla la mirada) + monto en el
 * color semántico (accent para ingreso, danger para egreso).
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {string} props.value — monto ya formateado
 * @param {string} [props.color=theme.accent] — color del monto
 * @returns {JSX.Element}
 */
export function FilaTotal({ label, value, color = theme.accent }) {
  return (
    <div style={styles.totalRow}>
      <span style={styles.totalLabel}>{label}</span>
      <span style={{ ...styles.totalValor, color }}>{value}</span>
    </div>
  );
}

// ─── PantallaExito ──────────────────────────────────────────────────────────────
/**
 * PantallaExito
 * Confirmación visual tras guardar: checkmark Lucide en accent (animación
 * funcional `om-pop`) + monto en el color semántico del flujo. Acepta `children`
 * para contenido extra (ej. el recordatorio de stock del gasto).
 *
 * @param {Object} props
 * @param {string|null} [props.imagenLocal]
 * @param {string} props.titulo      — ej. "¡Gasto registrado!"
 * @param {number} props.monto       — monto a mostrar (se formatea con fmtPesos)
 * @param {string} [props.montoColor=theme.accent] — color del monto
 * @param {React.ReactNode} [props.children] — contenido extra bajo el monto
 * @returns {JSX.Element}
 */
export function PantallaExito({ imagenLocal, titulo, monto, montoColor = theme.accent, children }) {
  return (
    <FondoLocal imagenLocal={imagenLocal}>
      <div style={styles.exitoPanel}>
        <CheckCircle2
          size={72}
          strokeWidth={1.75}
          color={theme.accent}
          style={{ animation: "om-pop 0.4s ease" }}
        />
        <p style={styles.exitoTexto}>{titulo}</p>
        <p style={{ ...styles.exitoMonto, color: montoColor }}>{fmtPesos(monto)}</p>
        {children}
      </div>
    </FondoLocal>
  );
}

// ─── Estilos de layout reusables por los flujos ──────────────────────────────────
// Lo que cada flujo compone dentro del PanelWizard (grillas de opciones, botón
// grande, card de resumen). Se exporta para no redefinirlo en los 3 archivos.
export const wizardStyles = {
  // Grilla de opciones: flex wrap centrado (la última fila incompleta queda centrada).
  gridOpciones: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  // Grilla de 2 columnas (forma de pago, Sí/No de propina).
  gridDos: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  mpLogo: {
    height: 52,
    width: "auto",
    objectFit: "contain",
  },
  // Botón grande (override del primitivo Button para superficie kiosko).
  btnGrande: {
    padding: "18px 24px",
    fontSize: 18,
    fontWeight: theme.weightHeading,
  },
  // Card de resumen.
  resumenCard: {
    display: "flex",
    flexDirection: "column",
    background: theme.surfaceAlt,
    borderRadius: theme.radiusLg,
    border: `1px solid ${theme.hairline}`,
    padding: "8px 28px",
  },
  errorTexto: {
    color: theme.danger,
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    textAlign: "center",
    margin: 0,
  },
};

// ─── Estilos internos del wizard (PanelWizard / total / éxito) ────────────────────
const styles = {
  panel: {
    position: "relative",
    zIndex: 1,
    // Panel grande con la foto del local (FondoLocal) asomando como marco (~36px).
    width: "calc(100vw - 72px)",
    height: "calc(100vh - 72px)",
    background: theme.surface,
    borderRadius: theme.radiusLg,
    border: `1px solid ${theme.hairline}`,
    boxShadow: theme.shadowMd,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  progressTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: theme.accentSoft,
  },
  progressFill: {
    height: "100%",
    background: theme.accent,
    transition: "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  panelHeader: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 16,
    padding: "20px 28px",
    flexShrink: 0,
    borderBottom: `4px solid ${theme.accent}`,
  },
  btnVolver: {
    justifySelf: "start",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: theme.radius,
    border: `1px solid ${theme.hairline}`,
    background: theme.surface,
    color: theme.inkSoft,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  indicadorPaso: {
    justifySelf: "end",
    fontFamily: theme.mono,
    fontSize: theme.sizeMicro,
    fontWeight: theme.weightMedium,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.muted,
    whiteSpace: "nowrap",
  },
  pasoBody: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "24px 40px 40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    animation: "om-fade 0.18s ease",
  },
  // Contenido centrado. `margin: auto 0` lo centra verticalmente cuando sobra
  // espacio y, a diferencia de justify-content:center, no recorta al hacer scroll
  // si el contenido excede el alto. El maxWidth lo fija PanelWizard por paso.
  pasoInner: {
    width: "100%",
    margin: "auto 0",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  tituloArea: {
    textAlign: "center",
    minWidth: 0,
  },
  titulo: {
    fontFamily: theme.body,
    fontSize: theme.sizeTitle,
    fontWeight: theme.weightHeading,
    color: theme.ink,
    letterSpacing: "-0.01em",
    margin: 0,
  },
  subtitulo: {
    fontFamily: theme.body,
    fontSize: 15,
    color: theme.muted,
    margin: "4px 0 0",
  },
  contenido: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 16,
    padding: "20px 0 10px",
    marginTop: 6,
    borderTop: `2px solid ${theme.accent}`,
  },
  totalLabel: {
    fontFamily: theme.body,
    fontSize: 22,
    fontWeight: theme.weightHeading,
    color: theme.ink,
  },
  totalValor: {
    fontFamily: theme.body,
    fontSize: 32,
    fontWeight: theme.weightHeading,
    fontVariantNumeric: "tabular-nums",
  },
  exitoPanel: {
    position: "relative",
    zIndex: 1,
    width: "min(460px, 92vw)",
    background: theme.surface,
    borderRadius: theme.radiusLg,
    border: `1px solid ${theme.hairline}`,
    boxShadow: theme.shadowMd,
    padding: "40px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  exitoTexto: {
    fontFamily: theme.body,
    fontSize: theme.sizeHeading,
    fontWeight: theme.weightMedium,
    color: theme.inkSoft,
    margin: "8px 0 0",
  },
  exitoMonto: {
    fontFamily: theme.body,
    fontSize: 48,
    fontWeight: theme.weightHeading,
    letterSpacing: "-0.02em",
    margin: 0,
    fontVariantNumeric: "tabular-nums",
  },
};
