// /backend/src/scripts/backfillCacheControl.js
// Backfill del header Cache-Control de las imágenes YA cargadas en Storage.
//
// Contexto: subirImagen ahora sube con cacheControl '31536000' (1 año), pero eso
// solo aplica a subidas NUEVAS. Las imágenes existentes siguen con el default de
// Supabase ('3600', 1 h). Supabase free tier no expone una forma de cambiar solo
// el header sin re-subir el contenido, así que el backfill descarga cada objeto y
// lo vuelve a subir con el cacheControl nuevo. La ruta (UUID) no cambia → la URL
// pública es la misma → no hay que tocar la DB; el re-upload purga el cache del CDN.
//
// Es idempotente: re-correrlo solo vuelve a setear el mismo contenido + header.
//
// Uso:
//   cd backend
//   node src/scripts/backfillCacheControl.js
//
// Requiere las mismas variables de entorno que el backend (.env): SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY y las de la conexión a la DB.

import { query } from '../config/db.js';
import { supabase, BUCKET_IMAGENES } from '../config/supabase.js';

// Mismo valor que subirImagen en storageService.js: 1 año en segundos.
const CACHE_CONTROL = '31536000';

/**
 * Re-sube un objeto del bucket con el nuevo cacheControl, sin cambiar su contenido.
 * Descarga el archivo, lo convierte a Buffer y lo vuelve a subir en la misma ruta.
 * @param {string} storagePath - ruta del objeto dentro del bucket (columna storage_path)
 * @returns {Promise<void>}
 * @throws {Error} si falla la descarga o la re-subida
 */
async function recachear(storagePath) {
  // 1. Descargar el objeto actual.
  const { data, error: errDescarga } = await supabase.storage
    .from(BUCKET_IMAGENES)
    .download(storagePath);
  if (errDescarga) throw new Error(`download: ${errDescarga.message}`);

  // El SDK devuelve un Blob; lo pasamos a Buffer para re-subirlo (Node 18+).
  const buffer = Buffer.from(await data.arrayBuffer());

  // 2. Re-subir en la misma ruta con el cacheControl largo.
  // update() reemplaza el objeto existente (no genera UUID nuevo).
  const { error: errSubida } = await supabase.storage
    .from(BUCKET_IMAGENES)
    .update(storagePath, buffer, { contentType: 'image/webp', cacheControl: CACHE_CONTROL });
  if (errSubida) throw new Error(`update: ${errSubida.message}`);
}

/**
 * Recorre todas las imágenes registradas en tenant_imagen y les aplica el
 * cacheControl nuevo. Procesa una por una (best-effort): si alguna falla, lo
 * reporta y sigue con el resto. Imprime un resumen al final.
 */
async function backfill() {
  console.log('[backfillCacheControl] Iniciando...');

  try {
    const { rows } = await query(
      'SELECT storage_path FROM tenant_imagen ORDER BY tenant_id, tipo, orden'
    );

    if (rows.length === 0) {
      console.log('[backfillCacheControl] No hay imágenes en tenant_imagen. Nada que hacer.');
      process.exit(0);
    }

    console.log(`[backfillCacheControl] ${rows.length} imágenes a procesar.`);

    let ok = 0;
    let fallidas = 0;

    for (const { storage_path } of rows) {
      try {
        await recachear(storage_path);
        ok++;
        console.log(`[backfillCacheControl] ✅ ${storage_path}`);
      } catch (errImg) {
        fallidas++;
        console.warn(`[backfillCacheControl] ⚠ Falló ${storage_path}: ${errImg.message}`);
      }
    }

    console.log('[backfillCacheControl] ───────────────────────────');
    console.log(`[backfillCacheControl] Listo. OK: ${ok} | Fallidas: ${fallidas} | Total: ${rows.length}`);
    process.exit(fallidas > 0 ? 1 : 0);
  } catch (err) {
    console.error('[backfillCacheControl] Error:', err.message);
    process.exit(1);
  }
}

backfill();
