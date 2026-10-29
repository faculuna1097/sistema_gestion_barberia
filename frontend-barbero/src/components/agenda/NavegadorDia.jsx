// /frontend-barbero/src/components/agenda/NavegadorDia.jsx
// Navegación de fecha de la Agenda: una barra con flechas de a un día, la fecha
// visible y "Hoy".

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { theme } from '../../theme/tokens.js';
import { fmtFechaLarga } from '../../utils/fecha.js';
import { useHover } from '../../hooks/useHover.js';

/**
 * BotonBarra
 * Botón de la barra de fecha: las flechas (44×44) y "Hoy" (44 de alto y el
 * ancho de su texto). Hover solo con mouse (useHover).
 * @param {ReactNode} props.children
 * @param {() => void} props.onClick
 * @param {string} [props.aria] - aria-label, para las flechas, que no tienen texto
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.color=theme.inkSoft] - color del contenido si está habilitado
 */
function BotonBarra({ children, onClick, aria, disabled = false, color = theme.inkSoft }) {
  const [hover, eventosHover] = useHover();
  return (
    <button
      type="button"
      onClick={onClick}
      {...eventosHover}
      disabled={disabled}
      aria-label={aria}
      style={{
        minWidth: 44,
        height: 44,
        padding: '0 10px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover && !disabled ? theme.surfaceAlt : 'transparent',
        border: 'none',
        borderRadius: theme.radiusSm,
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? theme.mutedSoft : color,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        transition: `background ${theme.transitionFast}`,
      }}
    >
      {children}
    </button>
  );
}

/**
 * NavegadorDia
 * Barra con las flechas ← / → para moverse de a un día, la fecha visible entre
 * ellas (texto plano) y, al final, "Hoy" para volver al día de hoy.
 * "Hoy" está siempre, y viendo hoy queda desactivado: así la barra no cambia al
 * volver a hoy (antes un "Volver a hoy" debajo aparecía y desaparecía, y la
 * pantalla saltaba 52 px). Si una fecha larga no entra en un renglón, pasa a
 * dos dentro del mismo alto de 44 px.
 * @param {string} props.fecha
 * @param {boolean} props.esHoy
 * @param {() => void} props.onAnterior
 * @param {() => void} props.onSiguiente
 * @param {() => void} props.onHoy
 */
export default function NavegadorDia({ fecha, esHoy, onAnterior, onSiguiente, onHoy }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      padding: 4,
    }}>
      <BotonBarra onClick={onAnterior} aria="Día anterior">
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      </BotonBarra>

      <div style={{
        flex: 1,
        minWidth: 0,
        textAlign: 'center',
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        lineHeight: 1.3,
        color: theme.ink,
        textTransform: 'capitalize',
      }}>
        {fmtFechaLarga(fecha)}
      </div>

      <BotonBarra onClick={onSiguiente} aria="Día siguiente">
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
      </BotonBarra>

      {/* Separador entre las flechas y "Hoy": son acciones distintas */}
      <div aria-hidden="true" style={{ width: 1, height: 24, background: theme.hairline, flexShrink: 0 }} />

      <BotonBarra onClick={onHoy} disabled={esHoy} color={theme.accent}>
        Hoy
      </BotonBarra>
    </div>
  );
}
