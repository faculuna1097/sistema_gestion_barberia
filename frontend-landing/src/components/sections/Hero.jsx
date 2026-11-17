// /frontend-landing/src/components/sections/Hero.jsx
// Sección Hero: la promesa principal en menos de 5 segundos. Badge de la
// oferta + h1 (turnero y gestión conectados) + subtítulo + doble CTA +
// reaseguros con el precio, y debajo la captura de Planillas dentro de un
// ScreenshotFrame.

import { theme } from '../../theme/tokens.js';
import { linkWhatsApp } from '../../utils/contacto.js';
import { fmtPesos } from '../../utils/formato.js';
import { CAPTURAS, PRECIO } from '../../config/landing.js';
import Container from '../landing/Container.jsx';
import Button from '../ui/Button.jsx';
import IconoWhatsApp from '../ui/IconoWhatsApp.jsx';
import FreeMonthBadge from '../landing/FreeMonthBadge.jsx';
import ScreenshotFrame from '../landing/ScreenshotFrame.jsx';

/**
 * armarReaseguros
 * Arma los puntos de reaseguro bajo los CTA (bajan la fricción de
 * contactarse). El del precio sale de PRECIO, nunca con el número escrito; si
 * PRECIO.mensual es null, ese punto no va.
 * @returns {string[]} Textos de los reaseguros, en orden
 */
function armarReaseguros() {
  const reaseguros = ['Sin instalar nada: empezás en el día'];
  if (PRECIO.mensual != null) {
    reaseguros.push(`Después, ${fmtPesos(PRECIO.mensual)}/mes, barberos ilimitados`);
  }
  reaseguros.push('Cancelás cuando quieras');
  return reaseguros;
}

const REASEGUROS = armarReaseguros();

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
        {/* Bloque de texto. El Hero no usa <Reveal>: es el contenido principal
            y tiene que verse en el primer paint (una animación retrasaría el LCP). */}
        <div
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
              // Reparte las palabras parejas entre renglones: sin esto queda
              // "sistema." solo en el último. Un navegador que no lo soporta
              // corta como siempre.
              textWrap: 'balance',
            }}
          >
            Turnero online y gestión de tu barbería, conectados en un solo sistema.
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
            Turnos, caja, gastos y lo que le toca a cada barbero (comisiones),
            todo gestionado y organizado en un mismo lugar y no repartido entre
            el cuaderno, el Excel y el WhatsApp. Lo que reserva tu cliente llega
            solo a la caja. Hecho para barberías de Argentina, y te ayudamos a
            configurarlo.
          </p>

          {/* Doble CTA */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 4 }}>
            <Button href={linkWhatsApp()} external variant="primary" full={false}>
              <IconoWhatsApp size={18} />
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
                {/* El separador va solo en desktop: en celular los reaseguros
                    caen uno por renglón y el "·" quedaba al principio. */}
                {i > 0 && (
                  <span className="om-solo-desktop">
                    <span aria-hidden="true" style={{ color: theme.hairline }}>·</span>
                  </span>
                )}
                {r}
              </span>
            ))}
          </div>
        </div>

        {/* Captura de Planillas (reemplaza el registro en papel) */}
        <div
          style={{ maxWidth: 960, marginInline: 'auto', marginTop: 'clamp(40px, 6vw, 64px)' }}
        >
          <ScreenshotFrame
            image={CAPTURAS.planillas?.src}
            width={CAPTURAS.planillas?.width}
            height={CAPTURAS.planillas?.height}
            priority
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
              color: theme.muted,
            }}
          >
            Planilla semanal — sin cuaderno ni Excel
          </p>
        </div>
      </Container>
    </section>
  );
}

export default Hero;
