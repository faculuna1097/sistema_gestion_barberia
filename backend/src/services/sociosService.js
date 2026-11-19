// /backend/src/services/sociosService.js
// Helpers de validación del recurso "socio" (dueño del negocio). Espejo de
// barberosService: es la red de seguridad a nivel app por encima del FK
// compuesto (tenant_id, socio_id) de movimiento_extra, y convierte un socio_id
// ajeno o inactivo en un 404 limpio en vez de una violación de FK cruda (500).
// También la regla de "es socio" de un barbero (esSocioSql).

import { query } from '../config/db.js';
import { esUUID } from '../utils/validarUuid.js';

/**
 * socioActivoEnTenant — verifica que un socio exista, pertenezca al tenant y
 * esté activo. Pensado para validar el socio_id que llega en el body de una
 * request (potencialmente client-controlled) antes de insertarlo.
 *
 * @param {string} socioId  - UUID del socio (puede venir del cliente)
 * @param {string} tenantId - UUID del tenant del request
 * @returns {Promise<boolean>} true si el socio pertenece al tenant y está activo;
 *   false también si el id está mal formado (el caller responde 404)
 */
export const socioActivoEnTenant = async (socioId, tenantId) => {
  if (!esUUID(socioId)) return false;

  const result = await query(
    `SELECT 1 FROM socio WHERE id = $1 AND tenant_id = $2 AND activo = true`,
    [socioId, tenantId]
  );
  return result.rows.length > 0;
};

/**
 * esSocioSql — expresión SQL que dice si un barbero es socio: está vinculado a un
 * socio activo de su mismo tenant. Es la regla de `es_socio` en la lista de
 * barberos de Gestión y en los cortes de Caja (el filtro "Solo Barberos"), así
 * que vive en un solo lugar. Mira el vínculo de ahora, no el de la fecha de cada
 * corte: si alguien deja de ser socio, sus cortes viejos dejan de contar como de
 * socio (aceptado, F4 de plan_mejoras_operativas.md).
 *
 * @param {string} barbero - Alias de la tabla barbero en la query (ej. 'b').
 * @returns {string} Fragmento SQL de tipo boolean (nunca NULL).
 */
export const esSocioSql = (barbero) =>
  `EXISTS (SELECT 1 FROM socio so
           WHERE so.tenant_id = ${barbero}.tenant_id
             AND so.barbero_id = ${barbero}.id
             AND so.activo = true)`;
