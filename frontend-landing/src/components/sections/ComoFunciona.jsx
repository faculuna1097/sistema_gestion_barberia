// /frontend-landing/src/components/sections/ComoFunciona.jsx
// Sección Cómo Funciona: el diagrama de flujo que muestra que las tres partes
// del producto están conectadas, de la reserva al cierre de caja.

import { theme } from '../../theme/tokens.js';
import Section from '../landing/Section.jsx';
import Reveal from '../landing/Reveal.jsx';
import FlowDiagram from '../landing/FlowDiagram.jsx';

/**
 * ComoFunciona
 * Sección del flujo conectado. Sin props.
 * @returns {JSX.Element}
 */
function ComoFunciona() {
  return (
    <Section
      id="como-funciona"
      tone="default"
      eyebrow="Todo conectado"
      title="Una sola operación, de la reserva al cierre de caja."
      subtitle="El cliente reserva, el barbero atiende y vos ves todo ordenado. La misma información viaja por las tres partes sin que la cargues dos veces."
    >
      <Reveal>
        <FlowDiagram />
      </Reveal>

      <p
        style={{
          textAlign: 'center',
          marginTop: 'clamp(24px, 4vw, 32px)',
          fontFamily: theme.body,
          fontSize: 'clamp(15px, 2.2vw, 17px)',
          fontWeight: theme.weightMedium,
          color: theme.inkSoft,
        }}
      >
        Sin cargar nada dos veces. Sin pasar datos de un lado a otro.
      </p>
    </Section>
  );
}

export default ComoFunciona;
