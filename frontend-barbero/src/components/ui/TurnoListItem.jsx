// /frontend-barbero/src/components/ui/TurnoListItem.jsx
// Card que representa un turno en una lista.
// Layout: hora grande a la izquierda · cliente + servicio en el medio · pill/acciones a la derecha.
// Si el turno está reservado, debajo aparece una fila de acciones (No asistió / Cancelar).
// Las acciones se ocultan automáticamente para estados no-reservado. No hay
// "Completar": un turno se completa al registrar su corte (iPad o panel).

import { UserX } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { fmtHora } from '../../utils/fecha.js';
import Button from './Button.jsx';
import StatusPill from './StatusPill.jsx';

/**
 * TurnoListItem
 * Renderiza un turno como card. Las callbacks son opcionales — si no se pasan,
 * los botones no se renderizan (útil para vistas read-only).
 * @param {{
 *   id: string,
 *   inicio: string,  // ISO timestamp
 *   estado: 'reservado'|'completado'|'no_asistio'|'cancelado',
 *   cliente_nombre?: string,
 *   cliente_telefono?: string,
 *   cliente_email?: string,
 *   servicio_nombre?: string,
 * }} props.turno
 * @param {() => void} [props.onNoAsistio] - Acción "No asistió"
 * @param {() => void} [props.onCancelar]  - Acción "Cancelar"
 * @param {boolean} [props.bloqueado=false] - Si true, desactiva todos los botones (ej. mientras se procesa).
 */
function TurnoListItem({ turno, onNoAsistio, onCancelar, bloqueado = false }) {
  const esReservado = turno.estado === 'reservado';
  // Cantidad de acciones disponibles → define las columnas de la grilla.
  const cantAcciones = [onNoAsistio, onCancelar].filter(Boolean).length;
  const mostrarAcciones = esReservado && cantAcciones > 0;

  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
      padding: 12,
    }}>
      {/* Fila principal: hora · datos · pill */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          fontFamily: theme.body,
          fontWeight: theme.weightHeading,
          fontSize: theme.sizeHeading,
          letterSpacing: '-0.01em',
          color: theme.ink,
          minWidth: 56,
          lineHeight: 1.2,
        }}>
          {fmtHora(turno.inicio)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            fontWeight: theme.weightMedium,
            color: theme.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {turno.cliente_nombre || 'Sin nombre'}
          </div>
          {turno.servicio_nombre && (
            <div style={{
              fontFamily: theme.body,
              fontSize: theme.sizeBody,
              color: theme.muted,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {turno.servicio_nombre}
            </div>
          )}
        </div>

        {/* Pill solo si NO está reservado (en reservado los botones de acción ya lo comunican) */}
        {!esReservado && <StatusPill estado={turno.estado} />}
      </div>

      {mostrarAcciones && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cantAcciones}, 1fr)`,
          gap: 8,
          marginTop: 12,
        }}>
          {onNoAsistio && (
            <Button variant="secondary" onClick={onNoAsistio} disabled={bloqueado}>
              <UserX size={16} strokeWidth={1.75} aria-hidden="true" />
              No asistió
            </Button>
          )}
          {onCancelar && (
            <Button variant="danger" onClick={onCancelar} disabled={bloqueado}>
              Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default TurnoListItem;
