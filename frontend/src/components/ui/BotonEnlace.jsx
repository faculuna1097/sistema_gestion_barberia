// /frontend/src/components/ui/BotonEnlace.jsx
// Acción secundaria con forma de link: texto en el acento, sin caja. Para una
// salida que no compite con el botón principal ("¿Olvidaste tu contraseña?" en
// los dos logins). Es un <button> (hace algo en la pantalla, no navega a una URL).
// Creado el 2026-11-13 (F6 de plan_mejoras_operativas.md).

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * BotonEnlace
 * Botón de texto con aspecto de link. Mide 44 px de alto (touch target, §5.4)
 * aunque se vea como texto.
 * @param {Object} props
 * @param {React.ReactNode} props.children - El texto.
 * @param {Function} props.onClick
 * @param {boolean} [props.disabled=false]
 * @returns {JSX.Element}
 */
function BotonEnlace({ children, onClick, disabled = false }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minHeight: 44,
        padding: '0 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: theme.radius,
        color: theme.accent,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        textDecoration: hover && !disabled ? 'underline' : 'none',
        textUnderlineOffset: 3,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

export default BotonEnlace;
