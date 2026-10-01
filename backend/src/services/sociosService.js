// /backend/src/services/sociosService.js
// Helpers de validación del recurso "socio" (dueño del negocio). Espejo de
// barberosService: es la red de seguridad a nivel app por encima del FK
// compuesto (tenant_id, socio_id) de movimiento_extra, y convierte un socio_id
// ajeno o inactivo en un 404 limpio en vez de una violación de FK cruda (500).

import { query } from '../config/db.js';

/**
 * socioActivoEnTenant — verifica que un socio exista, pertenezca al tenant y
 * esté activo. Pensado para validar el socio_id que llega en el body de una
 * request (potencialmente client-controlled) antes de insertarlo.
 *
 * @param {string} socioId  - UUID del socio (puede venir del cliente)
 * @param {string} tenantId - UUID del tenant del request
 * @returns {Promise<boolean>} true si el socio pertenece al tenant y está activo
 */
export const socioActivoEnTenant = async (socioId, tenantId) => {
  try {
    const result = await query(
      `SELECT 1 FROM socio WHERE id = $1 AND tenant_id = $2 AND activo = true`,
      [socioId, tenantId]
    );
    return result.rows.length > 0;
  } catch (err) {
    // UUID con formato inválido → no puede referenciar a ningún socio real.
    // Lo tratamos como "no encontrado" (el caller responde 404) en vez de 500.
    if (err.code === '22P02') return false;
    throw err;
  }
};
