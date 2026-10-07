// /frontend-turnero/src/utils/telefono.js
// Helpers de teléfono: países del selector, topes de dígitos, conversión a/desde
// E.164 y normalización de lo que entrega el autocompletado del navegador.
// Funciones puras (sin React) para poder probarlas con Node.

import { AsYouType, parsePhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';

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
 * telefonoDesdeE164
 * Dado un número en formato E.164 (ej. "+5491133111686"), deriva el país y el
 * número nacional ya formateado, para precargar el campo cuando el cliente
 * vuelve atrás en el wizard. Si no se puede parsear, devuelve null.
 * @param {string} e164 - Número en formato E.164
 * @returns {{ pais: string, nacional: string } | null}
 */
export function telefonoDesdeE164(e164) {
  try {
    const p = parsePhoneNumber(e164);
    return { pais: p.country, nacional: new AsYouType(p.country).input(p.nationalNumber) };
  } catch {
    return null;
  }
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
 * país actual (lo que un tipeo normal nunca produce). En Argentina saca el 9
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
