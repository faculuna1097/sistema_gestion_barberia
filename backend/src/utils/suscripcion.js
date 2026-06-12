// /backend/src/utils/suscripcion.js
// Evalúa el estado de la suscripción mensual de un tenant en TZ Argentina.
// Modelo de cobro: la suscripción se considera "no renovada" si no hay fecha de
// vigencia o si venció antes del primer día del mes actual. Días 5–10 sin renovar
// → aviso. Día 11+ sin renovar → bloqueo.

import { DateTime } from 'luxon';
import { TZ } from './constantes.js';

/**
 * evaluarSuscripcion
 * Decide, en TZ Argentina, si un tenant debe ser bloqueado o avisado por falta
 * de pago, según hasta cuándo está vigente su suscripción y el día del mes actual.
 * Función pura de cálculo: no loguea ni responde HTTP. El caller decide qué hacer
 * con el resultado (402 si bloqueado, aviso_pago en la respuesta si corresponde).
 *
 * @param {Date|string|null} suscripcionVigenteHasta - Fecha de vigencia (columna
 *        DATE de la DB, llega como Date) o null si nunca se registró un pago.
 * @returns {{ bloqueado: boolean, aviso_pago: boolean }}
 *          bloqueado=true → día 11+ sin renovar (cortar acceso, 402).
 *          aviso_pago=true → días 5–10 sin renovar (dejar pasar, avisar).
 */
export function evaluarSuscripcion(suscripcionVigenteHasta) {
  const ahoraArg = DateTime.now().setZone(TZ);
  const diaDelMes = ahoraArg.day;
  const primerDiaMesStr = ahoraArg.startOf('month').toISODate();

  const vigenteHastaStr = suscripcionVigenteHasta
    ? new Date(suscripcionVigenteHasta).toISOString().slice(0, 10)
    : null;

  const suscripcionNoRenovada = vigenteHastaStr === null || vigenteHastaStr < primerDiaMesStr;

  const bloqueado  = diaDelMes > 10 && suscripcionNoRenovada;
  const aviso_pago = diaDelMes >= 5 && diaDelMes <= 10 && suscripcionNoRenovada;

  return { bloqueado, aviso_pago };
}
