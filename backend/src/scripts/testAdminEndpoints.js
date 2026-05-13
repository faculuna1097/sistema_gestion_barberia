// /backend/src/scripts/testAdminEndpoints.js
// Script de prueba para todos los endpoints de /api/admin/*.
// Uso: node src/scripts/testAdminEndpoints.js
// Requiere: servidor corriendo en localhost:3001, tenant demo con datos.

import 'dotenv/config';
import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3001';
const TENANT = 'demo';
const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000002';
const BARBERO_FACUNDO = 'a74343cf-9388-452f-bcff-7df58d63244b';
const BARBERO_ALEJO = '2c1e1cf8-f8a6-470d-bc88-890b44550161';
const SERVICIO_CORTE = 'b39e6718-9121-43f7-a2be-31d31b7a7c30';

// Generar tokens
const adminToken = jwt.sign({ tenant_id: TENANT_ID, rol: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const barberoToken = jwt.sign({ tenant_id: TENANT_ID, rol: 'barbero', barbero_id: BARBERO_FACUNDO }, process.env.JWT_SECRET, { expiresIn: '1h' });

const headersAdmin = { 'X-Tenant-Subdomain': TENANT, 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
const headersBarbero = { 'X-Tenant-Subdomain': TENANT, 'Authorization': `Bearer ${barberoToken}`, 'Content-Type': 'application/json' };

let passed = 0;
let failed = 0;

/**
 * Helper para ejecutar un test. Compara el status esperado.
 * @param {string} nombre
 * @param {string} method
 * @param {string} path
 * @param {Object} headers
 * @param {Object|null} body
 * @param {number} expectedStatus
 * @returns {Promise<Object|null>} body parseado si fue exitoso
 */
async function test(nombre, method, path, headers, body, expectedStatus) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json().catch(() => null);
    if (res.status === expectedStatus) {
      console.log(`  ✅ ${nombre} — ${res.status}`);
      passed++;
      return data;
    } else {
      console.log(`  ❌ ${nombre} — esperaba ${expectedStatus}, recibió ${res.status}`);
      if (data?.error) console.log(`     error: ${data.error}`);
      failed++;
      return null;
    }
  } catch (err) {
    console.log(`  ❌ ${nombre} — fetch falló: ${err.message}`);
    failed++;
    return null;
  }
}

/**
 * Espera a que el servidor esté listo (health check).
 */
async function waitForServer(maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  console.error('❌ Servidor no responde después de 10 intentos');
  process.exit(1);
}

async function main() {
  console.log('Esperando que el servidor esté listo...');
  await waitForServer();
  console.log('Servidor listo.\n');

  // Fecha futura para crear turnos (pasado mañana a las 10:00 y 11:00)
  const pasadoManana = new Date();
  pasadoManana.setDate(pasadoManana.getDate() + 2);
  const fechaStr = pasadoManana.toISOString().slice(0, 10);
  const inicio1 = `${fechaStr}T10:00:00-03:00`;
  const inicio2 = `${fechaStr}T11:00:00-03:00`;

  console.log(`\nFecha de prueba: ${fechaStr}\n`);

  // ══════════════════════════════════════════════════════════════════════
  console.log('── TURNOS ──────────────────────────────────────────────');

  const t1 = await test('GET turnos por fecha (admin)',
    'GET', `/api/admin/turnos?fecha=${fechaStr}`, headersAdmin, null, 200);

  const t2 = await test('POST turno manual (admin, con email)',
    'POST', '/api/admin/turnos', headersAdmin,
    { servicio_id: SERVICIO_CORTE, barbero_id: BARBERO_FACUNDO, inicio: inicio1, nombre: 'Test Admin', telefono: '1155551234', email: 'testadmin@test.com' }, 201);

  await test('POST turno mismo slot — 409',
    'POST', '/api/admin/turnos', headersAdmin,
    { servicio_id: SERVICIO_CORTE, barbero_id: BARBERO_FACUNDO, inicio: inicio1, nombre: 'Duplicado', telefono: '111' }, 409);

  const t4 = await test('POST segundo turno otro slot (admin, sin email)',
    'POST', '/api/admin/turnos', headersAdmin,
    { servicio_id: SERVICIO_CORTE, barbero_id: BARBERO_FACUNDO, inicio: inicio2, nombre: 'Test Sin Email', telefono: '1155559999' }, 201);

  await test('GET turnos por fecha — ver los 2',
    'GET', `/api/admin/turnos?fecha=${fechaStr}`, headersAdmin, null, 200);

  if (t2) {
    await test('PATCH estado a completado',
      'PATCH', `/api/admin/turnos/${t2.turno_id}/estado`, headersAdmin,
      { estado: 'completado' }, 200);
  }

  if (t4) {
    await test('DELETE turno (cancelar)',
      'DELETE', `/api/admin/turnos/${t4.turno_id}`, headersAdmin, null, 200);
  }

  await test('POST turno con inicio pasado — 400',
    'POST', '/api/admin/turnos', headersAdmin,
    { servicio_id: SERVICIO_CORTE, barbero_id: BARBERO_FACUNDO, inicio: '2020-01-01T10:00:00-03:00', nombre: 'Viejo' }, 400);

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── HORARIOS ────────────────────────────────────────────');

  await test('PUT horarios Facundo (admin)',
    'PUT', `/api/admin/horarios/${BARBERO_FACUNDO}`, headersAdmin,
    [
      { dia_semana: 1, hora_inicio: '09:00', hora_fin: '13:00' },
      { dia_semana: 1, hora_inicio: '15:00', hora_fin: '19:00' },
      { dia_semana: 2, hora_inicio: '09:00', hora_fin: '18:00' },
    ], 200);

  const h2 = await test('GET horarios Facundo (admin)',
    'GET', `/api/admin/horarios/${BARBERO_FACUNDO}`, headersAdmin, null, 200);
  if (h2) console.log(`     bloques: ${h2.length}`);

  await test('PUT horarios con solapamiento — 400',
    'PUT', `/api/admin/horarios/${BARBERO_FACUNDO}`, headersAdmin,
    [
      { dia_semana: 1, hora_inicio: '09:00', hora_fin: '14:00' },
      { dia_semana: 1, hora_inicio: '13:00', hora_fin: '18:00' },
    ], 400);

  await test('GET horarios de OTRO barbero como barbero — 403',
    'GET', `/api/admin/horarios/${BARBERO_ALEJO}`, headersBarbero, null, 403);

  await test('GET horarios propios como barbero — 200',
    'GET', `/api/admin/horarios/${BARBERO_FACUNDO}`, headersBarbero, null, 200);

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── SUSPENSIONES ────────────────────────────────────────');

  // Crear turno para probar cancelación por suspensión
  const fechaSusp = new Date();
  fechaSusp.setDate(fechaSusp.getDate() + 5);
  const fechaSuspStr = fechaSusp.toISOString().slice(0, 10);
  const inicioSusp = `${fechaSuspStr}T10:00:00-03:00`;

  const turnoParaSusp = await test('POST turno para probar suspensión',
    'POST', '/api/admin/turnos', headersAdmin,
    { servicio_id: SERVICIO_CORTE, barbero_id: BARBERO_FACUNDO, inicio: inicioSusp, nombre: 'Cliente Suspendido', telefono: '111', email: 'susp@test.com' }, 201);

  await test('POST suspensión que pisa turno — sin confirmar — 409',
    'POST', '/api/admin/suspensiones', headersAdmin,
    { barbero_id: BARBERO_FACUNDO, desde: `${fechaSuspStr}T08:00:00-03:00`, hasta: `${fechaSuspStr}T20:00:00-03:00`, motivo: 'Vacaciones test' }, 409);

  const s3 = await test('POST suspensión con confirmar_cancelacion — 201',
    'POST', '/api/admin/suspensiones', headersAdmin,
    { barbero_id: BARBERO_FACUNDO, desde: `${fechaSuspStr}T08:00:00-03:00`, hasta: `${fechaSuspStr}T20:00:00-03:00`, motivo: 'Vacaciones test', confirmar_cancelacion: true }, 201);
  if (s3) console.log(`     turnos_cancelados: ${s3.turnos_cancelados}`);

  const s4 = await test('GET suspensiones (admin)',
    'GET', '/api/admin/suspensiones', headersAdmin, null, 200);
  if (s4) console.log(`     suspensiones: ${s4.length}`);

  // Crear una suspensión limpia para probar DELETE
  const fechaLimpia = new Date();
  fechaLimpia.setDate(fechaLimpia.getDate() + 10);
  const fechaLimpiaStr = fechaLimpia.toISOString().slice(0, 10);

  const s5 = await test('POST suspensión limpia para DELETE',
    'POST', '/api/admin/suspensiones', headersAdmin,
    { barbero_id: BARBERO_FACUNDO, desde: `${fechaLimpiaStr}T08:00:00-03:00`, hasta: `${fechaLimpiaStr}T12:00:00-03:00`, motivo: 'Para borrar' }, 201);

  if (s5?.suspension) {
    await test('DELETE suspensión',
      'DELETE', `/api/admin/suspensiones/${s5.suspension.id}`, headersAdmin, null, 200);
  }

  await test('GET suspensiones como barbero (solo las propias)',
    'GET', '/api/admin/suspensiones', headersBarbero, null, 200);

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── CLIENTES ────────────────────────────────────────────');

  await test('GET clientes busqueda=Test',
    'GET', '/api/admin/clientes?busqueda=Test', headersAdmin, null, 200);

  await test('GET clientes busqueda muy corta — 400',
    'GET', '/api/admin/clientes?busqueda=A', headersAdmin, null, 400);

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── PLANILLA ────────────────────────────────────────────');

  await test('GET planilla detalle (admin)',
    'GET', '/api/admin/planilla?semana=2026-05-11', headersAdmin, null, 200);

  await test('GET planilla resumen (admin)',
    'GET', '/api/admin/planilla/resumen?semana=2026-05-11', headersAdmin, null, 200);

  await test('GET planilla como barbero (scoping)',
    'GET', '/api/admin/planilla?semana=2026-05-11', headersBarbero, null, 200);

  await test('GET planilla formato inválido — 400',
    'GET', '/api/admin/planilla?semana=invalido', headersAdmin, null, 400);

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── ADMIN EXCLUSIVO (requiereRol) ────────────────────────');

  await test('GET /api/admin/barberos como admin — 200',
    'GET', '/api/admin/barberos', headersAdmin, null, 200);

  await test('GET /api/admin/servicios como admin — 200',
    'GET', '/api/admin/servicios', headersAdmin, null, 200);

  await test('GET /api/admin/barberos como barbero — 403',
    'GET', '/api/admin/barberos', headersBarbero, null, 403);

  await test('GET /api/admin/servicios como barbero — 403',
    'GET', '/api/admin/servicios', headersBarbero, null, 403);

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n── SCOPING BARBERO EN TURNOS ────────────────────────────');

  // Crear turno de Facundo para probar scoping
  const fechaScope = new Date();
  fechaScope.setDate(fechaScope.getDate() + 3);
  const fechaScopeStr = fechaScope.toISOString().slice(0, 10);

  const tScope = await test('POST turno como barbero (barbero_id del body se ignora)',
    'POST', '/api/admin/turnos', headersBarbero,
    { servicio_id: SERVICIO_CORTE, barbero_id: BARBERO_ALEJO, inicio: `${fechaScopeStr}T14:00:00-03:00`, nombre: 'Turno Barbero' }, 201);

  // Crear turno de Alejo (como admin) para verificar que barbero no lo ve
  const tAlejo = await test('POST turno de Alejo (admin)',
    'POST', '/api/admin/turnos', headersAdmin,
    { servicio_id: SERVICIO_CORTE, barbero_id: BARBERO_ALEJO, inicio: `${fechaScopeStr}T15:00:00-03:00`, nombre: 'Turno Alejo' }, 201);

  const turnosBarbero = await test('GET turnos como barbero — solo los propios',
    'GET', `/api/admin/turnos?fecha=${fechaScopeStr}`, headersBarbero, null, 200);
  if (turnosBarbero) {
    const todosDeFacto = turnosBarbero.every(t => t.barbero_id === BARBERO_FACUNDO);
    console.log(`     turnos: ${turnosBarbero.length} | todos de Facundo: ${todosDeFacto}`);
    if (!todosDeFacto) { console.log('  ❌ SCOPING ROTO: barbero ve turnos de otro'); failed++; }
  }

  // Barbero intenta cancelar turno de otro
  if (tAlejo) {
    await test('DELETE turno de Alejo como barbero — 404 (no lo ve)',
      'DELETE', `/api/admin/turnos/${tAlejo.turno_id}`, headersBarbero, null, 404);
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  RESULTADO: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main();
