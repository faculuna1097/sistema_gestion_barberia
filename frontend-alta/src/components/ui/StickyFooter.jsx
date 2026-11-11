// /frontend-alta/src/components/ui/StickyFooter.jsx
// Footer fijo al fondo del PageContainer — alberga el CTA principal de cada pantalla.
// Copia del primitivo del barbero (frontend-barbero/src/components/ui/StickyFooter.jsx)
// sin el modo `sobreBottomNav` (acá no hay barra de navegación, y traía la
// dependencia de BottomNav). Suma el `scroll-padding-bottom` del StickyFooter
// del turnero, para que lo enfocado con el teclado abierto quede por encima.

import { useLayoutEffect, useRef } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * StickyFooter
 * Contenedor pegado al fondo, con border-top y safe-area inferior.
 *
 * Mientras está montado, su alto es el `scroll-padding-bottom` del documento:
 * cuando el navegador trae a la vista un elemento enfocado (Tab, el
 * "siguiente" del teclado), lo deja por encima del footer en vez de debajo.
 * Se re-mide con un ResizeObserver (ej. un aviso que aparece arriba del botón).
 * Hay un solo footer por pantalla.
 * @param {ReactNode} props.children
 * @returns {JSX.Element}
 */
function StickyFooter({ children }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const raiz = document.documentElement;
    const footer = ref.current;
    const actualizar = () => { raiz.style.scrollPaddingBottom = `${footer.offsetHeight}px`; };
    actualizar();
    const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(actualizar) : null;
    observador?.observe(footer);
    return () => {
      observador?.disconnect();
      raiz.style.scrollPaddingBottom = '';
    };
  }, []);

  return (
    <div ref={ref} style={{
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
