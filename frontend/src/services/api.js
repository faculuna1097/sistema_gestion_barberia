// /frontend/src/services/api.js
// Centraliza todas las llamadas HTTP al backend.
// Si la URL del backend cambia, solo se modifica este archivo.

// URL base del backend — en desarrollo apunta a localhost
const BASE_URL = "http://localhost:3001/api";

/**
 * getBarberos
 * Obtiene la lista de barberos activos del tenant.
 * @returns {Promise<Array>} Array de { id, nombre }
 */
export const getBarberos = async () => {
  const response = await fetch(`${BASE_URL}/barberos`);
  if (!response.ok) throw new Error("Error al obtener barberos");
  return response.json();
};

/**
 * getServicios
 * Obtiene la lista de servicios activos del tenant.
 * @returns {Promise<Array>} Array de { id, nombre, precio }
 */
export const getServicios = async () => {
  const response = await fetch(`${BASE_URL}/servicios`);
  if (!response.ok) throw new Error("Error al obtener servicios");
  return response.json();
};

/**
 * getProductos
 * Obtiene la lista de productos activos del tenant.
 * @returns {Promise<Array>} Array de { id, nombre, precio, stock_actual }
 */
export const getProductos = async () => {
  const response = await fetch(`${BASE_URL}/productos`);
  if (!response.ok) throw new Error("Error al obtener productos");
  return response.json();
};

/**
 * getCategorias
 * Obtiene las categorías de gasto del tenant.
 * @returns {Promise<Array>} Array de { id, nombre }
 */
export const getCategorias = async () => {
  const response = await fetch(`${BASE_URL}/categorias`);
  if (!response.ok) throw new Error("Error al obtener categorías");
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) throw new Error("Error al registrar el corte");
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) throw new Error("Error al registrar la venta");
  return response.json();
};

/**
 * registrarGasto
 * Envía un nuevo gasto al backend.
 * @param {Object} datos - { categoria_id, descripcion, monto, pagado_por }
 * @returns {Promise<Object>} { message, gasto_id }
 */
export const registrarGasto = async (datos) => {
  const response = await fetch(`${BASE_URL}/gastos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) throw new Error("Error al registrar el gasto");
  return response.json();
};