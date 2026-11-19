// Entrypoint del cron de cierre diario de turnos sin cobrar (F3,
// docs/plan_mejoras_operativas.md §4). Corre a las 03:00 AR (06:00 UTC) y pasa a
// 'no_asistio' (no_asistio_por = 'sistema') los turnos 'reservado' que terminaron
// antes de las 00:00 AR de hoy, en todos los tenants activos.
//
// Cáscara fina, gemela de jobs/recordatorios.js: la lógica vive en
// services/turnosSinCobrarService.js (procesarCierreDiario). Acá solo se corre el
// lote, se loguea el resumen y se termina el proceso limpio: el pool de pg
// mantiene vivo el event loop, así que el finally drena el pool (cerrarPool) y
// hace process.exit con el código acorde (Railway Cron lo lee).
//
// Idempotente: cada tenant va en una sola sentencia con estado = 'reservado', así
// que una segunda corrida no cambia nada. Un tenant que falla va a Sentry con su
// tag y no corta a los demás. Acá solo se maneja el fallo CATASTRÓFICO (no conecta
// a la DB, no lee los tenants), que sale con código 1.
// No manda mails ni toca Google Calendar (marcar "no asistió" a mano tampoco).
//
// Sentry: instrument.js es el PRIMER import (sin --import, el start command del
// servicio no cambia). Antes del process.exit se vacía la cola de Sentry.
//
// Monitor de latido (config/monitorCron.js, variable MONITOR_CIERRE_URL, solo en
// el servicio cron): avisa el arranque y el resultado a healthchecks.io. "Falla" es
// solo el fallo catastrófico; un tenant que falla es éxito del job (va a Sentry).
//
// Ejecutar desde /backend: node src/jobs/cierreDiario.js

import '../instrument.js';
import 'dotenv/config';
import { procesarCierreDiario } from '../services/turnosSinCobrarService.js';
import { cerrarPool } from '../config/db.js';
import { vaciarEventos } from '../config/sentry.js';
import { conMonitorCron } from '../config/monitorCron.js';

/**
 * lineaResumen
 * Arma la línea con los conteos del cierre. Va al log y como body del ping de
 * éxito al monitor: solo números, nunca datos de clientes.
 *
 * @param {Object} resumen - lo que devuelve procesarCierreDiario.
 * @returns {string} 'tenants: N | cerrados: N | tenants_fallidos: N'
 */
const lineaResumen = ({ tenants, cerrados, tenantsFallidos }) =>
  `tenants: ${tenants} | cerrados: ${cerrados} | tenants_fallidos: ${tenantsFallidos}`;

/**
 * main
 * Corre el cierre envuelto en el monitor, loguea el resumen y cierra el proceso.
 * @returns {Promise<void>} no retorna: termina con process.exit (0 ok, 1 fallo).
 */
const main = async () => {
  let code = 0;
  try {
    const resumen = await conMonitorCron(
      process.env.MONITOR_CIERRE_URL,
      () => procesarCierreDiario(),
      { describir: lineaResumen },
    );
    console.log(`[cierreDiario] job — cierre completo | ${lineaResumen(resumen)}`);
  } catch (err) {
    console.error('[cierreDiario] job — fallo catastrófico del cierre:', err);
    code = 1;
  } finally {
    try {
      await cerrarPool();
    } catch (err) {
      console.error('[cierreDiario] job — error cerrando el pool:', err);
    }
    await vaciarEventos(2000);
    process.exit(code);
  }
};

main();
