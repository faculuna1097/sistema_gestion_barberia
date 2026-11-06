// /frontend-turnero/src/utils/errores.js
// Texto que ve el cliente cuando falla un pedido a la API. Lo comparten la
// reserva ("Confirmá tu turno") y la gestión del turno.

/**
 * TEXTO_SIN_CONEXION
 * Texto cuando el pedido no llega al backend (sin conexión, timeout): el
 * mensaje del navegador ("Failed to fetch") no le dice nada al cliente.
 */
export const TEXTO_SIN_CONEXION = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';

/**
 * TEXTO_DEMASIADOS_INTENTOS
 * Texto de un 429 (el backend limita las reservas por IP: 3 por minuto y 10
 * por hora). Es del turnero y no depende del cuerpo de la respuesta: si el 429
 * llega sin JSON (ej. de un proxy), igual se dice qué hacer.
 */
export const TEXTO_DEMASIADOS_INTENTOS = 'Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.';

/**
 * mensajeDeError
 * Elige el texto de un error de la API para mostrarlo: el del backend si el
 * pedido llegó (el error trae `status`, ver services/api.js), o el de sin
 * conexión si no llegó.
 * @param {Error} err - Error lanzado por una función de services/api.js
 * @returns {string}
 */
export function mensajeDeError(err) {
  return err.status ? err.message : TEXTO_SIN_CONEXION;
}

// ─── Carga del local: el turnero entero no se puede usar ────────────────────
// Lo lee el cliente de la barbería, así que no habla de la suscripción del
// local: dice qué puede hacer él. Los `codigo` los manda tenantMiddleware.

// 400 sin subdominio: solo le pasa a quien abre el turnero desde la URL de
// Vercel o una IP (en la práctica, nosotros). Por eso es técnico y explícito.
const TEXTO_TENANT_NO_IDENTIFICADO =
  'No llegó el subdominio del local: la página se abrió desde una dirección que no es <local>.barbermanager.app (por ejemplo, la URL de Vercel o una IP), y el servidor no sabe de qué local es. Abrila desde la dirección del local.';
// 404: subdominio mal escrito, link viejo o local dado de baja.
const TEXTO_TENANT_NO_ENCONTRADO =
  'No encontramos este local. Revisá que el link esté bien escrito, o pedile al local su link de reservas.';
// 500: el backend respondió, pero algo falló adentro.
const TEXTO_ERROR_INTERNO =
  'Hubo un error en el sistema de reservas. Probá de nuevo en unos minutos.';
// 502/503/504, o sin respuesta con red (ver diagnosticarSinRespuesta): el
// backend no responde (caído o reiniciando) y contesta el proxy.
const TEXTO_SERVIDOR_CAIDO =
  'El sistema de reservas no está respondiendo. Probá de nuevo en unos minutos.';

/**
 * mensajeDeCargaDelLocal
 * Texto del error cuando falla la carga de los datos del local, el primer
 * pedido del turnero: dice si el link apunta a un local que no existe, si el
 * servidor falla o no responde, o si no hay conexión.
 * @param {Error} err - Error de getTenant: trae `status` y `codigo` si el
 *   pedido llegó, o es un ErrorSinRespuesta con su `causa` si no llegó (ver
 *   services/api.js)
 * @param {string} generico - Para cualquier otra respuesta del servidor
 * @returns {string}
 */
export function mensajeDeCargaDelLocal(err, generico) {
  if (err instanceof ErrorSinRespuesta && err.causa === CAUSA_SERVIDOR_CAIDO) return TEXTO_SERVIDOR_CAIDO;
  if (!err.status) return TEXTO_SIN_CONEXION;
  if (err.codigo === 'tenant_no_identificado') return TEXTO_TENANT_NO_IDENTIFICADO;
  if (err.codigo === 'tenant_no_encontrado') return TEXTO_TENANT_NO_ENCONTRADO;
  if (err.status === 500) return TEXTO_ERROR_INTERNO;
  if (err.status > 500) return TEXTO_SERVIDOR_CAIDO;
  return generico;
}

// ─── Pedidos sin respuesta: ¿sin red o servidor caído? ──────────────────────
// Cuando un pedido no recibe respuesta, el navegador da el mismo TypeError
// ("Failed to fetch") sin red y con el backend caído. Con el backend caído,
// el proxy de Railway contesta un 502 sin headers CORS; el navegador bloquea
// el preflight y lo reporta igual que una falta de red. Para distinguirlos se
// prueba /api/health dos veces, en paralelo:
//   1. Un GET simple (sin headers propios, no dispara preflight). Si responde,
//      el backend está vivo y la falla fue pasajera.
//   2. Un GET `no-cors`: la respuesta es opaca, pero llega aunque no tenga
//      CORS. Si el primero falló y este llega, hay red y lo que no responde es
//      el servidor. Si tampoco llega, no hay red.
// Solo corre cuando algo ya falló: no suma pedidos en el camino normal.

export const CAUSA_SERVIDOR_CAIDO = 'servidor_caido';
export const CAUSA_SIN_RED = 'sin_red';
export const CAUSA_PASAJERA = 'pasajera';

// Tope de cada prueba: un servidor colgado no deja la pantalla esperando.
const TIMEOUT_DIAGNOSTICO_MS = 5000;

/**
 * ErrorSinRespuesta
 * Error de un pedido que no recibió respuesta del servidor. `causa` dice qué
 * encontró `diagnosticarSinRespuesta`.
 */
export class ErrorSinRespuesta extends Error {
  /**
   * @param {string} causa - CAUSA_SERVIDOR_CAIDO | CAUSA_SIN_RED | CAUSA_PASAJERA
   */
  constructor(causa) {
    super(`Sin respuesta del servidor | causa: ${causa}`);
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
 * @returns {Promise<string>} CAUSA_SERVIDOR_CAIDO, CAUSA_SIN_RED o
 *   CAUSA_PASAJERA (el backend responde: el pedido original falló por otra cosa)
 */
export async function diagnosticarSinRespuesta(urlHealth) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return CAUSA_SIN_RED;
  // Las dos pruebas salen juntas: el diagnóstico tarda lo que la más lenta, no
  // la suma (sin red, cada una puede tardar hasta el tope).
  const [conCors, sinCors] = await Promise.allSettled([
    pedirConTope(urlHealth, {}),
    pedirConTope(urlHealth, { mode: 'no-cors' }),
  ]);
  if (conCors.status === 'fulfilled') {
    return conCors.value.ok ? CAUSA_PASAJERA : CAUSA_SERVIDOR_CAIDO;
  }
  // La prueba con CORS falló: si la opaca llegó, hay red y el servidor no
  // responde; si tampoco llegó, no hay red.
  return sinCors.status === 'fulfilled' ? CAUSA_SERVIDOR_CAIDO : CAUSA_SIN_RED;
}

/**
 * fetchConDiagnostico
 * fetch que, si el pedido no recibe respuesta, diagnostica la causa y lanza un
 * ErrorSinRespuesta. Con respuesta (aunque sea un error HTTP) devuelve la
 * Response igual que fetch.
 * @param {string} url - URL del pedido
 * @param {Object} opciones - opciones de fetch
 * @param {string} urlHealth - URL absoluta de GET /api/health
 * @returns {Promise<Response>}
 * @throws {ErrorSinRespuesta}
 */
export async function fetchConDiagnostico(url, opciones, urlHealth) {
  try {
    return await fetch(url, opciones);
  } catch {
    throw new ErrorSinRespuesta(await diagnosticarSinRespuesta(urlHealth));
  }
}
