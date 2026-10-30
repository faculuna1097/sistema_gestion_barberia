// /backend/src/services/sqlTurnoEnriquecido.js
// SELECT enriquecido de un turno, en un archivo propio y sin imports: lo usan
// turnosService.js y suspensionesService.js, y turnosService.js importa de
// suspensionesService.js. Si viviera en uno de los dos, habría una importación circular.

/**
 * Arma el SELECT enriquecido de un turno: las columnas con los alias que consume
 * construirContextoMail (mailer.js) y los JOINs a barbero, servicio, cliente y
 * tenant. Lo comparten los servicios de turnos, recordatorios, suspensiones, feriados
 * y horario de atención, y el turnero público; cada uno suma sus columnas y su condición.
 * @param {string} columnasExtra - Columnas propias de la consulta, separadas por coma.
 *   Son fragmentos fijos del código, nunca input del usuario.
 * @param {string} condiciones - WHERE (y ORDER BY, si hace falta). Los parámetros los
 *   pasa quien ejecuta la query.
 * @returns {string} La sentencia SQL completa
 */
export const sqlTurnoEnriquecido = (columnasExtra, condiciones) =>
  `SELECT t.inicio, t.fin, ${columnasExtra},
          b.nombre AS barbero_nombre, b.email AS barbero_email,
          s.nombre AS servicio_nombre,
          c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono,
          tn.nombre_negocio AS tenant_nombre, tn.direccion AS tenant_direccion
   FROM turno t
   JOIN barbero  b ON b.id = t.barbero_id
   JOIN servicio s ON s.id = t.servicio_id
   JOIN cliente  c ON c.id = t.cliente_id
   JOIN tenant   tn ON tn.id = t.tenant_id
   ${condiciones}`;
