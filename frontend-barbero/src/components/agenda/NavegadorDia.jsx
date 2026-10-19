// /frontend-barbero/src/components/agenda/NavegadorDia.jsx
// Navegación de fecha de la Agenda: flechas de a un día, la fecha visible y
// "Volver a hoy".

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { theme } from '../../theme/tokens.js';
import { fmtFechaLarga } from '../../utils/fecha.js';

/**
 * FlechaDia
 * Botón cuadrado 36×36 para las flechas. Hover con useState.
 */
function FlechaDia({ children, onClick, aria }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={aria}
      style={{
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? theme.surfaceAlt : 'transparent',
        border: 'none',
        borderRadius: theme.radiusSm,
        cursor: 'pointer',
        color: theme.inkSoft,
        transition: `background ${theme.transitionFast}`,
      }}
    >
      {children}
    </button>
  );
}

/**
 * NavegadorDia
 * Flechas ← / → para moverse de a un día + label de fecha (siempre texto plano).
 * Cuando el día visible no es hoy, debajo aparece un botón "Volver a hoy".
 * @param {string} props.fecha
 * @param {boolean} props.esHoy
 * @param {() => void} props.onAnterior
 * @param {() => void} props.onSiguiente
 * @param {() => void} props.onHoy
 */
export default function NavegadorDia({ fecha, esHoy, onAnterior, onSiguiente, onHoy }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        padding: 4,
      }}>
        <FlechaDia onClick={onAnterior} aria="Día anterior">
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        </FlechaDia>

        <div style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: theme.ink,
          textTransform: 'capitalize',
        }}>
          {fmtFechaLarga(fecha)}
        </div>

        <FlechaDia onClick={onSiguiente} aria="Día siguiente">
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </FlechaDia>
      </div>

      {/* Botón de retorno — sólo visible cuando el día mostrado no es hoy */}
      {!esHoy && (
        <button
          type="button"
          onClick={onHoy}
          style={{
            alignSelf: 'center',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: theme.accent,
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            fontWeight: theme.weightMedium,
            padding: '0 12px',
            borderRadius: theme.radiusSm,
          }}
        >
          Volver a hoy
        </button>
      )}
    </div>
  );
}
