// /frontend-landing/src/components/landing/FlowDiagram.jsx
// Diagrama del flujo Cliente → Turnero → Barbero → BarberManager. Horizontal
// con flechas en desktop, vertical en mobile. Muestra que todo está conectado.

import { Fragment } from 'react';
import { User, CalendarCheck, Scissors, LayoutDashboard, ArrowRight, ArrowDown } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { useIsDesktop } from '../../hooks/useMediaQuery.js';
import Card from '../ui/Card.jsx';

// Los 4 nodos del flujo, en orden.
const NODOS = [
  { icon: User, title: 'Cliente', desc: 'Pide su turno online: elige barbero y servicio.' },
  { icon: CalendarCheck, title: 'Turnero online', desc: 'Confirma al instante y manda el recordatorio.' },
  { icon: Scissors, title: 'Barbero', desc: 'Ve su agenda del día y registra el corte.' },
  { icon: LayoutDashboard, title: 'BarberManager', desc: 'Vos ves turnos, caja y números en vivo.' },
];

/**
 * FlowNode
 * Una etapa del flujo (ícono + título + descripción).
 */
function FlowNode({ icon: Icon, title, desc }) {
  return (
    <Card
      padding={20}
      style={{
        flex: '1 1 0',
        minWidth: 160,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 10,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: theme.radius,
          background: theme.accentSoft,
          color: theme.accent,
        }}
      >
        <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
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
          lineHeight: 1.5,
          color: theme.muted,
          margin: 0,
        }}
      >
        {desc}
      </p>
    </Card>
  );
}

/**
 * FlowDiagram
 * Diagrama de las 4 etapas conectadas. Sin props.
 * @returns {JSX.Element}
 */
function FlowDiagram() {
  const isDesktop = useIsDesktop();
  const Arrow = isDesktop ? ArrowRight : ArrowDown;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isDesktop ? 'row' : 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: isDesktop ? 4 : 0,
        maxWidth: 980,
        marginInline: 'auto',
      }}
    >
      {NODOS.map((n, i) => (
        <Fragment key={n.title}>
          <FlowNode {...n} />
          {i < NODOS.length - 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isDesktop ? '0 2px' : '8px 0',
                color: theme.mutedSoft,
                flex: '0 0 auto',
              }}
            >
              <Arrow size={22} strokeWidth={1.75} aria-hidden="true" />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

export default FlowDiagram;
