// /backend/src/utils/comision.js
// Única fuente de la comisión de un corte (Planillas, Balances y Caja), y la
// validación del % que se le carga a un barbero (al final del archivo).
//
// Reglas de negocio (2026-09-29): la comisión es siempre un porcentaje sobre el
// precio del servicio (nunca sobre la propina), y las propinas van siempre al
// barbero. El % se guarda en el corte al registrarlo (corte.comision_porcentaje,
// desde el 2026-11-03): cambiarle el % a un barbero vale solo para adelante.
//
// Mientras corte.comision_porcentaje sea nullable, un corte sin ese dato (lo
// guarda el backend anterior hasta el deploy) usa el % actual del barbero. Ver el
// paso del deploy en docs/estado_actual.md.
//
// Criterio de redondeo: la comisión de cada corte se redondea a centavos y
// los totales son sumas de esos valores. Así el Balance mensual, el histórico y
// las Planillas (por corte, por día y por semana) dan siempre lo mismo.

/**
 * porcentajeComisionSql
 * Expresión SQL del % de comisión de un corte: el guardado en el corte o, si está
 * vacío, el % actual del barbero (y 0 si el barbero tampoco tiene).
 * @param {string} corte - Alias de la tabla corte en la query (ej. 'c').
 * @param {string} barbero - Alias de la tabla barbero en la query (ej. 'b').
 * @returns {string} Fragmento SQL de tipo numeric.
 */
export const porcentajeComisionSql = (corte, barbero) =>
  `COALESCE(${corte}.comision_porcentaje, ${barbero}.comision_valor, 0)`;

/**
 * comisionCorteSql
 * Expresión SQL de la comisión de un corte, redondeada a centavos: precio × % / 100.
 * No incluye la propina.
 * @param {string} corte - Alias de la tabla corte en la query (ej. 'c').
 * @param {string} barbero - Alias de la tabla barbero en la query (ej. 'b').
 * @returns {string} Fragmento SQL de tipo numeric (2 decimales).
 */
export const comisionCorteSql = (corte, barbero) =>
  `ROUND(${corte}.precio * ${porcentajeComisionSql(corte, barbero)} / 100, 2)`;

/**
 * porcentajesDistintos
 * Convierte el array de % que devuelve Postgres (numeric[] → strings) en números
 * ordenados y sin repetir. Es lo que los fronts muestran como "50%" o "45–50%"
 * cuando un barbero tuvo dos % en el período.
 * @param {Array<string|number>|null} valores - Resultado de un array_agg(DISTINCT ...).
 * @returns {number[]} % ordenados de menor a mayor; [] si no hubo cortes.
 */
export const porcentajesDistintos = (valores) =>
  [...new Set((valores ?? []).filter((v) => v !== null).map(Number))].sort((a, b) => a - b);

// ─── % de comisión que llega del cliente (alta y edición de barbero) ─────────
// En Gestión → Barberos el % se elige con una barra de 0 a 100 de a 5, y el
// alta y la edición de barbero (controllers/gestion.js) aceptan solo esos valores.

/** PASO_COMISION: lo que salta la barra de la comisión. */
export const PASO_COMISION = 5;

/** MENSAJE_COMISION_INVALIDA: texto del 400 de un % que no pasa esComisionValida. */
export const MENSAJE_COMISION_INVALIDA = 'comision_valor debe ser un múltiplo de 5 entre 0 y 100';

/**
 * esComisionValida
 * Valida el % de comisión de un barbero: múltiplo de PASO_COMISION entre 0 y 100.
 * Acepta number o string numérico, como los validadores de validarNumero.js.
 * @param {*} valor - req.body.comision_valor
 * @returns {boolean} true si es 0, 5, 10… o 100.
 */
export function esComisionValida(valor) {
  // Number('') y Number(null) dan 0: sin este guard, un campo vacío pasaría como 0 %.
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    return false;
  }
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 && n <= 100 && n % PASO_COMISION === 0;
}
