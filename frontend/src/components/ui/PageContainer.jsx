// /frontend/src/components/ui/PageContainer.jsx
// Container raíz de cada pantalla — centra contenido, max-width responsive, full-height.
// Copia idéntica del primitivo de frontend-turnero.
//
// PENDIENTE FASE 3: este primitivo está pensado para mobile-first con columna
// centrada (max-width 480px). El shell del panel admin es horizontal/desktop —
// hay que decidir en Fase 3 si se modifica este primitivo (aceptando un prop
// `maxWidth`/`fluid`) o si se crea uno paralelo `AdminPageContainer`.

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
      minHeight: '100vh',
      width: '100%',
      background: theme.surfaceAlt, // fondo lateral en desktop
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: theme.maxWidth,
        minHeight: '100vh',
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
