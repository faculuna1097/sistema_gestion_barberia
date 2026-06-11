// /frontend-turnero/src/components/ui/PageContainer.jsx
// Container raíz de cada pantalla — centra contenido, max-width responsive, full-height.

import { theme } from '../../theme/tokens.js';

/**
 * PageContainer
 * Layout principal: mobile-first, columna centrada con max-width 480px en desktop.
 * En desktop, el espacio sobrante a los costados queda con un fondo neutro más oscuro
 * para reforzar la sensación de "app centrada", estilo Calendly / Cal.com.
 * @param {ReactNode} props.children
 */
function PageContainer({ children }) {
  return (
    <div style={{
      minHeight: '100dvh',
      width: '100%',
      background: theme.surfaceAlt, // fondo lateral en desktop
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: theme.maxWidth,
        minHeight: '100dvh',
        background: theme.bg,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        animation: 'om-fade .26s ease-out both',
      }}>
        {children}
      </div>
    </div>
  );
}

export default PageContainer;
