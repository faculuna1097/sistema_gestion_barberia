// /frontend/src/components/ui/BadgeEstado.jsx
// Pill chiquito que indica si un recurso está activo o inactivo.
// Promovido desde TabServicios al aparecer el segundo uso en TabProductos
// (regla §7.1 del sistema de diseño). Próximos usos esperados: TabBarberos.
//
// API mínima — solo el booleano. Si más adelante aparecen otros estados
// (ej. "borrador", "archivado"), se extiende con prop `estado` enum.

import { theme } from '../../theme/tokens.js';

/**
 * BadgeEstado
 * Pill compacto activo / inactivo en colores semánticos del sistema.
 *
 * @param {object} props
 * @param {boolean} props.activo
 */
function BadgeEstado({ activo }) {
  const cfg = activo
    ? { bg: theme.successSoft, color: theme.success, label: 'Activo' }
    : { bg: theme.surfaceAlt,  color: theme.muted,   label: 'Inactivo' };

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: theme.radiusSm,
      fontFamily: theme.body,
      fontSize: theme.sizeMicro,
      fontWeight: theme.weightMedium,
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
      background: cfg.bg,
      color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

export default BadgeEstado;
