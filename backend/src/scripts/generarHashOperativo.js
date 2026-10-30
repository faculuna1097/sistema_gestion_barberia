// /backend/src/scripts/generarHashOperativo.js
// Reemplaza las credenciales del modo operativo de un tenant que ya existe. El alta
// inicial la hace crearTenant.js; esto sirve para cambiarlas o para un tenant viejo.
// El UPDATE pisa las credenciales operativas existentes.
//
// Uso:
//   cd backend
//   node src/scripts/generarHashOperativo.js <tenant_id> <usuario> <password>
//
// Argumentos:
//   1. UUID del tenant (string)
//   2. usuario operativo, al menos 3 caracteres (string)
//   3. password operativa, al menos 8 caracteres (string)

import { query } from '../config/db.js';
import { errorCredencialesOperativas, hashearPasswordOperativa } from '../utils/credencialesOperativas.js';
import { esUUID } from '../utils/validarUuid.js';

/**
 * Valida los argumentos, hashea la password operativa y guarda usuario + hash en
 * la fila del tenant. No recibe ni retorna nada; lee process.argv y termina el
 * proceso con código 0 si todo salió bien, 1 si hubo error.
 */
async function generarHashOperativo() {
  console.log('[generarHashOperativo] Iniciando...');

  const [, , tenantId, usuario, password] = process.argv;

  if (!tenantId || !usuario || !password) {
    console.error('[generarHashOperativo] Error: faltan argumentos.');
    console.error('Uso: node src/scripts/generarHashOperativo.js <tenant_id> <usuario> <password>');
    process.exit(1);
  }

  if (!esUUID(tenantId)) {
    console.error('[generarHashOperativo] Error: tenant_id debe ser un UUID válido.');
    process.exit(1);
  }

  const errorCredenciales = errorCredencialesOperativas(usuario, password);
  if (errorCredenciales) {
    console.error(`[generarHashOperativo] Error: ${errorCredenciales}`);
    process.exit(1);
  }

  try {
    const hash = await hashearPasswordOperativa(password);

    const resultado = await query(
      'UPDATE tenant SET operativo_usuario = $1, operativo_password_hash = $2 WHERE id = $3',
      [usuario, hash, tenantId]
    );

    if (resultado.rowCount === 0) {
      console.error(`[generarHashOperativo] Error: no existe el tenant ${tenantId}.`);
      process.exit(1);
    }

    console.log('[generarHashOperativo] Credenciales operativas actualizadas correctamente en la DB.');
    console.log('[generarHashOperativo] Tenant:', tenantId, '| Usuario:', usuario);
    process.exit(0);
  } catch (err) {
    console.error('[generarHashOperativo] Error:', err);
    process.exit(1);
  }
}

generarHashOperativo();
