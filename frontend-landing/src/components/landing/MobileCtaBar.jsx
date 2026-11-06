// /frontend-landing/src/components/landing/MobileCtaBar.jsx
// Barra de CTA fija abajo, SOLO en mobile. Mantiene el contacto a un toque
// mientras el visitante scrollea. Incluye un spacer en el flujo para que la
// barra fija no tape el final del contenido (footer).
// Está siempre en el HTML (la página se pre-renderiza); la clase
// `om-solo-mobile` (index.css) la oculta en desktop.

import { theme } from '../../theme/tokens.js';
import { linkWhatsApp } from '../../utils/contacto.js';
import Button from '../ui/Button.jsx';
import IconoWhatsApp from '../ui/IconoWhatsApp.jsx';

/**
 * MobileCtaBar
 * Oculta en desktop por CSS. Sin props.
 * @returns {JSX.Element}
 */
function MobileCtaBar() {
  return (
    <div className="om-solo-mobile">
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
          <IconoWhatsApp size={18} />
          Probá tu primer mes gratis
        </Button>
      </div>
    </div>
  );
}

export default MobileCtaBar;
