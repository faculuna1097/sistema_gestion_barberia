// /frontend-landing/src/components/landing/FaqItem.jsx
// Ítem de FAQ con <details>/<summary> nativo. La respuesta está siempre en el
// HTML (la leen buscadores y crawlers de IA aunque el ítem esté cerrado), abre
// y cierra sin JS y es accesible por defecto (teclado + estado expandido).
// Lo que no se puede inline vive en index.css (clase `om-faq`): ocultar el
// marcador nativo del summary y rotar el chevron con `details[open]`. El foco
// visible lo da la regla global `*:focus-visible`.

import { ChevronDown } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * FaqItem
 * @param {string} props.pregunta - La pregunta (summary clickable)
 * @param {string} props.respuesta - La respuesta (visible al abrir)
 * @returns {JSX.Element}
 */
function FaqItem({ pregunta, respuesta }) {
  return (
    <details className="om-faq" style={{ borderBottom: `1px solid ${theme.hairline}` }}>
      <summary
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 4px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontFamily: theme.body, fontWeight: theme.weightHeading, fontSize: 16, color: theme.ink }}>
          {pregunta}
        </span>
        <ChevronDown
          size={20}
          aria-hidden="true"
          className="om-faq-chevron"
          style={{
            flex: '0 0 auto',
            color: theme.muted,
            transition: `transform ${theme.transitionMedium}`,
          }}
        />
      </summary>

      <div
        style={{
          padding: '0 4px 18px',
          fontFamily: theme.body,
          fontSize: 15,
          lineHeight: 1.6,
          color: theme.muted,
          maxWidth: 640,
        }}
      >
        {respuesta}
      </div>
    </details>
  );
}

export default FaqItem;
