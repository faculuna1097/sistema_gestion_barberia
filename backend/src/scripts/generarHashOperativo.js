// ⚠️ TENANT-ESPECÍFICO: antes de reusar para otro tenant,
// cambiar TENANT_ID, USUARIO_PLANO y PASSWORD_PLANO con los valores correspondientes.
// El UPDATE pisa las credenciales operativas existentes — si ya están seteadas en
// la DB, correr de nuevo las reemplaza.

import bcrypt from 'bcrypt';
import { query } from '../config/db.js';

const TENANT_ID       = 'aaaaaaaa-0000-0000-0000-000000000002'; // demo
const USUARIO_PLANO   = 'operativo';
const PASSWORD_PLANO  = 'demo1234';

/**
 * Hashea la password operativa y guarda usuario + hash en la fila del tenant.
 * No recibe ni retorna nada; lee las constantes de arriba y termina el proceso
 * con código 0 si todo salió bien, 1 si hubo error.
 */
async function generarHashOperativo() {
  console.log('[generarHashOperativo] Iniciando...');
  try {
    const hash = await bcrypt.hash(PASSWORD_PLANO, 10);
    console.log('[generarHashOperativo] Hash generado:', hash);

    await query(
      'UPDATE tenant SET operativo_usuario = $1, operativo_password_hash = $2 WHERE id = $3',
      [USUARIO_PLANO, hash, TENANT_ID]
    );

    console.log('[generarHashOperativo] Credenciales operativas actualizadas correctamente en la DB.');
    console.log('[generarHashOperativo] Tenant:', TENANT_ID, '| Usuario:', USUARIO_PLANO);
    process.exit(0);
  } catch (err) {
    console.error('[generarHashOperativo] Error:', err);
    process.exit(1);
  }
}

generarHashOperativo();
