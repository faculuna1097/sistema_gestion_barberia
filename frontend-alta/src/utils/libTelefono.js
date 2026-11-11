// /frontend-alta/src/utils/libTelefono.js
// Carga diferida de libphonenumber-js (plan §7.1, fase 6).
//
// La librería es casi la mitad del JS del formulario y solo hace falta en el
// capítulo Contacto (los tres teléfonos) y para mostrar un teléfono ya guardado
// (la tarjeta, la Revisión, "Ya enviada"). Por eso no se importa de forma
// estática: se pide con import(), y Vite la deja en un archivo aparte que el
// navegador baja recién cuando se llama a cargarLibTelefono().
//
// Quién la pide y cuándo:
//   - Formulario, al llegar a "Tus servicios" (pantalla 8 en adelante): dos o
//     tres pantallas antes de Contacto, así ya está cuando el cliente llega.
//   - App, al cargar directo una solicitud que ya tiene teléfonos o que quedó en
//     Contacto o más adelante (también "Ya enviada"): espera a tenerla antes de
//     sacar el skeleton, así no se ve un número sin formato que después cambia.
//
// Los módulos que la usan (utils/telefono.js, utils/contacto.js, CampoTelefono)
// la leen con libTelefono(), que devuelve el módulo ya cargado. Solo se llaman
// cuando la librería está (las pantallas de Contacto esperan a tenerla); la
// única función que se usa antes, fmtTelefono, tiene su plan B (ver telefono.js).
//
// Funciones sin React, para poder probarlas con Node (los tests llaman a
// cargarLibTelefono() antes de usar los teléfonos).

/** El módulo de libphonenumber-js, cuando ya se cargó. */
let modulo = null;
/** La carga en curso (una sola a la vez). */
let promesa = null;
/** El error de la última carga que falló (sin red, o un deploy nuevo que borró el archivo). */
let ultimoError = null;
/** Quién se entera de los cambios (useLibTelefono). */
const oyentes = new Set();

/**
 * avisar (interna)
 * Les avisa a los suscriptos que cambió el estado de la carga.
 */
function avisar() {
  oyentes.forEach((oyente) => oyente());
}

/**
 * cargarLibTelefono
 * Pide la librería si todavía no está. Se puede llamar las veces que haga
 * falta: comparte la carga en curso, y después de un error la reintenta.
 * @returns {Promise<Object>} El módulo de libphonenumber-js. Rechaza si no se
 *   pudo bajar (el que llama decide si le importa: precargar no lo necesita).
 */
export function cargarLibTelefono() {
  if (modulo) return Promise.resolve(modulo);
  if (!promesa) {
    ultimoError = null;
    promesa = import('libphonenumber-js')
      .then((m) => {
        modulo = m;
        avisar();
        return m;
      })
      .catch((err) => {
        console.warn('[libTelefono] no se pudo cargar libphonenumber-js:', err.message);
        promesa = null;
        ultimoError = err;
        avisar();
        throw err;
      });
  }
  return promesa;
}

/**
 * precargarLibTelefono
 * Igual que cargarLibTelefono, pero sin que un error moleste: es la carga
 * anticipada, y si falla se reintenta al llegar a Contacto.
 */
export function precargarLibTelefono() {
  cargarLibTelefono().catch(() => {});
}

/**
 * libTelefonoCargada
 * @returns {boolean} true si la librería ya está lista para usar.
 */
export function libTelefonoCargada() {
  return modulo !== null;
}

/**
 * errorLibTelefono
 * @returns {Error|null} El error de la última carga, o null si no falló.
 */
export function errorLibTelefono() {
  return ultimoError;
}

/**
 * libTelefono
 * El módulo de libphonenumber-js. Solo se llama con la librería ya cargada.
 * @returns {Object}
 * @throws {Error} Si todavía no se cargó (un error de programación: quien
 *   llama tenía que esperar a libTelefonoCargada()).
 */
export function libTelefono() {
  if (!modulo) throw new Error('libphonenumber-js todavía no se cargó');
  return modulo;
}

/**
 * suscribirLibTelefono
 * Para useSyncExternalStore: avisa cuando la librería se carga o falla.
 * @param {Function} oyente
 * @returns {Function} La que cancela la suscripción.
 */
export function suscribirLibTelefono(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}
