// /frontend-landing/src/components/landing/NotaAlPie.jsx
// Línea de texto chico y centrado debajo de un bloque: aclaraciones como la
// fuente de un dato, "números de ejemplo" o la línea "Sin instalaciones ·
// Cancelás cuando quieras" del Plan.
// 14 px en `muted`: es texto que se lee, así que respeta el mínimo de 14 px del
// sistema y el contraste AA (5,05:1 sobre `bg`, 5,28:1 sobre blanco). `mutedSoft`
// no llega (2,56:1).

import { theme } from '../../theme/tokens.js';

/**
 * NotaAlPie
 * Párrafo chico, centrado y en gris.
 * @param {ReactNode} props.children - Texto de la nota
 * @param {Object} [props.style] - Override puntual (ej. el margen superior)
 * @returns {JSX.Element}
 */
function NotaAlPie({ children, style }) {
  return (
    <p
      style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        lineHeight: 1.5,
        color: theme.muted,
        textAlign: 'center',
        margin: '24px auto 0',
        maxWidth: theme.maxWidthText,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

export default NotaAlPie;
