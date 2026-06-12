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
 * apiFetch
 * Wrapper sobre fetch que agrega Authorization y X-Tenant-Subdomain.
 * @param {string} path - path relativo (ej: '/admin/turnos?fecha=2026-05-13')
 * @param {Object} options - opciones de fetch (method, body, etc.)
 * @returns {Promise<Response>}
 */
export const apiFetch = (path, options = {}) => {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    ...(subdominio ? { 'X-Tenant-Subdomain': subdominio } : {}),
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
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
 * Cambia el estado de un turno a 'completado' o 'no_asistio'.
 * @param {string} turnoId
 * @param {string} estado - 'completado' | 'no_asistio'
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
 * Obtiene suspensiones futuras del barbero autenticado.
 * @returns {Promise<Array>} suspensiones
 */
export const getSuspensiones = async () => {
  const res = await apiFetch('/admin/suspensiones');
  if (!res.ok) throw new Error('Error al obtener suspensiones');
  return res.json();
};

/**
 * crearSuspension
 * Crea una nueva suspensión.
 * @param {Object} datos - { barbero_id, desde, hasta, motivo?, confirmar_cancelacion? }
 * @returns {Promise<Object>} { suspension, turnos_cancelados } o error 409 con turnos_afectados
 */
export const crearSuspension = async (datos) => {
  const res = await apiFetch('/admin/suspensiones', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  if (res.status === 409) {
    const body = await res.json();
    const err = new Error(body.error || 'Hay turnos afectados');
    err.status = 409;
    err.turnos_afectados = body.turnos_afectados;
    return { conflicto: true, ...body };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Error al crear suspensión');
  }
  return res.json();
};

/**
 * eliminarSuspension
 * Elimina una suspensión por su id.
 * @param {string} suspensionId
 * @returns {Promise<Object>} { ok: true }
 */
export const eliminarSuspension = async (suspensionId) => {
  const res = await apiFetch(`/admin/suspensiones/${suspensionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Error al eliminar suspensión');
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
