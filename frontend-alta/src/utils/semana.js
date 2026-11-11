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
 * idDiaSemana
 * El id del botón de un día en SemanaEnBarras: para devolverle el foco cuando
 * su detalle se cierra desde adentro (el botón que se tocó desaparece).
 * @param {string} idBase - El idBase de SemanaEnBarras
 * @param {number} dia - dia_semana
 * @returns {string}
 */
export function idDiaSemana(idBase, dia) {
  return `${idBase}-dia-${dia}`;
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
 * Un conjunto de días para leer de un vistazo, sin que se pueda leer de dos maneras.
 *   - Un solo tramo de tres o más días seguidos va como rango: "Lun a sáb".
 *   - Días sueltos o de a dos, separados: "Lun, mié y vie".
 *   - Un rango mezclado con otros días se leía ambiguo ("Lun, mar y jue a
 *     sáb": ¿de martes a sábado?, ¿de jueves?). Si al rango que va del primer
 *     día al último le falta uno (o dos, si quedan cinco días o más), se dice
 *     por lo que falta: "Lun a sáb, menos mié" ("Todos los días, menos sáb"
 *     si va de lunes a domingo). Si no, van todos separados ("Lun, mar, mié y dom").
 * Ej.: [1..6] → "Lun a sáb"; [1,2,4,5,6] → "Lun a sáb, menos mié";
 * [1..5, 0] → "Todos los días, menos sáb"; [1, 3] → "Lun y mié"; los 7 → "Todos los días".
 * @param {Iterable<number>} dias - dia_semana
 * @param {Object} [opciones]
 * @param {boolean} [opciones.corto=true] - Nombres cortos ("lun") o largos ("lunes")
 * @returns {string} Con la primera letra en mayúscula ('' si no hay días).
 */
export function resumirDias(dias, { corto = true } = {}) {
  const ordenados = ordenarDias(dias);
  if (ordenados.length === 0) return '';
  if (ordenados.length === 7) return 'Todos los días';

  const nombre = (dia) => nombreDia(dia, { corto });
  const tramos = tramosSeguidos(ordenados);
  const hayRango = tramos.some((tramo) => tramo.length >= 3);
  let texto;
  if (tramos.length === 1 && hayRango) {
    texto = `${nombre(ordenados[0])} a ${nombre(ordenados[ordenados.length - 1])}`;
  } else if (!hayRango) {
    texto = unirConY(ordenados.map(nombre));
  } else {
    // Un rango y algo más: por lo que falta entre el primero y el último.
    const desde = posicionEnSemana(ordenados[0]);
    const hasta = posicionEnSemana(ordenados[ordenados.length - 1]);
    const faltan = ORDEN_SEMANA.slice(desde, hasta + 1).filter((dia) => !ordenados.includes(dia));
    // Con dos que faltan, "menos" conviene solo si quedan cinco días o más:
    // "Lun, jue, vie y sáb" se lee más fácil que "Lun a sáb, menos mar y mié".
    if (faltan.length === 1 || (faltan.length === 2 && ordenados.length >= 5)) {
      const base = desde === 0 && hasta === 6
        ? 'todos los días'
        : `${nombre(ordenados[0])} a ${nombre(ordenados[ordenados.length - 1])}`;
      texto = `${base}, menos ${unirConY(faltan.map(nombre))}`;
    } else {
      texto = unirConY(ordenados.map(nombre));
    }
  }
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
