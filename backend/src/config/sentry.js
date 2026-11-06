// /backend/src/config/sentry.js
// Helper central de Sentry. Es el ÚNICO archivo (además de src/instrument.js, que
// inicializa el SDK) que importa @sentry/node: el resto del backend reporta a
// través de estas funciones. Así, si mañana cambia el proveedor o la API del SDK,
// se toca un solo lugar.
//
// Todas las funciones son no-op si Sentry no está inicializado (sin SENTRY_DSN, o
// si el init falló): en local y en los scripts el backend se comporta igual que
// sin Sentry.
//
// La mayoría de los errores NO pasan por acá: todo console.error llega solo a
// Sentry por captureConsoleIntegration (ver instrument.js). Este helper cubre lo
// que la captura automática no hace: etiquetar con el tenant, avisos que no son
// errores (cortes del rate limiter), el handler de Express y el vaciado de la
// cola antes de un process.exit.

import * as Sentry from '@sentry/node';

/**
 * sentryActivo (interna)
 * Dice si el SDK quedó inicializado con un cliente. Es la guarda de todas las
 * funciones públicas: sin DSN, ninguna hace nada.
 *
 * @returns {boolean} true si hay un cliente de Sentry activo.
 */
const sentryActivo = () => Sentry.isInitialized();

/**
 * etiquetarRequest
 * Pone tags en el scope del request actual (el isolation scope que Sentry crea
 * por request). Todo evento que salga después dentro del mismo request (un
 * console.error de un controller, un aviso del rate limiter) los lleva.
 * Fuera de un request (un job), los tags caen en el scope del proceso: para
 * eso está conEtiquetas.
 *
 * @param {Object<string, string|number>} tags - pares clave/valor (ej. { tenant, tenant_id }).
 *   Los valores undefined o null se omiten.
 * @returns {void}
 */
export const etiquetarRequest = (tags) => {
  if (!sentryActivo()) return;
  Sentry.getIsolationScope().setTags(limpiarTags(tags));
};

/**
 * reportarAviso
 * Manda a Sentry un evento de nivel 'warning' que no es un error del código
 * (ej. un corte del rate limiter). El fingerprint define cómo se agrupan: con el
 * mismo fingerprint, todos los avisos caen en un único issue. Hereda los tags
 * del scope actual (tenant, rol) además de los que se le pasen.
 *
 * @param {string} mensaje - título del issue (ej. 'rateLimit: login').
 * @param {Object} [opciones]
 * @param {Object<string, string|number>} [opciones.tags] - tags propios del aviso.
 * @param {string[]} [opciones.fingerprint] - clave de agrupación del issue.
 * @returns {void}
 */
export const reportarAviso = (mensaje, { tags = {}, fingerprint } = {}) => {
  if (!sentryActivo()) return;
  Sentry.captureMessage(mensaje, {
    level: 'warning',
    tags: limpiarTags(tags),
    ...(fingerprint ? { fingerprint } : {}),
  });
};

/**
 * conEtiquetas
 * Corre fn dentro de un scope nuevo con esos tags y devuelve lo que devuelva fn
 * (si fn es async, devuelve su promesa). Los errores reportados adentro (incluido
 * todo console.error) llevan los tags; al salir, el scope se descarta y no se
 * filtra a la vuelta siguiente. Pensado para los jobs, que no tienen request:
 * una vuelta por tenant = un scope por tenant.
 *
 * Usa un isolation scope (no solo un scope común) para que todo lo que se
 * acumule adentro quede aislado de las otras vueltas.
 *
 * @param {Object<string, string|number>} tags - tags del scope (ej. { tenant, tenant_id }).
 * @param {Function} fn - función a correr; puede ser async.
 * @returns {*} lo que devuelva fn (una promesa si fn es async).
 */
export const conEtiquetas = (tags, fn) => {
  if (!sentryActivo()) return fn();
  return Sentry.withIsolationScope((scope) => {
    scope.setTags(limpiarTags(tags));
    return fn();
  });
};

/**
 * registrarHandlerErrores
 * Monta el handler de errores de Sentry en la app de Express. Va después de la
 * última ruta: atrapa lo que escape de un handler (un throw no atrapado o una
 * promesa rechazada en un handler async, que Express 5 deriva al handler de
 * errores) y lo reporta antes de dejar que Express responda el 500.
 *
 * En @sentry/node v11 la integración de Express ya captura esos errores sola; el
 * handler deja el registro explícito y Sentry evita el doble reporte.
 *
 * @param {import('express').Express} app - la app de Express.
 * @returns {void}
 */
export const registrarHandlerErrores = (app) => {
  if (!sentryActivo()) return;
  Sentry.setupExpressErrorHandler(app);
};

/**
 * vaciarEventos
 * Espera a que Sentry termine de mandar los eventos pendientes. Sentry los manda
 * en segundo plano: un proceso que termina con process.exit (los jobs de cron, un
 * crash de arranque) los pierde si no los vacía antes. Nunca tira.
 *
 * @param {number} [ms=2000] - tiempo máximo de espera en milisegundos.
 * @returns {Promise<void>}
 */
export const vaciarEventos = async (ms = 2000) => {
  if (!sentryActivo()) return;
  try {
    await Sentry.flush(ms);
  } catch (err) {
    // console.warn y no console.error: un error acá volvería a entrar a Sentry.
    console.warn('[sentry] vaciarEventos — no se pudieron vaciar los eventos:', err?.message);
  }
};

/**
 * limpiarTags (interna)
 * Descarta los tags sin valor (undefined/null) y pasa el resto a string, que es
 * lo que Sentry espera en un tag.
 *
 * @param {Object<string, *>} tags - tags crudos.
 * @returns {Object<string, string>} tags listos para el scope.
 */
const limpiarTags = (tags = {}) => {
  const limpios = {};
  for (const [clave, valor] of Object.entries(tags)) {
    if (valor !== undefined && valor !== null) limpios[clave] = String(valor);
  }
  return limpios;
};
