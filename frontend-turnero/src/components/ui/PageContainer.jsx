// /frontend-turnero/src/components/ui/PageContainer.jsx
// Container raíz de cada pantalla — centra contenido, max-width responsive, full-height.

import { theme } from '../../theme/tokens.js';

/**
 * PageContainer
 * Layout principal: mobile-first, columna centrada con max-width 480px en desktop.
 * En desktop, el espacio sobrante a los costados queda con un fondo neutro más oscuro
 * para reforzar la sensación de "app centrada", estilo Calendly / Cal.com.
 * La columna entra con la transición de pantalla (clase tt-pantalla de
 * index.css): desde la derecha al avanzar, desde la izquierda al volver,
 * según el atributo data-tt-direccion que pone App.
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
      // La columna entra desplazada 24 px: sin esto aparece una barra de scroll
      // horizontal durante la transición. `clip` (no `hidden`) para no volver
      // a este div un contenedor de scroll, que rompería el sticky del footer.
      overflowX: 'clip',
    }}>
      <div
        className="tt-pantalla"
        style={{
          width: '100%',
          maxWidth: theme.maxWidth,
          minHeight: '100dvh',
          background: theme.bg,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PageContainer;
