// /backend/src/utils/contactoNegocio.js
// Validación y normalización de los datos de contacto del negocio que viven en
// `tenant`: el mail y el celular del dueño (a dónde llega la recuperación de la
// contraseña del iPad y del PIN admin) y el teléfono público del local (el `tel:`
// del turnero). Único lugar donde viven estas reglas: las usan Gestión → Negocio
// (controllers/gestion.js → editarContactoNegocio) y el alta por script
// (scripts/crearTenant.js). La plantilla de la skill alta-cliente toma los datos
// del formulario de alta, que ya los validó con las mismas funciones de base
// (esEmailValido, esTelefonoE164).
//
// La DB tiene sus CHECK (tenant_email_duenio_formato, tenant_telefono_duenio_e164),
// más laxos que estas reglas: lo que pasa acá, pasa allá.

import { esEmailValido, esTelefonoE164, MAX_TELEFONO } from './validarTexto.js';

// Largo máximo de una dirección de mail (RFC 5321).
export const MAX_EMAIL = 254;

/**
 * vacio
 * @param {*} valor
 * @returns {boolean} true si es undefined, null o un texto vacío (o solo espacios).
 */
const vacio = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

/**
 * validarContactoNegocio
 * Valida y normaliza el contacto del negocio. Corta en el primer error, en el
 * orden email → celular → teléfono del local.
 *
 * @param {Object} datos
 * @param {*} datos.email_duenio    - Obligatorio. Se recorta y se pasa a minúsculas.
 * @param {*} datos.telefono_duenio - Obligatorio, en E.164 (ej. '+5491133111686').
 * @param {*} [datos.telefono_local] - Opcional, texto libre de hasta MAX_TELEFONO
 *   caracteres. Vacío o ausente se guarda como null.
 * @returns {{ error: string, campo: string } | { valores: { email_duenio: string, telefono_duenio: string, telefono_local: string|null } }}
 *   `error` y `campo` (para responder 400) si algo no cumple; si no, los valores
 *   listos para guardar.
 */
export function validarContactoNegocio({ email_duenio, telefono_duenio, telefono_local }) {
  // ── Mail del dueño ──────────────────────────────────────────────────────
  if (vacio(email_duenio)) {
    return { error: 'El mail del dueño es obligatorio', campo: 'email_duenio' };
  }
  if (typeof email_duenio !== 'string') {
    return { error: 'El mail del dueño debe ser texto', campo: 'email_duenio' };
  }
  const email = email_duenio.trim().toLowerCase();
  if (email.length > MAX_EMAIL) {
    return { error: `El mail del dueño puede tener hasta ${MAX_EMAIL} caracteres`, campo: 'email_duenio' };
  }
  if (!esEmailValido(email)) {
    return { error: 'El mail del dueño no es válido', campo: 'email_duenio' };
  }

  // ── Celular del dueño ───────────────────────────────────────────────────
  if (vacio(telefono_duenio)) {
    return { error: 'El celular del dueño es obligatorio', campo: 'telefono_duenio' };
  }
  if (!esTelefonoE164(telefono_duenio)) {
    return { error: 'El celular del dueño no es un número válido (formato internacional, ej. +5491133111686)', campo: 'telefono_duenio' };
  }

  // ── Teléfono del local (opcional) ───────────────────────────────────────
  let telefonoLocal = null;
  if (!vacio(telefono_local)) {
    if (typeof telefono_local !== 'string') {
      return { error: 'El teléfono del local debe ser texto', campo: 'telefono_local' };
    }
    telefonoLocal = telefono_local.trim();
    if (telefonoLocal.length > MAX_TELEFONO) {
      return { error: `El teléfono del local puede tener hasta ${MAX_TELEFONO} caracteres`, campo: 'telefono_local' };
    }
  }

  return {
    valores: {
      email_duenio: email,
      telefono_duenio: telefono_duenio.trim(),
      telefono_local: telefonoLocal,
    },
  };
}
