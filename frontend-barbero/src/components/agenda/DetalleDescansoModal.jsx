// /frontend-barbero/src/components/agenda/DetalleDescansoModal.jsx
// Detalle de un descanso de la Agenda, con "Liberar" o "Terminar descanso".

import { theme } from '../../theme/tokens.js';
import { fmtHora } from '../../utils/fecha.js';
import { Button } from '../ui';
import { ModalDetalle, DatoDetalle } from './ModalDetalle.jsx';

/**
 * DetalleDescansoModal
 * Detalle de un descanso: rango, estado, quién lo marcó y la acción que
 * corresponde (plan_app_barbero.md D8 y D9):
 * - lo marcó el administrador → sin acciones (el barbero no lo puede liberar);
 * - no empezó → "Liberar": lo anula entero;
 * - en curso → "Terminar descanso": termina ahora y lo que queda se vuelve a ofrecer;
 * - ya terminó → sin acciones.
 * Las dos acciones son el mismo endpoint (liberar). No pasan por ConfirmDialog:
 * no tocan a ningún cliente, y tocar el botón dentro del detalle ya es un paso
 * deliberado.
 * No se renderiza si descanso es null.
 * @param {Object|null} props.descanso - bloque de tipo 'descanso' (prepararAgenda)
 * @param {number} props.ahora - "ahora" en ms epoch
 * @param {boolean} props.procesando - si la acción está en curso
 * @param {() => void} props.onLiberar
 * @param {() => void} props.onCerrar
 */
export default function DetalleDescansoModal({ descanso, ahora, procesando, onLiberar, onCerrar }) {
  if (!descanso) return null;

  const noEmpezo = descanso.desdeMs > ahora;
  const enCurso = !noEmpezo && descanso.hastaMs > ahora;
  const delAdmin = descanso.origen === 'admin';

  let estado = 'Terminó';
  if (noEmpezo) estado = 'Todavía no empezó';
  else if (enCurso) estado = 'En curso';

  const estiloNota = {
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    color: theme.muted,
    lineHeight: 1.5,
  };

  return (
    <ModalDetalle
      etiqueta="Detalle del descanso"
      titulo={`${fmtHora(descanso.desdeIso)} – ${fmtHora(descanso.hastaIso)}`}
      subtitulo={(
        <span style={{
          fontFamily: theme.mono,
          fontSize: theme.sizeMicro,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: theme.muted,
        }}>
          Descanso
        </span>
      )}
      bloqueado={procesando}
      onCerrar={onCerrar}
    >
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DatoDetalle label="Estado" valor={estado} />
        <DatoDetalle label="Lo marcó" valor={delAdmin ? 'El administrador' : 'Vos'} />
      </div>

      {delAdmin && (noEmpezo || enCurso) && (
        <p style={{ ...estiloNota, marginTop: 16 }}>
          Solo el administrador lo puede liberar.
        </p>
      )}

      {!delAdmin && (noEmpezo || enCurso) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <p style={estiloNota}>
            {noEmpezo
              ? 'Si lo liberás, esos horarios vuelven a estar disponibles para reservar.'
              : 'Si lo terminás ahora, los horarios que quedan vuelven a estar disponibles para reservar.'}
          </p>
          <Button variant="primary" onClick={onLiberar} disabled={procesando}>
            {procesando ? 'Procesando…' : (noEmpezo ? 'Liberar' : 'Terminar descanso')}
          </Button>
        </div>
      )}
    </ModalDetalle>
  );
}
