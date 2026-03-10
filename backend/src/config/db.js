// /backend/src/config/db.js
// Configuración de la conexión a PostgreSQL via Pool de conexiones.
// Un Pool mantiene varias conexiones abiertas y las reutiliza,
// lo que es más eficiente que abrir/cerrar una conexión por cada query.

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => console.error('❌ Error en pool:', err.message));

/**
 * query
 * Ejecuta una query SQL contra la base de datos.
 * @param {string} text - La query SQL con placeholders ($1, $2, ...)
 * @param {Array} params - Los valores que reemplazan los placeholders
 * @returns {Promise} Resultado de la query con rows, rowCount, etc.
 */
export const query = (text, params) => pool.query(text, params);

/**
 * testConnection
 * Verifica que la conexión a PostgreSQL funciona al arrancar el servidor.
 * Si falla, loguea el error pero no mata el proceso.
 */
export const testConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conexión a PostgreSQL establecida');
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
  }
};

/**
 * getPool
 * Expone el pool completo para casos avanzados como transacciones manuales.
 * @returns {Pool} Instancia del pool de conexiones
 */
export const getPool = () => pool;