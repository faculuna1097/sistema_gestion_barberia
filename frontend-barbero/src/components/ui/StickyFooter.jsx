// /frontend-barbero/src/components/ui/StickyFooter.jsx
// Footer fijo al fondo del PageContainer — alberga el CTA principal de cada pantalla.

import { theme } from '../../theme/tokens.js';
import { ALTO_BOTTOM_NAV } from './BottomNav.jsx';

/**
 * StickyFooter
 * Contenedor pegado al fondo, con border-top y safe-area inferior.
 * En una pantalla con BottomNav (`sobreBottomNav`), se pega justo encima de la
 * barra en vez de quedar tapado por ella; la safe-area la cubre la barra.
 * @param {ReactNode} props.children
 * @param {boolean} [props.sobreBottomNav=false] - true si la pantalla muestra el BottomNav
 */
function StickyFooter({ children, sobreBottomNav = false }) {
  return (
    <div style={{
      position: 'sticky',
      bottom: sobreBottomNav ? `calc(${ALTO_BOTTOM_NAV}px + env(safe-area-inset-bottom, 0px))` : 0,
      left: 0,
      right: 0,
      padding: sobreBottomNav ? '12px 16px' : '12px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
      background: theme.bg,
      borderTop: `1px solid ${theme.hairline}`,
      zIndex: 5,
    }}>
      {children}
    </div>
  );
}

export default StickyFooter;
