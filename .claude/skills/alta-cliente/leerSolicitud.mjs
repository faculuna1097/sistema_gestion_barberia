// /.claude/skills/alta-cliente/leerSolicitud.mjs
// Lee una solicitud del formulario de alta y la verifica, para la skill
// alta-cliente. SOLO LECTURA: hace únicamente SELECT (la solicitud y, a través
// de validarSolicitudAlta, si el subdominio ya lo usa un tenant).
//
// Uso (desde la raíz del repo; usa el .env de backend/ para conectarse a la DB):
//   node .claude/skills/alta-cliente/leerSolicitud.mjs <id-de-la-solicitud>
//
// Imprime un JSON con:
//   - solicitud: estado, referencia y fechas;
//   - errores: lo que devuelve validarSolicitudAlta del backend (las mismas
//     reglas que corrieron al enviar; vacío si está todo bien);
//   - alertas: cosas válidas pero raras, para revisar con el cliente;
//   - datos: el `datos` completo, para armar el resumen.
// Sale con código 1 si la solicitud no existe o el id está mal formado.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BACKEND = path.join(RAIZ, 'backend');

// db.js lee el .env del directorio actual: se corre parado en backend/.
process.chdir(BACKEND);
const desdeBackend = (archivo) => new URL(`file:///${path.join(BACKEND, 'src', archivo).replace(/\\/g, '/')}`).href;

const { query } = await import(desdeBackend('config/db.js'));
const { esUUID } = await import(desdeBackend('utils/validarUuid.js'));
const { validarSolicitudAlta } = await import(desdeBackend('utils/validarSolicitudAlta.js'));

// Umbrales de las alertas de precio (en pesos). No son reglas: solo avisan.
const PRECIO_BAJO = 1000;
const PRECIO_ALTO = 200000;

/**
 * aMinutos
 * @param {string} hora - 'HH:MM'
 * @returns {number} Minutos desde la medianoche.
 */
const aMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * calcularAlertas
 * Cosas que pasan la validación pero conviene confirmar antes del alta.
 * @param {Object} datos - El datos de la solicitud
 * @returns {string[]} Una alerta por línea, en español.
 */
function calcularAlertas(datos) {
  const alertas = [];
  const local = datos.local ?? {};
  const slot = Number(datos.turno?.duracion_minutos);

  // WhatsApp argentino sin el 9: la plantilla se lo agrega.
  if (typeof local.whatsapp === 'string' && local.whatsapp.startsWith('+54') && !local.whatsapp.startsWith('+549')) {
    alertas.push(`El WhatsApp (${local.whatsapp}) no tiene el 9: la plantilla lo carga como +549${local.whatsapp.slice(3)}. Confirmá que sea un celular.`);
  }

  // Turnos que no entran justos en el horario: sobran minutos al final de un
  // bloque. Se agrupan los días con el mismo bloque, para no repetir la alerta.
  if (Number.isInteger(slot) && slot > 0) {
    const pausa = local.pausa;
    const sobrantes = new Map(); // 'desde-hasta' → { desde, hasta, sobra, dias: [] }
    (local.horario ?? []).forEach((dia) => {
      const bloques = pausa
        ? [[dia.hora_inicio, pausa.hora_inicio], [pausa.hora_fin, dia.hora_fin]]
        : [[dia.hora_inicio, dia.hora_fin]];
      bloques.forEach(([desde, hasta]) => {
        const sobra = (aMinutos(hasta) - aMinutos(desde)) % slot;
        if (sobra === 0) return;
        const clave = `${desde}-${hasta}`;
        if (!sobrantes.has(clave)) sobrantes.set(clave, { desde, hasta, sobra, dias: [] });
        sobrantes.get(clave).dias.push(NOMBRES_DIA[dia.dia_semana]);
      });
    });
    sobrantes.forEach(({ desde, hasta, sobra, dias }) => {
      alertas.push(`Turnos de ${slot} min: de ${desde} a ${hasta} sobran ${sobra} min sin turno (${dias.join(', ')}).`);
    });
  }

  (datos.barberos ?? []).forEach((b) => {
    if (b.comision === 0 || b.comision === 100) {
      alertas.push(`${b.nombre} tiene comisión de ${b.comision} %. Confirmá que sea así.`);
    }
    if (!b.email) {
      alertas.push(`${b.nombre} no tiene mail: sus turnos no van a aparecer en su Google Calendar.`);
    }
  });

  [...(datos.servicios ?? []), ...(datos.productos ?? [])].forEach((item) => {
    if (item.precio < PRECIO_BAJO || item.precio >= PRECIO_ALTO) {
      alertas.push(`"${item.nombre}" cuesta $ ${Number(item.precio).toLocaleString('es-AR')}: revisá que no falte o sobre un cero.`);
    }
  });

  if (!local.resena_url) alertas.push('No cargó el link de reseñas de Google: el turnero no muestra "Dejanos tu reseña".');
  if (!(datos.productos ?? []).length) alertas.push('No cargó productos (se pueden sumar después desde el panel).');

  return alertas;
}

/**
 * main
 * Lee la solicitud del id recibido por argumento, la valida e imprime el JSON.
 * @returns {Promise<number>} El código de salida.
 */
async function main() {
  const id = (process.argv[2] ?? '').trim();
  if (!esUUID(id)) {
    console.log(JSON.stringify({ error: 'El id no es un uuid válido.' }));
    return 1;
  }

  const resultado = await query(
    `SELECT id, referencia, estado, datos, vence_en, enviada_en, created_at, updated_at,
            vence_en > now() AS vigente
     FROM solicitud_alta WHERE id = $1`,
    [id]
  );
  if (resultado.rows.length === 0) {
    console.log(JSON.stringify({ error: 'No existe una solicitud con ese id.' }));
    return 1;
  }

  const fila = resultado.rows[0];
  const { errores } = await validarSolicitudAlta(fila.datos);
  console.log(JSON.stringify({
    solicitud: {
      id: fila.id,
      referencia: fila.referencia,
      estado: fila.estado,
      vigente: fila.vigente,
      enviada_en: fila.enviada_en,
      vence_en: fila.vence_en,
    },
    errores,
    alertas: calcularAlertas(fila.datos),
    datos: fila.datos,
  }, null, 2));
  return 0;
}

let codigo = 1;
try {
  codigo = await main();
} catch (err) {
  console.log(JSON.stringify({ error: `No se pudo leer la solicitud: ${err.message}` }));
}
process.exit(codigo);
