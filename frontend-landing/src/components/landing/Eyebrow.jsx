// /frontend-landing/src/components/landing/Eyebrow.jsx
// Micro-label superior de cada sección: mono, mayúsculas, color acento.
// Mismo recurso visual que el eyebrow de ScreenHeader del sistema, pero en
// acento (énfasis de marketing) en vez de muted.

import { theme } from '../../theme/tokens.js';

/**
 * Eyebrow
 * Etiqueta corta sobre el título de una sección. La alineación la define el
 * contenedor padre (text-align).
 * @param {ReactNode} props.children
 * @param {string} [props.color] - Color del texto (default: acento indigo). Se
 *   override en secciones como Problema, que usan un eyebrow rojo de "dolor".
 */
function Eyebrow({ children, color = theme.accent }) {
  return (
    <p
      style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

export default Eyebrow;
