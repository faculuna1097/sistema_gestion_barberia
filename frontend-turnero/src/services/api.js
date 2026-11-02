// /frontend-turnero/src/services/api.js
// Centraliza las llamadas HTTP a los endpoints públicos del turnero.
// Sin auth — el turnero del cliente es anónimo.

// Base de la API. `BASE_API` apunta a `/api` y `BASE_URL` al namespace
// `/api/turnero`. La mayoría de los endpoints del turnero cuelgan de
// `BASE_URL`; los de imágenes viven en `/api/negocio/*`, fuera de ese
// namespace, y por eso se arman desde `BASE_API`.
const BASE_API = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:3001/api';

const BASE_URL = `${BASE_API}/turnero`;

// Extraer subdominio del hostname actual.
// Solo se considera subdominio si estamos en el dominio de producción.
// En localhost o en una IP de red local devuelve undefined → el backend
// usa el fallback de TENANT_ID del .env.
const hostname = window.location.hostname;
const subdominio = hostname.endsWith('.barbermanager.app')
  ? hostname.split('.')[0]
  : undefined;

// Headers base — incluye el subdominio si está disponible
const publicHeaders = {
  'Content-Type': 'application/json',
  ...(subdominio ? { 'X-Tenant-Subdomain': subdominio } : {}),
};

/**
 * getTenant
 * Obtiene datos públicos del tenant (nombre, contacto, horario, feriados).
 * El logo y demás imágenes se obtienen aparte con getImagenesNegocio().
 * @returns {Promise<Object>} { id, nombre, telefono, direccion, horario_atencion, feriados }
 */
export const getTenant = async () => {
  const res = await fetch(`${BASE_URL}/tenant`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener tenant');
  return res.json();
};

/**
 * getImagenesNegocio
 * Obtiene las imágenes públicas del tenant (logo, fotos del local, cortes).
 * Viven en Supabase Storage; el endpoint devuelve la URL pública ya armada.
 * @returns {Promise<Array>} [{ id, tipo: 'local'|'corte'|'logo', orden, url }]
 */
export const getImagenesNegocio = async () => {
  const res = await fetch(`${BASE_API}/negocio/imagenes`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener imágenes del negocio');
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
 * Obtiene los slots disponibles de un día para un servicio, con un barbero o
 * con "Cualquiera" (`barberoId` nulo: se omite el parámetro).
 * @param {string|null} barberoId - null para "Cualquiera"
 * @param {string} servicioId
 * @param {string} fecha - 'YYYY-MM-DD'
 * @returns {Promise<Object>} Con barbero: { slots: [ISO,...] }.
 *   Con "Cualquiera": { slots: [ISO,...], asignaciones: { [ISO]: barbero_id } },
 *   donde cada clave de `asignaciones` es exactamente un string de `slots`
 */
export const getDisponibilidad = async (barberoId, servicioId, fecha) => {
  const params = new URLSearchParams({ servicio_id: servicioId, fecha });
  if (barberoId) params.set('barbero_id', barberoId);
  const res = await fetch(`${BASE_URL}/disponibilidad?${params}`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener disponibilidad');
  return res.json();
};

/**
 * getDiasDisponibles
 * Obtiene qué días de un rango tienen al menos un slot reservable para un
 * servicio, con un barbero o con "Cualquiera" (`barberoId` nulo: se omite el
 * parámetro y el backend devuelve la unión de los días de todos los barberos).
 * La tira de días lo usa para grisar los días sin turnos. Tope del backend: 62 días.
 * @param {string|null} barberoId - null para "Cualquiera"
 * @param {string} servicioId
 * @param {string} desde - 'YYYY-MM-DD' (inclusive)
 * @param {string} hasta - 'YYYY-MM-DD' (inclusive)
 * @returns {Promise<Object>} { dias: ['YYYY-MM-DD', ...] }
 */
export const getDiasDisponibles = async (barberoId, servicioId, desde, hasta) => {
  const params = new URLSearchParams({ servicio_id: servicioId, desde, hasta });
  if (barberoId) params.set('barbero_id', barberoId);
  const res = await fetch(`${BASE_URL}/dias-disponibles?${params}`, { headers: publicHeaders });
  if (!res.ok) throw new Error('Error al obtener días disponibles');
  return res.json();
};

/**
 * crearTurno
 * Crea un turno desde el turnero público.
 * @param {Object} datos - { servicio_id, barbero_id, inicio, nombre, telefono, email, origen? }.
 *   `origen`: por qué link llegó el cliente (ej. 'instagram'); se omite si no hay
 * @returns {Promise<Object>} { turno_id, token_gestion }
 * @throws {Error} Con `status` (el HTTP) y el mensaje del backend. Un error de
 *   red llega sin `status`.
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
