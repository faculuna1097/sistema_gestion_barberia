// /frontend-turnero/src/components/ui/SummaryRow.jsx
// Fila label/value usada en pantallas de resumen (los datos del cliente en GestionTurno).

import { theme } from '../../theme/tokens.js';
import { estiloEyebrow } from './estilos.js';

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
        ...estiloEyebrow,
        flexShrink: 0,
      }}>{label}</div>

      <div style={{
        fontFamily: theme.body,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeBody,
        color: theme.ink,
        textAlign: 'right',
        minWidth: 0,
        wordBreak: 'break-word',
      }}>{value}</div>
    </div>
  );
}

export default SummaryRow;
