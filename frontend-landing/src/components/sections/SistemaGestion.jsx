// /frontend-landing/src/components/sections/SistemaGestion.jsx
// Sección más importante: el panel de gestión del dueño. Video protagonista
// arriba + las 10 funcionalidades agrupadas en 3 bloques (para que se lea
// ordenado y no como una lista plana) + la captura real del Balance del mes,
// para cerrar con el payoff: no solo ordenás el día, también ves si estás
// creciendo.

import { ClipboardList, Store, BarChart3 } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { VIDEOS, CAPTURAS } from '../../config/landing.js';
import Section from '../landing/Section.jsx';
import Reveal from '../landing/Reveal.jsx';
import Card from '../ui/Card.jsx';
import FeatureList from '../landing/FeatureList.jsx';
import VideoEmbed from '../landing/VideoEmbed.jsx';
import ScreenshotFrame from '../landing/ScreenshotFrame.jsx';
import NotaAlPie from '../landing/NotaAlPie.jsx';

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

      {/* Cierre con el payoff: el balance del mes. No es una sección aparte
          (fusionada acá) para no alargar la página. */}
      <Reveal
        style={{
          maxWidth: theme.maxWidthText,
          marginInline: 'auto',
          textAlign: 'center',
          marginTop: 'clamp(48px, 7vw, 72px)',
          marginBottom: 'clamp(24px, 4vw, 32px)',
        }}
      >
        <h3
          style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: 'clamp(20px, 3vw, 28px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            color: theme.ink,
            margin: 0,
          }}
        >
          Y a fin de mes, tus números claros.
        </h3>
        <p
          style={{
            fontFamily: theme.body,
            fontSize: 'clamp(15px, 2.2vw, 18px)',
            lineHeight: 1.55,
            color: theme.muted,
            margin: '12px auto 0',
            maxWidth: 560,
          }}
        >
          Compará mes contra mes y mirá si estás creciendo de verdad. Sin armar
          un Excel: el sistema ya tiene tus números.
        </p>
      </Reveal>

      {/* Captura real del Balance (tenant demo). Mismo ancho que el video de
          arriba. Lazy: está lejos del primer pantallazo y no compite con la
          imagen del Hero. */}
      <Reveal style={{ maxWidth: 920, marginInline: 'auto' }}>
        <ScreenshotFrame
          image={CAPTURAS.balance?.src}
          width={CAPTURAS.balance?.width}
          height={CAPTURAS.balance?.height}
          loading="lazy"
          alt="Balance de noviembre en BarberManager: ingresos, egresos y ganancia del mes, y los ingresos y la comisión de cada barbero"
          placeholderLabel="Captura del Balance"
        />
      </Reveal>

      <NotaAlPie>Captura del sistema con datos de prueba.</NotaAlPie>
    </Section>
  );
}

export default SistemaGestion;
