// /frontend/src/components/ui/SelectorPeriodo.jsx

// Componente base de selector de período. Renderiza el patrón visual
// [‹] [label] [›] que comparten SelectorMes, SelectorSemana y SelectorDia.
//
// No tiene lógica de fechas. Recibe el label ya formateado, los handlers
// de anterior/siguiente y un flag para deshabilitar el botón ›.
//
// Prop opcional `badge`: si se pasa, se muestra un pequeño chip debajo del
// label (usado por SelectorSemana para "Esta semana" y SelectorDia para "HOY").
//
// Sistema de diseño: tokens + Geist + Lucide + onClick. Chevrons Lucide
// (consistente con PanelAdmin / Planillas). Badge "destacado" en indigo sólido
// (mismo lenguaje que las pills "HOY"/"ACTUAL" de Planillas/Balances).

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * Botón de navegación (‹ / ›) con estado de hover propio.
 * @param {object} props
 * @param {React.ReactNode} props.children - Ícono a renderizar.
 * @param {() => void} props.onClick       - Handler de click.
 * @param {boolean} [props.disabled]       - Si true, deshabilita el botón.
 * @param {string} props.ariaLabel         - Etiqueta accesible.
 */
function BotonNav({ children, onClick, disabled = false, ariaLabel }) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onClick(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        width: 36,
        height: 36,
        borderRadius: theme.radius,
        border: `1px solid ${disabled ? theme.hairlineSoft : theme.hairline}`,
        background: !disabled && hover ? theme.surfaceAlt : theme.surface,
        color: disabled ? theme.mutedSoft : theme.inkSoft,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}`,
      }}
    >
      {children}
    </button>
  );
}

/**
 * @param {object} props
 * @param {string}   props.label                     - Texto central ya formateado
 * @param {() => void} props.onAnterior              - Click del botón ‹
 * @param {() => void} props.onSiguiente             - Click del botón ›
 * @param {boolean}  [props.siguienteDeshabilitado]  - Si true, deshabilita ›
 * @param {{ texto: string, destacado?: boolean }} [props.badge]
 *                                                   - Chip opcional debajo del label
 * @param {number}   [props.minWidth=160]            - Ancho mínimo del label en px
 * @param {number}   [props.fontSize=17]             - Tamaño de fuente del label en px
 * @param {boolean}  [props.labelDestacado]          - Si true, label en color acento
 */
export default function SelectorPeriodo({
  label,
  onAnterior,
  onSiguiente,
  siguienteDeshabilitado = false,
  badge = null,
  minWidth = 160,
  fontSize = 17,
  labelDestacado = false,
}) {
  return (
    <div style={styles.contenedor}>
      <BotonNav onClick={onAnterior} ariaLabel="Anterior">
        <ChevronLeft size={20} strokeWidth={1.75} />
      </BotonNav>

      <div style={styles.labelWrapper}>
        <span
          style={{
            ...styles.label,
            minWidth: `${minWidth}px`,
            fontSize: `${fontSize}px`,
            color: labelDestacado ? theme.accent : theme.ink,
          }}
        >
          {label}
        </span>
        {badge && (
          <span
            style={{
              ...styles.badge,
              ...(badge.destacado ? styles.badgeDestacado : styles.badgeNeutro),
            }}
          >
            {badge.texto}
          </span>
        )}
      </div>

      <BotonNav
        onClick={onSiguiente}
        disabled={siguienteDeshabilitado}
        ariaLabel="Siguiente"
      >
        <ChevronRight size={20} strokeWidth={1.75} />
      </BotonNav>
    </div>
  );
}

const styles = {
  contenedor: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontFamily: theme.body,
  },
  labelWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
  },
  label: {
    fontWeight: theme.weightHeading,
    textAlign: 'center',
    letterSpacing: '-0.01em',
  },
  badge: {
    fontFamily: theme.mono,
    fontSize: `${theme.sizeMicro}px`,
    fontWeight: theme.weightMedium,
    padding: '2px 8px',
    borderRadius: '20px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  badgeDestacado: {
    color: theme.accentInk,
    backgroundColor: theme.accent,
  },
  badgeNeutro: {
    color: theme.muted,
    backgroundColor: theme.surfaceAlt,
  },
};
