// /frontend-barbero/src/components/agenda/Timeline.jsx
// Timeline del día de la Agenda: la grilla de slots, las horas sin slots en
// gris, los slots tocables, la selección, los descansos y ausencias, los turnos
// y la línea de "ahora".

import { theme } from '../../theme/tokens.js';
import { fmtHora } from '../../utils/fecha.js';
import { OFFSET_IZQ, cajaVertical, topDesdeMinutos } from './geometria.js';
import { limitesDelDia } from './datosAgenda.js';
import { BloqueNeutro, SlotTocable, BloqueTurno } from './BloquesTimeline.jsx';

// Hora de inicio de una celda, en la columna izquierda (alineada con el primer
// renglón de un turno). La comparten las celdas de slot y las grises.
const ESTILO_HORA = {
  position: 'absolute',
  left: 8,
  fontFamily: theme.mono,
  fontSize: theme.sizeMicro,
  color: theme.muted,
};

// Texto solo para lectores de pantalla: no se ve, pero se lee después de la hora.
// Se usa en vez de un aria-label porque las celdas son divs sin rol, y en esos
// los lectores ignoran el aria-label.
const SOLO_LECTOR = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

// Estado de un slot de la grilla, en palabras, para el lector de pantalla.
const ESTADO_LEGIBLE = {
  turno: 'con turno',
  descanso: 'descanso',
  suspension: 'ausencia',
};

/**
 * Describe el estado de una celda de slot que no se puede tocar (los tocables
 * ya lo dicen en el aria-label de su botón).
 * @param {Object} slot - slot de la grilla (prepararAgenda), con `estado`
 * @returns {string} ej. "con turno", "libre, ya empezó" (no se puede marcar)
 */
function estadoDelSlot(slot) {
  return ESTADO_LEGIBLE[slot.estado] ?? 'libre, ya empezó';
}

/**
 * Timeline
 * Dibuja la grilla del barbero (una celda con borde por slot y, a la izquierda,
 * el horario de inicio de cada slot), en gris las horas del local en que no
 * tiene slots, los slots tocables, la selección, los bloques de descanso y de
 * ausencia, los turnos y el indicador de "ahora".
 * Los horarios de la izquierda son solo los de las celdas: con slots de 50 min
 * desde las 08:00 se ve 08:00, 08:50, 09:40… No hay horas en punto.
 * Los turnos se dibujan desde `turnos`, no desde la grilla: la grilla solo marca
 * `turno` en los reservados, y un turno completado tiene que seguir viéndose.
 * @param {Object} props.agenda - de prepararAgenda: { turnos, slots, bloques, fueraDeHorario }
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
  const { turnos, slots, bloques, fueraDeHorario } = agenda;
  const origen = rango.minInicio;
  const iniciosSeleccionados = new Set(seleccion.map((s) => s.inicioMs));

  // Descansos (los pegados ya vienen unidos en uno desde el servidor) y
  // ausencias, recortados al rango visible (no lo agrandan).
  const bloquesVisibles = bloques
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
      {/* Horas del local en que el barbero no tiene slots (no trabaja, o no
          entra un turno al final de un bloque): celdas grises, sin acciones, con
          su hora como el resto. Sin texto adentro: el descanso lleva su ícono y
          su texto, y la ausencia va rayada. */}
      {fueraDeHorario.map((celda) => {
        const caja = cajaVertical(celda.minInicio, celda.minFin, origen, pxPorHora);
        return (
          <div key={`fuera-${celda.minInicio}`}>
            {celda.conHora && (
              <span style={{ ...ESTILO_HORA, top: caja.top + 4 }}>
                {fmtHora(celda.inicioIso)}
                <span style={SOLO_LECTOR}>, sin horario de trabajo</span>
              </span>
            )}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                ...caja,
                left: OFFSET_IZQ + 4,
                right: 4,
                background: theme.surfaceAlt,
                border: `1px solid ${theme.hairlineSoft}`,
                borderRadius: theme.radiusSm,
              }}
            />
          </div>
        );
      })}

      {/* Grilla: una celda con borde por slot, separada de la siguiente, y su
          horario de inicio a la izquierda. Con las celdas grises, son la única
          referencia de hora del timeline. */}
      {slots.map((slot) => {
        const caja = cajaVertical(slot.minInicio, slot.minFin, origen, pxPorHora);
        // Un slot tocable ya dice su hora y su estado en el botón (SlotTocable):
        // la hora de la izquierda se oculta al lector para no leerla dos veces.
        const tocable = iniciosTocables.has(slot.inicioMs);
        return (
          <div key={`celda-${slot.inicioMs}`}>
            <span aria-hidden={tocable || undefined} style={{ ...ESTILO_HORA, top: caja.top + 4 }}>
              {fmtHora(slot.inicioIso)}
              {!tocable && <span style={SOLO_LECTOR}>, {estadoDelSlot(slot)}</span>}
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
