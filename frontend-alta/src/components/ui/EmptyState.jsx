// /frontend-alta/src/components/ui/EmptyState.jsx
// Bloque "no hay nada acá" — ícono + título + body + acción opcional.
// Copia del primitivo del panel (frontend/src/components/ui/EmptyState.jsx), mismo
// aspecto. Suma `nivelTitulo`: acá un EmptyState puede ser toda la pantalla (los
// estados del link), y la pantalla necesita su h1 (sistema_de_disenio.md §5.5).

import { theme } from '../../theme/tokens.js';

// Tratamiento visual del wrapper del glyph según la semántica del estado.
// 'muted' (default) = aspecto neutro de siempre (fondo surfaceAlt + borde hairline).
// Las variantes semánticas tintan el fondo con su *Soft, pintan el glyph con el
// color fuerte (IconoAlerta y los íconos Lucide usan currentColor) y omiten el
// borde (el soft ya delimita). Mismo lenguaje cromático que Toast y los badges.
const TONOS = {
  muted:   { fondo: theme.surfaceAlt,  borde: theme.hairline, color: theme.muted },
  danger:  { fondo: theme.dangerSoft,  borde: 'transparent',  color: theme.danger },
  success: { fondo: theme.successSoft, borde: 'transparent',  color: theme.success },
  warning: { fondo: theme.warningSoft, borde: 'transparent',  color: theme.warning },
};

/**
 * EmptyState
 * Mensaje centrado para listas vacías o estados sin contenido.
 * @param {ReactNode} props.glyph - Ícono (SVG) que se muestra arriba
 * @param {string} props.title - Título corto
 * @param {string} props.body - Texto descriptivo
 * @param {ReactNode} [props.action] - Botón o link de acción
 * @param {'muted'|'danger'|'success'|'warning'} [props.tone='muted'] - Semántica del
 *   estado; tinta el wrapper del glyph. Default 'muted' = render neutro de siempre.
 * @param {number} [props.nivelTitulo] - Si viene (1 a 3), el título es un h1/h2/h3
 *   con el mismo aspecto; si no, un div.
 */
function EmptyState({ glyph, title, body, action, tone = 'muted', nivelTitulo }) {
  const Titulo = nivelTitulo ? `h${nivelTitulo}` : 'div';
  const t = TONOS[tone] || TONOS.muted;
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
        background: t.fondo,
        border: `1px solid ${t.borde}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: t.color,
        marginBottom: 8,
      }}>
        {glyph}
      </div>

      <Titulo style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: theme.sizeHeading,
        color: theme.ink,
        letterSpacing: '-0.01em',
        textWrap: 'balance',
      }}>{title}</Titulo>

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
