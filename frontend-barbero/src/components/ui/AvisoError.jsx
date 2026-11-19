// /frontend-barbero/src/components/ui/AvisoError.jsx
// Caja de error en línea: fondo danger suave, borde y texto danger. La usan el
// wizard de turno, las hojas de la Agenda y los avisos de la Agenda.

import { theme } from '../../theme/tokens.js';

/**
 * AvisoError
 * Mensaje de error junto a lo que lo causó. Va con role="alert": el lector de
 * pantalla lo anuncia al aparecer.
 * @param {ReactNode} props.children - el texto (y, si hace falta, una acción)
 * @returns {JSX.Element}
 */
function AvisoError({ children }) {
  return (
    <div
      role="alert"
      style={{
        background: theme.dangerSoft,
        border: `1px solid ${theme.danger}`,
        borderRadius: theme.radius,
        padding: '10px 12px',
        color: theme.danger,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
      }}
    >
      {children}
    </div>
  );
}

export default AvisoError;
