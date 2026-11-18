// /backend/src/middlewares/rateLimitMiddleware.js
// Rate limiting por IP con express-rate-limit (auditoría 2026-07: hallazgos
// 3.1, 1.2 y 4.1; auditoría 2026-11: Z3-01 y Z1-01). Seis capas:
//   - limiterLogin:         estricto, para los 3 endpoints de login (fuerza bruta de PIN)
//     y para /api/auth/recuperar (cuentan los tokens inválidos).
//   - limiterRecuperacion:  para pedir el link de recuperación (mails al dueño
//     y cuota de Resend compartida).
//   - limiterReserva (+ ráfaga): para la reserva pública del turnero (email
//     bombing / spam / agotar agenda).
//   - limiterGestion (+ ráfaga): para cancelar y reprogramar un turno desde el
//     link de gestión (email bombing con el token de un turno propio).
//   - limiterAlta / limiterAltaEnvio: para el formulario de alta de clientes
//     (autoguardado holgado, envío estricto).
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
import { reportarAviso } from '../config/sentry.js';
import { rutaParaLog } from '../utils/sanitizarLogs.js';

/**
 * crearHandler429
 * Fabrica el handler que responde cuando un cliente supera el límite.
 * Responde 429 con un mensaje genérico (no filtra si el usuario/PIN existe ni
 * cuál límite se tocó) y loguea el evento como señal de abuso (convención de
 * logs §1.4: eventos de seguridad van con console.warn).
 *
 * Además manda un aviso a Sentry (tráfico inusual), agrupado en un issue por
 * tipo de límite (fingerprint). La IP queda solo en el log de Railway: a Sentry
 * van el límite y la ruta, sin query string ni token del turnero. En los dos
 * lados la ruta sale de rutaParaLog (sin query string y recortada): la URL la
 * escribe el cliente, y el log y el aviso los lee la sesión de diagnóstico
 * (auditoría 2026-11, Z7-02). El tenant
 * llega solo por el scope del request cuando ya está resuelto (limiterGlobal
 * y los del alta corren antes de tenantMiddleware: ahí no hay tenant).
 *
 * @param {string} nombre - etiqueta del limiter para el log (ej. 'login')
 * @returns {Function} handler (req, res) para express-rate-limit
 */
const crearHandler429 = (nombre) => (req, res) => {
  const ruta = `${req.method} ${rutaParaLog(req.originalUrl)}`;
  console.warn(`[rateLimit] límite '${nombre}' excedido | ip: ${req.ip} | ruta: ${ruta}`);
  reportarAviso(`rateLimit: ${nombre}`, {
    tags: { limite: nombre, ruta },
    fingerprint: ['rateLimit', nombre],
  });
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
 * limiterRecuperacion — para POST /api/auth/recuperar/solicitar [Z1-01]
 * 5 pedidos por IP por hora, contando todos. Ese endpoint responde siempre 200
 * (no dice si el mail salió ni si lo frenó algo), así que con limiterLogin, que
 * cuenta solo los fallos, no tenía límite real por IP: cada pedido podía mandar
 * un mail al dueño y gastar la cuota diaria de Resend que comparten todos los
 * locales. Por eso acá no hay skipSuccessfulRequests ni skipFailedRequests.
 *
 * Por qué 5: un dueño que se olvidó la contraseña del iPad o el PIN pide uno o
 * dos links (uno por tipo, y quizás otro si no le llegó). 5 por hora le deja
 * margen y corta el script.
 *
 * Este cupo no es el freno que importa. Con la deuda de trust proxy
 * (estado_actual.md → Pendientes), req.ip es la IP de un proxy de Railway: los
 * que caen en el mismo nodo comparten el cupo, y un atacante reparte sus pedidos
 * entre nodos. El freno que no depende de la IP es el tope por local de
 * emitirToken (services/recuperacionService.js): 6 links por día entre los dos
 * tipos, además de uno cada 2 minutos por tipo.
 *
 * Va montado solo en la ruta de solicitar (routes/authRecuperar.js), como
 * limiterReserva en el turnero. validar y usar siguen con limiterLogin, que
 * viene del mount de index.js y también corre en solicitar.
 */
export const limiterRecuperacion = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  handler: crearHandler429('recuperacion'),
});

/**
 * limiterReserva — para POST /api/turnero/turnos [3.1]
 * 10 reservas por IP por hora. Cada request acá crea un turno real y dispara
 * un mail desde el dominio autenticado del negocio, así que el techo debe ser
 * bajo; 10/hora cubre de sobra el uso legítimo (una familia reservando varios
 * turnos desde el mismo celular) y corta el email bombing y el llenado masivo
 * de agenda. Cancelar y reprogramar tienen su propio límite (limiterGestion):
 * exigen un token_gestion, pero quien reserva lo recibe en la respuesta, así
 * que el token solo no frena el abuso. Los GET del turnero no tienen límite
 * propio (el wizard navega con muchas lecturas; solo los cubre el backstop global).
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
 * limiterGestion — para POST /api/turnero/turnos/:token/{cancelar,reprogramar} [Z3-01]
 * 10 gestiones por IP por hora, compartidas entre cancelar y reprogramar (la
 * misma instancia va en las dos rutas, así que el contador es uno solo).
 * Quien reserva recibe el token_gestion en la respuesta y el mail del cliente
 * no se verifica: sin este límite, con un solo turno se podía reprogramar en
 * bucle y mandar un mail por llamada a cualquier dirección, gastando la cuota
 * diaria de Resend que comparten todos los locales.
 *
 * skipFailedRequests: solo cuentan las respuestas que salen bien (status < 400),
 * que son las que mandan mail (reprogramar al mismo horario también cuenta,
 * aunque no manda nada). Un cliente que recibe "horario ocupado" (409) o un 422
 * al elegir no gasta cupo. Es lo contrario de limiterLogin, donde lo que cuenta
 * son los fallos. Con esto, como mucho 10 mails por hora por IP: lo mismo que
 * la reserva.
 *
 * Holgado a propósito por la deuda de trust proxy (estado_actual.md): hoy
 * req.ip es la de un proxy de Railway y los clientes que caen en el mismo nodo
 * comparten el cupo. Un tope más bajo podría bloquearle la gestión a un cliente
 * real.
 */
export const limiterGestion = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  skipFailedRequests: true,
  handler: crearHandler429('gestion'),
});

/**
 * limiterGestionRafaga — anti-ráfaga para las mismas rutas [Z3-01]
 * 3 gestiones por IP por minuto, con el mismo criterio de conteo que
 * limiterGestion (solo las que salen bien). Sin esto, un script podría clavar
 * las 10 gestiones de la hora en un segundo. Ningún cliente cancela o
 * reprograma más de 3 veces en un minuto.
 */
export const limiterGestionRafaga = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 3,
  skipFailedRequests: true,
  handler: crearHandler429('gestion-rafaga'),
});

/**
 * limiterAlta — para GET y PUT /api/alta/:token y GET /api/alta/:token/subdominio/:valor
 * 120 requests por IP por minuto. El formulario autoguarda ~800 ms después de
 * cada cambio y, en la pantalla del nombre, además consulta el subdominio: un
 * cliente cargando rápido puede pasar los 60 por minuto, y un 429 ahí se ve como
 * "No pudimos guardar". 120 sigue muy por debajo del backstop global y, sin un
 * token válido (uuid v4, no se adivina), cada request termina en un 404.
 */
export const limiterAlta = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 120,
  handler: crearHandler429('alta'),
});

/**
 * limiterAltaEnvio — para POST /api/alta/:token/enviar
 * 5 envíos por IP por hora. Cada solicitud se envía una sola vez (después da
 * 409) y el envío manda un mail de aviso; 5 deja margen para reintentar si el
 * backend marca un error que el front no vio (por ejemplo, un subdominio que
 * otro tomó entre medio).
 */
export const limiterAltaEnvio = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  handler: crearHandler429('alta-envio'),
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
