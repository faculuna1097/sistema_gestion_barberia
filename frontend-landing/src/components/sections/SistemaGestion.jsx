// /frontend-landing/src/components/sections/SistemaGestion.jsx
// Sección más importante: el panel de gestión del dueño. Video protagonista
// arriba + las 10 funcionalidades agrupadas en 3 bloques (para que se lea
// ordenado y no como una lista plana).

import { ClipboardList, Store, BarChart3 } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { VIDEOS } from '../../config/landing.js';
import Section from '../landing/Section.jsx';
import Reveal from '../landing/Reveal.jsx';
import Card from '../ui/Card.jsx';
import FeatureList from '../landing/FeatureList.jsx';
import VideoEmbed from '../landing/VideoEmbed.jsx';

// Las 10 funcionalidades agrupadas en 3 bloques temáticos.
const GRUPOS = [
  {
    icon: ClipboardList,
    titulo: 'Operación diaria',
    items: ['Registro de cortes', 'Registro de ventas', 'Registro de gastos', 'Caja diaria'],
  },
  {
    icon: Store,
    titulo: 'Tu negocio',
    items: ['Productos', 'Servicios', 'Barberos', 'Configuración del turnero'],
  },
  {
    icon: BarChart3,
    titulo: 'Resultados',
    items: ['Planillas semanales', 'Planillas mensuales'],
  },
];

/**
 * GrupoCard
 * Bloque de funcionalidades: ícono + título (<h3>) + lista.
 */
function GrupoCard({ icon: Icon, titulo, items }) {
  return (
    <Card
      padding={20}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: theme.radius,
            background: theme.accentSoft,
            color: theme.accent,
            flex: '0 0 auto',
          }}
        >
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
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
          {titulo}
        </h3>
      </div>
      <FeatureList items={items} />
    </Card>
  );
}

/**
 * SistemaGestion
 * Sección del panel de gestión. Sin props.
 * @returns {JSX.Element}
 */
function SistemaGestion() {
  return (
    <Section
      id="sistema-gestion"
      tone="alt"
      eyebrow="El sistema de gestión"
      title="El control total de tu barbería, en una pantalla."
      subtitle="Cargás cortes, ventas y gastos en segundos, y el sistema arma la caja, las planillas y los números por vos. Lo que antes hacías a mano, ahora ya está hecho."
    >
      <Reveal style={{ maxWidth: 920, marginInline: 'auto' }}>
        <VideoEmbed {...VIDEOS.gestion} title="El panel de gestión" />
      </Reveal>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'center',
          marginTop: 'clamp(32px, 5vw, 48px)',
        }}
      >
        {GRUPOS.map((g, i) => (
          <Reveal
            key={g.titulo}
            delay={i * 80}
            style={{ flex: '1 1 280px', maxWidth: 360, display: 'flex' }}
          >
            <GrupoCard icon={g.icon} titulo={g.titulo} items={g.items} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export default SistemaGestion;
