// /frontend-alta/src/utils/semana.js
// Los días de la semana del formulario: nombres, orden y cómo se resume un
// conjunto de días para leerlo ("Lun a sáb", "Lun, mié y vie").
// `dia_semana` va de 0 a 6 con 0 = domingo, como en la DB; se muestran de
// lunes a domingo, como se piensa la semana de un negocio.
// Funciones puras (sin React) para poder probarlas con Node.

/**
 * ORDEN_SEMANA
 * Los dia_semana en el orden en que se muestran: de lunes a domingo.
 */
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/**
 * DIAS_LUNES_A_SABADO
 * El atajo de la pantalla de días: la semana más común de una barbería.
 */
export const DIAS_LUNES_A_SABADO = [1, 2, 3, 4, 5, 6];

// Nombres por dia_semana (0 = domingo).
const NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const NOMBRES_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/**
 * nombreDia
 * @param {number} dia - dia_semana (0 = domingo)
 * @param {Object} [opciones]
 * @param {boolean} [opciones.corto=false] - "lun" en lugar de "lunes"
 * @param {boolean} [opciones.mayuscula=false] - Con la primera letra en mayúscula
 * @returns {string}
 */
export function nombreDia(dia, { corto = false, mayuscula = false } = {}) {
  const nombre = (corto ? NOMBRES_CORTOS : NOMBRES)[dia] ?? '';
  return mayuscula ? nombre.charAt(0).toUpperCase() + nombre.slice(1) : nombre;
}

/**
 * posicionEnSemana
 * Lugar de un día en ORDEN_SEMANA (lunes = 0, domingo = 6), para ordenar.
 * @param {number} dia - dia_semana
 * @returns {number}
 */
export function posicionEnSemana(dia) {
  return ORDEN_SEMANA.indexOf(dia);
}

/**
 * ordenarDias
 * @param {Iterable<number>} dias - dia_semana, en cualquier orden y quizás repetidos
 * @returns {number[]} Los días sin repetir, de lunes a domingo.
 */
export function ordenarDias(dias) {
  return [...new Set(dias)].sort((a, b) => posicionEnSemana(a) - posicionEnSemana(b));
}

/**
 * tramosSeguidos (interna)
 * Parte una lista de días (ya ordenada de lunes a domingo) en tramos de días
 * seguidos: [1,2,3,5] → [[1,2,3],[5]].
 * @param {number[]} ordenados
 * @returns {number[][]}
 */
function tramosSeguidos(ordenados) {
  const tramos = [];
  ordenados.forEach((dia) => {
    const ultimo = tramos[tramos.length - 1];
    const anterior = ultimo?.[ultimo.length - 1];
    if (ultimo && posicionEnSemana(dia) === posicionEnSemana(anterior) + 1) ultimo.push(dia);
    else tramos.push([dia]);
  });
  return tramos;
}

/**
 * unirConY (interna)
 * ['a','b','c'] → "a, b y c".
 * @param {string[]} partes
 * @returns {string}
 */
function unirConY(partes) {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/**
 * resumirDias
 * Un conjunto de días para leer de un vistazo. Tres o más días seguidos van
 * como rango ("lun a sáb"); el resto, separados ("lun, mié y vie").
 * Ej.: [1..6] → "Lun a sáb"; [1..5, 0] → "Lun a vie y dom"; [1, 3] → "Lun y mié";
 * los 7 → "Todos los días".
 * @param {Iterable<number>} dias - dia_semana
 * @param {Object} [opciones]
 * @param {boolean} [opciones.corto=true] - Nombres cortos ("lun") o largos ("lunes")
 * @returns {string} Con la primera letra en mayúscula ('' si no hay días).
 */
export function resumirDias(dias, { corto = true } = {}) {
  const ordenados = ordenarDias(dias);
  if (ordenados.length === 0) return '';
  if (ordenados.length === 7) return 'Todos los días';

  const partes = tramosSeguidos(ordenados).flatMap((tramo) => {
    const nombres = tramo.map((dia) => nombreDia(dia, { corto }));
    return tramo.length >= 3 ? [`${nombres[0]} a ${nombres[nombres.length - 1]}`] : nombres;
  });
  const texto = unirConY(partes);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
