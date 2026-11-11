// /frontend-alta/src/utils/precio.js
// Los precios del formulario (servicios y productos, plan §5.4): enteros en
// pesos, con separador de miles mientras se escriben ("8.000") y con tope
// PRECIO_MAXIMO (el mayor entero que entra en numeric(10,2)). Lo usa
// components/CampoPrecio.jsx; en `datos` el precio va como number, o null si
// el campo está vacío.
// Funciones puras (sin React) para poder probarlas con Node.

import { PRECIO_MAXIMO } from './validaciones.js';

/**
 * DIGITOS_PRECIO_MAXIMOS
 * Cuántos dígitos acepta el campo: los de PRECIO_MAXIMO (99.999.999 → 8). Con
 * eso, lo que se puede escribir nunca pasa el tope.
 */
export const DIGITOS_PRECIO_MAXIMOS = String(PRECIO_MAXIMO).length;

/**
 * conMiles
 * Pone el punto de los miles a una tira de dígitos: "8000" → "8.000". A mano
 * (y no con toLocaleString) para que dé lo mismo en cualquier navegador.
 * @param {string} digitos - Solo dígitos
 * @returns {string}
 */
export function conMiles(digitos) {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * fmtPrecioEnCampo
 * El precio como se ve dentro del campo (sin el "$", que va al costado).
 * @param {number|null|undefined} precio
 * @returns {string} "8.000", o '' si no hay precio.
 */
export function fmtPrecioEnCampo(precio) {
  if (precio === null || precio === undefined || precio === '') return '';
  const n = Number(precio);
  if (!Number.isFinite(n)) return '';
  // Un valor guardado con decimales o negativo (no debería haber) se muestra entero y sin signo.
  return conMiles(String(Math.trunc(Math.abs(n))));
}

/**
 * fmtPesos
 * Un precio para leer: "$ 8.000" (como fmtPesos de los otros fronts,
 * sistema_de_disenio.md §8, pero sin decimales: acá los precios son enteros).
 * @param {number|null|undefined} precio
 * @returns {string} '' si no hay precio.
 */
export function fmtPesos(precio) {
  const texto = fmtPrecioEnCampo(precio);
  return texto ? `$ ${texto}` : '';
}

/**
 * leerPrecioEscrito
 * Interpreta lo que quedó en el campo después de una tecla.
 *   - Se queda con los dígitos: el punto de los miles lo pone el campo, y un
 *     "-" no tiene sentido en un precio.
 *   - La coma es el separador decimal en Argentina: lo de después no cuenta
 *     para el precio. Vuelve aparte (`decimales`, con la coma) para que el
 *     campo lo siga mostrando mientras se escribe: si desapareciera, los
 *     dígitos siguientes se pegarían al entero ("8.000,50" → 800.050).
 *   - Con más dígitos enteros que DIGITOS_PRECIO_MAXIMOS, la tecla se ignora
 *     (null), igual que el tope de dígitos del teléfono.
 * @param {string} crudo - El valor del input
 * @returns {{precio: number|null, decimales: string}|null} El precio (null si
 *   quedó vacío) y lo escrito desde la coma ('' si no hay coma), o null si la
 *   tecla se ignora.
 */
export function leerPrecioEscrito(crudo) {
  const texto = String(crudo ?? '');
  const coma = texto.indexOf(',');
  const entero = coma === -1 ? texto : texto.slice(0, coma);
  const digitos = entero.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (digitos.length > DIGITOS_PRECIO_MAXIMOS) return null;
  return {
    precio: digitos === '' ? null : Number(digitos),
    decimales: coma === -1 ? '' : `,${texto.slice(coma + 1).replace(/\D/g, '')}`,
  };
}

/**
 * posicionTrasDigitos
 * Dónde dejar el cursor después de reformatear: detrás del mismo número de
 * dígitos que tenía antes a su izquierda. Así, editar en el medio ("8.000" →
 * "18.000") no lo manda al final.
 * @param {string} formateado - El texto nuevo del campo ("18.000")
 * @param {number} digitosAntes - Dígitos a la izquierda del cursor en lo escrito
 * @returns {number} La posición del cursor en `formateado`.
 */
export function posicionTrasDigitos(formateado, digitosAntes) {
  if (digitosAntes <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < formateado.length; i += 1) {
    if (/\d/.test(formateado[i])) vistos += 1;
    if (vistos === digitosAntes) return i + 1;
  }
  return formateado.length;
}
