// /backend/src/services/feriadosService.js
// Lógica de negocio de los feriados puntuales del tenant.
// Cobertura: decisiones_horario_atencion.md.
//
// La tabla tenant_feriado tiene 1 fila por feriado. Un feriado cierra el
// día completo (sin horario especial en este MVP).

import { query } from '../config/db.js';
import { TZ } from '../utils/constantes.js';
import { cancelarEvento } from './googleCalendar.js';
import { enviarCancelacionAutomatica, construirContextoMail } from './mail/mailer.js';
import { sqlTurnoEnriquecido } from './sqlTurnoEnriquecido.js';

/**
 * Lista los feriados del tenant con fecha >= desde, ordenados ascendentemente.
 * @param {string} tenantId - UUID del tenant
 * @param {string} desde - fecha mínima en 'YYYY-MM-DD' (inclusive)
 * @returns {Promise<Array>} filas [{ id, fecha: 'YYYY-MM-DD', descripcion }]
 */
export const obtenerFeriados = async (tenantId, desde) => {
  const result = await query(
    `SELECT id, fecha, descripcion
     FROM tenant_feriado
     WHERE tenant_id = $1 AND fecha >= $2::date
     ORDER BY fecha ASC`,
    [tenantId, desde]
  );
  // La columna DATE llega como objeto Date de JS; la normalizamos a 'YYYY-MM-DD'.
  return result.rows.map((fila) => ({
    id: fila.id,
    fecha: new Date(fila.fecha).toISOString().slice(0, 10),
    descripcion: fila.descripcion,
  }));
};

/**
 * Indica si el tenant ya tiene un feriado cargado en esa fecha.
 * @param {string} tenantId - UUID del tenant
 * @param {string} fecha - fecha en 'YYYY-MM-DD'
 * @returns {Promise<boolean>}
 */
export const existeFeriado = async (tenantId, fecha) => {
  const result = await query(
    `SELECT 1 FROM tenant_feriado WHERE tenant_id = $1 AND fecha = $2::date`,
    [tenantId, fecha]
  );
  return result.rows.length > 0;
};

/**
 * Calcula el impacto de declarar feriado una fecha: qué turnos reservados
 * futuros hay que cancelar. Lectura pura: no escribe en la DB. Trae los
 * datos de barbero/servicio/cliente que necesita el mail de cancelación.
 *
 * @param {string} tenantId - UUID del tenant
 * @param {string} fecha - fecha del feriado en 'YYYY-MM-DD'
 * @returns {Promise<{ turnosACancelar: Array }>}
 */
export const calcularDeltaFeriado = async (tenantId, fecha) => {
  const turnosRes = await query(
    sqlTurnoEnriquecido(
      't.id, t.google_event_id',
      `WHERE t.tenant_id = $1
         AND t.estado = 'reservado'
         AND t.inicio > now()
         AND DATE(t.inicio AT TIME ZONE $2) = $3::date`
    ),
    [tenantId, TZ, fecha]
  );
  return { turnosACancelar: turnosRes.rows };
};

/**
 * Ejecuta la cascada de un feriado: cancela los turnos afectados con
 * best-effort de Calendar y mail al cliente. No usa transacción (Session
 * Pooler no soporta BEGIN/COMMIT); ante un fallo intermedio el feriado
 * todavía no se insertó, así que el estado queda recuperable.
 *
 * Un turno que dejó de estar reservado después de calcular el delta (se completó,
 * lo canceló el cliente) no se pisa, no se cuenta y no dispara Calendar ni mail.
 *
 * @param {string} tenantId - UUID del tenant
 * @param {Array} turnos - turnos a cancelar (de calcularDeltaFeriado)
 * @param {string} linkTurnero - URL de reserva para el mail al cliente
 * @param {string} [descripcion] - descripción del feriado, para el mail
 * @returns {Promise<{ turnos_cancelados: number }>} los que se cancelaron de verdad
 */
export const ejecutarCascadaFeriado = async (tenantId, turnos, linkTurnero, descripcion) => {
  let turnosCancelados = 0;
  for (const t of turnos) {
    const updateRes = await query(
      `UPDATE turno
         SET estado = 'cancelado', cancelado_en = now(), cancelado_por = 'admin'
       WHERE id = $1 AND tenant_id = $2 AND estado = 'reservado'`,
      [t.id, tenantId]
    );
    if (updateRes.rowCount === 0) {
      console.warn('[feriadosService] ejecutarCascadaFeriado — el turno dejó de estar reservado antes del UPDATE | turno_id:', t.id);
      continue;
    }
    turnosCancelados++;
    console.log('[feriadosService] turno cancelado por feriado | turno_id:', t.id);

    // Best-effort: Calendar.
    if (t.google_event_id) {
      await cancelarEvento(t.google_event_id);
    }

    // Best-effort: mail al cliente.
    if (t.cliente_email) {
      const { turno, barbero, servicio, cliente, tenant } = construirContextoMail(t);
      const detalle = descripcion ? ` (${descripcion})` : '';
      await enviarCancelacionAutomatica(
        turno, barbero, servicio, cliente,
        {
          intro: `Hola ${cliente.nombre ?? ''}, declaramos feriado el día de tu turno${detalle} y el local va a estar cerrado. Lamentamos el inconveniente; podés reservar otro cuando quieras.`,
          motivo: 'Feriado',
        },
        linkTurnero,
        tenant,
      );
    }
  }

  return { turnos_cancelados: turnosCancelados };
};

/**
 * Inserta un feriado en la DB y devuelve la fila creada.
 * @param {string} tenantId - UUID del tenant
 * @param {string} fecha - fecha en 'YYYY-MM-DD'
 * @param {string|null} descripcion - descripción opcional
 * @returns {Promise<{ id, fecha: 'YYYY-MM-DD', descripcion }>}
 */
export const insertarFeriado = async (tenantId, fecha, descripcion) => {
  const result = await query(
    `INSERT INTO tenant_feriado (tenant_id, fecha, descripcion)
     VALUES ($1, $2::date, $3)
     RETURNING id, fecha, descripcion`,
    [tenantId, fecha, descripcion]
  );
  const fila = result.rows[0];
  return {
    id: fila.id,
    fecha: new Date(fila.fecha).toISOString().slice(0, 10),
    descripcion: fila.descripcion,
  };
};

/**
 * Elimina un feriado del tenant. No "descancela" los turnos que la cascada
 * haya cancelado al crearlo (ya tienen mail enviado).
 * @param {string} tenantId - UUID del tenant
 * @param {string} id - UUID del feriado
 * @returns {Promise<boolean>} true si se eliminó una fila, false si no existía
 */
export const eliminarFeriado = async (tenantId, id) => {
  const result = await query(
    `DELETE FROM tenant_feriado WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, id]
  );
  return result.rows.length > 0;
};
