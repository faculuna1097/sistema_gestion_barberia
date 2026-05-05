// /backend/src/scripts/crearTenant.js
// Crea un nuevo tenant en la DB con su PIN hasheado y suscripción vigente hasta fin de mes.
//
// Uso:
//   cd backend
//   node src/scripts/crearTenant.js "Nombre Barbería" subdominio 1234
//
// Argumentos:
//   1. nombre del negocio (string, entre comillas si tiene espacios)
//   2. subdominio (string, sin puntos ni espacios)
//   3. PIN admin de 4 dígitos (string)

import bcrypt from 'bcrypt';
import { query } from '../config/db.js';

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
 * Valida los argumentos, verifica que el subdominio no exista, hashea el PIN
 * y hace el INSERT. Imprime el resultado por consola.
 */
async function crearTenant() {
  console.log('[crearTenant] Iniciando...');

  // 1. Leer y validar argumentos
  const [, , nombre, subdominio, pinPlano] = process.argv;

  if (!nombre || !subdominio || !pinPlano) {
    console.error('[crearTenant] Error: faltan argumentos.');
    console.error('Uso: node src/scripts/crearTenant.js "Nombre" subdominio pin');
    process.exit(1);
  }

  if (!/^\d{4}$/.test(pinPlano)) {
    console.error('[crearTenant] Error: el PIN debe ser exactamente 4 dígitos numéricos.');
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

    // 3. Hashear el PIN
    const pinHasheado = await bcrypt.hash(pinPlano, 10);

    // 4. Calcular fecha de fin de suscripción (último día del mes actual)
    const fechaSuscripcion = ultimoDiaDelMes();

    // 5. INSERT del tenant
    // configuracion: default consistente con los tenants existentes (Kingsai y demo).
    // TODO: revisar si esta columna se usa efectivamente en el sistema.
    const configuracionDefault = { ciudad: 'Buenos Aires', moneda: 'ARS' };

    const resultado = await query(
      `INSERT INTO tenant
        (nombre_negocio, subdominio, pin_admin, suscripcion_vigente_hasta, configuracion, activo)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [nombre, subdominio, pinHasheado, fechaSuscripcion, configuracionDefault]
    );

    const tenantId = resultado.rows[0].id;

    // 6. Output
    console.log('[crearTenant] ✅ Tenant creado correctamente');
    console.log(`  ID:           ${tenantId}`);
    console.log(`  Nombre:       ${nombre}`);
    console.log(`  Subdominio:   ${subdominio}`);
    console.log(`  Suscripción:  vigente hasta ${fechaSuscripcion}`);
    console.log(`  URL:          ${subdominio}.barbermanager.app`);

    process.exit(0);
  } catch (err) {
    console.error('[crearTenant] Error:', err.message);
    process.exit(1);
  }
}

crearTenant();