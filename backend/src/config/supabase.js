// /backend/src/config/supabase.js
// Cliente de Supabase para operaciones de Storage (subir/borrar imágenes).
// Usa la service_role key: permisos totales, por eso SOLO vive en el backend.
// La conexión a la base de datos sigue siendo pg (ver config/db.js); este
// cliente se usa exclusivamente para el bucket de archivos.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Nombre del bucket donde viven todas las imágenes de los tenants.
export const BUCKET_IMAGENES = 'tenant-imagenes';

// Cliente cacheado tras la primera construcción (init perezoso, ver getSupabase).
let clienteSupabase = null;

/**
 * getSupabase
 * Devuelve el cliente de Supabase (service_role, saltea RLS de Storage),
 * construyéndolo en el PRIMER uso — no al importar el módulo (auditoría 4.4).
 *
 * Por qué perezoso: antes el cliente se creaba a nivel de módulo, así que una
 * credencial faltante o un runtime incompatible tumbaba el arranque de TODA la
 * API al importarse (fue una de las causas del crash-loop del go-live). Con init
 * perezoso, un problema de Storage se manifiesta como un 500 puntual en el único
 * endpoint que lo usa (imágenes), no como un boot fallido que deja la app entera
 * caída. Las credenciales se leen recién acá (no al cargar el módulo).
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 * @throws {Error} si faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY
 */
export function getSupabase() {
  if (clienteSupabase) return clienteSupabase;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Se lanza en el primer uso (dentro del handler de imágenes), no al boot:
    // el storageService lo propaga y el controller responde 500 puntual.
    throw new Error('Faltan variables de entorno de Storage: SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY');
  }

  clienteSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  return clienteSupabase;
}
