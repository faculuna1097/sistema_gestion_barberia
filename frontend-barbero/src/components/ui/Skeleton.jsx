// /frontend-barbero/src/components/ui/Skeleton.jsx
// Placeholder animado mientras carga contenido. Reemplaza los "Cargando..." actuales.

import { theme } from '../../theme/tokens.js';

/**
 * Skeleton
 * Bloque rectangular con shimmer. La animación está definida en index.css (@keyframes om-shimmer).
 * @param {number|string} [props.height=16]
 * @param {number|string} [props.width='100%']
 * @param {number} [props.radius=6]
 * @param {Object} [props.style]
 */
function Skeleton({ height = 16, width = '100%', radius = theme.radiusSm, style }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: radius,
        background: `linear-gradient(90deg, ${theme.hairline} 0%, ${theme.surfaceAlt} 50%, ${theme.hairline} 100%)`,
        backgroundSize: '200% 100%',
        animation: 'om-shimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export default Skeleton;
