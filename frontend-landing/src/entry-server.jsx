// /frontend-landing/src/entry-server.jsx
// Entrada del build SSR (solo se usa en el pre-renderizado, no llega al
// navegador). `scripts/prerender.js` importa este bundle, llama a render() y
// mete el HTML resultante dentro de <div id="root"> de dist/index.html. Después
// React hidrata encima (ver main.jsx), así que el árbol tiene que ser idéntico
// al del cliente: mismo StrictMode, mismo App.

import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App.jsx';

// SEO generado en el build (D9/D10): prerender.js los toma de este bundle, así
// salen compilados con los mismos módulos que la página. Al importarse solo
// acá, no llegan al bundle del cliente.
export { datosEstructurados } from './seo/datosEstructurados.js';
export { llmsTxt } from './seo/llmsTxt.js';
export { DESCRIPCION } from './seo/sitio.js';

/**
 * render
 * Genera el HTML estático de la landing completa.
 * @returns {string} HTML de <App /> listo para inyectar en #root.
 */
export function render() {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
