// /frontend-turnero/src/utils/estadoNegocio.js
// Si el local está abierto ahora y, si no, cuándo abre. Lo muestra el hero del
// local (HeroLocal), en la landing del celular y en el panel de la pantalla
// ancha. Funciones puras: usan la hora local del navegador.

import { fechaLocalISO } from './fecha.js';

/**
 * NOMBRES_DIA
 * Nombres de día de semana en español, indexados 0..6 (0=domingo),
 * misma convención que `dia_semana` del backend.
 */
export const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * buscarProximaApertura
 * Recorre los próximos 7 días buscando el primer día/hora en que el negocio
 * abre. Saltea feriados. Para el día de hoy, solo cuenta si la apertura
 * todavía no pasó.
 * @param {Array<Object>} horarioAtencion - días abiertos [{ dia_semana, hora_inicio, hora_fin }]
 * @param {Array<Object>} feriados - feriados del tenant [{ fecha }]
 * @param {Date} ahora - Momento de referencia
 * @param {string} horaActual - Hora actual en 'HH:MM'
 * @returns {string|null} Ej: "hoy 14:00", "mañana 10:00", "el martes 10:00"; null si no abre en 7 días
 */
function buscarProximaApertura(horarioAtencion, feriados, ahora, horaActual) {
  for (let offset = 0; offset <= 7; offset++) {
    const fecha = new Date(ahora);
    fecha.setDate(ahora.getDate() + offset);

    if (feriados.some((f) => f.fecha === fechaLocalISO(fecha))) continue;

    const dia = horarioAtencion.find((h) => h.dia_semana === fecha.getDay());
    if (!dia) continue;

    // El día de hoy solo cuenta si la apertura todavía no pasó.
    if (offset === 0 && horaActual >= dia.hora_inicio) continue;

    let cuando;
    if (offset === 0) cuando = 'hoy';
    else if (offset === 1) cuando = 'mañana';
    else cuando = `el ${NOMBRES_DIA[fecha.getDay()]}`;

    return `${cuando} ${dia.hora_inicio}`;
  }
  return null;
}

/**
 * calcularEstadoNegocio
 * Determina si el negocio está abierto en este momento, según su horario
 * de atención semanal y sus feriados. Si está cerrado, calcula cuándo abre.
 * @param {Array<Object>} horarioAtencion - días abiertos [{ dia_semana, hora_inicio, hora_fin }]
 * @param {Array<Object>} feriados - feriados del tenant [{ fecha }]
 * @returns {{ abierto: boolean, texto: string }} estado + label a mostrar
 */
export function calcularEstadoNegocio(horarioAtencion = [], feriados = []) {
  const ahora = new Date();

  // Hora actual en 'HH:MM' para comparar como string contra el rango.
  const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

  // Horario de hoy — null si hoy es feriado o el negocio no atiende ese día.
  const hoyEsFeriado = feriados.some((f) => f.fecha === fechaLocalISO(ahora));
  const diaHoy = hoyEsFeriado
    ? null
    : horarioAtencion.find((h) => h.dia_semana === ahora.getDay());

  // Abierto: hay horario hoy y la hora actual cae dentro del rango.
  if (diaHoy && horaActual >= diaHoy.hora_inicio && horaActual < diaHoy.hora_fin) {
    return { abierto: true, texto: `Abierto · cierra ${diaHoy.hora_fin}` };
  }

  // Cerrado: buscar la próxima apertura en los próximos 7 días.
  const proxima = buscarProximaApertura(horarioAtencion, feriados, ahora, horaActual);
  return {
    abierto: false,
    texto: proxima ? `Cerrado · abre ${proxima}` : 'Cerrado',
  };
}
