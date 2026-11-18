// /backend/src/services/turnosSinCobrarService.js
// Turnos sin cobrar (F3, docs/plan_mejoras_operativas.md §4): un turno que quedó
// 'reservado' después de terminar es un cobro que no se cargó o un cliente que no
// vino y nadie marcó.
//
// Dos piezas:
// - listarTurnosSinCobrar: lo que muestra el aviso del iPad y del Inicio del panel
//   (GET /api/turnos/sin-cobrar).
// - cerrarTurnosDelTenant / procesarCierreDiario: el cierre nocturno
//   (jobs/cierreDiario.js), que pasa a 'no_asistio' los reservados de días
//   anteriores con no_asistio_por = 'sistema'.
//
// Las dos comparan contra now() de Postgres, como cambiarEstado. Las queries de
// turnos filtran también por inicio (redundante: si el fin ya pasó, el inicio
// también) para recorrer solo un rango del índice parcial
// idx_turno_tenant_inicio (tenant_id, inicio) WHERE estado = 'reservado'.
// Ninguna toca Google Calendar ni manda mails: marcar "no asistió" a mano
// (cambiarEstado) tampoco lo hace.

import { query } from '../config/db.js';
import { conEtiquetas } from '../config/sentry.js';
import { TZ, MARGEN_AVISO_SIN_COBRAR_MINUTOS } from '../utils/constantes.js';
import { obtenerTenantsActivos } from './recordatoriosService.js';

/**
 * obtenerAvisoDelTenant
 * Lee lo que el aviso necesita del tenant: la insistencia (duracion_slot_minutos)
 * y el instante en que cierra el local un día dado (hora_fin de
 * tenant_horario_atencion para ese día de la semana, en hora argentina). El cierre
 * es null si el local no abre ese día o si es feriado del tenant (tenant_feriado).
 *
 * @param {string} tenantId - UUID del tenant
 * @param {string|null} [fecha=null] - 'YYYY-MM-DD'. Null = hoy en hora argentina,
 *   calculado por Postgres (es lo que usa el endpoint; la fecha explícita es para
 *   probar otros días).
 * @returns {Promise<{ duracion_slot_minutos: number, cierre: Date|null }|null>}
 *   null si el tenant no existe.
 */
export const obtenerAvisoDelTenant = async (tenantId, fecha = null) => {
  const result = await query(
    `WITH dia AS (SELECT COALESCE($2::date, (now() AT TIME ZONE $3)::date) AS fecha)
     SELECT tn.duracion_slot_minutos,
            (SELECT (dia.fecha + h.hora_fin) AT TIME ZONE $3
               FROM tenant_horario_atencion h
              WHERE h.tenant_id = tn.id
                AND h.dia_semana = EXTRACT(DOW FROM dia.fecha)
                AND NOT EXISTS (SELECT 1 FROM tenant_feriado f
                                 WHERE f.tenant_id = tn.id AND f.fecha = dia.fecha)
            ) AS cierre
       FROM tenant tn, dia
      WHERE tn.id = $1`,
    [tenantId, fecha, TZ]
  );
  return result.rows[0] ?? null;
};

/**
 * listarTurnosSinCobrar
 * Arma el aviso de turnos sin cobrar de un tenant: los turnos 'reservado' de
 * cualquier día cuyo fin pasó hace al menos duracion_slot_minutos +
 * MARGEN_AVISO_SIN_COBRAR_MINUTOS, ordenados por inicio. Es el aviso del local:
 * no depende del rol ni del barbero, y del cliente solo va el nombre (sin
 * contacto). Dos queries: el tenant (con el cierre de hoy) y los turnos.
 *
 * @param {string} tenantId - UUID del tenant
 * @returns {Promise<{
 *   turnos: Array<{ id, barbero_id, barbero_nombre, inicio: Date, fin: Date, cliente_nombre: string|null }>,
 *   insistencia_minutos: number,
 *   cierre_hoy: string|null
 * }|null>} null si el tenant no existe. cliente_nombre es null en un turno
 *   "Sin datos" (F1). cierre_hoy es el instante ISO (UTC) del cierre del local hoy,
 *   o null si hoy no abre o es feriado.
 */
export const listarTurnosSinCobrar = async (tenantId) => {
  const aviso = await obtenerAvisoDelTenant(tenantId);
  if (!aviso) return null;

  const minutos = aviso.duracion_slot_minutos + MARGEN_AVISO_SIN_COBRAR_MINUTOS;
  const result = await query(
    `SELECT t.id, t.barbero_id, b.nombre AS barbero_nombre, t.inicio, t.fin,
            c.nombre AS cliente_nombre
       FROM turno t
       JOIN barbero b ON b.tenant_id = t.tenant_id AND b.id = t.barbero_id
       LEFT JOIN cliente c ON c.id = t.cliente_id
      WHERE t.tenant_id = $1
        AND t.estado = 'reservado'
        AND t.inicio <= now() - make_interval(mins => $2)
        AND t.fin    <= now() - make_interval(mins => $2)
      ORDER BY t.inicio ASC`,
    [tenantId, minutos]
  );

  return {
    turnos: result.rows,
    insistencia_minutos: aviso.duracion_slot_minutos,
    cierre_hoy: aviso.cierre ? aviso.cierre.toISOString() : null,
  };
};

/**
 * cerrarTurnosDelTenant
 * Cierre nocturno de un tenant: pasa a 'no_asistio' (no_asistio_por = 'sistema')
 * los turnos 'reservado' cuyo fin es anterior a las 00:00 de hoy en hora
 * argentina. Una sola sentencia con estado = 'reservado' en el WHERE: no pisa un
 * turno que justo se cobró o se marcó. Idempotente: una segunda corrida no
 * encuentra nada. Es una escritura de valor fijo, así que el reintento de query()
 * es seguro.
 *
 * @param {string} tenantId - UUID del tenant
 * @param {Object} [opciones]
 * @param {string[]} [opciones.excluirIds=[]] - ids de turnos que no se tocan. Solo
 *   para pruebas contra demo (dejar afuera turnos de prueba que hay que conservar);
 *   el job no lo usa.
 * @returns {Promise<string[]>} los ids de los turnos que cerró.
 */
export const cerrarTurnosDelTenant = async (tenantId, { excluirIds = [] } = {}) => {
  const result = await query(
    `WITH corte AS (
       SELECT date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2 AS instante
     )
     UPDATE turno t
        SET estado = 'no_asistio', no_asistio_por = 'sistema'
       FROM corte
      WHERE t.tenant_id = $1
        AND t.estado = 'reservado'
        AND t.inicio < corte.instante
        AND t.fin < corte.instante
        AND NOT (t.id = ANY($3::uuid[]))
      RETURNING t.id`,
    [tenantId, TZ, excluirIds]
  );
  return result.rows.map((fila) => fila.id);
};

/**
 * procesarCierreDiario
 * Recorre los tenants activos y cierra en cada uno los turnos reservados de días
 * anteriores (cerrarTurnosDelTenant). Cada vuelta corre con el tenant como tag de
 * Sentry (conEtiquetas) y en su propio try/catch: un tenant que falla va a Sentry
 * con su tenant y no corta a los demás. Loguea cuántos cerró en cada tenant, sin
 * datos de clientes. Un fallo al leer los tenants se propaga (fallo del job entero).
 *
 * @returns {Promise<{ tenants: number, cerrados: number, tenantsFallidos: number }>}
 *   tenants recorridos, turnos cerrados en total y tenants que fallaron.
 */
export const procesarCierreDiario = async () => {
  const tenants = await obtenerTenantsActivos();
  let cerrados = 0;
  let tenantsFallidos = 0;

  for (const tenant of tenants) {
    await conEtiquetas({ tenant: tenant.subdominio, tenant_id: tenant.id }, async () => {
      try {
        const ids = await cerrarTurnosDelTenant(tenant.id);
        cerrados += ids.length;
        console.log(`[turnosSinCobrarService] procesarCierreDiario — tenant cerrado | tenant: ${tenant.subdominio} | cerrados: ${ids.length}`);
      } catch (err) {
        tenantsFallidos++;
        console.error(`[turnosSinCobrarService] procesarCierreDiario — fallo cerrando el tenant | tenant: ${tenant.subdominio}:`, err);
      }
    });
  }

  return { tenants: tenants.length, cerrados, tenantsFallidos };
};
