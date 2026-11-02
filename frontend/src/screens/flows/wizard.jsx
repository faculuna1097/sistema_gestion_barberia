// /frontend/src/screens/flows/wizard.jsx
// Piezas compartidas por los 3 flujos operativos del local (Corte/Venta/Gasto).
// Son específicas de la SUPERFICIE KIOSKO-WIZARD (panel claro sobre FondoLocal,
// pasos con barra de progreso, botones táctiles grandes): por eso viven acá, en
// la carpeta de los flujos, y NO en `components/ui/` — mismo criterio que el
// sistema usa para los primitivos wizard-only del turnero (§6.2).
//
// Exporta:
//   PanelWizard    — marco de un paso (FondoLocal + panel + header + progreso);
//                    con `pie`, el modo de los pasos de confirmación.
//   BotonOpcion    — card táctil de selección.
//   CampoTexto     — textarea con el lenguaje visual de Field.
//   CampoMonto     — input numérico grande ($).
//   TarjetaResumen — card gris del resumen: filas con scroll interno + total fijo.
//   FilaResumen    — fila label/valor del resumen (densidad kiosko).
//   FilaTotal      — fila de total (color parametrizable: ink ingreso / danger egreso).
//   PantallaExito  — confirmación con checkmark animado + monto.
// Los estilos de layout que componen los flujos están en wizardStyles.js.

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { theme } from "../../theme/tokens.js";
import { fmtPesos } from "../../utils/formato.js";
import { ALTO_VISIBLE } from "../../utils/pantalla.js";
import { FondoLocal } from "../../components/ui";
import { TAM_KIOSKO } from "./wizardStyles.js";

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
 * @param {React.ReactNode} [props.pie] — pie fijo del paso (ej. error + botón
 *   "Confirmar"). Sin `pie`, el cuerpo del panel scrollea entero (pasos con
 *   grillas o campos). Con `pie`, el cuerpo NO scrollea: el contenido (ej. una
 *   `TarjetaResumen`) se achica al espacio libre y scrollea adentro, y el pie
 *   queda siempre visible debajo. Para los pasos de confirmación.
 * @param {React.ReactNode} props.children   — contenido del paso
 * @returns {JSX.Element}
 */
export function PanelWizard({ paso, total, titulo, subtitulo, onVolver, imagenLocal, maxAncho = 960, pie, children }) {
  const conPie = Boolean(pie);
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

        {/* Cuerpo del paso (se anima en cada cambio de paso). Con pie, el cuerpo
            queda fijo y cada nivel se puede achicar (minHeight 0) hasta que la
            zona con scroll del contenido absorbe lo que no entra. */}
        <div key={paso} style={conPie ? { ...styles.pasoBody, ...styles.pasoBodyFijo } : styles.pasoBody}>
          <div style={{ ...styles.pasoInner, ...(conPie && styles.pasoInnerFijo), maxWidth: maxAncho }}>
            <div style={conPie ? styles.contenidoFijo : styles.contenido}>{children}</div>
            {conPie && <div style={styles.pie}>{pie}</div>}
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
        fontSize: TAM_KIOSKO.opcion,
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
 * @param {number} [props.maxLength] — tope de caracteres; sin él, no hay tope
 * @returns {JSX.Element}
 */
export function CampoTexto({ value, onChange, placeholder, rows = 5, autoFocus = false, maxLength }) {
  const [focus, setFocus] = useState(false);
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      autoFocus={autoFocus}
      maxLength={maxLength}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: "100%",
        padding: "18px 20px",
        background: theme.surface,
        border: `1.5px solid ${focus ? theme.accent : theme.hairline}`,
        borderRadius: theme.radius,
        fontFamily: theme.body,
        fontSize: TAM_KIOSKO.opcion,
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
        <span style={{ fontSize: TAM_KIOSKO.signoMonto, fontWeight: theme.weightRegular, color: theme.muted }}>$</span>
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
            fontSize: TAM_KIOSKO.campoMonto,
            fontWeight: theme.weightHeading,
            color: theme.ink,
            letterSpacing: "-0.02em",
          }}
        />
      </div>
    </div>
  );
}

// ─── TarjetaResumen ─────────────────────────────────────────────────────────────
/**
 * TarjetaResumen
 * Card gris del resumen de un paso de confirmación. Las filas scrollean adentro
 * de la card si no entran; el total queda fijo abajo, siempre a la vista junto
 * al botón de confirmar. Se usa dentro de un `PanelWizard` con `pie`, que es el
 * que le da el alto disponible.
 *
 * Mientras quedan filas por ver abajo, el borde del total muestra una línea y
 * una sombra hacia arriba (`theme.shadowScroll`): en el iPad la barra de scroll
 * se esconde sola y el sistema no usa degradados (§2).
 *
 * @param {Object} props
 * @param {React.ReactNode} props.total — la fila de total (`FilaTotal`)
 * @param {React.ReactNode} props.children — las filas (`FilaResumen`)
 * @returns {JSX.Element}
 */
export function TarjetaResumen({ total, children }) {
  const refFilas = useRef(null);
  const [hayMasAbajo, setHayMasAbajo] = useState(false);

  // ¿Queda contenido sin ver debajo de la zona con scroll? Tolerancia de 1px
  // por el redondeo de scrollTop con zoom o pantallas de alta densidad.
  const medir = useCallback(() => {
    const el = refFilas.current;
    if (!el) return;
    setHayMasAbajo(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
  }, []);

  // Re-medir cuando cambia el alto disponible (resize, rotación del iPad, el
  // mensaje de error que aparece en el pie y le quita espacio).
  useEffect(() => {
    const el = refFilas.current;
    if (!el) return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [medir]);

  return (
    <div style={styles.tarjeta}>
      <div ref={refFilas} onScroll={medir} style={styles.tarjetaFilas}>
        {children}
      </div>
      <div
        style={{
          ...styles.tarjetaTotal,
          boxShadow: hayMasAbajo ? `inset 0 1px 0 ${theme.hairline}, ${theme.shadowScroll}` : "none",
        }}
      >
        {total}
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
        padding: "12px 0",
        borderBottom: ultima ? "none" : `1px solid ${theme.hairline}`,
      }}
    >
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: TAM_KIOSKO.etiquetaResumen,
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
          fontSize: TAM_KIOSKO.valorResumen,
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
 * color semántico (ink para ingreso, danger para egreso; sistema_de_disenio
 * §3.1.1).
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {string} props.value — monto ya formateado
 * @param {string} [props.color=theme.ink] — color del monto
 * @returns {JSX.Element}
 */
export function FilaTotal({ label, value, color = theme.ink }) {
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
 * @param {string} [props.montoColor=theme.ink] — color del monto (ink para
 *   ingreso, danger para egreso)
 * @param {React.ReactNode} [props.children] — contenido extra bajo el monto
 * @returns {JSX.Element}
 */
export function PantallaExito({ imagenLocal, titulo, monto, montoColor = theme.ink, children }) {
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

// ─── AvisoExito ─────────────────────────────────────────────────────────────────
/**
 * AvisoExito
 * Cuadro de aviso en tono warning dentro de una PantallaExito: algo que el
 * operador tiene que leer después de guardar (ej. actualizar el stock, o que el
 * corte quedó sin turno). Quien lo usa da más tiempo antes de volver al inicio.
 *
 * @param {Object} props
 * @param {React.ComponentType} props.Icon — ícono Lucide del aviso
 * @param {React.ReactNode} props.children — texto del aviso
 * @returns {JSX.Element}
 */
export function AvisoExito({ Icon, children }) {
  return (
    <div style={styles.aviso}>
      <Icon size={20} strokeWidth={1.75} color={theme.warning} style={{ flexShrink: 0, marginTop: 2 }} />
      <p style={styles.avisoTexto}>{children}</p>
    </div>
  );
}

// ─── Estilos internos del wizard (PanelWizard / total / éxito) ────────────────────
const styles = {
  panel: {
    position: "relative",
    zIndex: 1,
    // Panel grande con la foto del local (FondoLocal) asomando como marco (~36px).
    width: "calc(100vw - 72px)",
    height: `calc(${ALTO_VISIBLE} - 72px)`,
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
  // Modo con pie: el cuerpo no scrollea (scrollea la zona interna del contenido).
  pasoBodyFijo: {
    overflowY: "hidden",
    paddingBottom: 24,
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
  // Modo con pie: se achica al alto del cuerpo (minHeight 0) en vez de crecer
  // más allá; el gap contenido↔pie es el mismo que había entre card y botón.
  pasoInnerFijo: {
    flex: "0 1 auto",
    minHeight: 0,
    gap: 16,
  },
  contenidoFijo: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    flex: "0 1 auto",
    minHeight: 0,
  },
  pie: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    flexShrink: 0,
  },
  // TarjetaResumen: card que se achica al espacio libre; las filas scrollean y
  // el total queda fijo abajo.
  tarjeta: {
    display: "flex",
    flexDirection: "column",
    flex: "0 1 auto",
    minHeight: 0,
    overflow: "hidden",
    background: theme.surfaceAlt,
    borderRadius: theme.radiusLg,
    border: `1px solid ${theme.hairline}`,
  },
  tarjetaFilas: {
    flex: "0 1 auto",
    minHeight: 0,
    overflowY: "auto",
    padding: "8px 28px 0",
  },
  // position relative: la sombra del total se pinta encima de las filas.
  tarjetaTotal: {
    position: "relative",
    flexShrink: 0,
    padding: "0 28px 8px",
    background: theme.surfaceAlt,
    transition: `box-shadow ${theme.transitionFast}`,
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
    fontSize: TAM_KIOSKO.subtitulo,
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
    padding: "16px 0 8px",
    borderTop: `2px solid ${theme.accent}`,
  },
  totalLabel: {
    fontFamily: theme.body,
    fontSize: TAM_KIOSKO.etiquetaTotal,
    fontWeight: theme.weightHeading,
    color: theme.ink,
  },
  totalValor: {
    fontFamily: theme.body,
    fontSize: TAM_KIOSKO.montoTotal,
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
  aviso: {
    marginTop: 24,
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    background: theme.warningSoft,
    border: `1px solid ${theme.hairline}`,
    borderRadius: theme.radius,
    padding: "14px 16px",
    textAlign: "left",
  },
  avisoTexto: {
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    color: theme.inkSoft,
    margin: 0,
    lineHeight: 1.5,
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
    fontSize: TAM_KIOSKO.montoExito,
    fontWeight: theme.weightHeading,
    letterSpacing: "-0.02em",
    margin: 0,
    fontVariantNumeric: "tabular-nums",
  },
};
