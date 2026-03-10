// =============================================
// db.js — Configuración de la conexión a PostgreSQL
// Usa el driver 'pg' (node-postgres) con un Pool de conexiones.
// Un Pool mantiene varias conexiones abiertas y las reutiliza,
// lo que es más eficiente que abrir/cerrar una conexión por cada request.
// =============================================

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,  // Se lee como string puro, sin parsear URL
  ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => console.log('✅ Conexión a PostgreSQL establecida'));
pool.on('error', (err) => console.error('❌ Error en pool:', err.message));

const query = (text, params) => pool.query(text, params);
module.exports = { query, pool };