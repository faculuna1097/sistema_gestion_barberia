// /frontend/src/components/ui/BadgeVariacion.jsx
// Primitivo BadgeVariacion — pill de comparativa porcentual.
//
// Visual: pill compacto (radius 999) con ícono Lucide ▲/▼ y el % en abs.
//   - pct ≥ 0  → bg theme.successSoft + fg theme.success + TrendingUp.
//   - pct < 0  → bg theme.dangerSoft  + fg theme.danger  + TrendingDown.
//   - pct null → texto muted plano con `sinDatosLabel` (estado neutro,
//     útil cuando no hay período previo para comparar).
//
// Primer uso: SeccionInicio (comparativo del mes). Segundo uso: SeccionBalances
// (histórico anual, columna "vs anterior").
//
// Nota: el componente NO concatena texto extra al pct (ej. "vs marzo"); la
// composición visual se arma desde el caller para no acoplar el primitivo a
// una semántica particular.

import { TrendingUp, TrendingDown } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * BadgeVariacion
 * @param {object} props
 * @param {number|null|undefined} props.pct - Porcentaje de variación. Si es
 *   null/undefined, se renderiza el fallback neutro.
 * @param {string} [props.sinDatosLabel] - Texto del fallback cuando pct es null.
 */
function BadgeVariacion({ pct, sinDatosLabel = 'Sin datos previos' }) {
  if (pct === null || pct === undefined) {
    return (
      <span style={{
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: theme.mutedSoft,
        fontWeight: theme.weightMedium,
      }}>{sinDatosLabel}</span>
    );
  }

  const subiendo = pct >= 0;
  const Icon = subiendo ? TrendingUp : TrendingDown;
  const fg = subiendo ? theme.success : theme.danger;
  const bg = subiendo ? theme.successSoft : theme.dangerSoft;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 999,
      background: bg,
      color: fg,
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
      fontWeight: theme.weightMedium,
      letterSpacing: '-0.005em',
    }}>
      <Icon size={14} strokeWidth={2} />
      {Math.abs(pct)}%
    </span>
  );
}

export default BadgeVariacion;
