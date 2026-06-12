// /frontend-turnero/src/components/ui/EmptyState.jsx
// Bloque "no hay nada acá" — ícono + título + body + acción opcional.

import { theme } from '../../theme/tokens.js';

/**
 * EmptyState
 * Mensaje centrado para listas vacías o estados sin contenido.
 * @param {ReactNode} props.glyph - Ícono (SVG) que se muestra arriba
 * @param {string} props.title - Título corto
 * @param {string} props.body - Texto descriptivo
 * @param {ReactNode} [props.action] - Botón o link de acción
 */
function EmptyState({ glyph, title, body, action }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '32px 24px',
      gap: 6,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: theme.radiusLg,
        background: theme.surfaceAlt,
        border: `1px solid ${theme.hairline}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.muted,
        marginBottom: 8,
      }}>
        {glyph}
      </div>

      <div style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeHeading,
        color: theme.ink,
        letterSpacing: '-0.01em',
      }}>{title}</div>

      <div style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.muted,
        maxWidth: 280,
        lineHeight: 1.5,
      }}>{body}</div>

      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export default EmptyState;
