// /backend/src/scripts/crearTenant.js
// Crea un nuevo tenant en la DB con su PIN y sus credenciales operativas hasheados
// y suscripción vigente hasta fin de mes.
//
// Uso:
//   cd backend
//   node src/scripts/crearTenant.js "Nombre Barbería" subdominio 1234 usuario password
//
// Argumentos:
//   1. nombre del negocio (string, entre comillas si tiene espacios)
//   2. subdominio (string, sin puntos ni espacios)
//   3. PIN admin de 4 dígitos (string)
//   4. usuario operativo, al menos 3 caracteres (string)
//   5. password operativa, al menos 8 caracteres (string)

import bcrypt from 'bcrypt';
import { query } from '../config/db.js';
import { errorCredencialesOperativas, hashearPasswordOperativa } from '../utils/credencialesOperativas.js';

/**
 * Calcula el último día del mes actual en formato YYYY-MM-DD.
 * Truco: el día 0 del mes siguiente es el último día del mes actual.
 * @returns {string} fecha en formato 'YYYY-MM-DD'
 */
function ultimoDiaDelMes() {
  const hoy = new Date();
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return ultimoDia.toISOString().slice(0, 10);
}

/**
 * Crea un tenant nuevo en la DB.
 * Valida los argumentos, verifica que el subdominio no exista, hashea el PIN y
 * la password operativa y hace el INSERT. Imprime el resultado por consola.
 */
async function crearTenant() {
  console.log('[crearTenant] Iniciando...');

  // 1. Leer y validar argumentos
  const [, , nombre, subdominio, pinPlano, usuarioOperativo, passwordOperativa] = process.argv;

  if (!nombre || !subdominio || !pinPlano || !usuarioOperativo || !passwordOperativa) {
    console.error('[crearTenant] Error: faltan argumentos.');
    console.error('Uso: node src/scripts/crearTenant.js "Nombre" subdominio pin usuario password');
    process.exit(1);
  }

  if (!/^\d{4}$/.test(pinPlano)) {
    console.error('[crearTenant] Error: el PIN debe ser exactamente 4 dígitos numéricos.');
    process.exit(1);
  }

  const errorCredenciales = errorCredencialesOperativas(usuarioOperativo, passwordOperativa);
  if (errorCredenciales) {
    console.error(`[crearTenant] Error: ${errorCredenciales}`);
    process.exit(1);
  }

  try {
    // 2. Verificar que el subdominio no exista
    const existe = await query(
      'SELECT id FROM tenant WHERE subdominio = $1',
      [subdominio]
    );

    if (existe.rows.length > 0) {
      console.error(`[crearTenant] Error: el subdominio "${subdominio}" ya existe.`);
      process.exit(1);
    }

    // 3. Hashear el PIN y la password operativa
    const pinHasheado = await bcrypt.hash(pinPlano, 10);
    const passwordOperativaHash = await hashearPasswordOperativa(passwordOperativa);

    // 4. Calcular fecha de fin de suscripción (último día del mes actual)
    const fechaSuscripcion = ultimoDiaDelMes();

    // 5. INSERT del tenant
    const resultado = await query(
      `INSERT INTO tenant
        (nombre_negocio, subdominio, pin_admin, suscripcion_vigente_hasta,
         operativo_usuario, operativo_password_hash, activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id`,
      [nombre, subdominio, pinHasheado, fechaSuscripcion, usuarioOperativo, passwordOperativaHash]
    );

    const tenantId = resultado.rows[0].id;

    // 6. Seed del horario de atención default: Lunes a Sábado 10:00-19:00.
    // Convención dia_semana: 0=domingo ... 6=sábado. L-S = 1..6 (domingo cerrado, sin fila).
    // Best-effort: si este INSERT falla, el tenant ya quedó creado (no hay transacción
    // por PgBouncer). Avisamos pero no abortamos; el dueño puede cargar el horario
    // desde el panel admin.
    let horarioSeedOk = true;
    try {
      await query(
        `INSERT INTO tenant_horario_atencion (tenant_id, dia_semana, hora_inicio, hora_fin)
         SELECT $1, dia, '10:00', '19:00'
         FROM unnest(ARRAY[1, 2, 3, 4, 5, 6]) AS dia`,
        [tenantId]
      );
    } catch (errHorario) {
      horarioSeedOk = false;
      console.warn(
        `[crearTenant] ⚠ El tenant se creó, pero falló el seed del horario de atención: ${errHorario.message}`
      );
      console.warn('[crearTenant] ⚠ Cargá el horario manualmente desde el panel admin (TabNegocio).');
    }

    // 7. Output
    console.log('[crearTenant] ✅ Tenant creado correctamente');
    console.log(`  ID:           ${tenantId}`);
    console.log(`  Nombre:       ${nombre}`);
    console.log(`  Subdominio:   ${subdominio}`);
    console.log(`  Operativo:    ${usuarioOperativo}`);
    console.log(`  Suscripción:  vigente hasta ${fechaSuscripcion}`);
    console.log(`  Horario:      ${horarioSeedOk ? 'L-S 10:00-19:00 (default, ajustable desde el admin)' : 'NO seedeado — cargar manualmente'}`);
    console.log(`  URL:          ${subdominio}.barbermanager.app`);

    process.exit(0);
  } catch (err) {
    console.error('[crearTenant] Error:', err.message);
    process.exit(1);
  }
}

crearTenant();