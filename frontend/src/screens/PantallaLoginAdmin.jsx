// /frontend/src/screens/PantallaLoginAdmin.jsx
// Pantalla de ingreso de PIN para acceder al panel. El login es unificado: el
// backend resuelve el rol (admin o barbero) según el PIN ingresado.
// Tiene teclado numérico táctil + soporte de teclado físico.
// Si la suscripción del tenant está vencida (solo path admin), muestra pantalla
// de acceso suspendido.
//
// Layout: full-screen con fondo surfaceAlt, card centrada (~480 px) con
// shadowMd. Estilo Stripe/Clerk auth. Botón "Cancelar"/"Volver" en la esquina
// superior izquierda de la card (ghost button con flecha).
//
// Props:
//   onAcceso     — función llamada con (token, { rol, aviso_pago, barbero }) cuando
//                  el PIN es correcto. El backend resuelve el rol (admin o barbero)
//                  según el PIN; `barbero` ({ id, nombre }) viene solo si rol='barbero'.
//   onCancelar   — función llamada al presionar "Cancelar"/"Volver".
//   imagenLogo   — URL del logo del tenant (de tenant_imagen tipo='logo').
//                  Si no hay, cae a un círculo con el icono Lock.

import { useState, useEffect, useCallback } from "react";
import { Delete, ArrowLeft } from "lucide-react";
import { theme } from "../theme/tokens.js";
import { EmptyState, IconoAlerta, Card, LogoCirculo } from "../components/ui";
import FondoLocal from "../components/ui/FondoLocal.jsx";
import { loginPanel } from "../services/api";

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
 * ShellLoginAdmin
 * Wrapper full-screen con la card de PIN centrada. El fondo es `FondoLocal` (la
 * foto del local con blur + velo, el mismo de MainScreen y los 3 flujos), así el
 * ambiente del local no se corta al entrar al login. Sin foto, FondoLocal cae a
 * `surfaceAlt` (el look Stripe/Clerk de antes). La card opaca (`surface`) hace de
 * "panel claro" sobre el fondo, idéntico patrón al de los flujos.
 *
 * Lo comparten la pantalla normal de ingreso de PIN y la de acceso suspendido.
 * El cancel button va en la esquina superior izquierda de la card.
 */
function ShellLoginAdmin({ children, onCancelar, labelCancelar = 'Cancelar', maxWidth = 480, imagenLocal }) {
  return (
    <FondoLocal imagenLocal={imagenLocal}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth,
        // Margen para que la card no toque los bordes en pantallas angostas
        // (reemplaza el padding del contenedor anterior; FondoLocal va al borde).
        margin: 24,
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radiusLg,
        boxShadow: theme.shadowMd,
        padding: '40px 32px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        animation: 'om-fade .26s ease-out both',
      }}>
        {onCancelar && <BotonCancelarEsquina label={labelCancelar} onClick={onCancelar} />}
        {children}
      </div>
    </FondoLocal>
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
 * ContactoCard
 * Card de contacto que aparece en la pantalla bloqueada.
 */
function ContactoCard() {
  return (
    <Card style={{ width: '100%' }} padding={16}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.inkSoft }}>
          WhatsApp: <strong style={{ color: theme.ink }}>11 3311-1686</strong>
        </p>
        <p style={{ margin: 0, fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.inkSoft }}>
          facundolunagrebe@gmail.com
        </p>
      </div>
    </Card>
  );
}

/**
 * PantallaLoginAdmin
 * Componente principal. Maneja el flujo de ingreso de PIN, validación y
 * el estado bloqueado por suscripción vencida.
 */
export default function PantallaLoginAdmin({ onAcceso, onCancelar, imagenLogo, imagenLocal }) {
  const [pin, setPin]             = useState("");
  const [estado, setEstado]       = useState("idle"); // "idle" | "error" | "exito"
  const [shake, setShake]         = useState(false);
  const [bloqueado, setBloqueado] = useState(false);

  /**
   * validarPin — envía el PIN al backend. Si vuelve 402 (suscripción vencida)
   * muestra la pantalla bloqueada. Si vuelve cualquier otro error, muestra
   * el feedback de "PIN incorrecto" y resetea.
   */
  const validarPin = useCallback(async (pinIngresado) => {
    try {
      const { token, rol, aviso_pago, barbero } = await loginPanel(pinIngresado);
      setEstado("exito");
      setTimeout(() => onAcceso(token, { rol, aviso_pago, barbero }), 600);
    } catch (err) {
      console.error('[pantallaLoginAdmin] Error en validarPin:', err.message);
      if (err.bloqueado) {
        setBloqueado(true);
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
      if (nuevo.length === 4) validarPin(nuevo);
      return nuevo;
    });
  }, [estado, validarPin]);

  /** borrarDigito — elimina el último dígito del PIN. */
  const borrarDigito = useCallback(() => {
    if (estado === "exito") return;
    setEstado("idle");
    setPin((p) => p.slice(0, -1));
  }, [estado]);

  // Soporte de teclado físico (útil en desktop / iPad con teclado bluetooth).
  useEffect(() => {
    const manejarTeclado = (e) => {
      if (e.key >= "0" && e.key <= "9") agregarDigito(e.key);
      if (e.key === "Backspace") borrarDigito();
    };
    window.addEventListener("keydown", manejarTeclado);
    return () => window.removeEventListener("keydown", manejarTeclado);
  }, [agregarDigito, borrarDigito]);

  // ── Pantalla bloqueada (suscripción vencida) ──────────────────────────────
  if (bloqueado) {
    return (
      <ShellLoginAdmin onCancelar={onCancelar} labelCancelar="Volver" imagenLocal={imagenLocal}>
        <EmptyState
          tone="danger"
          glyph={<IconoAlerta size={32} />}
          title="Acceso suspendido"
          body="El acceso al panel está suspendido por falta de pago. Contactá al soporte para regularizar tu suscripción."
        />
        <ContactoCard />
      </ShellLoginAdmin>
    );
  }

  // Color del icono fallback según estado (no se usa cuando hay logo).
  const iconoColor = estado === 'error' ? theme.danger : theme.accent;

  const subtituloTexto = estado === 'error'
    ? "PIN incorrecto. Intentá de nuevo."
    : "Ingresá tu PIN de 4 dígitos";

  const subtituloColor = estado === 'error' ? theme.danger : theme.muted;

  return (
    <ShellLoginAdmin onCancelar={onCancelar} labelCancelar="Cancelar" imagenLocal={imagenLocal}>
      <LogoCirculo imagenLogo={imagenLogo} fallbackColor={iconoColor} />

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeTitle,
          color: theme.ink,
          letterSpacing: '-0.02em',
          margin: 0,
        }}>
          Acceso al panel
        </h1>
        <p style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: subtituloColor,
          margin: 0,
          minHeight: 22,
          transition: `color ${theme.transitionFast}`,
        }}>
          {subtituloTexto}
        </p>
      </div>

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
    </ShellLoginAdmin>
  );
}
