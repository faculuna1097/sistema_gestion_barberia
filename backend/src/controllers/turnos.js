// /backend/src/controllers/turnos.js
// Controller del backoffice para gestión de turnos (admin y barbero).
// Thin wrapper: arma filtros según req.rol y req.barbero_id, delega al
// turnosService. Cobertura: plan_turnero_v2.md sección 5 (/api/admin/turnos).

import { DateTime } from 'luxon';
import {
  listarTurnos, calcularDuracionServicio, upsertCliente, insertarTurno,
  enriquecerTurno, armarLinkGestion, sincronizarCalendarCreacion,
  notificarConfirmacion, cambiarEstado, cancelarTurnoPorId,
  inicioPosteriorAhora,
} from '../services/turnosService.js';
import { TZ } from '../utils/constantes.js';

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/turnos
 * Query params: fecha (YYYY-MM-DD) o desde+hasta (ISO). barbero_id opcional
 * (ignorado si rol=barbero).
 * @returns {JSON} array de turnos con datos de barbero, servicio y cliente
 */
export const getTurnos = async (req, res) => {
  console.log('[turnos] getTurnos — request recibido | tenant:', req.tenant_id, '| rol:', req.rol);

  try {
    const filtros = { tenantId: req.tenant_id };

    // Scoping por rol
    if (req.rol === 'barbero') {
      filtros.barberoId = req.barbero_id;
    } else if (req.query.barbero_id) {
      filtros.barberoId = req.query.barbero_id;
    }

    // Filtro por fecha o rango
    if (req.query.fecha) {
      if (!REGEX_FECHA.test(req.query.fecha)) {
        return res.status(400).json({ error: 'fecha debe tener formato YYYY-MM-DD' });
      }
      filtros.fecha = req.query.fecha;
    } else if (req.query.desde && req.query.hasta) {
      filtros.desde = req.query.desde;
      filtros.hasta = req.query.hasta;
    }

    const turnos = await listarTurnos(filtros);
    console.log('[turnos] getTurnos — completado |', turnos.length, 'turnos');
    res.json(turnos);
  } catch (err) {
    console.error('[turnos] Error en getTurnos:', err.message);
    res.status(500).json({ error: 'Error al listar turnos' });
  }
};

/**
 * POST /api/admin/turnos
 * Reserva manual desde backoffice. Email y teléfono opcionales.
 * Si rol=barbero, barbero_id del body se ignora y se usa req.barbero_id.
 * origen_creacion se setea según el rol.
 * @param {Object} req.body - { servicio_id, barbero_id, inicio, nombre, telefono?, email? }
 * @returns {JSON} 201 { turno_id, token_gestion }
 */
export const crearTurnoAdmin = async (req, res) => {
  console.log('[turnos] crearTurnoAdmin — request recibido | tenant:', req.tenant_id, '| rol:', req.rol);

  const { servicio_id, inicio, nombre, telefono, email } = req.body;

  // barbero_id: si es barbero, forzar el propio (anti escalada horizontal)
  const barbero_id = req.rol === 'barbero' ? req.barbero_id : req.body.barbero_id;
  const origen_creacion = req.rol === 'barbero' ? 'barbero' : 'admin';

  // ── Validaciones de presencia ─────────────────────────────────────────────
  if (!servicio_id || !barbero_id || !inicio || !nombre) {
    return res.status(400).json({
      error: 'servicio_id, barbero_id, inicio y nombre son requeridos',
    });
  }

  const inicioDT = DateTime.fromISO(inicio, { zone: TZ });
  if (!inicioDT.isValid) {
    return res.status(400).json({ error: 'inicio debe ser un ISO timestamp válido' });
  }
  if (!inicioPosteriorAhora(inicioDT)) {
    return res.status(400).json({ error: 'inicio debe ser futuro' });
  }

  try {
    // ── Duración del servicio ───────────────────────────────────────────────
    const duracionMin = await calcularDuracionServicio(servicio_id, req.tenant_id);
    if (duracionMin === null) {
      return res.status(404).json({ error: 'Servicio no encontrado o inactivo' });
    }
    const finDT = inicioDT.plus({ minutes: duracionMin });

    // ── Upsert cliente ──────────────────────────────────────────────────────
    const cliente_id = await upsertCliente(req.tenant_id, { nombre, telefono, email });

    // ── INSERT turno ────────────────────────────────────────────────────────
    let resultado;
    try {
      resultado = await insertarTurno({
        tenantId: req.tenant_id, clienteId: cliente_id, barberoId: barbero_id,
        servicioId: servicio_id, inicioDT, finDT, origenCreacion: origen_creacion,
      });
    } catch (err) {
      if (err.code === 'SLOT_OCUPADO') {
        console.warn('[turnos] crearTurnoAdmin — slot ya reservado');
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }
    const { turno_id, token_gestion } = resultado;
    console.log('[turnos] crearTurnoAdmin — turno insertado | turno_id:', turno_id);

    // ── Best-effort: Calendar + mail ────────────────────────────────────────
    try {
      const enriquecido = await enriquecerTurno(turno_id);
      if (enriquecido) {
        await sincronizarCalendarCreacion(turno_id, enriquecido);
        if (enriquecido.cliente_email) {
          const linkGestion = armarLinkGestion(req, token_gestion);
          await notificarConfirmacion(enriquecido, linkGestion);
        }
      }
    } catch (err) {
      console.error('[turnos] crearTurnoAdmin — fallo best-effort (Calendar/mail):', err.message);
    }

    console.log('[turnos] crearTurnoAdmin — completado | turno_id:', turno_id);
    return res.status(201).json({ turno_id, token_gestion });

  } catch (err) {
    console.error('[turnos] Error en crearTurnoAdmin:', err.message);
    return res.status(500).json({ error: 'Error al crear el turno' });
  }
};

/**
 * PATCH /api/admin/turnos/:id/estado
 * Cambia estado a 'completado' o 'no_asistio'.
 * Si rol=barbero, solo puede afectar turnos propios.
 * @param {Object} req.body - { estado: 'completado' | 'no_asistio' }
 * @returns {JSON} { id, estado }
 */
export const patchEstado = async (req, res) => {
  console.log('[turnos] patchEstado — request recibido | tenant:', req.tenant_id,
    '| turno:', req.params.id, '| rol:', req.rol);

  const { estado } = req.body;
  if (!estado) {
    return res.status(400).json({ error: 'estado es requerido' });
  }

  // Scoping: barbero solo cambia los suyos
  const barberoId = req.rol === 'barbero' ? req.barbero_id : null;

  try {
    const resultado = await cambiarEstado(req.params.id, estado, req.tenant_id, barberoId);
    console.log('[turnos] patchEstado — completado | turno_id:', resultado.id, '| estado:', resultado.estado);
    res.json(resultado);
  } catch (err) {
    if (err.code === 'NO_ENCONTRADO') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'ESTADO_INVALIDO') {
      return res.status(409).json({ error: err.message });
    }
    console.error('[turnos] Error en patchEstado:', err.message);
    res.status(500).json({ error: 'Error al cambiar estado del turno' });
  }
};

/**
 * DELETE /api/admin/turnos/:id
 * Cancela el turno. Si rol=barbero, solo puede cancelar los propios.
 * Dispara best-effort Calendar + mail.
 * @returns {JSON} { id, estado: 'cancelado' }
 */
export const deleteTurno = async (req, res) => {
  console.log('[turnos] deleteTurno — request recibido | tenant:', req.tenant_id,
    '| turno:', req.params.id, '| rol:', req.rol);

  const canceladoPor = req.rol === 'barbero' ? 'barbero' : 'admin';
  const barberoId = req.rol === 'barbero' ? req.barbero_id : null;

  try {
    const resultado = await cancelarTurnoPorId(req.params.id, canceladoPor, req.tenant_id, barberoId);
    console.log('[turnos] deleteTurno — completado | turno_id:', resultado.id);
    res.json(resultado);
  } catch (err) {
    if (err.code === 'NO_ENCONTRADO') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'ESTADO_INVALIDO') {
      return res.status(409).json({ error: err.message });
    }
    console.error('[turnos] Error en deleteTurno:', err.message);
    res.status(500).json({ error: 'Error al cancelar el turno' });
  }
};
