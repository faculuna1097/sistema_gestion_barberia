// /.claude/skills/alta-cliente/armarQuery.mjs
// Arma la query de alta de un tenant (plantilla_alta.sql) con los parámetros que
// decide Facundo, para la skill alta-cliente. Valida los parámetros, los escapa,
// y comprueba la query con PREPARE + DEALLOCATE (no ejecuta nada ni escribe).
// SOLO LECTURA: un SELECT de la solicitud, otro de los tenants y el PREPARE.
//
// Uso (desde la raíz del repo o desde cualquier lado):
//   node .claude/skills/alta-cliente/armarQuery.mjs \
//     --solicitud <id> --pin-admin 4321 --pines 1111,2222 \
//     --usuario kings --password kings2026 [--hasta 2026-12-31]
//
// Se conecta con el rol de solo lectura (backend/.env.lectura), a través de
// backend/src/scripts/conexionLectura.js. Sin ese archivo, corta sin conectarse.
//
// Sin --hasta, la suscripción vence el último día del mes actual (hora argentina).
// Imprime la query lista para pegar en el SQL Editor de Supabase, o los
// problemas encontrados (y sale con código 1).

import fs from 'node:fs';
import { conectarLectura } from '../../../backend/src/scripts/conexionLectura.js';
import { esUUID } from '../../../backend/src/utils/validarUuid.js';

const RUTA_PLANTILLA = new URL('./plantilla_alta.sql', import.meta.url);

// Nombre del statement preparado que se arma y se descarta para validar la query.
const NOMBRE_PREPARE = 'alta_cliente_validacion';

const USUARIO_MIN = 3;   // credencialesOperativas.js
const PASSWORD_MIN = 8;  // credencialesOperativas.js
const REGEX_PIN = /^\d{4}$/;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * leerArgumentos
 * Pasa los --clave valor de la línea de comandos a un objeto.
 * @param {string[]} args - process.argv sin los dos primeros
 * @returns {Object<string, string>}
 */
function leerArgumentos(args) {
  const resultado = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('--')) {
      resultado[args[i].slice(2)] = args[i + 1] ?? '';
      i += 1;
    }
  }
  return resultado;
}

/**
 * literal
 * Un texto como literal de SQL, con las comillas simples escapadas.
 * @param {string} texto
 * @returns {string} Ej.: O'Brien → 'O''Brien'
 */
const literal = (texto) => `'${String(texto).replace(/'/g, "''")}'`;

/**
 * validarSinEjecutar
 * Comprueba la query de alta con PREPARE + DEALLOCATE: Postgres la analiza entera
 * (sintaxis, tablas, columnas, tipos y funciones, como `extensions.crypt`) sin
 * ejecutarla. A diferencia de EXPLAIN, PREPARE no chequea permisos de escritura,
 * así que funciona con el rol de solo lectura.
 *
 * Va en un solo envío porque el `query` de db.js usa un pool: separados, el PREPARE
 * y el DEALLOCATE podrían caer en conexiones distintas. Si el PREPARE falla, Postgres
 * saltea el DEALLOCATE (no hay nada que descartar).
 *
 * Al final de la query se le saca el `;` (y los espacios): si no, terminaría el
 * PREPARE ahí y el resto quedaría suelto. Los saltos de línea protegen de un
 * `-- comentario` al final. Los comentarios del principio de la plantilla no molestan.
 *
 * @param {Function} query - El `query` de db.js.
 * @param {string} sql - La query de alta ya armada (una sola sentencia).
 * @returns {Promise<void>} Resuelve si la query es válida.
 * @throws {Error} El error de Postgres si no lo es (por ejemplo, 42703 por una
 *   columna inexistente).
 */
async function validarSinEjecutar(query, sql) {
  const sentencia = sql.replace(/[\s;]+$/, '');
  await query(`PREPARE ${NOMBRE_PREPARE} AS\n${sentencia}\n;\nDEALLOCATE ${NOMBRE_PREPARE};`);
}

/**
 * main
 * Valida los parámetros contra la solicitud, arma la query y la comprueba.
 * @param {Function} query - El `query` de db.js, conectado con el rol de lectura.
 * @returns {Promise<number>} El código de salida.
 */
async function main(query) {
  const a = leerArgumentos(process.argv.slice(2));
  const problemas = [];

  const id = (a.solicitud ?? '').trim();
  if (!esUUID(id)) {
    console.log('PROBLEMAS:\n- El id de la solicitud no es un uuid válido.');
    return 1;
  }

  const fila = (await query(
    `SELECT estado, jsonb_array_length(COALESCE(datos->'barberos', '[]'::jsonb)) AS barberos,
            datos->'local'->>'subdominio' AS subdominio
     FROM solicitud_alta WHERE id = $1`,
    [id]
  )).rows[0];
  if (!fila) {
    console.log('PROBLEMAS:\n- No existe una solicitud con ese id.');
    return 1;
  }
  if (fila.estado !== 'enviada') problemas.push(`La solicitud está en '${fila.estado}', no en 'enviada'.`);

  const ocupado = (await query(
    'SELECT EXISTS (SELECT 1 FROM tenant WHERE lower(subdominio) = lower($1)) AS ocupado',
    [fila.subdominio ?? '']
  )).rows[0].ocupado;
  if (ocupado) problemas.push(`El subdominio "${fila.subdominio}" ya lo usa un tenant.`);

  const pinAdmin = (a['pin-admin'] ?? '').trim();
  const pines = (a.pines ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  if (!REGEX_PIN.test(pinAdmin)) problemas.push('El PIN de admin tiene que tener 4 dígitos.');
  pines.forEach((pin, i) => {
    if (!REGEX_PIN.test(pin)) problemas.push(`El PIN del barbero ${i + 1} (${pin}) tiene que tener 4 dígitos.`);
  });
  if (pines.length !== fila.barberos) {
    problemas.push(`Hay ${fila.barberos} barberos y ${pines.length} PINs: tiene que haber uno por barbero, en el orden del formulario.`);
  }
  // Los logins buscan el PIN entre el admin y todos los barberos (pinColisiona): no se repiten.
  const todos = [pinAdmin, ...pines];
  if (new Set(todos).size !== todos.length) problemas.push('Los PINs se repiten: el admin y cada barbero necesitan uno distinto.');

  const usuario = (a.usuario ?? '').trim();
  const password = a.password ?? '';
  if (usuario.length < USUARIO_MIN) problemas.push(`El usuario operativo tiene que tener al menos ${USUARIO_MIN} caracteres.`);
  if (password.length < PASSWORD_MIN) problemas.push(`La contraseña operativa tiene que tener al menos ${PASSWORD_MIN} caracteres.`);

  let vigenteHasta = "(date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') + interval '1 month - 1 day')::date";
  if (a.hasta) {
    if (!REGEX_FECHA.test(a.hasta) || Number.isNaN(Date.parse(a.hasta))) problemas.push('--hasta tiene que ser una fecha AAAA-MM-DD.');
    else vigenteHasta = `DATE ${literal(a.hasta)}`;
  }

  if (problemas.length > 0) {
    console.log(`PROBLEMAS:\n${problemas.map((p) => `- ${p}`).join('\n')}`);
    return 1;
  }

  const sql = fs.readFileSync(RUTA_PLANTILLA, 'utf8')
    // Reemplazos con función: con un texto, replace interpreta $& o $' (una contraseña podría traerlos).
    .replace('<SOLICITUD_ID>', () => id)
    .replace("'<PIN_ADMIN>'", () => literal(pinAdmin))
    .replace('<PINES_BARBEROS>', () => pines.map(literal).join(', '))
    .replace("'<USUARIO_OPERATIVO>'", () => literal(usuario))
    .replace("'<PASSWORD_OPERATIVA>'", () => literal(password))
    .replace('<VIGENTE_HASTA>', () => vigenteHasta);

  try {
    await validarSinEjecutar(query, sql);
  } catch (err) {
    const sqlstate = err.code ? ` [${err.code}]` : '';
    console.log(`PROBLEMAS:\n- La query no pasa la validación (PREPARE)${sqlstate}: ${err.message}`);
    return 1;
  }

  console.log(`QUERY OK (barberos: ${fila.barberos}, subdominio: ${fila.subdominio})\n\n${sql}`);
  return 0;
}

let codigo = 1;
try {
  const { query } = await conectarLectura();
  codigo = await main(query);
} catch (err) {
  console.log(`PROBLEMAS:\n- No se pudo armar la query: ${err.message}`);
}
process.exit(codigo);
