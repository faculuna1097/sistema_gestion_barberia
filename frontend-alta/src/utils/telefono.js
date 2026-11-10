// /frontend-alta/src/utils/telefono.js
// Copia de la lógica de frontend-turnero/src/utils/telefono.js (plan §5.7). La
// usan los campos de teléfono de Contacto (fase 5): WhatsApp y teléfono del
// local y el celular del dueño, que se guardan en E.164 (telefonoAE164).
// Helpers de teléfono: países del selector, topes de dígitos, conversión a
// E.164, normalización de lo que entrega el autocompletado del navegador,
// formato para mostrar y link de WhatsApp.
// Funciones puras (sin React) para poder probarlas con Node.

import {
  AsYouType, getCountryCallingCode, parsePhoneNumber, parsePhoneNumberFromString,
} from 'libphonenumber-js';

/**
 * PAISES
 * Países disponibles en el selector de prefijo telefónico: Argentina (default),
 * sus limítrofes y Estados Unidos. `iso` es el código ISO que entiende
 * libphonenumber-js; `bandera` es el emoji (se ve como bandera en mobile y como
 * las siglas "AR"/"BR" en desktop). El prefijo (+54, etc.) lo deriva la librería
 * con getCountryCallingCode, así no duplicamos ese dato.
 */
export const PAISES = [
  { iso: 'AR', nombre: 'Argentina',      bandera: '🇦🇷' },
  { iso: 'BO', nombre: 'Bolivia',        bandera: '🇧🇴' },
  { iso: 'BR', nombre: 'Brasil',         bandera: '🇧🇷' },
  { iso: 'CL', nombre: 'Chile',          bandera: '🇨🇱' },
  { iso: 'PY', nombre: 'Paraguay',       bandera: '🇵🇾' },
  { iso: 'UY', nombre: 'Uruguay',        bandera: '🇺🇾' },
  { iso: 'US', nombre: 'Estados Unidos', bandera: '🇺🇸' },
];

/**
 * MAX_DIGITOS_POR_PAIS
 * Tope de dígitos editables por país: el largo estándar del número (el celular
 * en el caso típico). Al llegar al tope, el input deja de aceptar más dígitos.
 * Para Argentina son 10: libphonenumber considera "posible" también 11 dígitos
 * (la forma con el 9 de celular), pero la entrada estándar son 10, así que lo
 * topamos ahí a propósito.
 */
export const MAX_DIGITOS_POR_PAIS = {
  AR: 10, BO: 8, BR: 11, CL: 9, PY: 9, UY: 9, US: 10,
};

/**
 * TOPE_AR_COMPLETO
 * Dígitos de un número argentino escrito con su prefijo y sin "+": "54 9" + 10
 * ("54 9 11 3311 1686") o "0" + 10 + "15" ("011 15 3311 1686"). Los dos son 13.
 */
const TOPE_AR_COMPLETO = 13;

/**
 * topeDigitos
 * Cuántos dígitos acepta el campo mientras el cliente escribe. Sin "+", el
 * tope del país elegido. Con "+", el número trae el código de país adelante:
 * el tope es ese código más el tope del país al que pertenece (y el 9 de
 * celular en Argentina: "+54 9 11 3311 1686" son 13 dígitos). Así se puede
 * terminar de escribir el número completo, y normalizarTelefonoCompleto lo
 * pasa a país + número nacional en cuanto es válido.
 * Mientras el código todavía no coincide con ningún país de PAISES (ej. "+5"),
 * o si es de otro país, queda el tope del país elegido, como antes.
 * Sin "+", con Argentina elegida, un número que arranca con 54 (el código de
 * país sin el "+") o con 0 (el 0 de la marcación nacional: "011 15 …",
 * "0351 15 …") tampoco es el número nacional de 10 dígitos, que nunca empieza
 * así: el tope sube a TOPE_AR_COMPLETO para poder terminarlo. Cualquier otro
 * número sigue frenando en 10.
 * @param {string} crudo - Valor crudo del input
 * @param {string} pais - ISO del país elegido en el selector
 * @returns {number}
 */
export function topeDigitos(crudo, pais) {
  const tope = MAX_DIGITOS_POR_PAIS[pais] ?? 15;
  if (!crudo.trim().startsWith('+')) {
    const conPrefijo = pais === 'AR' && /^(54|0)/.test(crudo.replace(/\D/g, ''));
    return conPrefijo ? TOPE_AR_COMPLETO : tope;
  }
  const digitos = crudo.replace(/\D/g, '');
  const destino = PAISES.find((p) => digitos.startsWith(getCountryCallingCode(p.iso)));
  if (!destino) return tope;
  const nueveDeCelular = destino.iso === 'AR' ? 1 : 0;
  return getCountryCallingCode(destino.iso).length + MAX_DIGITOS_POR_PAIS[destino.iso] + nueveDeCelular;
}

/**
 * telefonoAE164
 * Convierte el número nacional escrito + el país elegido a formato E.164, que es
 * lo que se guarda. Devuelve null si no se puede parsear (no debería pasar si el
 * form es válido).
 * @param {string} nacional - Número nacional formateado (lo que se ve en el input)
 * @param {string} pais - ISO del país elegido
 * @returns {string | null}
 */
export function telefonoAE164(nacional, pais) {
  try {
    return parsePhoneNumber(nacional, pais).number;
  } catch {
    return null;
  }
}

/**
 * normalizarTelefonoCompleto
 * Interpreta un número completo pegado o autocompletado por el navegador
 * (ej. "+54 9 11 3311-1686" o "011 15-3311-1686") y lo lleva a la forma del
 * form: país del selector + número nacional formateado, sin superar el tope de
 * dígitos del país.
 *
 * Solo actúa si el valor empieza con "+" o trae más dígitos que el tope del
 * país actual (el número nacional tipeado nunca lo pasa; sí uno con su
 * prefijo, ver topeDigitos). En Argentina saca el 9
 * de celular del número nacional (11 → 10 dígitos), porque el form trabaja con
 * los 10 dígitos estándar y el E.164 se arma igual con `telefonoAE164`.
 *
 * @param {string} crudo - Valor crudo del input
 * @param {string} paisActual - ISO del país elegido hoy en el selector (default del parseo)
 * @returns {{ pais: string, nacional: string } | null} null si no aplica, no se
 *   puede parsear o el país no está en PAISES: el caller mantiene su comportamiento.
 */
export function normalizarTelefonoCompleto(crudo, paisActual) {
  const digitos = crudo.replace(/\D/g, '');
  const tope = MAX_DIGITOS_POR_PAIS[paisActual] ?? 15;
  if (!crudo.trim().startsWith('+') && digitos.length <= tope) return null;

  // parsePhoneNumberFromString no lanza: devuelve undefined si no puede parsear.
  const p = parsePhoneNumberFromString(crudo, paisActual);
  if (!p || !p.isValid() || !PAISES.some((x) => x.iso === p.country)) return null;

  let nacional = p.nationalNumber;
  if (p.country === 'AR' && nacional.length === 11 && nacional.startsWith('9')) {
    nacional = nacional.slice(1);
  }
  return { pais: p.country, nacional: new AsYouType(p.country).input(nacional) };
}

/**
 * fmtTelefono
 * Formatea un teléfono para mostrarlo (ej. en la tarjeta "Tu barbería").
 * Sin código de país se lo toma como argentino. Un número argentino va como se
 * escribe hoy: característica + número, sin el 0 ni el 15 de la marcación
 * nacional (que es lo que devuelve `formatNational`: "011 15-3311-1686") y sin
 * el 9 de celular. Uno de otro país, en internacional (con su +código).
 * @param {string} tel - Teléfono como está guardado (ej. "1133111686", "+541133111686" o "+5491133111686")
 * @returns {string} Ej: "11 3311-1686". Si no se puede interpretar como un
 *   número válido, el texto tal cual.
 */
export function fmtTelefono(tel) {
  // parsePhoneNumberFromString no lanza: devuelve undefined si no puede parsear.
  const p = parsePhoneNumberFromString(tel, 'AR');
  if (!p || !p.isValid()) return tel;
  if (p.country !== 'AR') return p.formatInternational();
  // El número nacional de un celular trae el 9 adelante (11 dígitos): se saca,
  // igual que en normalizarTelefonoCompleto.
  let nacional = p.nationalNumber;
  if (nacional.length === 11 && nacional.startsWith('9')) nacional = nacional.slice(1);
  return new AsYouType('AR').input(nacional);
}

/**
 * linkWhatsApp
 * Arma el link para abrir un chat de WhatsApp con un número.
 * @param {string} e164 - Número en formato E.164 (ej. "+5491133111686")
 * @returns {string} Ej: "https://wa.me/5491133111686"
 */
export function linkWhatsApp(e164) {
  return `https://wa.me/${e164.replace(/\D/g, '')}`;
}
