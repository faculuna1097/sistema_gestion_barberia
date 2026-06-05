// /backend/src/services/suspensionesService.js
// Lógica de negocio de suspensiones de barberos.
// Cobertura: plan_turnero_v2.md sección 5 (/api/admin/suspensiones).

import { query } from '../config/db.js';
import { cancelarEvento } from './googleCalendar.js';
import { enviarCancelacionAutomatica, construirContextoMail } from './mailer.js';

/**
 * Lista suspensiones futuras de un barbero (o de todos si barberoId es null).
 * @param {string} tenantId
 * @param {string|null} barberoId
 * @returns {Promise<Array>}
 */
export const listarSuspensiones = async (tenantId, barberoId) => {
  const params = [tenantId];
  let where = 'bs.tenant_id = $1 AND bs.hasta > now()';

  if (barberoId) {
    where += ' AND bs.barbero_id = $2';
    params.push(barberoId);
  }

  const result = await query(
    `SELECT bs.id, bs.barbero_id, bs.desde, bs.hasta, bs.motivo, bs.origen, bs.created_at,
            b.nombre AS barbero_nombre
     FROM barbero_suspension bs
     JOIN barbero b ON b.id = bs.barbero_id
     WHERE ${where}
     ORDER BY bs.desde ASC`,
    params
  );
  return result.rows;
};

/**
 * Busca turnos reservados que caen dentro del rango de la suspensión.
 * @param {string} tenantId
 * @param {string} barberoId
 * @param {string} desde - ISO timestamp
 * @param {string} hasta - ISO timestamp
 * @returns {Promise<Array>} turnos afectados con datos enriquecidos
 */
export const buscarTurnosAfectados = async (tenantId, barberoId, desde, hasta) => {
  const result = await query(
    `SELECT t.id, t.inicio, t.fin, t.google_event_id,
            b.nombre AS barbero_nombre, b.email AS barbero_email,
            s.nombre AS servicio_nombre,
            c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono
     FROM turno t
     JOIN barbero  b ON b.id = t.barbero_id
     JOIN servicio s ON s.id = t.servicio_id
     JOIN cliente  c ON c.id = t.cliente_id
     WHERE t.tenant_id = $1
       AND t.barbero_id = $2
       AND t.estado = 'reservado'
       AND t.inicio < $4
       AND t.fin > $3`,
    [tenantId, barberoId, desde, hasta]
  );
  return result.rows;
};

/**
 * Crea una suspensión. Si hay turnos afectados y no viene confirmar_cancelacion,
 * devuelve la lista de turnos afectados para que el frontend confirme.
 * Si viene confirmar_cancelacion, cancela los turnos afectados y crea la suspensión.
 * @param {Object} datos
 * @returns {Promise<{ suspension?: Object, turnos_afectados?: Array }>}
 */
export const crearSuspension = async ({
  tenantId, barberoId, desde, hasta, motivo, origen, confirmarCancelacion, linkTurnero,
}) => {
  // Buscar turnos que pisa la suspensión
  const turnosAfectados = await buscarTurnosAfectados(tenantId, barberoId, desde, hasta);

  if (turnosAfectados.length > 0 && !confirmarCancelacion) {
    return {
      turnos_afectados: turnosAfectados.map(t => ({
        id: t.id, inicio: t.inicio, fin: t.fin,
        cliente_nombre: t.cliente_nombre,
      })),
    };
  }

  // Cancelar turnos afectados
  for (const t of turnosAfectados) {
    await query(
      `UPDATE turno
         SET estado = 'cancelado', cancelado_en = now(), cancelado_por = 'suspension'
       WHERE id = $1`,
      [t.id]
    );
    console.log('[suspensionesService] turno cancelado por suspensión | turno_id:', t.id);

    // Best-effort: Calendar
    if (t.google_event_id) {
      await cancelarEvento(t.google_event_id);
    }

    // Best-effort: mail al cliente
    if (t.cliente_email) {
      const { turno, barbero, servicio, cliente } = construirContextoMail(t);
      await enviarCancelacionAutomatica(
        turno, barbero, servicio, cliente,
        {
          intro: `Hola ${cliente.nombre ?? ''}, el barbero suspendió su agenda y tuvimos que cancelar este turno. Podés reservar uno nuevo cuando quieras.`,
          motivo: motivo || 'Sin motivo especificado',
        },
        linkTurnero,
      );
    }
  }

  // INSERT suspensión
  const result = await query(
    `INSERT INTO barbero_suspension (tenant_id, barbero_id, desde, hasta, motivo, origen)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, barbero_id, desde, hasta, motivo, origen, created_at`,
    [tenantId, barberoId, desde, hasta, motivo || null, origen]
  );

  return {
    suspension: result.rows[0],
    turnos_cancelados: turnosAfectados.length,
  };
};

/**
 * Elimina una suspensión. No recupera turnos cancelados.
 * @param {string} suspensionId
 * @param {string} tenantId
 * @param {string|null} barberoId - si es barbero, solo puede eliminar las propias
 * @returns {Promise<boolean>} true si se eliminó
 * @throws {{ code: 'NO_ENCONTRADA' }}
 */
export const eliminarSuspension = async (suspensionId, tenantId, barberoId) => {
  const params = [suspensionId, tenantId];
  let where = 'id = $1 AND tenant_id = $2';
  if (barberoId) {
    where += ' AND barbero_id = $3';
    params.push(barberoId);
  }

  const result = await query(
    `DELETE FROM barbero_suspension WHERE ${where} RETURNING id`,
    params
  );

  if (result.rows.length === 0) {
    const err = new Error('Suspensión no encontrada');
    err.code = 'NO_ENCONTRADA';
    throw err;
  }

  return true;
};
