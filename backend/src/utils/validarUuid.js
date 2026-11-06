// /backend/src/utils/validarUuid.js
// Validador central de los ids que llegan del cliente. Corta un id mal formado
// antes de tocar la DB, donde daría el error 22P02 de Postgres (500). Qué se
// responde lo decide cada controller: en la URL o en el body es "no existe" (404);
// en un query param, 400.

// Forma canónica de un uuid, sin mirar la versión. Postgres también acepta otras
// (con llaves, sin guiones), pero ningún front las manda y las llaves rompen en
// `ANY($n::uuid[])`.
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mensaje del 400 de un barbero_id mal formado en un query param.
export const MENSAJE_BARBERO_ID_INVALIDO = 'barbero_id debe ser un UUID válido';

/**
 * esUUID
 * Valida que un valor sea un uuid en su forma canónica (mayúsculas o minúsculas).
 * @param {*} valor - Valor recibido de la URL, del body o de la query.
 * @returns {boolean} true si es un string con formato de uuid.
 */
export function esUUID(valor) {
  return typeof valor === 'string' && REGEX_UUID.test(valor);
}
