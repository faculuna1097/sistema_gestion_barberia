// /frontend-turnero/src/utils/calendario.js
// "Agregar al calendario": el evento de un turno como archivo .ics (lo abren
// Calendario de Apple, Outlook y casi cualquier otro calendario) o como link de
// Google Calendar, y cuál de las dos opciones ofrecer primero.
// Funciones puras (sin React) para poder probarlas con Node, salvo
// `descargarIcs`, que necesita el DOM.

import { fechaDeISO } from './fecha.js';

// Largo máximo de una línea del .ics, en octetos (RFC 5545 §3.1). Las más
// largas se pliegan en varias.
const MAX_OCTETOS_LINEA = 75;

// El UID de un evento tiene que ser único en el mundo: el id del turno + un
// dominio propio lo es. Con el mismo UID, volver a agregar el turno (ej. desde
// la gestión, después de reprogramarlo) actualiza el evento en vez de duplicarlo.
const DOMINIO_UID = 'barbermanager.app';

// Aviso del calendario: una hora antes del turno.
const ALARMA_ANTES = '-PT1H';

/**
 * fmtInstanteUtc
 * Fecha y hora en el formato de iCalendar y de Google Calendar, en UTC.
 * @param {string|Date} instante - ISO con offset (ej. '2026-10-08T15:30:00-03:00') o Date
 * @returns {string} Ej: '20261008T183000Z'
 */
export function fmtInstanteUtc(instante) {
  return new Date(instante).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * escaparTexto
 * Escapa un valor de texto del .ics (RFC 5545 §3.3.11): barra invertida, punto
 * y coma, coma y saltos de línea. Sin esto, una dirección con comas
 * ("Av. Corrientes 1234, CABA") se leería como una lista de valores.
 * @param {string} texto
 * @returns {string} Ej: 'Av. Corrientes 1234\\, CABA'
 */
function escaparTexto(texto) {
  return String(texto)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * plegarLinea
 * Parte una línea de más de 75 octetos (RFC 5545 §3.1): cada continuación va
 * en una línea nueva que arranca con un espacio. Cuenta octetos UTF-8, no
 * caracteres ("á" ocupa 2), y nunca corta un carácter a la mitad.
 * @param {string} linea - Línea sin el CRLF final
 * @returns {string} La línea, plegada con CRLF + espacio si hace falta
 */
function plegarLinea(linea) {
  const codificador = new TextEncoder();
  const partes = [];
  let actual = '';
  let octetos = 0;
  for (const caracter of linea) {
    const tamanio = codificador.encode(caracter).length;
    // Las continuaciones arrancan con un espacio, que también cuenta.
    const limite = partes.length === 0 ? MAX_OCTETOS_LINEA : MAX_OCTETOS_LINEA - 1;
    if (octetos + tamanio > limite) {
      partes.push(actual);
      actual = '';
      octetos = 0;
    }
    actual += caracter;
    octetos += tamanio;
  }
  partes.push(actual);
  return partes.join('\r\n ');
}

/**
 * armarIcs
 * Arma el contenido de un archivo .ics con un evento y un aviso una hora antes.
 * Saltos de línea CRLF y horarios en UTC, como pide el estándar.
 * @param {Object} evento - El de `eventoDeTurno`
 * @param {string} evento.uid - Id único del evento (el turno_id)
 * @param {string} evento.titulo
 * @param {string} evento.inicio - ISO con offset
 * @param {string} evento.fin - ISO con offset
 * @param {string|null} [evento.ubicacion]
 * @param {string|null} [evento.descripcion]
 * @param {Date} [ahora=new Date()] - Momento en que se genera (DTSTAMP); parámetro para poder probarlo
 * @returns {string} Contenido del .ics
 */
export function armarIcs({ uid, titulo, inicio, fin, ubicacion, descripcion }, ahora = new Date()) {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BarberManager//Turnero//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@${DOMINIO_UID}`,
    `DTSTAMP:${fmtInstanteUtc(ahora)}`,
    `DTSTART:${fmtInstanteUtc(inicio)}`,
    `DTEND:${fmtInstanteUtc(fin)}`,
    `SUMMARY:${escaparTexto(titulo)}`,
    ubicacion ? `LOCATION:${escaparTexto(ubicacion)}` : null,
    descripcion ? `DESCRIPTION:${escaparTexto(descripcion)}` : null,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escaparTexto(titulo)}`,
    `TRIGGER:${ALARMA_ANTES}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lineas.filter(Boolean).map(plegarLinea).join('\r\n')}\r\n`;
}

/**
 * linkGoogleCalendar
 * Link que abre Google Calendar con el evento cargado, listo para guardar.
 * El aviso lo pone Google según la configuración de cada usuario: el link no
 * permite elegirlo.
 * @param {Object} evento - El de `eventoDeTurno` ({ titulo, inicio, fin, ubicacion?, descripcion? })
 * @returns {string} Ej: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=…'
 */
export function linkGoogleCalendar({ titulo, inicio, fin, ubicacion, descripcion }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo,
    dates: `${fmtInstanteUtc(inicio)}/${fmtInstanteUtc(fin)}`,
  });
  if (descripcion) params.set('details', descripcion);
  if (ubicacion) params.set('location', ubicacion);
  return `https://calendar.google.com/calendar/render?${params}`;
}

/**
 * eventoDeTurno
 * Arma el evento de calendario de un turno. Un solo lugar para el contenido,
 * que comparten el éxito de la reserva y la gestión del turno:
 * - título: "{servicio} en {local}";
 * - lugar: la dirección del local;
 * - descripción: "Con {barbero}." y el link para cancelar o reprogramar.
 * @param {Object} datos
 * @param {string} datos.turnoId - turno_id (va al UID)
 * @param {string} datos.servicio - Nombre del servicio
 * @param {string} [datos.local] - Nombre del local
 * @param {string|null} [datos.barbero] - Nombre del barbero (null si no se conoce)
 * @param {string|null} [datos.direccion] - Dirección del local
 * @param {string} datos.inicio - ISO con offset
 * @param {string} datos.fin - ISO con offset
 * @param {string} datos.urlGestion - URL completa de la gestión del turno
 * @returns {{ uid: string, titulo: string, inicio: string, fin: string,
 *   ubicacion: string|null, descripcion: string }}
 */
export function eventoDeTurno({
  turnoId, servicio, local, barbero, direccion, inicio, fin, urlGestion,
}) {
  return {
    uid: turnoId,
    titulo: local ? `${servicio} en ${local}` : servicio,
    inicio,
    fin,
    ubicacion: direccion || null,
    descripcion: [
      barbero ? `Con ${barbero}.` : null,
      `Para cancelar o reprogramar: ${urlGestion}`,
    ].filter(Boolean).join('\n'),
  };
}

/**
 * esDispositivoApple
 * True en iPhone, iPad y Mac: ahí el .ics lo abre Calendario de Apple, que es
 * el calendario que usa casi todo el mundo. En el resto conviene Google
 * Calendar. El iPad con Safari se anuncia como Mac ("Macintosh"), así que
 * también entra. Se mira el user agent porque Safari no tiene otra forma de
 * saberlo (no implementa `navigator.userAgentData`).
 * @param {string} [userAgent=navigator.userAgent] - Parámetro para poder probarlo
 * @returns {boolean}
 */
export function esDispositivoApple(userAgent = navigator.userAgent) {
  return /iPhone|iPad|iPod|Macintosh/i.test(userAgent);
}

/**
 * nombreArchivoIcs
 * Nombre del archivo .ics de un turno, con su fecha.
 * @param {string} inicio - ISO del turno
 * @returns {string} Ej: 'turno-2026-10-08.ics'
 */
export function nombreArchivoIcs(inicio) {
  return `turno-${fechaDeISO(inicio)}.ics`;
}

/**
 * descargarIcs
 * Descarga el .ics: arma un Blob y lo baja con un `<a download>` temporal.
 * En iPhone, Safari ofrece agregarlo a Calendario; en una computadora queda
 * descargado para abrirlo. La URL del Blob se libera un rato después, no en el
 * acto: Safari lee el archivo después del click.
 * @param {string} contenido - Contenido del .ics (de `armarIcs`)
 * @param {string} nombreArchivo - Ej: 'turno-2026-10-08.ics'
 * @returns {void}
 */
export function descargarIcs(contenido, nombreArchivo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/calendar;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
