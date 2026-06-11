// /frontend-landing/src/components/sections/Comparacion.jsx
// Sección Comparación: "antes vs después" en dos columnas. La del método
// tradicional en rojo con ✗ (mismo recurso de "dolor" que Problema); la de
// BarberManager en indigo con ✓ y resaltada como la opción ganadora.

import { Check, X } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { MARCA } from '../../config/landing.js';
import Section from '../landing/Section.jsx';
import Reveal from '../landing/Reveal.jsx';

// Paletas de las dos columnas.
const PAL = {
  malo: { cardBg: '#FFF8F6', border: '#F6D8D0', chipBg: '#FDE5E0', icon: '#D92D20', titulo: theme.inkSoft, shadow: 'none' },
  bueno: { cardBg: theme.accentSoft, border: theme.accent, chipBg: theme.surface, icon: theme.accent, titulo: theme.accent, shadow: theme.shadowMd },
};

// Filas comparativas (mismo orden en ambas columnas).
const TRADICIONAL = [
  'Turnos por WhatsApp y chats mezclados',
  'Caja calculada a mano cada noche',
  'Cierre de mes armado en Excel',
  'Info repartida en papel y notas',
  'Recordatorios los mandás vos (o no)',
  'Resultados medidos a ojo',
];

const CON_SISTEMA = [
  'Turnero online con confirmación inmediata',
  'Caja diaria calculada sola',
  'Planillas semanales y mensuales listas',
  'Todo centralizado en un solo lugar',
  'Recordatorios automáticos por email',
  'Resultados comparados mes a mes',
];

/**
 * ColumnaComparativa
 * Una de las dos columnas de la comparación.
 * @param {string} props.titulo - Encabezado de la columna
 * @param {string[]} props.items - Filas
 * @param {'malo'|'bueno'} props.variante - Estilo (rojo/✗ o indigo/✓)
 */
function ColumnaComparativa({ titulo, items, variante }) {
  const p = PAL[variante];
  const esBueno = variante === 'bueno';
  const Icon = esBueno ? Check : X;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: p.cardBg,
        border: `1px solid ${p.border}`,
        borderRadius: theme.radiusLg,
        boxShadow: p.shadow,
        padding: 'clamp(20px, 3vw, 28px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {esBueno && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: 7,
              background: theme.accent,
              color: theme.accentInk,
              fontFamily: theme.body,
              fontWeight: theme.weightHeading,
              fontSize: 15,
              flex: '0 0 auto',
            }}
          >
            B
          </span>
        )}
        <h3
          style={{
            fontFamily: theme.body,
            fontWeight: theme.weightHeading,
            fontSize: theme.sizeHeading,
            letterSpacing: '-0.01em',
            color: p.titulo,
            margin: 0,
          }}
        >
          {titulo}
        </h3>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((it) => (
          <li key={it} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: 999,
                background: p.chipBg,
                color: p.icon,
                flex: '0 0 auto',
                marginTop: 1,
              }}
            >
              <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span style={{ fontFamily: theme.body, fontSize: 15, lineHeight: 1.5, color: theme.inkSoft }}>
              {it}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Comparacion
 * Sección "antes vs después". Sin props.
 * @returns {JSX.Element}
 */
function Comparacion() {
  return (
    <Section
      id="comparacion"
      tone="default"
      eyebrow="Antes y después"
      title="Lo que hacés hoy, comparado con BarberManager."
      subtitle="Es lo mismo que ya hacés todos los días, pero ordenado, automático y en un solo lugar."
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', alignItems: 'stretch' }}>
        <Reveal style={{ flex: '1 1 300px', maxWidth: 460, display: 'flex' }}>
          <ColumnaComparativa titulo="Método tradicional" items={TRADICIONAL} variante="malo" />
        </Reveal>
        <Reveal delay={100} style={{ flex: '1 1 300px', maxWidth: 460, display: 'flex' }}>
          <ColumnaComparativa titulo={`Con ${MARCA.nombre}`} items={CON_SISTEMA} variante="bueno" />
        </Reveal>
      </div>
    </Section>
  );
}

export default Comparacion;
