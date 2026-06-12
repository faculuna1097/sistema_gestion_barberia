// /frontend/src/components/ui/BotonIconoFila.jsx
// Icon-button compacto con caja, pensado para acciones por fila en tablas densas.
// Hover muta border/background/color según prop `tono`.

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * BotonIconoFila
 * Botón 28×28 con border `hairline` y fondo `surface` en estado normal;
 * en hover/activo, border + color toman el valor de `tono` y el fondo pasa
 * a la versión `Soft` del color.
 *
 * @param {object} props
 * @param {'accent'|'danger'} props.tono
 * @param {ReactNode} props.icono - Ícono Lucide (size 14 recomendado)
 * @param {string} props.ariaLabel - Texto accesible obligatorio
 * @param {Function} props.onClick
 * @param {boolean} [props.disabled]
 */
function BotonIconoFila({ tono, icono, ariaLabel, onClick, disabled }) {
  const [hover, setHover] = useState(false);

  const map = {
    accent: { color: theme.accent, bg: theme.accentSoft, border: theme.accent },
    danger: { color: theme.danger, bg: theme.dangerSoft, border: theme.danger },
  };
  const t = map[tono];
  const activo = hover && !disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radiusSm,
        background: activo ? t.bg : theme.surface,
        border: `1px solid ${activo ? t.border : theme.hairline}`,
        color: activo ? t.color : theme.muted,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}, color ${theme.transitionFast}`,
      }}
    >
      {icono}
    </button>
  );
}

export default BotonIconoFila;
