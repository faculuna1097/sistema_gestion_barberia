// /backend/src/services/categoriasService.js
// Helpers del recurso "categoría de gasto". Espejo de barberosService: el FK
// compuesto gasto(tenant_id, categoria_id) ya impide guardar una categoría de
// otro tenant; esta validación previa la convierte en un 404 limpio en vez de
// un 500 por la violación del FK.

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
