// /frontend/src/screens/flows/FlujoVenta.jsx
// Flujo para registrar una nueva venta. 4 pasos.
// Datos recibidos como props desde App.jsx (precargados al arrancar la app).

import { useState } from "react";
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

// ─── Layout compartido por todos los pasos ────────────────────────────────────
const PasoLayout = ({ paso, total, titulo, subtitulo, onVolver, children }) => (
  <div style={styles.pantalla}>
    <div style={styles.lineaSuperior} />
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
);

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FlujoVenta({ onVolver, productos }) {
  console.log('[FlujoVenta] Montado — productos recibidos:', productos.length);

  const [paso, setPaso] = useState(1);

  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [formaPago, setFormaPago] = useState(null);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  // ── Navegación ──────────────────────────────────────────────────────────────

  const avanzar = () => {
    setPaso((p) => p + 1);
  };

  /**
   * retroceder — vuelve al paso anterior.
   * Si está en paso 1, vuelve a la pantalla principal via onVolver.
   */
  const retroceder = () => {
    if (paso === 1) {
      console.log('[FlujoVenta] Volviendo a pantalla principal desde paso 1');
      onVolver();
      return;
    }
    console.log('[FlujoVenta] Retrocediendo — paso actual:', paso, '→', paso - 1);
    setPaso((p) => p - 1);
  };

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const montoTotal = productoSeleccionado
    ? Number(productoSeleccionado.precio) * cantidad
    : 0;

  // ── Envío ───────────────────────────────────────────────────────────────────

  /**
   * confirmarVenta — arma el payload y llama al endpoint POST /api/ventas.
   * En caso de éxito muestra la pantalla de confirmación y vuelve al inicio.
   */
  const confirmarVenta = async () => {
    const payload = {
      producto_id: productoSeleccionado.id,
      cantidad,
      precio_unitario: productoSeleccionado.precio,
      forma_pago: formaPago,
      usuario_registro: null, // auth pendiente para fase futura
    };
    console.log('[FlujoVenta] Confirmando venta — payload:', payload);
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await registrarVenta(payload);
      console.log('[FlujoVenta] Venta registrada exitosamente — respuesta:', respuesta);
      setExito(true);
      setTimeout(() => {
        console.log('[FlujoVenta] Redirigiendo a pantalla principal tras éxito');
        onVolver();
      }, 2000);
    } catch (err) {
      console.error('[FlujoVenta] Error al registrar la venta:', err);
      setError("Error al guardar la venta. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (exito) {
    console.log('[FlujoVenta] Mostrando pantalla de éxito — monto total:', montoTotal);
    return (
      <div style={styles.pantallaCentrada}>
        <div style={styles.lineaSuperior} />
        <div style={styles.exitoIcono}>✓</div>
        <p style={styles.exitoTexto}>¡Venta registrada!</p>
        <p style={styles.exitoMonto}>$ {montoTotal.toLocaleString("es-AR")}</p>
      </div>
    );
  }

  // ─── PASO 1 — Selección de producto ──────────────────────────────────────────
  if (paso === 1) {
    return (
      <PasoLayout paso={1} total={4} titulo="Seleccioná el producto" onVolver={retroceder}>
        <div style={styles.gridOpciones}>
          {productos.map((p) => (
            <button
              key={p.id}
              style={{
                ...styles.btnOpcion,
                ...(productoSeleccionado?.id === p.id ? styles.btnOpcionActivo : {}),
              }}
              onClick={() => {
                console.log('[FlujoVenta] Producto seleccionado:', p);
                setProductoSeleccionado(p);
                setCantidad(1); // resetear cantidad al cambiar producto
                avanzar();
              }}
            >
              <span>{p.nombre}</span>
              <span style={styles.precioProducto}>
                $ {Number(p.precio).toLocaleString("es-AR")}
              </span>
            </button>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 2 — Selección de cantidad ──────────────────────────────────────────
  if (paso === 2) {
    return (
      <PasoLayout
        paso={2}
        total={4}
        titulo="¿Cuántas unidades?"
        subtitulo={productoSeleccionado?.nombre}
        onVolver={retroceder}
      >
        <div style={styles.cantidadContainer}>
          <div style={styles.cantidadRow}>
            <button
              style={{
                ...styles.btnCantidad,
                ...(cantidad <= 1 ? styles.btnCantidadDeshabilitado : {}),
              }}
              onClick={() => {
                if (cantidad > 1) {
                  console.log('[FlujoVenta] Cantidad decrementada:', cantidad - 1);
                  setCantidad((c) => c - 1);
                }
              }}
              disabled={cantidad <= 1}
              aria-label="Restar unidad"
            >
              −
            </button>
            <span style={styles.cantidadValor}>{cantidad}</span>
            <button
              style={styles.btnCantidad}
              onClick={() => {
                console.log('[FlujoVenta] Cantidad incrementada:', cantidad + 1);
                setCantidad((c) => c + 1);
              }}
              aria-label="Sumar unidad"
            >
              +
            </button>
          </div>

          <p style={styles.cantidadSubtotal}>
            Subtotal: $ {montoTotal.toLocaleString("es-AR")}
          </p>

          <button
            style={styles.btnContinuar}
            onClick={() => {
              console.log('[FlujoVenta] Cantidad confirmada:', cantidad);
              avanzar();
            }}
          >
            Continuar
          </button>
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 3 — Forma de pago ───────────────────────────────────────────────────
  if (paso === 3) {
    return (
      <PasoLayout paso={3} total={4} titulo="Seleccioná el medio de pago" onVolver={retroceder}>
        <div style={styles.gridDos}>
          {[
            { key: "efectivo", label: "Efectivo", emoji: "💵" },
            { key: "mercado_pago", label: "Mercado Pago", emoji: "📱" },
          ].map((op) => (
            <button
              key={op.key}
              style={{
                ...styles.btnOpcionGrande,
                ...(formaPago === op.key ? styles.btnOpcionActivo : {}),
              }}
              onClick={() => {
                console.log('[FlujoVenta] Forma de pago seleccionada:', op.key);
                setFormaPago(op.key);
                avanzar();
              }}
            >
              <span style={styles.emoji}>{op.emoji}</span>
              <span>{op.label}</span>
            </button>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 4 — Resumen y confirmación ─────────────────────────────────────────
  if (paso === 4) {
    console.log('[FlujoVenta] Mostrando resumen —', {
      producto: productoSeleccionado?.nombre,
      precio_unitario: productoSeleccionado?.precio,
      cantidad,
      formaPago,
      montoTotal,
    });
    return (
      <PasoLayout paso={4} total={4} titulo="Confirmá la venta" onVolver={retroceder}>
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

        <button
          style={{
            ...styles.btnConfirmar,
            ...(enviando ? styles.btnDeshabilitado : {}),
          }}
          onClick={confirmarVenta}
          disabled={enviando}
        >
          {enviando ? "Guardando..." : "Confirmar Venta"}
        </button>
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
  pantallaCentrada: {
    width: "100vw", height: "100vh", backgroundColor: "#ffffff",
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", fontFamily: "'DM Sans', Arial, sans-serif",
  },
  lineaSuperior: {
    position: "absolute", top: 0, left: 0, right: 0, height: "4px",
    background: "linear-gradient(90deg, #1a7a4a 0%, #2dba6e 50%, #1a7a4a 100%)",
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
  gridOpciones: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px", width: "100%" },
  gridDos: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", width: "100%" },
  btnOpcion: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "8px", padding: CONFIG.paddingBotonSeleccion, minHeight: CONFIG.alturaBotonSeleccion,
    borderRadius: "16px", border: "2px solid #e8e8e8", backgroundColor: "#fafafa",
    color: "#111111", fontSize: CONFIG.tamanoTextoBoton, fontWeight: "600", cursor: "pointer", fontFamily: "inherit",
  },
  btnOpcionActivo: { border: "2px solid #1a7a4a", backgroundColor: "#f0faf5", color: "#1a7a4a" },
  btnOpcionGrande: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "12px", padding: "4vh 2vw", minHeight: CONFIG.alturaBotonGrande,
    borderRadius: "20px", border: "2px solid #e8e8e8", backgroundColor: "#fafafa",
    color: "#111111", fontSize: CONFIG.tamanoTextoBoton, fontWeight: "600", cursor: "pointer", fontFamily: "inherit",
  },
  emoji: { fontSize: "clamp(28px, 4vw, 40px)" },
  precioProducto: { fontSize: "clamp(13px, 1.4vw, 16px)", fontWeight: "400", color: "#666666" },
  // ── Cantidad ──
  cantidadContainer: { display: "flex", flexDirection: "column", alignItems: "center", gap: "3vh", width: "100%" },
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
  // ── Botones acción ──
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
  // ── Resumen ──
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
  // ── Éxito ──
  exitoIcono: {
    width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "#1a7a4a",
    color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "40px", marginBottom: "24px",
  },
  exitoTexto: { fontSize: "28px", fontWeight: "700", color: "#111111", margin: "0 0 12px", fontFamily: "'DM Sans', Arial, sans-serif" },
  exitoMonto: { fontSize: "22px", fontWeight: "400", color: "#1a7a4a", margin: 0, fontFamily: "'DM Sans', Arial, sans-serif" },
  errorTexto: { color: "#c0392b", fontSize: "15px", textAlign: "center", margin: 0 },
};
