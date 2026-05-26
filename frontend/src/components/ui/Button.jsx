// /frontend/src/components/ui/Button.jsx
// Botón unificado con 4 variantes. Reemplaza todos los <button> ad-hoc del proyecto.
// Copia idéntica del primitivo de frontend-turnero (Fase 2 del rediseño).

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * Button
 * Botón principal del sistema. Variantes: primary | ghost | secondary | danger.
 * @param {ReactNode} props.children - Contenido del botón
 * @param {Function} props.onClick - Handler de click
 * @param {'primary'|'ghost'|'secondary'|'danger'} [props.variant='primary'] - Estilo visual
 * @param {boolean} [props.disabled=false]
 * @param {boolean} [props.full=true] - Si ocupa el 100% del ancho del padre
 * @param {string} [props.type='button'] - type del <button> nativo
 * @param {Object} [props.style] - Override de estilos puntuales
 */
function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  full = true,
  type = 'button',
  style,
}) {
  const [hover, setHover] = useState(false);

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
  };

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

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

export default Button;
