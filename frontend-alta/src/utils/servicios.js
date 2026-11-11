// /frontend-alta/src/utils/servicios.js
// El capítulo "Tus servicios" (pantallas 8 a 10): el largo del turno, los
// servicios y los productos.
//
// En `datos` (plan §5.6):
//   - turno.duracion_minutos: uno de DURACIONES_TURNO.
//   - servicios: [{ clave, nombre, precio, cantidad_slots }]. La duración se
//     guarda en turnos (cantidad_slots, 1 a 20), como en la DB; los minutos son
//     cantidad_slots × duracion_minutos.
//   - productos: [{ clave, nombre, precio, stock, stock_minimo }].
// `clave` es un id local del front, solo para las listas de React (como la de
// los barberos): al enviar, el backend guarda solo las claves de §5.6.
// Precio, stock y stock mínimo van como number, o null si el campo está vacío.
//
// Lo de interfaz va en progreso (el backend descarta cualquier otra clave):
//   - progreso.turno_de_servicios: el largo del turno con el que se cargaron las
//     duraciones. Si después se cambia el turno, las duraciones en turnos se
//     conservan y los minutos cambian: la pantalla 9 lo avisa (cambioDeTurno)
//     hasta que se confirma con "Seguir" (confirmarServicios).
//   - progreso.vende_productos: la respuesta de "¿Vendés productos?" (true,
//     false o sin contestar).
//   - progreso.productos_apartados: los productos que había al tocar "Ahora no",
//     para recuperarlos si se vuelve a "Sí".
//
// Todas las funciones de cambio reciben `datos` y devuelven `datos` nuevos,
// para pasarlas directo a actualizar() de useSolicitud.
// Funciones puras (sin React) para poder probarlas con Node.

import { PANTALLA } from '../config/pantallas.js';
import { DURACIONES_TURNO, SLOTS_MAXIMOS, erroresDePantalla } from './validaciones.js';

/**
 * SERVICIOS_COMUNES
 * Los servicios típicos de una barbería argentina, con su duración habitual en
 * minutos: el botón de cada uno lo suma con esa duración (redondeada a turnos)
 * y pide el precio. Los demás van con "Agregar otro".
 */
export const SERVICIOS_COMUNES = [
  { nombre: 'Corte', minutos: 30 },
  { nombre: 'Barba', minutos: 20 },
  { nombre: 'Corte y barba', minutos: 45 },
  { nombre: 'Corte infantil', minutos: 30 },
  { nombre: 'Perfilado de cejas', minutos: 15 },
  { nombre: 'Afeitado con navaja', minutos: 30 },
  { nombre: 'Diseño', minutos: 15 },
  { nombre: 'Platinado', minutos: 120 },
];

/**
 * MINUTOS_SERVICIO_NUEVO
 * Con cuántos minutos arranca un servicio de "Agregar otro" (se ajusta después).
 */
export const MINUTOS_SERVICIO_NUEVO = 30;

/**
 * DIGITOS_STOCK_MAXIMOS
 * Dígitos que acepta el stock: 9 entran siempre en un integer de la DB.
 */
export const DIGITOS_STOCK_MAXIMOS = 9;

/**
 * lista (interna)
 * @param {*} valor
 * @returns {Array} El valor si es una lista; si no, una vacía.
 */
const lista = (valor) => (Array.isArray(valor) ? valor : []);

/**
 * clavePara (interna)
 * Una clave que no usa ningún ítem de la lista.
 * @param {Array} items
 * @param {string} prefijo - 's' (servicio) o 'p' (producto)
 * @returns {string}
 */
function clavePara(items, prefijo) {
  const usadas = new Set(items.map((item) => item?.clave));
  let n = items.length + 1;
  while (usadas.has(`${prefijo}${n}`)) n += 1;
  return `${prefijo}${n}`;
}

/**
 * mismoNombre (interna)
 * @param {string} a
 * @param {string} b
 * @returns {boolean} true si son el mismo nombre sin importar mayúsculas ni espacios de más.
 */
const mismoNombre = (a, b) => (a ?? '').trim().toLocaleLowerCase('es') === (b ?? '').trim().toLocaleLowerCase('es');

// ─── Largo del turno ────────────────────────────────────────────────────────

/**
 * TURNO_POR_DEFECTO
 * Con qué largo arranca la barra de la pantalla 8: el más común.
 */
export const TURNO_POR_DEFECTO = 30;

/**
 * duracionTurno
 * @param {Object} datos
 * @returns {number|null} El largo del turno elegido, o null si no hay uno válido.
 */
export function duracionTurno(datos) {
  const valor = Number(datos?.turno?.duracion_minutos);
  return DURACIONES_TURNO.includes(valor) ? valor : null;
}

/**
 * elegirDuracionTurno
 * @param {Object} datos
 * @param {number} minutos - Uno de DURACIONES_TURNO
 * @returns {Object} Los datos nuevos. Los servicios no se tocan: conservan sus turnos.
 */
export function elegirDuracionTurno(datos, minutos) {
  return { ...datos, turno: { ...datos.turno, duracion_minutos: minutos } };
}

// ─── Duraciones ─────────────────────────────────────────────────────────────

/**
 * slotsPara
 * Cuántos turnos ocupa algo de unos minutos: los más cercanos, entre 1 y
 * SLOTS_MAXIMOS. Ej.: 45 min con turnos de 30 → 2 (60 min).
 * @param {number} minutos
 * @param {number|null} duracion - Largo del turno (null: TURNO_POR_DEFECTO)
 * @returns {number}
 */
export function slotsPara(minutos, duracion) {
  const turno = duracion ?? TURNO_POR_DEFECTO;
  return Math.min(Math.max(Math.round(minutos / turno), 1), SLOTS_MAXIMOS);
}

/**
 * fmtMinutos
 * Una duración para leer: "45 min", "1 h", "1 h 30 min".
 * @param {number} minutos
 * @returns {string}
 */
export function fmtMinutos(minutos) {
  if (!Number.isFinite(minutos)) return '';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/**
 * minutosServicio
 * @param {Object} servicio
 * @param {number|null} duracion - Largo del turno
 * @returns {number|null} cantidad_slots × duracion, o null si falta alguno.
 */
export function minutosServicio(servicio, duracion) {
  const slots = Number(servicio?.cantidad_slots);
  if (!Number.isInteger(slots) || slots < 1 || !duracion) return null;
  return slots * duracion;
}

/**
 * pasoSlots
 * Los turnos después de un toque de - o +, entre 1 y SLOTS_MAXIMOS. Un valor
 * guardado que no es válido arranca desde 1.
 * @param {*} slots - cantidad_slots actual
 * @param {number} sentido - -1 o +1
 * @returns {number}
 */
export function pasoSlots(slots, sentido) {
  const actual = Number.isInteger(slots) ? slots : 1;
  return Math.min(Math.max(actual + sentido, 1), SLOTS_MAXIMOS);
}

/**
 * cambioDeTurno
 * Si el largo del turno cambió desde que se cargaron las duraciones (y hay
 * servicios), el antes y el ahora: la pantalla 9 avisa que los minutos de cada
 * servicio se recalcularon.
 * @param {Object} datos
 * @returns {{antes: number, ahora: number}|null}
 */
export function cambioDeTurno(datos) {
  const antes = Number(datos?.progreso?.turno_de_servicios);
  const ahora = duracionTurno(datos);
  if (lista(datos?.servicios).length === 0 || !ahora || !DURACIONES_TURNO.includes(antes) || antes === ahora) return null;
  return { antes, ahora };
}

/**
 * conTurnoDeServicios (interna)
 * Anota en progreso el largo del turno actual como el de las duraciones.
 * @param {Object} datos
 * @returns {Object}
 */
function conTurnoDeServicios(datos) {
  const ahora = duracionTurno(datos);
  if (!ahora || datos.progreso?.turno_de_servicios === ahora) return datos;
  return { ...datos, progreso: { ...datos.progreso, turno_de_servicios: ahora } };
}

// ─── Servicios ──────────────────────────────────────────────────────────────

/**
 * leerServicios
 * @param {Object} datos
 * @returns {Array<Object>} Los servicios (lista vacía si no hay).
 */
export function leerServicios(datos) {
  return lista(datos?.servicios);
}

/**
 * serviciosComunesDisponibles
 * Los SERVICIOS_COMUNES que todavía no están cargados (sin importar mayúsculas).
 * @param {Object} datos
 * @returns {Array<{nombre: string, minutos: number}>}
 */
export function serviciosComunesDisponibles(datos) {
  const cargados = leerServicios(datos);
  return SERVICIOS_COMUNES.filter((comun) => !cargados.some((s) => mismoNombre(s?.nombre, comun.nombre)));
}

/**
 * agregarServicio
 * Suma un servicio al final, sin precio y con la duración en turnos más
 * cercana a `minutos`. Si es el primero, anota el largo del turno con el que se
 * cargó (cambioDeTurno).
 * @param {Object} datos
 * @param {{nombre: string, minutos?: number}} nuevo
 * @returns {Object} Los datos nuevos.
 */
export function agregarServicio(datos, { nombre, minutos = MINUTOS_SERVICIO_NUEVO }) {
  const servicios = leerServicios(datos);
  const servicio = {
    clave: clavePara(servicios, 's'),
    nombre: (nombre ?? '').trim(),
    precio: null,
    cantidad_slots: slotsPara(minutos, duracionTurno(datos)),
  };
  const nuevos = { ...datos, servicios: [...servicios, servicio] };
  return servicios.length === 0 ? conTurnoDeServicios(nuevos) : nuevos;
}

/**
 * cambiarServicio
 * @param {Object} datos
 * @param {string} clave
 * @param {Object} cambios - Ej. { precio: 8000 } o { cantidad_slots: 2 }
 * @returns {Object} Los datos nuevos (los mismos si no hay servicio con esa clave).
 */
export function cambiarServicio(datos, clave, cambios) {
  const servicios = leerServicios(datos);
  if (!servicios.some((s) => s?.clave === clave)) return datos;
  return { ...datos, servicios: servicios.map((s) => (s?.clave === clave ? { ...s, ...cambios } : s)) };
}

/**
 * quitarServicio
 * @param {Object} datos
 * @param {string} clave
 * @returns {Object} Los datos nuevos.
 */
export function quitarServicio(datos, clave) {
  return { ...datos, servicios: leerServicios(datos).filter((s) => s?.clave !== clave) };
}

/**
 * confirmarServicios
 * El "Seguir" de la pantalla 9: las duraciones quedan vistas con el largo del
 * turno actual, y el aviso de cambioDeTurno se apaga.
 * @param {Object} datos
 * @returns {Object} Los datos nuevos.
 */
export function confirmarServicios(datos) {
  return conTurnoDeServicios(datos);
}

/**
 * errorAlAgregarServicio
 * Por qué no se puede sumar un servicio con ese nombre (largo o repetido), o
 * null si se puede.
 * @param {Object} datos
 * @param {string} nombre
 * @returns {string|null} El mensaje de validaciones.js.
 */
export function errorAlAgregarServicio(datos, nombre) {
  const candidato = agregarServicio(datos, { nombre });
  const campo = `servicios.${candidato.servicios.length - 1}.nombre`;
  return erroresDePantalla(PANTALLA.SERVICIOS, candidato).find((e) => e.campo === campo)?.mensaje ?? null;
}

// ─── Productos ──────────────────────────────────────────────────────────────

/**
 * leerProductos
 * @param {Object} datos
 * @returns {Array<Object>}
 */
export function leerProductos(datos) {
  return lista(datos?.productos);
}

/**
 * respuestaProductos
 * La respuesta de "¿Vendés productos?": 'si' si hay productos o se contestó
 * que sí, 'no' si se tocó "Ahora no", null si no se contestó.
 * @param {Object} datos
 * @returns {'si'|'no'|null}
 */
export function respuestaProductos(datos) {
  if (leerProductos(datos).length > 0 || datos?.progreso?.vende_productos === true) return 'si';
  if (datos?.progreso?.vende_productos === false) return 'no';
  return null;
}

/**
 * contestarVende
 * "Sí": si había productos apartados (de un "Ahora no" anterior) y no hay
 * otros, vuelven.
 * @param {Object} datos
 * @returns {Object}
 */
export function contestarVende(datos) {
  const { productos_apartados: apartados, ...progreso } = datos.progreso ?? {};
  const productos = leerProductos(datos).length === 0 ? lista(apartados) : leerProductos(datos);
  return { ...datos, productos, progreso: { ...progreso, vende_productos: true } };
}

/**
 * contestarNoVende
 * "Ahora no": no se manda ningún producto. Los que había quedan apartados en
 * progreso, por si se vuelve a "Sí" (un toque equivocado no borra lo escrito).
 * @param {Object} datos
 * @returns {Object}
 */
export function contestarNoVende(datos) {
  const productos = leerProductos(datos);
  const progreso = { ...datos.progreso, vende_productos: false };
  if (productos.length > 0) progreso.productos_apartados = productos;
  return { ...datos, productos: [], progreso };
}

/**
 * agregarProducto
 * Suma un producto al final, sin precio ni stock, y con stock mínimo 0 (el
 * default del panel: sin aviso de stock bajo).
 * @param {Object} datos
 * @param {string} nombre
 * @returns {Object}
 */
export function agregarProducto(datos, nombre) {
  const productos = leerProductos(datos);
  const producto = { clave: clavePara(productos, 'p'), nombre: (nombre ?? '').trim(), precio: null, stock: null, stock_minimo: 0 };
  return { ...datos, productos: [...productos, producto] };
}

/**
 * cambiarProducto
 * @param {Object} datos
 * @param {string} clave
 * @param {Object} cambios - Ej. { stock: 10 }
 * @returns {Object}
 */
export function cambiarProducto(datos, clave, cambios) {
  const productos = leerProductos(datos);
  if (!productos.some((p) => p?.clave === clave)) return datos;
  return { ...datos, productos: productos.map((p) => (p?.clave === clave ? { ...p, ...cambios } : p)) };
}

/**
 * quitarProducto
 * @param {Object} datos
 * @param {string} clave
 * @returns {Object}
 */
export function quitarProducto(datos, clave) {
  return { ...datos, productos: leerProductos(datos).filter((p) => p?.clave !== clave) };
}

/**
 * errorAlAgregarProducto
 * @param {Object} datos
 * @param {string} nombre
 * @returns {string|null} El mensaje de validaciones.js, o null si se puede sumar.
 */
export function errorAlAgregarProducto(datos, nombre) {
  const candidato = agregarProducto(datos, nombre);
  const campo = `productos.${candidato.productos.length - 1}.nombre`;
  return erroresDePantalla(PANTALLA.PRODUCTOS, candidato).find((e) => e.campo === campo)?.mensaje ?? null;
}

/**
 * leerEnteroEscrito
 * Lo que quedó en un campo de stock después de una tecla: solo los dígitos,
 * hasta DIGITOS_STOCK_MAXIMOS.
 * @param {string} crudo
 * @returns {number|null|undefined} El número, null si quedó vacío, o undefined
 *   si la tecla se ignora (pasó el tope).
 */
export function leerEnteroEscrito(crudo) {
  const digitos = String(crudo ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (digitos.length > DIGITOS_STOCK_MAXIMOS) return undefined;
  return digitos === '' ? null : Number(digitos);
}

// ─── Resumen (tarjeta "Tu barbería") ────────────────────────────────────────

/**
 * nombresDeItems
 * Los nombres cargados, sin vacíos.
 * @param {Array<{nombre: string}>} items
 * @returns {string[]}
 */
export function nombresDeItems(items) {
  return lista(items).map((item) => (item?.nombre ?? '').trim()).filter(Boolean);
}
