// /frontend-landing/src/components/landing/FaqItem.jsx
// Ítem de FAQ tipo acordeón. Controlado con useState (en vez de <details>) para
// poder estilar el chevron y la transición inline. Accesible: el botón expone
// aria-expanded y controla la región de respuesta.

import { useState, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * FaqItem
 * @param {string} props.pregunta - La pregunta (header clickable)
 * @param {string} props.respuesta - La respuesta (se muestra al abrir)
 */
function FaqItem({ pregunta, respuesta }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div style={{ borderBottom: `1px solid ${theme.hairline}` }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 4px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: theme.body, fontWeight: theme.weightHeading, fontSize: 16, color: theme.ink }}>
          {pregunta}
        </span>
        <ChevronDown
          size={20}
          aria-hidden="true"
          style={{
            flex: '0 0 auto',
            color: theme.muted,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: `transform ${theme.transitionMedium}`,
          }}
        />
      </button>

      {open && (
        <div
          id={id}
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
      )}
    </div>
  );
}

export default FaqItem;
