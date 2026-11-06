// /frontend-barbero/src/utils/comision.js
// Helpers de presentación de la comisión del barbero (Mi planilla).
//
// El front NO calcula comisiones: la comisión de cada corte la manda el backend
// (backend/src/utils/comision.js, la única fuente), con el % guardado en el corte.
// Acá solo se suman esos valores y se arma el texto del %.
// Copia de frontend/src/utils/comision.js (mismo contrato; sin
// porcentajesDeCortes, que este front no usa).

/**
 * sumarComision
 * Suma la comisión (sin propinas) de una lista de cortes, tal como la manda el
 * backend en cada corte del detalle de la planilla.
 * @param {Array<{comision: number}>} cortes - Cortes de /admin/planilla.
 * @returns {number} Comisión de esos cortes, sin propinas.
 */
export function sumarComision(cortes) {
  return cortes.reduce((s, c) => s + c.comision, 0);
}

/**
 * textoPorcentajeComision
 * Texto del % de comisión de un período: "50%" si fue uno solo, "45–50%" si el
 * barbero tuvo dos o más en el período (se le cambió el % en el medio).
 * @param {number[]} porcentajes - % distintos de los cortes del período
 *   (`comision_porcentajes` del backend).
 * @param {number} porcentajeActual - % actual del barbero (`comision_valor`):
 *   se usa si no hubo cortes en el período.
 * @returns {string} Ej: '50%', '45–50%', '42,5%'
 */
export function textoPorcentajeComision(porcentajes, porcentajeActual) {
  const lista = porcentajes?.length ? porcentajes : [porcentajeActual];
  const fmt = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const minimo = lista[0];
  const maximo = lista[lista.length - 1];
  return minimo === maximo ? `${fmt(minimo)}%` : `${fmt(minimo)}–${fmt(maximo)}%`;
}
