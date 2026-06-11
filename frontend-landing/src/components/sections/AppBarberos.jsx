// /frontend-landing/src/components/sections/AppBarberos.jsx
// Sección App para barberos: cómo un barbero organiza su día. Foco en
// organización y ahorro de tiempo. Texto + video (lado video a la izquierda,
// para alternar con la sección Turnero).

import { VIDEOS } from '../../config/landing.js';
import SplitFeature from '../landing/SplitFeature.jsx';
import VideoEmbed from '../landing/VideoEmbed.jsx';

const BENEFICIOS = [
  'Calendario de turnos del día',
  'Vista semanal de la agenda',
  'Gestión de sus horarios',
  'Vacaciones y días libres',
  'Carga un turno nuevo en segundos',
];

/**
 * AppBarberos
 * Sección de la app del barbero. Sin props.
 * @returns {JSX.Element}
 */
function AppBarberos() {
  return (
    <SplitFeature
      id="barberos"
      tone="default"
      reverse
      eyebrow="App para barberos"
      title="Cada barbero llega y ya sabe cómo viene el día."
      subtitle="Su agenda, sus horarios y sus días libres, en el teléfono. Menos preguntas, menos huecos, menos turnos perdidos."
      items={BENEFICIOS}
      media={<VideoEmbed {...VIDEOS.barbero} title="La app del barbero" />}
    />
  );
}

export default AppBarberos;
