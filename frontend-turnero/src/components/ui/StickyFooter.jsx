// /frontend-turnero/src/components/ui/StickyFooter.jsx
// Footer fijo al fondo del PageContainer — alberga el CTA principal de cada pantalla.

import { useLayoutEffect, useRef } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * StickyFooter
 * Contenedor pegado al fondo, con border-top y safe-area inferior.
 *
 * Mientras está montado, su alto es el `scroll-padding-bottom` del documento:
 * cuando el navegador trae a la vista un elemento enfocado (Tab, el
 * "siguiente" del teclado), lo deja por encima del footer en vez de debajo.
 * Se re-mide con un ResizeObserver (ej. el aviso de error que aparece arriba
 * del botón en "Confirmá tu turno"). Hay un solo footer por pantalla, y al
 * cambiar de pantalla React limpia el del que se va antes de medir el nuevo.
 * @param {ReactNode} props.children
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
