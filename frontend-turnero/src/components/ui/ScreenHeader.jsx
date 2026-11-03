// /frontend-turnero/src/components/ui/ScreenHeader.jsx
// Header de pantalla — eyebrow + title + subtitle. Acompaña a TopBar.

import { theme } from '../../theme/tokens.js';
import { estiloEyebrow } from './estilos.js';

/**
 * ScreenHeader
 * Bloque de título de cada pantalla del wizard.
 * @param {string} [props.eyebrow] - Texto pequeño superior (ej: "Tu turno")
 * @param {string} props.title - Título principal
 * @param {string} [props.subtitle] - Texto descriptivo bajo el título
 */
function ScreenHeader({ eyebrow, title, subtitle }) {
  return (
    <div style={{ padding: '4px 16px 16px' }}>
      {eyebrow && (
        <div style={{
          ...estiloEyebrow,
          marginBottom: 6,
        }}>{eyebrow}</div>
      )}

      <h2 style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeTitle,
        letterSpacing: '-0.02em',
        lineHeight: 1.15,
        color: theme.ink,
        margin: 0,
      }}>{title}</h2>

      {subtitle && (
        <div style={{
          fontFamily: theme.body,
          fontWeight: theme.weightRegular,
          fontSize: theme.sizeBody,
          lineHeight: 1.5,
          color: theme.muted,
          marginTop: 4,
        }}>{subtitle}</div>
      )}
    </div>
  );
}

export default ScreenHeader;
