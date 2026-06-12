// /frontend-landing/src/components/landing/TestimonialCard.jsx
// Tarjeta de testimonio: estrellas + cita + autor (avatar de iniciales). Se usa
// en la sección Testimonios (hoy oculta tras un flag hasta tener reales).

import { Star } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import Card from '../ui/Card.jsx';

/**
 * iniciales
 * Toma las iniciales (hasta 2) de un nombre.
 * @param {string} nombre
 * @returns {string} Ej: "Martín G." -> "MG"
 */
function iniciales(nombre) {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * TestimonialCard
 * @param {string} props.quote - El testimonio
 * @param {string} props.nombre - Nombre del autor
 * @param {string} props.rol - Rol / barbería del autor
 */
function TestimonialCard({ quote, nombre, rol }) {
  return (
    <Card
      padding={24}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', gap: 2 }} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={15} fill="#F59E0B" strokeWidth={0} />
        ))}
      </div>

      <p
        style={{
          fontFamily: theme.body,
          fontSize: 16,
          lineHeight: 1.6,
          color: theme.inkSoft,
          margin: 0,
          flex: 1,
        }}
      >
        “{quote}”
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 999,
            background: theme.accentSoft,
            color: theme.accent,
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: 14,
            flex: '0 0 auto',
          }}
        >
          {iniciales(nombre)}
        </span>
        <div>
          <div style={{ fontFamily: theme.body, fontWeight: theme.weightHeading, fontSize: 14, color: theme.ink }}>
            {nombre}
          </div>
          <div style={{ fontFamily: theme.body, fontSize: 13, color: theme.muted }}>{rol}</div>
        </div>
      </div>
    </Card>
  );
}

export default TestimonialCard;
