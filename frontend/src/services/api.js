// /frontend/src/services/api.js
// Centraliza todas las llamadas HTTP al backend.
// Si la URL del backend cambia, solo se modifica este archivo.
//
// ─── MANEJO DE TOKEN ──────────────────────────────────────────────────────────
// El token JWT se guarda en este módulo con setAuthToken() luego del login.
// Las funciones de rutas protegidas lo leen automáticamente vía apiFetch().
// Las funciones de rutas públicas usan fetch() directamente con publicHeaders.

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:3001/api';

// Extraer subdominio del hostname actual.
// En localhost devuelve undefined → el backend usa el fallback del .env
const hostname = window.location.hostname;
const partes = hostname.split('.');
const subdominio = partes.length >= 3 ? partes[0] : undefined;

// Headers base para rutas públicas — incluye el subdominio si está disponible
const publicHeaders = {
  'Content-Type': 'application/json',
  ...(subdominio ? { 'X-Tenant-Subdomain': subdominio } : {}),
};

// Variable de módulo — persiste mientras la app está viva, no se guarda en localStorage
let authToken = null;

/**
 * setAuthToken
 * Guarda el JWT en el módulo para que apiFetch() lo incluya en los headers.
 * Llamar desde App.jsx inmediatamente después del login exitoso.
 * @param {string} token - JWT recibido del backend
 */
export const setAuthToken = (token) => {
  authToken = token;
  console.log('[api] setAuthToken — completado');
};

/**
 * clearAuthToken
 * Elimina el token del módulo. Llamar desde App.jsx al cerrar sesión.
 */
export const clearAuthToken = () => {
  authToken = null;
  console.log('[api] clearAuthToken — completado');
};

/**
 * apiFetch
 * Wrapper sobre fetch() que construye la URL completa a partir del path
 * y agrega automáticamente el header Authorization cuando hay un token disponible.
 * Usar en todos los componentes del panel admin en reemplazo del fetch() directo.
 *
 * @param {string} path    - Path del endpoint sin BASE_URL (ej: '/caja/movimientos-dia')
 * @param {Object} options - Opciones de fetch (method, body, etc.) — opcional
 * @returns {Promise<Response>} La misma Response que devuelve fetch()
 *
 * Ejemplos de uso:
 *   apiFetch('/caja/movimientos-dia?fecha=2026-03-27')
 *   apiFetch(`/caja/movimientos/corte/${id}`, { method: 'DELETE' })
 *   apiFetch('/admin/barberos', { method: 'POST', body: JSON.stringify(datos) })
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

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS PÚBLICAS — no requieren token (flujos operativos)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getBarberos
 * Obtiene la lista de barberos activos del tenant.
 * @returns {Promise<Array>} Array de { id, nombre }
 */
export const getBarberos = async () => {
  const response = await fetch(`${BASE_URL}/barberos`, { headers: publicHeaders });
  if (!response.ok) throw new Error('Error al obtener barberos');
  return response.json();
};

/**
 * getServicios
 * Obtiene la lista de servicios activos del tenant.
 * @returns {Promise<Array>} Array de { id, nombre, precio }
 */
export const getServicios = async () => {
  const response = await fetch(`${BASE_URL}/servicios`, { headers: publicHeaders });
  if (!response.ok) throw new Error('Error al obtener servicios');
  return response.json();
};

/**
 * getProductos
 * Obtiene la lista de productos activos del tenant.
 * @returns {Promise<Array>} Array de { id, nombre, precio, stock_actual }
 */
export const getProductos = async () => {
  const response = await fetch(`${BASE_URL}/productos`, { headers: publicHeaders });
  if (!response.ok) throw new Error('Error al obtener productos');
  return response.json();
};

/**
 * getCategorias
 * Obtiene las categorías de gasto del tenant.
 * @returns {Promise<Array>} Array de { id, nombre }
 */
export const getCategorias = async () => {
  const response = await fetch(`${BASE_URL}/categorias`, { headers: publicHeaders });
  if (!response.ok) throw new Error('Error al obtener categorías');
  return response.json();
};

/**
 * getTurnosDelDia
 * Obtiene los turnos reservados de un barbero en una fecha (flujo operativo).
 * @param {string} barberoId - UUID del barbero
 * @param {string} fecha - 'YYYY-MM-DD'
 * @returns {Promise<Array>} [{ id, inicio, cliente_nombre, servicio_id }]
 */
export const getTurnosDelDia = async (barberoId, fecha) => {
  const response = await fetch(
    `${BASE_URL}/turnos?barbero_id=${barberoId}&fecha=${fecha}`,
    { headers: publicHeaders }
  );
  if (!response.ok) throw new Error('Error al obtener los turnos del día');
  return response.json();
};

/**
 * registrarCorte
 * Envía un nuevo corte al backend para guardarlo en la base de datos.
 * Si datos incluye turno_id, el backend vincula el corte al turno y lo marca
 * como completado.
 * @param {Object} datos - { barbero_id, servicio_id, precio, forma_pago, propina, turno_id? }
 * @returns {Promise<Object>} { message, corte_id, monto_total }
 */
export const registrarCorte = async (datos) => {
  const response = await fetch(`${BASE_URL}/cortes`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify(datos),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Error al registrar el corte');
  }
  return response.json();
};

/**
 * registrarVenta
 * Envía una nueva venta al backend.
 * @param {Object} datos - { producto_id, cantidad, precio_unitario, forma_pago }
 * @returns {Promise<Object>} { message, venta_id, monto_total }
 */
export const registrarVenta = async (datos) => {
  const response = await fetch(`${BASE_URL}/ventas`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify(datos),
  });
  if (!response.ok) throw new Error('Error al registrar la venta');
  return response.json();
};

/**
 * registrarGasto
 * Envía un nuevo gasto al backend.
 * @param {Object} datos - { categoria_id, descripcion, monto, forma_pago }
 * @returns {Promise<Object>} { message, gasto_id }
 */
export const registrarGasto = async (datos) => {
  const response = await fetch(`${BASE_URL}/gastos`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify(datos),
  });
  if (!response.ok) throw new Error('Error al registrar el gasto');
  return response.json();
};

/**
 * getNegocio
 * Obtiene los datos del negocio (nombre, logo) del tenant.
 * @returns {Promise<Object>} { nombre_negocio, logo }
 */
export const getNegocio = async () => {
  const response = await fetch(`${BASE_URL}/negocio`, { headers: publicHeaders });
  if (!response.ok) throw new Error('Error al obtener datos del negocio');
  return response.json();
};

/**
 * verificarPin
 * Envía el PIN al backend para autenticación.
 * Casos:
 *   - 200: PIN correcto → devuelve { token, aviso_pago }
 *   - 402: suscripción vencida → lanza error con bloqueado: true
 *   - otros: PIN incorrecto u otro error → lanza error con bloqueado: false
 * @param {string} pin - PIN de 4 dígitos ingresado por el usuario
 * @returns {Promise<Object>} { token, aviso_pago }
 */
export const verificarPin = async (pin) => {
  const response = await fetch(`${BASE_URL}/auth/verificar-pin`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify({ pin }),
  });

  if (response.status === 402) {
    const err = new Error('Suscripción vencida');
    err.bloqueado = true;
    throw err;
  }

  if (!response.ok) throw new Error('PIN incorrecto');
  return response.json(); // { token, aviso_pago }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Turnero (gestión de turnos)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getAdminTurnos
 * Obtiene los turnos de un día. Sin barbero_id devuelve todos los barberos.
 * @param {string} fecha - 'YYYY-MM-DD'
 * @param {string|null} barberoId - filtra por barbero (null = todos)
 * @returns {Promise<Array>} Array de turnos con barbero, servicio y cliente
 */
export const getAdminTurnos = async (fecha, barberoId = null) => {
  let path = `/admin/turnos?fecha=${fecha}`;
  if (barberoId) path += `&barbero_id=${barberoId}`;
  const res = await apiFetch(path);
  if (!res.ok) throw new Error('Error al obtener turnos');
  return res.json();
};

/**
 * patchAdminTurnoEstado
 * Cambia el estado de un turno (completado / no_asistio).
 * @param {string} turnoId
 * @param {string} estado - 'completado' | 'no_asistio'
 * @returns {Promise<Object>} turno actualizado
 */
export const patchAdminTurnoEstado = async (turnoId, estado) => {
  const res = await apiFetch(`/admin/turnos/${turnoId}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Error al cambiar estado del turno');
  }
  return res.json();
};

/**
 * cancelarAdminTurno
 * Cancela un turno (DELETE lógico → estado 'cancelado').
 * @param {string} turnoId
 * @returns {Promise<Object>} turno cancelado
 */
export const cancelarAdminTurno = async (turnoId) => {
  const res = await apiFetch(`/admin/turnos/${turnoId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Error al cancelar turno');
  }
  return res.json();
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Horarios (gestión de horarios por barbero)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getAdminHorarios
 * Obtiene el horario semanal de un barbero.
 * @param {string} barberoId
 * @returns {Promise<Array>} [{ id, dia_semana, hora_inicio, hora_fin }]
 */
export const getAdminHorarios = async (barberoId) => {
  const res = await apiFetch(`/admin/horarios/${barberoId}`);
  if (!res.ok) throw new Error('Error al obtener horarios');
  return res.json();
};

/**
 * putAdminHorarios
 * Reemplaza completo el horario semanal de un barbero.
 * @param {string} barberoId
 * @param {Array} bloques - [{ dia_semana, hora_inicio, hora_fin }]
 * @returns {Promise<Array>} bloques insertados con id
 */
export const putAdminHorarios = async (barberoId, bloques) => {
  const res = await apiFetch(`/admin/horarios/${barberoId}`, {
    method: 'PUT',
    body: JSON.stringify(bloques),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al guardar horarios');
  }
  return res.json();
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Suspensiones (gestión de suspensiones por barbero)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getAdminSuspensiones
 * Obtiene suspensiones futuras de un barbero.
 * @param {string} barberoId
 * @returns {Promise<Array>} suspensiones con id, desde, hasta, motivo, origen
 */
export const getAdminSuspensiones = async (barberoId) => {
  const res = await apiFetch(`/admin/suspensiones?barbero_id=${barberoId}`);
  if (!res.ok) throw new Error('Error al obtener suspensiones');
  return res.json();
};

/**
 * crearAdminSuspension
 * Crea una suspensión para un barbero. Si hay turnos en conflicto,
 * devuelve 409 con la lista de turnos afectados.
 * Reenviar con confirmar_cancelacion: true para forzar.
 * @param {Object} datos - { barbero_id, desde, hasta, motivo?, confirmar_cancelacion? }
 * @returns {Promise<Object>} { suspension, turnos_cancelados } o { conflicto: true, turnos_afectados }
 */
export const crearAdminSuspension = async (datos) => {
  const res = await apiFetch('/admin/suspensiones', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  if (res.status === 409) {
    const body = await res.json();
    return { conflicto: true, ...body };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Error al crear suspensión');
  }
  return res.json();
};

/**
 * eliminarAdminSuspension
 * Elimina una suspensión por su id.
 * @param {string} suspensionId
 * @returns {Promise<Object>} confirmación
 */
export const eliminarAdminSuspension = async (suspensionId) => {
  const res = await apiFetch(`/admin/suspensiones/${suspensionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al eliminar suspensión');
  }
  return res.json();
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Configuración del turnero
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getAdminTurneroConfig
 * Obtiene la configuración actual del turnero (duracion_slot_minutos).
 * @returns {Promise<Object>} { duracion_slot_minutos }
 */
export const getAdminTurneroConfig = async () => {
  const res = await apiFetch('/admin/turnero/config');
  if (!res.ok) throw new Error('Error al obtener configuración del turnero');
  return res.json();
};

/**
 * putAdminTurneroConfig
 * Actualiza la configuración del turnero.
 * @param {Object} datos - { duracion_slot_minutos }
 * @returns {Promise<Object>} { duracion_slot_minutos }
 */
export const putAdminTurneroConfig = async (datos) => {
  const res = await apiFetch('/admin/turnero/config', {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al guardar configuración del turnero');
  }
  return res.json();
};