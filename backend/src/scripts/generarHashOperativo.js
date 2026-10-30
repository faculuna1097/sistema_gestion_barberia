// /backend/src/scripts/generarHashOperativo.js
// Reemplaza las credenciales del modo operativo de un tenant que ya existe. El alta
// inicial la hace crearTenant.js; esto sirve para cambiarlas o para un tenant viejo.
// El UPDATE pisa las credenciales operativas existentes y sube
// operativo_token_version, como el panel: los tokens viejos del iPad dejan de servir.
//
// Este script corre en un proceso aparte y no puede invalidar el caché del
// tenantMiddleware. Hasta que se invalide (POST /api/plataforma/cache/invalidate, ver
// onboarding.md), el backend sigue con la versión vieja y rechaza los logins nuevos.
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
 * Valida los argumentos, hashea la password operativa, guarda usuario + hash en la
 * fila del tenant y sube operativo_token_version en el mismo UPDATE. No recibe ni
 * retorna nada; lee process.argv y termina el proceso con código 0 si todo salió
 * bien, 1 si hubo error.
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
      `UPDATE tenant
       SET operativo_usuario = $1,
           operativo_password_hash = $2,
           operativo_token_version = operativo_token_version + 1
       WHERE id = $3
       RETURNING subdominio`,
      [usuario, hash, tenantId]
    );

    if (resultado.rowCount === 0) {
      console.error(`[generarHashOperativo] Error: no existe el tenant ${tenantId}.`);
      process.exit(1);
    }

    console.log('[generarHashOperativo] Credenciales operativas actualizadas correctamente en la DB.');
    console.log('[generarHashOperativo] Tenant:', tenantId, '| Usuario:', usuario);
    console.log(`[generarHashOperativo] Falta invalidar el caché del backend (POST /api/plataforma/cache/invalidate con subdominio "${resultado.rows[0].subdominio}"). Hasta entonces, el backend rechaza los logins nuevos. Ver onboarding.md.`);
    process.exit(0);
  } catch (err) {
    console.error('[generarHashOperativo] Error:', err);
    process.exit(1);
  }
}

generarHashOperativo();
