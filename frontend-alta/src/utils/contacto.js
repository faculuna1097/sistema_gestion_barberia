// /frontend-alta/src/utils/contacto.js
// El capítulo "Contacto" (pantallas 11 y 12): el WhatsApp, el teléfono y el
// link de reseñas del local, y el contacto del dueño.
//
// Los teléfonos se guardan en E.164 (plan §5.4), que es lo que valida el
// backend. Mientras el número no está completo no hay E.164: en el campo de
// `datos` queda lo escrito (y validaciones.js dice que no es válido), y lo que
// se ve en el campo (el país y el número con su formato) va en
// progreso.telefonos.<id>, así al recargar se retoma igual, también con un
// país que no es Argentina.
//
// "Es el mismo número para llamadas" (progreso.mismo_numero, prendido por
// defecto): mientras está prendido, local.telefono es una copia de
// local.whatsapp. Al apagarlo, el teléfono propio arranca vacío (o vuelve el
// que se había escrito antes, que queda en progreso.telefono_propio).
//
// Otras marcas de interfaz en progreso (el backend descarta cualquier clave
// fuera de §5.6):
//   - progreso.resena_despues: se tocó "Lo paso después".
//   - progreso.contacto_precargado: el nombre del contacto ya se precargó con
//     el del primer dueño (si el cliente lo borra, no se vuelve a poner).
//
// Todas las funciones de cambio reciben `datos` y devuelven `datos` nuevos.
// Funciones puras (sin React) para poder probarlas con Node.
// Las de teléfonos usan libphonenumber-js, que se carga aparte
// (utils/libTelefono.js): las pantallas de Contacto esperan a tenerla.

import { libTelefono } from './libTelefono.js';
import {
  PAISES, normalizarTelefonoCompleto, telefonoAE164, topeDigitos,
} from './telefono.js';
import { leerEquipo } from './equipo.js';

/**
 * TELEFONOS
 * Los tres teléfonos del formulario: dónde se guarda cada uno en `datos`.
 */
export const TELEFONOS = {
  whatsapp: ['local', 'whatsapp'],
  telefono: ['local', 'telefono'],
  celular: ['contacto', 'celular'],
};

/**
 * PAIS_POR_DEFECTO
 * El país con el que arranca un teléfono vacío.
 */
export const PAIS_POR_DEFECTO = 'AR';

/**
 * valorGuardado (interna)
 * @param {Object} datos
 * @param {string} id - Clave de TELEFONOS
 * @returns {string} Lo guardado en `datos` para ese teléfono ('' si no hay).
 */
function valorGuardado(datos, id) {
  const [seccion, campo] = TELEFONOS[id];
  const valor = datos?.[seccion]?.[campo];
  return typeof valor === 'string' ? valor : '';
}

/**
 * esPaisConocido (interna)
 * @param {*} iso
 * @returns {boolean} true si es uno de PAISES.
 */
const esPaisConocido = (iso) => PAISES.some((p) => p.iso === iso);

/**
 * leerTelefono
 * Lo que se ve en el campo de un teléfono: el país y el número nacional con su
 * formato. Sale de progreso.telefonos; si no está (ej. datos de antes, o
 * llegados de otro lado), se arma desde lo guardado en `datos`.
 * @param {Object} datos
 * @param {string} id - 'whatsapp' | 'telefono' | 'celular'
 * @returns {{pais: string, nacional: string}}
 */
export function leerTelefono(datos, id) {
  const enProgreso = datos?.progreso?.telefonos?.[id];
  if (enProgreso && esPaisConocido(enProgreso.pais) && typeof enProgreso.nacional === 'string') {
    return { pais: enProgreso.pais, nacional: enProgreso.nacional };
  }
  const guardado = valorGuardado(datos, id).trim();
  if (guardado === '') return { pais: PAIS_POR_DEFECTO, nacional: '' };
  const completo = guardado.startsWith('+') ? normalizarTelefonoCompleto(guardado, PAIS_POR_DEFECTO) : null;
  return completo ?? { pais: PAIS_POR_DEFECTO, nacional: guardado };
}

/**
 * valorParaGuardar
 * Lo que va en `datos` para un número escrito: su E.164 si es válido; si no,
 * lo escrito (recortado), que validaciones.js marca como inválido.
 * @param {{pais: string, nacional: string}} telefono
 * @returns {string}
 */
export function valorParaGuardar({ pais, nacional }) {
  const recortado = (nacional ?? '').trim();
  if (recortado === '') return '';
  if (libTelefono().isValidPhoneNumber(recortado, pais)) return telefonoAE164(recortado, pais) ?? recortado;
  return recortado;
}

/**
 * escribirTelefono
 * El campo de un teléfono después de una tecla (la lógica del turnero,
 * ConfirmarTurno → handleTelefonoChange): formatea mientras se escribe
 * (AsYouType), frena en el tope de dígitos del país y, si llega un número
 * completo (pegado, autocompletado o con "+"), ajusta el país.
 * @param {string} crudo - El valor del input
 * @param {string} pais - ISO del país elegido
 * @returns {{pais: string, nacional: string}|null} El campo nuevo, o null si la
 *   tecla se ignora (pasó el tope).
 */
export function escribirTelefono(crudo, pais) {
  const completo = normalizarTelefonoCompleto(crudo, pais);
  if (completo) return completo;
  if (crudo.replace(/\D/g, '').length > topeDigitos(crudo, pais)) return null;
  // Con "+" adelante, AsYouType sin país formatea en internacional.
  return { pais, nacional: new (libTelefono().AsYouType)(pais).input(crudo) };
}

/**
 * mismoNumero
 * @param {Object} datos
 * @returns {boolean} "Es el mismo número para llamadas" (sin marca, prendido).
 */
export function mismoNumero(datos) {
  return datos?.progreso?.mismo_numero !== false;
}

/**
 * conTelefono (interna)
 * Escribe un teléfono en `datos` y en progreso.telefonos.
 * @param {Object} datos
 * @param {string} id
 * @param {{pais: string, nacional: string}} telefono
 * @returns {Object}
 */
function conTelefono(datos, id, telefono) {
  const [seccion, campo] = TELEFONOS[id];
  return {
    ...datos,
    [seccion]: { ...datos[seccion], [campo]: valorParaGuardar(telefono) },
    progreso: {
      ...datos.progreso,
      telefonos: { ...datos.progreso?.telefonos, [id]: { pais: telefono.pais, nacional: telefono.nacional } },
    },
  };
}

/**
 * cambiarTelefono
 * Guarda un teléfono. Si es el WhatsApp y "mismo número" está prendido, el
 * teléfono del local queda igual.
 * @param {Object} datos
 * @param {string} id - 'whatsapp' | 'telefono' | 'celular'
 * @param {{pais: string, nacional: string}} telefono
 * @returns {Object}
 */
export function cambiarTelefono(datos, id, telefono) {
  const nuevos = conTelefono(datos, id, telefono);
  if (id === 'whatsapp' && mismoNumero(datos)) return conTelefono(nuevos, 'telefono', telefono);
  return nuevos;
}

/**
 * cambiarMismoNumero
 * Prende o apaga "Es el mismo número para llamadas".
 *   - Prendido: el teléfono pasa a ser el WhatsApp. El que se había escrito
 *     queda apartado en progreso.telefono_propio.
 *   - Apagado: vuelve el teléfono apartado, o queda vacío para escribirlo.
 * @param {Object} datos
 * @param {boolean} mismo
 * @returns {Object}
 */
export function cambiarMismoNumero(datos, mismo) {
  if (mismo === mismoNumero(datos)) return datos;
  const progreso = { ...datos.progreso, mismo_numero: mismo };
  if (mismo) {
    const propio = leerTelefono(datos, 'telefono');
    const conPropio = propio.nacional.trim() !== '' && valorGuardado(datos, 'telefono') !== valorGuardado(datos, 'whatsapp')
      ? { ...progreso, telefono_propio: propio }
      : progreso;
    return conTelefono({ ...datos, progreso: conPropio }, 'telefono', leerTelefono(datos, 'whatsapp'));
  }
  const { telefono_propio: apartado, ...resto } = progreso;
  const telefono = apartado && esPaisConocido(apartado.pais) ? apartado : { pais: leerTelefono(datos, 'whatsapp').pais, nacional: '' };
  return conTelefono({ ...datos, progreso: resto }, 'telefono', telefono);
}

/**
 * whatsappValido
 * @param {Object} datos
 * @returns {boolean} true si el WhatsApp del local ya es un número completo (E.164).
 */
export function whatsappValido(datos) {
  return /^\+[1-9]\d{7,14}$/.test(valorGuardado(datos, 'whatsapp'));
}

/**
 * usarWhatsappComoCelular
 * El atajo de la pantalla 12: el celular del dueño pasa a ser el WhatsApp del local.
 * @param {Object} datos
 * @returns {Object}
 */
export function usarWhatsappComoCelular(datos) {
  return conTelefono(datos, 'celular', leerTelefono(datos, 'whatsapp'));
}

/**
 * completarLinkResena
 * Al salir del campo del link de reseñas: si se pegó sin "https://" (ej.
 * "g.page/r/abc/review"), se le pone adelante. Lo que ya trae un esquema
 * (http:// incluido) queda como está, y validaciones.js dice si sirve.
 * @param {string} valor
 * @returns {string} El link recortado (y completado si hizo falta).
 */
export function completarLinkResena(valor) {
  const recortado = (valor ?? '').trim();
  if (recortado === '' || /^[a-z][a-z\d+.-]*:/i.test(recortado)) return recortado;
  // Parece un dominio con algo después ("g.page/…", "maps.app.goo.gl/…").
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(recortado)) return `https://${recortado}`;
  return recortado;
}

/**
 * cambiarResena
 * @param {Object} datos
 * @param {string} url
 * @returns {Object}
 */
export function cambiarResena(datos, url) {
  return { ...datos, local: { ...datos.local, resena_url: url } };
}

/**
 * pasarResenaDespues
 * "Lo paso después": el link queda vacío (es opcional) y la marca, en progreso.
 * @param {Object} datos
 * @param {boolean} despues - false para volver a mostrar el campo
 * @returns {Object}
 */
export function pasarResenaDespues(datos, despues) {
  return {
    ...datos,
    local: despues ? { ...datos.local, resena_url: '' } : datos.local,
    progreso: { ...datos.progreso, resena_despues: despues },
  };
}

/**
 * resenaParaDespues
 * @param {Object} datos
 * @returns {boolean} true si se tocó "Lo paso después" y no hay link escrito.
 */
export function resenaParaDespues(datos) {
  return datos?.progreso?.resena_despues === true && (datos?.local?.resena_url ?? '').trim() === '';
}

/**
 * precargarNombreContacto
 * Al llegar a la pantalla 12: si el nombre del contacto está vacío y nunca se
 * precargó, va el del primer dueño. Si no hay dueños, o ya se precargó una vez
 * (el cliente lo pudo haber borrado a propósito), no cambia nada.
 * @param {Object} datos
 * @returns {Object} Los datos nuevos, o los mismos si no hay nada que precargar.
 */
export function precargarNombreContacto(datos) {
  if (datos?.progreso?.contacto_precargado === true) return datos;
  if ((datos?.contacto?.nombre ?? '').trim() !== '') return datos;
  const [primero] = leerEquipo(datos).duenios;
  if (!primero) return datos;
  return {
    ...datos,
    contacto: { ...datos.contacto, nombre: primero },
    progreso: { ...datos.progreso, contacto_precargado: true },
  };
}

/**
 * cambiarContacto
 * @param {Object} datos
 * @param {Object} cambios - { nombre } o { email }
 * @returns {Object}
 */
export function cambiarContacto(datos, cambios) {
  return { ...datos, contacto: { ...datos.contacto, ...cambios } };
}
