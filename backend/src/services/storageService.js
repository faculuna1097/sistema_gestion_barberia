// /backend/src/services/storageService.js
// Capa de acceso a Supabase Storage para las imágenes de los tenants.
// Aísla al resto del backend de los detalles del SDK de Supabase: el
// controller solo conoce estas funciones, no el cliente de Storage.

import { randomUUID } from 'crypto';
import { supabase, BUCKET_IMAGENES } from '../config/supabase.js';

/**
 * construirPath
 * Arma la ruta del archivo dentro del bucket. Cada subida genera un nombre
 * único (UUID) aunque reemplace un slot existente: así el navegador y la CDN
 * nunca sirven una versión cacheada vieja.
 * @param {string} tenantId - UUID del tenant
 * @param {string} tipo - 'local' | 'corte' | 'logo'
 * @returns {string} ruta relativa, ej: "abc-uuid/corte/xyz-uuid.webp"
 */
export const construirPath = (tenantId, tipo) =>
  `${tenantId}/${tipo}/${randomUUID()}.webp`;

/**
 * urlPublica
 * Devuelve la URL pública completa de un archivo del bucket.
 * El bucket es público, así que esta URL es accesible sin token.
 * @param {string} storagePath - ruta relativa guardada en tenant_imagen
 * @returns {string} URL pública absoluta
 */
export const urlPublica = (storagePath) =>
  supabase.storage.from(BUCKET_IMAGENES).getPublicUrl(storagePath).data.publicUrl;

/**
 * subirImagen
 * Sube un buffer de imagen WebP al bucket.
 * @param {string} storagePath - ruta destino dentro del bucket
 * @param {Buffer} buffer - contenido binario de la imagen
 * @returns {Promise<void>}
 * @throws {Error} si Storage rechaza la subida
 */
export const subirImagen = async (storagePath, buffer) => {
  const { error } = await supabase.storage
    .from(BUCKET_IMAGENES)
    // cacheControl: 1 año (en segundos). La URL es content-addressed por UUID
    // (ver construirPath) → la imagen de esa ruta nunca cambia, así que es seguro
    // cachearla a largo plazo. Default de Supabase = '3600' (1 h), corto para un
    // asset estable. Solo aplica a subidas NUEVAS; las ya cargadas se actualizan
    // con el script de backfill (backend/src/scripts/backfillCacheControl.js).
    .upload(storagePath, buffer, { contentType: 'image/webp', cacheControl: '31536000' });
  if (error) throw new Error(`Storage upload: ${error.message}`);
};

/**
 * eliminarImagen
 * Borra un archivo del bucket. No lanza error si el archivo no existe:
 * el objetivo (que no esté) ya se cumple.
 * @param {string} storagePath - ruta del archivo a borrar
 * @returns {Promise<void>}
 */
export const eliminarImagen = async (storagePath) => {
  const { error } = await supabase.storage
    .from(BUCKET_IMAGENES)
    .remove([storagePath]);
  if (error) console.error('[storageService] No se pudo borrar el archivo:', error.message);
};
