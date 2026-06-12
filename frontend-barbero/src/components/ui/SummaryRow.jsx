// /frontend-barbero/src/components/ui/SummaryRow.jsx
// Fila label/value usada en pantallas de resumen (Confirmacion, GestionTurno).

import { theme } from '../../theme/tokens.js';

/**
 * SummaryRow
 * Fila con label a la izquierda (eyebrow uppercase) y valor a la derecha (bodyStrong).
 * Lleva un border-bottom sutil que separa de la fila siguiente.
 * @param {string} props.label - Texto de la izquierda
 * @param {string|ReactNode} props.value - Texto/nodo de la derecha
 */
function SummaryRow({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 12,
      padding: '10px 0',
      borderBottom: `1px solid ${theme.hairlineSoft}`,
    }}>
      <div style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
        flexShrink: 0,
      }}>{label}</div>

      <div style={{
        fontFamily: theme.body,
        fontWeight: theme.weightMedium,
        fontSize: 13,
        color: theme.ink,
        textAlign: 'right',
        minWidth: 0,
        wordBreak: 'break-word',
      }}>{value}</div>
    </div>
  );
}

export default SummaryRow;
