// /backend/src/utils/validarNumero.js
// Validadores numéricos centrales para los writes financieros (ventas, gastos,
// cortes, completar turno). Reemplazan los guards truthy (`!monto`), que tenían
// dos bugs: rechazaban el 0 legítimo (0 es falsy) y aceptaban negativos o
// no-números, corrompiendo balances e inventario.
//
// Aceptan tanto number como string numérico: los NUMERIC de Postgres viajan
// como string por la API (p. ej. el `precio` de un servicio) y el frontend los
// reenvía tal cual en algunos flujos (FlujoCorte manda `servicio.precio` crudo).

/**
 * esMontoValido
 * Valida un monto/precio: número finito >= 0. El 0 es válido (un servicio
 * bonificado o un gasto sin costo son casos reales).
 * @param {*} valor - Valor recibido del body (number o string numérico).
 * @returns {boolean} true si es un número finito >= 0.
 */
export function esMontoValido(valor) {
  // Number('') y Number(null) devuelven 0 — sin este guard, un campo vacío
  // pasaría como monto 0 en lugar de rechazarse como faltante.
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    return false;
  }
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0;
}

/**
 * esCantidadValida
 * Valida una cantidad de unidades: entero >= 1. A diferencia de los montos,
 * una cantidad 0 o fraccionaria no tiene sentido de negocio.
 * @param {*} valor - Valor recibido del body (number o string numérico).
 * @returns {boolean} true si es un entero >= 1.
 */
export function esCantidadValida(valor) {
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    return false;
  }
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1;
}
