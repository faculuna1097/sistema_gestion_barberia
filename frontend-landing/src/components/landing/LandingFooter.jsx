// /frontend-landing/src/components/landing/LandingFooter.jsx
// Pie de la landing: marca + tagline, navegación, contacto y copyright.

import { useState } from 'react';
import { MessageCircle, Mail } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { MARCA, CONTACTO } from '../../config/landing.js';
import { linkWhatsApp, linkEmail } from '../../utils/contacto.js';
import Container from './Container.jsx';

// Fondo del chip del logo (indigo de marca): igual al fondo del emblema, para que
// el recuadro redondeado se vea seamless y recorte las esquinas de la imagen.
const LOGO_BG = theme.accent;

// Anclas reusadas en el footer (mismas que el nav).
const ANCLAS = [
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Funciones', href: '#sistema-gestion' },
  { label: 'Precio', href: '#plan' },
  { label: 'Preguntas', href: '#faq' },
];

/**
 * FooterLink
 * Enlace del footer con hover sutil. Sirve para anclas y para links externos.
 * @param {string} props.href
 * @param {boolean} [props.external=false]
 * @param {ReactNode} props.children
 */
function FooterLink({ href, external = false, children }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: theme.body,
        fontSize: 14,
        color: hover ? theme.ink : theme.muted,
        transition: `color ${theme.transitionFast}`,
        padding: '2px 0',
      }}
    >
      {children}
    </a>
  );
}

/**
 * LandingFooter
 * Pie de página. Sin props.
 */
function LandingFooter() {
  const anio = new Date().getFullYear();

  return (
    <footer
      style={{
        background: theme.surface,
        borderTop: `1px solid ${theme.hairline}`,
        paddingBlock: 'clamp(40px, 6vw, 64px)',
      }}
    >
      <Container>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'clamp(32px, 6vw, 64px)',
            justifyContent: 'space-between',
          }}
        >
          {/* Marca + tagline */}
          <div style={{ maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: theme.body,
                fontWeight: theme.weightHeading,
                fontSize: 16,
                color: theme.ink,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: LOGO_BG,
                  overflow: 'hidden',
                  flex: '0 0 auto',
                }}
              >
                <img
                  src="/logo.png"
                  alt=""
                  width={28}
                  height={28}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </span>
              {MARCA.nombre}
            </span>
            <p style={{ fontFamily: theme.body, fontSize: 14, color: theme.muted, margin: 0, lineHeight: 1.5 }}>
              {MARCA.tagline}. Todo tu negocio en un solo lugar.
            </p>
          </div>

          {/* Navegación */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: theme.sizeMicro,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: theme.mutedSoft,
                marginBottom: 4,
              }}
            >
              Navegación
            </span>
            {ANCLAS.map((a) => (
              <FooterLink key={a.href} href={a.href}>{a.label}</FooterLink>
            ))}
          </nav>

          {/* Contacto */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: theme.sizeMicro,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: theme.mutedSoft,
                marginBottom: 4,
              }}
            >
              Contacto
            </span>
            <FooterLink href={linkWhatsApp()} external>
              <MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" />
              {CONTACTO.whatsappDisplay}
            </FooterLink>
            <FooterLink href={linkEmail()} external>
              <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
              {CONTACTO.email}
            </FooterLink>
          </div>
        </div>

        {/* Línea inferior */}
        <div
          style={{
            marginTop: 'clamp(32px, 5vw, 48px)',
            paddingTop: 20,
            borderTop: `1px solid ${theme.hairline}`,
            fontFamily: theme.body,
            fontSize: 13,
            color: theme.mutedSoft,
          }}
        >
          © {anio} {MARCA.nombre}. Hecho para barberías.
        </div>
      </Container>
    </footer>
  );
}

export default LandingFooter;
