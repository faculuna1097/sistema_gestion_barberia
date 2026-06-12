// /frontend-landing/src/components/landing/FeatureCard.jsx
// Tarjeta de "ícono + título + texto". La usan la sección Problema (dolores) y
// Beneficios (resultados). Reusa el primitivo Card del sistema como contenedor.

import { theme } from '../../theme/tokens.js';
import Card from '../ui/Card.jsx';

/**
 * FeatureCard
 * Tarjeta con un ícono en chip, un título y un cuerpo.
 * @param {Function} props.icon - Componente de ícono de Lucide
 * @param {string} props.title - Título de la tarjeta (<h3>)
 * @param {string} props.body - Texto descriptivo
 * @param {Object} [props.style] - Override del Card
 */
function FeatureCard({ icon: Icon, title, body, style }) {
  return (
    <Card
      padding={20}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 12, ...style }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: theme.radius,
          background: theme.accentSoft,
          color: theme.accent,
        }}
      >
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h3
        style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeHeading,
          letterSpacing: '-0.01em',
          color: theme.ink,
          margin: 0,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          lineHeight: 1.55,
          color: theme.muted,
          margin: 0,
        }}
      >
        {body}
      </p>
    </Card>
  );
}

export default FeatureCard;
