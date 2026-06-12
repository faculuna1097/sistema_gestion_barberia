// /frontend-landing/src/components/sections/Metricas.jsx
// Sección Métricas y control: que el dueño decida con datos. Tres tarjetas de
// métrica (ingresos, clientes, crecimiento) con datos ilustrativos.

import Section from '../landing/Section.jsx';
import Reveal from '../landing/Reveal.jsx';
import MetricCard from '../landing/MetricCard.jsx';
import { fmtPesos } from '../../utils/formato.js';

// Datos ilustrativos (muestran la funcionalidad, no son de un tenant real).
const METRICAS = [
  {
    label: 'Ingresos del mes',
    value: fmtPesos(842000),
    delta: '+18%',
    deltaLabel: 'vs. el mes anterior',
    data: [42, 50, 47, 58, 70, 86],
  },
  {
    label: 'Clientes atendidos',
    value: '318',
    delta: '+12%',
    deltaLabel: 'vs. el mes anterior',
    data: [60, 64, 62, 70, 78, 84],
  },
  {
    label: 'Crecimiento',
    value: '+31%',
    deltaLabel: 'en los últimos 3 meses',
    data: [48, 55, 58, 66, 75, 88],
  },
];

/**
 * Metricas
 * Sección de métricas y control. Sin props.
 * @returns {JSX.Element}
 */
function Metricas() {
  return (
    <Section
      id="metricas"
      tone="default"
      eyebrow="Números que sirven"
      title="Decidí con datos, no con la sensación."
      subtitle="Compará mes contra mes y mirá si estás creciendo de verdad. Sin armar un Excel: el sistema ya tiene tus números."
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
        {METRICAS.map((m, i) => (
          <Reveal
            key={m.label}
            delay={i * 80}
            style={{ flex: '1 1 240px', maxWidth: 340, display: 'flex' }}
          >
            <MetricCard {...m} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export default Metricas;
