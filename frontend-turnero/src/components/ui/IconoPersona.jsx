// /frontend-turnero/src/components/ui/IconoPersona.jsx
// Ícono de una silueta, en lugar del avatar cuando no se sabe el nombre del
// barbero (resumen del turno y éxito de la reserva).

/**
 * IconoPersona
 * SVG inline de una silueta. Decorativo (aria-hidden): siempre va al lado del
 * texto de quién atiende. Toma el color del texto (currentColor).
 * @param {number} [props.size=16] - Tamaño en px (ancho y alto)
 */
function IconoPersona({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default IconoPersona;
