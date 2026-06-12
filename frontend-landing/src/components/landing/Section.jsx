// /frontend-landing/src/components/landing/Section.jsx
// Sección de la landing: ritmo vertical consistente, ancla para el nav, y un
// header opcional (eyebrow + h2 + subtítulo). El contenido va como children.

import { theme } from '../../theme/tokens.js';
import Container from './Container.jsx';
import Eyebrow from './Eyebrow.jsx';
import Reveal from './Reveal.jsx';

/**
 * Section
 * Envoltorio estándar de una sección de la landing.
 * @param {string} [props.id] - id para la navegación por ancla (#id)
 * @param {string} [props.eyebrow] - Micro-label superior
 * @param {string} [props.title] - Título de la sección (<h2>)
 * @param {string} [props.subtitle] - Texto descriptivo bajo el título
 * @param {'center'|'left'} [props.align='center'] - Alineación del header
 * @param {'default'|'alt'} [props.tone='default'] - Fondo (bg vs surfaceAlt) para alternar secciones
 * @param {string} [props.eyebrowColor] - Color del eyebrow (default: acento indigo)
 * @param {ReactNode} props.children - Contenido de la sección
 * @param {Object} [props.style] - Override puntual del <section>
 */
function Section({
  id,
  eyebrow,
  title,
  subtitle,
  align = 'center',
  tone = 'default',
  eyebrowColor,
  children,
  style,
}) {
  const hasHeader = eyebrow || title || subtitle;

  return (
    <section
      id={id}
      style={{
        paddingBlock: `clamp(${theme.sectionGapMin}px, 9vw, ${theme.sectionGapMax}px)`,
        background: tone === 'alt' ? theme.surfaceAlt : theme.bg,
        // Compensa el nav sticky al saltar a una ancla, para que el título no
        // quede tapado.
        scrollMarginTop: 80,
        ...style,
      }}
    >
      <Container>
        {hasHeader && (
          <Reveal
            as="header"
            style={{
              maxWidth: align === 'center' ? theme.maxWidthText : undefined,
              marginInline: align === 'center' ? 'auto' : undefined,
              marginBottom: 'clamp(32px, 5vw, 48px)',
              textAlign: align,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {eyebrow && <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>}
            {title && (
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
            )}
            {subtitle && (
              <p
                style={{
                  fontFamily: theme.body,
                  fontWeight: theme.weightRegular,
                  fontSize: 'clamp(15px, 2.2vw, 18px)',
                  lineHeight: 1.55,
                  color: theme.muted,
                  margin: 0,
                  maxWidth: align === 'center' ? 620 : undefined,
                  marginInline: align === 'center' ? 'auto' : undefined,
                }}
              >
                {subtitle}
              </p>
            )}
          </Reveal>
        )}
        {children}
      </Container>
    </section>
  );
}

export default Section;
