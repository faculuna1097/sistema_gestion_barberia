// /backend/src/config/db.js
// Configuración del pool de conexiones a PostgreSQL (Supabase Session Pooler).
// Usa variables de entorno separadas para evitar problemas con caracteres especiales.

import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// CA de Supabase (certificado público, commiteado en config/) para validar el
// certificado del servidor con `rejectUnauthorized: true` [auditoría 4.3]. Se lee
// relativo a este módulo (no al cwd) con import.meta.url. Verificado en frío que
// el pooler valida limpio con esta CA (hostname + cadena) antes de activarlo.
const supabaseCA = fs.readFileSync(new URL('./supabase-ca.crt', import.meta.url), 'utf8');

console.log(`[db] Inicializando pool — host: ${process.env.DB_HOST} | port: ${process.env.DB_PORT} | db: ${process.env.DB_NAME} | user: ${process.env.DB_USER}`);

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { ca: supabaseCA, rejectUnauthorized: true }, // [auditoría 4.3] valida el cert del server contra la CA de Supabase (cierra el MITM del rejectUnauthorized:false)
  max: 3,                             // máximo 3 conexiones simultáneas (límite plan gratuito Supabase)
  idleTimeoutMillis: 30000,           // cierra conexiones inactivas después de 30s
  connectionTimeoutMillis: 5000,      // falla si no conecta en 5s (evita colgar el servidor)
  keepAlive: true,                    // TCP keep-alive a nivel socket: evita que un NAT/firewall corte la conexión ociosa (complementa el SELECT 1 periódico de iniciarKeepAlive)
});

pool.on('error', (err) => console.error('[db] ❌ Error inesperado en pool:', err));

// statement_timeout [auditoría 4.1]: Postgres aborta cualquier sentencia que
// supere este límite y libera la conexión. Sin esto, un puñado de queries lentas
// (o mantenidas abiertas a propósito) retiene las 3 conexiones del pool y estanca
// toda la API; además aprieta el default de Supabase (120s), demasiado holgado
// para 3 conexiones. 5s sobra: las queries más pesadas (agregaciones mensuales de
// planilla/balances) corren en cientos de ms.
//
// Se aplica por SQL en cada conexión nueva, NO como parámetro de startup `options`:
// el pooler de Supabase (Supavisor) DESCARTA `options` (verificado en frío — la
// sesión quedaba en el default de 2min), pero sí deja pasar un `SET`. En modo
// sesión cada conexión es dedicada, así que el SET vale para toda su vida. El
// handler encola el SET antes de que el pool entregue la conexión al primer query
// y node-postgres procesa la cola FIFO, así que el timeout ya está activo. El
// valor es una constante hardcodeada (no input de usuario), seguro de interpolar.
const STATEMENT_TIMEOUT_MS = 5000;
pool.on('connect', (client) => {
  client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`).catch((err) => {
    console.error('[db] no se pudo aplicar statement_timeout en una conexión nueva:', err.message);
  });
});

// Códigos de error de RED de Node (no son SQLSTATE de Postgres) ante los que
// vale reintentar: el problema es el socket, no la query.
const CODIGOS_RED = new Set(['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

/**
 * esErrorDeConexion
 * Distingue un fallo de CONEXIÓN (socket muerto, timeout al conectar, el pooler
 * que cortó una conexión ociosa, Supabase reiniciando) de un error de SQL
 * (constraint, sintaxis, dato inválido). Solo los primeros se reintentan:
 * reintentar un error de SQL es inútil y, en un INSERT/UPDATE, peligroso.
 *
 * Cómo los telling apart: un error de SQL de Postgres trae un `code` SQLSTATE
 * de 5 chars cuya clase indica el tipo (23=integridad, 22=dato, 42=sintaxis...).
 * Los de conexión son: códigos de red de Node, o SQLSTATE de la clase 08
 * (connection exception), o 57P01/57P03 (el server cerró / está arrancando), o
 * errores de pg-pool sin SQLSTATE ("Connection terminated...").
 *
 * @param {Error} err - el error capturado de pool.query
 * @returns {boolean} true si conviene reintentar una vez
 */
const esErrorDeConexion = (err) => {
  if (!err) return false;
  const code = err.code;
  if (typeof code === 'string') {
    if (CODIGOS_RED.has(code)) return true;        // red de Node (ECONNRESET, ETIMEDOUT, ...)
    if (code.startsWith('08')) return true;        // SQLSTATE clase 08: connection exception
    if (code === '57P01' || code === '57P03') return true; // server cerró / aún arrancando
  }
  // pg-pool, al usar un socket ya muerto o al timeoutear el establecimiento, tira
  // errores sin SQLSTATE; los detectamos por mensaje (incluida la `cause`).
  const msg = `${err.message ?? ''} ${err.cause?.message ?? ''}`;
  return msg.includes('Connection terminated') ||
         msg.includes('timeout exceeded when trying to connect') ||
         msg.includes('server closed the connection');
};

/**
 * query
 * Ejecuta una query SQL contra la base de datos, con UN reintento automático
 * ante errores de CONEXIÓN (no de SQL).
 *
 * Por qué: hablamos con el Session Pooler de Supabase por red. El pooler corta
 * conexiones ociosas y un blip puede matar un socket que el pool todavía creía
 * vivo; la primera query con ese socket muerto falla con "Connection terminated
 * unexpectedly". El reintento agarra/establece una conexión fresca y la operación
 * sale bien — el cliente nunca ve el blip. Se reintenta UNA sola vez: si la
 * segunda también falla, no es un hipo puntual y el error debe emerger.
 *
 * Solo se reintentan errores de conexión (ver esErrorDeConexion). Los errores de
 * SQL (p. ej. la 23P01 del constraint antisolapamiento) se propagan tal cual.
 *
 * Nota sobre escrituras: si un socket muere en la ventana angosta entre que el
 * server commitea un INSERT/UPDATE y entrega el resultado, el reintento reejecuta
 * la sentencia. La integridad está cubierta por los constraints (la 23P01 impide
 * el doble turno); el residual es un caso raro a endurecer luego con idempotency
 * key en /turnos. Ver docs/estado_actual.md.
 *
 * Excepción (auditoría 4.2): las escrituras RELATIVAS de stock
 * (`stock_actual = stock_actual ± $1`) NO son idempotentes — un reintento tras un
 * ack perdido doble-aplicaría el ajuste y corrompería el inventario en silencio.
 * Esas se llaman con `{ reintentar: false }` (ver utils/stock.js): preferimos un
 * fallo visible raro (el usuario reintenta) a una corrupción silenciosa. Las demás
 * (lecturas, y writes idempotentes como SET de valor fijo o DELETE) siguen
 * reintentando por default.
 *
 * @param {string} text - La query SQL con placeholders ($1, $2, ...)
 * @param {Array} params - Los valores que reemplazan los placeholders
 * @param {Object} [opciones] - { reintentar?: boolean } — reintentar default true;
 *   pasar false para sentencias no idempotentes que no deben reejecutarse.
 * @returns {Promise} Resultado con rows, rowCount, etc.
 */
export const query = async (text, params, opciones = {}) => {
  const { reintentar = true } = opciones;
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (!reintentar || !esErrorDeConexion(err)) throw err;
    console.warn('[db] query falló por error de conexión, reintentando una vez:', err.message);
    await new Promise((resolve) => setTimeout(resolve, 200)); // respiro corto para que el pool entregue/establezca un socket sano
    return pool.query(text, params);
  }
};

/**
 * cerrarPool
 * Cierra el pool drenando las conexiones abiertas. Lo usa el job del cron de
 * recordatorios para terminar limpio: el pool mantiene vivo el event loop, así
 * que sin cerrarlo el proceso no termina solo. No exponemos el pool crudo para
 * no habilitar pool.connect() (restricción del Session Pooler, plan §9).
 * @returns {Promise} resuelve cuando todas las conexiones quedaron cerradas
 */
export const cerrarPool = () => pool.end();

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
    console.error('[db] ❌ Error conectando a PostgreSQL:', err);
    console.error('[db] Verificá las variables de entorno: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
  }
};

/**
 * iniciarKeepAlive
 * Mantiene caliente una conexión del pool ejecutando un `SELECT 1` periódico.
 * El intervalo es deliberadamente MENOR que idleTimeoutMillis (30s): así la
 * conexión nunca llega a estar ociosa 30s y el pool no la cierra, evitando que
 * la próxima request pague el establecimiento completo (TCP + TLS + auth del
 * Session Pooler) contra Supabase en us-west-2 — ese cold connection es el
 * grueso de los ~2s fríos del bootstrap (ver docs/performance_frontends.md §5-bis).
 *
 * El ping corre en background y es tolerante a fallos: si un tick falla (blip de
 * red a Oregon) se loguea como degradación recuperable y se reintenta en el
 * siguiente — nunca tira el proceso. El interval va con .unref() para no ser por
 * sí mismo la razón de que el proceso siga vivo: lo mantiene vivo app.listen, y
 * así no interfiere con un cierre limpio (ej. cerrarPool() en el cron de
 * recordatorios).
 *
 * @param {number} intervaloMs - Cada cuánto pinguear, en ms. Default 20000 (20s),
 *   con margen cómodo bajo los 30s del idleTimeoutMillis.
 * @returns {NodeJS.Timeout} el handle del interval (por si hace falta cancelarlo).
 */
export const iniciarKeepAlive = (intervaloMs = 20000) => {
  const handle = setInterval(async () => {
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      console.warn('[db] keep-alive: ping falló, se reintenta en el próximo tick:', err.message);
    }
  }, intervaloMs);
  handle.unref();
  console.log(`[db] ✅ keep-alive iniciado | intervalo: ${intervaloMs / 1000}s`);
  return handle;
};