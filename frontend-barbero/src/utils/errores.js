// /frontend-barbero/src/utils/errores.js
// Mensajes de error para el usuario a partir de una respuesta fallida. Copia
// de /frontend/src/utils/errores.js (los fronts no comparten código), con lo que
// usa esta app: hoy, el login (lista de barberos y PIN).
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
   * @param {string|null} [codigo] - `codigo` del backend, para distinguir un
   *   caso sin comparar textos (ej. 'tenant_no_encontrado'); null si no vino
   */
  constructor(mensaje, status, codigo = null) {
    super(mensaje);
    this.name = 'ErrorServidor';
    this.status = status;
    this.codigo = codigo;
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
  return new ErrorServidor(
    typeof data?.error === 'string' ? data.error : '',
    res.status,
    typeof data?.codigo === 'string' ? data.codigo : null,
  );
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

// ─── Fallas de acceso: el sistema entero no se puede usar ───────────────────
// Antes, cualquier falla del login se mostraba como "PIN incorrecto": un
// subdominio que no existe, un rate limit o el backend caído se leían como un
// problema de credenciales, y no había forma de saber qué pasaba mirando la
// pantalla. Estos mensajes dicen la causa real. Los `codigo` los manda
// tenantMiddleware (backend).

const CODIGO_TENANT_NO_IDENTIFICADO = 'tenant_no_identificado';
const CODIGO_TENANT_NO_ENCONTRADO = 'tenant_no_encontrado';

// 400 sin subdominio: solo le pasa a quien abre el sistema desde la URL de
// Vercel o una IP (en la práctica, nosotros). Por eso es técnico y explícito.
const MENSAJE_TENANT_NO_IDENTIFICADO =
  'No llegó el subdominio del local: la página se abrió desde una dirección que no es <local>.barbermanager.app (por ejemplo, la URL de Vercel o una IP), y el servidor no sabe de qué local es. Abrila desde la dirección del local.';
// 404: subdominio mal escrito o tenant dado de baja (inactivo). A diferencia
// del panel, acá lo lee un barbero: quien resuelve la baja es el dueño.
const MENSAJE_TENANT_NO_ENCONTRADO =
  'No hay un local activo en esta dirección. Revisá que esté bien escrita. Si es la dirección de tu local, el acceso al sistema fue dado de baja: avisale al dueño.';
// 500: el backend respondió, pero algo falló adentro (entró a un catch).
const MENSAJE_ERROR_INTERNO =
  'Hubo un error en el servidor. Probá de nuevo en unos minutos; si sigue pasando, avisale al dueño.';
// 502/503/504, o sin respuesta con red (ver diagnosticarSinRespuesta): el
// backend no responde (caído o reiniciando) y contesta el proxy de Railway.
const MENSAJE_SERVIDOR_CAIDO =
  'El servidor no está respondiendo. Probá de nuevo en unos minutos.';

/**
 * problemaDeAcceso
 * Dice si un error impide usar el sistema entero (no solo una acción): el
 * subdominio no corresponde a un local, o el servidor falla o no responde.
 * Si el pedido no recibió respuesta, usa lo que encontró
 * `diagnosticarSinRespuesta`: servidor caído da su mensaje; sin red o una
 * falla pasajera devuelven null, y cada pantalla muestra su genérico.
 * @param {unknown} err - Lo que atrapó el `catch`
 * @returns {string|null} El mensaje para el usuario; null si no es una falla
 *   de acceso.
 */
export function problemaDeAcceso(err) {
  if (err instanceof ErrorSinRespuesta) {
    return err.causa === CAUSA_SERVIDOR_CAIDO ? MENSAJE_SERVIDOR_CAIDO : null;
  }
  if (!(err instanceof ErrorServidor)) return null;
  if (err.codigo === CODIGO_TENANT_NO_IDENTIFICADO) {
    return MENSAJE_TENANT_NO_IDENTIFICADO;
  }
  if (err.codigo === CODIGO_TENANT_NO_ENCONTRADO) {
    return MENSAJE_TENANT_NO_ENCONTRADO;
  }
  if (err.status === 500) return MENSAJE_ERROR_INTERNO;
  if (err.status > 500) return MENSAJE_SERVIDOR_CAIDO;
  return null;
}

/**
 * fallaDeLogin
 * Elige qué decirle al usuario cuando falla un login. El mensaje de
 * credenciales queda reservado para el 401, que es el único caso en que el
 * problema es lo que tipeó. El 429 (demasiados intentos) muestra el texto del
 * servidor. El login del barbero no tiene 402: la suscripción no lo bloquea.
 * @param {unknown} err - Lo que atrapó el `catch`
 * @param {string} mensajeCredenciales - Qué decir ante un 401 (ej. "PIN
 *   incorrecto. Intentá de nuevo.")
 * @param {string} generico - Sin red, o sin texto del servidor
 * @returns {string} El mensaje para el usuario
 */
export function fallaDeLogin(err, mensajeCredenciales, generico) {
  const problema = problemaDeAcceso(err);
  if (problema) return problema;
  if (err instanceof ErrorServidor && err.status === 401) return mensajeCredenciales;
  return mensajeDeError(err, generico);
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
