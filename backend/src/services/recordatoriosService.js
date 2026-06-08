// /backend/src/services/recordatoriosService.js
// Lógica del lote diario de recordatorios de turno (la "noche anterior").
// El disparador (cron / script) es una cáscara fina que invoca a
// procesarRecordatorios; toda la lógica del trabajo vive acá para que el
// mecanismo de disparo se pueda cambiar sin reescribir esto (ver
// docs/plan_recordatorio_turnos.md §5).
//
// Restricciones (plan §9): sin transacciones ni pool.connect() — el Pooler de
// Supabase no las soporta; la idempotencia se resuelve con el claim atómico de
// un solo UPDATE (reclamarTurno). La aritmética de fechas usa luxon y la TZ
// canónica de utils/constantes.js.

import { DateTime } from 'luxon';
import { query } from '../config/db.js';
import { TZ, RECORDATORIO_DIAS_ANTES } from '../utils/constantes.js';
import { enviarRecordatorio, construirContextoMail } from './mailer.js';
import { construirLinkGestion } from './turnosService.js';

/**
 * Lee la sub-config de recordatorio de un tenant aplicando el default opt-in:
 * el feature está apagado salvo que el tenant lo prenda explícitamente con
 * configuracion.recordatorio.activo === true. Centraliza acá la lógica de
 * defaults (hoy solo `activo`; a futuro entra `hora_envio` per-tenant, plan §6.2).
 *
 * @param {Object|null} configuracion - el jsonb tenant.configuracion
 * @returns {{ activo: boolean }} config normalizada del recordatorio
 */
export const leerConfigRecordatorio = (configuracion) => {
  const reco = configuracion?.recordatorio;
  return { activo: reco?.activo === true };
};

/**
 * Obtiene los tenants activos del sistema con los datos que el job necesita
 * (id para scopear la query, subdominio para armar el link, configuracion para
 * decidir si el feature está prendido). El filtro por feature-flag se hace en
 * JS con leerConfigRecordatorio, no en SQL, para tener la lógica de defaults en
 * un solo lugar.
 *
 * @returns {Promise<Array<{ id: string, subdominio: string, nombre_negocio: string, configuracion: Object }>>}
 */
export const obtenerTenantsActivos = async () => {
  const result = await query(
    `SELECT id, subdominio, nombre_negocio, configuracion
     FROM tenant
     WHERE activo = true`
  );
  return result.rows;
};

/**
 * Trae los turnos candidatos a recordatorio de un tenant para una fecha local:
 * reservados, todavía no avisados (recordatorio_enviado_en IS NULL) y cuyo
 * inicio cae en el día objetivo (interpretado en TZ Argentina). Devuelve las
 * columnas con los alias estándar que consume construirContextoMail (mailer.js)
 * más tenant_subdominio y token_gestion para armar el link, y turno_id para el
 * claim. No filtra por inicio > now(): el día objetivo es futuro y el estado
 * 'reservado' ya excluye cancelados/completados (plan §7.2).
 *
 * @param {string} tenantId      - UUID del tenant
 * @param {string} fechaObjetivo - fecha local YYYY-MM-DD del día a recordar
 * @returns {Promise<Array<Object>>} filas enriquecidas, ordenadas por inicio asc
 */
export const obtenerTurnosDelLote = async (tenantId, fechaObjetivo) => {
  const result = await query(
    `SELECT t.inicio, t.fin, t.token_gestion,
            b.nombre AS barbero_nombre, b.email AS barbero_email,
            s.nombre AS servicio_nombre,
            c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono,
            tn.nombre_negocio AS tenant_nombre, tn.direccion AS tenant_direccion,
            tn.subdominio AS tenant_subdominio,
            t.id AS turno_id
     FROM turno t
     JOIN barbero  b  ON b.id  = t.barbero_id
     JOIN servicio s  ON s.id  = t.servicio_id
     JOIN cliente  c  ON c.id  = t.cliente_id
     JOIN tenant   tn ON tn.id = t.tenant_id
     WHERE t.tenant_id = $1
       AND t.estado = 'reservado'
       AND t.recordatorio_enviado_en IS NULL
       AND DATE(t.inicio AT TIME ZONE $2) = $3::date
     ORDER BY t.inicio ASC`,
    [tenantId, TZ, fechaObjetivo]
  );
  return result.rows;
};

/**
 * Claim atómico de un turno para envío (idempotencia sin transacciones,
 * plan §7.3). Un único UPDATE marca recordatorio_enviado_en sólo si seguía en
 * NULL; el RETURNING dice si este runner ganó el envío. Marcar ANTES de enviar
 * es deliberado: un envío doble es peor que perder uno ocasional, y hace el
 * lote re-ejecutable sin duplicar mails.
 *
 * @param {string} turnoId - UUID del turno a reclamar
 * @returns {Promise<boolean>} true si este runner reclamó el turno (debe enviar),
 *   false si ya estaba reclamado (saltear)
 */
export const reclamarTurno = async (turnoId) => {
  const result = await query(
    `UPDATE turno SET recordatorio_enviado_en = now()
     WHERE id = $1 AND recordatorio_enviado_en IS NULL
     RETURNING id`,
    [turnoId]
  );
  return result.rows.length > 0;
};

/**
 * Orquestador del lote: calcula la fecha objetivo (hoy + RECORDATORIO_DIAS_ANTES
 * en TZ local), recorre los tenants activos, saltea los que no tienen el feature
 * prendido y, por cada uno, procesa sus turnos candidatos. Cada tenant corre en
 * su propio try/catch (un fallo aislado no tira abajo el resto del lote) y, dentro,
 * cada turno también (un fallo puntual no tira el resto del tenant).
 *
 * Por cada turno con email: lo reclama con el claim atómico (§7.3, que marca
 * ANTES de enviar) y, si ganó el claim, manda el recordatorio (best-effort: el
 * mailer no propaga). Si el cliente no tiene email se saltea ANTES del claim,
 * para no quemar el claim de algo que no se va a enviar. En dry-run sólo lista a
 * quién se le enviaría, sin reclamar ni mandar nada.
 *
 * @param {Object} [opciones]
 * @param {boolean} [opciones.dryRun=false] - si true, sólo lista; no reclama ni envía
 * @returns {Promise<{ tenantsConRecordatorio: number, enviados: number, salteados: number, fallidos: number, yaReclamados: number }>}
 *   resumen del lote: enviados (en dry-run, los que se enviarían), salteados (sin
 *   email), fallidos (claim ganado pero el envío falló; el turno queda marcado),
 *   yaReclamados (claim perdido por re-corrida o deploy solapado).
 */
export const procesarRecordatorios = async ({ dryRun = false } = {}) => {
  const fechaObjetivo = DateTime.now().setZone(TZ).plus({ days: RECORDATORIO_DIAS_ANTES }).toISODate();
  console.log(`[recordatorios] procesarRecordatorios — inicio | fecha_objetivo: ${fechaObjetivo} | dry_run: ${dryRun}`);

  const tenants = await obtenerTenantsActivos();
  console.log(`[recordatorios] procesarRecordatorios — tenants activos | count: ${tenants.length}`);

  let tenantsConRecordatorio = 0;
  let enviados = 0;     // en dry-run: cuántos se enviarían
  let salteados = 0;    // cliente sin email
  let fallidos = 0;     // claim ganado pero el envío devolvió false (queda marcado, sin reintento)
  let yaReclamados = 0; // claim perdido (re-corrida o deploy solapado)

  for (const tenant of tenants) {
    const config = leerConfigRecordatorio(tenant.configuracion);
    if (!config.activo) continue;
    tenantsConRecordatorio++;

    try {
      const turnos = await obtenerTurnosDelLote(tenant.id, fechaObjetivo);
      console.log(`[recordatorios] procesarRecordatorios — lote del tenant | tenant: ${tenant.subdominio} | turnos: ${turnos.length}`);

      for (const fila of turnos) {
        // Cliente sin email: saltar ANTES del claim. No tiene sentido quemar el
        // claim (marcar recordatorio_enviado_en) de un turno que no se va a
        // enviar. Vale para ambos modos.
        if (!fila.cliente_email) {
          console.warn(`[recordatorios] procesarRecordatorios — saltado (cliente sin email) | tenant: ${tenant.subdominio} | cliente: ${fila.cliente_nombre} | inicio: ${fila.inicio}`);
          salteados++;
          continue;
        }

        // Dry-run: sólo lista a quién se le enviaría; no reclama ni manda nada.
        if (dryRun) {
          console.log(`[recordatorios] procesarRecordatorios — [dry-run] se enviaría | tenant: ${tenant.subdominio} | cliente: ${fila.cliente_nombre} | email: ${fila.cliente_email} | inicio: ${fila.inicio}`);
          enviados++;
          continue;
        }

        // Envío real. Cada turno se aísla en su try/catch para que un fallo
        // puntual (p.ej. error de DB en el claim) no tire el resto del lote.
        try {
          // Claim atómico (§7.3): marca recordatorio_enviado_en ANTES de enviar.
          // Si lo perdió otro runner (deploy solapado / re-corrida), no se envía.
          const gano = await reclamarTurno(fila.turno_id);
          if (!gano) {
            console.warn(`[recordatorios] procesarRecordatorios — claim perdido (ya reclamado) | tenant: ${tenant.subdominio} | turno_id: ${fila.turno_id}`);
            yaReclamados++;
            continue;
          }

          const { turno, barbero, servicio, cliente, tenant: tenantMail } = construirContextoMail(fila);
          const linkGestion = construirLinkGestion(fila.tenant_subdominio, fila.token_gestion);
          const ok = await enviarRecordatorio(turno, barbero, servicio, cliente, linkGestion, tenantMail);
          if (ok) {
            enviados++;
          } else {
            // Best-effort: el envío falló pero el turno queda marcado (sin
            // rollback ni reintento). Un envío doble es peor que perder uno (§7.3).
            console.warn(`[recordatorios] procesarRecordatorios — envío falló, turno queda marcado | tenant: ${tenant.subdominio} | turno_id: ${fila.turno_id}`);
            fallidos++;
          }
        } catch (err) {
          console.error(`[recordatorios] procesarRecordatorios — error procesando turno | tenant: ${tenant.subdominio} | turno_id: ${fila.turno_id}:`, err);
          fallidos++;
        }
      }
    } catch (err) {
      console.error(`[recordatorios] procesarRecordatorios — fallo procesando tenant | tenant: ${tenant.subdominio}:`, err);
    }
  }

  console.log(`[recordatorios] procesarRecordatorios — lote completo | dry_run: ${dryRun} | tenants_con_recordatorio: ${tenantsConRecordatorio} | enviados: ${enviados} | salteados: ${salteados} | fallidos: ${fallidos} | ya_reclamados: ${yaReclamados}`);
  return { tenantsConRecordatorio, enviados, salteados, fallidos, yaReclamados };
};
