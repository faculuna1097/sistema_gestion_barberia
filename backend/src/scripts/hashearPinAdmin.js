// ⚠️ TENANT-ESPECÍFICO: antes de reusar para otro tenant,
// cambiar TENANT_ID y PIN_PLANO con los valores correspondientes.
// NO correr de nuevo sobre el tenant existente — el PIN ya fue hasheado.

import bcrypt from 'bcrypt';
import { query } from '../config/db.js';

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000002';
const PIN_PLANO  = '1234';

async function hashearPin() {
  console.log('[hashearPinAdmin] Iniciando...');
  try {
    const hash = await bcrypt.hash(PIN_PLANO, 10);
    console.log('[hashearPinAdmin] Hash generado:', hash);

    await query(
      'UPDATE tenant SET pin_admin = $1 WHERE id = $2',
      [hash, TENANT_ID]
    );

    console.log('[hashearPinAdmin] PIN actualizado correctamente en la DB.');
    process.exit(0);
  } catch (err) {
    console.error('[hashearPinAdmin] Error:', err);
    process.exit(1);
  }
}

hashearPin();
