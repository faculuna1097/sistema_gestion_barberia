// /frontend/src/screens/PantallaLoginAdmin.jsx
// Pantalla de ingreso de PIN para acceder al Panel de Administrador.
// Muestra un teclado numérico táctil de 4 dígitos.
// Props:
//   onAcceso   — función llamada cuando el PIN es correcto
//   onCancelar — función llamada al presionar "Cancelar" (vuelve a MainScreen)
//   pinCorrecto — string con el PIN admin del tenant (recibido desde App.jsx)

import { useState, useEffect } from "react";

// ─── Ícono de candado ─────────────────────────────────────────────────────────
const CandadoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// ─── Ícono X (borrar) ─────────────────────────────────────────────────────────
const BackspaceIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
    <line x1="18" y1="9" x2="12" y2="15" />
    <line x1="12" y1="9" x2="18" y2="15" />
  </svg>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PantallaLoginAdmin({ onAcceso, onCancelar, pinCorrecto = "1234" }) {
  console.log('[PantallaLoginAdmin] Montada');

  const [pin, setPin] = useState("");
  const [estado, setEstado] = useState("idle"); // "idle" | "error" | "exito"
  const [shake, setShake] = useState(false);

  // ── Agregar dígito ──────────────────────────────────────────────────────────
  const agregarDigito = (digito) => {
    if (pin.length >= 4 || estado === "exito") return;

    const nuevo = pin + digito;
    console.log('[PantallaLoginAdmin] Dígito ingresado — PIN parcial: ' + "*".repeat(nuevo.length));
    setEstado("idle");
    setPin(nuevo);

    // Auto-validar cuando llega a 4 dígitos
    if (nuevo.length === 4) {
      validarPin(nuevo);
    }
  };

  // ── Borrar último dígito ────────────────────────────────────────────────────
  const borrarDigito = () => {
    if (pin.length === 0 || estado === "exito") return;
    setEstado("idle");
    setPin((p) => p.slice(0, -1));
  };

  // ── Validar PIN ─────────────────────────────────────────────────────────────
  const validarPin = (pinIngresado) => {
    console.log('[PantallaLoginAdmin] Validando PIN...');

    if (pinIngresado === pinCorrecto) {
      console.log('[PantallaLoginAdmin] PIN correcto — acceso concedido');
      setEstado("exito");
      setTimeout(() => {
        onAcceso();
      }, 600);
    } else {
      console.log('[PantallaLoginAdmin] PIN incorrecto');
      setEstado("error");
      setShake(true);
      setTimeout(() => {
        setPin("");
        setEstado("idle");
        setShake(false);
      }, 800);
    }
  };

  // ── Teclado físico (opcional, para desarrollo en desktop) ──────────────────
  useEffect(() => {
    const manejarTeclado = (e) => {
      if (e.key >= "0" && e.key <= "9") agregarDigito(e.key);
      if (e.key === "Backspace") borrarDigito();
    };
    window.addEventListener("keydown", manejarTeclado);
    return () => window.removeEventListener("keydown", manejarTeclado);
  }, [pin, estado]);

  // ── Layout del teclado numérico ─────────────────────────────────────────────
  const teclas = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [null, "0", "borrar"],
  ];

  // ── Colores según estado ────────────────────────────────────────────────────
  const colorIndicador =
    estado === "error" ? "#e74c3c" :
    estado === "exito" ? "#1a7a4a" :
    "#1a7a4a";

  return (
    <div style={styles.pantalla}>
      {/* Línea superior verde */}
      <div style={styles.lineaSuperior} />

      {/* Botón cancelar */}
      <div style={styles.headerRow}>
        <button style={styles.btnCancelar} onClick={() => {
          console.log('[PantallaLoginAdmin] Cancelado — volviendo a pantalla principal');
          onCancelar();
        }}>
          Cancelar
        </button>
      </div>

      {/* Ícono y título */}
      <div style={styles.iconoArea}>
        <div style={{ ...styles.iconoCirculo, borderColor: colorIndicador, color: colorIndicador }}>
          <CandadoIcon />
        </div>
        <h1 style={styles.titulo}>Panel de Administrador</h1>
        <p style={styles.subtitulo}>
          {estado === "error" ? "PIN incorrecto. Intentá de nuevo." : "Ingresá tu PIN de 4 dígitos"}
        </p>
      </div>

      {/* Indicadores de dígitos */}
      <div style={{ ...styles.indicadoresRow, ...(shake ? styles.shake : {}) }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              ...styles.indicador,
              backgroundColor:
                estado === "error" ? "#e74c3c" :
                estado === "exito" ? "#1a7a4a" :
                i < pin.length ? "#1a7a4a" : "transparent",
              borderColor:
                estado === "error" ? "#e74c3c" :
                estado === "exito" ? "#1a7a4a" :
                i < pin.length ? "#1a7a4a" : "#cccccc",
              transform: i < pin.length ? "scale(1.1)" : "scale(1)",
              transition: "all 0.15s ease",
            }}
          />
        ))}
      </div>

      {/* Teclado numérico */}
      <div style={styles.teclado}>
        {teclas.map((fila, fi) => (
          <div key={fi} style={styles.filaTeclado}>
            {fila.map((tecla, ti) => {
              if (tecla === null) {
                return <div key={ti} style={styles.teclaVacia} />;
              }
              if (tecla === "borrar") {
                return (
                  <button
                    key={ti}
                    style={styles.teclaBorrar}
                    onClick={borrarDigito}
                    aria-label="Borrar"
                  >
                    <BackspaceIcon />
                  </button>
                );
              }
              return (
                <button
                  key={ti}
                  style={styles.tecla}
                  onClick={() => agregarDigito(tecla)}
                  aria-label={`Tecla ${tecla}`}
                >
                  {tecla}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Animación CSS para shake */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-10px); }
          40%       { transform: translateX(10px); }
          60%       { transform: translateX(-8px); }
          80%       { transform: translateX(8px); }
        }
        .shake-anim {
          animation: shake 0.5s ease;
        }
      `}</style>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  pantalla: {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflow: "hidden",
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    position: "relative",
  },
  lineaSuperior: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "4px",
    background: "linear-gradient(90deg, #1a7a4a 0%, #2dba6e 50%, #1a7a4a 100%)",
  },
  headerRow: {
    width: "100%",
    maxWidth: "480px",
    display: "flex",
    justifyContent: "flex-end",
    padding: "28px 5vw 0",
  },
  btnCancelar: {
    fontSize: "16px",
    fontWeight: "500",
    color: "#888888",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    padding: "8px 0",
  },
  iconoArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    marginTop: "4vh",
    marginBottom: "4vh",
  },
  iconoCirculo: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    border: "2px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.3s ease",
  },
  titulo: {
    fontSize: "clamp(22px, 3vw, 30px)",
    fontWeight: "700",
    color: "#111111",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  subtitulo: {
    fontSize: "clamp(14px, 1.5vw, 16px)",
    color: "#888888",
    margin: 0,
    minHeight: "22px",
    transition: "color 0.2s ease",
  },
  indicadoresRow: {
    display: "flex",
    gap: "20px",
    marginBottom: "5vh",
  },
  shake: {
    animation: "shake 0.5s ease",
  },
  indicador: {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    border: "2px solid",
  },

  // Teclado
  teclado: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "100%",
    maxWidth: "360px",
    padding: "0 5vw",
  },
  filaTeclado: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "16px",
  },
  tecla: {
    height: "clamp(70px, 10vh, 90px)",
    borderRadius: "16px",
    border: "1.5px solid #e8e8e8",
    backgroundColor: "#fafafa",
    color: "#111111",
    fontSize: "clamp(22px, 3vw, 28px)",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background-color 0.1s, transform 0.1s",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
  },
  teclaBorrar: {
    height: "clamp(70px, 10vh, 90px)",
    borderRadius: "16px",
    border: "1.5px solid #e8e8e8",
    backgroundColor: "#fafafa",
    color: "#555555",
    fontSize: "22px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
    transition: "background-color 0.1s",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
  },
  teclaVacia: {
    height: "clamp(70px, 10vh, 90px)",
  },
};
