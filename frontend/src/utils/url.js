// /frontend/src/utils/url.js
// Helpers de URLs que llegan de la API. Sin estado, sin dependencias.

/**
 * esUrlHttps
 * Dice si un valor es una URL absoluta con protocolo https (tras recortar
 * espacios). Es el chequeo antes de abrir un link que se carga en la DB, como el
 * booking_url del botón "Reservar" del iPad: un `javascript:` pasado a
 * window.open corre en el origen del panel (auditoría 2026-11, Z3-06). Misma regla
 * que esUrlHttps del backend (backend/src/utils/validarTexto.js), que lo valida al
 * guardar; los fronts no comparten código con el backend.
 * @param {*} valor - Lo que llegó de la API (puede ser null o no ser texto).
 * @returns {boolean} true si es un string con una URL https válida.
 */
export function esUrlHttps(valor) {
  if (typeof valor !== 'string') return false;
  try {
    return new URL(valor.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}
