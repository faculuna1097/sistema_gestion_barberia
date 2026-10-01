// /frontend-landing/src/components/landing/FeatureCard.jsx
// Tarjeta de "ícono + título + texto". La usa el bloque "¿Y frente a otras apps
// de turnos?" de la sección Comparación. Reusa el primitivo Card del sistema
// como contenedor.

import { theme } from '../../theme/tokens.js';
import Card from '../ui/Card.jsx';

/**
 * FeatureCard
 * Tarjeta con un ícono en chip, un título y un cuerpo.
 * @param {Function} props.icon - Componente de ícono de Lucide
 * @param {string} props.title - Título de la tarjeta
 * @param {string} props.body - Texto descriptivo
 * @param {'h3'|'h4'} [props.nivel='h3'] - Tag del título, según dónde se use:
 *   si la tarjeta va debajo de un <h3>, su título tiene que ser <h4>
 * @param {Object} [props.style] - Override del Card
 * @returns {JSX.Element}
 */
function FeatureCard({ icon: Icon, title, body, nivel = 'h3', style }) {
  const Titulo = nivel;

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
      <Titulo
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
      </Titulo>
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
