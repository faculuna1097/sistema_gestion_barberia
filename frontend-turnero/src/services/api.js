// /frontend-turnero/src/services/api.js
// Centraliza las llamadas HTTP a los endpoints públicos del turnero.
// Sin auth — el turnero del cliente es anónimo.

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/turnero`
  : 'http://localhost:3001/api/turnero';

// Extraer subdominio del hostname actual.
// En localhost devuelve undefined → el backend usa el fallback del .env
const hostname = window.location.hostname;
const partes = hostname.split('.');
const subdominio = partes.length >= 3 ? partes[0] : undefined;

// Headers base — incluye el subdominio si está disponible
const publicHeaders = {
  'Content-Type': 'application/json',
  ...(subdominio ? { 'X-Tenant-Subdomain': subdominio } : {}),
};

/**
 * getTenant
 * Obtiene datos públicos del tenant (nombre, logo).
 * @returns {Promise<Object>} { id, nombre, logo_url }
 */
export const getTenant = async () => {
  const res = await fetch(`${BASE_URL}/tenant`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener tenant');
  return res.json();
};

/**
 * getServicios
 * Lista servicios activos del tenant.
 * @returns {Promise<Array>} [{ id, nombre, precio, duracion_minutos }]
 */
export const getServicios = async () => {
  const res = await fetch(`${BASE_URL}/servicios`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener servicios');
  return res.json();
};

/**
 * getBarberos
 * Lista barberos activos del tenant.
 * @returns {Promise<Array>} [{ id, nombre }]
 */
export const getBarberos = async () => {
  const res = await fetch(`${BASE_URL}/barberos`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener barberos');
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
  const res = await fetch(`${BASE_URL}/disponibilidad?${params}`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener disponibilidad');
  return res.json();
};

/**
 * crearTurno
 * Crea un turno desde el turnero público.
 * @param {Object} datos - { servicio_id, barbero_id, inicio, nombre, telefono, email }
 * @returns {Promise<Object>} { turno_id, token_gestion }
 */
export const crearTurno = async (datos) => {
  const res = await fetch(`${BASE_URL}/turnos`, {
    method: 'POST',
    headers: publicHeaders,
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
 * getTurnoPorToken
 * Obtiene datos de un turno por su token_gestion.
 * @param {string} token
 * @returns {Promise<Object>} { turno, barbero, servicio, cliente }
 */
export const getTurnoPorToken = async (token) => {
  const res = await fetch(`${BASE_URL}/turnos/${token}`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener turno');
  return res.json();
};

/**
 * cancelarTurno
 * Cancela un turno por su token_gestion.
 * @param {string} token
 * @returns {Promise<Object>} { ok: true }
 */
export const cancelarTurno = async (token) => {
  const res = await fetch(`${BASE_URL}/turnos/${token}/cancelar`, {
    method: 'POST',
    headers: publicHeaders,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Error al cancelar turno');
  }
  return res.json();
};

/**
 * reprogramarTurno
 * Reprograma un turno a un nuevo horario.
 * @param {string} token
 * @param {string} inicio - ISO timestamp del nuevo inicio
 * @returns {Promise<Object>} { ok: true, turno: { id, inicio, fin } }
 */
export const reprogramarTurno = async (token, inicio) => {
  const res = await fetch(`${BASE_URL}/turnos/${token}/reprogramar`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify({ inicio }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || 'Error al reprogramar turno');
    err.status = res.status;
    throw err;
  }
  return res.json();
};
