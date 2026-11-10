// /frontend-alta/src/utils/errores.js
// Errores de los pedidos a la API: la forma del error que lanza services/api.js
// y el texto que ve el cliente cuando algo falla.
// Toma de frontend-turnero/src/utils/errores.js el texto de sin conexión y el
// diagnóstico de un pedido sin respuesta (¿sin red o servidor caído?), que acá
// usa solo la carga del formulario.

/**
 * CODIGOS
 * Los `codigo` que manda el backend de /api/alta (controllers/alta.js), para
 * distinguir un caso sin comparar textos.
 */
export const CODIGOS = {
  NO_ENCONTRADA: 'solicitud_no_encontrada', // 404: no existe o venció
  YA_ENVIADA: 'solicitud_ya_enviada',       // 409: ya no está en borrador
  DATOS_INVALIDOS: 'datos_invalidos',       // 400 del envío, con `errores`
  FORMATO_INVALIDO: 'formato_invalido',     // 400: `datos` no es un objeto
};

/**
 * TEXTO_SIN_CONEXION
 * Texto cuando el pedido no llega al backend (sin conexión, timeout): el
 * mensaje del navegador ("Failed to fetch") no le dice nada al cliente.
 */
export const TEXTO_SIN_CONEXION = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';

/**
 * TEXTO_SERVIDOR_CAIDO
 * Texto cuando hay red pero el backend no responde (caído o reiniciando).
 */
export const TEXTO_SERVIDOR_CAIDO = 'El sistema no está respondiendo. Probá de nuevo en unos minutos.';

/**
 * TEXTO_DEMASIADOS_INTENTOS
 * Texto de un 429. No depende del cuerpo de la respuesta: si el 429 llega sin
 * JSON (ej. de un proxy), igual se dice qué hacer.
 */
export const TEXTO_DEMASIADOS_INTENTOS = 'Hiciste muchos pedidos seguidos. Esperá unos minutos y probá de nuevo.';

/**
 * TEXTO_RESPUESTA_INESPERADA
 * Texto de una respuesta de error sin `error` en el cuerpo (ej. un 413 de un
 * body demasiado grande, que express.json responde en HTML).
 */
export const TEXTO_RESPUESTA_INESPERADA = 'Algo falló de nuestro lado. Probá de nuevo en un rato.';

/**
 * ErrorApi
 * Error de un pedido que llegó al backend y volvió con un status de error.
 * Conserva lo que mandó el backend, para decidir sin comparar textos.
 */
export class ErrorApi extends Error {
  /**
   * @param {Object} datos
   * @param {number} datos.status - Status HTTP
   * @param {string} datos.mensaje - Texto para el cliente (`error` del backend o uno propio)
   * @param {string|null} [datos.codigo] - `codigo` del backend (ver CODIGOS)
   * @param {Array<{campo: string, mensaje: string}>|null} [datos.errores] - Errores por campo (400 datos_invalidos)
   */
  constructor({ status, mensaje, codigo = null, errores = null }) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.codigo = codigo;
    this.errores = errores;
  }
}

// ─── Pedidos sin respuesta: ¿sin red o servidor caído? ──────────────────────
// Igual que en el turnero: sin red y con el backend caído, el navegador da el
// mismo TypeError. Con el backend caído, el proxy de Railway contesta un 502 sin
// headers CORS y el navegador lo reporta igual que una falta de red. Para
// distinguirlos se prueba /api/health dos veces, en paralelo: un GET normal (si
// responde, la falla fue pasajera) y uno `no-cors` (si llega y el otro no, hay
// red y lo que no responde es el servidor). Solo corre cuando algo ya falló.

export const CAUSA_SERVIDOR_CAIDO = 'servidor_caido';
export const CAUSA_SIN_RED = 'sin_red';
export const CAUSA_PASAJERA = 'pasajera';

// Tope de cada prueba: un servidor colgado no deja la pantalla esperando.
const TIMEOUT_DIAGNOSTICO_MS = 5000;

/**
 * ErrorSinRespuesta
 * Error de un pedido que no recibió respuesta del servidor. No tiene `status`.
 * `causa` dice qué encontró `diagnosticarSinRespuesta` (o null si no se diagnosticó).
 */
export class ErrorSinRespuesta extends Error {
  /**
   * @param {string|null} causa - CAUSA_SERVIDOR_CAIDO | CAUSA_SIN_RED | CAUSA_PASAJERA | null
   */
  constructor(causa = null) {
    super(causa === CAUSA_SERVIDOR_CAIDO ? TEXTO_SERVIDOR_CAIDO : TEXTO_SIN_CONEXION);
    this.name = 'ErrorSinRespuesta';
    this.causa = causa;
  }
}

/**
 * pedirConTope (interna)
 * fetch que se corta a los TIMEOUT_DIAGNOSTICO_MS.
 * @param {string} url
 * @param {Object} opciones - opciones de fetch
 * @returns {Promise<Response>} rechaza si no hay respuesta o se pasa del tope
 */
async function pedirConTope(url, opciones) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_DIAGNOSTICO_MS);
  try {
    return await fetch(url, { ...opciones, cache: 'no-store', signal: control.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * diagnosticarSinRespuesta
 * Averigua por qué un pedido no recibió respuesta (ver el bloque de arriba).
 * @param {string} urlHealth - URL absoluta de GET /api/health
 * @returns {Promise<string>} CAUSA_SERVIDOR_CAIDO, CAUSA_SIN_RED o CAUSA_PASAJERA
 */
export async function diagnosticarSinRespuesta(urlHealth) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return CAUSA_SIN_RED;
  const [conCors, sinCors] = await Promise.allSettled([
    pedirConTope(urlHealth, {}),
    pedirConTope(urlHealth, { mode: 'no-cors' }),
  ]);
  if (conCors.status === 'fulfilled') {
    return conCors.value.ok ? CAUSA_PASAJERA : CAUSA_SERVIDOR_CAIDO;
  }
  return sinCors.status === 'fulfilled' ? CAUSA_SERVIDOR_CAIDO : CAUSA_SIN_RED;
}

/**
 * mensajeDeError
 * Elige el texto de un error de la API para mostrarlo: el del backend si el
 * pedido llegó, o el de sin conexión (o servidor caído) si no llegó. Nunca el
 * `err.message` crudo del navegador.
 * @param {Error} err - Error lanzado por una función de services/api.js
 * @returns {string}
 */
export function mensajeDeError(err) {
  if (err instanceof ErrorApi || err instanceof ErrorSinRespuesta) return err.message;
  return TEXTO_SIN_CONEXION;
}
