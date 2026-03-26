// /frontend/src/services/api.js
// Centraliza todas las llamadas HTTP al backend.
// Si la URL del backend cambia, solo se modifica este archivo.
//
// ─── MANEJO DE TOKEN ──────────────────────────────────────────────────────────
// El token JWT se guarda en este módulo con setAuthToken() luego del login.
// Las funciones de rutas protegidas lo leen automáticamente vía apiFetch().
// Las funciones de rutas públicas usan fetch() directamente (sin header).

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:3001/api';

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
 * Wrapper sobre fetch() que agrega automáticamente el header Authorization
 * cuando hay un token disponible. Usar en todos los componentes del panel admin
 * en reemplazo del fetch() directo.
 *
 * Uso idéntico a fetch():
 *   apiFetch(`${API_URL}/api/caja/movimientos-dia`)
 *   apiFetch(`${API_URL}/api/gastos/${id}`, { method: 'DELETE' })
 *
 * @param {string} url     - URL completa del endpoint
 * @param {Object} options - Opciones de fetch (method, body, etc.) — opcional
 * @returns {Promise<Response>} La misma Response que devuelve fetch()
 */
export const apiFetch = (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
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
  const response = await fetch(`${BASE_URL}/barberos`);
  if (!response.ok) throw new Error('Error al obtener barberos');
  return response.json();
};

/**
 * getServicios
 * Obtiene la lista de servicios activos del tenant.
 * @returns {Promise<Array>} Array de { id, nombre, precio }
 */
export const getServicios = async () => {
  const response = await fetch(`${BASE_URL}/servicios`);
  if (!response.ok) throw new Error('Error al obtener servicios');
  return response.json();
};

/**
 * getProductos
 * Obtiene la lista de productos activos del tenant.
 * @returns {Promise<Array>} Array de { id, nombre, precio, stock_actual }
 */
export const getProductos = async () => {
  const response = await fetch(`${BASE_URL}/productos`);
  if (!response.ok) throw new Error('Error al obtener productos');
  return response.json();
};

/**
 * getCategorias
 * Obtiene las categorías de gasto del tenant.
 * @returns {Promise<Array>} Array de { id, nombre }
 */
export const getCategorias = async () => {
  const response = await fetch(`${BASE_URL}/categorias`);
  if (!response.ok) throw new Error('Error al obtener categorías');
  return response.json();
};

/**
 * registrarCorte
 * Envía un nuevo corte al backend para guardarlo en la base de datos.
 * @param {Object} datos - { barbero_id, servicios, forma_pago, propina }
 * @returns {Promise<Object>} { message, corte_id, monto_total }
 */
export const registrarCorte = async (datos) => {
  const response = await fetch(`${BASE_URL}/cortes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  if (!response.ok) throw new Error('Error al registrar el corte');
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
  const response = await fetch(`${BASE_URL}/gestion/negocio`);
  if (!response.ok) throw new Error('Error al obtener datos del negocio');
  return response.json();
};

/**
 * verificarPin
 * Envía el PIN al backend para autenticación. Devuelve un JWT si es correcto.
 * @param {string} pin - PIN de 4 dígitos ingresado por el usuario
 * @returns {Promise<Object>} { token }
 */
export const verificarPin = async (pin) => {
  const response = await fetch(`${BASE_URL}/auth/verificar-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!response.ok) throw new Error('PIN incorrecto');
  return response.json();
};