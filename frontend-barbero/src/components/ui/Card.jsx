// /frontend-barbero/src/components/ui/Card.jsx
// Contenedor base de contenido. Usado en listas de servicios, barberos, resumen, etc.

import { theme } from '../../theme/tokens.js';
import { useHover } from '../../hooks/useHover.js';

/**
 * Card
 * Card con border, padding y estados de selección/hover si es clickable. El
 * hover solo se prende con mouse (useHover).
 * @param {ReactNode} props.children
 * @param {boolean} [props.selected=false] - Si está seleccionada (border accent + focus ring)
 * @param {Function} [props.onClick] - Si se pasa, la card es clickable
 * @param {number} [props.padding=14] - Padding interno en px
 * @param {Object} [props.style] - Override puntual
 */
function Card({ children, selected = false, onClick, padding = 14, style }) {
  const [hover, eventosHover] = useHover();
  const clickable = Boolean(onClick);

  // Resolución del color de border según estado: selected > hover > default.
  const borderColor = selected
    ? theme.accent
    : (hover && clickable ? theme.mutedSoft : theme.hairline);

  return (
    <div
      onClick={onClick}
      {...eventosHover}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      } : undefined}
      style={{
        background: theme.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: theme.radius,
        padding,
        cursor: clickable ? 'pointer' : 'default',
        transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}, background ${theme.transitionFast}`,
        boxShadow: selected ? `0 0 0 3px ${theme.accent}26` : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Card;
