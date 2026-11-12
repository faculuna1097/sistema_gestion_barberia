// /frontend-turnero/src/components/ui/PageContainer.jsx
// Container raíz de cada pantalla — centra contenido, max-width responsive, full-height.

import { theme } from '../../theme/tokens.js';
import { usePantallaAncha } from '../../hooks/usePantallaAncha.js';

/**
 * PageContainer
 * Layout principal: mobile-first, columna centrada con max-width 480px.
 * - Celular (y ventanas angostas): la columna a todo el ancho; si sobra lugar
 *   a los costados, queda con un fondo neutro más oscuro, estilo "app centrada".
 * - Pantalla ancha (usePantallaAncha): la columna va a la derecha del panel
 *   del local (MarcoLocal), centrada en el espacio que queda, sobre blanco y
 *   con 24 px de margen a los costados: no se ve como un celular apoyado.
 * La columna entra con la transición de pantalla (clase tt-pantalla de
 * index.css): desde la derecha al avanzar, desde la izquierda al volver,
 * según el atributo data-tt-direccion que pone App.
 * @param {ReactNode} props.children
 */
function PageContainer({ children }) {
  const ancha = usePantallaAncha();

  return (
    <div style={{
      minHeight: '100dvh',
      width: '100%',
      // Fondo lateral: gris en lo angosto; en lo ancho, blanco como la columna.
      background: ancha ? theme.bg : theme.surfaceAlt,
      display: 'flex',
      justifyContent: 'center',
      // La columna entra desplazada 24 px: sin esto aparece una barra de scroll
      // horizontal durante la transición. `clip` (no `hidden`) para no volver
      // a este div un contenedor de scroll, que rompería el sticky del footer.
      overflowX: 'clip',
      ...(ancha && { padding: '0 24px' }),
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
