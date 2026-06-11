// /frontend-landing/src/components/landing/MetricCard.jsx
// Tarjeta de métrica para la sección Métricas: label + valor grande + badge de
// variación (verde) + mini-barras que sugieren la tendencia mes a mes. Los
// datos son ilustrativos (muestran la funcionalidad, no son de un tenant real).

import { ArrowUpRight } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import Card from '../ui/Card.jsx';

/**
 * Sparkbars
 * Mini gráfico de barras ascendentes (decorativo, aria-hidden).
 * @param {number[]} props.data - Valores de cada barra
 */
function Sparkbars({ data }) {
  const max = Math.max(...data);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 40 }} aria-hidden="true">
      {data.map((v, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(12, (v / max) * 100)}%`,
            background: theme.accent,
            borderRadius: 3,
            // Opacidad creciente → sensación de crecimiento.
            opacity: 0.35 + 0.65 * (i / (data.length - 1)),
          }}
        />
      ))}
    </div>
  );
}

/**
 * MetricCard
 * @param {string} props.label - Nombre de la métrica
 * @param {string} props.value - Valor grande (ya formateado)
 * @param {string} [props.delta] - Variación, ej "+18%" (muestra badge verde)
 * @param {string} [props.deltaLabel] - Contexto, ej "vs. el mes anterior"
 * @param {number[]} props.data - Datos de las mini-barras
 */
function MetricCard({ label, value, delta, deltaLabel, data }) {
  return (
    <Card
      padding={20}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: theme.sizeMicro,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: theme.muted,
          }}
        >
          {label}
        </span>
        {delta && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontFamily: theme.body,
              fontWeight: theme.weightMedium,
              fontSize: 12,
              color: theme.success,
              background: theme.successSoft,
              borderRadius: 999,
              padding: '3px 8px',
            }}
          >
            <ArrowUpRight size={12} strokeWidth={2.5} aria-hidden="true" />
            {delta}
          </span>
        )}
      </div>

      <div
        style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: 28,
          letterSpacing: '-0.02em',
          color: theme.ink,
        }}
      >
        {value}
      </div>

      <Sparkbars data={data} />

      {deltaLabel && (
        <span style={{ fontFamily: theme.body, fontSize: 13, color: theme.muted }}>{deltaLabel}</span>
      )}
    </Card>
  );
}

export default MetricCard;
