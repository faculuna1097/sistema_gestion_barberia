// Script de prueba aislado para el mail de recordatorio (services/mailer.js →
// enviarRecordatorio). Manda un recordatorio de ejemplo a una casilla de test.
// Ejecutar desde /backend: node src/scripts/probarRecordatorioMail.js
// Verificación: abrir la bandeja del destinatario y revisar el render (eyebrow
// indigo "Recordatorio de turno", filas Servicio/Barbero/Fecha/Horario +
// Dirección con link a Maps, CTA "Gestionar turno", remitente = nombre del negocio).
//
// Esto prueba sólo el RENDER del mail (objetos a mano, sin DB). El camino del
// lote (query + claim + envío real) se prueba con scripts/probarRecordatorios.js.

import 'dotenv/config';
import { enviarRecordatorio } from '../services/mailer.js';

const main = async () => {
  // Mañana 11:30 — 12:00.
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(11, 30, 0, 0);
  const finManana = new Date(manana.getTime() + 30 * 60 * 1000);

  const turno    = { inicio: manana.toISOString(), fin: finManana.toISOString() };
  const barbero  = { nombre: 'Facundo' };
  const servicio = { nombre: 'Corte de prueba' };
  const cliente  = { nombre: 'Cliente Test', email: 'faculunacarp@gmail.com' };
  // tenant con dirección para ejercitar la fila "Dirección" (link a Maps) y el
  // remitente con el nombre del negocio.
  const tenant   = { nombre: 'Barbería Demo', direccion: 'Av. Corrientes 1234, CABA' };

  const linkGestion = 'https://demo.barbermanager.app/turnos/gestionar/TOKEN-DEMO';

  console.log('--- enviarRecordatorio ---');
  await enviarRecordatorio(turno, barbero, servicio, cliente, linkGestion, tenant);

  console.log('--- script terminado ---');
};

main().catch((err) => {
  console.error('[probarRecordatorioMail] Error en main:', err.message);
  process.exit(1);
});
