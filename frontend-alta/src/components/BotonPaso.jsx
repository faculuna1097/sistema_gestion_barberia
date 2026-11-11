// /frontend-alta/src/components/BotonPaso.jsx
// Botón cuadrado de 44 × 44 con un - o un +: el paso de los selectores que se
// ajustan de a toques (la hora en SelectorHora, la comisión en
// SelectorComision). Salió de SelectorHora en la fase 4, al tener un segundo uso.

import { theme } from '../theme/tokens.js';
import { useHover } from '../hooks/useHover.js';

/**
 * BotonPaso
 * @param {ReactNode} props.children - El ícono (Minus o Plus de 20)
 * @param {string} props.etiqueta - aria-label ("Abren: 30 minutos antes")
 * @param {boolean} props.deshabilitado - En el tope del rango
 * @param {Function} props.onClick
 * @param {string} [props.describedBy] - id del texto de error
 * @param {Object} [props.ref] - Ref al <button>
 * @returns {JSX.Element}
 */
function BotonPaso({ children, etiqueta, deshabilitado, onClick, describedBy, ref }) {
  const [hover, eventosHover] = useHover();
  return (
    <button
      ref={ref}
      type="button"
      onClick={deshabilitado ? undefined : onClick}
      {...eventosHover}
      // aria-disabled y no `disabled`: al llegar al tope con el teclado, el
      // botón conserva el foco (con `disabled` se iba al principio de la página).
      aria-disabled={deshabilitado || undefined}
      aria-label={etiqueta}
      aria-describedby={describedBy}
      className="al-presionable"
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        background: hover && !deshabilitado ? theme.surfaceAlt : theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        color: deshabilitado ? theme.mutedSoft : theme.ink,
        cursor: deshabilitado ? 'not-allowed' : 'pointer',
        transition: `background ${theme.transitionFast}, transform ${theme.transitionFast}`,
      }}
    >
      {children}
    </button>
  );
}

export default BotonPaso;
