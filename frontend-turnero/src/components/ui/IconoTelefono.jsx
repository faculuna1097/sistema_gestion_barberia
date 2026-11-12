// /frontend-turnero/src/components/ui/IconoTelefono.jsx
// Ícono de teléfono, para el teléfono del local (landing y gestión del turno).

/**
 * IconoTelefono
 * SVG inline de un teléfono. Decorativo (aria-hidden): siempre va al lado del
 * número. Toma el color del texto (currentColor).
 */
function IconoTelefono() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default IconoTelefono;
