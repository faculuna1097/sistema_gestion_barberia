// /frontend/src/screens/flows/FlujoGasto.jsx
// Flujo para registrar un nuevo gasto. 5 pasos.
// Datos recibidos como props desde App.jsx (precargados al arrancar la app).

import { useState } from "react";
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
export default function FlujoGasto({ onVolver, categorias }) {
  console.log('[FlujoGasto] Montado — categorías recibidas:', categorias.length);

  const [paso, setPaso] = useState(1);

  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
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
      console.log('[FlujoGasto] Volviendo a pantalla principal desde paso 1');
      onVolver();
      return;
    }
    console.log('[FlujoGasto] Retrocediendo — paso actual:', paso, '→', paso - 1);
    setPaso((p) => p - 1);
  };

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const montoFinal = monto ? Number(monto) : 0;

  // ── Envío ───────────────────────────────────────────────────────────────────

  /**
   * confirmarGasto — arma el payload y llama al endpoint POST /api/gastos.
   * En caso de éxito muestra la pantalla de confirmación y vuelve al inicio.
   * Si la categoría es Productos, espera 4 segundos para que se lea el recordatorio de stock.
   */
  const confirmarGasto = async () => {
    const payload = {
      categoria_id: categoriaSeleccionada.id,
      descripcion,
      monto: montoFinal,
      forma_pago: formaPago,
      usuario_registro: null, // auth pendiente para fase futura
    };
    console.log('[FlujoGasto] Confirmando gasto — payload:', payload);
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await registrarGasto(payload);
      console.log('[FlujoGasto] Gasto registrado exitosamente — respuesta:', respuesta);
      setExito(true);
      // Si la categoría es Productos se da más tiempo para leer el recordatorio de stock
      const demora = categoriaSeleccionada?.nombre === "Productos" ? 4000 : 2000;
      setTimeout(() => {
        console.log('[FlujoGasto] Redirigiendo a pantalla principal tras éxito');
        onVolver();
      }, demora);
    } catch (err) {
      console.error('[FlujoGasto] Error al registrar el gasto:', err);
      setError("Error al guardar el gasto. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (exito) {
    console.log('[FlujoGasto] Mostrando pantalla de éxito — monto:', montoFinal);
    const esProducto = categoriaSeleccionada?.nombre === "Productos";
    return (
      <div style={styles.pantallaCentrada}>
        <div style={styles.lineaSuperior} />
        <div style={styles.exitoIcono}>✓</div>
        <p style={styles.exitoTexto}>¡Gasto registrado!</p>
        <p style={styles.exitoMonto}>$ {montoFinal.toLocaleString("es-AR")}</p>
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
  }

  // ─── PASO 1 — Selección de categoría ─────────────────────────────────────────
  if (paso === 1) {
    return (
      <PasoLayout paso={1} total={5} titulo="Seleccioná la categoría" onVolver={retroceder}>
        <div style={styles.gridOpciones}>
          {categorias.map((c) => (
            <button
              key={c.id}
              style={{
                ...styles.btnOpcion,
                ...(categoriaSeleccionada?.id === c.id ? styles.btnOpcionActivo : {}),
              }}
              onClick={() => {
                console.log('[FlujoGasto] Categoría seleccionada:', c);
                setCategoriaSeleccionada(c);
                avanzar();
              }}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 2 — Descripción ─────────────────────────────────────────────────────
  if (paso === 2) {
    return (
      <PasoLayout
        paso={2}
        total={5}
        titulo="Describí el gasto"
        subtitulo={categoriaSeleccionada?.nombre}
        onVolver={retroceder}
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
          <button
            style={{
              ...styles.btnContinuar,
              ...(descripcion.trim() === "" ? styles.btnDeshabilitado : {}),
            }}
            onClick={() => {
              console.log('[FlujoGasto] Descripción confirmada:', descripcion);
              avanzar();
            }}
            disabled={descripcion.trim() === ""}
          >
            Continuar
          </button>
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 3 — Monto ───────────────────────────────────────────────────────────
  if (paso === 3) {
    return (
      <PasoLayout paso={3} total={5} titulo="¿Cuánto fue?" onVolver={retroceder}>
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
          <button
            style={{
              ...styles.btnContinuar,
              ...(monto === "" || Number(monto) <= 0 ? styles.btnDeshabilitado : {}),
            }}
            onClick={() => {
              console.log('[FlujoGasto] Monto confirmado:', monto);
              avanzar();
            }}
            disabled={monto === "" || Number(monto) <= 0}
          >
            Continuar
          </button>
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 4 — Forma de pago ───────────────────────────────────────────────────
  if (paso === 4) {
    return (
      <PasoLayout paso={4} total={5} titulo="Seleccioná el medio de pago" onVolver={retroceder}>
        <div style={styles.gridDos}>
          {[
            { key: "efectivo", label: "Efectivo", icono: <span style={styles.emoji}>💵</span> },
            { key: "mercado_pago", label: "Mercado Pago", icono: (
              <img
                src="/mercadopago.png"
                alt="Mercado Pago"
                style={styles.mpLogo}
                onError={(e) => { e.target.style.display = "none"; }}
              />
            )},
          ].map((op) => (
            <button
              key={op.key}
              style={{
                ...styles.btnOpcionGrande,
                ...(formaPago === op.key ? styles.btnOpcionActivo : {}),
              }}
              onClick={() => {
                console.log('[FlujoGasto] Forma de pago seleccionada:', op.key);
                setFormaPago(op.key);
                avanzar();
              }}
            >
              {op.icono}
              <span>{op.label}</span>
            </button>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 5 — Resumen y confirmación ─────────────────────────────────────────
  if (paso === 5) {
    console.log('[FlujoGasto] Mostrando resumen —', {
      categoria: categoriaSeleccionada?.nombre,
      descripcion,
      monto: montoFinal,
      formaPago,
    });
    return (
      <PasoLayout paso={5} total={5} titulo="Confirmá el gasto" onVolver={retroceder}>
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

        <button
          style={{
            ...styles.btnConfirmar,
            ...(enviando ? styles.btnDeshabilitado : {}),
          }}
          onClick={confirmarGasto}
          disabled={enviando}
        >
          {enviando ? "Guardando..." : "Confirmar Gasto"}
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
  exitoIcono: {
    width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "#1a7a4a",
    color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "40px", marginBottom: "24px",
  },
  exitoTexto: { fontSize: "28px", fontWeight: "700", color: "#111111", margin: "0 0 12px", fontFamily: "'DM Sans', Arial, sans-serif" },
  exitoMonto: { fontSize: "22px", fontWeight: "400", color: "#1a7a4a", margin: 0, fontFamily: "'DM Sans', Arial, sans-serif" },
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
  mpLogo: {
    height: "clamp(34px, 4vw, 62px)",
    width: "auto",
    objectFit: "contain",
  },
  emoji: { fontSize: "clamp(34px, 4vw, 42px)" },
};
