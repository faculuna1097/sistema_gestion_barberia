// /frontend-landing/src/components/landing/FreeMonthBadge.jsx
// Pill "Primer mes gratis" — la oferta principal. Se reusa en el Hero y en el
// CTA final. Acento suave + ícono Lucide (no decorativo: refuerza que es una
// oferta).

import { Gift } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * FreeMonthBadge
 * Badge de la oferta del primer mes gratis.
 * @param {boolean} [props.animate=false] - Si entra con la animación om-pop
 * @param {Object} [props.style] - Override puntual
 */
function FreeMonthBadge({ animate = false, style }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: theme.accent,
        background: theme.accentSoft,
        border: `1px solid ${theme.accent}1F`,
        padding: '6px 12px',
        borderRadius: 999,
        animation: animate ? 'om-pop 0.32s ease-out' : undefined,
        ...style,
      }}
    >
      <Gift size={13} strokeWidth={1.75} aria-hidden="true" />
      Primer mes gratis
    </span>
  );
}

export default FreeMonthBadge;
