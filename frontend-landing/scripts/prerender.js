// /frontend-landing/scripts/prerender.js
// Pre-renderizado de la landing (SSG). Corre al final de `npm run build`,
// después de los dos builds de Vite:
//   1. dist/          → build del cliente (index.html con #root vacío + assets)
//   2. dist-ssr/      → build SSR de src/entry-server.jsx
// Este script renderiza <App /> a HTML con el bundle SSR, lo inyecta en
// dist/index.html y borra dist-ssr (no se publica).
// Cualquier error corta el build con exit code 1: nunca se publica un HTML vacío.

import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = path.join(RAIZ, 'dist', 'index.html');
const SSR_DIR = path.join(RAIZ, 'dist-ssr');
const SSR_ENTRY = path.join(SSR_DIR, 'entry-server.js');

// Marcador exacto que deja Vite en el index.html del cliente.
const MARCADOR = '<div id="root"></div>';

/**
 * prerender
 * Lee el index.html del build, le inyecta el HTML de la app y lo reescribe.
 * Sin parámetros.
 * @returns {Promise<number>} Bytes del HTML renderizado de la app.
 * @throws {Error} Si falta el marcador, el render sale vacío o falla el import.
 */
async function prerender() {
  const plantilla = await readFile(HTML_PATH, 'utf-8');

  // Tiene que haber exactamente un #root vacío; si no, el reemplazo es ambiguo.
  const ocurrencias = plantilla.split(MARCADOR).length - 1;
  if (ocurrencias !== 1) {
    throw new Error(`se esperaba 1 "${MARCADOR}" en dist/index.html y hay ${ocurrencias}`);
  }

  // En Windows un import() con ruta "C:\..." falla: hay que pasarle una URL file://.
  const { render } = await import(pathToFileURL(SSR_ENTRY).href);
  const appHtml = render();
  if (!appHtml || !appHtml.trim()) {
    throw new Error('render() devolvió un HTML vacío');
  }

  // Sin espacios ni saltos entre el div y el HTML: React hidrata sobre el
  // contenido de #root y cualquier nodo de texto extra sería una diferencia.
  const html = plantilla.replace(MARCADOR, () => `<div id="root">${appHtml}</div>`);
  await writeFile(HTML_PATH, html, 'utf-8');

  await rm(SSR_DIR, { recursive: true, force: true });
  return appHtml.length;
}

try {
  const bytes = await prerender();
  console.log(`[prerender] dist/index.html generado | html_app: ${bytes} caracteres`);
} catch (err) {
  console.error('[prerender] Error en prerender:', err);
  process.exit(1);
}
