// Script de prueba aislado para services/googleCalendar.js.
// Crea un evento mañana 10:00, lo actualiza a 11:00, lo cancela.
// Ejecutar desde /backend: node src/scripts/probarGoogleCalendar.js
// Verificación: revisar Google Calendar de turnos.barbermanager@gmail.com
// y el Gmail del barbero invitado (faculunacarp@gmail.com).

import 'dotenv/config';
import { crearEvento, actualizarEvento, cancelarEvento } from '../services/googleCalendar.js';

const dormir = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const main = async () => {
  // Mañana 10:00 — 10:30 (timestamps en UTC, el service los reformatea a TZ AR).
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(10, 0, 0, 0);
  const finManana = new Date(manana.getTime() + 30 * 60 * 1000);

  // 11:00 — 11:30 para el update.
  const mananaActualizado = new Date(manana.getTime() + 60 * 60 * 1000);
  const finMananaActualizado = new Date(mananaActualizado.getTime() + 30 * 60 * 1000);

  const barbero  = { nombre: 'Facundo', email: 'faculunacarp@gmail.com' };
  const servicio = { nombre: 'Corte de prueba' };
  const cliente  = { nombre: 'Cliente Test', telefono: '1112345678', email: 'cliente@example.com' };

  console.log('--- 1) crearEvento ---');
  const eventId = await crearEvento(
    { inicio: manana.toISOString(), fin: finManana.toISOString() },
    barbero,
    servicio,
    cliente
  );
  if (!eventId) {
    console.error('Falló crearEvento, abortando script.');
    process.exit(1);
  }

  await dormir(2000);

  console.log('--- 2) actualizarEvento (10:00 -> 11:00) ---');
  await actualizarEvento(
    eventId,
    { inicio: mananaActualizado.toISOString(), fin: finMananaActualizado.toISOString() },
    barbero,
    servicio,
    cliente
  );

  await dormir(2000);

  console.log('--- 3) cancelarEvento ---');
  await cancelarEvento(eventId);

  console.log('--- script terminado ---');
};

main().catch(err => {
  console.error('[probarGoogleCalendar] Error en main:', err.message);
  process.exit(1);
});
