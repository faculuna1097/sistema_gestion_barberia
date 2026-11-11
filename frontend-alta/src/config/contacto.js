// /frontend-alta/src/config/contacto.js
// A quién le escribe el cliente cuando algo no funciona (link vencido o que no
// existe): Facundo, por WhatsApp.

/**
 * CONTACTO_WHATSAPP
 * Número de WhatsApp de Facundo, en E.164 sin el "+" (la forma que usa wa.me).
 */
export const CONTACTO_WHATSAPP = '5491133111686';

/**
 * linkWhatsAppContacto
 * Arma el link para abrir un chat con Facundo, con un mensaje ya escrito.
 * @param {string} mensaje - Texto precargado en el chat
 * @returns {string} Ej: 'https://wa.me/5491133111686?text=Hola...'
 */
export function linkWhatsAppContacto(mensaje) {
  return `https://wa.me/${CONTACTO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}
