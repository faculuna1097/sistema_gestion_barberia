// /frontend/src/screens/flows/FlujoCorte.jsx
// Flujo para registrar un nuevo corte. 4 pasos (sin pantalla de confirmación inicial).
// Datos recibidos como props desde App.jsx (precargados al arrancar la app).

import { useState } from "react";
import { registrarCorte } from "../../services/api";

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
export default function FlujoCorte({ onVolver, barberos, servicios }) {
  console.log('[FlujoCorte] Montado — barberos recibidos:', barberos.length, '| servicios recibidos:', servicios.length);

  const [paso, setPaso] = useState(1);

  const [barberoSeleccionado, setBarberoSeleccionado] = useState(null);
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [formaPago, setFormaPago] = useState(null);
  const [tienePropina, setTienePropina] = useState(null);
  const [montoPropina, setMontoPropina] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  // ── Navegación ──────────────────────────────────────────────────────────────

  const avanzar = () => {
    //console.log('[FlujoCorte] Avanzando — paso actual:', paso, '→', paso + 1);
    setPaso((p) => p + 1);
  };

  /**
   * retroceder — vuelve al paso anterior con lógica especial para propina.
   */
  const retroceder = () => {
    if (paso === 1) {
      //console.log('[FlujoCorte] Volviendo a pantalla principal desde paso 1');
      onVolver();
      return;
    }
    if (paso === 5) {
      console.log('[FlujoCorte] Retrocediendo desde resumen — reseteando propina');
      setTienePropina(null);
      setMontoPropina("");
    }
    console.log('[FlujoCorte] Retrocediendo — paso actual:', paso, '→', paso - 1);
    setPaso((p) => p - 1);
  };

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const propinaFinal = tienePropina && montoPropina ? Number(montoPropina) : 0;
  const montoTotal = (servicioSeleccionado ? Number(servicioSeleccionado.precio) : 0) + propinaFinal;

  // ── Envío ───────────────────────────────────────────────────────────────────
  const confirmarCorte = async () => {
    const payload = {
      barbero_id: barberoSeleccionado.id,
      servicios: [{ id: servicioSeleccionado.id, precio: servicioSeleccionado.precio }],
      forma_pago: formaPago,
      propina: propinaFinal,
    };
    //console.log('[FlujoCorte] Confirmando corte — payload:', payload);
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await registrarCorte(payload);
      console.log('[FlujoCorte] Corte registrado exitosamente — respuesta:', respuesta);
      setExito(true);
      setTimeout(() => {
        console.log('[FlujoCorte] Redirigiendo a pantalla principal tras éxito');
        onVolver();
      }, 2000);
    } catch (err) {
      console.error('[FlujoCorte] Error al registrar el corte:', err);
      setError("Error al guardar el corte. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (exito) {
    console.log('[FlujoCorte] Mostrando pantalla de éxito — monto total:', montoTotal);
    return (
      <div style={styles.pantallaCentrada}>
        <div style={styles.lineaSuperior} />
        <div style={styles.exitoIcono}>✓</div>
        <p style={styles.exitoTexto}>¡Corte registrado!</p>
        <p style={styles.exitoMonto}>$ {montoTotal.toLocaleString("es-AR")}</p>
      </div>
    );
  }

  // ─── PASO 1 — Selección de barbero ──────────────────────────────────────────
  if (paso === 1) {
    return (
      <PasoLayout paso={1} total={5} titulo="Seleccione el barbero" onVolver={retroceder}>
        <div style={styles.gridOpciones}>
          {barberos.map((b) => (
            <button
              key={b.id}
              style={{
                ...styles.btnOpcion,
                ...(barberoSeleccionado?.id === b.id ? styles.btnOpcionActivo : {}),
              }}
              onClick={() => {
                console.log('[FlujoCorte] Barbero seleccionado:', b);
                setBarberoSeleccionado(b);
                avanzar();
              }}
            >
              {b.nombre}
            </button>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 2 — Selección de servicio ──────────────────────────────────────────
  if (paso === 2) {
    return (
      <PasoLayout paso={2} total={5} titulo="Seleccione el servicio" onVolver={retroceder}>
        <div style={styles.gridOpciones}>
          {servicios.map((s) => (
            <button
              key={s.id}
              style={{
                ...styles.btnOpcion,
                ...(servicioSeleccionado?.id === s.id ? styles.btnOpcionActivo : {}),
              }}
              onClick={() => {
                console.log('[FlujoCorte] Servicio seleccionado:', s);
                setServicioSeleccionado(s);
                avanzar();
              }}
            >
              <span>{s.nombre}</span>
              <span style={styles.precioServicio}>
                $ {Number(s.precio).toLocaleString("es-AR")}
              </span>
            </button>
          ))}
        </div>
      </PasoLayout>
    );
  }

  // ─── PASO 3 — Forma de pago ──────────────────────────────────────────────────
  if (paso === 3) {
    return (
      <PasoLayout paso={3} total={5} titulo="Seleccione el medio de pago" onVolver={retroceder}>
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
                console.log('[FlujoCorte] Forma de pago seleccionada:', op.key);
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

  // ─── PASO 4 — Propina ────────────────────────────────────────────────────────
  if (paso === 4) {
    return (
      <PasoLayout paso={4} total={5} titulo="¿Propina?" onVolver={retroceder}>
        {tienePropina === null ? (
          <div style={styles.gridDos}>
            <button style={styles.btnOpcionGrande}
              onClick={() => {
                console.log('[FlujoCorte] Propina: SÍ');
                setTienePropina(true);
              }}>
              <span style={styles.emoji}>✅</span>
              <span>Sí</span>
            </button>
            <button style={styles.btnOpcionGrande}
              onClick={() => {
                console.log('[FlujoCorte] Propina: NO — avanzando a resumen');
                setTienePropina(false);
                avanzar();
              }}>
              <span style={styles.emoji}>❌</span>
              <span>No</span>
            </button>
          </div>
        ) : (
          <div style={styles.propinaContainer}>
            <p style={styles.propinaLabel}>Ingresá el monto</p>
            <div style={styles.propinaInputRow}>
              <span style={styles.propinaMoneda}>$</span>
              <input
                type="number"
                min="0"
                value={montoPropina}
                onChange={(e) => {
                  console.log('[FlujoCorte] Monto propina ingresado:', e.target.value);
                  setMontoPropina(e.target.value);
                }}
                placeholder="0"
                style={styles.propinaInput}
                autoFocus
              />
            </div>
            <button
              style={{
                ...styles.btnContinuar,
                ...(montoPropina === "" ? styles.btnDeshabilitado : {}),
              }}
              onClick={() => {
                console.log('[FlujoCorte] Propina confirmada — monto:', montoPropina);
                avanzar();
              }}
              disabled={montoPropina === ""}
            >
              Continuar
            </button>
          </div>
        )}
      </PasoLayout>
    );
  }

  // ─── PASO 5 — Resumen y confirmación ─────────────────────────────────────────
  if (paso === 5) {
    console.log('[FlujoCorte] Mostrando resumen —', {
      barbero: barberoSeleccionado?.nombre,
      servicio: servicioSeleccionado?.nombre,
      precio: servicioSeleccionado?.precio,
      formaPago,
      propina: propinaFinal,
      montoTotal,
    });
    return (
      <PasoLayout paso={5} total={5} titulo="Confirmá el corte" onVolver={retroceder}>
        <div style={styles.resumenCard}>

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Barbero</span>
            <span style={styles.resumenValor}>{barberoSeleccionado?.nombre}</span>
          </div>
          <div style={styles.resumenDivider} />

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Servicio</span>
            <span style={styles.resumenValor}>{servicioSeleccionado?.nombre}</span>
          </div>
          <div style={styles.resumenDivider} />

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Precio</span>
            <span style={styles.resumenValor}>
              $ {Number(servicioSeleccionado?.precio).toLocaleString("es-AR")}
            </span>
          </div>
          <div style={styles.resumenDivider} />

          <div style={styles.resumenFila}>
            <span style={styles.resumenLabel}>Pago</span>
            <span style={styles.resumenValor}>
              {formaPago === "efectivo" ? "Efectivo" : "Mercado Pago"}
            </span>
          </div>

          {propinaFinal > 0 && (
            <>
              <div style={styles.resumenDivider} />
              <div style={styles.resumenFila}>
                <span style={styles.resumenLabel}>Propina</span>
                <span style={styles.resumenValor}>
                  $ {propinaFinal.toLocaleString("es-AR")}
                </span>
              </div>
            </>
          )}

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
          onClick={confirmarCorte}
          disabled={enviando}
        >
          {enviando ? "Guardando..." : "Confirmar Corte"}
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
  precioServicio: { fontSize: "clamp(13px, 1.4vw, 16px)", fontWeight: "400", color: "#666666" },
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
  propinaContainer: { display: "flex", flexDirection: "column", alignItems: "center", gap: "3vh", width: "100%" },
  propinaLabel: { fontSize: "clamp(16px, 2vw, 20px)", color: "#555555", margin: 0 },
  propinaInputRow: { display: "flex", alignItems: "center", gap: "12px" },
  propinaMoneda: { fontSize: "clamp(28px, 4vw, 44px)", fontWeight: "300", color: "#333333" },
  propinaInput: {
    fontSize: "clamp(36px, 6vw, 64px)", fontWeight: "600", color: "#111111",
    border: "none", borderBottom: "3px solid #1a7a4a", outline: "none",
    width: "200px", textAlign: "center", backgroundColor: "transparent", fontFamily: "inherit",
  },
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
  exitoIcono: {
    width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "#1a7a4a",
    color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "40px", marginBottom: "24px",
  },
  exitoTexto: { fontSize: "28px", fontWeight: "700", color: "#111111", margin: "0 0 12px", fontFamily: "'DM Sans', Arial, sans-serif" },
  exitoMonto: { fontSize: "22px", fontWeight: "400", color: "#1a7a4a", margin: 0, fontFamily: "'DM Sans', Arial, sans-serif" },
  errorTexto: { color: "#c0392b", fontSize: "15px", textAlign: "center", margin: 0 },
};