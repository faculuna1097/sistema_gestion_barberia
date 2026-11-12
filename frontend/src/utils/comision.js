// /frontend/src/utils/comision.js
// Helpers de presentación de la comisión de los barberos (Planillas y Balances)
// y el rango de la barra con que se elige (Gestión → Barberos, al final).
//
// El front NO calcula comisiones: la comisión de cada corte la manda el backend
// (backend/src/utils/comision.js, la única fuente), con el % guardado en el corte.
// Acá solo se suman esos valores y se arma el texto del %.
// Las de presentación tienen copia en frontend-barbero/src/utils/comision.js
// (mismo contrato); las de la barra son solo del panel.

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
 * porcentajesDeCortes
 * Los % de comisión distintos de una lista de cortes, de menor a mayor.
 * @param {Array<{comision_porcentaje: number}>} cortes - Cortes de /admin/planilla.
 * @returns {number[]} Ej: [50] o [45, 50] si se le cambió el % en el medio.
 */
export function porcentajesDeCortes(cortes) {
  return [...new Set(cortes.map((c) => c.comision_porcentaje))].sort((a, b) => a - b);
}

/**
 * textoPorcentajeComision
 * Texto del % de comisión de un período: "50%" si fue uno solo, "45–50%" si el
 * barbero tuvo dos o más en el período (se le cambió el % en el medio).
 * @param {number[]} porcentajes - % distintos de los cortes del período
 *   (`comision_porcentajes` del backend o `porcentajesDeCortes`).
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

// ─── Rango de la barra de la comisión (Gestión → Barberos) ───────────────────
// El backend acepta solo múltiplos de 5 entre 0 y 100 (esComisionValida en
// backend/src/utils/comision.js). Mismos valores que frontend-alta/src/utils/equipo.js.

/** PASO_COMISION: lo que salta la barra de la comisión (y los botones - y +). */
export const PASO_COMISION = 5;

/** COMISION_MAXIMA: el tope del %. */
export const COMISION_MAXIMA = 100;

/** COMISION_POR_DEFECTO: con qué % arranca un barbero nuevo (el reparto más común). */
export const COMISION_POR_DEFECTO = 50;

/**
 * esComisionValida
 * Espejo de la validación del backend: múltiplo de PASO_COMISION entre 0 y COMISION_MAXIMA.
 * @param {number|null} valor - El % elegido
 * @returns {boolean}
 */
export function esComisionValida(valor) {
  return Number.isInteger(valor) && valor >= 0 && valor <= COMISION_MAXIMA && valor % PASO_COMISION === 0;
}
