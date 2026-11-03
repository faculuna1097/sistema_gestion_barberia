// /frontend/src/utils/errores.js
// Mensajes de error para el usuario a partir de una respuesta fallida.
//
// Por qué existe: si un handler muestra `err.message` tal cual, el usuario ve
// textos técnicos en inglés cuando el error no viene del servidor: "Failed to
// fetch" sin red, o el texto del parser cuando la respuesta no es JSON (un 502
// del proxy). Acá se separa el mensaje del backend ({ error }, que ya está en
// español y es para el usuario) de cualquier otro error, que se reemplaza por
// un mensaje genérico en español.

/**
 * ErrorServidor
 * Error de una respuesta del backend. Su `message` es el `error` que mandó el
 * servidor, o '' si la respuesta no traía uno.
 */
export class ErrorServidor extends Error {
  /**
   * @param {string} mensaje - Texto del backend para el usuario ('' si no vino)
   * @param {number} status - Status HTTP de la respuesta
   */
  constructor(mensaje, status) {
    super(mensaje);
    this.name = 'ErrorServidor';
    this.status = status;
  }
}

/**
 * errorDeRespuesta
 * Lee el cuerpo de una respuesta fallida (`!res.ok`) y arma el error para
 * lanzar. Si el cuerpo no es JSON o no trae `error`, el mensaje queda vacío y
 * `mensajeDeError` muestra el genérico.
 * @param {Response} res - La respuesta de apiFetch
 * @returns {Promise<ErrorServidor>} El error, listo para `throw`
 */
export async function errorDeRespuesta(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Cuerpo que no es JSON (ej. la página HTML de un 502): queda sin mensaje.
  }
  return new ErrorServidor(typeof data?.error === 'string' ? data.error : '', res.status);
}

/**
 * mensajeDeError
 * Elige el texto que ve el usuario: el del servidor si vino, si no el genérico.
 * @param {unknown} err - Lo que atrapó el `catch`
 * @param {string} generico - Mensaje en español para cualquier otro caso (sin
 *   red, respuesta que no es JSON, error sin texto). Ej.: "No se pudo editar el
 *   gasto. Intentá de nuevo."
 * @returns {string}
 */
export function mensajeDeError(err, generico) {
  return err instanceof ErrorServidor && err.message ? err.message : generico;
}

/**
 * motivoYQueHacer
 * Une el motivo de un error (el texto del servidor) con lo que tiene que hacer
 * el usuario, con un punto entre los dos.
 * @param {string} motivo - Ej.: "Stock insuficiente. Disponible: 2"
 * @param {string} queHacer - Ej.: "Volvé al inicio y empezá de nuevo."
 * @returns {string} Ej.: "Stock insuficiente. Disponible: 2. Volvé al inicio y empezá de nuevo."
 */
export function motivoYQueHacer(motivo, queHacer) {
  const conPunto = motivo.endsWith('.') ? motivo : `${motivo}.`;
  return `${conPunto} ${queHacer}`;
}

/**
 * mensajeErrorRegistro
 * Texto del error al confirmar una venta o un gasto en el iPad. Un 4xx no se
 * arregla reintentando: el caso real es "Stock insuficiente. Disponible: N",
 * cuando el catálogo del iPad quedó viejo. Va el motivo del servidor y que
 * vuelva al inicio, que recarga los productos con el stock real. Sin red, con
 * un 5xx o sin texto del servidor, va el genérico: reintentar puede servir.
 * @param {unknown} err - Lo que atrapó el `catch` (un `ErrorServidor` si llegó respuesta)
 * @param {string} generico - Ej.: "Error al guardar la venta. Intentá de nuevo."
 * @returns {string}
 */
export function mensajeErrorRegistro(err, generico) {
  const motivo = mensajeDeError(err, '');
  const esDelCliente = err?.status >= 400 && err?.status < 500;
  return esDelCliente && motivo
    ? motivoYQueHacer(motivo, 'Volvé al inicio y empezá de nuevo.')
    : generico;
}
