// /frontend-landing/src/components/landing/PainCard.jsx
// Tarjeta de "dolor" para la sección Problema. A diferencia de FeatureCard
// (limpia, indigo, para resultados positivos), esta usa una paleta CÁLIDA/ROJIZA
// para que el visitante SIENTA el ítem como un problema, no como una función.
// Decisión deliberada de priorizar conversión sobre consistencia con el sistema
// de diseño en esta sección puntual (pedido del usuario).

import { theme } from '../../theme/tokens.js';

// Paleta de marketing (intencionalmente fuera de theme/tokens.js).
const PAIN = {
  cardBg: '#FFF8F6',     // blanco apenas cálido
  border: '#F6D8D0',     // hairline cálido
  leftAccent: '#EE6C57', // filo izquierdo "marcado"
  iconBg: '#FDE5E0',     // chip del ícono
  icon: '#D92D20',       // ícono rojo
};

/**
 * PainCard
 * Tarjeta de un dolor: chip de ícono rojo + título en voz de queja + cuerpo.
 * @param {Function} props.icon - Componente de ícono de Lucide
 * @param {string} props.title - El problema en voz del dueño (<h3>)
 * @param {string} props.body - Detalle del problema
 * @param {Object} [props.style] - Override del contenedor
 */
function PainCard({ icon: Icon, title, body, style }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: PAIN.cardBg,
        border: `1px solid ${PAIN.border}`,
        borderLeft: `3px solid ${PAIN.leftAccent}`,
        borderRadius: theme.radius,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 999,
            background: PAIN.iconBg,
            color: PAIN.icon,
            flex: '0 0 auto',
          }}
        >
          <Icon size={20} strokeWidth={2} aria-hidden="true" />
        </span>
        <h3
          style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: theme.sizeHeading,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            color: theme.ink,
            margin: 0,
          }}
        >
          {title}
        </h3>
      </div>
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
    </div>
  );
}

export default PainCard;
