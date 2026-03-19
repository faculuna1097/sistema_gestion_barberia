// MainScreen.jsx
// Pantalla principal del modo operativo — siempre visible en el iPad del mostrador.
// Diseñada para iPad en landscape (1024x768+). Sin login, acceso directo.

import { useState } from "react";
// TODO: la imagen debe venir de la base de datos o ser configurable, no hardcodeada. Por ahora se importa directamente.
import logoKingsai from "../assets/logo_kingsai_graffiti.jpeg";

// ─── Íconos SVG inline ────────────────────────────────────────────────────────
// Solo se mantienen los íconos de los botones de esquina (Spotify y candado).
// Los botones principales usan emojis directamente.

const LockIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const SpotifyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MainScreen({
  onNuevoCorte,   // Función a llamar al presionar "Ingresar Corte"
  onNuevaVenta,   // Función a llamar al presionar "Ingresar Venta"
  onNuevoGasto,   // Función a llamar al presionar "Ingresar Gasto"
  onAdminAccess,  // Función a llamar al presionar el candado
  onSpotify,      // Función a llamar al presionar el ícono de Spotify
}) {
  // Estado para el feedback visual al presionar un botón (efecto de "presionado")
  const [pressed, setPressed] = useState(null);

  /**
   * handlePress — maneja el tap táctil con feedback visual y ejecuta la acción.
   * @param {string} key - Identificador del botón presionado
   * @param {function} action - Función a ejecutar después del feedback
   */
  const handlePress = (key, action) => {
    setPressed(key);
    setTimeout(() => {
      setPressed(null);
      if (action) action();
    }, 150);
  };

  return (
    // Contenedor raíz — ocupa toda la pantalla, fondo blanco
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* ── Línea decorativa superior ─────────────────────────────────────── */}
      <div style={styles.bgAccentTop} />
      <div style={styles.bgAccentBottom} />

      {/* ── Contenido central ─────────────────────────────────────────────── */}
      <div style={styles.centerContent}>

        {/* Logo de la barbería */}
        <div style={styles.logoArea}>
          <img
            src={logoKingsai}
            alt="Kingsai Studio"
            style={styles.logoImage}
          />
        </div>

        {/* Separador fino */}
        <div style={styles.divider} />

        {/* ── Fila de botones principales (Corte + Venta) ───────────────── */}
        <div style={styles.primaryButtonRow}>

          {/* INGRESAR CORTE — verde oliva */}
          <button
            style={{
              ...styles.primaryButton,
              ...styles.greenButton,
              ...(pressed === "corte" ? styles.buttonPressed : {}),
            }}
            onPointerDown={() => handlePress("corte", onNuevoCorte)}
            aria-label="Ingresar nuevo corte"
          >
            <span style={styles.emojiIcon}>💈</span>
            <span style={styles.buttonLabel}>Ingresar Corte</span>
          </button>

          {/* INGRESAR VENTA — verde oliva */}
          <button
            style={{
              ...styles.primaryButton,
              ...styles.greenButton,
              ...(pressed === "venta" ? styles.buttonPressed : {}),
            }}
            onPointerDown={() => handlePress("venta", onNuevaVenta)}
            aria-label="Ingresar nueva venta"
          >
            <span style={styles.emojiIcon}>🥤</span>
            <span style={styles.buttonLabel}>Ingresar Venta</span>
          </button>

        </div>

        {/* ── Botón Gasto — rojo ladrillo, ancho completo ───────────────── */}
        <button
          style={{
            ...styles.secondaryButton,
            ...styles.redButton,
            ...(pressed === "gasto" ? styles.buttonPressed : {}),
          }}
          onPointerDown={() => handlePress("gasto", onNuevoGasto)}
          aria-label="Ingresar nuevo gasto"
        >
          <span style={styles.emojiIcon}>💰</span>
          <span style={styles.buttonLabel}>Ingresar Gasto</span>
        </button>

      </div>

      {/* ── Botón Spotify — esquina inferior izquierda ────────────────────── */}
      <button
        style={{
          ...styles.cornerButton,
          ...styles.spotifyButton,
          bottom: 28,
          left: 32,
          ...(pressed === "spotify" ? styles.cornerButtonPressed : {}),
        }}
        onPointerDown={() => handlePress("spotify", onSpotify)}
        aria-label="Abrir Spotify"
        title="Spotify"
      >
        <SpotifyIcon />
      </button>

      {/* ── Botón Admin — esquina inferior derecha ───────────────────────── */}
      <button
        style={{
          ...styles.cornerButton,
          ...styles.adminButton,
          bottom: 28,
          right: 32,
          ...(pressed === "admin" ? styles.cornerButtonPressed : {}),
        }}
        onPointerDown={() => handlePress("admin", onAdminAccess)}
        aria-label="Acceder al panel de administrador"
        title="Panel administrador"
      >
        <LockIcon />
      </button>

    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = {

  // Línea decorativa superior — degradado oliva
  bgAccentTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    background: "linear-gradient(90deg, #4a6741 0%, #7a9e6e 50%, #4a6741 100%)",
  },

  // Línea decorativa inferior
  bgAccentBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "2px",
    backgroundColor: "#f0f0f0",
  },

  // Contenedor central — paddingBottom desplaza el bloque hacia arriba
  centerContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2.5vh",
    width: "100%",
    maxWidth: "820px",
    padding: "0 5vw",
    paddingBottom: "6vh",
  },

  // Área del logo
  logoArea: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "4px",
  },

  // Imagen del logo
  logoImage: {
    maxHeight: "310px",
    maxWidth: "720px",
    objectFit: "contain",
    objectPosition: "center top",
  },

  // Separador fino entre logo y botones
  divider: {
    width: "48px",
    height: "2px",
    backgroundColor: "#e8e8e8",
    borderRadius: "2px",
  },

  // Fila con los dos botones principales
  primaryButtonRow: {
    display: "flex",
    flexDirection: "row",
    gap: "2vw",
    width: "100%",
  },

  // Estilo base de los botones principales (Corte y Venta)
  primaryButton: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1.5vh",
    padding: "4vh 3vw",
    borderRadius: "20px",
    border: "none",
    cursor: "pointer",
    transition: "transform 0.1s ease, box-shadow 0.1s ease",
    minHeight: "22vh",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTapHighlightColor: "transparent",
  },

  // Botón Gasto — ancho completo, dirección horizontal
  secondaryButton: {
    width: "100%",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "1.5vw",
    padding: "3vh 3vw",
    borderRadius: "20px",
    border: "none",
    cursor: "pointer",
    transition: "transform 0.1s ease, box-shadow 0.1s ease",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTapHighlightColor: "transparent",
  },

  // Verde oliva — Corte y Venta
  greenButton: {
    backgroundColor: "#4a6741",
    color: "#ffffff",
    boxShadow: "0 4px 20px rgba(74, 103, 65, 0.28)",
  },

  // Rojo ladrillo — Gasto
  redButton: {
    backgroundColor: "#b5451b",
    color: "#ffffff",
    boxShadow: "0 4px 20px rgba(181, 69, 27, 0.25)",
  },

  // Feedback visual al presionar
  buttonPressed: {
    transform: "scale(0.97)",
    boxShadow: "none",
    opacity: 0.92,
  },

  // Emoji dentro del botón
  emojiIcon: {
    fontSize: "clamp(28px, 3.5vw, 42px)",
    lineHeight: 1,
  },

  // Texto del botón
  buttonLabel: {
    fontSize: "clamp(16px, 2.2vw, 22px)",
    fontWeight: "600",
    letterSpacing: "0.02em",
    lineHeight: 1,
  },

  // Botones de esquina (Spotify y Admin)
  cornerButton: {
    position: "absolute",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    padding: "1.8vh 2vw",
    borderRadius: "40px",
    border: "1.5px solid #e8e8e8",
    backgroundColor: "#ffffff",
    cursor: "pointer",
    transition: "background-color 0.15s ease, border-color 0.15s ease",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTapHighlightColor: "transparent",
  },

  // Spotify — verde Spotify
  spotifyButton: {
    color: "#1DB954",
  },

  // Admin — gris oscuro
  adminButton: {
    color: "#444444",
  },

  // Feedback presionado en botones de esquina
  cornerButtonPressed: {
    backgroundColor: "#f5f5f5",
    borderColor: "#d0d0d0",
  },
};
