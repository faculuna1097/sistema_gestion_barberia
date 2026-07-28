// /backend/src/utils/validarPago.js
// Enum central de forma de pago. Antes cada write financiero repetía el literal
// ['efectivo', 'mercado_pago'] (ventas, gastos, cortes, completar turno), y dos
// de ellos —createVenta y createCorte— ni siquiera validaban el valor contra el
// enum (solo su presencia). Centralizarlo cierra ese hueco y evita que las
// ramas diverjan a futuro. Ver auditoría (hallazgo forma_pago, tanda 7a).

// Formas de pago aceptadas por el sistema. Espeja el CHECK de la columna
// forma_pago en la DB (ventas/gastos/cortes).
export const FORMAS_PAGO = ['efectivo', 'mercado_pago'];

/**
 * esFormaPagoValida
 * @param {*} valor - Valor recibido del body.
 * @returns {boolean} true si es una de las formas de pago aceptadas.
 */
export function esFormaPagoValida(valor) {
  return FORMAS_PAGO.includes(valor);
}
