// Script de prueba aislado para services/recordatoriosService.js.
// Corre el lote de recordatorios en modo dry-run: lista a quién se le mandaría
// el recordatorio del día objetivo (hoy + RECORDATORIO_DIAS_ANTES) por cada
// tenant con el feature prendido, SIN enviar mails ni marcar nada en la DB.
// Ejecutar desde /backend: node src/scripts/probarRecordatorios.js
// Verificación: revisar los logs [recordatorios] en la consola.
//
// Nota: el pool de pg mantiene vivo el event loop, así que el script termina
// con process.exit explícito (no se cierra solo).

import 'dotenv/config';
import { procesarRecordatorios } from '../services/recordatoriosService.js';

const main = async () => {
  const resumen = await procesarRecordatorios({ dryRun: true });
  console.log('[probarRecordatorios] resumen:', resumen);
  console.log('--- script terminado ---');
  process.exit(0);
};

main().catch((err) => {
  console.error('[probarRecordatorios] Error en main:', err);
  process.exit(1);
});
