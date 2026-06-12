// /frontend-landing/src/components/landing/ScreenshotFrame.jsx
// Marco para mostrar capturas del producto. Bordes redondeados + sombra para
// el aire premium de las landings SaaS, sin glassmorphism ni gradientes (§2).
// Si todavía no hay imagen, muestra un placeholder neutro (no rompe el layout).
// El "chrome" tipo navegador es opcional (off por defecto, para no duplicar
// chrome si la captura ya lo trae).

import { Image as ImageIcon } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * ChromeBar
 * Barra superior tipo navegador (puntos + url). Solo si chrome=true.
 * @param {string} props.label - Texto de la barra de URL
 */
function ChromeBar({ label }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderBottom: `1px solid ${theme.hairlineSoft}`,
        background: theme.surfaceAlt,
      }}
    >
      <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 10, height: 10, borderRadius: 999, background: theme.hairline }} />
        ))}
      </div>
      <div
        style={{
          flex: 1,
          maxWidth: 260,
          marginInline: 'auto',
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: theme.sizeMicro,
          color: theme.mutedSoft,
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          borderRadius: 999,
          padding: '4px 12px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
      <div style={{ width: 42 }} aria-hidden="true" />
    </div>
  );
}

/**
 * Placeholder
 * Caja neutra que ocupa el lugar de la captura hasta que se suba.
 * @param {string} props.label - Texto del placeholder
 */
function Placeholder({ label }) {
  return (
    <div
      style={{
        aspectRatio: '16 / 10',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        background: theme.surfaceAlt,
        color: theme.mutedSoft,
      }}
    >
      <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
      <span style={{ fontFamily: theme.body, fontSize: 13 }}>{label}</span>
    </div>
  );
}

/**
 * ScreenshotFrame
 * Marco que contiene una captura del producto (o un placeholder).
 * @param {string} [props.image] - URL de la captura; si falta, muestra placeholder
 * @param {string} [props.alt=''] - Texto alternativo de la imagen
 * @param {ReactNode} [props.children] - Contenido alternativo si no hay image
 * @param {boolean} [props.chrome=false] - Muestra la barra tipo navegador
 * @param {string} [props.label='barbermanager.app'] - URL de la ChromeBar
 * @param {string} [props.placeholderLabel='Captura del producto'] - Texto del placeholder
 * @param {Object} [props.style] - Override del contenedor
 */
function ScreenshotFrame({
  image,
  alt = '',
  children,
  chrome = false,
  label = 'barbermanager.app',
  placeholderLabel = 'Captura del producto',
  style,
}) {
  return (
    <div
      style={{
        borderRadius: theme.radiusLg,
        border: `1px solid ${theme.hairline}`,
        background: theme.surface,
        boxShadow: theme.shadowLg,
        overflow: 'hidden',
        ...style,
      }}
    >
      {chrome && <ChromeBar label={label} />}
      {image ? (
        <img src={image} alt={alt} style={{ display: 'block', width: '100%' }} />
      ) : (
        children ?? <Placeholder label={placeholderLabel} />
      )}
    </div>
  );
}

export default ScreenshotFrame;
