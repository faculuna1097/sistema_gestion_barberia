// /frontend-turnero/src/components/ui/IconoPin.jsx
// Ícono de pin de ubicación, para la dirección del local (landing y resumen del turno).

/**
 * IconoPin
 * SVG inline de un pin de ubicación. Decorativo (aria-hidden): siempre va al
 * lado del texto de la dirección. Toma el color del texto (currentColor).
 * @param {number} [props.size=16] - Tamaño en px (ancho y alto)
 */
function IconoPin({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

export default IconoPin;
