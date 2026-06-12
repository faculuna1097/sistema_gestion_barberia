// /backend/src/utils/pin.js
// Helper de unicidad de PIN dentro de un tenant.
// Los PINs (tenant.pin_admin y barbero.pin) se guardan hasheados con bcrypt,
// que es no determinista (salt por hash): NO se puede buscar por WHERE pin = $1.
// Para saber si un PIN ya existe hay que traer los hashes del tenant y
// compararlos uno por uno con bcrypt.compare.

import bcrypt from 'bcrypt';
import { query } from '../config/db.js';

/**
 * pinColisiona
 * Determina si un PIN en texto plano ya está en uso dentro de un tenant,
 * comparándolo contra el PIN del admin y el de cada barbero (activos e
 * inactivos, para que una futura reactivación no genere colisión).
 *
 * @param {string} pinPlano                    - PIN en texto plano (4 dígitos)
 * @param {Object} opciones
 * @param {string} opciones.tenantId           - UUID del tenant
 * @param {string} [opciones.excluirBarberoId] - UUID de un barbero a excluir de la
 *                                               comparación (al editar, un barbero no
 *                                               debe colisionar consigo mismo)
 * @returns {Promise<boolean>} true si el PIN ya está en uso por el admin o por
 *                             otro barbero del tenant
 */
export async function pinColisiona(pinPlano, { tenantId, excluirBarberoId = null }) {
  // 1) Contra el PIN del admin del tenant.
  const tenantRes = await query(
    `SELECT pin_admin FROM tenant WHERE id = $1`,
    [tenantId]
  );
  const pinAdmin = tenantRes.rows[0]?.pin_admin;
  if (pinAdmin && await bcrypt.compare(pinPlano, pinAdmin)) {
    return true;
  }

  // 2) Contra cada barbero del tenant. Se comparan activos e inactivos: si un
  //    barbero inactivo se reactiva más adelante, su PIN no debe chocar con uno
  //    asignado mientras tanto. El guard `$2::uuid IS NULL OR id <> $2` excluye
  //    al propio barbero cuando se está editando, y no excluye a nadie al crear.
  const barberosRes = await query(
    `SELECT pin FROM barbero
      WHERE tenant_id = $1 AND ($2::uuid IS NULL OR id <> $2)`,
    [tenantId, excluirBarberoId]
  );
  for (const fila of barberosRes.rows) {
    if (fila.pin && await bcrypt.compare(pinPlano, fila.pin)) {
      return true;
    }
  }

  return false;
}
