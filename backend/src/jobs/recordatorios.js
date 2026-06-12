// Entrypoint del cron diario de recordatorios de turno (la "noche anterior").
// Cáscara fina (plan §5): NO reescribe lógica, sólo invoca procesarRecordatorios
// en envío real, loguea el resumen del lote y termina el proceso limpio.
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
// Ejecutar desde /backend: node src/jobs/recordatorios.js

import 'dotenv/config';
import { procesarRecordatorios } from '../services/recordatoriosService.js';
import { cerrarPool } from '../config/db.js';

const main = async () => {
  let code = 0;
  try {
    const { tenantsConRecordatorio, enviados, salteados, fallidos, yaReclamados } =
      await procesarRecordatorios({ dryRun: false });
    console.log(`[recordatorios] job — lote completo | tenants_con_recordatorio: ${tenantsConRecordatorio} | enviados: ${enviados} | salteados: ${salteados} | fallidos: ${fallidos} | ya_reclamados: ${yaReclamados}`);
  } catch (err) {
    console.error('[recordatorios] job — fallo catastrófico del lote:', err);
    code = 1;
  } finally {
    try {
      await cerrarPool();
    } catch (err) {
      console.error('[recordatorios] job — error cerrando el pool:', err);
    }
    process.exit(code);
  }
};

main();
