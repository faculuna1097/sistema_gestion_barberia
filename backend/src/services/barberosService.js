// /backend/src/services/barberosService.js
// Helpers de validación del recurso "barbero". Centraliza el chequeo de
// pertenencia (barbero ∈ tenant y activo) que usan los caminos de creación de
// turno (turnero público y backoffice) y de corte. Es la red de seguridad a
// nivel app por encima del FK compuesto (tenant_id, barbero_id): convierte un
// barbero_id ajeno (UUID público) en un 404 limpio en vez de una violación de
// FK cruda (500). Ver auditoría 2.1.

import { query } from '../config/db.js';

/**
 * barberoActivoEnTenant — verifica que un barbero exista, pertenezca al tenant
 * y esté activo. Pensado para validar el barbero_id que llega en el body de una
 * request (potencialmente client-controlled) antes de insertarlo.
 *
 * @param {string} barberoId - UUID del barbero (puede venir del cliente)
 * @param {string} tenantId  - UUID del tenant del request
 * @returns {Promise<boolean>} true si el barbero pertenece al tenant y está activo
 */
export const barberoActivoEnTenant = async (barberoId, tenantId) => {
  try {
    const result = await query(
      `SELECT 1 FROM barbero WHERE id = $1 AND tenant_id = $2 AND activo = true`,
      [barberoId, tenantId]
    );
    return result.rows.length > 0;
  } catch (err) {
    // UUID con formato inválido → no puede referenciar a ningún barbero real.
    // Lo tratamos como "no encontrado" (el caller responde 404) en vez de 500.
    if (err.code === '22P02') return false;
    throw err;
  }
};
