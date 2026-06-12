// /frontend-landing/src/components/ui/Button.jsx
// Botón unificado con 4 variantes. Copia de la fuente de verdad
// (frontend-turnero) con UNA divergencia de API permitida (§ política de
// divergencia del sistema de diseño): acepta `href` para renderizar un <a>
// con los mismos estilos. La landing tiene muchos CTA que son links
// (WhatsApp, email, anclas) y deben ser <a>, no <button> (accesibilidad §5.5).

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * Button
 * Botón/enlace del sistema. Variantes: primary | ghost | secondary | danger.
 * Si recibe `href`, renderiza un <a> con el mismo look; si no, un <button>.
 * @param {ReactNode} props.children - Contenido del botón
 * @param {Function} [props.onClick] - Handler de click (modo <button>)
 * @param {string} [props.href] - Si se pasa, renderiza un <a href> en vez de <button>
 * @param {boolean} [props.external=false] - Si el <a> abre en pestaña nueva (target _blank + rel)
 * @param {'primary'|'ghost'|'secondary'|'danger'} [props.variant='primary'] - Estilo visual
 * @param {boolean} [props.disabled=false]
 * @param {boolean} [props.full=true] - Si ocupa el 100% del ancho del padre
 * @param {string} [props.type='button'] - type del <button> nativo (modo <button>)
 * @param {string} [props.ariaLabel] - aria-label opcional
 * @param {Object} [props.style] - Override de estilos puntuales
 */
function Button({
  children,
  onClick,
  href,
  external = false,
  variant = 'primary',
  disabled = false,
  full = true,
  type = 'button',
  ariaLabel,
  style,
}) {
  const [hover, setHover] = useState(false);

  // Estilos base comunes a todas las variantes.
  const base = {
    width: full ? '100%' : 'auto',
    padding: '12px 16px',
    fontFamily: theme.body,
    fontWeight: theme.weightMedium,
    fontSize: 14,
    letterSpacing: '-0.005em',
    border: '1px solid transparent',
    borderRadius: theme.radius,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}, filter ${theme.transitionFast}, opacity ${theme.transitionFast}`,
    opacity: disabled ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  };

  // Estilos por variante. Cada variante define background/color/border/hover.
  const variants = {
    primary: {
      background: theme.accent,
      color: theme.accentInk,
      boxShadow: disabled ? 'none' : theme.shadowSm,
      filter: hover && !disabled ? 'brightness(1.08)' : 'none',
    },
    secondary: {
      background: hover && !disabled ? theme.surfaceAlt : theme.surface,
      color: theme.ink,
      borderColor: theme.hairline,
    },
    ghost: {
      background: hover && !disabled ? theme.surfaceAlt : 'transparent',
      color: theme.inkSoft,
    },
    danger: {
      background: hover && !disabled ? theme.dangerSoft : 'transparent',
      color: theme.danger,
      borderColor: theme.hairline,
    },
  };

  const composed = { ...base, ...variants[variant], ...style };

  // Modo enlace: render <a> con el mismo look.
  if (href && !disabled) {
    return (
      <a
        href={href}
        aria-label={ariaLabel}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={composed}
      >
        {children}
      </a>
    );
  }

  // Modo botón.
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      aria-label={ariaLabel}
      style={composed}
    >
      {children}
    </button>
  );
}

export default Button;
