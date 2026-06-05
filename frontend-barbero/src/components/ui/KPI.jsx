// /frontend-barbero/src/components/ui/KPI.jsx
// Tarjeta compacta para mostrar una métrica numérica. Pensada para grillas
// (3 KPIs en línea) — toma todo el ancho del slot que le asigne el padre.

import { theme } from '../../theme/tokens.js';

/**
 * KPI
 * Tarjeta con label (micro-uppercase) + valor grande + sublabel opcional.
 * El color del valor cambia por `tone` para semantizar el dato (ej: completados en verde).
 * @param {string} props.label - Texto corto, se renderiza en mono uppercase.
 * @param {string|number} props.value - Valor principal (lo más grande de la card).
 * @param {string} [props.sublabel] - Texto secundario opcional debajo del valor.
 * @param {'default'|'success'|'warning'|'danger'|'accent'} [props.tone='default']
 *        - Color del valor. Resto de tonos del MD: §3.1.
 * @param {'lg'|'sm'} [props.size='lg'] - Tamaño del valor: 'lg' (24, contadores
 *        cortos) o 'sm' (18, ideal para moneda en grillas angostas).
 */
function KPI({ label, value, sublabel, tone = 'default', size = 'lg' }) {
  const colorValor = {
    default: theme.ink,
    success: theme.success,
    warning: theme.warning,
    danger:  theme.danger,
    accent:  theme.accent,
  }[tone] || theme.ink;

  // 'sm' (sizeHeading) para moneda en grillas angostas; 'lg' (sizeTitle) por
  // defecto, para contadores cortos (ej. los KPIs del Dashboard).
  const valueFontSize = size === 'sm' ? theme.sizeHeading : theme.sizeTitle;

  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0, // permite que el flex item se encoja correctamente
    }}>
      <div style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}>{label}</div>

      <div style={{
        fontFamily: theme.body,
        fontWeight: theme.weightHeading,
        fontSize: valueFontSize,
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        color: colorValor,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>

      {sublabel && (
        <div style={{
          fontFamily: theme.body,
          fontSize: theme.sizeMicro + 1,
          color: theme.muted,
          lineHeight: 1.3,
        }}>{sublabel}</div>
      )}
    </div>
  );
}

export default KPI;
