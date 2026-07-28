// /backend/src/middlewares/rateLimitMiddleware.js
// Rate limiting por IP con express-rate-limit (auditoría 2026-07: hallazgos
// 3.1, 1.2 y 4.1). Tres capas:
//   - limiterLogin:         estricto, para los 3 endpoints de login (fuerza bruta de PIN).
//   - limiterReserva (+ ráfaga): para la reserva pública del turnero (email
//     bombing / spam / agotar agenda).
//   - limiterGlobal:        backstop holgado para toda la API (protege el pool
//     de 3 conexiones de la DB — DoS por agotamiento).
//
// PRERREQUISITO — trust proxy: la atribución por IP depende de que
// app.set('trust proxy', 1) esté configurado en index.js ANTES de montar estos
// limiters. Sin eso, detrás del proxy de Railway req.ip sería la IP del proxy
// para TODOS los requests y el limiter bloquearía a todo el mundo junto.
// express-rate-limit valida esta configuración al recibir el primer request y
// tira ERR_ERL_PERMISSIVE_TRUST_PROXY si detecta un trust proxy permisivo.
//
// Clave de conteo: la default de la librería — req.ip, con máscara /56 para
// IPv6 (un atacante con un bloque IPv6 no puede rotar direcciones dentro de su
// subred para resetear el contador). No se incluye el subdominio en la clave:
// clave por (IP, subdominio) multiplicaría el presupuesto del atacante por
// cantidad de tenants, y un cliente legítimo no opera contra varios tenants.
//
// Store: en memoria (default). Igual que el caché de tenantMiddleware, esto
// asume 1 sola instancia en Railway.
// LIMITACIÓN CONOCIDA (multi-instancia): los contadores son por proceso. Si
// algún día Railway corre más de una instancia, cada una contaría por su lado
// (el límite efectivo se multiplica) — haría falta un store compartido tipo
// Redis. Hoy corre 1 instancia, así que es correcto. Ver tenantMiddleware.js,
// que documenta la misma limitación para su caché.

import { rateLimit } from 'express-rate-limit';

/**
 * crearHandler429
 * Fabrica el handler que responde cuando un cliente supera el límite.
 * Responde 429 con un mensaje genérico (no filtra si el usuario/PIN existe ni
 * cuál límite se tocó) y loguea el evento como señal de abuso (convención de
 * logs §1.4: eventos de seguridad van con console.warn).
 *
 * @param {string} nombre - etiqueta del limiter para el log (ej. 'login')
 * @returns {Function} handler (req, res) para express-rate-limit
 */
const crearHandler429 = (nombre) => (req, res) => {
  console.warn(`[rateLimit] límite '${nombre}' excedido | ip: ${req.ip} | ruta: ${req.method} ${req.originalUrl}`);
  res.status(429).json({ error: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' });
};

// Opciones comunes: headers estándar RateLimit-* (draft-7) para que un cliente
// bien portado sepa cuándo reintentar; sin los legacy X-RateLimit-*.
const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
};

/**
 * limiterLogin — para POST /api/auth/{panel,barbero,operativo}/login [1.2]
 * 10 intentos FALLIDOS por IP cada 15 minutos. skipSuccessfulRequests: los
 * logins exitosos (status < 400) no consumen cupo, así una barbería entera
 * logueándose detrás del mismo router wifi (misma IP pública) no se bloquea a
 * sí misma; solo cuentan los intentos rechazados (401/404), que es lo que un
 * ataque de fuerza bruta produce. 10 fallos / 15 min deja la fuerza bruta de
 * un PIN de 4 dígitos (10.000 combinaciones) en ~10 días por IP, con cada
 * intento ya encarecido por bcrypt.
 */
export const limiterLogin = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: crearHandler429('login'),
});

/**
 * limiterReserva — para POST /api/turnero/turnos [3.1]
 * 10 reservas por IP por hora. Cada request acá crea un turno real y dispara
 * un mail desde el dominio autenticado del negocio, así que el techo debe ser
 * bajo; 10/hora cubre de sobra el uso legítimo (una familia reservando varios
 * turnos desde el mismo celular) y corta el email bombing y el llenado masivo
 * de agenda. Cancelar/reprogramar no pasan por acá (exigen un token_gestion
 * válido, no son automatizables a ciegas) y los GET del turnero tampoco (el
 * wizard navega con muchas lecturas; solo los cubre el backstop global).
 */
export const limiterReserva = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  handler: crearHandler429('reserva'),
});

/**
 * limiterReservaRafaga — anti-ráfaga para el mismo endpoint [3.1]
 * 3 reservas por IP por minuto. Complementa a limiterReserva con una ventana
 * corta: sin esto, un script podría clavar las 10 reservas de la hora en un
 * segundo (10 mails + 10 slots de golpe). Ningún humano crea más de 3 turnos
 * en un minuto.
 */
export const limiterReservaRafaga = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 3,
  handler: crearHandler429('reserva-rafaga'),
});

/**
 * limiterGlobal — backstop para TODA la API [4.1]
 * 300 requests por IP por minuto (5 req/seg sostenidos). Deliberadamente
 * holgado: ningún flujo legítimo se le acerca (el bootstrap más charlatán del
 * panel son decenas de requests, no cientos), pero corta el goteo masivo desde
 * una sola IP que agotaría el pool de 3 conexiones a la DB y estancaría la API
 * para todos los tenants. No reemplaza a los limiters específicos: es la red
 * de seguridad de las superficies sin límite propio.
 */
export const limiterGlobal = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 300,
  handler: crearHandler429('global'),
});
