// /frontend-landing/src/components/sections/Hero.jsx
// Sección Hero: la promesa principal en menos de 5 segundos. Badge de la
// oferta + h1 + subtítulo + doble CTA + reaseguro, y debajo el mockup del
// panel dentro de un ScreenshotFrame.

import { MessageCircle } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { linkWhatsApp } from '../../utils/contacto.js';
import { CAPTURAS } from '../../config/landing.js';
import Container from '../landing/Container.jsx';
import Reveal from '../landing/Reveal.jsx';
import Button from '../ui/Button.jsx';
import FreeMonthBadge from '../landing/FreeMonthBadge.jsx';
import ScreenshotFrame from '../landing/ScreenshotFrame.jsx';

// Puntos de reaseguro bajo los CTA (bajan la fricción de contactarse).
const REASEGUROS = ['Sin instalar nada', 'Te ayudamos a configurarlo', 'Cancelás cuando quieras'];

/**
 * Hero
 * Encabezado principal de la landing. Sin props.
 * @returns {JSX.Element}
 */
function Hero() {
  return (
    <section
      id="inicio"
      style={{
        background: theme.bg,
        paddingTop: 'clamp(40px, 7vw, 72px)',
        paddingBottom: 'clamp(48px, 8vw, 96px)',
      }}
    >
      <Container>
        {/* Bloque de texto */}
        <Reveal
          style={{
            maxWidth: 720,
            marginInline: 'auto',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <FreeMonthBadge animate />

          <h1
            style={{
              fontFamily: theme.body,
              fontWeight: theme.weightHeading,
              fontSize: `clamp(32px, 7vw, ${theme.sizeDisplay}px)`,
              letterSpacing: '-0.025em',
              lineHeight: 1.08,
              color: theme.ink,
              margin: 0,
            }}
          >
            Gestioná toda tu barbería desde un solo lugar.
          </h1>

          <p
            style={{
              fontFamily: theme.body,
              fontSize: 'clamp(16px, 2.6vw, 20px)',
              lineHeight: 1.55,
              color: theme.muted,
              margin: 0,
              maxWidth: 600,
            }}
          >
            Turnos, caja, barberos y números. Todo conectado, sin planillas
            sueltas ni el WhatsApp desbordado. Lo configurás en minutos y
            trabajás más ordenado desde el primer día.
          </p>

          {/* Doble CTA */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 4 }}>
            <Button href={linkWhatsApp()} external variant="primary" full={false}>
              <MessageCircle size={18} strokeWidth={2} aria-hidden="true" />
              Probá tu primer mes gratis
            </Button>
            <Button href="#como-funciona" variant="secondary" full={false}>
              Ver cómo funciona
            </Button>
          </div>

          {/* Reaseguros */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 16px',
              justifyContent: 'center',
              fontFamily: theme.body,
              fontSize: 13,
              color: theme.muted,
            }}
          >
            {REASEGUROS.map((r, i) => (
              <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && <span aria-hidden="true" style={{ color: theme.hairline }}>·</span>}
                {r}
              </span>
            ))}
          </div>
        </Reveal>

        {/* Captura de Planillas (reemplaza el registro en papel) */}
        <Reveal
          delay={120}
          style={{ maxWidth: 960, marginInline: 'auto', marginTop: 'clamp(40px, 6vw, 64px)' }}
        >
          <ScreenshotFrame
            image={CAPTURAS.planillas}
            alt="Planilla semanal de BarberManager con el detalle de cada barbero"
            placeholderLabel="Captura de Planillas"
          />
          <p
            style={{
              textAlign: 'center',
              marginTop: 14,
              fontFamily: theme.mono,
              fontSize: theme.sizeMicro,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: theme.mutedSoft,
            }}
          >
            Planilla semanal — sin cuaderno ni Excel
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

export default Hero;
