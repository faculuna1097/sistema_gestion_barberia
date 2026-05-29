// /frontend/src/screens/MainScreen.jsx
// Home operativa del local — la pantalla que vive todo el día en el iPad del
// mostrador. Naturaleza doble: funcional (el operativo toca Corte/Venta/Gasto
// decenas de veces por día) y ambiental (está a la vista del cliente en el local).
//
// Es una SUPERFICIE ESPECIAL dentro del sistema de diseño: habla el mismo
// idioma visual (tokens, Geist, Lucide, acento indigo) pero rompe a propósito
// dos reglas, de forma consciente y acotada a esta pantalla:
//   1. Fondo = foto del local (tenant_imagen tipo='local') con BLUR + velo.
//      El blur está prohibido en general (glassmorphism, §2 del sistema), pero
//      acá la pantalla es ambiental y el efecto da calidez sin sacrificar
//      contraste (los botones son sólidos y opacos encima).
//   2. Tamaños "kiosko" más grandes que la escala densa del admin — los botones
//      son el elemento principal y deben tocarse rápido desde lejos.
//
// Layout (evolución del original): Corte + Venta arriba (2 columnas) y Gasto
// abajo full-width. Indigo = ingreso (Corte/Venta), rojo = egreso (Gasto),
// mismo lenguaje cromático que las secciones Balances/Ventas/Gastos del admin.
//
// Props:
//   onNuevoCorte / onNuevaVenta / onNuevoGasto — navegan a cada flujo.
//   onAdminAccess     — abre el login admin.
//   onSpotify         — abre Spotify.
//   onLogoutOperativo — cierra la sesión operativa (botón discreto).
//   imagenLogo        — URL del logo (tenant_imagen tipo='logo'). Se muestra en
//                       un círculo en la esquina superior derecha si existe.
//   imagenLocal       — URL de la foto del local (fondo). Fallback: surfaceAlt.
//   bookingUrl        — URL de reservas (si existe, muestra el botón Reservar).

import { Scissors, Package, Receipt, CalendarDays, Lock, LogOut } from "lucide-react";
import { theme } from "../theme/tokens.js";

// ─── A/B de presentación del fondo ──────────────────────────────────────────
// Constantes pensadas para iterar rápido el look del fondo sin tocar el resto.
//   VELO    — 'oscuro' da más calidez/cine; 'claro' mantiene el aire Stripe/Clerk.
//   BLUR_PX — intensidad del desenfoque de la foto del local.
const VELO = "oscuro"; // 'oscuro' | 'claro'
const BLUR_PX = 4;

// Color del velo según la variante elegida.
const VELO_BG =
  VELO === "oscuro" ? "rgba(9, 9, 11, 0.45)" : "rgba(255, 255, 255, 0.62)";

// URL de la app nativa de YouTube. Si la app no está instalada, hacemos
// fallback a la versión web tras un pequeño timeout.
const YOUTUBE_APP_URL = "youtube://";
const YOUTUBE_WEB_URL = "https://www.youtube.com";

// ─── Glyphs de marca ────────────────────────────────────────────────────────
// YouTube y Spotify son marcas: Lucide no tiene sus logos, así que mantenemos
// sus SVG oficiales (excepción justificada). El resto de los íconos son Lucide.

const SpotifyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"
    viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

const YouTubeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="24"
    viewBox="0 0 24 24" fill="#FF0000" aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

/**
 * abrirYouTube
 * Abre la app nativa de YouTube. Si no responde en ~500ms (probablemente porque
 * la app no está instalada), hace fallback a la web.
 * @returns {void}
 */
const abrirYouTube = () => {
  const inicio = Date.now();
  const timer = setTimeout(() => {
    if (Date.now() - inicio < 600) {
      window.open(YOUTUBE_WEB_URL, "_blank");
    }
  }, 500);
  const cancelarFallback = () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", cancelarFallback);
  };
  document.addEventListener("visibilitychange", cancelarFallback);
  window.location.href = YOUTUBE_APP_URL;
};

/**
 * BotonAccion
 * Botón grande de acción principal (Corte / Venta / Gasto). Sólido, con ícono
 * Lucide arriba (layout vertical) o al lado (layout horizontal). El feedback de
 * hover/press se resuelve con la clase scoped `om-action` (ver <style> abajo),
 * no con onPointerDown — la acción dispara siempre en onClick (§4.3).
 *
 * @param {Object}   props
 * @param {Function} props.onClick     — acción al activar el botón
 * @param {React.ReactNode} props.icon — ícono Lucide ya dimensionado
 * @param {string}   props.label       — texto del botón
 * @param {string}   props.bg          — color de fondo (token: accent | danger)
 * @param {string}   props.ariaLabel   — etiqueta accesible
 * @param {boolean}  [props.horizontal] — true = ícono al lado (botón ancho)
 * @returns {JSX.Element}
 */
function BotonAccion({ onClick, icon, label, bg, ariaLabel, horizontal = false }) {
  return (
    <button
      className="om-action"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        flex: horizontal ? "none" : 1,
        width: horizontal ? "100%" : undefined,
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: horizontal ? 16 : 12,
        minHeight: horizontal ? 104 : 208,
        padding: horizontal ? "0 24px" : 24,
        background: bg,
        color: theme.accentInk,
        border: "none",
        borderRadius: theme.radiusLg,
        boxShadow: theme.shadowMd,
        cursor: "pointer",
        fontFamily: theme.body,
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {icon}
      <span style={{
        fontSize: theme.sizeTitle,
        fontWeight: theme.weightHeading,
        letterSpacing: "-0.01em",
        lineHeight: 1,
      }}>
        {label}
      </span>
    </button>
  );
}

/**
 * BotonEsquina
 * Pill de utilidad para las esquinas (YouTube, Spotify, Reservar, Admin,
 * Logout). Fondo sólido claro para resaltar sobre la foto. Feedback vía clase
 * scoped `om-corner`. Acción en onClick.
 *
 * @param {Object}   props
 * @param {Function} props.onClick   — acción al activar
 * @param {React.ReactNode} props.children — glyph/ícono
 * @param {string}   props.ariaLabel — etiqueta accesible
 * @param {string}   [props.color]   — color del ícono (default: inkSoft)
 * @param {Object}   [props.extraStyle] — overrides puntuales (ej. logout discreto)
 * @returns {JSX.Element}
 */
function BotonEsquina({ onClick, children, ariaLabel, color = theme.inkSoft, extraStyle = {} }) {
  return (
    <button
      className="om-corner"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        borderRadius: 999,
        border: `1px solid ${theme.hairline}`,
        background: theme.surface,
        boxShadow: theme.shadowSm,
        color,
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}

/**
 * MainScreen
 * Pantalla principal del modo operativo. Ver cabecera del archivo.
 * @returns {JSX.Element}
 */
export default function MainScreen({
  onNuevoCorte,
  onNuevaVenta,
  onNuevoGasto,
  onAdminAccess,
  onSpotify,
  onLogoutOperativo,
  imagenLogo,
  imagenLocal,
  bookingUrl,
}) {
  return (
    <div style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: theme.body,
      background: imagenLocal ? "transparent" : theme.surfaceAlt,
    }}>
      {/* Estilos scoped: hover/press de los botones. No se pueden expresar
          inline (pseudo-clases), igual que los keyframes — excepción del §4.1.
          Da press instantáneo en iPad sin usar onPointerDown. */}
      <style>{`
        .om-action {
          transition: transform .1s ease, box-shadow .1s ease, filter .12s ease;
        }
        .om-action:hover { filter: brightness(1.07); }
        .om-action:active { transform: scale(.97); box-shadow: none; }
        .om-corner {
          transition: background-color .15s ease, border-color .15s ease, transform .1s ease;
        }
        .om-corner:hover { background-color: ${theme.surfaceAlt}; border-color: ${theme.mutedSoft}; }
        .om-corner:active { transform: scale(.94); }
        .om-logout {
          color: rgba(255, 255, 255, 0.72);
          transition: color .15s ease, transform .1s ease;
        }
        .om-logout:hover { color: rgba(255, 255, 255, 0.95); }
        .om-logout:active { transform: scale(.92); }
      `}</style>

      {/* ── Capa 1: fondo ambiental (foto del local, con blur) ───────────── */}
      {imagenLocal && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url("${imagenLocal}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: `blur(${BLUR_PX}px)`,
              // scale evita que el blur revele bordes transparentes.
              transform: "scale(1.1)",
            }}
          />
          {/* Velo plano sobre la foto para fijar contraste. No es glassmorphism. */}
          <div
            aria-hidden="true"
            style={{ position: "absolute", inset: 0, background: VELO_BG }}
          />
        </>
      )}

      {/* ── Capa 3: acciones (protagonistas) ─────────────────────────────── */}
      <div style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        maxWidth: 880,
        padding: "0 48px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}>
        <div style={{ display: "flex", flexDirection: "row", gap: 24 }}>
          <BotonAccion
            onClick={onNuevoCorte}
            icon={<Scissors size={48} strokeWidth={1.75} />}
            label="Ingresar Corte"
            bg={theme.accent}
            ariaLabel="Ingresar nuevo corte"
          />
          <BotonAccion
            onClick={onNuevaVenta}
            icon={<Package size={48} strokeWidth={1.75} />}
            label="Ingresar Venta"
            bg={theme.accent}
            ariaLabel="Ingresar nueva venta"
          />
        </div>

        <BotonAccion
          onClick={onNuevoGasto}
          icon={<Receipt size={36} strokeWidth={1.75} />}
          label="Ingresar Gasto"
          bg={theme.danger}
          ariaLabel="Ingresar nuevo gasto"
          horizontal
        />
      </div>

      {/* ── Esquina superior izquierda: Logout operativo (discreto) ──────────
          Flecha pelada (sin círculo) — semitransparente sobre el velo oscuro
          para que esté presente pero no llame la atención durante el día. */}
      {onLogoutOperativo && (
        <button
          className="om-logout"
          onClick={onLogoutOperativo}
          aria-label="Cerrar sesión operativo"
          title="Cerrar sesión"
          style={{
            position: "absolute",
            top: 28,
            left: 32,
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 10,
            background: "none",
            border: "none",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <LogOut size={26} strokeWidth={1.75} />
        </button>
      )}

      {/* ── Esquina superior derecha: logo del negocio (círculo) ──────────────
          Marca presente sin competir con los botones. Un poco más grande que
          las pills de esquina (56 → 72). Decorativo: no es interactivo. */}
      {imagenLogo && (
        <div
          style={{
            position: "absolute",
            top: 28,
            right: 32,
            zIndex: 2,
            width: 132,
            height: 132,
            borderRadius: 999,
            overflow: "hidden",
            background: theme.surface,
            border: `1px solid ${theme.hairline}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <img
            src={imagenLogo}
            alt="Logo del negocio"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      )}

      {/* ── Esquina inferior izquierda: YouTube arriba, Spotify abajo ────── */}
      <div style={{
        position: "absolute", bottom: 28, left: 32, zIndex: 2,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <BotonEsquina onClick={abrirYouTube} ariaLabel="YouTube" color="#FF0000">
          <YouTubeIcon />
        </BotonEsquina>
        <BotonEsquina onClick={onSpotify} ariaLabel="Spotify" color="#1DB954">
          <SpotifyIcon />
        </BotonEsquina>
      </div>

      {/* ── Esquina inferior derecha: Reservar arriba, Admin abajo ───────── */}
      <div style={{
        position: "absolute", bottom: 28, right: 32, zIndex: 2,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {bookingUrl && (
          <BotonEsquina
            onClick={() => window.open(bookingUrl, "_blank")}
            ariaLabel="Reservar turno"
            color={theme.accent}
          >
            <CalendarDays size={24} strokeWidth={1.75} />
          </BotonEsquina>
        )}
        <BotonEsquina onClick={onAdminAccess} ariaLabel="Panel administrador">
          <Lock size={24} strokeWidth={1.75} />
        </BotonEsquina>
      </div>
    </div>
  );
}

