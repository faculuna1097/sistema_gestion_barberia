// /frontend-landing/src/seo/datosEstructurados.js
// Datos estructurados (JSON-LD de schema.org) de la landing (D10 del plan).
// scripts/prerender.js los inyecta en el <head> de dist/index.html. Se arman
// desde las mismas fuentes que la UI (D9): config, FAQ y lo que incluye el
// plan. Solo los importa entry-server.jsx: no llegan al bundle del cliente.

import { MARCA, CONTACTO, PRECIO } from '../config/landing.js';
import { FAQS } from '../content/faq.js';
import { INCLUYE } from '../content/plan.js';
import { linkWhatsApp } from '../utils/contacto.js';
import { URL_SITIO, DESCRIPCION } from './sitio.js';

// Ids de los nodos del @graph, para que se referencien entre sí.
const ID_ORGANIZACION = `${URL_SITIO}#organizacion`;
const ID_SOFTWARE = `${URL_SITIO}#software`;
const ID_FAQ = `${URL_SITIO}#faq`;

/**
 * organizacion
 * Nodo Organization: la marca, su logo y el contacto comercial por WhatsApp.
 * Si no hay WhatsApp configurado, se omite el contactPoint.
 * @returns {Object} Nodo Organization de schema.org
 */
function organizacion() {
  const nodo = {
    '@type': 'Organization',
    '@id': ID_ORGANIZACION,
    name: MARCA.nombre,
    url: URL_SITIO,
    logo: `${URL_SITIO}logo.png`,
  };
  if (CONTACTO.whatsapp) {
    nodo.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: `+${CONTACTO.whatsapp}`,
      url: linkWhatsApp(),
      areaServed: 'AR',
      availableLanguage: 'es',
    };
  }
  return nodo;
}

/**
 * oferta
 * Nodo Offer de la suscripción mensual. Si PRECIO.mensual es null, se omite
 * el precio (queda la oferta con el área de cobertura).
 * @returns {Object} Nodo Offer de schema.org
 */
function oferta() {
  const nodo = {
    '@type': 'Offer',
    areaServed: { '@type': 'Country', name: 'Argentina' },
  };
  if (PRECIO.mensual != null) {
    nodo.price = PRECIO.mensual;
    nodo.priceCurrency = PRECIO.moneda;
    // Precio por mes: unitCode MON = mes (códigos UN/CEFACT).
    nodo.priceSpecification = {
      '@type': 'UnitPriceSpecification',
      price: PRECIO.mensual,
      priceCurrency: PRECIO.moneda,
      unitCode: 'MON',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
    };
  }
  return nodo;
}

/**
 * software
 * Nodo SoftwareApplication: el producto, qué incluye y su precio.
 * @returns {Object} Nodo SoftwareApplication de schema.org
 */
function software() {
  return {
    '@type': 'SoftwareApplication',
    '@id': ID_SOFTWARE,
    name: MARCA.nombre,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: DESCRIPCION,
    url: URL_SITIO,
    inLanguage: 'es-AR',
    featureList: INCLUYE,
    publisher: { '@id': ID_ORGANIZACION },
    offers: oferta(),
  };
}

/**
 * preguntasFrecuentes
 * Nodo FAQPage con las preguntas de la FAQ visible, con los textos idénticos.
 * @returns {Object} Nodo FAQPage de schema.org
 */
function preguntasFrecuentes() {
  return {
    '@type': 'FAQPage',
    '@id': ID_FAQ,
    url: URL_SITIO,
    inLanguage: 'es-AR',
    mainEntity: FAQS.map(({ pregunta, respuesta }) => ({
      '@type': 'Question',
      name: pregunta,
      acceptedAnswer: { '@type': 'Answer', text: respuesta },
    })),
  };
}

/**
 * datosEstructurados
 * Arma el JSON-LD completo de la landing.
 * @returns {Object} Objeto con @context y un @graph con Organization,
 *   SoftwareApplication y FAQPage, listo para JSON.stringify.
 */
export function datosEstructurados() {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizacion(), software(), preguntasFrecuentes()],
  };
}
