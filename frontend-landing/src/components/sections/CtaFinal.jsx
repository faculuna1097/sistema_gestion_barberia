// /frontend-landing/src/components/sections/CtaFinal.jsx
// Cierre de la landing: banda indigo a todo lo ancho con la propuesta repetida
// y el CTA de WhatsApp en alto contraste sobre el fondo de acento. El email
// queda solo en el footer, para no competir con WhatsApp.

import { useState } from 'react';
import { Gift } from 'lucide-react';
import IconoWhatsApp from '../ui/IconoWhatsApp.jsx';
import { theme } from '../../theme/tokens.js';
import { linkWhatsApp } from '../../utils/contacto.js';
import Container from '../landing/Container.jsx';
import Reveal from '../landing/Reveal.jsx';

/**
 * BotonCta
 * Enlace con forma de botón pensado para el fondo indigo: blanco lleno, con
 * el texto en el color de acento. Abre en una pestaña nueva.
 * @param {string} props.href - Destino del enlace
 * @param {ReactNode} props.children - Contenido del botón
 * @returns {JSX.Element}
 */
function BotonCta({ href, children }) {
  const [hover, setHover] = useState(false);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '13px 22px',
        borderRadius: theme.radius,
        fontFamily: theme.body,
        fontWeight: theme.weightMedium,
        fontSize: 15,
        transition: `filter ${theme.transitionFast}`,
        cursor: 'pointer',
        background: theme.surface,
        color: theme.accent,
        boxShadow: theme.shadowSm,
        filter: hover ? 'brightness(0.96)' : 'none',
      }}
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
              // Renglones parejos: sin esto, en celular queda "mes." solo.
              textWrap: 'balance',
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
            <BotonCta href={linkWhatsApp()}>
              <IconoWhatsApp size={18} />
              Quiero empezar
            </BotonCta>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export default CtaFinal;
