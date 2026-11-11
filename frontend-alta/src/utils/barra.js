// /frontend-alta/src/utils/barra.js
// La cuenta de una barra que salta de a pasos (components/SelectorConBarra.jsx):
// la comisión (0 a 100 de a 5) y el largo del turno (10 a 60 de a 5).
// Funciones puras (sin React) para poder probarlas con Node.

/**
 * pasoEnBarra
 * El valor después de un toque de - o +: salta al punto de la barra anterior
 * o siguiente (contando desde `min` de a `paso`), sin salir de min a max. Un
 * valor que vino guardado fuera de la barra queda en el punto que corresponde
 * (con la comisión, un 37 pasa a 35 o 40; un 120 baja a 100).
 * @param {number} valor - El valor actual (puede no ser válido)
 * @param {number} sentido - -1 (menos) o +1 (más)
 * @param {Object} rango
 * @param {number} rango.min
 * @param {number} rango.max
 * @param {number} rango.paso
 * @param {number} rango.porDefecto - Desde dónde se cuenta si `valor` no es un número
 * @returns {number}
 */
export function pasoEnBarra(valor, sentido, { min, max, paso, porDefecto }) {
  const actual = (Number.isFinite(valor) ? valor : porDefecto) - min;
  const siguiente = sentido > 0
    ? Math.floor(actual / paso) * paso + paso
    : Math.ceil(actual / paso) * paso - paso;
  return Math.min(Math.max(siguiente + min, min), max);
}

/**
 * dentroDeBarra
 * Dónde dibujar la perilla para un valor: el mismo, o el extremo más cercano
 * si está afuera, o `porDefecto` si no es un número.
 * @param {number} valor
 * @param {Object} rango - { min, max, porDefecto }
 * @returns {number}
 */
export function dentroDeBarra(valor, { min, max, porDefecto }) {
  return Math.min(Math.max(Number.isFinite(valor) ? valor : porDefecto, min), max);
}
