// /frontend-turnero/src/components/ui/Progress.jsx
// Indicador de progreso del wizard — stepper "01/06 ── Servicio".

import { theme } from '../../theme/tokens.js';

// Etiquetas de cada paso del wizard de reserva.
const STEP_LABELS = ['Servicio', 'Barbero', 'Fecha', 'Horario', 'Datos', 'Confirmar'];

/**
 * Progress
 * Stepper minimalista. Muestra "0X/0Y ── Label".
 * @param {number} props.step - Paso actual (1-based)
 * @param {number} [props.total=6] - Total de pasos
 * @param {Array<string>} [props.labels] - Labels custom (default: del wizard de reserva)
 */
function Progress({ step, total = 6, labels = STEP_LABELS }) {
  if (step < 1 || step > total) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '0 16px 12px',
      fontFamily: theme.mono,
      fontSize: theme.sizeMicro,
      color: theme.muted,
      letterSpacing: '0.04em',
    }}>
      <span style={{ color: theme.ink, fontWeight: theme.weightHeading }}>
        {String(step).padStart(2, '0')}
      </span>
      <span>/{String(total).padStart(2, '0')}</span>
      <span style={{
        flex: 1,
        height: 1,
        background: theme.hairline,
        margin: '0 8px',
      }}/>
      <span>{labels[step - 1]}</span>
    </div>
  );
}

export default Progress;
