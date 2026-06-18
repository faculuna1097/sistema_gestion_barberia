// /frontend-landing/src/components/landing/LandingNav.jsx
// Barra de navegación superior fija. Logo + anclas (desktop) + CTA de WhatsApp.
// Gana fondo sólido y sombra al hacer scroll, para despegarse del contenido.

import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { useIsDesktop } from '../../hooks/useMediaQuery.js';
import { MARCA } from '../../config/landing.js';
import { linkWhatsApp } from '../../utils/contacto.js';
import Button from '../ui/Button.jsx';

// Anclas de navegación. El href apunta al id de cada Section.
const ANCLAS = [
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Funciones', href: '#sistema-gestion' },
  { label: 'Precio', href: '#plan' },
  { label: 'Preguntas', href: '#faq' },
];

/**
 * Logo
 * Monograma indigo "B" + nombre de marca. Enlaza al tope de la página.
 */
function Logo() {
  return (
    <a
      href="#inicio"
      aria-label={`${MARCA.nombre} — inicio`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 8,
          background: theme.accent,
          color: theme.accentInk,
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: 17,
          lineHeight: 1,
        }}
      >
        B
      </span>
      <span
        style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: 16,
          letterSpacing: '-0.01em',
          color: theme.ink,
        }}
      >
        {MARCA.nombre}
      </span>
    </a>
  );
}

/**
 * NavLink
 * Ancla del nav con cambio de color en hover.
 * @param {string} props.href
 * @param {ReactNode} props.children
 */
function NavLink({ href, children }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: theme.body,
        fontWeight: theme.weightMedium,
        fontSize: 14,
        color: hover ? theme.ink : theme.muted,
        transition: `color ${theme.transitionFast}`,
        padding: '8px 4px',
      }}
    >
      {children}
    </a>
  );
}

/**
 * LandingNav
 * Header sticky de la landing. Sin props.
 */
function LandingNav() {
  const isDesktop = useIsDesktop();
  const [scrolled, setScrolled] = useState(false);

  // Detecta scroll para alternar el estilo "flotante" del nav.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        // Fondo sólido al scrollear (sin blur: el sistema prohíbe glassmorphism §2).
        background: scrolled ? theme.surface : 'transparent',
        borderBottom: `1px solid ${scrolled ? theme.hairline : 'transparent'}`,
        boxShadow: scrolled ? theme.shadowSm : 'none',
        transition: `background ${theme.transitionMedium}, box-shadow ${theme.transitionMedium}, border-color ${theme.transitionMedium}`,
      }}
    >
      <nav
        style={{
          width: '100%',
          maxWidth: theme.maxWidthWide,
          marginInline: 'auto',
          height: 64,
          paddingInline: 'clamp(20px, 5vw, 24px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Logo />

        {/* Anclas — solo desktop */}
        {isDesktop && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {ANCLAS.map((a) => (
              <NavLink key={a.href} href={a.href}>{a.label}</NavLink>
            ))}
          </div>
        )}

        {/* CTA del nav: solo en desktop. En mobile la barra fija de abajo
            (MobileCtaBar) ya mantiene el contacto a un toque; tener los dos
            persistentes a la vez saturaba. */}
        {isDesktop && (
          <Button
            href={linkWhatsApp()}
            external
            variant="primary"
            full={false}
            style={{ padding: '8px 14px' }}
          >
            <MessageCircle size={16} strokeWidth={2} aria-hidden="true" />
            Primer mes gratis
          </Button>
        )}
      </nav>
    </header>
  );
}

export default LandingNav;
