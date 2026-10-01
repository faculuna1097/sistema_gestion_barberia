// /frontend-landing/src/components/sections/FAQ.jsx
// Sección de preguntas frecuentes. Respuestas honestas y concretas, sin jerga.
// Los textos viven en content/faq.js (los comparte con el JSON-LD y el llms.txt).

import { theme } from '../../theme/tokens.js';
import { linkWhatsApp } from '../../utils/contacto.js';
import { FAQS } from '../../content/faq.js';
import Section from '../landing/Section.jsx';
import Reveal from '../landing/Reveal.jsx';
import FaqItem from '../landing/FaqItem.jsx';

/**
 * FAQ
 * Sección de preguntas frecuentes. Sin props.
 * @returns {JSX.Element}
 */
function FAQ() {
  return (
    <Section
      id="faq"
      tone="default"
      eyebrow="Preguntas frecuentes"
      title="Lo que casi todos preguntan antes de empezar."
    >
      <Reveal style={{ maxWidth: 720, marginInline: 'auto', borderTop: `1px solid ${theme.hairline}` }}>
        {FAQS.map((f) => (
          <FaqItem key={f.pregunta} pregunta={f.pregunta} respuesta={f.respuesta} />
        ))}
      </Reveal>

      <p
        style={{
          textAlign: 'center',
          marginTop: 'clamp(24px, 4vw, 32px)',
          fontFamily: theme.body,
          fontSize: 15,
          color: theme.muted,
        }}
      >
        ¿Te quedó otra duda?{' '}
        <a
          href={linkWhatsApp()}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: theme.accent, fontWeight: theme.weightMedium }}
        >
          Escribinos por WhatsApp
        </a>
        .
      </p>
    </Section>
  );
}

export default FAQ;
