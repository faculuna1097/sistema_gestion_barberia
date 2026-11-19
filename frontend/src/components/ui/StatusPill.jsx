// /frontend/src/components/ui/StatusPill.jsx
// Pill chiquito con dot de color — usado para "reservado", "cancelado", "completado".
// Nació como copia del primitivo de frontend-turnero. Desde el 2026-11-19 (F4 de
// plan_mejoras_operativas.md) el del panel suma la marca "socio" de Gestión →
// Barberos, que el turnero no tiene.

import { theme } from '../../theme/tokens.js';

// Mapa de estado del turno → colores y label. Usado para no repetir if/else en pantallas.
const ESTADO_MAP = {
  reservado:  { bg: theme.successSoft, fg: theme.success, dot: theme.success, label: 'reservado' },
  cancelado:  { bg: theme.dangerSoft,  fg: theme.danger,  dot: theme.danger,  label: 'cancelado' },
  completado: { bg: theme.surfaceAlt,  fg: theme.muted,   dot: theme.muted,   label: 'completado' },
  // No es un estado del turno: el barbero está vinculado a un socio activo.
  socio:      { bg: theme.accentSoft,  fg: theme.accent,  dot: theme.accent,  label: 'socio' },
};

/**
 * StatusPill
 * Renderiza un pill de estado (o la marca de socio de un barbero).
 * @param {'reservado'|'cancelado'|'completado'|'socio'} props.estado
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
      fontSize: theme.sizeMicro,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: c.dot }}/>
      {c.label}
    </div>
  );
}

export default StatusPill;
