// /frontend-landing/src/components/landing/Container.jsx
// Envoltorio de ancho máximo centrado, con gutter lateral. La app usa
// PageContainer (480px mobile-first); la landing es ancha en desktop.

import { theme } from '../../theme/tokens.js';

/**
 * Container
 * Centra el contenido y le pone un ancho máximo + padding lateral.
 * @param {ReactNode} props.children
 * @param {boolean} [props.narrow=false] - Usa el ancho de prosa (720) en vez del ancho general (1120)
 * @param {Object} [props.style] - Override puntual
 */
function Container({ children, narrow = false, style }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: narrow ? theme.maxWidthText : theme.maxWidthWide,
        marginInline: 'auto',
        paddingInline: 'clamp(20px, 5vw, 24px)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Container;
