// /frontend/src/screens/PantallaLoginPanel.jsx
// Pantalla de ingreso de PIN para acceder al panel. El login es unificado: el
// backend resuelve el rol (admin o barbero) según el PIN ingresado.
// Tiene teclado numérico táctil + soporte de teclado físico.
// Si la suscripción del tenant está vencida (solo path admin), muestra pantalla
// de acceso suspendido.
//
// Layout: `MarcoAcceso` (components/ui), el marco compartido con el login del
// iPad y la recuperación: la foto del local de fondo y la card centrada (480 px).
// Botón "Cancelar"/"Volver" en la esquina superior izquierda de la card (ghost
// button con flecha).
//
// Debajo del teclado, "¿Olvidaste el PIN de administrador?" cambia el contenido
// de la card por `SolicitudRecuperacion` (F6 de plan_mejoras_operativas.md).
// Mientras se ve, el teclado físico no carga dígitos. No aparece en la pantalla
// de acceso suspendido.
//
// Props:
//   onAcceso     — función llamada con (token, { rol, aviso_pago, barbero }) cuando
//                  el PIN es correcto. El backend resuelve el rol (admin o barbero)
//                  según el PIN; `barbero` ({ id, nombre }) viene solo si rol='barbero'.
//   onCancelar   — función llamada al presionar "Cancelar"/"Volver".
//   imagenLogo   — URL del logo del tenant (de tenant_imagen tipo='logo').
//                  Si no hay, cae a un círculo con el icono Lock.
//   avisoAcceso  — { mensaje, conContacto } | null. Falla de acceso detectada al
//                  abrir el sistema (subdominio que no existe, servidor caído;
//                  ver `problemaDeAcceso`). Se muestra antes de que tipeen nada,
//                  hasta la primera respuesta del login.
//   sesionCerrada — true si se llegó acá porque el backend cerró la sesión del
//                  panel (401: cambió el PIN del admin, el barbero quedó
//                  desactivado o el token venció). La bajada lo dice hasta el
//                  primer intento, así la vuelta al login no parece un error.

import { useState, useEffect, useCallback } from "react";
import { Delete, ArrowLeft } from "lucide-react";
import { theme } from "../theme/tokens.js";
import {
  EmptyState, IconoAlerta, LogoCirculo, ContactoSoporte, MarcoAcceso, EncabezadoAcceso, BotonEnlace,
} from "../components/ui";
import SolicitudRecuperacion from "./SolicitudRecuperacion.jsx";
import { loginPanel } from "../services/api";
import { fallaDeLogin } from "../utils/errores";

const MENSAJE_PIN_INCORRECTO = "PIN incorrecto. Intentá de nuevo.";
const MENSAJE_SESION_CERRADA = "Tu sesión se cerró. Ingresá de nuevo con tu PIN.";

/**
 * BotonCancelarEsquina
 * Botón ghost chico con flecha + label, posicionado en la esquina superior
 * izquierda de la card (absolute). Lo usan tanto la pantalla normal como la
 * bloqueada.
 */
function BotonCancelarEsquina({ label, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 10px',
        background: hover ? theme.surfaceAlt : 'transparent',
        border: 'none',
        color: theme.inkSoft,
        fontFamily: theme.body,
        fontSize: 13,
        fontWeight: theme.weightMedium,
        cursor: 'pointer',
        borderRadius: theme.radius,
        transition: `background ${theme.transitionFast}`,
      }}
    >
      <ArrowLeft size={14} strokeWidth={1.75} />
      {label}
    </button>
  );
}

/**
 * ShellLoginPanel
 * `MarcoAcceso` con la card de 480 y el botón de la esquina. Lo comparten la
 * pantalla normal de ingreso de PIN, la del "¿Olvidaste…?" y la de acceso
 * suspendido.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {Function} [props.onCancelar] - Sin él, no hay botón en la esquina.
 * @param {string} [props.labelCancelar='Cancelar']
 * @param {string|null} [props.imagenLocal]
 * @returns {JSX.Element}
 */
function ShellLoginPanel({ children, onCancelar, labelCancelar = 'Cancelar', imagenLocal }) {
  return (
    <MarcoAcceso
      imagenLocal={imagenLocal}
      maxAncho={480}
      esquina={onCancelar ? <BotonCancelarEsquina label={labelCancelar} onClick={onCancelar} /> : null}
    >
      {children}
    </MarcoAcceso>
  );
}

/**
 * IndicadoresPin
 * Cuatro puntos que representan los dígitos ingresados.
 */
function IndicadoresPin({ pin, estado, shake }) {
  const dotColor = estado === 'error' ? theme.danger : theme.accent;

  return (
    <div
      className={shake ? 'om-shake' : undefined}
      style={{ display: 'flex', gap: 20 }}
    >
      {[0, 1, 2, 3].map((i) => {
        const filled = estado === 'error' || estado === 'exito' || i < pin.length;
        return (
          <div key={i} style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: filled ? dotColor : 'transparent',
            border: `2px solid ${filled ? dotColor : theme.hairline}`,
            transform: filled ? 'scale(1.1)' : 'scale(1)',
            transition: 'all 0.15s ease',
          }} />
        );
      })}
    </div>
  );
}

/**
 * TeclaNum
 * Botón individual del teclado numérico. Hover con useState (12 botones, costo trivial).
 */
function TeclaNum({ children, ariaLabel, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={ariaLabel}
      style={{
        height: 60,
        background: hover ? theme.surfaceAlt : theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        color: theme.ink,
        fontFamily: theme.body,
        fontSize: 22,
        fontWeight: theme.weightMedium,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: `background ${theme.transitionFast}`,
        userSelect: 'none',
      }}
    >
      {children}
    </button>
  );
}

/**
 * PantallaLoginPanel
 * Componente principal. Maneja el flujo de ingreso de PIN, validación y
 * el estado bloqueado por suscripción vencida.
 */
export default function PantallaLoginPanel({ onAcceso, onCancelar, imagenLogo, imagenLocal, avisoAcceso = null, sesionCerrada = false }) {
  const [pin, setPin]             = useState("");
  // "idle" | "error" (PIN incorrecto) | "exito"
  const [estado, setEstado]       = useState("idle");
  const [shake, setShake]         = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  // falla: { mensaje, conContacto } de un login que falló por algo que no es
  // el PIN (subdominio, servidor, rate limit, sin red). Queda visible hasta el
  // próximo dígito.
  const [falla, setFalla]         = useState(null);
  // huboRespuesta: ya se intentó un login, así que el aviso de la carga inicial
  // (avisoAcceso) deja de aplicar: manda lo que respondió el login.
  const [huboRespuesta, setHuboRespuesta] = useState(false);
  // olvido: se está pidiendo el link de recuperación del PIN (la card muestra
  // SolicitudRecuperacion y el teclado físico no carga dígitos).
  const [olvido, setOlvido] = useState(false);

  /**
   * validarPin — envía el PIN al backend. Si vuelve 402 (suscripción vencida)
   * muestra la pantalla bloqueada. Si vuelve 401, muestra el feedback de "PIN
   * incorrecto" (shake) y resetea. Con cualquier otra falla, borra el PIN sin
   * shake (no es culpa de lo que tipeó) y muestra la causa hasta el próximo dígito.
   * @param {string} pinIngresado - PIN de 4 dígitos
   */
  const validarPin = useCallback(async (pinIngresado) => {
    try {
      const { token, rol, aviso_pago, barbero } = await loginPanel(pinIngresado);
      setHuboRespuesta(true);
      setEstado("exito");
      setTimeout(() => onAcceso(token, { rol, aviso_pago, barbero }), 600);
    } catch (err) {
      console.error('[pantallaLoginPanel] Error en validarPin:', err.message, '| status:', err.status);
      setHuboRespuesta(true);
      if (err.bloqueado) {
        setBloqueado(true);
      } else if (err.status !== 401) {
        setPin("");
        setFalla(fallaDeLogin(err, MENSAJE_PIN_INCORRECTO, "No se pudo iniciar sesión. Intentá de nuevo."));
      } else {
        setEstado("error");
        setShake(true);
        setTimeout(() => {
          setPin("");
          setEstado("idle");
          setShake(false);
        }, 800);
      }
    }
  }, [onAcceso]);

  /** agregarDigito — suma un dígito al PIN; al llegar a 4 lo valida. */
  const agregarDigito = useCallback((digito) => {
    setPin((prev) => {
      if (prev.length >= 4 || estado === "exito") return prev;
      const nuevo = prev + digito;
      setEstado("idle");
      setFalla(null);
      if (nuevo.length === 4) validarPin(nuevo);
      return nuevo;
    });
  }, [estado, validarPin]);

  /** borrarDigito — elimina el último dígito del PIN. */
  const borrarDigito = useCallback(() => {
    if (estado === "exito") return;
    setEstado("idle");
    setFalla(null);
    setPin((p) => p.slice(0, -1));
  }, [estado]);

  // Soporte de teclado físico (útil en desktop / iPad con teclado bluetooth).
  useEffect(() => {
    if (olvido) return undefined;
    const manejarTeclado = (e) => {
      if (e.key >= "0" && e.key <= "9") agregarDigito(e.key);
      if (e.key === "Backspace") borrarDigito();
    };
    window.addEventListener("keydown", manejarTeclado);
    return () => window.removeEventListener("keydown", manejarTeclado);
  }, [agregarDigito, borrarDigito, olvido]);

  // ── Pantalla bloqueada (suscripción vencida) ──────────────────────────────
  if (bloqueado) {
    return (
      <ShellLoginPanel onCancelar={onCancelar} labelCancelar="Volver" imagenLocal={imagenLocal}>
        <EmptyState
          tone="danger"
          glyph={<IconoAlerta size={32} />}
          title="Acceso suspendido"
          body="El acceso al panel está suspendido por falta de pago. Contactá al soporte para regularizar tu suscripción."
        />
        <ContactoSoporte />
      </ShellLoginPanel>
    );
  }

  // ── "¿Olvidaste el PIN?" ──────────────────────────────────────────────────
  if (olvido) {
    return (
      <ShellLoginPanel imagenLocal={imagenLocal}>
        <LogoCirculo imagenLogo={imagenLogo} />
        <SolicitudRecuperacion tipo="pin_admin" onVolver={() => setOlvido(false)} />
      </ShellLoginPanel>
    );
  }

  // Falla que se muestra ahora: la del último login, o si todavía no hubo
  // ninguno, la que se detectó al abrir el sistema.
  const fallaVisible = falla ?? (huboRespuesta ? null : avisoAcceso);
  const hayError = estado === 'error' || Boolean(fallaVisible);

  // Color del icono fallback según estado (no se usa cuando hay logo).
  const iconoColor = hayError ? theme.danger : theme.accent;

  const subtituloTexto = estado === 'error'
    ? MENSAJE_PIN_INCORRECTO
    : (fallaVisible?.mensaje
      ?? (sesionCerrada && !huboRespuesta ? MENSAJE_SESION_CERRADA : "Ingresá tu PIN de 4 dígitos"));

  return (
    <ShellLoginPanel onCancelar={onCancelar} labelCancelar="Cancelar" imagenLocal={imagenLocal}>
      <LogoCirculo imagenLogo={imagenLogo} fallbackColor={iconoColor} />

      <EncabezadoAcceso titulo="Acceso al panel" bajada={subtituloTexto} error={hayError} />

      <IndicadoresPin pin={pin} estado={estado} shake={shake} />

      {/* Teclado numérico 3×4 — fila 4 es: vacío, 0, borrar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 10,
        width: '100%',
        marginTop: 4,
      }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <TeclaNum key={n} ariaLabel={`Tecla ${n}`} onClick={() => agregarDigito(String(n))}>
            {n}
          </TeclaNum>
        ))}
        <div />
        <TeclaNum ariaLabel="Tecla 0" onClick={() => agregarDigito('0')}>0</TeclaNum>
        <TeclaNum ariaLabel="Borrar" onClick={borrarDigito}>
          <Delete size={22} strokeWidth={1.75} />
        </TeclaNum>
      </div>

      {fallaVisible?.conContacto && <ContactoSoporte />}

      <BotonEnlace onClick={() => { setPin(""); setOlvido(true); }} disabled={estado === "exito"}>
        ¿Olvidaste el PIN de administrador?
      </BotonEnlace>
    </ShellLoginPanel>
  );
}
