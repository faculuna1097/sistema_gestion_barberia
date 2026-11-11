// /backend/src/scripts/conexionLectura.js
// Conexión a la base con el rol de SOLO LECTURA `resguardo_lectura`, para las
// herramientas que leen la base desde la PC: `consultar.js` y los scripts de la
// skill alta-cliente. Plan de resguardo de la base, fase 1 (D9).
//
// Las credenciales salen de dos archivos, resueltos desde la ubicación de este
// módulo (no del directorio actual), así funciona se lo llame desde donde se lo llame:
//   - backend/.env.lectura → DB_USER y DB_PASSWORD del rol de lectura. Se carga con
//     `override: true`: gana aunque el entorno ya traiga un DB_USER.
//   - backend/.env → host, puerto y base. Se carga sin override, así no pisa lo anterior.
//
// Si el .env.lectura falta o no es del rol de lectura, corta con un error claro.
// NUNCA cae a las credenciales de dueño del .env.
//
// Uso:
//   import { conectarLectura } from '<ruta>/backend/src/scripts/conexionLectura.js';
//   const { query, cerrarPool } = await conectarLectura();
// Los módulos del backend que importan `src/config/db.js` (por ejemplo
// `utils/subdominio.js`) se importan DESPUÉS de esta llamada, con import dinámico:
// así reusan el mismo pool, ya armado con el rol de lectura.

import fs from 'node:fs';
import dotenv from 'dotenv';

const RUTA_ENV_LECTURA = new URL('../../.env.lectura', import.meta.url);
const RUTA_ENV = new URL('../../.env', import.meta.url);
const RUTA_DB = new URL('../config/db.js', import.meta.url);

// El usuario del Session Pooler es `<rol>.<project_ref>`; ya conectado, Postgres
// lo ve como el rol solo.
const ROL_LECTURA = 'resguardo_lectura';
const PREFIJO_USUARIO_LECTURA = `${ROL_LECTURA}.`;

/**
 * conectarLectura
 * Carga las credenciales del rol de lectura, las valida y recién entonces importa
 * `src/config/db.js`, que arma su pool leyendo el entorno al importarse. Así se reusa
 * el pool de db.js (CA, SSL, reintentos, statement_timeout) sin duplicarlo.
 *
 * No recibe parámetros: las rutas salen de la ubicación de este módulo.
 * @returns {Promise<{ query: Function, cerrarPool: Function }>} El `query` y el
 *   `cerrarPool` de db.js, conectados con el rol de lectura.
 * @throws {Error} Si falta el .env.lectura, si no define DB_USER y DB_PASSWORD, si
 *   DB_USER no es del rol de lectura, o si el .env no trae host, puerto y base. En
 *   todos esos casos no se importa db.js, así que no se abre ninguna conexión.
 *   También si, ya conectado, `current_user` no es el rol de lectura (db.js se había
 *   importado antes, con el .env de dueño): en ese caso cierra el pool antes de cortar.
 */
export async function conectarLectura() {
  if (!fs.existsSync(RUTA_ENV_LECTURA)) {
    throw new Error(
      'Falta backend/.env.lectura, con las credenciales del rol de solo lectura. '
      + 'Crealo a partir de backend/.env.lectura.example (ver README.md). '
      + 'No se usan las credenciales del .env.'
    );
  }

  // quiet: dotenv 17 imprime un aviso por cada archivo que carga.
  const lectura = dotenv.config({ path: RUTA_ENV_LECTURA, override: true, quiet: true });
  if (lectura.error) {
    throw new Error(`No se pudo leer backend/.env.lectura: ${lectura.error.message}`);
  }
  const { DB_USER: usuario, DB_PASSWORD: password } = lectura.parsed ?? {};
  if (!usuario || !password) {
    throw new Error('backend/.env.lectura tiene que definir DB_USER y DB_PASSWORD.');
  }
  if (!usuario.startsWith(PREFIJO_USUARIO_LECTURA)) {
    throw new Error(
      `En backend/.env.lectura, DB_USER tiene que empezar con "${PREFIJO_USUARIO_LECTURA}" `
      + '(el rol de solo lectura). No se conecta con otro rol.'
    );
  }

  // Host, puerto y base. Sin override: no pisa el usuario ni la contraseña de arriba.
  dotenv.config({ path: RUTA_ENV, quiet: true });
  const faltan = ['DB_HOST', 'DB_PORT', 'DB_NAME'].filter((v) => !process.env[v]);
  if (faltan.length > 0) {
    throw new Error(`Faltan ${faltan.join(', ')} (salen de backend/.env).`);
  }

  // Import dinámico: db.js lee el entorno al importarse, que ya quedó listo.
  const { query, cerrarPool } = await import(RUTA_DB.href);

  // Chequeo final: si algún import estático del script que llama trajo db.js antes
  // de esta función, el pool ya estaba armado con el .env de dueño y lo de arriba
  // no lo cambia. Se pregunta a la base con quién quedó conectado.
  const { usuario_conectado: conectado } = (await query('SELECT current_user AS usuario_conectado')).rows[0];
  if (conectado !== ROL_LECTURA) {
    await cerrarPool();
    throw new Error(
      `El pool quedó conectado como "${conectado}", no como "${ROL_LECTURA}": db.js se `
      + 'importó antes de conectarLectura(). Importá los módulos que usan db.js con '
      + 'import dinámico, después de llamarla.'
    );
  }

  return { query, cerrarPool };
}
