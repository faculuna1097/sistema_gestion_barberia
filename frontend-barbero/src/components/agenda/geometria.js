// /frontend-barbero/src/components/agenda/geometria.js
// Geometría del timeline de la Agenda: la escala vertical y el paso de minutos
// del día a px. Funciones puras, sin React.
// - La escala (px por hora) depende de la duración del slot del negocio
//   (calcularPxPorHora).
// - Todo lo que se dibuja sobre la grilla (celdas, turnos, bloques, la
//   selección) usa la misma caja (cajaVertical).

// ─── Constantes del timeline ────────────────────────────────────────────────
// La escala vertical (px por hora) depende de la duración del slot del negocio:
// ver calcularPxPorHora.
const PX_POR_HORA_MIN = 80;       // escala de siempre; con slots largos no cambia
const ALTO_MIN_SLOT   = 48;       // alto mínimo de un slot: área táctil ≥ 44 (sistema_de_disenio §5.4)
                                  // y un turno de un solo slot muestra sus dos renglones
export const OFFSET_IZQ      = 56;       // ancho reservado para los horarios de los slots
export const PADDING_VERTICAL = 8;       // aire arriba y abajo del timeline (la primera celda no queda pegada al borde)
const SEPARACION_CELDAS = 2;      // px entre dos celdas seguidas (slots, turnos, bloques): 1 arriba y 1 abajo

// Alto del skeleton antes de la primera carga (no se sabe todavía el rango del
// día): 15 horas a la escala de siempre.
export const ALTO_SKELETON = 15 * PX_POR_HORA_MIN;

// ─── Funciones ──────────────────────────────────────────────────────────────

/**
 * calcularPxPorHora
 * Escala vertical del timeline. Es la de siempre (80 px/h), salvo que con ella
 * un slot quede más bajo que ALTO_MIN_SLOT: ahí se estira para que cada slot
 * mida al menos eso. `duracion_slot_minutos` es configurable por negocio.
 * Ej.: slots de 15 min → 192 px/h; de 30 → 96; de 45 o más → 80.
 * @param {number|null} duracionSlotMin - duración del slot del negocio, en minutos
 * @returns {number} px por hora
 */
export function calcularPxPorHora(duracionSlotMin) {
  if (!duracionSlotMin || duracionSlotMin <= 0) return PX_POR_HORA_MIN;
  return Math.max(PX_POR_HORA_MIN, Math.ceil((ALTO_MIN_SLOT * 60) / duracionSlotMin));
}

/**
 * topDesdeMinutos
 * Convierte minutos-del-día a coordenada `top` dentro del timeline.
 * @param {number} minutos - minutos desde la medianoche del día visible
 * @param {number} origen - minuto del día que queda arriba de todo (rango.minInicio)
 * @param {number} pxPorHora - escala vertical (calcularPxPorHora)
 * @returns {number} px
 */
export function topDesdeMinutos(minutos, origen, pxPorHora) {
  return PADDING_VERTICAL + ((minutos - origen) / 60) * pxPorHora;
}

/**
 * cajaVertical
 * Posición vertical de algo que va de minInicio a minFin (una celda de slot, un
 * turno, un bloque, la selección), con SEPARACION_CELDAS repartida arriba y
 * abajo: así dos cosas seguidas quedan separadas y cada slot se lee como un bloque.
 * @param {number} minInicio - minutos del día
 * @param {number} minFin - minutos del día
 * @param {number} origen - minuto del día que queda arriba de todo
 * @param {number} pxPorHora - escala vertical
 * @returns {{ top: number, height: number }} px
 */
export function cajaVertical(minInicio, minFin, origen, pxPorHora) {
  const margen = SEPARACION_CELDAS / 2;
  return {
    top: topDesdeMinutos(minInicio, origen, pxPorHora) + margen,
    height: ((minFin - minInicio) / 60) * pxPorHora - SEPARACION_CELDAS,
  };
}

/**
 * calcularRango
 * Rango vertical del timeline, en minutos del día: del primer slot (o turno) al
 * último. La agenda se ordena por los slots del barbero: no hay horas en punto
 * ni margen alrededor del horario del local. Los turnos lo agrandan si quedan
 * afuera de la grilla (uno cargado a mano fuera del horario sigue visible). Los
 * descansos y las ausencias no lo agrandan: se recortan (una ausencia de varios
 * días lo estiraría a 24 h).
 * @param {Array<{minInicio: number, minFin: number}>} turnos - turnos visibles del día (no cancelados)
 * @param {Array<{minInicio: number, minFin: number}>} slots - grilla del barbero
 * @returns {{ minInicio: number, minFin: number }|null} null si no hay ni slots ni
 *   turnos (el barbero no trabaja ese día: no hay timeline que dibujar)
 */
export function calcularRango(turnos, slots) {
  const tramos = [...turnos, ...slots];
  if (tramos.length === 0) return null;
  return {
    minInicio: Math.max(0, Math.min(...tramos.map((t) => t.minInicio))),
    minFin: Math.min(24 * 60, Math.max(...tramos.map((t) => t.minFin))),
  };
}
