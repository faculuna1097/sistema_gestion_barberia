// /frontend/src/screens/flows/FlujoVenta.jsx
// Flujo para registrar una nueva venta. 4 pasos.
// Efectos UX implementados:
//   (A) PressButton   — scale-down sutil al tocar, spring-back al soltar
//   (B) BarraProgreso — barra verde animada que avanza con cada paso
//   (C) navigate()    — transición slide + fade entre pasos (3 fases: salida → snap → entrada)
//   (D) PantallaExito — checkmark SVG animado + monto destacado

import { useState, useRef, useEffect } from "react";
import { registrarVenta } from "../../services/api";

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
const PantallaExito = ({ montoTotal }) => {
  const [circleDrawn, setCircleDrawn] = useState(false);
  const [checkDrawn,  setCheckDrawn]  = useState(false);

  useEffect(() => {
    console.log('[flujoVenta] PantallaExito — iniciando animaciones | total:', montoTotal);
    const t1 = setTimeout(() => setCircleDrawn(true), 60);
    const t2 = setTimeout(() => setCheckDrawn(true),  520);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const CIRCLE_LEN = 214;
  const CHECK_LEN  = 52;

  return (
    <div style={{ ...styles.pantallaCentrada, position: "relative" }}>
      <BarraProgreso paso={4} total={4} />

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

      <p style={styles.exitoTexto}>¡Venta registrada!</p>
      <p style={styles.exitoMonto}>$ {montoTotal.toLocaleString("es-AR")}</p>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FlujoVenta({ onVolver, productos }) {
  console.log('[flujoVenta] montado — productos:', productos.length);

  const [paso, setPaso] = useState(1);

  // ── (C) Estado de animación slide ───────────────────────────────────────────
  const [slideStyle,   setSlideStyle]   = useState({});
  const navigatingRef = useRef(false);

  // ── Estado del formulario ────────────────────────────────────────────────────
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidad,   setCantidad]   = useState(1);
  const [formaPago,  setFormaPago]  = useState(null);
  const [enviando,   setEnviando]   = useState(false);
  const [error,      setError]      = useState(null);
  const [exito,      setExito]      = useState(false);

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const montoTotal = productoSeleccionado
    ? Number(productoSeleccionado.precio) * cantidad
    : 0;

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
      console.log('[flujoVenta] retroceder — volviendo a pantalla principal');
      onVolver();
      return;
    }
    console.log('[flujoVenta] retroceder — paso:', paso, '→', paso - 1);
    navigate(paso - 1, -1);
  };

  // ── Envío ───────────────────────────────────────────────────────────────────
  const confirmarVenta = async () => {
    const payload = {
      producto_id:     productoSeleccionado.id,
      cantidad,
      precio_unitario: productoSeleccionado.precio,
      forma_pago:      formaPago,
      usuario_registro: null,
    };
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await registrarVenta(payload);
      console.log('[flujoVenta] confirmarVenta — completado | venta_id:', respuesta.venta_id);
      setExito(true);
      setTimeout(() => {
        console.log('[flujoVenta] confirmarVenta — redirigiendo a pantalla principal');
        onVolver();
      }, 2500);
    } catch (err) {
      console.error('[flujoVenta] Error en confirmarVenta:', err.message);
      setError("Error al guardar la venta. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (exito) {
    console.log('[flujoVenta] exito — monto total:', montoTotal);
    return <PantallaExito montoTotal={montoTotal} />;
  }

  // ─── PASO 1 — Selección de producto ──────────────────────────────────────────
  if (paso === 1) {
    return (
      <PasoLayout paso={1} total={4} titulo="Seleccioná el producto" onVolver={retroceder} slideStyle={slideStyle}>
        <div style={styles.gridOpciones}>
          {productos.map((p) => (
            <PressButton
              key={p.id}
              style={{
                ...styles.btnOpcion,
                ...(productoSeleccionado?.id === p.id ? styles.btnOpcionActivo : {}),
              }}
              onPointerDown={() => {
                console.log('[flujoVenta] paso 1 — producto seleccionado:', p.nombre);
                setProductoSeleccionado(p);
                setCantidad(1);
                avanzar();
              }}
            >
              <span>{p.nombre}</span>
              <span style={styles.precioProducto}>
                $ {Number(p.precio).toLocaleString("es-AR")}
              </span>
            </PressButton>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 2 — Selección de cantidad ──────────────────────────────────────────
  if (paso === 2) {
    return (
      <PasoLayout
        paso={2} total={4}
        titulo="¿Cuántas unidades?"
        subtitulo={productoSeleccionado?.nombre}
        onVolver={retroceder}
        slideStyle={slideStyle}
      >
        <div style={styles.cantidadContainer}>

          <p style={{
            ...styles.stockDisponible,
            ...(productoSeleccionado?.stock_actual === 0 ? styles.stockAgotado : {}),
          }}>
            {productoSeleccionado?.stock_actual === 0
              ? "Sin stock disponible"
              : `Stock disponible: ${productoSeleccionado?.stock_actual}`}
          </p>

          <div style={styles.cantidadRow}>
            <PressButton
              style={{
                ...styles.btnCantidad,
                ...(cantidad <= 1 ? styles.btnCantidadDeshabilitado : {}),
              }}
              onPointerDown={() => { if (cantidad > 1) setCantidad((c) => c - 1); }}
              disabled={cantidad <= 1}
              aria-label="Restar unidad"
            >
              −
            </PressButton>
            <span style={styles.cantidadValor}>{cantidad}</span>
            <PressButton
              style={{
                ...styles.btnCantidad,
                ...(cantidad >= productoSeleccionado?.stock_actual ? styles.btnCantidadDeshabilitado : {}),
              }}
              onPointerDown={() => { if (cantidad < productoSeleccionado?.stock_actual) setCantidad((c) => c + 1); }}
              disabled={cantidad >= productoSeleccionado?.stock_actual}
              aria-label="Sumar unidad"
            >
              +
            </PressButton>
          </div>

          <p style={styles.cantidadSubtotal}>
            Subtotal: $ {montoTotal.toLocaleString("es-AR")}
          </p>

          <PressButton
            style={{
              ...styles.btnContinuar,
              ...(productoSeleccionado?.stock_actual === 0 ? styles.btnDeshabilitado : {}),
            }}
            onPointerDown={() => {
              console.log('[flujoVenta] paso 2 — cantidad confirmada:', cantidad);
              avanzar();
            }}
            disabled={productoSeleccionado?.stock_actual === 0}
          >
            Continuar
          </PressButton>
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 3 — Forma de pago ───────────────────────────────────────────────────
  if (paso === 3) {
    return (
      <PasoLayout paso={3} total={4} titulo="Seleccioná el medio de pago" onVolver={retroceder} slideStyle={slideStyle}>
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
                console.log('[flujoVenta] paso 3 — forma de pago:', op.key);
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

  // ─── PASO 4 — Resumen y confirmación ─────────────────────────────────────────
  if (paso === 4) {
    console.log('[flujoVenta] paso 4 — resumen | producto:', productoSeleccionado?.nombre,
      '| cantidad:', cantidad, '| total:', montoTotal);
    return (
      <PasoLayout paso={4} total={4} titulo="Confirmá la venta" onVolver={retroceder} slideStyle={slideStyle}>
        <div style={styles.resumenCard}>

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Producto</span>
            <span style={styles.resumenValor}>{productoSeleccionado?.nombre}</span>
          </div>
          <div style={styles.resumenDivider} />

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Precio unitario</span>
            <span style={styles.resumenValor}>
              $ {Number(productoSeleccionado?.precio).toLocaleString("es-AR")}
            </span>
          </div>
          <div style={styles.resumenDivider} />

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Cantidad</span>
            <span style={styles.resumenValor}>{cantidad}</span>
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
            <span style={styles.resumenTotalLabel}>Total</span>
            <span style={styles.resumenTotalValor}>
              $ {montoTotal.toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        {error && <p style={styles.errorTexto}>{error}</p>}

        <PressButton
          style={{
            ...styles.btnConfirmar,
            ...(enviando ? styles.btnDeshabilitado : {}),
          }}
          onPointerDown={confirmarVenta}
          disabled={enviando}
        >
          {enviando ? "Guardando..." : "Confirmar Venta"}
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
  precioProducto: { fontSize: "clamp(13px, 1.4vw, 16px)", fontWeight: "400", color: "#666666" },
  cantidadContainer: { display: "flex", flexDirection: "column", alignItems: "center", gap: "3vh", width: "100%" },
  stockDisponible: { fontSize: "clamp(14px, 1.6vw, 17px)", color: "#888888", margin: 0 },
  stockAgotado: { color: "#c0392b", fontWeight: "600" },
  cantidadRow: { display: "flex", alignItems: "center", gap: "4vw" },
  btnCantidad: {
    width: "72px", height: "72px", borderRadius: "20px",
    border: "2px solid #e8e8e8", backgroundColor: "#fafafa",
    color: "#111111", fontSize: "32px", fontWeight: "300",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "inherit",
  },
  btnCantidadDeshabilitado: { color: "#cccccc", borderColor: "#f0f0f0", cursor: "not-allowed" },
  cantidadValor: { fontSize: "clamp(56px, 8vw, 80px)", fontWeight: "700", color: "#111111", minWidth: "100px", textAlign: "center" },
  cantidadSubtotal: { fontSize: "clamp(16px, 2vw, 20px)", color: "#888888", margin: 0 },
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
  resumenFila: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  resumenLabel: { fontSize: "clamp(14px, 1.5vw, 17px)", color: "#888888" },
  resumenValor: { fontSize: "clamp(15px, 1.6vw, 18px)", color: "#111111", fontWeight: "600" },
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
    color: "#1a7a4a", margin: 0, fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: "-0.02em", lineHeight: 1.1,
  },
  errorTexto: { color: "#c0392b", fontSize: "15px", textAlign: "center", margin: 0 },
  mpLogo: { height: "clamp(34px, 4vw, 62px)", width: "auto", objectFit: "contain" },
  emoji: { fontSize: "clamp(34px, 4vw, 42px)" },
};
