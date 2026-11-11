// /frontend-alta/src/components/ui/Button.jsx
// Botón unificado con 4 variantes.
// Copia del primitivo del panel (frontend/src/components/ui/Button.jsx), mismo
// aspecto. Cambia la API, como permite sistema_de_disenio.md §8:
//   - hover con useHover (táctil: el hover no queda pegado, §4.2);
//   - `href` + `externo` para dibujarlo como <a> (como el del turnero), para los
//     links a WhatsApp;
//   - clase al-presionable: se achica apenas al tocar (index.css);
//   - `ref` (React 19 lo pasa como prop), para llevarle el foco;
//   - deshabilitado con aria-disabled y no con el atributo `disabled`: un
//     botón con `disabled` pierde el foco, y quien venía con el teclado (ej.
//     "Enviar" → "Enviando…" → "Reintentar") quedaba al principio de la página.

import { theme } from '../../theme/tokens.js';
import { useHover } from '../../hooks/useHover.js';

/**
 * Button
 * Botón principal del sistema. Variantes: primary | ghost | secondary | danger.
 * Con `href` se dibuja como link (`<a>`) con el mismo aspecto: para lo que
 * navega a otra dirección (sistema_de_disenio.md §5.5).
 * @param {ReactNode} props.children - Contenido del botón
 * @param {Function} [props.onClick] - Handler de click
 * @param {'primary'|'ghost'|'secondary'|'danger'} [props.variant='primary'] - Estilo visual
 * @param {boolean} [props.disabled=false]
 * @param {boolean} [props.full=true] - Si ocupa el 100% del ancho del padre
 * @param {string} [props.type='button'] - type del <button> nativo
 * @param {string} [props.href] - Si se pasa, se dibuja un <a> hacia esa dirección
 * @param {boolean} [props.externo=false] - Con href: abre en otra pestaña
 * @param {Object} [props.style] - Override de estilos puntuales
 * @param {Object} [props.ref] - Ref al <button> o <a>
 * @returns {JSX.Element}
 */
function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  full = true,
  type = 'button',
  href,
  externo = false,
  style,
  ref,
}) {
  const [hover, eventosHover] = useHover();

  const base = {
    width: full ? '100%' : 'auto',
    // 44 px de alto como mínimo: el toque cómodo del celular (§5.4).
    minHeight: 44,
    padding: '12px 16px',
    fontFamily: theme.body,
    fontWeight: theme.weightMedium,
    fontSize: 14,
    letterSpacing: '-0.005em',
    border: '1px solid transparent',
    borderRadius: theme.radius,
    cursor: disabled ? 'not-allowed' : 'pointer',
    // `transform` acompaña al achique de al-presionable (index.css) al tocar.
    transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}, filter ${theme.transitionFast}, opacity ${theme.transitionFast}, transform ${theme.transitionFast}`,
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

  if (href) {
    return (
      <a
        ref={ref}
        href={href}
        target={externo ? '_blank' : undefined}
        rel={externo ? 'noopener noreferrer' : undefined}
        onClick={onClick}
        {...eventosHover}
        className="al-presionable"
        style={{ ...base, ...variants[variant], textDecoration: 'none', ...style }}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      onClick={disabled ? undefined : onClick}
      {...eventosHover}
      aria-disabled={disabled || undefined}
      className="al-presionable"
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

export default Button;
