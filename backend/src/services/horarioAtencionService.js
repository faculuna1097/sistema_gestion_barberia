// /backend/src/services/horarioAtencionService.js
// Lógica de negocio del horario semanal de atención del tenant.
// Cobertura: plan_horario_atencion.md sección 3.3 y 3.7.
//
// La tabla tenant_horario_atencion tiene 1 fila por día abierto.
// Ausencia de fila = el negocio cierra ese día.

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { TZ } from '../utils/constantes.js';
import { cancelarEvento } from './googleCalendar.js';
import { enviarCancelacionAutomatica, construirContextoMail } from './mailer.js';

/**
 * Obtiene las filas crudas de horario del tenant tal como están en la DB.
 * Sólo devuelve los días abiertos (los que tienen fila).
 * @param {string} tenantId - UUID del tenant
 * @returns {Promise<Array>} filas [{ dia_semana, hora_inicio, hora_fin }, ...] ordenadas por día
 */
export const obtenerHorarioCrudo = async (tenantId) => {
  const result = await query(
    `SELECT dia_semana, hora_inicio, hora_fin
     FROM tenant_horario_atencion
     WHERE tenant_id = $1
     ORDER BY dia_semana ASC`,
    [tenantId]
  );
  // hora_inicio/hora_fin llegan como 'HH:MM:SS' desde un campo time;
  // las recortamos a 'HH:MM' que es lo que consume el frontend.
  return result.rows.map((fila) => ({
    dia_semana: fila.dia_semana,
    hora_inicio: fila.hora_inicio.slice(0, 5),
    hora_fin: fila.hora_fin.slice(0, 5),
  }));
};

/**
 * Obtiene el horario de atención del tenant como un array de 7 días.
 * Siempre devuelve los 7 días: los cerrados salen como { dia_semana, abierto: false }.
 * @param {string} tenantId - UUID del tenant
 * @returns {Promise<Array>} array de 7 objetos día (dia_semana 0..6)
 */
export const obtenerHorarioCompleto = async (tenantId) => {
  const abiertos = await obtenerHorarioCrudo(tenantId);
  // Indexamos las filas abiertas por dia_semana para armar los 7 días.
  const porDia = {};
  for (const fila of abiertos) {
    porDia[fila.dia_semana] = fila;
  }

  const semana = [];
  for (let dia = 0; dia <= 6; dia++) {
    if (porDia[dia]) {
      semana.push({
        dia_semana: dia,
        abierto: true,
        hora_inicio: porDia[dia].hora_inicio,
        hora_fin: porDia[dia].hora_fin,
      });
    } else {
      semana.push({ dia_semana: dia, abierto: false });
    }
  }
  return semana;
};

/**
 * Valida que un rango horario [horaInicio, horaFin] de un día caiga dentro
 * del horario de atención del tenant. Función pura: recibe el horario ya
 * consultado (obtenerHorarioCrudo) para poder validar varios rangos sin
 * repetir la query. Las horas se comparan como strings 'HH:MM' (zero-padded).
 *
 * @param {Array} horarioCrudo - filas de obtenerHorarioCrudo [{ dia_semana, hora_inicio, hora_fin }]
 * @param {number} diaSemana - día a validar, 0..6 (0=domingo)
 * @param {string} horaInicio - inicio del rango en 'HH:MM'
 * @param {string} horaFin - fin del rango en 'HH:MM'
 * @returns {{ valido: boolean, codigo?: string, mensaje?: string, limite?: { hora_inicio, hora_fin } }}
 */
export const validarRangoEnHorario = (horarioCrudo, diaSemana, horaInicio, horaFin) => {
  const dia = horarioCrudo.find((h) => h.dia_semana === diaSemana);
  if (!dia) {
    return { valido: false, codigo: 'dia_cerrado', mensaje: 'El negocio no abre ese día' };
  }
  if (horaInicio < dia.hora_inicio || horaFin > dia.hora_fin) {
    return {
      valido: false,
      codigo: 'fuera_de_rango',
      mensaje: 'El rango cae fuera del horario de atención del negocio',
      limite: { hora_inicio: dia.hora_inicio, hora_fin: dia.hora_fin },
    };
  }
  return { valido: true };
};

/**
 * Valida que un turno [inicioDT, finDT] caiga dentro del horario de atención
 * del tenant. Consulta el horario y delega en validarRangoEnHorario. El día
 * se calcula desde inicioDT en convención 0..6 (luxon usa 1..7).
 *
 * @param {string} tenantId - UUID del tenant
 * @param {DateTime} inicioDT - inicio del turno (luxon DateTime en TZ Argentina)
 * @param {DateTime} finDT - fin del turno (luxon DateTime en TZ Argentina)
 * @returns {Promise<{ valido: boolean, codigo?, mensaje?, limite? }>}
 */
export const validarTurnoEnHorario = async (tenantId, inicioDT, finDT) => {
  const horario = await obtenerHorarioCrudo(tenantId);
  const diaSemana = inicioDT.weekday % 7;
  return validarRangoEnHorario(
    horario,
    diaSemana,
    inicioDT.toFormat('HH:mm'),
    finDT.toFormat('HH:mm'),
  );
};

/**
 * Calcula el impacto ("delta") de aplicar un nuevo horario semanal:
 * qué bloques de barbero quedan afuera y qué turnos reservados hay que
 * cancelar. Es una lectura pura: no escribe nada en la DB.
 *
 * Un bloque de barbero contra el nuevo horario de su día puede quedar:
 *   - intacto      → el bloque entra completo en el nuevo rango.
 *   - a truncar    → solapa parcialmente; se recorta a la intersección.
 *   - a eliminar   → el día cierra, o el bloque no solapa con el nuevo rango.
 * Un turno reservado futuro se cancela si su día pasa a cerrado, o si
 * [inicio, fin] no entra completo en el nuevo horario de ese día.
 *
 * @param {string} tenantId - UUID del tenant
 * @param {Array} horariosNuevos - días abiertos del nuevo horario
 *   [{ dia_semana, hora_inicio, hora_fin }, ...] (horas en 'HH:MM')
 * @returns {Promise<{ bloquesAEliminar: string[], bloquesATruncar: Array, turnosACancelar: Array }>}
 */
export const calcularDelta = async (tenantId, horariosNuevos) => {
  // Indexamos el nuevo horario por día para consultarlo en O(1).
  const nuevoPorDia = {};
  for (const h of horariosNuevos) {
    nuevoPorDia[h.dia_semana] = h;
  }

  // --- Bloques de barbero ---
  const bloquesRes = await query(
    `SELECT id, dia_semana, hora_inicio, hora_fin
     FROM barbero_horario
     WHERE tenant_id = $1`,
    [tenantId]
  );

  const bloquesAEliminar = [];
  const bloquesATruncar = []; // { id, hora_inicio, hora_fin }
  for (const b of bloquesRes.rows) {
    const ini = b.hora_inicio.slice(0, 5);
    const fin = b.hora_fin.slice(0, 5);
    const nuevo = nuevoPorDia[b.dia_semana];

    if (!nuevo) {
      // El día pasa a cerrado → el bloque se elimina.
      bloquesAEliminar.push(b.id);
      continue;
    }

    // Intersección entre el bloque y el nuevo rango del tenant.
    const iniTrunc = ini > nuevo.hora_inicio ? ini : nuevo.hora_inicio;
    const finTrunc = fin < nuevo.hora_fin ? fin : nuevo.hora_fin;

    if (iniTrunc >= finTrunc) {
      // No hay solape: el bloque queda enteramente afuera.
      bloquesAEliminar.push(b.id);
    } else if (iniTrunc !== ini || finTrunc !== fin) {
      // Solapa parcialmente: se recorta a la intersección.
      bloquesATruncar.push({ id: b.id, hora_inicio: iniTrunc, hora_fin: finTrunc });
    }
    // else: el bloque ya entra completo, queda intacto.
  }

  // --- Turnos reservados futuros ---
  const turnosRes = await query(
    `SELECT t.id, t.inicio, t.fin, t.google_event_id,
            b.nombre AS barbero_nombre, b.email AS barbero_email,
            s.nombre AS servicio_nombre,
            c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono,
            tn.nombre_negocio AS tenant_nombre
     FROM turno t
     JOIN barbero  b ON b.id = t.barbero_id
     JOIN servicio s ON s.id = t.servicio_id
     JOIN cliente  c ON c.id = t.cliente_id
     JOIN tenant   tn ON tn.id = t.tenant_id
     WHERE t.tenant_id = $1
       AND t.estado = 'reservado'
       AND t.inicio > now()`,
    [tenantId]
  );

  const turnosACancelar = [];
  for (const t of turnosRes.rows) {
    const dtInicio = DateTime.fromJSDate(t.inicio, { zone: TZ });
    const dtFin = DateTime.fromJSDate(t.fin, { zone: TZ });
    // luxon usa weekday 1..7 (lun..dom); el sistema usa 0..6 (dom..sáb).
    const diaSemana = dtInicio.weekday % 7;
    const nuevo = nuevoPorDia[diaSemana];

    if (!nuevo) {
      // El día del turno pasa a cerrado.
      turnosACancelar.push(t);
      continue;
    }

    const inicioHHMM = dtInicio.toFormat('HH:mm');
    const finHHMM = dtFin.toFormat('HH:mm');
    if (inicioHHMM < nuevo.hora_inicio || finHHMM > nuevo.hora_fin) {
      // El turno cae fuera del nuevo horario de ese día.
      turnosACancelar.push(t);
    }
  }

  return { bloquesAEliminar, bloquesATruncar, turnosACancelar };
};

/**
 * Ejecuta la cascada de un cambio de horario: cancela los turnos afectados
 * (con best-effort de Calendar y mail al cliente) y trunca/elimina los
 * bloques de barbero afectados.
 *
 * No usa transacción (Session Pooler no soporta BEGIN/COMMIT). Se ejecuta
 * en orden de menor daño: primero los turnos, después los bloques. El
 * reemplazo de tenant_horario_atencion se hace aparte (reemplazarHorario),
 * al final, para que ante un fallo intermedio siga vigente el horario viejo.
 *
 * @param {Object} delta - resultado de calcularDelta
 * @param {string} linkTurnero - URL de reserva para el mail al cliente
 * @returns {Promise<{ bloques_truncados: number, bloques_eliminados: number, turnos_cancelados: number }>}
 */
export const ejecutarCascada = async (delta, linkTurnero) => {
  // --- 1. Cancelar turnos afectados ---
  for (const t of delta.turnosACancelar) {
    await query(
      `UPDATE turno
         SET estado = 'cancelado', cancelado_en = now(), cancelado_por = 'admin'
       WHERE id = $1`,
      [t.id]
    );
    console.log('[horarioAtencionService] turno cancelado por cambio de horario | turno_id:', t.id);

    // Best-effort: Calendar.
    if (t.google_event_id) {
      await cancelarEvento(t.google_event_id);
    }

    // Best-effort: mail al cliente. El mensaje habla de un cierre/cambio de
    // horario, no de "cancelado por el barbero".
    if (t.cliente_email) {
      const { turno, barbero, servicio, cliente, tenant } = construirContextoMail(t);
      await enviarCancelacionAutomatica(
        turno, barbero, servicio, cliente,
        {
          intro: `Hola ${cliente.nombre ?? ''}, cambiamos el horario de atención del local y tu turno quedó fuera del nuevo horario. Lamentamos el inconveniente; podés reservar otro cuando quieras.`,
          motivo: 'Cierre',
        },
        linkTurnero,
        tenant,
      );
    }
  }

  // --- 2. Bloques de barbero ---
  for (const id of delta.bloquesAEliminar) {
    await query(`DELETE FROM barbero_horario WHERE id = $1`, [id]);
    console.log('[horarioAtencionService] bloque de barbero eliminado | bloque_id:', id);
  }
  for (const b of delta.bloquesATruncar) {
    await query(
      `UPDATE barbero_horario SET hora_inicio = $1, hora_fin = $2 WHERE id = $3`,
      [b.hora_inicio, b.hora_fin, b.id]
    );
    console.log('[horarioAtencionService] bloque de barbero truncado | bloque_id:', b.id);
  }

  return {
    bloques_truncados: delta.bloquesATruncar.length,
    bloques_eliminados: delta.bloquesAEliminar.length,
    turnos_cancelados: delta.turnosACancelar.length,
  };
};

/**
 * Reemplaza por completo el horario semanal del tenant: borra las filas
 * actuales e inserta las del payload. Se llama al final del PUT, después de
 * la cascada. Inserts secuenciales (Session Pooler no soporta transacciones).
 *
 * @param {string} tenantId - UUID del tenant
 * @param {Array} horarios - días abiertos [{ dia_semana, hora_inicio, hora_fin }]
 * @returns {Promise<void>}
 */
export const reemplazarHorario = async (tenantId, horarios) => {
  await query(`DELETE FROM tenant_horario_atencion WHERE tenant_id = $1`, [tenantId]);
  for (const h of horarios) {
    await query(
      `INSERT INTO tenant_horario_atencion (tenant_id, dia_semana, hora_inicio, hora_fin)
       VALUES ($1, $2, $3, $4)`,
      [tenantId, h.dia_semana, h.hora_inicio, h.hora_fin]
    );
  }
};
