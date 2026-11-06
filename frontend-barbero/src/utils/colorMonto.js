// /frontend-barbero/src/utils/colorMonto.js
// Color semántico de los montos. La regla completa (qué monto va en verde, en
// rojo o en negro) está en docs/sistema_de_disenio.md §3.1.1 "Color en montos".
//
// Archivo propio y no dentro de formato.js: formato.js no tiene dependencias y
// este helper necesita los tokens del tema.

import { theme } from '../theme/tokens.js';

/**
 * colorResultado
 * Color del número final de una cuenta (ganancia del mes, "queda en el
 * negocio", neto de un medio de pago en Caja): verde si es ganancia, rojo si es
 * pérdida y negro si da cero, que no es ni una cosa ni la otra.
 * Solo para resultados: un ingreso no va en verde aunque sea positivo.
 *
 * El signo se mira sobre el monto redondeado a pesos, igual que lo redondea
 * fmtPesos: un -0,3 se muestra "$ 0" y tiene que ir en negro, no en rojo.
 *
 * @param {number} monto - Resultado de la cuenta, en pesos.
 * @returns {string} Token de color de `theme`: success, danger o ink.
 */
export function colorResultado(monto) {
  const redondeado = Math.round(Number(monto));
  if (redondeado > 0) return theme.success;
  if (redondeado < 0) return theme.danger;
  return theme.ink;
}
