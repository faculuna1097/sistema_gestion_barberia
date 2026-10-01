// /frontend-landing/src/seo/sitio.js
// Datos del sitio que comparten el JSON-LD y el llms.txt. Solo los importa el
// build SSR (vía entry-server.jsx): no llega al bundle del cliente.

import { MARCA } from '../config/landing.js';

/**
 * URL_SITIO — URL canónica de la landing, con la barra final (la misma que el
 * <link rel="canonical"> y el og:url de index.html).
 */
export const URL_SITIO = `https://${MARCA.dominio}/`;

/**
 * DESCRIPCION — resumen de la landing (§5.2 del plan). Es el mismo texto que
 * la meta description de index.html: scripts/prerender.js corta el build si
 * no coinciden.
 */
export const DESCRIPCION =
  'Turnero online, app para barberos, caja, gastos, planillas y balance del mes en un solo sistema, con barberos ilimitados. Hecho para barberías de Argentina. Primer mes gratis.';
