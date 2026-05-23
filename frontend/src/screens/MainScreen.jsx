// MainScreen.jsx
import { useState } from "react";

// URL de la app nativa de YouTube. Si la app no está instalada, hacemos
// fallback a la versión web tras un pequeño timeout.
const YOUTUBE_APP_URL = "youtube://";
const YOUTUBE_WEB_URL = "https://www.youtube.com";

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// Ícono de flecha hacia la izquierda — discreto, indica "salir/atrás".
// Usado en el botón de logout operativo de la esquina superior izquierda.
const LogoutArrowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const SpotifyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"
    viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

// Ícono oficial de YouTube — rectángulo rojo redondeado con play blanco
const YouTubeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="32"
    viewBox="0 0 24 24" fill="#FF0000">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

// Ícono de calendario — genérico, funciona con cualquier plataforma de turnos
const BookingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

/**
 * Abre la app nativa de YouTube. Si no responde en 500ms (probablemente
 * porque la app no está instalada), hace fallback a la web.
 */
const abrirYouTube = () => {
  const inicio = Date.now();

  // Timer de fallback: si la app no toma el control en 500ms, abrir web
  const timer = setTimeout(() => {
    // Si pasaron menos de ~600ms desde el intento, asumimos que la app
    // no estaba instalada (si hubiera abierto, el navegador habría perdido
    // foco y los timers se habrían pausado).
    if (Date.now() - inicio < 600) {
      window.open(YOUTUBE_WEB_URL, '_blank');
    }
  }, 500);

  // Si el usuario vuelve al iPad y la app abrió bien, cancelamos el fallback
  const cancelarFallback = () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', cancelarFallback);
  };
  document.addEventListener('visibilitychange', cancelarFallback);

  // Intentar abrir la app
  window.location.href = YOUTUBE_APP_URL;
};

export default function MainScreen({
  onNuevoCorte,
  onNuevaVenta,
  onNuevoGasto,
  onAdminAccess,
  onSpotify,
  onLogoutOperativo,
  logoUrl,
  bookingUrl,
}) {
  const [pressed, setPressed] = useState(null);

  const handlePress = (key, action) => {
    setPressed(key);
    setTimeout(() => {
      setPressed(null);
      if (action) action();
    }, 150);
  };

  return (
    <div style={{
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
    }}>
      <div style={styles.bgAccentTop} />
      <div style={styles.bgAccentBottom} />

      {/* ── Esquina superior izquierda: Logout operativo (discreto) ──────── */}
      {onLogoutOperativo && (
        <div style={styles.topLeftStack}>
          <button
            style={{
              ...styles.cornerButton,
              ...styles.logoutButton,
              ...(pressed === "logout" ? styles.cornerButtonPressed : {}),
            }}
            onPointerDown={() => handlePress("logout", onLogoutOperativo)}
            aria-label="Cerrar sesión operativo"
            title="Cerrar sesión"
          >
            <LogoutArrowIcon />
          </button>
        </div>
      )}

      <div style={styles.centerContent}>
        {logoUrl && (
          <>
            <div style={styles.logoArea}>
              <img src={logoUrl} alt="Logo del negocio" style={styles.logoImage} />
            </div>
            <div style={styles.divider} />
          </>
        )}

        <div style={styles.primaryButtonRow}>
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

      {/* ── Esquina inferior izquierda: YouTube arriba, Spotify abajo ────── */}
      <div style={styles.bottomLeftStack}>
        <button
          style={{
            ...styles.cornerButton,
            ...(pressed === "youtube" ? styles.cornerButtonPressed : {}),
          }}
          onPointerDown={() => handlePress("youtube", abrirYouTube)}
          aria-label="Abrir YouTube"
          title="YouTube"
        >
          <YouTubeIcon />
        </button>

        <button
          style={{
            ...styles.cornerButton,
            ...styles.spotifyButton,
            ...(pressed === "spotify" ? styles.cornerButtonPressed : {}),
          }}
          onPointerDown={() => handlePress("spotify", onSpotify)}
          aria-label="Abrir Spotify"
          title="Spotify"
        >
          <SpotifyIcon />
        </button>
      </div>

      {/* ── Esquina inferior derecha: Booking arriba, Admin abajo ────────── */}
      <div style={styles.bottomRightStack}>
        {bookingUrl && (
          <button
            style={{
              ...styles.cornerButton,
              ...styles.bookingButton,
              ...(pressed === "booking" ? styles.cornerButtonPressed : {}),
            }}
            onPointerDown={() => handlePress("booking", () => {
              window.open(bookingUrl, "_blank");
            })}
            aria-label="Reservar turno"
            title="Reservar turno"
          >
            <BookingIcon />
          </button>
        )}

        <button
          style={{
            ...styles.cornerButton,
            ...styles.adminButton,
            ...(pressed === "admin" ? styles.cornerButtonPressed : {}),
          }}
          onPointerDown={() => handlePress("admin", onAdminAccess)}
          aria-label="Acceder al panel de administrador"
          title="Panel administrador"
        >
          <LockIcon />
        </button>
      </div>
    </div>
  );
}

const styles = {
  bgAccentTop: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "4px",
    background: "linear-gradient(90deg, #4a6741 0%, #7a9e6e 50%, #4a6741 100%)",
  },
  bgAccentBottom: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: "2px",
    backgroundColor: "#f0f0f0",
  },
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
  logoArea: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "4px",
  },
  logoImage: {
    maxHeight: "310px",
    maxWidth: "720px",
    objectFit: "contain",
    objectPosition: "center top",
  },
  divider: {
    width: "48px",
    height: "2px",
    backgroundColor: "#e8e8e8",
    borderRadius: "2px",
  },
  primaryButtonRow: {
    display: "flex",
    flexDirection: "row",
    gap: "2vw",
    width: "100%",
  },
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
  greenButton: {
    backgroundColor: "#4a6741",
    color: "#ffffff",
    boxShadow: "0 4px 20px rgba(74, 103, 65, 0.28)",
  },
  redButton: {
    backgroundColor: "#b5451b",
    color: "#ffffff",
    boxShadow: "0 4px 20px rgba(181, 69, 27, 0.25)",
  },
  buttonPressed: {
    transform: "scale(0.97)",
    boxShadow: "none",
    opacity: 0.92,
  },
  emojiIcon: {
    fontSize: "clamp(28px, 3.5vw, 42px)",
    lineHeight: 1,
  },
  buttonLabel: {
    fontSize: "clamp(16px, 2.2vw, 26px)",
    fontWeight: "600",
    letterSpacing: "0.02em",
    lineHeight: 1,
  },

  // ── Stacks de las esquinas ───────────────────────────────────────────
  topLeftStack: {
    position: "absolute",
    top: 28,
    left: 32,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
  },
  bottomLeftStack: {
    position: "absolute",
    bottom: 28,
    left: 32,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
  },
  bottomRightStack: {
    position: "absolute",
    bottom: 28,
    right: 32,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 12,
  },

  cornerButton: {
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
  bookingButton: {
    color: "#1a4a7a",
  },
  spotifyButton: {
    color: "#1DB954",
  },
  adminButton: {
    color: "#444444",
  },
  // Botón de logout: muy gris y borde casi invisible — "que se vea poco"
  // para no llamar la atención del operativo durante el día.
  logoutButton: {
    color: "#bbbbbb",
    borderColor: "#f0f0f0",
  },
  cornerButtonPressed: {
    backgroundColor: "#f5f5f5",
    borderColor: "#d0d0d0",
  },
};
