// /backend/src/middlewares/diagnosticoIp.js
// TEMPORAL — middleware de diagnóstico de la IP del cliente detrás de Railway.
//
// Para qué está: con `trust proxy` en 1, req.ip no es la IP del cliente. Antes de
// arreglarlo medimos en producción cómo llegan las cabeceras: cuántas entradas
// trae el X-Forwarded-For (Railway cambió su forma este año: una o dos), si viene
// X-Real-IP (la única que Railway documenta para la IP del cliente) y en qué
// posición del XFF caen X-Real-IP y req.ip. Con un request de prueba que mande
// X-Diag-Ip-Esperada (y valores falsos en 203.0.113.0/24) se ve además si el
// cliente puede falsificar alguna de las dos cabeceras.
//
// Escribe UNA línea por request con console.log (nunca warn ni error: console.error
// va a Sentry y a Discord). NO escribe ninguna IP: solo posiciones, sí/no y el
// primer bloque del socket. Nunca rompe un request: cualquier falla adentro deja
// "[diagIp] error" y sigue.
//
// Se saca en el PR de `trust proxy`, junto con el arreglo.

import { isIP, BlockList } from 'node:net';

// Rango de documentación (RFC 5737) que usamos como IP falsa en las pruebas.
const RANGO_FALSO = new BlockList();
RANGO_FALSO.addSubnet('203.0.113.0', 24, 'ipv4');

// Largo máximo de los valores de X-Railway-Edge y X-Railway-Request-Id en el log.
const LARGO_MAXIMO_ID = 64;

/**
 * normalizarIp
 * Deja una IP en la forma con la que se compara: sin espacios, en minúscula (las
 * IPv6 pueden venir con mayúsculas) y con las IPv4 mapeadas (`::ffff:1.2.3.4`)
 * pasadas a IPv4.
 *
 * @param {*} valor - la IP tal como vino (string de una cabecera, req.ip, etc.).
 * @returns {string} la IP normalizada, o '' si no vino nada.
 */
function normalizarIp(valor) {
  if (valor === undefined || valor === null) return '';
  const ip = String(valor).trim().toLowerCase();
  const mapeada = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  return mapeada ? mapeada[1] : ip;
}

/**
 * partirXff
 * Parte el X-Forwarded-For en sus entradas, ya normalizadas.
 *
 * @param {*} cabecera - valor de la cabecera x-forwarded-for (puede no venir).
 * @returns {string[]} las entradas, de izquierda a derecha; [] si no vino.
 */
function partirXff(cabecera) {
  if (cabecera === undefined || cabecera === null) return [];
  const texto = String(cabecera);
  if (texto.trim() === '') return [];
  return texto.split(',').map(normalizarIp);
}

/**
 * posicionEnXff
 * Busca una IP (ya normalizada) entre las entradas del XFF.
 *
 * @param {string[]} entradas - entradas del XFF, normalizadas.
 * @param {string} ip - IP normalizada a buscar; si no es una IP válida, no se busca.
 * @returns {number|string} la posición desde la izquierda (desde 0), o 'no'.
 */
function posicionEnXff(entradas, ip) {
  if (!isIP(ip)) return 'no';
  const posicion = entradas.indexOf(ip);
  return posicion === -1 ? 'no' : posicion;
}

/**
 * esIpFalsa
 * Dice si una IP (ya normalizada) cae en el rango falso 203.0.113.0/24.
 *
 * @param {string} ip - IP normalizada.
 * @returns {boolean} true si es una IPv4 del rango falso.
 */
function esIpFalsa(ip) {
  return isIP(ip) === 4 && RANGO_FALSO.check(ip, 'ipv4');
}

/**
 * limpiarId
 * Deja un valor de cabecera apto para el log: solo [A-Za-z0-9._-], cortado a 64
 * caracteres. Así nadie puede meter texto propio (saltos de línea, separadores)
 * en el log.
 *
 * @param {*} valor - valor de la cabecera (puede no venir).
 * @returns {string} el valor limpio, o '-' si no vino o quedó vacío.
 */
function limpiarId(valor) {
  if (valor === undefined || valor === null) return '-';
  const limpio = String(valor).replace(/[^A-Za-z0-9._-]/g, '').slice(0, LARGO_MAXIMO_ID);
  return limpio === '' ? '-' : limpio;
}

/**
 * primerBloqueSocket
 * Toma solo el primer bloque de la dirección del socket (lo que va antes del
 * primer ':' o '.'), para saber de qué red llega el proxy sin loguear la IP.
 * Las IPv4 mapeadas se pasan antes a IPv4, así `::ffff:10.0.0.1` da `10`.
 *
 * @param {*} direccion - req.socket.remoteAddress (puede no venir).
 * @returns {string} el primer bloque (solo letras y números), o '-' si no hay.
 */
function primerBloqueSocket(direccion) {
  const bloque = normalizarIp(direccion).split(/[:.]/)[0].replace(/[^a-z0-9]/g, '');
  return bloque === '' ? '-' : bloque;
}

/**
 * armarLinea
 * Arma la línea de diagnóstico de un request, sin ninguna IP adentro.
 *
 * @param {import('express').Request} req - el request de Express.
 * @returns {string} la línea completa, con el prefijo [diagIp].
 */
function armarLinea(req) {
  const headers = req.headers || {};
  const entradas = partirXff(headers['x-forwarded-for']);

  const realIpCruda = headers['x-real-ip'];
  const realIp = normalizarIp(realIpCruda);
  const realIpValida = isIP(realIp) !== 0;
  let estadoRealIp = 'ausente';
  if (realIpCruda !== undefined) estadoRealIp = realIpValida ? 'valida' : 'invalida';

  const reqIp = normalizarIp(req.ip);

  const partes = [
    `xff_n:${entradas.length}`,
    `real_ip:${estadoRealIp}`,
    `real_ip_en_xff:${realIpValida ? posicionEnXff(entradas, realIp) : 'no'}`,
    `req_ip_en_xff:${posicionEnXff(entradas, reqIp)}`,
    `real_ip_es_req_ip:${realIpValida && realIp === reqIp ? 'si' : 'no'}`,
    `socket:${primerBloqueSocket(req.socket?.remoteAddress)}`,
    `edge:${limpiarId(headers['x-railway-edge'])}`,
    `rid:${limpiarId(headers['x-railway-request-id'])}`,
  ];

  // Solo en los requests de prueba: la IP que esperamos ver como la del cliente.
  const esperada = normalizarIp(headers['x-diag-ip-esperada']);
  if (isIP(esperada)) {
    partes.push(
      `esperada_en_xff:${posicionEnXff(entradas, esperada)}`,
      `esperada_es_real_ip:${realIpValida && realIp === esperada ? 'si' : 'no'}`,
      `xff_falso:${entradas.some(esIpFalsa) ? 'si' : 'no'}`,
      `real_ip_falsa:${realIpValida && esIpFalsa(realIp) ? 'si' : 'no'}`,
    );
  }

  return `[diagIp] ${partes.join(' | ')}`;
}

/**
 * diagnosticoIp
 * Middleware de Express: escribe una línea de diagnóstico por request y sigue.
 * Si algo falla al armar la línea, escribe "[diagIp] error" (sin el detalle, que
 * podría traer una IP) y sigue igual. next() se llama una sola vez, fuera del
 * try, para no atrapar errores de los middlewares que vienen después.
 *
 * @param {import('express').Request} req - el request.
 * @param {import('express').Response} res - la respuesta (no se usa).
 * @param {import('express').NextFunction} next - el siguiente middleware.
 * @returns {void}
 */
export function diagnosticoIp(req, res, next) {
  let linea;
  try {
    linea = armarLinea(req);
  } catch {
    linea = '[diagIp] error';
  }
  console.log(linea);
  next();
}
