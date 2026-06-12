// /frontend-landing/src/components/sections/Testimonios.jsx
// Sección Testimonios. La maqueta está lista pero el contenido es PLACEHOLDER:
// se renderiza solo si FLAGS.mostrarTestimonios es true (ver config/landing.js).
// No publicar testimonios inventados — activar cuando haya reales.

import Section from '../landing/Section.jsx';
import Reveal from '../landing/Reveal.jsx';
import TestimonialCard from '../landing/TestimonialCard.jsx';

// PLACEHOLDER — reemplazar por testimonios reales antes de activar el flag.
const TESTIMONIOS = [
  {
    quote: 'Antes cerraba la caja a mano cada noche. Ahora termino de atender y ya está todo sumado.',
    nombre: 'Martín G.',
    rol: 'Dueño · Barbería Norte',
  },
  {
    quote: 'Los clientes reservan solos por el link. Dejé de contestar mensajes todo el día para acomodar turnos.',
    nombre: 'Diego R.',
    rol: 'Barbero · Studio Centro',
  },
  {
    quote: 'Por primera vez sé cuánto facturo y si estoy creciendo. Cambió cómo tomo decisiones.',
    nombre: 'Lucas M.',
    rol: 'Dueño · The Cut Club',
  },
];

/**
 * Testimonios
 * Sección de testimonios. Sin props.
 * @returns {JSX.Element}
 */
function Testimonios() {
  return (
    <Section
      id="testimonios"
      tone="default"
      eyebrow="Lo que dicen"
      title="Barberías que ya trabajan ordenadas."
      subtitle="Lo que cambia cuando dejás de administrar a mano y empezás a tener todo en un solo lugar."
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
        {TESTIMONIOS.map((t, i) => (
          <Reveal
            key={t.nombre}
            delay={i * 80}
            style={{ flex: '1 1 280px', maxWidth: 360, display: 'flex' }}
          >
            <TestimonialCard quote={t.quote} nombre={t.nombre} rol={t.rol} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export default Testimonios;
