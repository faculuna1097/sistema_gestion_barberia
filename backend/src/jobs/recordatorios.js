// Entrypoint del cron diario de recordatorios de turno (la "noche anterior").
// Cáscara fina (ver docs/decisiones_mail_recordatorio.md): NO reescribe lógica, sólo
// invoca procesarRecordatorios en envío real, loguea el resumen del lote y termina
// el proceso limpio.
//
// Por qué hay que terminar a mano: el pool de pg mantiene vivo el event loop, así
// que el proceso no se cierra solo. El finally drena el pool (cerrarPool) y hace
// process.exit con el código acorde — Railway Cron lo lee para marcar la corrida.
//
// El lote ya es best-effort por turno (un fallo aislado no tira el resto, y el
// claim atómico lo hace re-ejecutable sin doble envío). Acá sólo manejamos el
// fallo CATASTRÓFICO (ej.: no conecta a la DB, falla obtenerTenantsActivos), que
// sale con código 1.
//
// Sentry: instrument.js es el PRIMER import (inicializa Sentry antes que todo; acá
// no se usa --import, así el start command del servicio cron no cambia). Antes del
// process.exit se vacía la cola de Sentry: si no, los errores del lote se pierden.
//
// Monitor de latido (config/monitorCron.js, variable MONITOR_RECORDATORIOS_URL): el
// lote corre envuelto en conMonitorCron, que avisa el arranque y el resultado a
// healthchecks.io. Así llega un aviso si el job no corrió o se colgó (Sentry no lo
// ve). "Falla" es solo el fallo catastrófico; un mail aislado que falla es éxito
// del job (ese ya va a Sentry). Los pings se resuelven antes del finally.
//
// Ejecutar desde /backend: node src/jobs/recordatorios.js

import '../instrument.js';
import 'dotenv/config';
import { procesarRecordatorios } from '../services/recordatoriosService.js';
import { cerrarPool } from '../config/db.js';
import { vaciarEventos } from '../config/sentry.js';
import { conMonitorCron } from '../config/monitorCron.js';

/**
 * lineaResumen
 * Arma la línea con los conteos del lote. Va al log y como body del ping de éxito
 * al monitor: solo números, nunca datos de clientes.
 *
 * @param {Object} resumen - lo que devuelve procesarRecordatorios.
 * @returns {string} 'tenants_con_recordatorio: N | enviados: N | ...'
 */
const lineaResumen = ({ tenantsConRecordatorio, enviados, salteados, fallidos, yaReclamados }) =>
  `tenants_con_recordatorio: ${tenantsConRecordatorio} | enviados: ${enviados} | salteados: ${salteados} | fallidos: ${fallidos} | ya_reclamados: ${yaReclamados}`;

const main = async () => {
  let code = 0;
  try {
    const resumen = await conMonitorCron(
      process.env.MONITOR_RECORDATORIOS_URL,
      () => procesarRecordatorios({ dryRun: false }),
      { describir: lineaResumen },
    );
    console.log(`[recordatorios] job — lote completo | ${lineaResumen(resumen)}`);
  } catch (err) {
    console.error('[recordatorios] job — fallo catastrófico del lote:', err);
    code = 1;
  } finally {
    try {
      await cerrarPool();
    } catch (err) {
      console.error('[recordatorios] job — error cerrando el pool:', err);
    }
    await vaciarEventos(2000);
    process.exit(code);
  }
};

main();
