// /backend/src/config/monitorCron.js
// Monitor de "latido" para los jobs de cron (hoy healthchecks.io). Cubre lo que
// Sentry no ve: que el job NO corrió (Railway no lo lanzó) o que arrancó y se
// colgó. El servicio espera un ping por corrida; si no llega a tiempo, avisa a
// Discord.
//
// Protocolo (el de healthchecks.io, compatible con la mayoría de estos servicios):
//   <url>/start  → la corrida arrancó (permite detectar un job colgado)
//   <url>        → la corrida terminó bien (body opcional: se ve en su panel)
//   <url>/fail   → la corrida falló entera
//
// Reglas:
// - Sin URL no hace nada: en local y en los scripts el job corre igual.
// - Un ping que falla o tarda NUNCA rompe el job: timeout corto y console.warn.
//   No console.error: ese iría a Sentry y sería una alerta falsa en el celular.
// - La URL de ping es un secreto chico (cualquiera que la tenga manda pings): no
//   se loguea; los warns solo dicen qué ping falló.
// - No pasa por Sentry: es un canal independiente.

const TIMEOUT_PING_MS = 5000;

/**
 * pingear (interna)
 * Manda un ping al monitor. Nunca tira: cualquier falla (red, timeout, respuesta
 * no 2xx) queda en un console.warn y el job sigue.
 *
 * @param {string} url - URL completa del ping (con /start o /fail si corresponde).
 * @param {string} tipo - 'start' | 'exito' | 'fail', solo para el log.
 * @param {string} [body] - texto opcional que el monitor guarda con el ping.
 * @returns {Promise<void>} se resuelve siempre, haya andado o no el ping.
 */
const pingear = async (url, tipo, body) => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: body ?? '',
      signal: AbortSignal.timeout(TIMEOUT_PING_MS),
    });
    if (!res.ok) {
      console.warn(`[monitorCron] pingear — el monitor rechazó el ping | tipo: ${tipo} | status: ${res.status}`);
    }
  } catch (err) {
    console.warn(`[monitorCron] pingear — ping fallido | tipo: ${tipo} | motivo: ${err.name}: ${err.message}`);
  }
};

/**
 * conMonitorCron
 * Corre fn avisándole al monitor el arranque y el resultado de la corrida.
 * Los pings se resuelven antes de devolver o tirar, así que el llamador puede
 * cerrar el pool y hacer process.exit después sin perderlos.
 *
 * @param {string|undefined} urlPing - URL de ping del check (variable de entorno).
 *   Vacía o undefined: no se manda ningún ping y fn corre igual.
 * @param {() => Promise<T>} fn - el trabajo del job.
 * @param {Object} [opciones]
 * @param {(resultado: T) => string} [opciones.describir] - arma el texto que va
 *   con el ping de éxito. Solo conteos: nunca datos de clientes.
 * @returns {Promise<T>} el resultado de fn.
 * @throws el mismo error que tiró fn, después de mandar el ping de /fail.
 * @template T
 */
export const conMonitorCron = async (urlPing, fn, { describir } = {}) => {
  const base = urlPing?.trim().replace(/\/+$/, '');
  if (!base) return fn();

  await pingear(`${base}/start`, 'start');

  let resultado;
  try {
    resultado = await fn();
  } catch (err) {
    // Sin body: el detalle del error ya llega a Sentry y su texto podría traer
    // datos de queries o de conexión.
    await pingear(`${base}/fail`, 'fail');
    throw err;
  }

  let body;
  if (describir) {
    try {
      body = describir(resultado);
    } catch (err) {
      console.warn(`[monitorCron] conMonitorCron — no se pudo armar el resumen del ping | motivo: ${err.message}`);
    }
  }
  await pingear(base, 'exito', body);
  return resultado;
};
