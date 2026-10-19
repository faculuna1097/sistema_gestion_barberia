// /frontend-barbero/src/utils/seleccionSlots.js
// Reglas para elegir los slots de un descanso en la Agenda
// (plan_app_barbero.md, Feature 1, D3 y D4). Lógica pura, sin React: se puede
// leer y probar aislada.
//
// La selección es siempre un bloque continuo de slots (un descanso = un rango =
// una fila): cada slot empieza justo donde termina el anterior. Se guarda como
// un array de slots ordenado. Un "slot" es cualquier objeto con
// { inicioMs, finMs } (ms epoch); los de la Agenda traen además el ISO original
// y el estado de la grilla.

/**
 * esSlotTocable
 * Un slot se puede tocar si está libre y todavía no empezó (D3). El slot en
 * curso no: el turnero ya no lo ofrece, así que no hace falta bloquearlo.
 * @param {{ inicioMs: number, estado: string }} slot - slot de la grilla
 * @param {number} ahora - "ahora" en ms epoch
 * @returns {boolean}
 */
export function esSlotTocable(slot, ahora) {
  return slot.estado === 'libre' && slot.inicioMs > ahora;
}

/**
 * tocarSlot
 * Nueva selección después de tocar un slot (D4):
 * - sin selección → queda ese slot solo;
 * - un slot ya seleccionado → sale junto con todo lo que tiene debajo (si es el
 *   primero, la selección queda vacía);
 * - el slot pegado debajo del último, o pegado arriba del primero → la
 *   selección se agranda;
 * - cualquier otro → la selección se reinicia desde ese slot.
 * "Pegado" es continuidad en el tiempo, no posición en la lista: dos slots de
 * bloques horarios distintos, o con un turno o un descanso en el medio, no
 * están pegados.
 * No valida que el slot sea tocable: eso lo decide quien llama (esSlotTocable).
 * No muta la selección recibida.
 * @param {Array<{ inicioMs: number, finMs: number }>} seleccion - selección actual, ordenada y continua
 * @param {{ inicioMs: number, finMs: number }} slot - slot tocado
 * @returns {Array} la nueva selección
 */
export function tocarSlot(seleccion, slot) {
  if (seleccion.length === 0) return [slot];

  const indice = seleccion.findIndex((s) => s.inicioMs === slot.inicioMs);
  if (indice !== -1) return seleccion.slice(0, indice);

  const primero = seleccion[0];
  const ultimo = seleccion[seleccion.length - 1];
  if (slot.inicioMs === ultimo.finMs) return [...seleccion, slot];
  if (slot.finMs === primero.inicioMs) return [slot, ...seleccion];

  return [slot];
}

/**
 * depurarSeleccion
 * Deja en la selección solo los slots que siguen siendo tocables: el tiempo
 * corre con la pantalla abierta y la agenda se recarga. Si en el medio quedó un
 * hueco, se queda con el primer tramo continuo. Como el primero en vencer es el
 * de más arriba, lo normal es que solo se caiga el comienzo.
 * @param {Array<{ inicioMs: number, finMs: number }>} seleccion - selección actual
 * @param {Set<number>} iniciosTocables - inicioMs de los slots tocables ahora
 * @returns {Array} la selección depurada; la misma referencia si no cambió
 */
export function depurarSeleccion(seleccion, iniciosTocables) {
  const vigentes = seleccion.filter((s) => iniciosTocables.has(s.inicioMs));
  if (vigentes.length === seleccion.length) return seleccion;

  const tramo = [];
  for (const s of vigentes) {
    if (tramo.length > 0 && s.inicioMs !== tramo[tramo.length - 1].finMs) break;
    tramo.push(s);
  }
  return tramo;
}
