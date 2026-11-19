// /frontend-barbero/src/components/agenda/DetalleTurnoModal.jsx
// Detalle de un turno de la Agenda, con sus acciones si está reservado,
// "Asignar cliente" si es un turno "Sin datos", y su traspaso a otro barbero
// (F2 de plan_mejoras_operativas.md): "Traspasar", o la oferta pendiente con
// "Retirar", o cómo terminó la última.

import { UserX, UserPlus, ArrowRightLeft } from 'lucide-react';

import { theme } from '../../theme/tokens.js';
import { fmtHora } from '../../utils/fecha.js';
import { textoCliente } from '../../utils/formato.js';
import { textoEstadoEnDetalle } from '../../utils/traspasos.js';
import { Button, StatusPill } from '../ui';
import { ModalDetalle, DatoDetalle } from './ModalDetalle.jsx';

// Colores de la línea del traspaso según cómo está. Va siempre con su texto.
const TONO_TRASPASO = {
  pendiente: { fondo: theme.accentSoft,  texto: theme.accent },
  aceptado:  { fondo: theme.successSoft, texto: theme.success },
  rechazado: { fondo: theme.surfaceAlt,  texto: theme.inkSoft },
  vencido:   { fondo: theme.warningSoft, texto: theme.warning },
};

/**
 * EstadoTraspaso
 * La línea del detalle que dice cómo está el traspaso del turno.
 * @param {Object} props.solicitud - la más nueva del turno (no retirada)
 * @returns {JSX.Element|null}
 */
function EstadoTraspaso({ solicitud }) {
  const texto = textoEstadoEnDetalle(solicitud);
  if (!texto) return null;
  const tono = TONO_TRASPASO[solicitud.estado] ?? TONO_TRASPASO.rechazado;
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderRadius: theme.radius,
        background: tono.fondo,
        color: tono.texto,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
      }}
    >
      <ArrowRightLeft size={16} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />
      {texto}
    </div>
  );
}

/**
 * DetalleTurnoModal
 * Overlay con los datos del turno y, si está reservado, las acciones.
 * No se renderiza si turno es null.
 * @param {Object|null} props.turno
 * @param {Object|null} [props.traspaso] - la solicitud de traspaso más nueva de
 *   este turno (useTraspasos → porTurno), si tiene
 * @param {boolean} [props.procesando=false] - una acción del detalle en curso
 *   (retirar): bloquea el cierre y los botones
 * @param {() => void} props.onCerrar
 * @param {(turno, accion) => void} props.onAccion
 * @param {(turno) => void} props.onAsignarCliente - abre la hoja de "Asignar cliente"
 * @param {(turno) => void} props.onTraspasar - abre la hoja de "Traspasar"
 * @param {(solicitud) => void} props.onRetirarTraspaso
 * @returns {JSX.Element|null}
 */
export default function DetalleTurnoModal({
  turno, traspaso = null, procesando = false,
  onCerrar, onAccion, onAsignarCliente, onTraspasar, onRetirarTraspaso,
}) {
  if (!turno) return null;

  const esReservado = turno.estado === 'reservado';
  // Un turno que aún no empezó solo puede cancelarse, y uno que ya empezó solo
  // marcarse "no asistió": el cliente no vino recién se sabe cuando empezó, y uno
  // que empezó ya no se cancela (el servidor rechaza lo otro en cada caso).
  // Completar no está acá: un turno se completa al registrar su corte, desde el
  // iPad o el panel.
  const esFuturo = new Date(turno.inicio) > new Date();
  // Un turno "Sin datos" recibe un cliente si está reservado o completado (se
  // anota después de cobrar); cancelado o "no asistió" ya no se toca.
  const puedeAsignar = !turno.cliente_id && (esReservado || turno.estado === 'completado');

  // Traspaso: solo un turno reservado que no empezó. Con una oferta pendiente se
  // puede retirar; si el otro ya aceptó (el turno todavía no salió de esta
  // Agenda), no hay nada que hacer; si no, se puede ofrecer (de nuevo).
  const traspasable = esReservado && esFuturo;
  const pendiente = traspaso?.estado === 'pendiente';
  const aceptado = traspaso?.estado === 'aceptado';
  const puedeTraspasar = traspasable && !pendiente && !aceptado;
  const textoTraspasar = traspaso && ['rechazado', 'vencido'].includes(traspaso.estado)
    ? 'Traspasar a otro'
    : 'Traspasar';
  const hayAcciones = puedeAsignar || puedeTraspasar || esReservado;

  return (
    <ModalDetalle
      etiqueta="Detalle del turno"
      titulo={`${fmtHora(turno.inicio)} – ${fmtHora(turno.fin)}`}
      subtitulo={<StatusPill estado={turno.estado} />}
      bloqueado={procesando}
      onCerrar={onCerrar}
    >
      {/* Datos del turno */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DatoDetalle label="Cliente" valor={textoCliente(turno.cliente_nombre)} />
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

      {/* Cómo está el traspaso (solo mientras el turno se puede traspasar) */}
      {traspasable && traspaso && textoEstadoEnDetalle(traspaso) && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <EstadoTraspaso solicitud={traspaso} />
          {pendiente && (
            <Button variant="secondary" disabled={procesando} onClick={() => onRetirarTraspaso(traspaso)}>
              {procesando ? 'Retirando…' : 'Retirar'}
            </Button>
          )}
        </div>
      )}

      {/* Acciones: asignar cliente, traspasar, y cancelar si no empezó o
          "no asistió" si ya empezó. */}
      {hayAcciones && <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {puedeAsignar && (
          <Button variant="secondary" disabled={procesando} onClick={() => onAsignarCliente(turno)}>
            <UserPlus size={16} strokeWidth={1.75} aria-hidden="true" />
            Asignar cliente
          </Button>
        )}

        {puedeTraspasar && (
          <Button variant="secondary" disabled={procesando} onClick={() => onTraspasar(turno)}>
            <ArrowRightLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            {textoTraspasar}
          </Button>
        )}

        {esReservado && (esFuturo ? (
          <Button variant="danger" disabled={procesando} onClick={() => onAccion(turno, 'cancelar')}>Cancelar</Button>
        ) : (
          <Button variant="secondary" disabled={procesando} onClick={() => onAccion(turno, 'no_asistio')}>
            <UserX size={16} strokeWidth={1.75} aria-hidden="true" />
            No asistió
          </Button>
        ))}
      </div>}
    </ModalDetalle>
  );
}
