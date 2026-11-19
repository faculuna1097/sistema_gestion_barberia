// /frontend/src/utils/credenciales.js
// Reglas y mensajes de las credenciales nuevas: la contraseña del iPad (modo
// operativo) y el PIN de administrador. Las usan los modales de Gestión →
// Seguridad y la pantalla de recuperación por mail (PantallaRecuperacion), así
// los dos lugares piden lo mismo y dicen lo mismo. Espejan las reglas del
// backend (utils/credencialesOperativas.js y utils/pin.js).

// Largo mínimo de la contraseña del iPad.
export const PASSWORD_MIN_CARACTERES = 8;
// Largo exacto del PIN.
export const PIN_LARGO = 4;

/**
 * soloDigitosPin
 * Limpia lo que se escribe en un campo de PIN: solo números, hasta 4.
 * @param {string} texto - Lo que escribió el usuario.
 * @returns {string} Los dígitos, como mucho PIN_LARGO.
 */
export const soloDigitosPin = (texto) => texto.replace(/\D/g, '').slice(0, PIN_LARGO);

/**
 * validarPasswordNueva
 * Una contraseña nueva y su confirmación. Los errores aparecen recién cuando hay
 * algo escrito en ese campo (no se marca en rojo un campo vacío).
 * @param {string} password - La contraseña nueva.
 * @param {string} confirmar - La repetición.
 * @returns {{ errorPassword: string|null, errorConfirmar: string|null, valida: boolean }}
 *   `valida` es true si se puede guardar.
 */
export function validarPasswordNueva(password, confirmar) {
  const largoOk = password.length >= PASSWORD_MIN_CARACTERES;
  const coincide = password === confirmar;
  return {
    errorPassword: password.length > 0 && !largoOk ? `Mínimo ${PASSWORD_MIN_CARACTERES} caracteres.` : null,
    errorConfirmar: confirmar.length > 0 && !coincide ? 'Las contraseñas no coinciden.' : null,
    valida: largoOk && coincide,
  };
}

/**
 * validarPinNuevo
 * Un PIN nuevo y su confirmación. La confirmación se marca recién cuando tiene
 * los 4 dígitos (antes, el usuario todavía está escribiendo).
 * @param {string} pin - El PIN nuevo (solo dígitos).
 * @param {string} confirmar - La repetición.
 * @returns {{ errorConfirmar: string|null, valida: boolean }}
 */
export function validarPinNuevo(pin, confirmar) {
  const completo = pin.length === PIN_LARGO && confirmar.length === PIN_LARGO;
  const coincide = pin === confirmar;
  return {
    errorConfirmar: confirmar.length === PIN_LARGO && !coincide ? 'Los PINs no coinciden.' : null,
    valida: completo && coincide,
  };
}
