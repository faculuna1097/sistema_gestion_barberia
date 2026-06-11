// /frontend-landing/src/components/sections/Problema.jsx
// Sección Problema: los dolores de gestionar una barbería sin sistema. Estética
// CÁLIDA/ROJIZA deliberada (PainCard + eyebrow rojo + fondo apenas cálido) para
// que se SIENTAN como problemas, no como una lista de funciones. Copy en voz de
// queja del dueño.

import { CalendarX2, Wallet, Clock, Files, HelpCircle } from 'lucide-react';
import Section from '../landing/Section.jsx';
import Reveal from '../landing/Reveal.jsx';
import PainCard from '../landing/PainCard.jsx';

// Color del eyebrow (rojo de "dolor", no el indigo de marca).
const ROJO_DOLOR = '#D92D20';

// Los 5 dolores, en voz de queja del dueño. icon = componente Lucide.
const PROBLEMAS = [
  {
    icon: CalendarX2,
    title: 'Se te pisan los turnos',
    body: 'Reservás entre mensajes, se anotan dos en el mismo horario y otro no avisa que no viene. La agenda vive en tu cabeza.',
  },
  {
    icon: Wallet,
    title: 'No sabés cuánto hiciste hoy',
    body: 'Cierra el día y tenés que adivinar cuánto entró, cuánto se gastó y qué le toca a cada barbero.',
  },
  {
    icon: Clock,
    title: 'El cierre te roba una hora',
    body: 'Sumás cortes, ventas y gastos a mano, todas las noches. Tiempo que podrías estar cortando o en tu casa.',
  },
  {
    icon: Files,
    title: 'Todo en papelitos y Excel',
    body: 'Una planilla acá, una nota allá, un Excel que actualizás cuando te acordás. Nada habla con nada.',
  },
  {
    icon: HelpCircle,
    title: 'No sabés si estás creciendo',
    body: '¿Este mes fue mejor que el anterior? ¿Vino más gente? Hoy solo lo intuís, no lo ves.',
  },
];

/**
 * Problema
 * Sección de dolores. Sin props.
 * @returns {JSX.Element}
 */
function Problema() {
  return (
    <Section
      id="problema"
      eyebrow="¿Te suena conocido?"
      eyebrowColor={ROJO_DOLOR}
      title="Tu barbería funciona, pero administrarla te agota."
      subtitle="Cuando los turnos, la plata y los números están repartidos entre WhatsApp, papel y tu cabeza, cada día se te va un rato en cosas que no son cortar."
      style={{ background: '#FFFAF8' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
        {PROBLEMAS.map((p, i) => (
          <Reveal
            key={p.title}
            delay={i * 60}
            style={{ flex: '1 1 280px', maxWidth: 360, display: 'flex' }}
          >
            <PainCard icon={p.icon} title={p.title} body={p.body} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export default Problema;
