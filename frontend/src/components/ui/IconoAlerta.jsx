// /frontend/src/components/ui/IconoAlerta.jsx
// Ícono de alerta (círculo con signo de exclamación) para EmptyState de error.
// Copia idéntica del helper de frontend-turnero.

/**
 * IconoAlerta
 * SVG inline de un círculo con signo de exclamación. Usado como glyph del
 * EmptyState cuando una carga falla.
 * @param {number} [props.size=32] - Tamaño en px (ancho y alto)
 */
function IconoAlerta({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="15.5" r="0.75" fill="currentColor"/>
    </svg>
  );
}

export default IconoAlerta;
