// Script de prueba aislado para services/mail/mailer.js.
// Envía los 4 tipos de mail a faculunacarp@gmail.com.
// Ejecutar desde /backend: node src/scripts/probarMailer.js
// Verificación: abrir la bandeja de entrada del destinatario.

import 'dotenv/config';
import {
  enviarConfirmacion,
  enviarCancelacion,
  enviarReprogramacion,
  enviarCancelacionAutomatica,
} from '../services/mail/mailer.js';

const main = async () => {
  // Mañana 10:00 — 10:30 (timestamps fijos para que los 4 mails muestren la misma fecha).
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(10, 0, 0, 0);
  const finManana = new Date(manana.getTime() + 30 * 60 * 1000);

  const turno    = { inicio: manana.toISOString(), fin: finManana.toISOString() };
  const barbero  = { nombre: 'Facundo' };
  const servicio = { nombre: 'Corte de prueba' };
  const cliente  = { nombre: 'Cliente Test', email: 'faculunacarp@gmail.com' };
  // tenant del negocio: el nombre arma el título y el remitente; la dirección
  // arma la fila "Dirección" con link a Maps. Sin tenant, enviarConfirmacion y
  // enviarReprogramacion rompen al leer tenant.nombre.
  const tenant   = { nombre: 'Barbería Demo', direccion: 'Av. Corrientes 1234, CABA' };

  const linkGestion = 'https://demo.barbermanager.app/turnos/TOKEN-DEMO';
  const linkTurnero = 'https://demo.barbermanager.app/turnos/';

  console.log('--- 1) enviarConfirmacion ---');
  await enviarConfirmacion(turno, barbero, servicio, cliente, linkGestion, tenant);

  console.log('--- 2) enviarCancelacion (canceladoPor=cliente) ---');
  await enviarCancelacion(turno, barbero, servicio, cliente, 'cliente', tenant);

  console.log('--- 3) enviarReprogramacion ---');
  await enviarReprogramacion(turno, barbero, servicio, cliente, linkGestion, tenant);

  console.log('--- 4) enviarCancelacionAutomatica ---');
  await enviarCancelacionAutomatica(
    turno, barbero, servicio, cliente,
    { intro: 'Hola Cliente Test, el barbero suspendió su agenda y tuvimos que cancelar este turno.', motivo: 'Vacaciones' },
    linkTurnero,
    tenant,
  );

  console.log('--- script terminado ---');
};

main().catch(err => {
  console.error('[probarMailer] Error en main:', err.message);
  process.exit(1);
});
