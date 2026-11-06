// /frontend-turnero/src/components/ui/Card.jsx
// Contenedor base de contenido. Usado en listas de servicios, barberos, resumen, etc.

import { theme } from '../../theme/tokens.js';
import { useHover } from '../../hooks/useHover.js';

/**
 * Card
 * Card con border, padding y estados de selección/hover si es clickable. El
 * hover solo existe con mouse (useHover): en táctil no queda "pegado".
 * @param {ReactNode} props.children
 * @param {boolean} [props.selected=false] - Si está seleccionada (border accent + focus ring)
 * @param {Function} [props.onClick] - Si se pasa, la card es clickable
 * @param {number} [props.padding=16] - Padding interno en px (escala de §3.3)
 * @param {Object} [props.style] - Override puntual
 */
function Card({ children, selected = false, onClick, padding = 16, style }) {
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
      className={clickable ? 'tt-presionable' : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      } : undefined}
      style={{
        background: theme.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: theme.radius,
        padding,
        cursor: clickable ? 'pointer' : 'default',
        // `transform` acompaña al achique de tt-presionable (index.css) al tocar.
        transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}, background ${theme.transitionFast}, transform ${theme.transitionFast}`,
        boxShadow: selected ? `0 0 0 3px ${theme.accent}26` : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Card;
