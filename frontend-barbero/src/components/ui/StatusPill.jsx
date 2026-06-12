// /frontend-barbero/src/components/ui/StatusPill.jsx
// Pill chiquito con dot de color — usado para "reservado", "cancelado", "completado".

import { theme } from '../../theme/tokens.js';

// Mapa de estado del turno → colores y label. Usado para no repetir if/else en pantallas.
const ESTADO_MAP = {
  reservado:  { bg: theme.accentSoft,  fg: theme.accent,  dot: theme.accent,  label: 'reservado' },
  cancelado:  { bg: theme.dangerSoft,  fg: theme.danger,  dot: theme.danger,  label: 'cancelado' },
  completado: { bg: theme.successSoft, fg: theme.success, dot: theme.success, label: 'completado' },
  no_asistio: { bg: theme.warningSoft, fg: theme.warning, dot: theme.warning, label: 'no asistió' },
};

/**
 * StatusPill
 * Renderiza un pill de estado.
 * @param {'reservado'|'cancelado'|'completado'|'no_asistio'} props.estado
 */
function StatusPill({ estado }) {
  const c = ESTADO_MAP[estado] || ESTADO_MAP.completado;
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      borderRadius: 999,
      background: c.bg,
      color: c.fg,
      fontFamily: theme.mono,
      fontWeight: theme.weightMedium,
      fontSize: 10,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: c.dot }}/>
      {c.label}
    </div>
  );
}

export default StatusPill;
