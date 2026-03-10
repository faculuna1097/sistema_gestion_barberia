// /backend/src/config/db.js
// Configuración del pool de conexiones a PostgreSQL (Supabase Session Pooler).
// Usa variables de entorno separadas para evitar problemas con caracteres especiales.

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, // valida el certificado SSL de Supabase
  max: 3,                            // máximo 3 conexiones simultáneas (plan gratuito Supabase)
  idleTimeoutMillis: 30000,          // cierra conexiones inactivas después de 30s
  connectionTimeoutMillis: 5000,     // falla si no conecta en 5s (evita colgar)
});

pool.on('error', (err) => console.error('❌ Error inesperado en pool:', err.message));

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
 */
export const testConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conexión a PostgreSQL establecida');
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
  }
};