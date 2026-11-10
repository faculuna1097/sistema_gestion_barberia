// /frontend-alta/src/screens/PantallaPlaceholder.jsx
// Contenido provisorio de las pantallas que todavía no se armaron (fase 2,
// esqueleto): dice qué va a tener cada una. Las fases 3 a 5 lo reemplazan por
// el contenido de verdad (Formulario → CONTENIDO_POR_PANTALLA).

import { theme } from '../theme/tokens.js';

/**
 * PantallaPlaceholder
 * @param {Object} props.pantalla - Entrada de PANTALLAS (config/pantallas.js)
 * @returns {JSX.Element}
 */
function PantallaPlaceholder({ pantalla }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <p style={{
        padding: 16,
        border: `1px dashed ${theme.hairline}`,
        borderRadius: theme.radius,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
      }}>
        {`En construcción. ${pantalla.contenido}`}
      </p>
    </div>
  );
}

export default PantallaPlaceholder;
