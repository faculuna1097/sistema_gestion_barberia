// /frontend-barbero/src/components/agenda/DetalleTurnoModal.jsx
// Detalle de un turno de la Agenda, con sus acciones si está reservado.

import { UserX } from 'lucide-react';

import { theme } from '../../theme/tokens.js';
import { fmtHora } from '../../utils/fecha.js';
import { Button, StatusPill } from '../ui';
import { ModalDetalle, DatoDetalle } from './ModalDetalle.jsx';

/**
 * DetalleTurnoModal
 * Overlay con los datos del turno y, si está reservado, las acciones.
 * No se renderiza si turno es null.
 * @param {Object|null} props.turno
 * @param {() => void} props.onCerrar
 * @param {(turno, accion) => void} props.onAccion
 */
export default function DetalleTurnoModal({ turno, onCerrar, onAccion }) {
  if (!turno) return null;

  const esReservado = turno.estado === 'reservado';
  // Un turno que aún no empezó solo puede cancelarse, y uno que ya empezó solo
  // marcarse "no asistió": el cliente no vino recién se sabe cuando empezó, y uno
  // que empezó ya no se cancela (el servidor rechaza lo otro en cada caso).
  // Completar no está acá: un turno se completa al registrar su corte, desde el
  // iPad o el panel.
  const esFuturo = new Date(turno.inicio) > new Date();

  return (
    <ModalDetalle
      etiqueta="Detalle del turno"
      titulo={`${fmtHora(turno.inicio)} – ${fmtHora(turno.fin)}`}
      subtitulo={<StatusPill estado={turno.estado} />}
      onCerrar={onCerrar}
    >
      {/* Datos del turno */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DatoDetalle label="Cliente" valor={turno.cliente_nombre || 'Sin nombre'} />
        {turno.servicio_nombre && <DatoDetalle label="Servicio" valor={turno.servicio_nombre} />}
        {turno.cliente_telefono && (
          <DatoDetalle
            label="Teléfono"
            valor={<a href={`tel:${turno.cliente_telefono}`} style={{ color: theme.accent }}>{turno.cliente_telefono}</a>}
          />
        )}
        {turno.cliente_email && (
          <DatoDetalle
            label="Email"
            valor={<a href={`mailto:${turno.cliente_email}`} style={{ color: theme.accent }}>{turno.cliente_email}</a>}
          />
        )}
      </div>

      {/* Acción — solo si está reservado: cancelar si no empezó, "no asistió" si ya empezó. */}
      {esReservado && (
        <div style={{ marginTop: 20 }}>
          {esFuturo ? (
            <Button variant="danger" onClick={() => onAccion(turno, 'cancelar')}>Cancelar</Button>
          ) : (
            <Button variant="secondary" onClick={() => onAccion(turno, 'no_asistio')}>
              <UserX size={16} strokeWidth={1.75} aria-hidden="true" />
              No asistió
            </Button>
          )}
        </div>
      )}
    </ModalDetalle>
  );
}
