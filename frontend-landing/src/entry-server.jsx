// /frontend-landing/src/entry-server.jsx
// Entrada del build SSR (solo se usa en el pre-renderizado, no llega al
// navegador). `scripts/prerender.js` importa este bundle, llama a render() y
// mete el HTML resultante dentro de <div id="root"> de dist/index.html. Después
// React hidrata encima (ver main.jsx), así que el árbol tiene que ser idéntico
// al del cliente: mismo StrictMode, mismo App.

import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App.jsx';

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
