// /backend/src/utils/validarNumero.js
// Validadores numéricos centrales para los writes financieros (ventas, gastos,
// cortes, completar turno). Reemplazan los guards truthy (`!monto`), que tenían
// dos bugs: rechazaban el 0 legítimo (0 es falsy) y aceptaban negativos o
// no-números, corrompiendo balances e inventario.
//
// Aceptan tanto number como string numérico: los NUMERIC de Postgres viajan
// como string por la API (p. ej. el `precio` de un servicio) y el frontend los
// reenvía tal cual en algunos flujos (FlujoCorte manda `servicio.precio` crudo).

// Tope de las columnas numeric(10,2). Se compara el valor tal como llega, sin redondear:
// Postgres redondea antes de chequear, y 99999999.995 pasaría a 100000000.00 y daría 500.
export const MONTO_MAXIMO = 99999999.99;
// MONTO_MAXIMO como lo lee el usuario, para los mensajes de error.
export const MONTO_MAXIMO_TEXTO = '99.999.999,99';
// Desde este valor, numeric(10,2) redondea a 100000000.00 y se pasa de su tope.
const MONTO_REDONDEA_FUERA = 99999999.995;
// Tope de las columnas integer de stock y cantidades.
export const ENTERO_MAXIMO = 2147483647;

/**
 * esMontoValido
 * Valida un monto/precio: número finito de 0 a MONTO_MAXIMO. El 0 es válido (un
 * servicio bonificado o un gasto sin costo son casos reales).
 * @param {*} valor - Valor recibido del body (number o string numérico).
 * @returns {boolean} true si es un número finito entre 0 y MONTO_MAXIMO.
 */
export function esMontoValido(valor) {
  // Number('') y Number(null) devuelven 0 — sin este guard, un campo vacío
  // pasaría como monto 0 en lugar de rechazarse como faltante.
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    return false;
  }
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n <= MONTO_MAXIMO;
}

/**
 * mensajeMontoInvalido
 * Texto del 400 de un monto que no pasa esMontoValido. Nombra el rango, así un
 * monto con un dígito de más dice cuál es el máximo (antes decía solo ">= 0").
 * @param {string} campo - Nombre del campo en el body (ej. 'monto', 'precio').
 * @param {Object} [opciones]
 * @param {boolean} [opciones.requerido=true] - Si el campo es obligatorio (lo dice el texto).
 * @returns {string} Ej: 'monto es requerido y debe ser un número entre 0 y 99.999.999,99'
 */
export function mensajeMontoInvalido(campo, { requerido = true } = {}) {
  const rango = `debe ser un número entre 0 y ${MONTO_MAXIMO_TEXTO}`;
  return requerido ? `${campo} es requerido y ${rango}` : `${campo} ${rango}`;
}

/**
 * sumaMontosValida
 * Indica si la suma de varios montos entra en una columna numeric(10,2), como
 * corte.monto_total (precio + propina): cada uno puede estar dentro del tope y la
 * suma no. Compara el valor que redondearía Postgres, no MONTO_MAXIMO: al sumar
 * decimales en punto flotante, el máximo exacto puede dar apenas más.
 * @param {...(number|string)} montos - Montos ya validados con esMontoValido.
 * @returns {boolean} true si la suma se puede guardar.
 */
export function sumaMontosValida(...montos) {
  return montos.reduce((acumulado, monto) => acumulado + Number(monto), 0) < MONTO_REDONDEA_FUERA;
}

/**
 * esMontoPositivo
 * Valida un monto que no puede ser 0: número finito > 0. Lo usan los
 * movimientos extra, donde el monto es siempre positivo y el signo lo da el tipo.
 * Sin tope: movimiento_extra.monto es numeric sin precisión.
 * @param {*} valor - Valor recibido del body (number o string numérico).
 * @returns {boolean} true si es un número finito > 0.
 */
export function esMontoPositivo(valor) {
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    return false;
  }
  const n = Number(valor);
  return Number.isFinite(n) && n > 0;
}

/**
 * esEnteroPositivo
 * Valida un entero >= 1 que no se guarda en una columna, así que no tiene tope (la
 * cantidad de meses del histórico, que el controller recorta).
 * @param {*} valor - Valor recibido de la query (number o string numérico).
 * @returns {boolean} true si es un entero >= 1.
 */
export function esEnteroPositivo(valor) {
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    return false;
  }
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1;
}

/**
 * esCantidadValida
 * Valida una cantidad de unidades: entero de 1 a ENTERO_MAXIMO. A diferencia de los
 * montos, una cantidad 0 o fraccionaria no tiene sentido de negocio.
 * @param {*} valor - Valor recibido del body (number o string numérico).
 * @returns {boolean} true si es un entero entre 1 y ENTERO_MAXIMO.
 */
export function esCantidadValida(valor) {
  return esEnteroPositivo(valor) && Number(valor) <= ENTERO_MAXIMO;
}

/**
 * esEnteroNoNegativo
 * Valida un stock: entero de 0 a ENTERO_MAXIMO. A diferencia de esCantidadValida, el
 * 0 es válido (sin stock mínimo, o sin unidades para sumar).
 * @param {*} valor - Valor recibido del body (number o string numérico).
 * @returns {boolean} true si es un entero entre 0 y ENTERO_MAXIMO.
 */
export function esEnteroNoNegativo(valor) {
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    return false;
  }
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 && n <= ENTERO_MAXIMO;
}
