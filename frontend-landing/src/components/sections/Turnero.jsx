// /frontend-landing/src/components/sections/Turnero.jsx
// Sección Turnero: cómo los clientes reservan solos. Foco en la facilidad de
// uso, sin explicar tecnología. Texto + video (lado video a la derecha).
// El CTA de contacto no va acá (interrumpía el demo): vive en Hero, Plan y el
// cierre. El botón de esta sección es otra cosa: una prueba del producto, que
// abre el turnero real de la barbería de ejemplo (DEMO.turnero).

import { VIDEOS, DEMO } from '../../config/landing.js';
import SplitFeature from '../landing/SplitFeature.jsx';
import VideoEmbed from '../landing/VideoEmbed.jsx';
import Button from '../ui/Button.jsx';

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
      cta={
        <Button href={DEMO.turnero} external variant="secondary" full={false}>
          Probá reservar en una barbería de ejemplo
        </Button>
      }
      media={<VideoEmbed {...VIDEOS.turnero} title="Reservar un turno online" style={{ maxWidth: 320, marginInline: 'auto' }} />}
    />
  );
}

export default Turnero;
