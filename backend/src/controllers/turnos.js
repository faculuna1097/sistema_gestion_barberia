// /backend/src/controllers/turnos.js
// Controller del backoffice para gestión de turnos (admin y barbero).
// Thin wrapper: arma filtros según req.rol y req.barbero_id, delega al
// turnosService. Cobertura: plan_turnero_v2.md sección 5 (/api/admin/turnos).

import { DateTime } from 'luxon';
import {
  listarTurnos, calcularDuracionServicio, upsertCliente, insertarTurno,
  enriquecerTurno, armarLinkGestion, sincronizarCalendarCreacion,
  notificarConfirmacion, cambiarEstado, completarTurnoConCorte,
  cancelarTurnoPorId, inicioPosteriorAhora,
} from '../services/turnosService.js';
import { validarTurnoEnHorario } from '../services/horarioAtencionService.js';
import { existeFeriado } from '../services/feriadosService.js';
import { TZ } from '../utils/constantes.js';

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/turnos
 * Query params: fecha (YYYY-MM-DD) o desde+hasta (ISO). barbero_id opcional
 * (ignorado si rol=barbero).
 * @returns {JSON} array de turnos con datos de barbero, servicio y cliente
 */
export const getTurnos = async (req, res) => {
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
    res.json(turnos);
  } catch (err) {
    console.error('[turnos] Error en getTurnos:', err);
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

    // ── Validar que el turno caiga dentro del horario de atención ───────────
    const valHorario = await validarTurnoEnHorario(req.tenant_id, inicioDT, finDT);
    if (!valHorario.valido) {
      console.warn('[turnos] crearTurnoAdmin — turno fuera del horario del negocio | codigo:', valHorario.codigo);
      return res.status(422).json({
        codigo: valHorario.codigo,
        mensaje: valHorario.mensaje,
        ...(valHorario.limite && { limite: valHorario.limite }),
      });
    }

    // ── Validar que el turno no caiga en un feriado ─────────────────────────
    if (await existeFeriado(req.tenant_id, inicioDT.toISODate())) {
      console.warn('[turnos] crearTurnoAdmin — turno en día feriado');
      return res.status(422).json({ codigo: 'feriado', mensaje: 'El negocio está cerrado por feriado ese día' });
    }

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
      console.error('[turnos] crearTurnoAdmin — fallo best-effort (Calendar/mail):', err);
    }

    console.log('[turnos] crearTurnoAdmin completado | turno_id:', turno_id);
    return res.status(201).json({ turno_id, token_gestion });

  } catch (err) {
    console.error('[turnos] Error en crearTurnoAdmin:', err);
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
  const { estado } = req.body;
  if (!estado) {
    return res.status(400).json({ error: 'estado es requerido' });
  }

  // Scoping: barbero solo cambia los suyos
  const barberoId = req.rol === 'barbero' ? req.barbero_id : null;

  try {
    const resultado = await cambiarEstado(req.params.id, estado, req.tenant_id, barberoId);
    console.log('[turnos] patchEstado completado | turno_id:', resultado.id, '| estado:', resultado.estado);
    res.json(resultado);
  } catch (err) {
    if (err.code === 'NO_ENCONTRADO') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'ESTADO_INVALIDO') {
      return res.status(409).json({ error: err.message });
    }
    console.error('[turnos] Error en patchEstado:', err);
    res.status(500).json({ error: 'Error al cambiar estado del turno' });
  }
};

/**
 * POST /api/admin/turnos/:id/completar
 * Completa un turno registrando su corte (forma_pago + precio + propina). A
 * diferencia de patchEstado (que solo cambia el estado a 'completado'), esta vía
 * deja el registro financiero del turno — es el equivalente backoffice del flujo
 * operativo del iPad. Acepta servicio_id opcional para cambiar el servicio al
 * completar (default: el del turno); si se cambia, el corte Y el turno quedan con
 * ese servicio. Si rol=barbero, solo puede completar turnos propios.
 * @param {Object} req.body - { forma_pago, precio, propina?, servicio_id? }
 * @returns {JSON} 201 { id, estado: 'completado', servicio_id, corte_id, monto_total }
 */
export const completarTurno = async (req, res) => {
  const { forma_pago, precio, propina, servicio_id } = req.body;

  // ── Validaciones de input ──────────────────────────────────────────────────
  const formasValidas = ['efectivo', 'mercado_pago'];
  if (!forma_pago || !formasValidas.includes(forma_pago)) {
    return res.status(400).json({ error: "forma_pago es requerida y debe ser 'efectivo' o 'mercado_pago'" });
  }
  if (precio === undefined || Number.isNaN(Number(precio)) || Number(precio) < 0) {
    return res.status(400).json({ error: 'precio es requerido y debe ser un número >= 0' });
  }
  if (propina !== undefined && (Number.isNaN(Number(propina)) || Number(propina) < 0)) {
    return res.status(400).json({ error: 'propina debe ser un número >= 0' });
  }

  // Scoping: barbero solo completa los suyos
  const barberoId = req.rol === 'barbero' ? req.barbero_id : null;

  try {
    const resultado = await completarTurnoConCorte({
      turnoId: req.params.id,
      tenantId: req.tenant_id,
      barberoId,
      formaPago: forma_pago,
      precio,
      propina,
      servicioId: servicio_id,
    });
    console.log('[turnos] completarTurno completado | turno_id:', resultado.id, '| corte_id:', resultado.corte_id);
    res.status(201).json(resultado);
  } catch (err) {
    if (err.code === 'NO_ENCONTRADO') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'SERVICIO_INVALIDO') {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'ESTADO_INVALIDO' || err.code === 'TURNO_YA_VINCULADO') {
      return res.status(409).json({ error: err.message });
    }
    console.error('[turnos] Error en completarTurno:', err);
    res.status(500).json({ error: 'Error al completar el turno' });
  }
};

/**
 * DELETE /api/admin/turnos/:id
 * Cancela el turno. Si rol=barbero, solo puede cancelar los propios.
 * Dispara best-effort Calendar + mail.
 * @returns {JSON} { id, estado: 'cancelado' }
 */
export const deleteTurno = async (req, res) => {
  const canceladoPor = req.rol === 'barbero' ? 'barbero' : 'admin';
  const barberoId = req.rol === 'barbero' ? req.barbero_id : null;

  try {
    const resultado = await cancelarTurnoPorId(req.params.id, canceladoPor, req.tenant_id, barberoId);
    console.log('[turnos] deleteTurno completado | turno_id:', resultado.id);
    res.json(resultado);
  } catch (err) {
    if (err.code === 'NO_ENCONTRADO') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'ESTADO_INVALIDO') {
      return res.status(409).json({ error: err.message });
    }
    console.error('[turnos] Error en deleteTurno:', err);
    res.status(500).json({ error: 'Error al cancelar el turno' });
  }
};
