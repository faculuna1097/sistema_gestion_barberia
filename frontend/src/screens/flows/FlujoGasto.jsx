// /frontend/src/screens/flows/FlujoGasto.jsx
// Flujo para registrar un nuevo gasto. 5 pasos.
// Efectos UX implementados:
//   (A) PressButton   — scale-down sutil al tocar, spring-back al soltar
//   (B) BarraProgreso — barra verde animada que avanza con cada paso
//   (C) navigate()    — transición slide + fade entre pasos (3 fases: salida → snap → entrada)
//   (D) PantallaExito — checkmark SVG animado + monto destacado
//       Si la categoría es Productos, muestra recordatorio de stock (comportamiento original).

import { useState, useRef, useEffect } from "react";
import { registrarGasto } from "../../services/api";

// ─── CONFIGURACIÓN DE TAMAÑOS ─────────────────────────────────────────────────
const CONFIG = {
  alturaBotonSeleccion: "150px",
  alturaBotonGrande: "30vh",
  paddingBotonSeleccion: "0 2vw",
  tamanoTextoBoton: "clamp(16px, 2vw, 22px)",
};

// ─── Ícono volver ─────────────────────────────────────────────────────────────
const ArrowLeftIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

// ─── (B) Barra de progreso animada ───────────────────────────────────────────
const BarraProgreso = ({ paso, total }) => (
  <div style={{
    position: "absolute", top: 0, left: 0, right: 0, height: "4px",
    backgroundColor: "#e8f5ee",
  }}>
    <div style={{
      height: "100%",
      width: `${(paso / total) * 100}%`,
      background: "linear-gradient(90deg, #1a7a4a, #2dba6e 50%, #1a7a4a)",
      transition: "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
    }} />
  </div>
);

// ─── (A) Botón con press effect sutil ────────────────────────────────────────
const PressButton = ({ style, onPointerDown, children, disabled, ...props }) => {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      style={{
        ...style,
        transform: pressed ? "scale(0.96)" : "scale(1)",
        transition: pressed
          ? "transform 0.06s ease-out"
          : "transform 0.2s cubic-bezier(0.25, 1.1, 0.5, 1)",
        willChange: "transform",
      }}
      onPointerDown={(e) => {
        if (!disabled) setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

// ─── Layout compartido por todos los pasos ────────────────────────────────────
// slideStyle se aplica al pantallaInner para que la barra de progreso quede fija.
const PasoLayout = ({ paso, total, titulo, subtitulo, onVolver, children, slideStyle }) => (
  <div style={styles.pantalla}>
    <BarraProgreso paso={paso} total={total} />
    <div style={{ ...styles.pantallaInner, ...slideStyle }}>
      <div style={styles.header}>
        <button style={styles.btnVolver} onClick={onVolver} aria-label="Volver">
          <ArrowLeftIcon />
        </button>
        <span style={styles.indicadorPaso}>Paso {paso} de {total}</span>
        <div style={{ width: 56 }} />
      </div>
      <div style={styles.tituloArea}>
        <h1 style={styles.titulo}>{titulo}</h1>
        {subtitulo && <p style={styles.subtitulo}>{subtitulo}</p>}
      </div>
      <div style={styles.contenido}>{children}</div>
    </div>
  </div>
);

// ─── (D) Pantalla de éxito animada ───────────────────────────────────────────
// esProducto: si true, muestra el recordatorio de actualizar stock (comportamiento original).
const PantallaExito = ({ montoTotal, esProducto }) => {
  const [circleDrawn, setCircleDrawn] = useState(false);
  const [checkDrawn,  setCheckDrawn]  = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setCircleDrawn(true), 60);
    const t2 = setTimeout(() => setCheckDrawn(true),  520);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const CIRCLE_LEN = 214;
  const CHECK_LEN  = 52;

  return (
    <div style={{ ...styles.pantallaCentrada, position: "relative" }}>
      <BarraProgreso paso={5} total={5} />

      <svg width="80" height="80" viewBox="0 0 80 80" style={{ marginBottom: 24 }}>
        <circle cx="40" cy="40" r="34" fill="none" stroke="#e8f5ee" strokeWidth="3" />
        <circle
          cx="40" cy="40" r="34"
          fill="none" stroke="#1a7a4a" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={CIRCLE_LEN}
          strokeDashoffset={circleDrawn ? 0 : CIRCLE_LEN}
          transform="rotate(-90 40 40)"
          style={{ transition: circleDrawn ? "stroke-dashoffset 0.5s ease-out" : "none" }}
        />
        <path
          d="M24 40 L35 52 L57 28"
          fill="none" stroke="#1a7a4a" strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={CHECK_LEN}
          strokeDashoffset={checkDrawn ? 0 : CHECK_LEN}
          style={{ transition: checkDrawn ? "stroke-dashoffset 0.35s ease-out" : "none" }}
        />
      </svg>

      <p style={styles.exitoTexto}>¡Gasto registrado!</p>
      <p style={styles.exitoMonto}>$ {montoTotal.toLocaleString("es-AR")}</p>

      {esProducto && (
        <div style={styles.recordatorioCard}>
          <span style={styles.recordatorioIcono}>📦</span>
          <p style={styles.recordatorioTexto}>
            Si compraste productos para vender, recordá actualizar el stock en <strong>Gestión → Productos</strong>
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FlujoGasto({ onVolver, categorias }) {
  const [paso, setPaso] = useState(1);

  // ── (C) Estado de animación slide ───────────────────────────────────────────
  const [slideStyle,   setSlideStyle]   = useState({});
  const navigatingRef = useRef(false);

  // ── Estado del formulario ────────────────────────────────────────────────────
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [descripcion, setDescripcion] = useState("");
  const [monto,       setMonto]       = useState("");
  const [formaPago,   setFormaPago]   = useState(null);
  const [enviando,    setEnviando]    = useState(false);
  const [error,       setError]       = useState(null);
  const [exito,       setExito]       = useState(false);

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const montoFinal = monto ? Number(monto) : 0;

  // ── (C) navigate — transición slide en 3 fases ───────────────────────────────
  const navigate = (nuevoPaso, dir) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    setSlideStyle({
      transform:  `translateX(${dir === 1 ? "-30px" : "30px"})`,
      opacity:    0,
      transition: "transform 0.15s ease-in, opacity 0.13s ease-in",
    });

    setTimeout(() => {
      setPaso(nuevoPaso);
      setSlideStyle({
        transform:  `translateX(${dir === 1 ? "30px" : "-30px"})`,
        opacity:    0,
        transition: "none",
      });

      requestAnimationFrame(() => requestAnimationFrame(() => {
        setSlideStyle({
          transform:  "translateX(0)",
          opacity:    1,
          transition: "transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.18s ease-out",
        });
        setTimeout(() => {
          navigatingRef.current = false;
          setSlideStyle({});
        }, 210);
      }));
    }, 150);
  };

  const avanzar = () => navigate(paso + 1, 1);

  const retroceder = () => {
    if (paso === 1) {
      onVolver();
      return;
    }
    navigate(paso - 1, -1);
  };

  // ── Envío ───────────────────────────────────────────────────────────────────
  // Si la categoría es Productos se da más tiempo para leer el recordatorio de stock.
  const confirmarGasto = async () => {
    const payload = {
      categoria_id:     categoriaSeleccionada.id,
      descripcion,
      monto:            montoFinal,
      forma_pago:       formaPago,
      usuario_registro: null,
    };
    setEnviando(true);
    setError(null);
    try {
      await registrarGasto(payload);
      setExito(true);
      const demora = categoriaSeleccionada?.nombre === "Productos" ? 4500 : 2500;
      setTimeout(() => {
        onVolver();
      }, demora);
    } catch (err) {
      console.error('[flujoGasto] Error en confirmarGasto:', err.message);
      setError("Error al guardar el gasto. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (exito) {
    return (
      <PantallaExito
        montoTotal={montoFinal}
        esProducto={categoriaSeleccionada?.nombre === "Productos"}
      />
    );
  }

  // ─── PASO 1 — Selección de categoría ─────────────────────────────────────────
  if (paso === 1) {
    return (
      <PasoLayout paso={1} total={5} titulo="Seleccioná la categoría" onVolver={retroceder} slideStyle={slideStyle}>
        <div style={styles.gridOpciones}>
          {categorias.map((c) => (
            <PressButton
              key={c.id}
              style={{
                ...styles.btnOpcion,
                ...(categoriaSeleccionada?.id === c.id ? styles.btnOpcionActivo : {}),
              }}
              onPointerDown={() => {
                setCategoriaSeleccionada(c);
                avanzar();
              }}
            >
              {c.nombre}
            </PressButton>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 2 — Descripción ─────────────────────────────────────────────────────
  if (paso === 2) {
    return (
      <PasoLayout
        paso={2} total={5}
        titulo="Describí el gasto"
        subtitulo={categoriaSeleccionada?.nombre}
        onVolver={retroceder}
        slideStyle={slideStyle}
      >
        <div style={styles.descripcionContainer}>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Compra de shampoo y acondicionador..."
            style={styles.descripcionInput}
            autoFocus
            rows={4}
          />
          <PressButton
            style={{
              ...styles.btnContinuar,
              ...(descripcion.trim() === "" ? styles.btnDeshabilitado : {}),
            }}
            onPointerDown={() => {
              if (descripcion.trim() === "") return;
              avanzar();
            }}
            disabled={descripcion.trim() === ""}
          >
            Continuar
          </PressButton>
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 3 — Monto ───────────────────────────────────────────────────────────
  if (paso === 3) {
    return (
      <PasoLayout paso={3} total={5} titulo="¿Cuánto fue?" onVolver={retroceder} slideStyle={slideStyle}>
        <div style={styles.montoContainer}>
          <div style={styles.montoInputRow}>
            <span style={styles.montoMoneda}>$</span>
            <input
              type="number"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              style={styles.montoInput}
              autoFocus
            />
          </div>
          <PressButton
            style={{
              ...styles.btnContinuar,
              ...(monto === "" || Number(monto) <= 0 ? styles.btnDeshabilitado : {}),
            }}
            onPointerDown={() => {
              if (monto === "" || Number(monto) <= 0) return;
              avanzar();
            }}
            disabled={monto === "" || Number(monto) <= 0}
          >
            Continuar
          </PressButton>
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 4 — Forma de pago ───────────────────────────────────────────────────
  if (paso === 4) {
    return (
      <PasoLayout paso={4} total={5} titulo="Seleccioná el medio de pago" onVolver={retroceder} slideStyle={slideStyle}>
        <div style={styles.gridDos}>
          {[
            { key: "efectivo",     label: "Efectivo",     icono: <span style={styles.emoji}>💵</span> },
            { key: "mercado_pago", label: "Mercado Pago", icono: (
                <img
                  src="/mercadopago.png"
                  alt="Mercado Pago"
                  style={styles.mpLogo}
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              )
            },
          ].map((op) => (
            <PressButton
              key={op.key}
              style={{
                ...styles.btnOpcionGrande,
                ...(formaPago === op.key ? styles.btnOpcionActivo : {}),
              }}
              onPointerDown={() => {
                setFormaPago(op.key);
                avanzar();
              }}
            >
              {op.icono}
              <span>{op.label}</span>
            </PressButton>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 5 — Resumen y confirmación ─────────────────────────────────────────
  if (paso === 5) {
    return (
      <PasoLayout paso={5} total={5} titulo="Confirmá el gasto" onVolver={retroceder} slideStyle={slideStyle}>
        <div style={styles.resumenCard}>

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Categoría</span>
            <span style={styles.resumenValor}>{categoriaSeleccionada?.nombre}</span>
          </div>
          <div style={styles.resumenDivider} />

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Descripción</span>
            <span style={{ ...styles.resumenValor, ...styles.resumenDescripcion }}>
              {descripcion}
            </span>
          </div>
          <div style={styles.resumenDivider} />

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Pago</span>
            <span style={styles.resumenValor}>
              {formaPago === "efectivo" ? "Efectivo" : "Mercado Pago"}
            </span>
          </div>

          <div style={{ ...styles.resumenDivider, backgroundColor: "#1a7a4a", opacity: 0.3 }} />

          <div style={styles.resumenFila}>
            <span style={styles.resumenTotalLabel}>Monto</span>
            <span style={styles.resumenTotalValor}>
              $ {montoFinal.toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        {error && <p style={styles.errorTexto}>{error}</p>}

        <PressButton
          style={{
            ...styles.btnConfirmar,
            ...(enviando ? styles.btnDeshabilitado : {}),
          }}
          onPointerDown={confirmarGasto}
          disabled={enviando}
        >
          {enviando ? "Guardando..." : "Confirmar Gasto"}
        </PressButton>
      </PasoLayout>
    );
  }
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  pantalla: {
    width: "100vw", height: "100vh", backgroundColor: "#ffffff",
    display: "flex", flexDirection: "column", alignItems: "center",
    overflow: "hidden", fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    position: "relative",
  },
  pantallaInner: {
    width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
    flex: 1, willChange: "transform",
  },
  pantallaCentrada: {
    width: "100vw", height: "100vh", backgroundColor: "#ffffff",
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", fontFamily: "'DM Sans', Arial, sans-serif",
  },
  header: {
    width: "100%", maxWidth: "820px", display: "flex", alignItems: "center",
    justifyContent: "space-between", padding: "28px 5vw 0",
  },
  btnVolver: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "56px", height: "56px", borderRadius: "16px",
    border: "1.5px solid #e8e8e8", backgroundColor: "#ffffff",
    color: "#333333", cursor: "pointer",
  },
  indicadorPaso: { fontSize: "14px", fontWeight: "500", color: "#999999", letterSpacing: "0.04em" },
  tituloArea: { width: "100%", maxWidth: "820px", padding: "3vh 5vw 2vh", textAlign: "center" },
  titulo: { fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: "700", color: "#111111", margin: 0, letterSpacing: "-0.02em" },
  subtitulo: { fontSize: "clamp(14px, 1.6vw, 18px)", color: "#888888", margin: "8px 0 0" },
  contenido: {
    width: "100%", maxWidth: "820px", padding: "0 5vw",
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "2vh", flex: 1, justifyContent: "center",
  },
  gridOpciones: {
    display: "flex", flexWrap: "wrap", justifyContent: "center",
    gap: "16px", width: "100%",
  },
  gridDos: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", width: "100%" },
  btnOpcion: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "8px",
    padding: CONFIG.paddingBotonSeleccion,
    minHeight: CONFIG.alturaBotonSeleccion,
    width: "calc(33.333% - 12px)",
    minWidth: "200px",
    borderRadius: "16px", border: "2px solid #e8e8e8",
    backgroundColor: "#fafafa", color: "#111111",
    fontSize: CONFIG.tamanoTextoBoton, fontWeight: "600",
    cursor: "pointer", fontFamily: "inherit",
  },
  btnOpcionActivo: { border: "2px solid #1a7a4a", backgroundColor: "#f0faf5", color: "#1a7a4a" },
  btnOpcionGrande: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "12px", padding: "4vh 2vw", minHeight: CONFIG.alturaBotonGrande,
    borderRadius: "20px", border: "2px solid #e8e8e8", backgroundColor: "#fafafa",
    color: "#111111", fontSize: CONFIG.tamanoTextoBoton, fontWeight: "600",
    cursor: "pointer", fontFamily: "inherit",
  },
  descripcionContainer: { display: "flex", flexDirection: "column", gap: "3vh", width: "100%" },
  descripcionInput: {
    width: "100%", padding: "2vh 2vw", borderRadius: "16px",
    border: "2px solid #e8e8e8", backgroundColor: "#fafafa",
    fontSize: "clamp(16px, 1.8vw, 20px)", color: "#111111",
    fontFamily: "'DM Sans', Arial, sans-serif", resize: "none",
    outline: "none", lineHeight: "1.5", boxSizing: "border-box",
  },
  montoContainer: { display: "flex", flexDirection: "column", alignItems: "center", gap: "3vh", width: "100%" },
  montoInputRow: { display: "flex", alignItems: "center", gap: "12px" },
  montoMoneda: { fontSize: "clamp(28px, 4vw, 44px)", fontWeight: "300", color: "#333333" },
  montoInput: {
    fontSize: "clamp(36px, 6vw, 64px)", fontWeight: "600", color: "#111111",
    border: "none", borderBottom: "3px solid #1a7a4a", outline: "none",
    width: "200px", textAlign: "center", backgroundColor: "transparent", fontFamily: "inherit",
  },
  btnContinuar: {
    width: "100%", padding: "2.5vh 0", borderRadius: "16px", border: "none",
    backgroundColor: "#1a7a4a", color: "#ffffff", fontSize: "clamp(16px, 1.8vw, 20px)",
    fontWeight: "600", cursor: "pointer", fontFamily: "inherit",
  },
  btnConfirmar: {
    width: "100%", padding: "2.8vh 0", borderRadius: "16px", border: "none",
    backgroundColor: "#1a7a4a", color: "#ffffff", fontSize: "clamp(17px, 2vw, 21px)",
    fontWeight: "700", cursor: "pointer", letterSpacing: "0.03em",
    boxShadow: "0 4px 20px rgba(26, 122, 74, 0.25)", fontFamily: "inherit",
  },
  btnDeshabilitado: { backgroundColor: "#cccccc", boxShadow: "none", cursor: "not-allowed" },
  resumenCard: {
    width: "100%", backgroundColor: "#fafafa", borderRadius: "20px",
    border: "1.5px solid #eeeeee", padding: "3vh 4vw",
    display: "flex", flexDirection: "column", gap: "1.8vh",
  },
  resumenFila: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  resumenLabel: { fontSize: "clamp(14px, 1.5vw, 17px)", color: "#888888", flexShrink: 0 },
  resumenValor: { fontSize: "clamp(15px, 1.6vw, 18px)", color: "#111111", fontWeight: "600", textAlign: "right" },
  resumenDescripcion: { maxWidth: "60%", wordBreak: "break-word" },
  resumenDivider: { height: "1px", backgroundColor: "#eeeeee", width: "100%" },
  resumenTotalLabel: { fontSize: "clamp(17px, 2vw, 21px)", fontWeight: "700", color: "#111111" },
  resumenTotalValor: { fontSize: "clamp(20px, 2.5vw, 28px)", fontWeight: "700", color: "#1a7a4a" },
  exitoTexto: {
    fontSize: "22px", fontWeight: "500", color: "#555555",
    margin: "0 0 12px", fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: "0.01em",
  },
  exitoMonto: {
    fontSize: "clamp(48px, 4vw, 72px)", fontWeight: "700",
    color: "#c0392b", margin: 0, fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: "-0.02em", lineHeight: 1.1,
  },
  recordatorioCard: {
    marginTop: "32px", backgroundColor: "#fff8e1", border: "1.5px solid #f9a825",
    borderRadius: "16px", padding: "20px 28px", maxWidth: "420px",
    display: "flex", alignItems: "flex-start", gap: "14px",
  },
  recordatorioIcono: { fontSize: "28px", flexShrink: 0 },
  recordatorioTexto: {
    fontSize: "clamp(14px, 1.5vw, 16px)", color: "#5d4037", margin: 0,
    lineHeight: "1.5", fontFamily: "'DM Sans', Arial, sans-serif",
  },
  errorTexto: { color: "#c0392b", fontSize: "15px", textAlign: "center", margin: 0 },
  mpLogo: { height: "clamp(34px, 4vw, 62px)", width: "auto", objectFit: "contain" },
  emoji: { fontSize: "clamp(34px, 4vw, 42px)" },
};
