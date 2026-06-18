// /frontend-landing/src/components/sections/Turnero.jsx
// Sección Turnero: cómo los clientes reservan solos. Foco en la facilidad de
// uso, sin explicar tecnología. Texto + video (lado video a la derecha). Sin CTA
// inline: interrumpía el demo. El contacto vive en Hero, Plan y el cierre.

import { VIDEOS } from '../../config/landing.js';
import SplitFeature from '../landing/SplitFeature.jsx';
import VideoEmbed from '../landing/VideoEmbed.jsx';

const BENEFICIOS = [
  'Reserva 100% online, a cualquier hora',
  'El cliente elige su barbero',
  'Elige el servicio que quiere',
  'Confirmación inmediata',
  'Recordatorio por email para que no falte',
];

/**
 * Turnero
 * Sección del turnero para clientes. Sin props.
 * @returns {JSX.Element}
 */
function Turnero() {
  return (
    <SplitFeature
      id="turnero"
      tone="alt"
      eyebrow="Turnero online"
      title="Tus clientes reservan solos, sin que muevas un dedo."
      subtitle="Un link que compartís en Instagram o WhatsApp. El cliente elige, confirma y listo. Vos dejás de hacer de secretaria."
      items={BENEFICIOS}
      media={<VideoEmbed {...VIDEOS.turnero} title="Reservar un turno online" style={{ maxWidth: 320, marginInline: 'auto' }} />}
    />
  );
}

export default Turnero;
