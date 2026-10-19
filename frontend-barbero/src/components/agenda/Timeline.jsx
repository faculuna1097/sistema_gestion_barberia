// /frontend-barbero/src/components/agenda/Timeline.jsx
// Timeline del día de la Agenda: la grilla de slots, los slots tocables, la
// selección, los descansos y ausencias, los turnos y la línea de "ahora".

import { theme } from '../../theme/tokens.js';
import { fmtHora } from '../../utils/fecha.js';
import { OFFSET_IZQ, cajaVertical, topDesdeMinutos } from './geometria.js';
import { limitesDelDia, unirDescansosSeguidos } from './datosAgenda.js';
import { BloqueNeutro, SlotTocable, BloqueTurno } from './BloquesTimeline.jsx';

/**
 * Timeline
 * Dibuja la grilla del barbero (una celda con borde por slot y, a la izquierda,
 * el horario de inicio de cada slot), los slots tocables, la selección, los
 * bloques de descanso y de ausencia, los turnos y el indicador de "ahora".
 * Los horarios de la izquierda son solo los de los slots: con slots de 50 min
 * desde las 08:00 se ve 08:00, 08:50, 09:40… No hay horas en punto.
 * Los turnos se dibujan desde `turnos`, no desde la grilla: la grilla solo marca
 * `turno` en los reservados, y un turno completado tiene que seguir viéndose.
 * @param {Object} props.agenda - de prepararAgenda: { turnos, slots, bloques }
 * @param {string} props.fecha - 'YYYY-MM-DD' del día visible
 * @param {number} props.ahora - "ahora" en ms epoch
 * @param {boolean} props.esHoy
 * @param {{ minInicio: number, minFin: number }} props.rango - de calcularRango
 * @param {number} props.pxPorHora - escala vertical (calcularPxPorHora)
 * @param {number} props.altoTotal - alto del timeline en px
 * @param {React.RefObject} props.refAhora - Ref que se ancla al indicador de ahora.
 * @param {Set<number>} props.iniciosTocables - inicioMs de los slots que se pueden tocar
 * @param {Array} props.seleccion - slots elegidos para un descanso (continuos, ordenados)
 * @param {(slot) => void} props.onTocarSlot
 * @param {(turno) => void} props.onTocarTurno
 * @param {(descanso) => void} props.onTocarDescanso
 */
export default function Timeline({
  agenda, fecha, ahora, esHoy, rango, pxPorHora, altoTotal, refAhora,
  iniciosTocables, seleccion, onTocarSlot, onTocarTurno, onTocarDescanso,
}) {
  const { turnos, slots, bloques } = agenda;
  const origen = rango.minInicio;
  const iniciosSeleccionados = new Set(seleccion.map((s) => s.inicioMs));

  // Descansos (los pegados, unidos en uno) y ausencias, recortados al rango
  // visible (no lo agrandan).
  const bloquesVisibles = unirDescansosSeguidos(bloques)
    .map((b) => ({
      ...b,
      minInicio: Math.max(b.minInicio, rango.minInicio),
      minFin: Math.min(b.minFin, rango.minFin),
    }))
    .filter((b) => b.minFin > b.minInicio);

  // Posición del indicador de "ahora": solo si cae dentro del rango.
  const minutosAhora = (ahora - limitesDelDia(fecha).inicioDia) / 60000;
  const mostrarAhora = esHoy && minutosAhora >= rango.minInicio && minutosAhora <= rango.minFin;
  const topAhora = topDesdeMinutos(minutosAhora, origen, pxPorHora);

  return (
    <div style={{
      position: 'relative',
      height: altoTotal,
      background: theme.surface,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius,
    }}>
      {/* Grilla: una celda con borde por slot, separada de la siguiente, y su
          horario de inicio a la izquierda (alineado con el primer renglón de un
          turno). Es la única referencia de hora del timeline. */}
      {slots.map((slot) => {
        const caja = cajaVertical(slot.minInicio, slot.minFin, origen, pxPorHora);
        return (
          <div key={`celda-${slot.inicioMs}`}>
            <span style={{
              position: 'absolute',
              left: 8,
              top: caja.top + 4,
              fontFamily: theme.mono,
              fontSize: theme.sizeMicro,
              color: theme.muted,
            }}>
              {fmtHora(slot.inicioIso)}
            </span>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                ...caja,
                left: OFFSET_IZQ + 4,
                right: 4,
                border: `1px solid ${theme.hairline}`,
                borderRadius: theme.radiusSm,
              }}
            />
          </div>
        );
      })}

      {/* Slots libres y futuros: se tocan para elegir un descanso */}
      {slots.filter((s) => iniciosTocables.has(s.inicioMs)).map((slot) => (
        <SlotTocable
          key={slot.inicioMs}
          slot={slot}
          seleccionado={iniciosSeleccionados.has(slot.inicioMs)}
          origen={origen}
          pxPorHora={pxPorHora}
          onTocar={() => onTocarSlot(slot)}
        />
      ))}

      {/* Selección: un solo bloque (fondo + borde de acento) encima de las
          celdas y debajo de los botones de slot: tapa la separación entre celdas,
          así el rango se lee como una pieza, como va a quedar el descanso. */}
      {seleccion.length > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            ...cajaVertical(seleccion[0].minInicio, seleccion[seleccion.length - 1].minFin, origen, pxPorHora),
            left: OFFSET_IZQ + 4,
            right: 4,
            background: theme.accentSoft,
            border: `2px solid ${theme.accent}`,
            borderRadius: theme.radiusSm,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* Descansos y ausencias */}
      {bloquesVisibles.map((bloque) => (
        <BloqueNeutro
          key={bloque.id}
          bloque={bloque}
          origen={origen}
          pxPorHora={pxPorHora}
          onTocar={() => onTocarDescanso(bloque)}
        />
      ))}

      {/* Indicador de "ahora" */}
      {mostrarAhora && (
        <div
          ref={refAhora}
          style={{
            position: 'absolute',
            top: topAhora,
            left: OFFSET_IZQ,
            right: 0,
            borderTop: `2px solid ${theme.danger}`,
            zIndex: 3,
          }}
        >
          <div style={{
            position: 'absolute',
            left: -5,
            top: -5,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: theme.danger,
          }} />
        </div>
      )}

      {/* Bloques de turno */}
      {turnos.map((turno) => (
        <BloqueTurno
          key={turno.id}
          turno={turno}
          origen={origen}
          pxPorHora={pxPorHora}
          onClick={() => onTocarTurno(turno)}
        />
      ))}
    </div>
  );
}
