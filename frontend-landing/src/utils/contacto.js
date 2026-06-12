// /frontend-landing/src/utils/contacto.js
// Construye los links de contacto (WhatsApp / email) a partir de la config
// central. Centralizado para que los CTA de todas las secciones usen el mismo
// número, mail y mensajes pre-cargados sin repetir strings.

import { CONTACTO } from '../config/landing.js';

/**
 * linkWhatsApp
 * Arma el link de WhatsApp con un mensaje pre-cargado.
 * @param {string} [mensaje] - Texto inicial del chat. Default: el de la config.
 * @returns {string} URL wa.me lista para un <a href>.
 */
export function linkWhatsApp(mensaje = CONTACTO.mensajeWhatsApp) {
  return `https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * linkEmail
 * Arma un mailto con asunto y cuerpo pre-cargados.
 * @param {Object} [opts]
 * @param {string} [opts.asunto] - Asunto del mail. Default: el de la config.
 * @param {string} [opts.cuerpo] - Cuerpo del mail. Default: el de la config.
 * @returns {string} URL mailto lista para un <a href>.
 */
export function linkEmail({ asunto = CONTACTO.asuntoEmail, cuerpo = CONTACTO.cuerpoEmail } = {}) {
  const params = new URLSearchParams({ subject: asunto, body: cuerpo });
  return `mailto:${CONTACTO.email}?${params.toString()}`;
}
