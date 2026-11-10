// /frontend-alta/src/utils/horas.js
// Aritmética y formato de las horas del día ('HH:MM', columnas `time` de la
// DB) del formulario: el horario del local (fase 3) y el de cada barbero
// (fase 4) se cargan con botones de +/- 30 min, así que todas las horas van en
// punto o y media, de 00:00 a 23:30 (validaciones.js → `hora`).
// Funciones puras (sin React) para poder probarlas con Node.

/**
 * PASO_MINUTOS
 * Lo que suma o resta cada toque de un botón +/- (las horas van en punto o y media).
 */
export const PASO_MINUTOS = 30;

// Minutos de un día: 24:00 no existe como hora ('HH:MM' llega hasta 23:59).
const MINUTOS_DIA = 24 * 60;

/**
 * HORA_MINIMA / HORA_MAXIMA
 * La primera y la última hora que se pueden elegir con los botones.
 */
export const HORA_MINIMA = '00:00';
export const HORA_MAXIMA = '23:30';

/**
 * aMinutos
 * @param {string} hora - 'HH:MM' (o 'HH:MM:SS': se ignoran los segundos)
 * @returns {number} Minutos desde la medianoche.
 */
export function aMinutos(hora) {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

/**
 * aHora
 * @param {number} minutos - Minutos desde la medianoche (0 a 1439)
 * @returns {string} La hora en 'HH:MM'.
 */
export function aHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * sumarMinutos
 * Corre una hora `delta` minutos, sin pasar de HORA_MINIMA a HORA_MAXIMA.
 * @param {string} hora - 'HH:MM'
 * @param {number} delta - Minutos a sumar (negativo para restar)
 * @returns {string} La hora nueva en 'HH:MM'.
 */
export function sumarMinutos(hora, delta) {
  const minutos = Math.min(Math.max(aMinutos(hora) + delta, aMinutos(HORA_MINIMA)), aMinutos(HORA_MAXIMA));
  return aHora(minutos);
}

/**
 * compararHoras
 * Para ordenar o comparar dos horas 'HH:MM' (las de distinto largo, como
 * '09:00' y '09:00:00', se comparan por minutos).
 * @param {string} a
 * @param {string} b
 * @returns {number} Negativo si a es antes, 0 si son la misma, positivo si a es después.
 */
export function compararHoras(a, b) {
  return aMinutos(a) - aMinutos(b);
}

/**
 * minutosEntre
 * @param {string} desde - 'HH:MM'
 * @param {string} hasta - 'HH:MM'
 * @returns {number} Minutos de `desde` a `hasta` (negativo si `hasta` es antes).
 */
export function minutosEntre(desde, hasta) {
  return aMinutos(hasta) - aMinutos(desde);
}

/**
 * esHoraDelPaso
 * @param {*} valor
 * @returns {boolean} true si es 'HH:MM' válida, en punto o y media (lo que
 *   dejan elegir los botones y acepta el backend).
 */
export function esHoraDelPaso(valor) {
  return typeof valor === 'string'
    && /^([01]\d|2[0-3]):(00|30)$/.test(valor)
    && aMinutos(valor) < MINUTOS_DIA;
}

/**
 * esRangoValido
 * @param {*} rango - { hora_inicio, hora_fin }
 * @returns {boolean} true si las dos horas son del paso y el fin es posterior al inicio.
 */
export function esRangoValido(rango) {
  return Boolean(rango)
    && esHoraDelPaso(rango.hora_inicio)
    && esHoraDelPaso(rango.hora_fin)
    && compararHoras(rango.hora_fin, rango.hora_inicio) > 0;
}

/**
 * mismoRango
 * @param {{hora_inicio: string, hora_fin: string}} a
 * @param {{hora_inicio: string, hora_fin: string}} b
 * @returns {boolean} true si empiezan y terminan a la misma hora.
 */
export function mismoRango(a, b) {
  return a.hora_inicio === b.hora_inicio && a.hora_fin === b.hora_fin;
}

/**
 * fmtHoraCorta
 * La hora para leer de un vistazo: en punto sin los minutos ("10"), y media
 * con ellos ("10:30"). Para las barras de la semana, donde entra poco.
 * @param {string} hora - 'HH:MM'
 * @returns {string}
 */
export function fmtHoraCorta(hora) {
  const h = String(Number(hora.slice(0, 2)));
  return hora.slice(3, 5) === '00' ? h : `${h}:${hora.slice(3, 5)}`;
}

/**
 * fmtRango
 * Un rango para leer: "10:00 a 20:00".
 * @param {{hora_inicio: string, hora_fin: string}} rango
 * @returns {string}
 */
export function fmtRango(rango) {
  return `${rango.hora_inicio} a ${rango.hora_fin}`;
}

/**
 * fmtRangoCorto
 * Un rango compacto: "10 a 20", "9:30 a 13".
 * @param {{hora_inicio: string, hora_fin: string}} rango
 * @returns {string}
 */
export function fmtRangoCorto(rango) {
  return `${fmtHoraCorta(rango.hora_inicio)} a ${fmtHoraCorta(rango.hora_fin)}`;
}
