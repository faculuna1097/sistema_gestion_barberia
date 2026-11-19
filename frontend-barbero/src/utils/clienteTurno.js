// /frontend-barbero/src/utils/clienteTurno.js
// El valor de SelectorCliente (components/cliente/) y cómo se convierte para la
// API. Sin React: lo usan el alta de turno y "Asignar cliente".

// Valor inicial: ningún cliente elegido y el formulario de cliente nuevo vacío.
export const CLIENTE_VACIO = { cliente: null, nombre: '', telefono: '', email: '' };

/**
 * datosClienteParaApi
 * Convierte el valor del selector en la parte del body que lleva el cliente, para
 * POST /admin/turnos y PATCH /admin/turnos/:id/cliente.
 * @param {typeof CLIENTE_VACIO} valor
 * @returns {Object|null} { cliente_id } si eligió uno existente; { nombre,
 *   telefono?, email? } si cargó uno nuevo; null si todavía no alcanza (sin
 *   cliente elegido y sin nombre)
 */
export function datosClienteParaApi(valor) {
  if (valor.cliente) return { cliente_id: valor.cliente.id };
  const nombre = valor.nombre.trim();
  if (!nombre) return null;
  const telefono = valor.telefono.trim();
  const email = valor.email.trim();
  return {
    nombre,
    ...(telefono ? { telefono } : {}),
    ...(email ? { email } : {}),
  };
}

/**
 * nombreDelCliente
 * El nombre que muestra el valor del selector: el del cliente elegido o el que se
 * está cargando.
 * @param {typeof CLIENTE_VACIO} valor
 * @returns {string|null} null si no hay ninguno
 */
export function nombreDelCliente(valor) {
  if (valor.cliente) return valor.cliente.nombre || null;
  return valor.nombre.trim() || null;
}
