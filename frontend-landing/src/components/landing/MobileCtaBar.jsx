// /frontend-landing/src/components/landing/MobileCtaBar.jsx
// Barra de CTA fija abajo, SOLO en mobile. Mantiene el contacto a un toque
// mientras el visitante scrollea. Incluye un spacer en el flujo para que la
// barra fija no tape el final del contenido (footer).

import { MessageCircle } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { useIsDesktop } from '../../hooks/useMediaQuery.js';
import { linkWhatsApp } from '../../utils/contacto.js';
import Button from '../ui/Button.jsx';

/**
 * MobileCtaBar
 * Render nulo en desktop. Sin props.
 * @returns {JSX.Element|null}
 */
function MobileCtaBar() {
  const isDesktop = useIsDesktop();
  if (isDesktop) return null;

  return (
    <>
      {/* Spacer en flujo: reserva el alto de la barra fija. */}
      <div style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }} aria-hidden="true" />

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))',
          background: theme.surface,
          borderTop: `1px solid ${theme.hairline}`,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <Button href={linkWhatsApp()} external variant="primary" full>
          <MessageCircle size={18} strokeWidth={2} aria-hidden="true" />
          Probá tu primer mes gratis
        </Button>
      </div>
    </>
  );
}

export default MobileCtaBar;
