// /frontend-alta/src/utils/equipo.js
// El equipo en el formulario (pantallas 5 y 6): los barberos con su comisión y
// su mail, y los dueños (barberos marcados y dueños que no cortan).
//
// En `datos` (plan §5.6) cada barbero lleva una `clave` estable, generada acá
// en el front: es la key de las listas de React y lo que relaciona a un dueño
// con su barbero (renombrar o reordenar no lo pierde). Lo que es de la
// interfaz va en `progreso`, porque el backend descarta cualquier otra clave:
//   - progreso.comision_igual: "Mismo % para todos" (por defecto, prendido).
//   - progreso.comision_comun: el % de ese selector único. Hace falta guardarlo
//     aparte para que valga también sin barberos, y al volver a prenderlo.
//   - progreso.duenios_confirmados: el cliente ya pasó la pantalla de dueños.
//     Si después quita al único dueño, la pantalla 6 lo marca apenas se llega.
//
// Todas las funciones de cambio reciben `datos` y devuelven `datos` nuevos,
// para pasarlas directo a actualizar() de useSolicitud.
// Funciones puras (sin React) para poder probarlas con Node, salvo nuevaClave.

import { PANTALLA } from '../config/pantallas.js';
import { COMISION_MAXIMA, erroresDePantalla } from './validaciones.js';

/**
 * PASO_COMISION
 * Lo que salta la barra de la comisión con cada paso (y los botones - y +).
 */
export const PASO_COMISION = 5;

/**
 * COMISION_POR_DEFECTO
 * Con qué % arranca la barra: el reparto más común en una barbería.
 */
export const COMISION_POR_DEFECTO = 50;

/**
 * nuevaClave
 * Un id local para un barbero nuevo. crypto.randomUUID existe en todo
 * navegador actual, pero solo en un contexto seguro (https o localhost): si no
 * está, alcanza con algo único dentro de esta solicitud.
 * @returns {string}
 */
export function nuevaClave() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * esComisionValida (interna)
 * @param {*} valor
 * @returns {boolean} true si es un entero de 0 a COMISION_MAXIMA.
 */
const esComisionValida = (valor) => Number.isInteger(valor) && valor >= 0 && valor <= COMISION_MAXIMA;

/**
 * pasoComision
 * El % después de un toque de - o +: salta al múltiplo de PASO_COMISION
 * anterior o siguiente (un 37 que vino guardado pasa a 35 o 40), sin salir de
 * 0 a COMISION_MAXIMA (un 120 baja a 100).
 * @param {number} valor - El % actual (puede no ser válido)
 * @param {number} sentido - -1 (menos) o +1 (más)
 * @returns {number}
 */
export function pasoComision(valor, sentido) {
  const actual = Number.isFinite(valor) ? valor : COMISION_POR_DEFECTO;
  const siguiente = sentido > 0
    ? Math.floor(actual / PASO_COMISION) * PASO_COMISION + PASO_COMISION
    : Math.ceil(actual / PASO_COMISION) * PASO_COMISION - PASO_COMISION;
  return Math.min(Math.max(siguiente, 0), COMISION_MAXIMA);
}

/**
 * leerEquipo
 * La vista del equipo que usan las pantallas y la tarjeta.
 * @param {Object} datos - El formulario completo
 * @returns {{
 *   barberos: Array<Object>,
 *   comisionIgual: boolean,
 *   comisionComun: number,
 *   duenios: string[],
 *   dueniosSinCorte: Array<{nombre: string}>,
 * }} `comisionIgual`: "Mismo % para todos" (sin marca guardada, prendido).
 *   `comisionComun`: el % del selector único (lo guardado; si no, el del
 *   primer barbero; si no, COMISION_POR_DEFECTO). `duenios`: los nombres de
 *   todos los dueños, primero los barberos.
 */
export function leerEquipo(datos) {
  const barberos = Array.isArray(datos.barberos) ? datos.barberos : [];
  const dueniosSinCorte = Array.isArray(datos.duenios_sin_corte) ? datos.duenios_sin_corte : [];
  const progreso = datos.progreso ?? {};

  let comisionComun = COMISION_POR_DEFECTO;
  if (Number.isFinite(progreso.comision_comun)) comisionComun = progreso.comision_comun;
  else if (esComisionValida(barberos[0]?.comision)) comisionComun = barberos[0].comision;

  const duenios = [
    ...barberos.filter((b) => b.es_duenio === true).map((b) => (b.nombre ?? '').trim()),
    ...dueniosSinCorte.map((d) => (d?.nombre ?? '').trim()),
  ].filter(Boolean);

  return {
    barberos,
    comisionIgual: progreso.comision_igual !== false,
    comisionComun,
    duenios,
    dueniosSinCorte,
  };
}

/**
 * conBarberos (interna)
 * @param {Object} datos
 * @param {Function} cambio - Recibe la lista de barberos y devuelve la nueva
 * @returns {Object} Los datos con la lista nueva.
 */
const conBarberos = (datos, cambio) => ({ ...datos, barberos: cambio(Array.isArray(datos.barberos) ? datos.barberos : []) });

/**
 * cambiarBarbero (interna)
 * Aplica un cambio al barbero de una clave.
 * @param {Object} datos
 * @param {string} clave
 * @param {Function} cambio - Recibe el barbero y devuelve el nuevo
 * @returns {Object} Los datos nuevos (los mismos si no hay barbero con esa clave).
 */
function cambiarBarbero(datos, clave, cambio) {
  if (!datos.barberos?.some((b) => b.clave === clave)) return datos;
  return conBarberos(datos, (lista) => lista.map((b) => (b.clave === clave ? cambio(b) : b)));
}

/**
 * agregarBarbero
 * Suma un barbero al final, con horario 'igual_local' y, si está prendido
 * "Mismo % para todos", la comisión común (si no, también: es el punto de partida).
 * @param {Object} datos
 * @param {{clave: string, nombre: string}} nuevo - La clave (nuevaClave) y el nombre
 * @returns {Object} Los datos nuevos.
 */
export function agregarBarbero(datos, { clave, nombre }) {
  const { comisionComun } = leerEquipo(datos);
  return conBarberos(datos, (lista) => [...lista, {
    clave,
    nombre: nombre.trim(),
    comision: comisionComun,
    email: '',
    es_duenio: false,
    horario: 'igual_local',
  }]);
}

/**
 * renombrarBarbero
 * Cambia el nombre tal como se escribe (se recorta al salir del campo). Sigue
 * siendo el mismo barbero: si era dueño, sigue siéndolo.
 * @param {Object} datos
 * @param {string} clave
 * @param {string} nombre
 * @returns {Object} Los datos nuevos.
 */
export function renombrarBarbero(datos, clave, nombre) {
  return cambiarBarbero(datos, clave, (b) => ({ ...b, nombre }));
}

/**
 * quitarBarbero
 * Saca al barbero de la lista, con todo lo suyo (si era dueño, deja de contar
 * como dueño; su horario se va con él).
 * @param {Object} datos
 * @param {string} clave
 * @returns {Object} Los datos nuevos.
 */
export function quitarBarbero(datos, clave) {
  return conBarberos(datos, (lista) => lista.filter((b) => b.clave !== clave));
}

/**
 * cambiarEmailBarbero
 * @param {Object} datos
 * @param {string} clave
 * @param {string} email - Tal como se escribe ('' lo saca)
 * @returns {Object} Los datos nuevos.
 */
export function cambiarEmailBarbero(datos, clave, email) {
  return cambiarBarbero(datos, clave, (b) => ({ ...b, email }));
}

/**
 * cambiarComisionComun
 * El selector de "Mismo % para todos": guarda el % y se lo pone a todos.
 * @param {Object} datos
 * @param {number} comision
 * @returns {Object} Los datos nuevos.
 */
export function cambiarComisionComun(datos, comision) {
  const conTodos = conBarberos(datos, (lista) => lista.map((b) => ({ ...b, comision })));
  return { ...conTodos, progreso: { ...datos.progreso, comision_comun: comision } };
}

/**
 * cambiarComisionBarbero
 * El selector de un barbero, con "Mismo % para todos" apagado.
 * @param {Object} datos
 * @param {string} clave
 * @param {number} comision
 * @returns {Object} Los datos nuevos.
 */
export function cambiarComisionBarbero(datos, clave, comision) {
  return cambiarBarbero(datos, clave, (b) => ({ ...b, comision }));
}

/**
 * cambiarComisionIgual
 * Prende o apaga "Mismo % para todos". Al prenderlo, todos toman el % común;
 * al apagarlo, cada uno arranca del que tenía (el común).
 * @param {Object} datos
 * @param {boolean} igual
 * @returns {Object} Los datos nuevos.
 */
export function cambiarComisionIgual(datos, igual) {
  const { comisionComun } = leerEquipo(datos);
  const base = igual ? cambiarComisionComun(datos, comisionComun) : datos;
  return { ...base, progreso: { ...base.progreso, comision_igual: igual, comision_comun: comisionComun } };
}

/**
 * alternarDuenio
 * Marca o desmarca a un barbero como dueño.
 * @param {Object} datos
 * @param {string} clave
 * @returns {Object} Los datos nuevos.
 */
export function alternarDuenio(datos, clave) {
  return cambiarBarbero(datos, clave, (b) => ({ ...b, es_duenio: b.es_duenio !== true }));
}

/**
 * agregarDuenioSinCorte
 * Suma un dueño que no corta (va a la tabla de socios, no a la de barberos).
 * @param {Object} datos
 * @param {string} nombre
 * @returns {Object} Los datos nuevos.
 */
export function agregarDuenioSinCorte(datos, nombre) {
  const lista = Array.isArray(datos.duenios_sin_corte) ? datos.duenios_sin_corte : [];
  return { ...datos, duenios_sin_corte: [...lista, { nombre: nombre.trim() }] };
}

/**
 * quitarDuenioSinCorte
 * @param {Object} datos
 * @param {number} indice - Posición en duenios_sin_corte
 * @returns {Object} Los datos nuevos.
 */
export function quitarDuenioSinCorte(datos, indice) {
  const lista = Array.isArray(datos.duenios_sin_corte) ? datos.duenios_sin_corte : [];
  return { ...datos, duenios_sin_corte: lista.filter((_, i) => i !== indice) };
}

/**
 * confirmarDuenios
 * Anota que el cliente ya pasó la pantalla de dueños (ver el encabezado).
 * @param {Object} datos
 * @returns {Object} Los datos nuevos (los mismos si ya estaba anotado).
 */
export function confirmarDuenios(datos) {
  if (datos.progreso?.duenios_confirmados === true) return datos;
  return { ...datos, progreso: { ...datos.progreso, duenios_confirmados: true } };
}

/**
 * errorDeCampoNuevo (interna)
 * Valida un dato que todavía no está en la lista con las mismas reglas del
 * envío (erroresDePantalla): arma los datos como quedarían y devuelve el error
 * del campo nuevo. Así el mensaje es el mismo que daría el backend.
 * @param {number} pantalla
 * @param {Object} candidato - Los datos con el dato nuevo
 * @param {string} campo - El campo nuevo ('barberos.2.nombre')
 * @returns {string|null}
 */
function errorDeCampoNuevo(pantalla, candidato, campo) {
  return erroresDePantalla(pantalla, candidato).find((e) => e.campo === campo)?.mensaje ?? null;
}

/**
 * errorAlAgregarBarbero
 * Por qué no se puede sumar un barbero con ese nombre (muy corto, muy largo o
 * repetido sin importar mayúsculas), o null si se puede.
 * @param {Object} datos
 * @param {string} nombre
 * @returns {string|null} El mensaje de validaciones.js.
 */
export function errorAlAgregarBarbero(datos, nombre) {
  const candidato = agregarBarbero(datos, { clave: '__nuevo__', nombre });
  return errorDeCampoNuevo(PANTALLA.BARBEROS, candidato, `barberos.${candidato.barberos.length - 1}.nombre`);
}

/**
 * errorAlAgregarDuenio
 * Por qué no se puede sumar un dueño que no corta con ese nombre (largo, o
 * repetido con otro dueño), o null si se puede.
 * @param {Object} datos
 * @param {string} nombre
 * @returns {string|null} El mensaje de validaciones.js.
 */
export function errorAlAgregarDuenio(datos, nombre) {
  const candidato = agregarDuenioSinCorte(datos, nombre);
  return errorDeCampoNuevo(PANTALLA.DUENIOS, candidato, `duenios_sin_corte.${candidato.duenios_sin_corte.length - 1}.nombre`);
}

/**
 * unirNombres
 * ['Juan', 'Pedro', 'Leo'] → "Juan, Pedro y Leo".
 * @param {string[]} nombres
 * @returns {string}
 */
export function unirNombres(nombres) {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * resumirComision
 * La comisión del equipo en pocas palabras: "50 %" si es la misma para todos,
 * "40 a 60 %" si no. Ignora los valores que no son válidos.
 * @param {Object} datos
 * @returns {string} '' si no hay barberos con comisión válida.
 */
export function resumirComision(datos) {
  const valores = leerEquipo(datos).barberos.map((b) => b.comision).filter(esComisionValida);
  if (valores.length === 0) return '';
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  return min === max ? `${min} %` : `${min} a ${max} %`;
}
