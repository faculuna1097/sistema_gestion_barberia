// /backend/src/scripts/consultar.js
// Corre una consulta contra la base con el rol de SOLO LECTURA `resguardo_lectura`
// e imprime el resultado como tabla. Es la forma de consultar datos desde la PC
// (también la que usa Claude). Plan de resguardo de la base, fase 1 (D9).
//
// Uso (desde backend/, o con la ruta completa desde cualquier lado):
//   node src/scripts/consultar.js "select count(*) from tenant"
//
// Dos capas de solo lectura: el rol no tiene permiso de escritura y, además, la
// consulta corre dentro de una transacción READ ONLY. Una escritura falla con
// 25006 (transacción de solo lectura) antes de llegar a chequear permisos.
//
// Credenciales: backend/.env.lectura (usuario y contraseña del rol) y backend/.env
// (host, puerto y base). Ver conexionLectura.js.
//
// Sale con código 0 si la consulta anduvo y 1 si falló.

import { conectarLectura } from './conexionLectura.js';

/**
 * armarSqlSoloLectura
 * Envuelve la consulta en una transacción READ ONLY. Va todo en un solo envío
 * (protocolo simple, varias sentencias), porque el `query` de db.js usa el pool y
 * dos llamadas separadas podrían caer en conexiones distintas: el BEGIN quedaría
 * en una y la consulta en otra. Si la consulta falla, Postgres saltea el resto del
 * envío y la transacción queda abortada en esa conexión, que se cierra al final.
 *
 * Los saltos de línea protegen de un `-- comentario` al final de la consulta, que
 * si no se comería el `;` y el COMMIT. Un `;` final de la consulta deja una
 * sentencia vacía, que Postgres ignora.
 *
 * @param {string} sql - La consulta tal como la escribió el usuario.
 * @returns {string} `BEGIN READ ONLY; <sql>; COMMIT;`
 */
const armarSqlSoloLectura = (sql) => `BEGIN READ ONLY;\n${sql}\n;\nCOMMIT;`;

/**
 * aCelda
 * Pasa un valor de pg a algo legible en una celda de console.table.
 * @param {*} valor - Un valor de una fila (Date, objeto de un jsonb, texto, número…).
 * @returns {*} Las fechas en ISO, los objetos en JSON y el resto tal cual.
 */
const aCelda = (valor) => {
  if (valor instanceof Date) return valor.toISOString();
  if (valor !== null && typeof valor === 'object') return JSON.stringify(valor);
  return valor;
};

/**
 * imprimirResultado
 * Imprime el resultado de una sentencia: las filas como tabla si devuelve columnas,
 * o el comando y la cantidad de filas si no (por ejemplo, un SET).
 * @param {Object} resultado - Un resultado de pg (`fields`, `rows`, `command`, `rowCount`).
 * @returns {void}
 */
const imprimirResultado = (resultado) => {
  if (resultado.fields.length === 0) {
    console.log(`${resultado.command}${resultado.rowCount !== null ? ` ${resultado.rowCount}` : ''}`);
    return;
  }
  if (resultado.rows.length === 0) {
    console.log(`(0 filas) columnas: ${resultado.fields.map((f) => f.name).join(', ')}`);
    return;
  }
  console.table(resultado.rows.map((fila) => Object.fromEntries(
    Object.entries(fila).map(([columna, valor]) => [columna, aCelda(valor)])
  )));
  console.log(`(${resultado.rows.length} fila${resultado.rows.length === 1 ? '' : 's'})`);
};

/**
 * main
 * Corre la consulta en solo lectura e imprime el resultado.
 * @param {Function} query - El `query` de db.js, conectado con el rol de lectura.
 * @param {string} sql - La consulta, ya sin espacios de más.
 * @returns {Promise<number>} El código de salida.
 */
async function main(query, sql) {
  const resultados = await query(armarSqlSoloLectura(sql));
  // El primero es el BEGIN y el último el COMMIT: en el medio, las de la consulta.
  resultados.slice(1, -1).forEach((resultado, i, lista) => {
    if (lista.length > 1) console.log(`-- sentencia ${i + 1}`);
    imprimirResultado(resultado);
  });
  return 0;
}

// Sin consulta no se conecta: se avisa el uso y se sale.
const sql = process.argv.slice(2).join(' ').trim();
if (!sql) {
  console.error('Uso: node src/scripts/consultar.js "<consulta SQL>"');
  process.exit(1);
}

let codigo = 1;
let cerrarPool = null;
try {
  const conexion = await conectarLectura();
  cerrarPool = conexion.cerrarPool;
  codigo = await main(conexion.query, sql);
} catch (err) {
  const sqlstate = err.code ? ` [${err.code}]` : '';
  console.error(`[consultar] Error${sqlstate}: ${err.message}`);
  codigo = 1;
} finally {
  // Con el pool abierto el proceso no termina solo. Si el cierre falla, se sale igual.
  if (cerrarPool) {
    try {
      await cerrarPool();
    } catch (err) {
      console.error('[consultar] No se pudo cerrar el pool:', err.message);
    }
  }
}
process.exit(codigo);
