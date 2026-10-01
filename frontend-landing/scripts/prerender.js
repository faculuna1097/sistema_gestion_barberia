// /frontend-landing/scripts/prerender.js
// Pre-renderizado de la landing (SSG). Corre al final de `npm run build`,
// después de los dos builds de Vite:
//   1. dist/          → build del cliente (index.html con #root vacío + assets)
//   2. dist-ssr/      → build SSR de src/entry-server.jsx
// Este script, con el bundle SSR:
//   - renderiza <App /> a HTML y lo inyecta en el #root de dist/index.html;
//   - inyecta el JSON-LD (datos estructurados) antes de </head>;
//   - escribe dist/llms.txt;
//   - borra dist-ssr (no se publica).
// Cualquier error corta el build con exit code 1: nunca se publica un HTML vacío.

import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = path.join(RAIZ, 'dist', 'index.html');
const LLMS_PATH = path.join(RAIZ, 'dist', 'llms.txt');
const SSR_DIR = path.join(RAIZ, 'dist-ssr');
const SSR_ENTRY = path.join(SSR_DIR, 'entry-server.js');

// Marcadores exactos que deja Vite en el index.html del cliente.
const MARCADOR = '<div id="root"></div>';
const CIERRE_HEAD = '</head>';

/**
 * contarOcurrencias
 * Cuenta cuántas veces aparece un texto literal dentro de otro.
 * @param {string} texto - Donde buscar
 * @param {string} buscado - Texto literal a contar
 * @returns {number} Cantidad de ocurrencias
 */
function contarOcurrencias(texto, buscado) {
  return texto.split(buscado).length - 1;
}

/**
 * scriptJsonLd
 * Serializa los datos estructurados como un <script type="application/ld+json">.
 * Escapa "<" como \u003c (sigue siendo JSON válido) para que ningún texto
 * pueda cerrar el script con un "</script>".
 * @param {Object} datos - Objeto JSON-LD
 * @returns {string} Etiqueta <script> lista para el <head>
 */
function scriptJsonLd(datos) {
  const json = JSON.stringify(datos).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

/**
 * verificarDescripcion
 * Chequea que la meta description de index.html sea el mismo texto que usan
 * el JSON-LD y el llms.txt (DESCRIPCION de src/seo/sitio.js).
 * @param {string} html - Contenido de dist/index.html
 * @param {string} descripcion - Texto esperado
 * @throws {Error} Si no hay meta description o no coincide
 */
function verificarDescripcion(html, descripcion) {
  const match = html.match(/<meta\s+name="description"\s+content="([^"]*)"/);
  if (!match) throw new Error('no se encontró la meta description en dist/index.html');
  if (match[1] !== descripcion) {
    throw new Error('la meta description de index.html no coincide con DESCRIPCION de src/seo/sitio.js');
  }
}

/**
 * prerender
 * Lee el index.html del build, le inyecta el HTML de la app y el JSON-LD, lo
 * reescribe y genera el llms.txt.
 * Sin parámetros.
 * @returns {Promise<{ app: number, jsonLd: number, llms: number }>} Tamaños
 *   en caracteres del HTML de la app, del script JSON-LD y del llms.txt.
 * @throws {Error} Si falta un marcador, el render sale vacío, la meta
 *   description no coincide o falla el import.
 */
async function prerender() {
  const plantilla = await readFile(HTML_PATH, 'utf-8');

  // Tiene que haber exactamente un #root vacío y un </head>; si no, el
  // reemplazo es ambiguo.
  for (const marcador of [MARCADOR, CIERRE_HEAD]) {
    const ocurrencias = contarOcurrencias(plantilla, marcador);
    if (ocurrencias !== 1) {
      throw new Error(`se esperaba 1 "${marcador}" en dist/index.html y hay ${ocurrencias}`);
    }
  }

  // En Windows un import() con ruta "C:\..." falla: hay que pasarle una URL file://.
  const { render, datosEstructurados, llmsTxt, DESCRIPCION } = await import(pathToFileURL(SSR_ENTRY).href);

  verificarDescripcion(plantilla, DESCRIPCION);

  const appHtml = render();
  if (!appHtml || !appHtml.trim()) {
    throw new Error('render() devolvió un HTML vacío');
  }
  const jsonLd = scriptJsonLd(datosEstructurados());
  const llms = llmsTxt();

  // Sin espacios ni saltos entre el div y el HTML: React hidrata sobre el
  // contenido de #root y cualquier nodo de texto extra sería una diferencia.
  // Los reemplazos usan función para que un "$" del contenido no se
  // interprete como patrón de replace.
  const html = plantilla
    .replace(MARCADOR, () => `<div id="root">${appHtml}</div>`)
    .replace(CIERRE_HEAD, () => `  ${jsonLd}\n  ${CIERRE_HEAD}`);
  await writeFile(HTML_PATH, html, 'utf-8');
  await writeFile(LLMS_PATH, llms, 'utf-8');

  await rm(SSR_DIR, { recursive: true, force: true });
  return { app: appHtml.length, jsonLd: jsonLd.length, llms: llms.length };
}

try {
  const tamanios = await prerender();
  console.log(
    `[prerender] dist/index.html y dist/llms.txt generados | html_app: ${tamanios.app} | json_ld: ${tamanios.jsonLd} | llms_txt: ${tamanios.llms}`,
  );
} catch (err) {
  console.error('[prerender] Error en prerender:', err);
  process.exit(1);
}
