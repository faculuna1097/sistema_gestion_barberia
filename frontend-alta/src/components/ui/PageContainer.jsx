// /frontend-alta/src/components/ui/PageContainer.jsx
// Container raíz de cada pantalla — centra contenido, max-width responsive, full-height.
// Copia del primitivo del panel (frontend/src/components/ui/PageContainer.jsx),
// con dos cambios tomados del turnero:
//   - sin la animación om-fade: la entrada de cada pantalla la hace el
//     contenido (al-pantalla), y un `transform` retenido en la columna rompería
//     el `position: sticky` del StickyFooter;
//   - alto en 100dvh: en Safari, 100vh incluye la barra y el pie quedaba tapado.

import { theme } from '../../theme/tokens.js';

/**
 * PageContainer
 * Layout principal: mobile-first, columna centrada con max-width 480px en desktop.
 * En desktop, el espacio sobrante a los costados queda con un fondo neutro más oscuro
 * para reforzar la sensación de "app centrada", estilo Calendly / Cal.com.
 * @param {ReactNode} props.children
 * @returns {JSX.Element}
 */
function PageContainer({ children }) {
  return (
    <div style={{
      minHeight: '100dvh',
      width: '100%',
      background: theme.surfaceAlt, // fondo lateral en desktop
      display: 'flex',
      justifyContent: 'center',
      // El contenido entra desplazado 24 px: sin esto aparece una barra de
      // scroll horizontal durante la transición. `clip` (no `hidden`) para no
      // volver a este div un contenedor de scroll, que rompería el sticky del pie.
      overflowX: 'clip',
    }}>
      <div style={{
        width: '100%',
        maxWidth: theme.maxWidth,
        minHeight: '100dvh',
        background: theme.bg,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
        {children}
      </div>
    </div>
  );
}

export default PageContainer;
