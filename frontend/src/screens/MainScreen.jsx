// MainScreen.jsx
// Pantalla principal del modo operativo — siempre visible en el iPad del mostrador.
// Diseñada para iPad en landscape (1024x768+). Sin login, acceso directo.

import { useState } from "react";

// ─── Íconos SVG inline ────────────────────────────────────────────────────────
// Usamos SVG inline para no depender de librerías externas en esta etapa.

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

const ScissorsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

const ShoppingBagIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const ReceiptIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
    <line x1="8" y1="8" x2="16" y2="8" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="8" y1="16" x2="12" y2="16" />
  </svg>
);

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MainScreen({
  onNuevoCorte,    // Función a llamar al presionar "Ingresar Corte"
  onNuevaVenta,   // Función a llamar al presionar "Ingresar Venta"
  onNuevoGasto,   // Función a llamar al presionar "Ingresar Gasto"
  onAdminAccess,  // Función a llamar al presionar el candado
  onSpotify,      // Función a llamar al presionar el ícono de Spotify
  logoUrl,        // URL del logo de la barbería (opcional, usa placeholder si no se provee)
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
      {/* ── Líneas decorativas de fondo (sutil, no distrae) ──────────────── */}
      <div style={styles.bgAccentTop} />
      <div style={styles.bgAccentBottom} />

      {/* ── Contenido central ─────────────────────────────────────────────── */}
      <div style={styles.centerContent}>

        {/* Logo de la barbería */}
        <div style={styles.logoArea}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo de la barbería" style={styles.logoImage} />
          ) : (
            // Placeholder: se reemplaza cuando llegue el archivo .png
            <div style={styles.logoPlaceholder}>
              <span style={styles.logoPlaceholderText}>KINGSAI STUDIO</span>
            </div>
          )}
        </div>

        {/* Separador fino */}
        <div style={styles.divider} />

        {/* ── Fila de botones principales (Corte + Venta) ───────────────── */}
        <div style={styles.primaryButtonRow}>

          {/* INGRESAR CORTE — verde */}
          <button
            style={{
              ...styles.primaryButton,
              ...styles.greenButton,
              ...(pressed === "corte" ? styles.buttonPressed : {}),
            }}
            onPointerDown={() => handlePress("corte", onNuevoCorte)}
            aria-label="Ingresar nuevo corte"
          >
            <span style={styles.buttonIcon}><ScissorsIcon /></span>
            <span style={styles.buttonLabel}>Ingresar Corte</span>
          </button>

          {/* INGRESAR VENTA — verde */}
          <button
            style={{
              ...styles.primaryButton,
              ...styles.greenButton,
              ...(pressed === "venta" ? styles.buttonPressed : {}),
            }}
            onPointerDown={() => handlePress("venta", onNuevaVenta)}
            aria-label="Ingresar nueva venta"
          >
            <span style={styles.buttonIcon}><ShoppingBagIcon /></span>
            <span style={styles.buttonLabel}>Ingresar Venta</span>
          </button>

        </div>

        {/* ── Botón secundario (Gasto) — rojo, ancho completo ──────────── */}
        <button
          style={{
            ...styles.secondaryButton,
            ...styles.redButton,
            ...(pressed === "gasto" ? styles.buttonPressed : {}),
          }}
          onPointerDown={() => handlePress("gasto", onNuevoGasto)}
          aria-label="Ingresar nuevo gasto"
        >
          <span style={styles.buttonIcon}><ReceiptIcon /></span>
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
        {/* <span style={styles.cornerButtonLabel}>Admin</span> */}
      </button>

    </div>
  );
}

// ─── Estilos (objeto JS — equivalente a CSS inline con estructura) ────────────
// Separamos los estilos del JSX para mantener el componente limpio y legible.
// En React, los estilos inline se escriben como objetos JavaScript.

const styles = {

  // Línea decorativa superior — acento geométrico sutil
  bgAccentTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    background: "linear-gradient(90deg, #1a7a4a 0%, #2dba6e 50%, #1a7a4a 100%)",
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

  // Contenedor del contenido central — apila logo + botones verticalmente
  centerContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2.5vh",
    width: "100%",
    maxWidth: "820px",
    padding: "0 5vw",
  },

  // Área del logo — espacio definido para la imagen horizontal
  logoArea: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "4px",
  },

  // Imagen del logo (cuando se provee el .png)
  logoImage: {
    maxHeight: "90px",
    maxWidth: "380px",
    objectFit: "contain",
  },

  // Placeholder del logo — se ve hasta que llegue el .png real
  logoPlaceholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px 48px",
    border: "1.5px solid #e0e0e0",
    borderRadius: "8px",
  },

  // Texto del placeholder del logo
  logoPlaceholderText: {
    fontSize: "26px",
    fontWeight: "700",
    letterSpacing: "0.12em",
    color: "#111111",
    fontFamily: "'DM Serif Display', 'Georgia', serif",
  },

  // Separador horizontal fino entre logo y botones
  divider: {
    width: "48px",
    height: "2px",
    backgroundColor: "#e8e8e8",
    borderRadius: "2px",
  },

  // Fila horizontal con los dos botones principales (Corte + Venta)
  primaryButtonRow: {
    display: "flex",
    flexDirection: "row",
    gap: "2vw",
    width: "100%",
  },

  // Estilo base compartido por ambos botones principales
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

  // Botón rojo — ancho completo, más bajo en altura que los verdes
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

  // Color verde — aplicado a los botones Corte y Venta
  greenButton: {
    backgroundColor: "#1a7a4a",
    color: "#ffffff",
    boxShadow: "0 4px 20px rgba(26, 122, 74, 0.25)",
  },

  // Color rojo — aplicado al botón Gasto
  redButton: {
    backgroundColor: "#c0392b",
    color: "#ffffff",
    boxShadow: "0 4px 20px rgba(192, 57, 43, 0.22)",
  },

  // Estado "presionado" — feedback táctil visual
  buttonPressed: {
    transform: "scale(0.97)",
    boxShadow: "none",
    opacity: 0.92,
  },

  // Ícono dentro del botón
  buttonIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.9,
  },

  // Texto del botón
  buttonLabel: {
    fontSize: "clamp(16px, 2.2vw, 22px)",
    fontWeight: "600",
    letterSpacing: "0.02em",
    lineHeight: 1,
  },

  // Estilo base de los botones de esquina (Spotify + Admin)
  cornerButton: {
    position: "absolute",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "0px",
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

  // Label del botón de esquina
  cornerButtonLabel: {
    fontSize: "13px",
    fontWeight: "500",
    letterSpacing: "0.03em",
    color: "#555555",
  },

  // Botón de Spotify — color verde de Spotify
  spotifyButton: {
    color: "#1DB954",
  },

  // Botón de Admin — color neutro oscuro
  adminButton: {
    color: "#444444",
  },

  // Estado presionado para botones de esquina
  cornerButtonPressed: {
    backgroundColor: "#f5f5f5",
    borderColor: "#d0d0d0",
  },
};
