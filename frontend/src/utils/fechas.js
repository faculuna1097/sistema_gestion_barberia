// /frontend/src/utils/fechas.js

// Helpers de fecha compartidos del proyecto.
// Todas las funciones operan en timezone Argentina y devuelven strings
// en los formatos canónicos del proyecto:
//   - Mes:    'YYYY-MM'      (ej: '2026-03')
//   - Semana: 'YYYY-WNN'     (ej: '2026-W12'), semana ISO
//   - Día:    'YYYY-MM-DD'   (ej: '2026-03-15')

export const TZ = 'America/Argentina/Buenos_Aires';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const DIAS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
];

// ─── "Hoy" en formato del proyecto ────────────────────────────────────────────

/** Devuelve el día de hoy en formato 'YYYY-MM-DD' (timezone Argentina). */
export const getFechaHoy = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

/** Devuelve el mes actual en formato 'YYYY-MM' (timezone Argentina). */
export const getMesActual = () => getFechaHoy().slice(0, 7);

/** Devuelve la semana ISO actual en formato 'YYYY-WNN' (timezone Argentina). */
export const getSemanaActual = () => {
  const [year, week] = getISOWeekNum(new Date());
  return `${year}-W${String(week).padStart(2, '0')}`;
};

// ─── Hora desde timestamp ─────────────────────────────────────────────────────

/**
 * Extrae la hora 'HH:MM' de un timestamp ISO, en timezone Argentina.
 * @param {string} iso - Timestamp ISO (ej: '2026-05-14T10:30:00-03:00')
 * @returns {string} 'HH:MM' (24h)
 */
export const formatHora = (iso) =>
  new Date(iso).toLocaleTimeString('es-AR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

// ─── Desplazamiento (anterior/siguiente) ──────────────────────────────────────

/**
 * Avanza o retrocede meses desde un string 'YYYY-MM'.
 * @param {string} mesStr - Mes en formato 'YYYY-MM'
 * @param {number} delta  - Cantidad de meses a sumar (puede ser negativo)
 * @returns {string} Nuevo mes en formato 'YYYY-MM'
 */
export const desplazarMes = (mesStr, delta) => {
  const [anio, mes] = mesStr.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + delta, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Avanza o retrocede semanas ISO desde un string 'YYYY-WNN'.
 * @param {string} semanaStr - Semana en formato 'YYYY-WNN'
 * @param {number} delta     - Cantidad de semanas a sumar (puede ser negativo)
 * @returns {string} Nueva semana en formato 'YYYY-WNN'
 */
export const desplazarSemana = (semanaStr, delta) => {
  const lunes = semanaALunes(semanaStr);
  lunes.setDate(lunes.getDate() + delta * 7);
  const [year, week] = getISOWeekNum(lunes);
  return `${year}-W${String(week).padStart(2, '0')}`;
};

/**
 * Avanza o retrocede días desde un string 'YYYY-MM-DD'.
 * @param {string} fechaStr - Día en formato 'YYYY-MM-DD'
 * @param {number} delta    - Cantidad de días a sumar (puede ser negativo)
 * @returns {string} Nuevo día en formato 'YYYY-MM-DD'
 */
export const desplazarDia = (fechaStr, delta) => {
  const [anio, mes, dia] = fechaStr.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia + delta);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
};

// ─── Labels legibles ──────────────────────────────────────────────────────────

/**
 * Convierte un mes 'YYYY-MM' a un label legible en español.
 * @example mesALabel('2026-03') → 'Marzo 2026'
 */
export const mesALabel = (mesStr) => {
  const [anio, mes] = mesStr.split('-');
  return `${MESES[parseInt(mes, 10) - 1]} ${anio}`;
};

/**
 * Convierte una semana 'YYYY-WNN' al rango lunes → domingo.
 * @example semanaALabel('2026-W12') → '23/03 → 29/03/2026'
 */
export const semanaALabel = (semanaStr) => {
  const lunes = semanaALunes(semanaStr);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  const fmtCorto = (d) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${fmtCorto(lunes)} → ${fmtCorto(domingo)}/${domingo.getFullYear()}`;
};

/**
 * Convierte un día 'YYYY-MM-DD' a un label legible largo.
 * @example fechaALabel('2026-03-15') → 'Domingo 15 de Marzo de 2026'
 */
export const fechaALabel = (fechaStr) => {
  const [anio, mes, dia] = fechaStr.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return `${DIAS[fecha.getDay()]} ${dia} de ${MESES[mes - 1]} de ${anio}`;
};

/**
 * Convierte un día 'YYYY-MM-DD' a un label corto con día de la semana.
 * Usado en el detalle semanal de Planillas.
 * @example formatFechaCorta('2026-03-15') → 'Domingo 15/03'
 */
export const formatFechaCorta = (fechaStr) => {
  const [anio, mes, dia] = fechaStr.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return `${DIAS[fecha.getDay()]} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
};

// ─── Conversión semana ISO → fecha ────────────────────────────────────────────

/**
 * Convierte una semana ISO 'YYYY-WNN' a la fecha del lunes en formato 'YYYY-MM-DD'.
 * Útil para enviar la semana al backend que espera formato fecha.
 * @param {string} semanaStr - Semana en formato 'YYYY-WNN'
 * @returns {string} Fecha del lunes en formato 'YYYY-MM-DD'
 */
export const semanaAFechaLunes = (semanaStr) => {
  const lunes = semanaALunes(semanaStr);
  return `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`;
};

// ─── Internals: cálculo de semana ISO ─────────────────────────────────────────

/**
 * Calcula año y número de semana ISO 8601 para una fecha.
 * Algoritmo: jueves de la semana → semana 1 = la que contiene al 4 de enero.
 * @returns {[number, number]} [año, número de semana]
 */
function getISOWeekNum(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Mover al jueves de esa semana ISO
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return [d.getFullYear(), weekNum];
}

/**
 * Devuelve el lunes (objeto Date local) de una semana 'YYYY-WNN'.
 * Usado internamente por desplazarSemana y semanaALabel.
 */
function semanaALunes(semanaStr) {
  const [yearStr, wStr] = semanaStr.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(wStr);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const lunesSemana1 = new Date(jan4);
  lunesSemana1.setDate(jan4.getDate() - (jan4Day - 1));
  const lunes = new Date(lunesSemana1);
  lunes.setDate(lunesSemana1.getDate() + (week - 1) * 7);
  return lunes;
}