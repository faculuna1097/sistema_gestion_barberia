// /backend/src/utils/validarTexto.js
// Validación y normalización de los inputs de texto libre de una reserva
// (nombre, teléfono, email). Centraliza los topes de longitud y el formato de
// email que comparten el turnero público (crearTurno) y el backoffice
// (crearTurnoAdmin). Ver auditoría 3.2.

// Topes de longitud de los inputs libres del cliente. Son cotas defensivas: un
// nombre/teléfono legítimo entra holgado. El objetivo no es validar "formato de
// nombre" —imposible y contraproducente— sino cortar el texto-basura de
// kilobytes que sin tope se guardaría crudo en la DB.
export const MAX_NOMBRE = 80;
export const MAX_TELEFONO = 30;

// Regex de email más estricta que la vieja /.+@.+\..+/ (que aceptaba espacios,
// markup y direcciones sin TLD real). Exige local@dominio.tld sin espacios ni @
// extra, con un TLD alfabético de al menos 2 caracteres. No pretende cubrir el
// RFC completo (imposible con una sola regex); la validación real de que el
// email existe es el envío del mail de confirmación.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/**
 * esEmailValido
 * Valida el formato superficial de un email (tras recortar espacios).
 * @param {*} email - Valor recibido del body.
 * @returns {boolean} true si es un string con forma de email válida.
 */
export function esEmailValido(email) {
  return typeof email === 'string' && REGEX_EMAIL.test(email.trim());
}

/**
 * validarContacto
 * Valida y normaliza los datos de contacto de una reserva. `nombre` es siempre
 * requerido; `telefono` y `email` son requeridos solo si `contactoRequerido`
 * (el turnero público los exige; el backoffice los deja opcionales). Además del
 * tope de longitud, fuerza el tipo string y recorta espacios, de modo que el
 * llamador reciba valores ya seguros para insertar.
 *
 * @param {Object} datos - { nombre, telefono, email } crudos del body.
 * @param {boolean} contactoRequerido - si telefono y email son obligatorios.
 * @returns {{ error: string } | { nombre: string, telefono: string|null, email: string|null }}
 *   Un objeto con `error` (mensaje para responder 400) si algo no cumple, o los
 *   valores normalizados (nombre/telefono con trim; email crudo válido o null).
 */
export function validarContacto({ nombre, telefono, email }, contactoRequerido) {
  // ── nombre: siempre requerido ────────────────────────────────────────────
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    return { error: 'nombre es requerido' };
  }
  const nombreTrim = nombre.trim();
  if (nombreTrim.length > MAX_NOMBRE) {
    return { error: `nombre no puede superar los ${MAX_NOMBRE} caracteres` };
  }

  // ── telefono: requerido solo en el turnero público ───────────────────────
  const telefonoPresente = telefono !== undefined && telefono !== null && telefono !== '';
  if (contactoRequerido && !telefonoPresente) {
    return { error: 'telefono es requerido' };
  }
  let telefonoTrim = null;
  if (telefonoPresente) {
    if (typeof telefono !== 'string') {
      return { error: 'telefono debe ser texto' };
    }
    telefonoTrim = telefono.trim();
    if (telefonoTrim.length > MAX_TELEFONO) {
      return { error: `telefono no puede superar los ${MAX_TELEFONO} caracteres` };
    }
  }

  // ── email: requerido solo en el turnero público ──────────────────────────
  const emailPresente = email !== undefined && email !== null && email !== '';
  if (contactoRequerido && !emailPresente) {
    return { error: 'email es requerido' };
  }
  if (emailPresente && !esEmailValido(email)) {
    return { error: 'Email con formato inválido' };
  }

  return { nombre: nombreTrim, telefono: telefonoTrim, email: emailPresente ? email : null };
}
