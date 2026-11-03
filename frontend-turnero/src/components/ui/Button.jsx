// /frontend-turnero/src/components/ui/Button.jsx
// Botón unificado con 4 variantes. Reemplaza todos los <button> ad-hoc del proyecto.

import { theme } from '../../theme/tokens.js';
import { useHover } from '../../hooks/useHover.js';

/**
 * Button
 * Botón principal del sistema. Variantes: primary | ghost | secondary | danger.
 * Con `href` se renderiza como link (`<a>`) con el mismo aspecto: para lo que
 * navega a otra página (ej. WhatsApp, un mapa), según §5.5 del sistema de diseño.
 * El hover solo existe con mouse (useHover): en táctil no queda "pegado".
 * @param {ReactNode} props.children - Contenido del botón
 * @param {Function} [props.onClick] - Handler de click
 * @param {'primary'|'ghost'|'secondary'|'danger'} [props.variant='primary'] - Estilo visual
 * @param {boolean} [props.disabled=false] - Solo para el botón (un link no se deshabilita)
 * @param {boolean} [props.full=true] - Si ocupa el 100% del ancho del padre
 * @param {string} [props.type='button'] - type del <button> nativo
 * @param {string} [props.form] - id del <form> al que pertenece (para un submit fuera del form)
 * @param {string} [props.href] - Si se pasa, se renderiza un <a> hacia esa dirección
 * @param {boolean} [props.externo=false] - Con href: abre en otra pestaña
 * @param {Object} [props.style] - Override de estilos puntuales
 */
function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  full = true,
  type = 'button',
  form,
  href,
  externo = false,
  style,
}) {
  const [hover, eventosHover] = useHover();

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
    // `transform` acompaña al achique de tt-presionable (index.css) al tocar.
    transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}, opacity ${theme.transitionFast}, transform ${theme.transitionFast}`,
    opacity: disabled ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  // Estilos por variante. Cada variante define background/color/border/hover.
  const variants = {
    primary: {
      background: hover && !disabled ? theme.accentHover : theme.accent,
      color: theme.accentInk,
      boxShadow: disabled ? 'none' : theme.shadowSm,
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

  if (href) {
    return (
      <a
        href={href}
        target={externo ? '_blank' : undefined}
        rel={externo ? 'noopener noreferrer' : undefined}
        onClick={onClick}
        {...eventosHover}
        className="tt-presionable"
        style={{ ...base, ...variants[variant], textDecoration: 'none', ...style }}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      form={form}
      onClick={disabled ? undefined : onClick}
      {...eventosHover}
      disabled={disabled}
      className="tt-presionable"
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

export default Button;
