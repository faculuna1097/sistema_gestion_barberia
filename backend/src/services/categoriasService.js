// /backend/src/services/categoriasService.js
// Helpers del recurso "categoría de gasto". Espejo de barberosService: es la red
// de seguridad a nivel app por encima del FK simple de gasto.categoria_id, y
// convierte una categoría ajena en un 404 limpio.

import { query } from '../config/db.js';
import { esUUID } from '../utils/validarUuid.js';

/**
 * categoriaEnTenant — verifica que una categoría de gasto exista y pertenezca al
 * tenant. A diferencia de barberoActivoEnTenant, no exige que esté activa: un
 * gasto viejo se tiene que poder editar aunque su categoría se haya desactivado.
 *
 * @param {string} categoriaId - UUID de la categoría (puede venir del cliente)
 * @param {string} tenantId    - UUID del tenant del request
 * @returns {Promise<boolean>} true si la categoría pertenece al tenant. Un id mal
 *   formado no puede ser ninguna categoría: false.
 */
export const categoriaEnTenant = async (categoriaId, tenantId) => {
  if (!esUUID(categoriaId)) return false;
  const result = await query(
    `SELECT 1 FROM categoria_gasto WHERE id = $1 AND tenant_id = $2`,
    [categoriaId, tenantId]
  );
  return result.rows.length > 0;
};
