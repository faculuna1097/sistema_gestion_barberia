// /frontend-turnero/src/components/ui/StickyFooter.jsx
// Footer fijo al fondo del PageContainer — alberga el CTA principal de cada pantalla.

import { theme } from '../../theme/tokens.js';

/**
 * StickyFooter
 * Contenedor pegado al fondo, con border-top y safe-area inferior.
 * @param {ReactNode} props.children
 */
function StickyFooter({ children }) {
  return (
    <div style={{
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '12px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
      background: theme.bg,
      borderTop: `1px solid ${theme.hairline}`,
      zIndex: 5,
    }}>
      {children}
    </div>
  );
}

export default StickyFooter;
