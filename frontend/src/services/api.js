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

// ─── Tokens ──────────────────────────────────────────────────────────────────
// Se manejan dos tokens distintos, uno por audiencia:
//   - authToken (admin): vive en memoria. Se setea tras el login PIN admin y se
//     pierde al refrescar la página → re-login obligatorio. Apropiado para el
//     dueño operando desde un dispositivo no dedicado.
//   - tokenOperativo: vive en memoria Y se sincroniza con localStorage para
//     sobrevivir reloads, cierres del browser y reinicios del iPad. Apropiado
//     para el iPad del local, que está siempre "logueado operativo".
//
// Cada token tiene su propio helper (apiFetch / apiFetchOperativo) que sabe
// cuál inyectar y, en el caso del operativo, cómo reaccionar a 401.

// Token admin — solo memoria.
let authToken = null;

// Token operativo — memoria + localStorage. Se hidrata desde el storage al
// cargar el módulo para no perderlo entre sesiones del navegador.
let tokenOperativo = null;
try {
  tokenOperativo = localStorage.getItem('token_operativo');
} catch (err) {
  // localStorage puede estar deshabilitado (modo privado agresivo, etc.).
  // En ese caso el operativo va a tener que re-loguearse cada vez que recargue.
  console.warn('[api] localStorage inaccesible — tokenOperativo no persistirá:', err.message);
}

// Callback que App.jsx registra para reaccionar a un 401 del operativo
// (típicamente limpiar estado y redirigir al login). Disparado desde
// apiFetchOperativo cuando el backend devuelve 401.
let onUnauthorizedOperativo = null;

/**
 * setAuthToken
 * Guarda el JWT admin en el módulo para que apiFetch() lo incluya en los headers.
 * Llamar desde App.jsx inmediatamente después del login PIN admin exitoso.
 * @param {string} token - JWT con rol='admin' recibido del backend
 */
export const setAuthToken = (token) => {
  authToken = token;
};

/**
 * clearAuthToken
 * Elimina el token admin del módulo. Llamar desde App.jsx al cerrar sesión admin.
 */
export const clearAuthToken = () => {
  authToken = null;
};

/**
 * setAuthTokenOperativo
 * Guarda el JWT del modo operativo en memoria y en localStorage para que
 * sobreviva al reload. Se llama desde loginOperativo() automáticamente;
 * también queda exportada por si App.jsx necesita rehidratar manualmente.
 * @param {string} token - JWT con rol='operativo' recibido del backend
 */
export const setAuthTokenOperativo = (token) => {
  tokenOperativo = token;
  try {
    localStorage.setItem('token_operativo', token);
  } catch (err) {
    console.warn('[api] No se pudo persistir tokenOperativo en localStorage:', err.message);
  }
};

/**
 * clearAuthTokenOperativo
 * Elimina el token operativo de memoria y de localStorage. Se llama
 * automáticamente desde apiFetchOperativo cuando recibe un 401, y también
 * desde App.jsx al hacer logout manual.
 */
export const clearAuthTokenOperativo = () => {
  tokenOperativo = null;
  try {
    localStorage.removeItem('token_operativo');
  } catch (err) {
    console.warn('[api] No se pudo limpiar tokenOperativo de localStorage:', err.message);
  }
};

/**
 * setOnUnauthorizedOperativo
 * Registra un callback que apiFetchOperativo ejecuta cuando el backend
 * devuelve 401 (token expirado, revocado o inválido). App.jsx lo usa para
 * limpiar su estado local y redirigir al login operativo.
 * @param {Function|null} fn - función sin argumentos, o null para desregistrar
 */
export const setOnUnauthorizedOperativo = (fn) => {
  onUnauthorizedOperativo = fn;
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

/**
 * apiFetchOperativo
 * Análogo a apiFetch() pero inyecta tokenOperativo en lugar de authToken.
 * Si el backend devuelve 401, limpia el token automáticamente y dispara el
 * callback registrado con setOnUnauthorizedOperativo (típicamente para
 * redirigir al login). Devuelve la Response normal para que el caller pueda
 * mostrar su propio mensaje de error antes de que ocurra la redirección.
 *
 * @param {string} path    - Path del endpoint sin BASE_URL
 * @param {Object} options - Opciones de fetch
 * @returns {Promise<Response>}
 */
export const apiFetchOperativo = async (path, options = {}) => {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(tokenOperativo ? { 'Authorization': `Bearer ${tokenOperativo}` } : {}),
    ...(subdominio ? { 'X-Tenant-Subdomain': subdominio } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    console.warn('[api] apiFetchOperativo — 401 | path:', path, '| limpiando token y notificando a la app');
    clearAuthTokenOperativo();
    if (onUnauthorizedOperativo) onUnauthorizedOperativo();
  }
  return response;
};

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS PÚBLICAS — no requieren token (datos pre-login)
// ─────────────────────────────────────────────────────────────────────────────

// (Los catálogos vivían acá hasta que se privatizaron — ahora están en la
// sección RUTAS OPERATIVAS más abajo. Pre-login solo queda /api/negocio.)

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS OPERATIVAS — requieren tokenOperativo (vía apiFetchOperativo)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getBarberosOperativo
 * Obtiene la lista de barberos activos del tenant para el modo operativo.
 * Usa tokenOperativo — pensado para precargar datos tras el login operativo.
 * SeccionTurnero del panel admin usa getBarberosAdmin() (con token admin).
 * @returns {Promise<Array>} Array de { id, nombre }
 */
export const getBarberosOperativo = async () => {
  const response = await apiFetchOperativo(`/barberos`);
  if (!response.ok) throw new Error('Error al obtener barberos');
  return response.json();
};

/**
 * getServicios
 * Obtiene la lista de servicios activos del tenant.
 * Usa tokenOperativo — solo lo consume precargarDatos() del modo operativo.
 * @returns {Promise<Array>} Array de { id, nombre, precio }
 */
export const getServicios = async () => {
  const response = await apiFetchOperativo(`/servicios`);
  if (!response.ok) throw new Error('Error al obtener servicios');
  return response.json();
};

/**
 * getProductos
 * Obtiene la lista de productos activos del tenant.
 * Usa tokenOperativo — solo lo consume precargarDatos() (FlujoVenta).
 * @returns {Promise<Array>} Array de { id, nombre, precio, stock_actual }
 */
export const getProductos = async () => {
  const response = await apiFetchOperativo(`/productos`);
  if (!response.ok) throw new Error('Error al obtener productos');
  return response.json();
};

/**
 * getCategorias
 * Obtiene las categorías de gasto del tenant.
 * Usa tokenOperativo — solo lo consume precargarDatos() (FlujoGasto).
 * @returns {Promise<Array>} Array de { id, nombre }
 */
export const getCategorias = async () => {
  const response = await apiFetchOperativo(`/categorias`);
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
  const response = await apiFetchOperativo(
    `/turnos?barbero_id=${barberoId}&fecha=${fecha}`
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
  const response = await apiFetchOperativo('/cortes', {
    method: 'POST',
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
  const response = await apiFetchOperativo('/ventas', {
    method: 'POST',
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
  const response = await apiFetchOperativo('/gastos', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  if (!response.ok) throw new Error('Error al registrar el gasto');
  return response.json();
};

/**
 * getNegocio
 * Obtiene los datos del negocio (nombre, booking_url) del tenant.
 * @returns {Promise<Object>} { nombre_negocio, booking_url }
 *
 * El logo no viaja en esta respuesta: se lee desde getImagenesNegocio()
 * (tenant_imagen tipo='logo').
 */
export const getNegocio = async () => {
  const response = await fetch(`${BASE_URL}/negocio`, { headers: publicHeaders });
  if (!response.ok) throw new Error('Error al obtener datos del negocio');
  return response.json();
};

/**
 * getImagenesNegocio
 * Obtiene las imágenes públicas del tenant (logo, fotos del local, cortes).
 * Endpoint público — no requiere token. El backend devuelve la URL pública ya armada.
 * @returns {Promise<Array>} [{ id, tipo: 'local'|'corte'|'logo', orden, url }]
 */
export const getImagenesNegocio = async () => {
  const response = await fetch(`${BASE_URL}/negocio/imagenes`, { headers: publicHeaders });
  if (!response.ok) throw new Error('Error al obtener imágenes del negocio');
  return response.json();
};

/**
 * loginAdmin
 * Envía el PIN al backend para autenticación del admin.
 * Casos:
 *   - 200: PIN correcto → devuelve { token, aviso_pago }
 *   - 402: suscripción vencida → lanza error con bloqueado: true
 *   - otros: PIN incorrecto u otro error → lanza error con bloqueado: false
 * @param {string} pin - PIN de 4 dígitos ingresado por el usuario
 * @returns {Promise<Object>} { token, aviso_pago }
 */
export const loginAdmin = async (pin) => {
  const response = await fetch(`${BASE_URL}/auth/admin/login`, {
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

/**
 * loginOperativo
 * Autentica al modo operativo con usuario + password contra el endpoint
 * /api/auth/operativo/login. Si las credenciales son correctas, guarda el
 * JWT en memoria y en localStorage (vía setAuthTokenOperativo) y devuelve
 * el token. Si son incorrectas, lanza un Error.
 *
 * @param {string} usuario
 * @param {string} password
 * @returns {Promise<string>} el JWT recibido
 */
export const loginOperativo = async (usuario, password) => {
  const response = await fetch(`${BASE_URL}/auth/operativo/login`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify({ usuario, password }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Credenciales inválidas');
  }
  const { token } = await response.json();
  setAuthTokenOperativo(token);
  return token;
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Turnero (gestión de turnos)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getBarberosAdmin
 * Obtiene la lista de barberos activos del tenant usando el token admin.
 * Lo consume SeccionTurnero del panel para poblar el selector de barberos.
 * El equivalente operativo es getBarberosOperativo() (más arriba).
 * @returns {Promise<Array>} Array de { id, nombre }
 */
export const getBarberosAdmin = async () => {
  const res = await apiFetch('/barberos');
  if (!res.ok) throw new Error('Error al obtener barberos');
  return res.json();
};

/**
 * getServiciosAdmin
 * Obtiene los servicios del tenant usando el token admin. SeccionTurnero lo
 * consume para derivar el precio de un turno al completarlo (mapea
 * servicio_id → precio, ya que /admin/turnos no trae el precio).
 * El equivalente operativo es getServicios() (apiFetchOperativo, más arriba).
 * @returns {Promise<Array>} Array de { id, nombre, precio, activo }
 */
export const getServiciosAdmin = async () => {
  const res = await apiFetch('/admin/servicios');
  if (!res.ok) throw new Error('Error al obtener servicios');
  return res.json();
};

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
 * completarAdminTurno
 * Completa un turno reservado desde el backoffice REGISTRANDO el corte
 * (forma de pago + monto). Reemplaza a patchAdminTurnoEstado(id, 'completado')
 * para este caso: aquel solo cambiaba el estado y NO dejaba registro financiero
 * (el turno quedaba completado sin corte → sin forma_pago ni impacto en Caja).
 * El backend deriva barbero/servicio del propio turno (autoritativo); el front
 * solo aporta forma_pago, precio y propina.
 * @param {string} turnoId
 * @param {Object} datos - { forma_pago: 'efectivo'|'mercado_pago', precio: number>=0, propina?: number>=0, servicio_id?: string }
 *   servicio_id es opcional: si se manda, el corte se registra con ese servicio y
 *   el turno se sincroniza a él; si se omite, el backend deriva el servicio del turno.
 * @returns {Promise<Object>} { id, estado: 'completado', servicio_id, corte_id, monto_total }
 */
export const completarAdminTurno = async (turnoId, datos) => {
  const res = await apiFetch(`/admin/turnos/${turnoId}/completar`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al completar el turno');
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
// ADMIN — Credenciales del modo operativo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getCredencialesOperativas
 * Obtiene el usuario operativo actual del tenant. Solo el usuario — la
 * password nunca se devuelve (bcrypt es one-way).
 * @returns {Promise<{ usuario: string|null }>}
 */
export const getCredencialesOperativas = async () => {
  const res = await apiFetch('/admin/operativo/credenciales');
  if (!res.ok) throw new Error('Error al obtener credenciales operativas');
  return res.json();
};

/**
 * actualizarCredencialesOperativas
 * Actualiza usuario y/o password del modo operativo. Cualquiera de los dos
 * campos es opcional; enviar solo lo que se quiere cambiar.
 * @param {Object} datos - { usuario?: string, password?: string }
 * @returns {Promise<void>}
 */
export const actualizarCredencialesOperativas = async (datos) => {
  const res = await apiFetch('/admin/operativo/credenciales', {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al actualizar credenciales operativas');
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Imágenes del negocio (fotos del local, cortes de ejemplo, logos)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getImagenesAdmin
 * Obtiene todas las imágenes del tenant para administrarlas en el panel.
 * @returns {Promise<Array>} [{ id, tipo, orden, url }]
 */
export const getImagenesAdmin = async () => {
  const res = await apiFetch('/admin/imagenes');
  if (!res.ok) throw new Error('Error al obtener las imágenes');
  return res.json();
};

/**
 * subirImagen
 * Sube (o reemplaza) la imagen de un slot. El blob ya viene comprimido a WebP
 * desde el componente; se envía como binario crudo, no como JSON.
 * @param {string} tipo - 'local' | 'corte' | 'logo'
 * @param {number} orden - slot dentro del tipo
 * @param {Blob} blob - imagen WebP ya comprimida
 * @returns {Promise<Object>} { id, tipo, orden, url }
 */
export const subirImagen = async (tipo, orden, blob) => {
  const res = await apiFetch(`/admin/imagenes?tipo=${tipo}&orden=${orden}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/webp' },
    body: blob,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al subir la imagen');
  }
  return res.json();
};

/**
 * eliminarImagen
 * Borra una imagen (la fila y el archivo de Storage).
 * @param {string} id - UUID de la imagen
 * @returns {Promise<Object>} { ok: true }
 */
export const eliminarImagen = async (id) => {
  const res = await apiFetch(`/admin/imagenes/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al eliminar la imagen');
  }
  return res.json();
};