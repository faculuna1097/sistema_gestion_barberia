// /backend/src/utils/credencialesOperativas.js
// Reglas y hasheo de las credenciales del modo operativo. Único lugar donde viven:
// las usan los scripts de alta (crearTenant.js y generarHashOperativo.js) y el panel
// de gestión (controllers/adminOperativo.js). El panel importa los mínimos y arma
// sus propios mensajes, porque ahí usuario y password son opcionales.

import bcrypt from 'bcrypt';

export const USUARIO_MIN_CARACTERES = 3;
export const PASSWORD_MIN_CARACTERES = 8;
const SALT_ROUNDS = 10;

/**
 * errorCredencialesOperativas
 * Valida el usuario y la password operativos recibidos por argumento.
 * @param {string} usuario  - Usuario operativo en texto plano.
 * @param {string} password - Password operativa en texto plano.
 * @returns {string|null} El mensaje de error, o null si son válidos.
 */
export function errorCredencialesOperativas(usuario, password) {
  if (usuario.length < USUARIO_MIN_CARACTERES) {
    return `el usuario debe tener al menos ${USUARIO_MIN_CARACTERES} caracteres.`;
  }
  if (password.length < PASSWORD_MIN_CARACTERES) {
    return `la password debe tener al menos ${PASSWORD_MIN_CARACTERES} caracteres.`;
  }
  return null;
}

/**
 * hashearPasswordOperativa
 * Hashea la password operativa con bcrypt.
 * @param {string} password - Password operativa en texto plano.
 * @returns {Promise<string>} El hash para guardar en tenant.operativo_password_hash.
 */
export const hashearPasswordOperativa = (password) => bcrypt.hash(password, SALT_ROUNDS);
