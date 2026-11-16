// /frontend-barbero/src/components/cliente/BotonSinDatos.jsx
// Botón destacado para reservar un turno sin cliente ("Sin datos"). Lo usan el
// paso del cliente del wizard y la hoja del atajo de la Agenda. Confirma en el
// acto: no pasa por el formulario del cliente.

import { UserRound } from 'lucide-react';

import { theme } from '../../theme/tokens.js';
import { useHover } from '../../hooks/useHover.js';

/**
 * BotonSinDatos
 * Botón de ancho completo, con fondo de acento suave, que reserva el turno sin
 * cliente. Mientras se envía muestra "Reservando…".
 * @param {() => void} props.onClick
 * @param {boolean} [props.procesando=false] - el envío de este botón está en curso
 * @param {boolean} [props.deshabilitado=false] - otro envío está en curso
 * @returns {JSX.Element}
 */
export default function BotonSinDatos({ onClick, procesando = false, deshabilitado = false }) {
  const [hover, eventosHover] = useHover();
  const inactivo = procesando || deshabilitado;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={inactivo}
      {...eventosHover}
      style={{
        width: '100%',
        minHeight: 64,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: hover && !inactivo ? theme.surface : theme.accentSoft,
        border: `1px solid ${theme.accent}`,
        borderRadius: theme.radius,
        cursor: inactivo ? 'default' : 'pointer',
        opacity: deshabilitado && !procesando ? 0.5 : 1,
        textAlign: 'left',
        transition: `background ${theme.transitionFast}`,
      }}
    >
      <span style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: 999,
        background: theme.surface,
        border: `1px dashed ${theme.accent}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.accent,
      }}>
        <UserRound size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightHeading,
          color: theme.accent,
        }}>
          {procesando ? 'Reservando…' : 'Sin datos'}
        </span>
        <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.inkSoft }}>
          Reservar sin cliente. Lo podés cargar después.
        </span>
      </span>
    </button>
  );
}
