// /backend/src/config/db.js
// Configuración del pool de conexiones a PostgreSQL (Supabase Session Pooler).
// Usa variables de entorno separadas para evitar problemas con caracteres especiales.

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

console.log(`[db] Inicializando pool — host: ${process.env.DB_HOST} | port: ${process.env.DB_PORT} | db: ${process.env.DB_NAME} | user: ${process.env.DB_USER}`);

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, // requerido por Supabase Session Pooler — no usar certificado autofirmado
  max: 3,                             // máximo 3 conexiones simultáneas (límite plan gratuito Supabase)
  idleTimeoutMillis: 30000,           // cierra conexiones inactivas después de 30s
  connectionTimeoutMillis: 5000,      // falla si no conecta en 5s (evita colgar el servidor)
});

pool.on('error', (err) => console.error('[db] ❌ Error inesperado en pool:', err.message));

/**
 * query
 * Ejecuta una query SQL contra la base de datos.
 * @param {string} text - La query SQL con placeholders ($1, $2, ...)
 * @param {Array} params - Los valores que reemplazan los placeholders
 * @returns {Promise} Resultado con rows, rowCount, etc.
 */
export const query = (text, params) => pool.query(text, params);

/**
 * testConnection
 * Verifica que la conexión a PostgreSQL funciona al arrancar el servidor.
 * Llamada desde index.js antes de levantar el servidor.
 */
export const testConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[db] ✅ Conexión a PostgreSQL establecida correctamente');
  } catch (err) {
    console.error('[db] ❌ Error conectando a PostgreSQL:', err.message);
    console.error('[db] Verificá las variables de entorno: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
  }
};