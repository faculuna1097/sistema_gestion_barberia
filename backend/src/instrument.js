// /backend/src/instrument.js
// Inicialización de Sentry (errores de la app en producción). Se carga ANTES que
// todo el resto:
//   - web service: node --import ./src/instrument.js src/index.js (en ESM, Sentry
//     tiene que cargarse antes que Express para instrumentarlo y separar el
//     contexto de cada request);
//   - jobs de cron: primer import del archivo del job (sin --import).
//
// Sin SENTRY_DSN no inicializa nada y el backend se comporta igual que sin
// Sentry (local, scripts). Una falla de Sentry nunca tumba el arranque.
//
// Qué llega a Sentry: todo console.error (captureConsoleIntegration; si uno de
// los argumentos es un Error, sale como excepción con su stack), los errores que
// escapan de un handler de Express, las excepciones no atrapadas y los avisos
// explícitos de config/sentry.js (cortes del rate limiter).
//
// Privacidad (docs/plan_monitoreo_prod.md, decisión 7b): el tenant va como tag;
// los datos personales no. En @sentry/node v11 lo que se recolecta lo controla
// `dataCollection` (si no se configura, junta TODO: bodies, cookies, headers,
// IP, parámetros de queries). Se apaga todo ahí y, como segunda red, beforeSend
// limpia cada evento antes de mandarlo. Los breadcrumbs van apagados: traerían
// las últimas líneas de log (bodies de reservas, nombres de clientes del job).
//
// Ningún otro archivo importa @sentry/node salvo config/sentry.js (el helper
// que usa el resto del backend).

import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { rutaSinDatosSensibles } from './utils/sanitizarLogs.js';

// Únicos headers del request que viajan a Sentry. Todo lo demás (authorization,
// cookie, x-forwarded-for, x-real-ip, x-platform-key, etc.) se descarta.
const HEADERS_PERMITIDOS = ['x-tenant-subdomain', 'user-agent', 'content-type'];

/**
 * filtrarHeaders
 * Devuelve solo los headers de la lista blanca (comparación sin importar
 * mayúsculas).
 *
 * @param {Object<string, string>} headers - headers del request en el evento.
 * @returns {Object<string, string>} los headers permitidos.
 */
const filtrarHeaders = (headers = {}) => {
  const filtrados = {};
  for (const [clave, valor] of Object.entries(headers)) {
    if (HEADERS_PERMITIDOS.includes(clave.toLowerCase())) filtrados[clave] = valor;
  }
  return filtrados;
};

/**
 * limpiarArgumentos
 * Los argumentos del console.error viajan en extra.arguments. Se conservan los
 * de texto (el mensaje '[modulo] ...', que es lo mismo que va al log de
 * Railway) y se reemplazan los objetos: un error de pg serializado trae
 * err.detail, que puede tener valores de la fila (ej. un mail en un unique).
 * El mensaje y el stack del error ya viajan en la excepción del evento.
 *
 * @param {Array<*>} args - argumentos del console.error, ya serializados.
 * @returns {Array<string|number|boolean>} los argumentos sin objetos.
 */
const limpiarArgumentos = (args) =>
  args.map((arg) =>
    ['string', 'number', 'boolean'].includes(typeof arg) ? arg : '[objeto omitido: ver la excepción]'
  );

// Un stack "pelado": primera línea con el error y, abajo, líneas "    at ...".
const STACK_PELADO = /^[^[\n][^\n]*\n\s+at\s/;

/**
 * esLogDeExpress
 * Detecta el console.error que hace Express por su cuenta cuando un error
 * llega a su handler final: imprime solo err.stack (un string, sin prefijo
 * [modulo]). Ese error ya lo reporta la integración de Express de Sentry (si es
 * 5xx; los 4xx, como un JSON mal formado, los saltea a propósito), así que el
 * evento de consola sería un duplicado o ruido. Los console.error del proyecto
 * siempre empiezan con '[modulo]' y nunca matchean.
 *
 * @param {Object} event - evento de Sentry.
 * @returns {boolean} true si es el log de Express y hay que descartarlo.
 */
const esLogDeExpress = (event) => {
  const args = event.extra?.arguments;
  return event.logger === 'console'
    && Array.isArray(args)
    && args.length === 1
    && typeof args[0] === 'string'
    && STACK_PELADO.test(args[0]);
};

/**
 * limpiarEvento
 * beforeSend de Sentry: segunda red de privacidad sobre lo que deja pasar
 * dataCollection. Saca body, cookies, query string, datos de usuario/IP,
 * breadcrumbs y headers fuera de la lista blanca; limpia la URL y el nombre de
 * la transacción (sin query string ni token del turnero) y los argumentos del
 * console.error. Descarta el log propio de Express (ver esLogDeExpress). Si
 * algo falla al limpiar, descarta el evento: mejor perder un aviso que mandar
 * datos de más.
 *
 * @param {Object} event - evento de Sentry a punto de mandarse.
 * @returns {Object|null} el evento limpio, o null para descartarlo.
 */
const limpiarEvento = (event) => {
  try {
    if (esLogDeExpress(event)) return null;
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.query_string;
      delete event.request.env; // ahí puede ir REMOTE_ADDR (IP del cliente)
      if (event.request.url) event.request.url = rutaSinDatosSensibles(event.request.url);
      if (event.request.headers) event.request.headers = filtrarHeaders(event.request.headers);
    }
    delete event.user;
    delete event.breadcrumbs;
    if (event.transaction) event.transaction = rutaSinDatosSensibles(event.transaction);
    if (Array.isArray(event.extra?.arguments)) {
      event.extra.arguments = limpiarArgumentos(event.extra.arguments);
    }
    return event;
  } catch (err) {
    console.warn('[sentry] limpiarEvento — evento descartado, falló la limpieza:', err?.message);
    return null;
  }
};

if (process.env.SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      // Sin performance/tracing: más liviano y dentro del plan gratis.
      tracesSampleRate: 0,
      // Sin breadcrumbs: arrastrarían líneas de log con datos personales.
      maxBreadcrumbs: 0,
      // v11 agrega un stack sintético a los mensajes (avisos y console.error sin
      // un Error): Sentry los titula con la función de donde salen
      // ('reportarAviso', 'consoleHandler') en vez de con su texto. Apagado, el
      // título es el mensaje ('rateLimit: login', '[db] ...'). Los errores reales
      // conservan su stack: viene del Error, no es sintético.
      attachStacktrace: false,
      // v11 reemplazó sendDefaultPii por esto, y su default es recolectar todo.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: { request: { allow: HEADERS_PERMITIDOS }, response: false },
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        stackFrameVariables: false,
        genAI: { inputs: false, outputs: false },
      },
      integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
      beforeSend: limpiarEvento,
    });
    console.log(`[sentry] Sentry inicializado | environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    console.warn('[sentry] No se pudo inicializar Sentry, el backend sigue sin él:', err?.message);
  }
}
