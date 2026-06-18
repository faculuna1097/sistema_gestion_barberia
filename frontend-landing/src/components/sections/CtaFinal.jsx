// /frontend-landing/src/components/sections/CtaFinal.jsx
// Cierre de la landing: banda indigo a todo lo ancho con la propuesta repetida
// y los dos CTA (WhatsApp + email) en alto contraste sobre el fondo de acento.

import { useState } from 'react';
import { MessageCircle, Mail, Gift } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { linkWhatsApp, linkEmail } from '../../utils/contacto.js';
import Container from '../landing/Container.jsx';
import Reveal from '../landing/Reveal.jsx';

/**
 * BotonCta
 * Botón/enlace pensado para el fondo indigo. `solid` = blanco lleno; si no,
 * contorno blanco translúcido.
 * @param {string} props.href
 * @param {boolean} [props.solid=false]
 * @param {ReactNode} props.children
 */
function BotonCta({ href, solid = false, children }) {
  const [hover, setHover] = useState(false);

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '13px 22px',
    borderRadius: theme.radius,
    fontFamily: theme.body,
    fontWeight: theme.weightMedium,
    fontSize: 15,
    transition: `background ${theme.transitionFast}, filter ${theme.transitionFast}`,
    cursor: 'pointer',
  };

  const variante = solid
    ? {
        background: theme.surface,
        color: theme.accent,
        boxShadow: theme.shadowSm,
        filter: hover ? 'brightness(0.96)' : 'none',
      }
    : {
        background: hover ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
        color: theme.accentInk,
        border: '1px solid rgba(255,255,255,0.45)',
      };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variante }}
    >
      {children}
    </a>
  );
}

/**
 * CtaFinal
 * Banda de cierre con CTA. Sin props.
 * @returns {JSX.Element}
 */
function CtaFinal() {
  return (
    <section
      id="empezar"
      style={{ background: theme.accent, paddingBlock: `clamp(${theme.sectionGapMin}px, 9vw, ${theme.sectionGapMax}px)` }}
    >
      <Container>
        <Reveal
          style={{
            maxWidth: 680,
            marginInline: 'auto',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          {/* Badge sobre fondo oscuro */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: theme.mono,
              fontWeight: theme.weightMedium,
              fontSize: theme.sizeMicro,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: theme.accentInk,
              background: 'rgba(255,255,255,0.15)',
              padding: '6px 12px',
              borderRadius: 999,
            }}
          >
            <Gift size={13} strokeWidth={1.75} aria-hidden="true" />
            Primer mes gratis
          </span>

          <h2
            style={{
              fontFamily: theme.body,
              fontWeight: theme.weightHeading,
              fontSize: `clamp(28px, 5vw, 40px)`,
              letterSpacing: '-0.02em',
              lineHeight: 1.12,
              color: theme.accentInk,
              margin: 0,
            }}
          >
            Probá BarberManager gratis durante tu primer mes.
          </h2>

          <p
            style={{
              fontFamily: theme.body,
              fontSize: 'clamp(16px, 2.4vw, 18px)',
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.85)',
              margin: 0,
            }}
          >
            Te ayudamos a dar de alta tu barbería y empezás a trabajar ordenado esta semana.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 4 }}>
            <BotonCta href={linkWhatsApp()} solid>
              <MessageCircle size={18} strokeWidth={2} aria-hidden="true" />
              Quiero empezar
            </BotonCta>
            <BotonCta href={linkEmail()}>
              <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
              Escribinos por email
            </BotonCta>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export default CtaFinal;
