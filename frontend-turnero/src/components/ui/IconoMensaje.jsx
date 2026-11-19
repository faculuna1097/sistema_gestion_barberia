// /frontend-turnero/src/components/ui/IconoMensaje.jsx
// Ícono de globo de conversación, para el botón de WhatsApp del local (landing y
// gestión del turno).

/**
 * IconoMensaje
 * SVG inline de un globo de conversación. Neutro (sin el logo ni el verde de la
 * marca): el turnero tiene un solo acento. Decorativo (aria-hidden): siempre va
 * al lado del texto del botón. Toma el color del texto (currentColor).
 */
function IconoMensaje() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1L4 20z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default IconoMensaje;
