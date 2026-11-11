// /frontend-alta/src/screens/pantallas/PantallaHorario.jsx
// Pantalla 4: el horario del local (plan §5.2).
// - Arriba, la apertura y el cierre "comunes", con botones de +/- 30 min: los
//   comparten todos los días que no tienen horario propio.
// - Debajo, la semana en barras (SemanaEnBarras), en vivo. Tocar un día abre
//   sus propios botones: al cambiarlos, ese día deja de seguir al común (ej. el
//   sábado cierra antes), y "Usar el horario de los demás días" lo devuelve.
// - "¿Cierran al mediodía?" es opcional: prende una pausa (la misma para todos
//   los días, plan §5.6) que se ajusta igual que el horario.
// La lógica del horario vive en utils/horarioLocal.js.

import { useId, useImperativeHandle, useRef, useState } from 'react';
import { theme } from '../../theme/tokens.js';
import { PANTALLA } from '../../config/pantallas.js';
import { idDiaSemana, nombreDia, resumirDias } from '../../utils/semana.js';
import {
  cambiarHorarioComun, cambiarHorarioDia, cambiarPausa, leerHorarioLocal, pausaSugerida, volverAlHorarioComun,
} from '../../utils/horarioLocal.js';
import { useErroresDePantalla } from '../../hooks/useErroresDePantalla.js';
import { useErroresVisibles } from '../../hooks/useErroresVisibles.js';
import { useHover } from '../../hooks/useHover.js';
import { useFocoPendiente } from '../../hooks/useFocoPendiente.js';
import { prefiereMenosMovimiento } from '../../utils/movimiento.js';
import ParDeHoras from '../../components/ParDeHoras.jsx';
import SemanaEnBarras from '../../components/SemanaEnBarras.jsx';
import { Button, TextoError } from '../../components/ui';

// Prefijo de los ids de la semana del local (SemanaEnBarras).
const ID_SEMANA = 'horario-local';

/**
 * InterruptorPausa
 * "¿Cierran al mediodía?" como un renglón entero que se toca (44 px o más),
 * con un interruptor a la derecha (`role="switch"`).
 * @param {boolean} props.prendido
 * @param {Function} props.onCambiar - Recibe el valor nuevo
 * @returns {JSX.Element}
 */
function InterruptorPausa({ prendido, onCambiar }) {
  const [hover, eventosHover] = useHover();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={prendido}
      onClick={() => onCambiar(!prendido)}
      {...eventosHover}
      className="al-presionable"
      style={{
        width: '100%',
        minHeight: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '8px 16px',
        background: hover ? theme.surfaceAlt : theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        textAlign: 'left',
        cursor: 'pointer',
        transition: `background ${theme.transitionFast}, transform ${theme.transitionFast}`,
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, fontWeight: theme.weightMedium, color: theme.ink }}>
          ¿Cierran al mediodía?
        </span>
        <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
          Es opcional. La pausa es la misma todos los días.
        </span>
      </span>
      {/* El interruptor dibujado; el estado lo dice aria-checked del botón. */}
      <span aria-hidden="true" style={{
        position: 'relative',
        width: 40,
        height: 24,
        flexShrink: 0,
        borderRadius: 999,
        background: prendido ? theme.accent : theme.hairline,
        transition: `background ${theme.transitionFast}`,
      }}>
        <span style={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: theme.surface,
          boxShadow: theme.shadowSm,
          transform: prendido ? 'translateX(16px)' : 'none',
          // Con "reducir movimiento", la perilla salta sin deslizarse.
          transition: prefiereMenosMovimiento() ? 'none' : `transform ${theme.transitionMedium}`,
        }} />
      </span>
    </button>
  );
}

/**
 * PantallaHorario
 * @param {Object} props.datos - El formulario completo
 * @param {Function} props.actualizar - De useSolicitud
 * @param {Object} props.ref - Formulario llama a ref.current.intentarSeguir()
 * @returns {JSX.Element}
 */
function PantallaHorario({ datos, actualizar, ref }) {
  const pedirFoco = useFocoPendiente();
  const vista = leerHorarioLocal(datos);
  const comunes = vista.dias.filter((d) => !vista.distintos.has(d));
  const [diaAbierto, setDiaAbierto] = useState(null);

  const errores = useErroresDePantalla(PANTALLA.HORARIO, datos);
  const { errorDe, revelar, revelarTodos } = useErroresVisibles(errores);
  const errorHorario = errorDe('local.horario');
  const errorPausa = errorDe('local.pausa');
  const errorHorarioId = useId();
  const errorPausaId = useId();

  // A dónde va el foco con un error: el bloque del horario o el de la pausa.
  const horarioRef = useRef(null);
  const pausaRef = useRef(null);

  useImperativeHandle(ref, () => ({
    /**
     * intentarSeguir
     * @returns {boolean} true si se puede avanzar; si no, muestra los errores y
     *   lleva el foco al bloque del primero.
     */
    intentarSeguir() {
      if (errores.length === 0) return true;
      revelarTodos();
      const [primero] = errores;
      (primero.campo.startsWith('local.pausa') ? pausaRef : horarioRef).current?.focus();
      return false;
    },
  }));

  /**
   * alternarDiaAbierto — abre los botones de un día, o los cierra si ya estaban abiertos.
   * @param {number} dia - dia_semana
   */
  const alternarDiaAbierto = (dia) => setDiaAbierto((actual) => (actual === dia ? null : dia));

  /**
   * cambiarPausaYMostrar — cambia la pausa y, desde ese toque, muestra su error si lo hay.
   * @param {{hora_inicio: string, hora_fin: string}|null} pausa
   */
  const cambiarPausaYMostrar = (pausa) => {
    actualizar((d) => cambiarPausa(d, pausa));
    revelar('local.pausa');
  };

  const bloques = vista.dias.map((dia) => ({ dia_semana: dia, ...vista.porDia.get(dia) }));
  const rangoAbierto = diaAbierto !== null ? vista.porDia.get(diaAbierto) : null;

  // Los botones del día abierto, debajo de su barra.
  const detalle = rangoAbierto && (
    <div style={{ padding: '12px 8px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ParDeHoras
        rango={rangoAbierto}
        onCambiar={(rango) => actualizar((d) => cambiarHorarioDia(d, diaAbierto, rango))}
        etiquetaInicio={`Abren el ${nombreDia(diaAbierto)}`}
        etiquetaFin={`Cierran el ${nombreDia(diaAbierto)}`}
      />
      {vista.distintos.has(diaAbierto) && comunes.length > 0 && (
        <div>
          <Button
            variant="ghost"
            full={false}
            onClick={() => {
              const dia = diaAbierto;
              actualizar((d) => volverAlHorarioComun(d, dia));
              setDiaAbierto(null);
              // El botón desaparece con el detalle: el foco vuelve a la fila del día.
              pedirFoco(() => document.getElementById(idDiaSemana(ID_SEMANA, dia)));
            }}
            style={{ color: theme.accent, marginLeft: -16 }}
          >
            Usar el horario de los demás días
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        ref={horarioRef}
        tabIndex={-1}
        role="group"
        aria-label="Horario de la semana"
        aria-describedby={errorHorario ? errorHorarioId : undefined}
        style={{ display: 'flex', flexDirection: 'column', gap: 16, borderRadius: theme.radius }}
      >
        {comunes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontFamily: theme.body, fontSize: theme.sizeBody, fontWeight: theme.weightMedium, color: theme.ink }}>
              {resumirDias(comunes, { corto: false })}
            </p>
            <ParDeHoras
              rango={vista.comun}
              onCambiar={(rango) => actualizar((d) => cambiarHorarioComun(d, rango))}
              etiquetaInicio="Abren"
              etiquetaFin="Cierran"
              errorId={errorHorario ? errorHorarioId : undefined}
            />
          </div>
        )}

        <SemanaEnBarras
          bloques={bloques}
          pausa={vista.pausa}
          propios={vista.distintos}
          diaAbierto={diaAbierto}
          onTocarDia={alternarDiaAbierto}
          detalle={detalle}
          etiqueta="Semana del local. Tocá un día para darle otro horario."
          idBase={ID_SEMANA}
        />

        {errorHorario && <TextoError id={errorHorarioId}>{errorHorario}</TextoError>}
      </div>

      <div
        ref={pausaRef}
        tabIndex={-1}
        role="group"
        aria-label="Pausa del mediodía"
        aria-describedby={errorPausa ? errorPausaId : undefined}
        style={{ display: 'flex', flexDirection: 'column', gap: 16, borderRadius: theme.radius }}
      >
        <InterruptorPausa
          prendido={Boolean(vista.pausa)}
          onCambiar={(prender) => cambiarPausaYMostrar(prender ? pausaSugerida(vista.comun) : null)}
        />
        {vista.pausa && (
          <div className="al-crecer">
            <div>
              <ParDeHoras
                rango={vista.pausa}
                onCambiar={cambiarPausaYMostrar}
                etiquetaInicio="Cierran a las"
                etiquetaFin="Vuelven a las"
                errorId={errorPausa ? errorPausaId : undefined}
              />
            </div>
          </div>
        )}
        {errorPausa && <TextoError id={errorPausaId}>{errorPausa}</TextoError>}
      </div>
    </div>
  );
}

export default PantallaHorario;
