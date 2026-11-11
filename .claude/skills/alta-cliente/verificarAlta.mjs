// /.claude/skills/alta-cliente/verificarAlta.mjs
// Verifica en la DB que el alta de una solicitud quedó bien, para la skill
// alta-cliente: la solicitud pasó a 'cargada', el tenant existe y está activo,
// cuántas filas tiene cada tabla, y (si se le pasan) que los PINs y la
// contraseña entren, con el mismo bcrypt.compare que usan los logins.
// SOLO LECTURA: únicamente SELECT.
//
// Uso (desde la raíz del repo o desde cualquier lado):
//   node .claude/skills/alta-cliente/verificarAlta.mjs --solicitud <id> \
//     [--pin-admin 4321 --pines 1111,2222 --password kings2026]
//
// Se conecta con el rol de solo lectura (backend/.env.lectura), a través de
// backend/src/scripts/conexionLectura.js. Sin ese archivo, corta sin conectarse.

import { createRequire } from 'node:module';
import { conectarLectura } from '../../../backend/src/scripts/conexionLectura.js';
import { esUUID } from '../../../backend/src/utils/validarUuid.js';

// bcrypt se resuelve desde backend/ (el script vive fuera de ese árbol).
const bcrypt = createRequire(new URL('../../../backend/package.json', import.meta.url))('bcrypt');

/**
 * leerArgumentos
 * @param {string[]} args - process.argv sin los dos primeros
 * @returns {Object<string, string>} Los --clave valor como objeto.
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
 * main
 * Verifica el alta de la solicitud recibida por argumento e imprime el JSON.
 * @param {Function} query - El `query` de db.js, conectado con el rol de lectura.
 * @returns {Promise<number>} El código de salida (1 si algo no cierra).
 */
async function main(query) {
  const a = leerArgumentos(process.argv.slice(2));
  const id = (a.solicitud ?? '').trim();
  if (!esUUID(id)) {
    console.log(JSON.stringify({ error: 'El id de la solicitud no es un uuid válido.' }));
    return 1;
  }

  const solicitud = (await query(
    `SELECT estado, datos->'local'->>'subdominio' AS subdominio,
            jsonb_array_length(COALESCE(datos->'barberos', '[]'::jsonb)) AS barberos_pedidos
     FROM solicitud_alta WHERE id = $1`,
    [id]
  )).rows[0];
  if (!solicitud) {
    console.log(JSON.stringify({ error: 'No existe una solicitud con ese id.' }));
    return 1;
  }

  const tenant = (await query(
    `SELECT id, nombre_negocio, subdominio, activo, suscripcion_vigente_hasta::text AS suscripcion_vigente_hasta, duracion_slot_minutos,
            operativo_usuario, operativo_password_hash, pin_admin, configuracion, booking_url, telefono, direccion
     FROM tenant WHERE subdominio = $1`,
    [solicitud.subdominio]
  )).rows[0];
  if (!tenant) {
    console.log(JSON.stringify({ solicitud: solicitud.estado, error: `No hay un tenant con el subdominio "${solicitud.subdominio}".` }));
    return 1;
  }

  const cuenta = async (tabla) => Number((await query(
    `SELECT count(*) AS n FROM ${tabla} WHERE tenant_id = $1`, [tenant.id]
  )).rows[0].n);

  const barberos = (await query(
    'SELECT nombre, pin, comision_valor, email FROM barbero WHERE tenant_id = $1 ORDER BY created_at, nombre',
    [tenant.id]
  )).rows;

  // Los PINs se comparan contra todos los barberos, como hace el login (no por orden).
  const verificaciones = {};
  if (a['pin-admin']) verificaciones.pin_admin = await bcrypt.compare(a['pin-admin'], tenant.pin_admin);
  if (a.password) verificaciones.password_operativa = await bcrypt.compare(a.password, tenant.operativo_password_hash);
  if (a.pines) {
    const pines = a.pines.split(',').map((p) => p.trim()).filter(Boolean);
    verificaciones.pines_barberos = await Promise.all(pines.map(async (pin) => {
      for (const b of barberos) {
        if (await bcrypt.compare(pin, b.pin)) return { pin, barbero: b.nombre };
      }
      return { pin, barbero: null };
    }));
  }

  console.log(JSON.stringify({
    solicitud: solicitud.estado,
    tenant: {
      id: tenant.id,
      nombre: tenant.nombre_negocio,
      subdominio: tenant.subdominio,
      activo: tenant.activo,
      vigente_hasta: tenant.suscripcion_vigente_hasta,
      turno_minutos: tenant.duracion_slot_minutos,
      usuario_operativo: tenant.operativo_usuario,
      configuracion: tenant.configuracion,
      booking_url: tenant.booking_url,
      telefono: tenant.telefono,
      direccion: tenant.direccion,
    },
    filas: {
      horario_local: await cuenta('tenant_horario_atencion'),
      barberos: barberos.length,
      barberos_pedidos: solicitud.barberos_pedidos,
      bloques_barberos: await cuenta('barbero_horario'),
      socios: await cuenta('socio'),
      servicios: await cuenta('servicio'),
      productos: await cuenta('producto'),
      categorias_gasto: await cuenta('categoria_gasto'),
    },
    barberos: barberos.map((b) => ({ nombre: b.nombre, comision: Number(b.comision_valor), email: b.email })),
    verificaciones,
  }, null, 2));
  return 0;
}

let codigo = 1;
try {
  const { query } = await conectarLectura();
  codigo = await main(query);
} catch (err) {
  console.log(JSON.stringify({ error: `No se pudo verificar: ${err.message}` }));
}
process.exit(codigo);
