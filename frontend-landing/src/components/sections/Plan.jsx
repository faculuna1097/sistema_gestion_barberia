// /frontend-landing/src/components/sections/Plan.jsx
// Sección Plan: primer mes gratis y luego una suscripción mensual. El precio
// sale de PRECIO (config); si es null, muestra "Consultanos el precio".

import { theme } from '../../theme/tokens.js';
import { PRECIO } from '../../config/landing.js';
import { fmtPesos } from '../../utils/formato.js';
import Section from '../landing/Section.jsx';
import Reveal from '../landing/Reveal.jsx';
import Card from '../ui/Card.jsx';
import FreeMonthBadge from '../landing/FreeMonthBadge.jsx';
import FeatureList from '../landing/FeatureList.jsx';
import CTAGroup from '../landing/CTAGroup.jsx';

// Qué incluye el plan (todo, sin módulos sueltos).
const INCLUYE = [
  'Sistema de gestión completo',
  'App para los barberos',
  'Turnero online para tus clientes',
  'Recordatorios automáticos por email',
  'Te ayudamos a configurarlo',
];

/**
 * Plan
 * Sección de precio. Sin props.
 * @returns {JSX.Element}
 */
function Plan() {
  // Texto del precio mensual (o "Consultanos el precio" si no está seteado).
  const precioMensual = PRECIO.mensual != null ? fmtPesos(PRECIO.mensual) : null;

  return (
    <Section
      id="plan"
      tone="alt"
      eyebrow="Precio"
      title="Probá un mes gratis. Si te sirve, seguís."
      subtitle="Sin instalaciones ni contratos largos. El primer mes es gratis para que lo uses con tu barbería de verdad. Después, una suscripción mensual simple."
    >
      <Reveal style={{ maxWidth: 480, marginInline: 'auto' }}>
        <Card
          padding={32}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            textAlign: 'center',
            boxShadow: theme.shadowMd,
          }}
        >
          <FreeMonthBadge />

          {/* Precio destacado */}
          <div>
            <div
              style={{
                fontFamily: theme.body,
                fontWeight: theme.weightHeading,
                fontSize: 'clamp(40px, 9vw, 52px)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                color: theme.ink,
              }}
            >
              Gratis
            </div>
            <div style={{ fontFamily: theme.body, fontSize: 15, color: theme.muted, marginTop: 6 }}>
              tu primer mes completo
            </div>
          </div>

          <div style={{ width: '100%', height: 1, background: theme.hairline }} />

          {/* Precio después del mes gratis */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: theme.body, fontSize: 15, color: theme.muted }}>Después,</span>
            {precioMensual ? (
              <>
                <span style={{ fontFamily: theme.body, fontWeight: theme.weightHeading, fontSize: 24, color: theme.ink }}>
                  {precioMensual}
                </span>
                <span style={{ fontFamily: theme.body, fontSize: 15, color: theme.muted }}>/ mes</span>
              </>
            ) : (
              <span style={{ fontFamily: theme.body, fontWeight: theme.weightHeading, fontSize: 20, color: theme.ink }}>
                consultanos el precio
              </span>
            )}
          </div>

          {/* Qué incluye */}
          <FeatureList items={INCLUYE} style={{ width: '100%', textAlign: 'left' }} />

          {/* CTA */}
          <CTAGroup align="center" primaryLabel="Empezá tu mes gratis" style={{ width: '100%' }} />

          <span style={{ fontFamily: theme.body, fontSize: 13, color: theme.mutedSoft }}>
            Sin instalaciones · Cancelás cuando quieras
          </span>
        </Card>
      </Reveal>
    </Section>
  );
}

export default Plan;
