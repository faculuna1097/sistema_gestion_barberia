// /frontend-landing/src/components/sections/Beneficios.jsx
// Sección Beneficios: resultados, no funciones. Estilo limpio/indigo
// (FeatureCard) a propósito, para contrastar con el rojo del Problema.

import { Clock, ListChecks, ShieldCheck, PiggyBank, Layers, Users } from 'lucide-react';
import Section from '../landing/Section.jsx';
import Reveal from '../landing/Reveal.jsx';
import FeatureCard from '../landing/FeatureCard.jsx';

// 6 resultados (no funciones). Cada uno habla del cambio, no de la feature.
const BENEFICIOS = [
  {
    icon: Clock,
    title: 'Menos tiempo administrando',
    body: 'El cierre del día deja de ser una tarea: cuando terminás de atender, las cuentas ya están hechas.',
  },
  {
    icon: ListChecks,
    title: 'Más orden',
    body: 'Todo en un lugar y siempre actualizado. Se terminaron los papeles sueltos y las planillas a medias.',
  },
  {
    icon: ShieldCheck,
    title: 'Menos errores',
    body: 'Sin sumas a mano ni turnos que se pisan. Los números salen bien la primera vez.',
  },
  {
    icon: PiggyBank,
    title: 'Mejor control financiero',
    body: 'Sabés cuánto entra, cuánto sale y cuánto te queda, todos los días, sin adivinar.',
  },
  {
    icon: Layers,
    title: 'Información centralizada',
    body: 'Turnos, caja y planillas en una sola fuente. Lo que cargás una vez aparece en todos lados.',
  },
  {
    icon: Users,
    title: 'Barberos más organizados',
    body: 'Cada uno maneja su agenda y sus días libres, y vos ves el conjunto del local.',
  },
];

/**
 * Beneficios
 * Sección de resultados. Sin props.
 * @returns {JSX.Element}
 */
function Beneficios() {
  return (
    <Section
      id="beneficios"
      tone="alt"
      eyebrow="Lo que cambia"
      title="Menos tiempo administrando, más tiempo cortando."
      subtitle="No es una herramienta más para aprender: es menos trabajo y más control sobre tu barbería."
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
        {BENEFICIOS.map((b, i) => (
          <Reveal
            key={b.title}
            delay={(i % 3) * 60}
            style={{ flex: '1 1 280px', maxWidth: 360, display: 'flex' }}
          >
            <FeatureCard icon={b.icon} title={b.title} body={b.body} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export default Beneficios;
