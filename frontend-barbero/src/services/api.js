// /frontend-barbero/src/services/api.js
// Centraliza las llamadas HTTP al backend para la app del barbero.
// Rutas públicas (login, disponibilidad, servicios) usan fetch directo.
// Rutas protegidas (/api/admin/*) usan apiFetch con JWT.

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:3001/api';

// Extraer subdominio del hostname actual.
// Solo se considera subdominio si estamos en el dominio de producción.
// En localhost o en una IP de red local devuelve undefined → el backend
// usa el fallback de TENANT_ID del .env.
const hostname = window.location.hostname;
const subdominio = hostname.endsWith('.barbermanager.app')
  ? hostname.split('.')[0]
  : undefined;

// Headers base para rutas públicas
const publicHeaders = {
  'Content-Type': 'application/json',
  ...(subdominio ? { 'X-Tenant-Subdomain': subdominio } : {}),
};

// Variable de módulo — persiste mientras la app está viva
let authToken = null;

// Callback que App.jsx registra para reaccionar a un 401 (token expirado o
// revocado: cambio de PIN o barbero desactivado). Disparado desde apiFetch;
// típicamente limpia el estado y redirige al login.
let onUnauthorized = null;

/**
 * setAuthToken
 * Guarda el JWT en el módulo para que apiFetch lo incluya en los headers.
 * @param {string} token - JWT recibido del backend
 */
export const setAuthToken = (token) => {
  authToken = token;
};

/**
 * clearAuthToken
 * Elimina el token del módulo. Llamar al cerrar sesión.
 */
export const clearAuthToken = () => {
  authToken = null;
};

/**
 * setOnUnauthorized
 * Registra un callback que apiFetch ejecuta cuando el backend devuelve 401.
 * App.jsx lo usa para limpiar su estado local y volver al login.
 * @param {Function|null} fn - función sin argumentos, o null para desregistrar
 */
export const setOnUnauthorized = (fn) => {
  onUnauthorized = fn;
};

/**
 * apiFetch
 * Wrapper sobre fetch que agrega Authorization y X-Tenant-Subdomain.
 * Si el backend devuelve 401, limpia el token automáticamente y dispara el
 * callback registrado con setOnUnauthorized (redirección al login). Devuelve
 * la Response normal para que el caller pueda mostrar su propio mensaje de
 * error antes de que ocurra la redirección.
 * @param {string} path - path relativo (ej: '/admin/turnos?fecha=2026-05-13')
 * @param {Object} options - opciones de fetch (method, body, etc.)
 * @returns {Promise<Response>}
 */
export const apiFetch = async (path, options = {}) => {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    ...(subdominio ? { 'X-Tenant-Subdomain': subdominio } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    console.warn('[api] apiFetch — 401 | path:', path, '| limpiando token y notificando a la app');
    clearAuthToken();
    if (onUnauthorized) onUnauthorized();
  }
  return response;
};

// ─── RUTAS PÚBLICAS (sin auth) ───────────────────────────────────────────────

/**
 * getBarberos
 * Lista barberos activos del tenant (para el selector de login).
 * Usa /api/turnero/barberos porque es el único endpoint público de listado
 * tras la privatización de /api/barberos.
 * @returns {Promise<Array>} [{ id, nombre }]
 */
export const getBarberos = async () => {
  const res = await fetch(`${BASE_URL}/turnero/barberos`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener barberos');
  return res.json();
};

/**
 * getImagenesNegocio
 * Obtiene las imágenes públicas del tenant (logo, fotos del local, cortes).
 * Viven en Supabase Storage; el endpoint devuelve la URL pública ya armada.
 * @returns {Promise<Array>} [{ id, tipo: 'local'|'corte'|'logo', orden, url }]
 */
export const getImagenesNegocio = async () => {
  const res = await fetch(`${BASE_URL}/negocio/imagenes`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener imágenes del negocio');
  return res.json();
};

/**
 * loginBarbero
 * Autentica al barbero con su id y PIN.
 * @param {string} barberoId
 * @param {string} pin - PIN de 4 dígitos
 * @returns {Promise<Object>} { token, barbero: { id, nombre } }
 */
export const loginBarbero = async (barberoId, pin) => {
  const res = await fetch(`${BASE_URL}/auth/barbero/login`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify({ barbero_id: barberoId, pin }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Error al iniciar sesión');
  }
  return res.json();
};

/**
 * getServicios
 * Lista servicios activos del tenant (para crear turno manual).
 * @returns {Promise<Array>} [{ id, nombre, precio, duracion_minutos }]
 */
export const getServicios = async () => {
  const res = await fetch(`${BASE_URL}/turnero/servicios`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener servicios');
  return res.json();
};

/**
 * getDisponibilidad
 * Obtiene slots disponibles para un (barbero, servicio, fecha).
 * @param {string} barberoId
 * @param {string} servicioId
 * @param {string} fecha - 'YYYY-MM-DD'
 * @returns {Promise<Object>} { slots: [ISO,...] }
 */
export const getDisponibilidad = async (barberoId, servicioId, fecha) => {
  const params = new URLSearchParams({
    barbero_id: barberoId,
    servicio_id: servicioId,
    fecha,
  });
  const res = await fetch(`${BASE_URL}/turnero/disponibilidad?${params}`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener disponibilidad');
  return res.json();
};

/**
 * getTenant
 * Obtiene los datos públicos del negocio, incluido el horario de atención
 * semanal. Se usa para validar los bloques del barbero contra el horario
 * real del local.
 * @returns {Promise<Object>} { id, nombre, horario_atencion, feriados }
 */
export const getTenant = async () => {
  const res = await fetch(`${BASE_URL}/turnero/tenant`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener datos del negocio');
  return res.json();
};

// ─── RUTAS PROTEGIDAS (con JWT vía apiFetch) ─────────────────────────────────

/**
 * getTurnos
 * Obtiene turnos filtrados por fecha y/o rango.
 * @param {Object} filtros - { fecha?, desde?, hasta? }
 * @returns {Promise<Array>} turnos con datos de barbero, servicio y cliente
 */
export const getTurnos = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.fecha) params.set('fecha', filtros.fecha);
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  const res = await apiFetch(`/admin/turnos?${params}`);
  if (!res.ok) throw new Error('Error al obtener turnos');
  return res.json();
};

/**
 * getAgenda
 * Agenda de un día del barbero autenticado, en una sola llamada: turnos,
 * descansos y ausencias, y la grilla de slots (plan_app_barbero.md, Feature 1, 2.6).
 * Los instantes de `grilla` llegan con offset '-03:00'; los de `turnos`,
 * `suspensiones` y `descansos`, en UTC ('...Z'): compararlos siempre como fechas,
 * nunca como texto.
 * @param {string} fecha - 'YYYY-MM-DD'
 * @returns {Promise<Object>} {
 *   fecha, barbero_id, duracion_slot_minutos,
 *   horario_atencion: { hora_inicio, hora_fin } | null — horario del local ese día ('HH:MM'),
 *   turnos: [...] — misma forma que getTurnos (todos los estados),
 *   suspensiones: [{ id, desde, hasta, tipo: 'suspension', origen, motivo, ... }] — solo las ausencias,
 *   descansos: [{ id, desde, hasta, origen, estado, partes: [{ id, desde, hasta }], ... }] —
 *     bloques: los descansos pegados vienen unidos en uno; estado 'liberado' = liberado
 *     antes de empezar (no se dibuja),
 *   grilla: [{ inicio, fin, estado: 'libre'|'turno'|'descanso'|'suspension' }]
 * }
 */
export const getAgenda = async (fecha) => {
  const res = await apiFetch(`/admin/agenda?fecha=${fecha}`);
  if (!res.ok) throw new Error('Error al obtener la agenda');
  return res.json();
};

/**
 * crearTurnoAdmin
 * Crea un turno manual desde la app del barbero.
 * @param {Object} datos - { servicio_id, barbero_id, inicio, nombre, telefono?, email? }
 * @returns {Promise<Object>} { turno_id, token_gestion }
 */
export const crearTurnoAdmin = async (datos) => {
  const res = await apiFetch('/admin/turnos', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || 'Error al crear turno');
    err.status = res.status;
    throw err;
  }
  return res.json();
};

/**
 * patchEstadoTurno
 * Cambia el estado de un turno a mano. El único permitido es 'no_asistio', en
 * un turno que ya empezó: un turno se completa al registrar su corte (iPad o
 * panel), y el servidor rechaza 'completado' con un 400.
 * @param {string} turnoId
 * @param {'no_asistio'} estado
 * @returns {Promise<Object>} { id, estado }
 */
export const patchEstadoTurno = async (turnoId, estado) => {
  const res = await apiFetch(`/admin/turnos/${turnoId}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Error al cambiar estado');
  }
  return res.json();
};

/**
 * cancelarTurno
 * Cancela un turno por su id.
 * @param {string} turnoId
 * @returns {Promise<Object>} { id, estado: 'cancelado' }
 */
export const cancelarTurno = async (turnoId) => {
  const res = await apiFetch(`/admin/turnos/${turnoId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Error al cancelar turno');
  }
  return res.json();
};

/**
 * getHorarios
 * Obtiene el horario semanal de un barbero.
 * @param {string} barberoId
 * @returns {Promise<Array>} [{ id, dia_semana, hora_inicio, hora_fin }]
 */
export const getHorarios = async (barberoId) => {
  const res = await apiFetch(`/admin/horarios/${barberoId}`);
  if (!res.ok) throw new Error('Error al obtener horarios');
  return res.json();
};

/**
 * putHorarios
 * Reemplaza completo el horario semanal de un barbero.
 * @param {string} barberoId
 * @param {Array} bloques - [{ dia_semana, hora_inicio, hora_fin }]
 * @returns {Promise<Array>} bloques insertados con id
 */
export const putHorarios = async (barberoId, bloques) => {
  const res = await apiFetch(`/admin/horarios/${barberoId}`, {
    method: 'PUT',
    body: JSON.stringify(bloques),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Error al guardar horarios');
  }
  return res.json();
};

/**
 * getSuspensiones
 * Obtiene las suspensiones y descansos del barbero autenticado que todavía no
 * terminaron.
 * @param {Object} [filtros]
 * @param {'suspension'|'descanso'} [filtros.tipo] - si se omite, los dos
 * @returns {Promise<Array>} suspensiones
 */
export const getSuspensiones = async ({ tipo } = {}) => {
  const params = new URLSearchParams();
  if (tipo) params.set('tipo', tipo);
  const res = await apiFetch(`/admin/suspensiones?${params}`);
  if (!res.ok) throw new Error('Error al obtener suspensiones');
  return res.json();
};

/**
 * crearSuspension
 * Crea una nueva suspensión. Si pisa turnos reservados y no viene
 * `confirmar_cancelacion`, el servidor no la crea y responde 409 con la lista
 * de turnos afectados.
 * @param {Object} datos - { barbero_id, desde, hasta, motivo?, confirmar_cancelacion? }
 * @returns {Promise<Object>} { suspension, turnos_cancelados } (turnos_cancelados: cantidad)
 * @throws {Error} con el mensaje del servidor y `status`; el 409 de turnos
 *   afectados suma `turnos_afectados` ([{ inicio, cliente_nombre, ... }])
 */
export const crearSuspension = async (datos) => {
  const res = await apiFetch('/admin/suspensiones', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || 'Error al crear suspensión');
    err.status = res.status;
    if (body.turnos_afectados) err.turnos_afectados = body.turnos_afectados;
    throw err;
  }
  return res.json();
};

/**
 * liberarSuspension
 * Libera una suspensión o un descanso: si no empezó, deja de bloquear entero;
 * si está en curso, termina en este momento. La fila no se borra (queda como
 * registro para el dueño). El endpoint sigue siendo el DELETE de siempre.
 * @param {string} suspensionId
 * @returns {Promise<Object>} { ok: true, suspension: { id, tipo, desde, hasta, liberada_en, liberada_por } }
 * @throws {Error} con el mensaje del servidor y `status` (403 del admin, 404, 409 ya liberada/terminada)
 */
export const liberarSuspension = async (suspensionId) => {
  const res = await apiFetch(`/admin/suspensiones/${suspensionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || 'Error al liberar');
    err.status = res.status;
    throw err;
  }
  return res.json();
};

/**
 * crearDescanso
 * Marca un descanso propio sobre slots libres y futuros de un día
 * (plan_app_barbero.md, Feature 1, 2.5). El rango tiene que coincidir con slots
 * seguidos de la grilla: se mandan el inicio del primero y el fin del último tal
 * como los dio GET /admin/agenda.
 * @param {Object} rango
 * @param {string} rango.desde - ISO con offset (inicio del primer slot)
 * @param {string} rango.hasta - ISO con offset (fin del último slot)
 * @returns {Promise<Object>} { descanso, bloque }: la fila creada y el bloque que
 *   la contiene, ya unido con los descansos pegados (null si el servidor no lo pudo leer)
 * @throws {Error} con el mensaje del servidor y `status` (400 rango inválido o
 *   no futuro, 409 algún slot se ocupó)
 */
export const crearDescanso = async ({ desde, hasta }) => {
  const res = await apiFetch('/admin/descansos', {
    method: 'POST',
    body: JSON.stringify({ desde, hasta }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || 'Error al marcar el descanso');
    err.status = res.status;
    throw err;
  }
  return res.json();
};

/**
 * getPlanilla
 * Obtiene el detalle semanal de cortes del barbero autenticado.
 * @param {string} semana - 'YYYY-MM-DD' (cualquier día de la semana)
 * @returns {Promise<Array>} detalle agrupado por barbero
 */
export const getPlanilla = async (semana) => {
  const res = await apiFetch(`/admin/planilla?semana=${semana}`);
  if (!res.ok) throw new Error('Error al obtener planilla');
  return res.json();
};

/**
 * getResumenPlanilla
 * Obtiene el resumen semanal con comisiones.
 * @param {string} semana - 'YYYY-MM-DD'
 * @returns {Promise<Object>} { barberos: [...], totales: {...} }
 */
export const getResumenPlanilla = async (semana) => {
  const res = await apiFetch(`/admin/planilla/resumen?semana=${semana}`);
  if (!res.ok) throw new Error('Error al obtener resumen');
  return res.json();
};

/**
 * getMisClientes
 * Obtiene los clientes que tuvieron turnos con el barbero autenticado.
 * @returns {Promise<Array>} [{ id, nombre, email, telefono, total_visitas, ultima_visita }]
 */
export const getMisClientes = async () => {
  const res = await apiFetch('/admin/clientes/mis-clientes');
  if (!res.ok) throw new Error('Error al obtener clientes');
  return res.json();
};

/**
 * buscarClientes
 * Busca clientes del tenant por nombre/email/teléfono.
 * @param {string} busqueda - texto de búsqueda (mínimo 2 caracteres)
 * @returns {Promise<Array>} [{ id, nombre, email, telefono }]
 */
export const buscarClientes = async (busqueda) => {
  const res = await apiFetch(`/admin/clientes?busqueda=${encodeURIComponent(busqueda)}`);
  if (!res.ok) throw new Error('Error al buscar clientes');
  return res.json();
};
