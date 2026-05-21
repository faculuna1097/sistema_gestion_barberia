// /backend/src/config/supabase.js
// Cliente de Supabase para operaciones de Storage (subir/borrar imágenes).
// Usa la service_role key: permisos totales, por eso SOLO vive en el backend.
// La conexión a la base de datos sigue siendo pg (ver config/db.js); este
// cliente se usa exclusivamente para el bucket de archivos.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[supabase] ❌ Faltan variables de entorno: SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY');
}

// Nombre del bucket donde viven todas las imágenes de los tenants.
export const BUCKET_IMAGENES = 'tenant-imagenes';

// Cliente con service_role: saltea las políticas RLS de Storage.
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
