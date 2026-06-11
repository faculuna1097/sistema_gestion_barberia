// /frontend-landing/src/components/landing/SplitFeature.jsx
// Layout de sección "texto + medio" en dos columnas (apiladas en mobile).
// Reusado por Turnero, App barberos y Sistema de gestión. `reverse` alterna el
// lado del medio para dar ritmo entre secciones consecutivas.

import { theme } from '../../theme/tokens.js';
import { useIsDesktop } from '../../hooks/useMediaQuery.js';
import Section from './Section.jsx';
import Eyebrow from './Eyebrow.jsx';
import Reveal from './Reveal.jsx';
import FeatureList from './FeatureList.jsx';

/**
 * SplitFeature
 * @param {string} [props.id] - id de ancla
 * @param {'default'|'alt'} [props.tone='default'] - Fondo de la sección
 * @param {string} props.eyebrow - Micro-label
 * @param {string} props.title - Título (<h2>)
 * @param {string} props.subtitle - Texto descriptivo
 * @param {string[]} [props.items] - Beneficios (FeatureList)
 * @param {ReactNode} props.media - El medio (VideoEmbed / ScreenshotFrame)
 * @param {ReactNode} [props.cta] - CTA opcional bajo el texto
 * @param {boolean} [props.reverse=false] - Pone el medio a la izquierda en desktop
 * @returns {JSX.Element}
 */
function SplitFeature({ id, tone = 'default', eyebrow, title, subtitle, items, media, cta, reverse = false }) {
  const isDesktop = useIsDesktop();

  return (
    <Section id={id} tone={tone}>
      <div
        style={{
          display: 'flex',
          flexDirection: isDesktop ? 'row' : 'column',
          alignItems: 'center',
          gap: 'clamp(32px, 6vw, 64px)',
        }}
      >
        {/* Columna de texto */}
        <Reveal
          style={{
            flex: '1 1 0',
            minWidth: 0,
            width: '100%',
            order: isDesktop && reverse ? 2 : 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2
            style={{
              fontFamily: theme.body,
              fontWeight: theme.weightHeading,
              fontSize: `clamp(${theme.sizeTitle}px, 4vw, ${theme.sizeSection}px)`,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              color: theme.ink,
              margin: 0,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                fontFamily: theme.body,
                fontSize: 'clamp(15px, 2.2vw, 18px)',
                lineHeight: 1.55,
                color: theme.muted,
                margin: 0,
              }}
            >
              {subtitle}
            </p>
          )}
          {items && <FeatureList items={items} style={{ marginTop: 4 }} />}
          {cta && <div style={{ marginTop: 8 }}>{cta}</div>}
        </Reveal>

        {/* Columna del medio */}
        <Reveal
          delay={120}
          style={{
            flex: '1 1 0',
            minWidth: 0,
            width: '100%',
            order: isDesktop && reverse ? 1 : 2,
          }}
        >
          {media}
        </Reveal>
      </div>
    </Section>
  );
}

export default SplitFeature;
