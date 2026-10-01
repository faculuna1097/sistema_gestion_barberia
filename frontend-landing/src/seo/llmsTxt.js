// /frontend-landing/src/seo/llmsTxt.js
// Genera el llms.txt de la landing (formato de llmstxt.org): un resumen en
// markdown para que los modelos de IA entiendan qué es BarberManager.
// scripts/prerender.js lo escribe en dist/llms.txt. Se arma desde las mismas
// fuentes que la UI (D9). Solo lo importa entry-server.jsx: no llega al bundle
// del cliente.

import { MARCA, CONTACTO, PRECIO } from '../config/landing.js';
import { FAQS } from '../content/faq.js';
import { INCLUYE } from '../content/plan.js';
import { ALTERNATIVAS } from '../content/alternativas.js';
import { fmtPesos } from '../utils/formato.js';
import { linkWhatsApp } from '../utils/contacto.js';
import { URL_SITIO, DESCRIPCION } from './sitio.js';

/**
 * lineasPrecio
 * Arma los ítems de la sección "Precio". Si PRECIO.mensual es null, no
 * muestra monto (mismo criterio que la FAQ: "consultanos el precio").
 * @returns {string[]} Ítems de la lista, sin el guion
 */
function lineasPrecio() {
  const despues = PRECIO.mensual != null
    ? `Después, ${fmtPesos(PRECIO.mensual)} por mes (pesos argentinos) con todo incluido, sin importar cuántos barberos tengas.`
    : 'Después, una suscripción mensual con todo incluido, sin importar cuántos barberos tengas: consultanos el precio.';
  return [
    'El primer mes es gratis.',
    despues,
    'Sin contrato: cancelás cuando quieras.',
  ];
}

/**
 * lineasContacto
 * Arma los ítems de la sección "Contacto". Omite los canales sin configurar.
 * @returns {string[]} Ítems de la lista, sin el guion
 */
function lineasContacto() {
  const lineas = [];
  if (CONTACTO.whatsapp) lineas.push(`WhatsApp: [${CONTACTO.whatsappDisplay}](${linkWhatsApp()})`);
  if (CONTACTO.email) lineas.push(`Email: [${CONTACTO.email}](mailto:${CONTACTO.email})`);
  lineas.push(`Sitio: ${URL_SITIO}`);
  return lineas;
}

/**
 * lista
 * Convierte ítems en una lista de markdown.
 * @param {string[]} items - Textos de cada ítem
 * @returns {string} Una línea "- item" por ítem
 */
function lista(items) {
  return items.map((it) => `- ${it}`).join('\n');
}

/**
 * llmsTxt
 * Genera el contenido completo del llms.txt.
 * @returns {string} Markdown terminado en salto de línea
 */
export function llmsTxt() {
  const secciones = [
    `# ${MARCA.nombre}`,
    `> ${DESCRIPCION}`,
    `## Qué incluye\n\n${lista(INCLUYE)}`,
    `## Precio\n\n${lista(lineasPrecio())}`,
    `## Frente a otras apps de turnos\n\n${lista(
      ALTERNATIVAS.puntos.map((p) => `**${p.titulo}** ${p.texto}`),
    )}\n\n${ALTERNATIVAS.nota}`,
    `## Preguntas frecuentes\n\n${FAQS.map((f) => `### ${f.pregunta}\n\n${f.respuesta}`).join('\n\n')}`,
    `## Contacto\n\n${lista(lineasContacto())}`,
  ];
  return secciones.join('\n\n') + '\n';
}
