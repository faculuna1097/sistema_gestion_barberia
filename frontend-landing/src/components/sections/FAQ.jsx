// /frontend-landing/src/components/sections/FAQ.jsx
// Sección de preguntas frecuentes. Respuestas honestas y concretas, sin jerga.

import { theme } from '../../theme/tokens.js';
import { linkWhatsApp } from '../../utils/contacto.js';
import Section from '../landing/Section.jsx';
import Reveal from '../landing/Reveal.jsx';
import FaqItem from '../landing/FaqItem.jsx';

const FAQS = [
  {
    pregunta: '¿Necesito instalar algo?',
    respuesta: 'No. Funciona desde el navegador, en la computadora y en el celular. No instalás nada ni dependés de un equipo en particular.',
  },
  {
    pregunta: '¿Puedo usar varios barberos?',
    respuesta: 'Sí. Cada barbero tiene su propia agenda, sus horarios y sus días libres, y vos ves todo el local junto.',
  },
  {
    pregunta: '¿Funciona desde el celular?',
    respuesta: 'Sí. El turnero para tus clientes y la app del barbero. El panel de gestión es exclusivo de Ipad, compu o tablet.',
  },
  {
    pregunta: '¿Qué pasa con mis datos?',
    respuesta: 'Son tuyos. Quedan guardados de forma segura y los podés consultar cuando quieras.',
  },
  {
    pregunta: '¿Cómo empiezo?',
    respuesta: 'Nos escribís por WhatsApp o email, damos de alta tu barbería y arrancás tu primer mes gratis. Te ayudamos a dejar todo configurado.',
  },
];

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
