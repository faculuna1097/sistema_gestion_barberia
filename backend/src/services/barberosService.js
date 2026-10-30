// /backend/src/services/barberosService.js
// Helpers del recurso "barbero". Centraliza el chequeo de
// pertenencia (barbero ∈ tenant y activo) que usan los caminos de creación de
// turno (turnero público y backoffice) y de corte. Es la red de seguridad a
// nivel app por encima del FK compuesto (tenant_id, barbero_id): convierte un
// barbero_id ajeno (UUID público) en un 404 limpio en vez de una violación de
// FK cruda (500). Ver auditoría 2.1.
// También centraliza el listado de barberos activos del turnero.

import { query } from '../config/db.js';
import { esUUID } from '../utils/validarUuid.js';

/**
 * listarBarberosActivos — barberos activos del tenant, ordenados por nombre.
 * Es la fuente del listado público del turnero (GET /api/turnero/barberos) y
 * del conjunto de barberos que considera "Cualquier barbero" en la
 * disponibilidad: así los barberos que ve el cliente y los que se le pueden
 * asignar son siempre los mismos.
 *
 * @param {string} tenantId - UUID del tenant del request
 * @returns {Promise<Array<{ id: string, nombre: string }>>}
 */
export const listarBarberosActivos = async (tenantId) => {
  const result = await query(
    `SELECT id, nombre
     FROM barbero
     WHERE tenant_id = $1 AND activo = true
     ORDER BY nombre ASC`,
    [tenantId]
  );
  return result.rows;
};

/**
 * barberoActivoEnTenant — verifica que un barbero exista, pertenezca al tenant
 * y esté activo. Pensado para validar el barbero_id que llega en el body de una
 * request (potencialmente client-controlled) antes de insertarlo.
 *
 * @param {string} barberoId - UUID del barbero (puede venir del cliente)
 * @param {string} tenantId  - UUID del tenant del request
 * @returns {Promise<boolean>} true si el barbero pertenece al tenant y está activo;
 *   false también si el id está mal formado (el caller responde 404)
 */
export const barberoActivoEnTenant = async (barberoId, tenantId) => {
  if (!esUUID(barberoId)) return false;

  const result = await query(
    `SELECT 1 FROM barbero WHERE id = $1 AND tenant_id = $2 AND activo = true`,
    [barberoId, tenantId]
  );
  return result.rows.length > 0;
};
