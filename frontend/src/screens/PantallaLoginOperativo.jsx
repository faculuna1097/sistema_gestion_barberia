// /frontend/src/screens/PantallaLoginOperativo.jsx
// Pantalla de login del modo operativo. Es la primera pantalla que ve el iPad
// del local mientras no haya un tokenOperativo válido en localStorage.
// Una vez logueado el operativo, esta pantalla no vuelve a aparecer hasta que:
//   1. Alguien presione el botón de logout en la esquina superior izquierda de MainScreen, o
//   2. El backend devuelva 401 (token expirado a los 30d, o credenciales cambiadas y blacklist a futuro).
//
// Props:
//   onAcceso  — callback(token) tras login exitoso. App.jsx lo usa para
//               actualizar su estado tokenOperativo y navegar a "main".
//   logoUrl   — URL del logo del tenant para mostrarlo arriba (opcional).

import { useState } from "react";
import { loginOperativo } from "../services/api";

// ─── Ícono de candado (visual, mismo que en login admin) ─────────────────────
const CandadoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// ─── Componente principal ─────────────────────────────────────────────────────
/**
 * Renderiza el formulario de login operativo (usuario + password).
 * Maneja su propio estado local de inputs, error inline y flag de envío.
 * No persiste nada — la persistencia ocurre dentro de loginOperativo() en api.js.
 */
export default function PantallaLoginOperativo({ onAcceso, logoUrl }) {
  console.log('[pantallaLoginOperativo] render — montada');

  const [usuario,  setUsuario]  = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [enviando, setEnviando] = useState(false);

  /**
   * submit
   * Valida que los campos no estén vacíos, llama a loginOperativo y, si todo
   * sale bien, dispara el callback onAcceso para que App.jsx navegue.
   * @param {Event} e - evento de submit del form
   */
  const submit = async (e) => {
    e.preventDefault();
    if (!usuario.trim() || !password) {
      setError("Ingresá usuario y contraseña.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const token = await loginOperativo(usuario.trim(), password);
      console.log('[pantallaLoginOperativo] submit — login exitoso');
      onAcceso(token);
    } catch (err) {
      console.error('[pantallaLoginOperativo] Error en submit:', err.message);
      setError(err.message || "Credenciales inválidas. Intentá de nuevo.");
      setPassword(""); // limpia la password para no exponerla
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={styles.pantalla}>
      <div style={styles.lineaSuperior} />

      <div style={styles.iconoArea}>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo del negocio" style={styles.logoImage} />
        ) : (
          <div style={styles.iconoCirculo}>
            <CandadoIcon />
          </div>
        )}
        <h1 style={styles.titulo}>Modo operativo</h1>
        <p style={{ ...styles.subtitulo, ...(error ? styles.subtituloError : {}) }}>
          {error ? error : "Ingresá las credenciales del local"}
        </p>
      </div>

      <form style={styles.form} onSubmit={submit}>
        <input
          type="text"
          value={usuario}
          onChange={(e) => { setUsuario(e.target.value); setError(null); }}
          placeholder="Usuario"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={styles.input}
          disabled={enviando}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          placeholder="Contraseña"
          autoComplete="current-password"
          style={styles.input}
          disabled={enviando}
        />
        <button
          type="submit"
          style={{
            ...styles.btnIngresar,
            ...(enviando ? styles.btnDeshabilitado : {}),
          }}
          disabled={enviando}
        >
          {enviando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
// Layout consistente con PantallaLoginAdmin: línea verde arriba, área de ícono
// + título + subtítulo, y bloque de formulario centrado. Sin botón de cancelar
// porque esta es la pantalla inicial — no hay a dónde "volver".
const styles = {
  pantalla: {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    position: "relative",
    padding: "0 5vw",
  },
  lineaSuperior: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "4px",
    background: "linear-gradient(90deg, #1a7a4a 0%, #2dba6e 50%, #1a7a4a 100%)",
  },
  iconoArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    marginBottom: "5vh",
  },
  iconoCirculo: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    border: "2px solid #1a7a4a",
    color: "#1a7a4a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    maxHeight: "160px",
    maxWidth: "320px",
    objectFit: "contain",
    marginBottom: "8px",
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
    textAlign: "center",
    maxWidth: "360px",
    lineHeight: 1.4,
  },
  // Cuando hay error, el subtítulo se pinta rojo y más pesado para que se
  // distinga del placeholder gris.
  subtituloError: {
    color: "#e74c3c",
    fontWeight: 500,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "100%",
    maxWidth: "360px",
  },
  input: {
    width: "100%",
    padding: "18px 20px",
    borderRadius: "14px",
    border: "1.5px solid #e0e0e0",
    backgroundColor: "#fafafa",
    fontSize: "17px",
    color: "#111111",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease",
  },
  btnIngresar: {
    marginTop: "8px",
    padding: "18px 0",
    borderRadius: "14px",
    border: "none",
    backgroundColor: "#1a7a4a",
    color: "#ffffff",
    fontSize: "17px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 4px 20px rgba(26, 122, 74, 0.25)",
    transition: "background-color 0.15s ease",
  },
  btnDeshabilitado: {
    backgroundColor: "#cccccc",
    boxShadow: "none",
    cursor: "not-allowed",
  },
};
