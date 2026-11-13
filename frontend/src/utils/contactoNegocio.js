// /frontend/src/utils/contactoNegocio.js
// Validación del contacto del negocio (Gestión → Negocio → Contacto): el mail y
// el celular del dueño y el teléfono del local. Espeja las reglas del backend
// (backend/src/utils/contactoNegocio.js y validarTexto.js): lo que pasa acá, pasa
// allá. El backend sigue siendo el que manda; si responde un 400 con `campo`, el
// error va a ese campo igual que uno de acá.
//
// El celular: casi todos los locales son de Argentina, así que se acepta como lo
// escribe cualquiera (código de área y número, con o sin espacios, guiones,
// paréntesis, 0 o 54) y se pasa a E.164 (+549…). Un número de otro país se
// escribe con su "+".

// Largo máximo de una dirección de mail (RFC 5321). Igual que el backend.
export const MAX_EMAIL = 254;
// Largo máximo del teléfono del local (MAX_TELEFONO del backend).
export const MAX_TELEFONO_LOCAL = 30;

// Mismas regex que backend/src/utils/validarTexto.js.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const REGEX_TELEFONO_E164 = /^\+[1-9]\d{7,14}$/;

// Largo de un celular argentino sin el país: código de área + número (ej. 11 3311-1686).
const DIGITOS_CELULAR_AR = 10;

/**
 * normalizarCelular
 * Pasa un celular escrito a mano a E.164. Saca espacios, guiones, puntos y
 * paréntesis, y completa el país si es un número argentino:
 *   '11 3311-1686'      → '+5491133111686' (10 dígitos: código de área y número)
 *   '011 3311 1686'     → '+5491133111686' (con el 0 adelante)
 *   '54 9 11 3311 1686' → '+5491133111686'
 *   '+54 11 3311 1686'  → '+541133111686' (con "+" se respeta lo escrito: no valida
 *                          como celular argentino, pero es E.164; lo decide quien lo escribe)
 * Lo que no se reconoce queda sin "+", y la validación lo rechaza.
 * @param {string} texto - Lo que escribió el usuario.
 * @returns {string} El número en E.164, o '' si estaba vacío, o lo limpiado si no
 *   se pudo interpretar.
 */
export function normalizarCelular(texto) {
  const recortado = (texto ?? '').trim();
  if (!recortado) return '';
  const digitos = recortado.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  if (recortado.startsWith('+')) return `+${digitos}`;

  const sinCero = digitos.replace(/^0/, '');
  if (sinCero.length === DIGITOS_CELULAR_AR) return `+549${sinCero}`;
  if (sinCero.startsWith('549') && sinCero.length === DIGITOS_CELULAR_AR + 3) return `+${sinCero}`;
  if (sinCero.startsWith('54') && sinCero.length === DIGITOS_CELULAR_AR + 2) return `+549${sinCero.slice(2)}`;
  return digitos;
}

/**
 * validarContactoNegocio
 * Valida el contacto completo y devuelve los errores de todos los campos a la vez
 * (en el backend corta en el primero; acá se marcan todos para corregirlos juntos).
 * @param {Object} datos - Lo escrito en el formulario.
 * @param {string} datos.email_duenio
 * @param {string} datos.telefono_duenio
 * @param {string} datos.telefono_local
 * @returns {{ errores: Object<string, string>, valores: { email_duenio: string, telefono_duenio: string, telefono_local: string|null } }}
 *   `errores` por campo (vacío si está todo bien) y los valores listos para mandar.
 */
export function validarContactoNegocio({ email_duenio, telefono_duenio, telefono_local }) {
  const errores = {};

  const email = (email_duenio ?? '').trim().toLowerCase();
  if (!email) errores.email_duenio = 'El mail del dueño es obligatorio.';
  else if (email.length > MAX_EMAIL) errores.email_duenio = `El mail puede tener hasta ${MAX_EMAIL} caracteres.`;
  else if (!REGEX_EMAIL.test(email)) errores.email_duenio = 'Revisá el mail: tiene que ser como nombre@dominio.com.';

  const celular = normalizarCelular(telefono_duenio);
  if (!celular) errores.telefono_duenio = 'El celular del dueño es obligatorio.';
  else if (!REGEX_TELEFONO_E164.test(celular)) {
    errores.telefono_duenio = 'Revisá el celular: código de área y número, ej. 11 3311-1686.';
  }

  const local = (telefono_local ?? '').trim();
  if (local.length > MAX_TELEFONO_LOCAL) {
    errores.telefono_local = `El teléfono del local puede tener hasta ${MAX_TELEFONO_LOCAL} caracteres.`;
  }

  return {
    errores,
    valores: { email_duenio: email, telefono_duenio: celular, telefono_local: local || null },
  };
}

/**
 * formatearCelular
 * Muestra un celular guardado en E.164 de forma legible. Los argentinos de la
 * zona del AMBA (+54 9 11) se agrupan como se dicen; el resto, con el país aparte.
 *   '+5491133111686' → '+54 9 11 3311-1686'
 *   '+5493514567890' → '+54 9 3514567890'
 * @param {string|null} e164 - El número guardado.
 * @returns {string} El número para mostrar ('' si no hay).
 */
export function formatearCelular(e164) {
  if (!e164) return '';
  const amba = e164.match(/^\+54911(\d{4})(\d{4})$/);
  if (amba) return `+54 9 11 ${amba[1]}-${amba[2]}`;
  const ar = e164.match(/^\+549(\d{10})$/);
  if (ar) return `+54 9 ${ar[1]}`;
  return e164;
}
