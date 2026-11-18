// /backend/src/controllers/turnos.js
// Controller del backoffice para gestión de turnos (admin y barbero).
// Thin wrapper: arma filtros según req.rol y req.barbero_id, delega al
// turnosService. Cobertura: decisiones_turnero.md.

import {
  listarTurnos, calcularDuracionServicio, upsertCliente, insertarTurno,
  enriquecerTurno, armarLinkGestion, sincronizarCalendarCreacion,
  notificarConfirmacion, cambiarEstado, completarTurnoConCorte,
  cancelarTurnoPorId, inicioPosteriorAhora, asignarClienteATurno, sincronizarCalendarCliente,
  clienteUsable, borrarClienteSinTurnos,
} from '../services/turnosService.js';
import { barberoActivoEnTenant } from '../services/barberosService.js';
import { validarTurnoEnHorario } from '../services/horarioAtencionService.js';
import { existeFeriado } from '../services/feriadosService.js';
import { validarContacto } from '../utils/validarTexto.js';
import { esFechaISO, parsearInstante } from '../utils/validarFecha.js';
import { esMontoValido, sumaMontosValida, mensajeMontoInvalido } from '../utils/validarNumero.js';
import { MENSAJE_TOTAL_EXCEDIDO } from '../services/cortesService.js';
import { esFormaPagoValida } from '../utils/validarPago.js';
import { esUUID } from '../utils/validarUuid.js';
import { barberoSegunRol, filtroBarberoSegunRol, origenSegunRol } from '../utils/scopingRol.js';
import { cuerpoError422, CUERPO_422_FERIADO } from '../utils/errores422.js';

// Mensaje del 404 de un turno, el mismo que usa turnosService.
const MENSAJE_TURNO_NO_ENCONTRADO = 'Turno no encontrado';
// Mensaje del 404 de un cliente, el mismo que usa asignarClienteATurno.
const MENSAJE_CLIENTE_NO_ENCONTRADO = 'Cliente no encontrado';

/**
 * GET /api/admin/turnos
 * Query params: fecha (YYYY-MM-DD) o desde+hasta (instantes con fecha y hora; sin
 * zona se toman en hora argentina). barbero_id opcional (ignorado si rol=barbero).
 * @returns {JSON} array de turnos con datos de barbero, servicio y cliente;
 *   400 si fecha, desde, hasta o barbero_id son inválidos, o si llega uno solo de
 *   desde y hasta
 */
export const getTurnos = async (req, res) => {
  try {
    // Scoping por rol
    const { barberoId, error } = filtroBarberoSegunRol(req);
    if (error) {
      return res.status(400).json({ error });
    }
    const filtros = { tenantId: req.tenant_id, barberoId };

    // Filtro por fecha o rango
    if (req.query.fecha) {
      if (!esFechaISO(req.query.fecha)) {
        return res.status(400).json({ error: 'fecha debe tener formato YYYY-MM-DD' });
      }
      filtros.fecha = req.query.fecha;
    } else if (req.query.desde || req.query.hasta) {
      // Si falta uno, parsearInstante da null y responde el mismo 400.
      const desde = parsearInstante(req.query.desde);
      const hasta = parsearInstante(req.query.hasta);
      if (!desde || !hasta) {
        return res.status(400).json({ error: 'desde y hasta deben ser fecha y hora válidas (YYYY-MM-DDTHH:MM)' });
      }
      filtros.desde = desde.toISO();
      filtros.hasta = hasta.toISO();
    }

    const turnos = await listarTurnos(filtros);
    res.json(turnos);
  } catch (err) {
    console.error('[turnos] Error en getTurnos:', err);
    res.status(500).json({ error: 'Error al listar turnos' });
  }
};

/**
 * hayDatoDeContacto
 * Dice si el body trae algún dato de contacto del cliente (nombre, teléfono o email)
 * no vacío. Sirve para rechazar un turno "Sin datos" que igual manda datos.
 * @param {Object} body - req.body
 * @returns {boolean} true si viene al menos uno
 */
const hayDatoDeContacto = (body) =>
  ['nombre', 'telefono', 'email'].some((campo) => {
    const valor = body[campo];
    return valor !== undefined && valor !== null && !(typeof valor === 'string' && valor.trim() === '');
  });

/**
 * POST /api/admin/turnos
 * Reserva manual desde backoffice. El cliente es uno de tres:
 * - nuevo: `nombre` y, opcionales, `telefono` y `email` (upsertCliente);
 * - existente: `cliente_id` (sin nombre ni contacto), del local con cualquier rol
 *   (clienteUsable); uno de otro local responde 404, igual que uno inexistente.
 *   Así elegir un cliente del buscador no crea otro igual;
 * - ninguno: `sin_cliente: true` (cliente "Sin datos", turno.cliente_id NULL). No
 *   sale mail. El cliente se le puede asignar después (PATCH /:id/cliente).
 * Si rol=barbero, barbero_id del body se ignora y se usa req.barbero_id.
 * origen_creacion se setea según el rol.
 * @param {Object} req.body - { servicio_id, barbero_id, inicio } más
 *   { nombre, telefono?, email? }, { cliente_id } o { sin_cliente: true }
 * @returns {JSON} 201 { turno_id, token_gestion }; 400 si se combinan dos formas de
 *   cliente (sin_cliente o cliente_id con nombre o contacto, o sin_cliente con
 *   cliente_id); 404 si el cliente_id no existe o no es del local
 */
export const crearTurnoAdmin = async (req, res) => {
  const { servicio_id, inicio, cliente_id: clienteIdBody } = req.body;
  const sinCliente = req.body.sin_cliente === true;
  const traeClienteId = clienteIdBody !== undefined && clienteIdBody !== null && clienteIdBody !== '';

  // barbero_id: si es barbero, forzar el propio (anti escalada horizontal)
  const barbero_id = barberoSegunRol(req, req.body.barbero_id);
  const origen_creacion = origenSegunRol(req);

  // ── Validaciones de presencia (ids + inicio) ──────────────────────────────
  if (!servicio_id || !barbero_id || !inicio) {
    return res.status(400).json({
      error: 'servicio_id, barbero_id e inicio son requeridos',
    });
  }
  // ── Validar y normalizar contacto. En el backoffice telefono y email son
  //    opcionales (contactoRequerido=false); igual se les aplica tope de
  //    longitud y, si viene email, formato válido (auditoría 3.2). Un turno
  //    "Sin datos" no lleva contacto: si igual viene alguno, es un error del
  //    front y se rechaza en vez de descartarlo callado. ──────────────────────
  let contacto = null;
  if (sinCliente && traeClienteId) {
    return res.status(400).json({ error: 'sin_cliente no admite cliente_id' });
  }
  if (sinCliente || traeClienteId) {
    if (hayDatoDeContacto(req.body)) {
      return res.status(400).json({
        error: sinCliente
          ? 'sin_cliente no admite nombre, telefono ni email'
          : 'Mandá cliente_id o los datos de un cliente nuevo, no los dos',
      });
    }
    if (traeClienteId && !esUUID(clienteIdBody)) {
      return res.status(404).json({ error: MENSAJE_CLIENTE_NO_ENCONTRADO });
    }
  } else {
    contacto = validarContacto(req.body, false);
    if (contacto.error) {
      return res.status(400).json({ error: contacto.error });
    }
  }

  // Fecha y hora obligatorias: sin zona se toma en hora argentina; un '10:00' o
  // una fecha sola no son un instante (→ 400). Ver parsearInstante.
  const inicioDT = parsearInstante(inicio);
  if (!inicioDT) {
    return res.status(400).json({ error: 'inicio debe ser una fecha y hora válidas (ISO)' });
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

    // ── Validar que el barbero pertenezca al tenant y esté activo ────────────
    // Para rol=barbero el barbero_id viene forzado del token (mismo tenant), así
    // que pasa trivialmente; el chequeo real es para admin, cuyo barbero_id llega
    // del body. Red de seguridad app sobre el FK compuesto (tenant_id, barbero_id).
    if (!(await barberoActivoEnTenant(barbero_id, req.tenant_id))) {
      console.warn('[turnos] crearTurnoAdmin — barbero no pertenece al tenant o inactivo | barbero_id:', barbero_id);
      return res.status(404).json({ error: 'Barbero no encontrado o inactivo' });
    }
    const finDT = inicioDT.plus({ minutes: duracionMin });

    // ── Validar que el turno caiga dentro del horario de atención ───────────
    const valHorario = await validarTurnoEnHorario(req.tenant_id, inicioDT, finDT);
    if (!valHorario.valido) {
      console.warn('[turnos] crearTurnoAdmin — turno fuera del horario del negocio | codigo:', valHorario.codigo);
      return res.status(422).json(cuerpoError422(valHorario));
    }

    // ── Validar que el turno no caiga en un feriado ─────────────────────────
    if (await existeFeriado(req.tenant_id, inicioDT.toISODate())) {
      console.warn('[turnos] crearTurnoAdmin — turno en día feriado');
      return res.status(422).json(CUERPO_422_FERIADO);
    }

    // ── Cliente: uno existente (del local), uno nuevo (upsert, datos ya
    //    normalizados por validarContacto) o ninguno ("Sin datos", cliente_id
    //    NULL). ─────────────────────────────────────────────────────────────
    let cliente_id = null;
    // Un cliente sin email siempre es una fila nueva (upsertCliente): si el turno
    // no se inserta, se borra para no dejar clientes sin turnos (uno por reintento).
    let clienteCreadoAca = false;
    if (traeClienteId) {
      const usable = await clienteUsable({ clienteId: clienteIdBody, tenantId: req.tenant_id });
      if (!usable) {
        return res.status(404).json({ error: MENSAJE_CLIENTE_NO_ENCONTRADO });
      }
      cliente_id = clienteIdBody;
    } else if (!sinCliente) {
      cliente_id = await upsertCliente(req.tenant_id, contacto);
      clienteCreadoAca = !contacto.email;
    }

    // ── INSERT turno ────────────────────────────────────────────────────────
    let resultado;
    try {
      resultado = await insertarTurno({
        tenantId: req.tenant_id, clienteId: cliente_id, barberoId: barbero_id,
        servicioId: servicio_id, inicioDT, finDT, origenCreacion: origen_creacion,
      });
    } catch (err) {
      if (clienteCreadoAca) await borrarClienteSinTurnos(cliente_id, req.tenant_id, 'crearTurnoAdmin');
      if (err.code === 'SLOT_OCUPADO') {
        console.warn('[turnos] crearTurnoAdmin — slot ocupado (turno o suspensión)');
        return res.status(409).json({ error: err.message });
      }
      if (err.code === 'REFERENCIA_INVALIDA') {
        console.warn('[turnos] crearTurnoAdmin — barbero/servicio inexistente (FK 23503)');
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }
    const { turno_id, token_gestion } = resultado;
    console.log('[turnos] crearTurnoAdmin — turno insertado | turno_id:', turno_id);

    // ── Best-effort: Calendar + mail. Un turno "Sin datos" no tiene email, así
    //    que no sale mail; Calendar lo nombra "Sin datos". ───────────────────
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
 * Marca un turno reservado que ya empezó como 'no_asistio', el único estado
 * que se cambia a mano. 'completado' → 400: un turno se completa registrando
 * su corte (POST /:id/completar o el iPad). Un turno que no empezó → 400; uno
 * que no está reservado → 409.
 * Si rol=barbero, solo puede afectar turnos propios (uno ajeno → 404).
 * @param {Object} req.body - { estado: 'no_asistio' }
 * @returns {JSON} { id, estado }
 */
export const patchEstado = async (req, res) => {
  if (!esUUID(req.params.id)) {
    return res.status(404).json({ error: MENSAJE_TURNO_NO_ENCONTRADO });
  }

  const { estado } = req.body;
  if (!estado) {
    return res.status(400).json({ error: 'estado es requerido' });
  }

  // Scoping: barbero solo cambia los suyos
  const barberoId = barberoSegunRol(req, null);

  try {
    const resultado = await cambiarEstado(req.params.id, estado, req.tenant_id, barberoId);
    console.log('[turnos] patchEstado completado | turno_id:', resultado.id, '| estado:', resultado.estado);
    res.json(resultado);
  } catch (err) {
    if (err.code === 'ESTADO_NO_PERMITIDO' || err.code === 'TURNO_NO_EMPEZO') {
      return res.status(400).json({ error: err.message });
    }
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
 * Completa un turno registrando su corte (forma_pago + precio + propina). Es la
 * única vía del backoffice para completar un turno (patchEstado rechaza
 * 'completado'), y deja el registro financiero del turno — es el equivalente
 * backoffice del flujo operativo del iPad. Acepta servicio_id opcional para cambiar el servicio al
 * completar (default: el del turno); si se cambia, el corte Y el turno quedan con
 * ese servicio. Si rol=barbero, solo puede completar turnos propios y reservados;
 * el admin también uno marcado 'no_asistio' (el cliente vino). Si el turno cambió
 * mientras tanto → 409 y no se registra nada.
 * @param {Object} req.body - { forma_pago, precio, propina?, servicio_id? }
 * @returns {JSON} 201 { id, estado: 'completado', servicio_id, corte_id, monto_total }
 */
export const completarTurno = async (req, res) => {
  if (!esUUID(req.params.id)) {
    return res.status(404).json({ error: MENSAJE_TURNO_NO_ENCONTRADO });
  }

  const { forma_pago, precio, propina, servicio_id } = req.body;

  // ── Validaciones de input ──────────────────────────────────────────────────
  if (!esFormaPagoValida(forma_pago)) {
    return res.status(400).json({ error: "forma_pago es requerida y debe ser 'efectivo' o 'mercado_pago'" });
  }
  if (!esMontoValido(precio)) {
    return res.status(400).json({ error: mensajeMontoInvalido('precio') });
  }
  if (propina !== undefined && !esMontoValido(propina)) {
    return res.status(400).json({ error: mensajeMontoInvalido('propina', { requerido: false }) });
  }
  if (!sumaMontosValida(precio, propina ?? 0)) {
    return res.status(400).json({ error: MENSAJE_TOTAL_EXCEDIDO });
  }

  // Scoping: barbero solo completa los suyos
  const barberoId = barberoSegunRol(req, null);

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
    if (err.code === 'NO_ENCONTRADO' || err.code === 'SERVICIO_INVALIDO' || err.code === 'TURNO_INEXISTENTE') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'ESTADO_INVALIDO' || err.code === 'TURNO_YA_VINCULADO' || err.code === 'TURNO_YA_COMPLETADO') {
      return res.status(409).json({ error: err.message });
    }
    console.error('[turnos] Error en completarTurno:', err);
    res.status(500).json({ error: 'Error al completar el turno' });
  }
};

/**
 * PATCH /api/admin/turnos/:id/cliente
 * Asigna un cliente a un turno "Sin datos" (cliente_id NULL), reservado o completado.
 * El cliente es uno existente ({ cliente_id }, del local) o uno nuevo ({ nombre,
 * telefono?, email? }, con las mismas reglas que el alta). No manda mail. Con rol
 * barbero, solo turnos propios: uno ajeno responde 404, igual que uno inexistente.
 *
 * Reemplazo (auditoría 2026-11, Z5-09): con `reemplazar: true` y
 * `cliente_actual_id` (el cliente que muestra la pantalla), cambia el cliente de
 * un turno que ya tiene uno. Solo el admin: con otro rol responde 403. Si el turno
 * ya no tiene ese cliente (otro lo cambió), 409 'cliente_cambio'. Sin
 * `reemplazar`, no pisa un cliente ya asignado.
 *
 * Después, best-effort, actualiza el evento de Calendar.
 * @param {Object} req.body - { cliente_id } o { nombre, telefono?, email? }; para
 *   reemplazar, además { reemplazar: true, cliente_actual_id }
 * @returns {JSON} 200 { id, cliente_id, cliente_nombre, cliente_email, cliente_telefono };
 *   400 si no viene ninguno de los dos, vienen los dos, el contacto es inválido o,
 *   al reemplazar, falta cliente_actual_id (o no es un UUID);
 *   403 si un rol que no es admin pide reemplazar;
 *   404 si el turno o el cliente no existen (o no son del local, o el turno no es
 *   del barbero);
 *   409 con codigo 'turno_con_cliente' si el turno ya tiene cliente, con codigo
 *   'cliente_cambio' si al reemplazar el cliente ya no es el que se vio, o 409 si
 *   su estado no lo permite
 */
export const asignarCliente = async (req, res) => {
  if (!esUUID(req.params.id)) {
    return res.status(404).json({ error: MENSAJE_TURNO_NO_ENCONTRADO });
  }

  // ── Reemplazo: solo el admin, y con el cliente que está viendo ─────────────
  const reemplazar = req.body.reemplazar === true;
  if (reemplazar && req.rol !== 'admin') {
    console.warn('[turnos] asignarCliente — reemplazo sin rol admin | rol:', req.rol, '| turno_id:', req.params.id);
    return res.status(403).json({ error: 'Solo el dueño puede cambiar el cliente de un turno' });
  }
  const clienteActualId = reemplazar ? req.body.cliente_actual_id : null;
  if (reemplazar && !esUUID(clienteActualId)) {
    return res.status(400).json({ error: 'cliente_actual_id es requerido para cambiar el cliente' });
  }

  const { cliente_id } = req.body;
  const traeClienteId = cliente_id !== undefined && cliente_id !== null && cliente_id !== '';
  const traeContacto = hayDatoDeContacto(req.body);

  if (traeClienteId && traeContacto) {
    return res.status(400).json({ error: 'Mandá cliente_id o los datos de un cliente nuevo, no los dos' });
  }
  if (!traeClienteId && !traeContacto) {
    return res.status(400).json({ error: 'cliente_id o nombre son requeridos' });
  }
  if (traeClienteId && !esUUID(cliente_id)) {
    return res.status(404).json({ error: MENSAJE_CLIENTE_NO_ENCONTRADO });
  }

  let contacto = null;
  if (traeContacto) {
    contacto = validarContacto(req.body, false);
    if (contacto.error) {
      return res.status(400).json({ error: contacto.error });
    }
  }

  // Scoping: barbero solo asigna en los suyos
  const barberoId = barberoSegunRol(req, null);

  let resultado;
  try {
    resultado = await asignarClienteATurno({
      turnoId: req.params.id,
      tenantId: req.tenant_id,
      barberoId,
      clienteId: traeClienteId ? cliente_id : undefined,
      contacto,
      clienteActualId,
    });
  } catch (err) {
    if (err.code === 'NO_ENCONTRADO' || err.code === 'CLIENTE_NO_ENCONTRADO') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'TURNO_CON_CLIENTE') {
      console.warn('[turnos] asignarCliente — el turno ya tiene cliente | turno_id:', req.params.id);
      return res.status(409).json({ error: err.message, codigo: 'turno_con_cliente' });
    }
    if (err.code === 'CLIENTE_CAMBIO') {
      console.warn('[turnos] asignarCliente — el cliente cambió antes del reemplazo | turno_id:', req.params.id);
      return res.status(409).json({ error: err.message, codigo: 'cliente_cambio' });
    }
    if (err.code === 'ESTADO_INVALIDO') {
      console.warn('[turnos] asignarCliente — estado no permite asignar | turno_id:', req.params.id);
      return res.status(409).json({ error: err.message });
    }
    console.error('[turnos] Error en asignarCliente:', err);
    return res.status(500).json({ error: 'Error al asignar el cliente al turno' });
  }
  if (clienteActualId) {
    console.log('[turnos] asignarCliente — cliente reemplazado | turno_id:', resultado.id,
      '| cliente_anterior_id:', clienteActualId, '| cliente_id:', resultado.cliente_id);
  } else {
    console.log('[turnos] asignarCliente completado | turno_id:', resultado.id, '| cliente_id:', resultado.cliente_id);
  }

  // ── Best-effort: el evento de Calendar pasa de "Sin datos" al cliente ──────
  try {
    await sincronizarCalendarCliente(resultado.id);
  } catch (err) {
    console.error('[turnos] asignarCliente — fallo best-effort (Calendar):', err);
  }

  return res.json(resultado);
};

/**
 * DELETE /api/admin/turnos/:id
 * Cancela el turno. Si rol=barbero, solo puede cancelar los propios. Solo un
 * turno reservado que no empezó: uno que ya empezó → 400 (se marca "no asistió");
 * uno que no está reservado → 409.
 * Dispara best-effort Calendar + mail.
 * @returns {JSON} { id, estado: 'cancelado' }
 */
export const deleteTurno = async (req, res) => {
  if (!esUUID(req.params.id)) {
    return res.status(404).json({ error: MENSAJE_TURNO_NO_ENCONTRADO });
  }

  const canceladoPor = origenSegunRol(req);
  const barberoId = barberoSegunRol(req, null);

  try {
    const resultado = await cancelarTurnoPorId(req.params.id, canceladoPor, req.tenant_id, barberoId);
    console.log('[turnos] deleteTurno completado | turno_id:', resultado.id);
    res.json(resultado);
  } catch (err) {
    if (err.code === 'TURNO_YA_EMPEZO') {
      return res.status(400).json({ error: err.message });
    }
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
