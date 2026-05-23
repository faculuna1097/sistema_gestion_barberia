// Integración con Google Calendar API para sincronizar turnos con la agenda
// del barbero. Arquitectura A: una cuenta central (turnos.barbermanager@gmail.com)
// crea cada evento e invita al barbero como attendee usando barbero.email.
// Comportamiento best-effort: si fallan las llamadas o faltan las variables
// GOOGLE_*, se loguea y se devuelve null/false sin propagar el error.

import { google } from 'googleapis';

const TZ = 'America/Argentina/Buenos_Aires';

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_CALENDAR_EMAIL,
} = process.env;

const credencialesCargadas = Boolean(
  GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN && GOOGLE_CALENDAR_EMAIL
);

let calendar = null;

if (credencialesCargadas) {
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  console.log('[googleCalendar] credenciales cargadas | organizador:', GOOGLE_CALENDAR_EMAIL);
} else {
  console.warn('[googleCalendar] credenciales NO cargadas — la integración queda inactiva en este proceso');
}

/**
 * Arma el cuerpo del evento de Google Calendar a partir de los datos del turno.
 * Función interna, no exportada.
 *
 * @param {Object} turno - { inicio, fin } (timestamps ISO o Date)
 * @param {Object} barbero - { email }
 * @param {Object} servicio - { nombre }
 * @param {Object} cliente - { nombre, telefono?, email? }
 * @returns {Object} cuerpo del evento listo para enviar a la API
 */
const armarCuerpoEvento = (turno, barbero, servicio, cliente) => {
  const lineasDescripcion = [
    `Cliente: ${cliente.nombre}`,
    cliente.telefono ? `Teléfono: ${cliente.telefono}` : null,
    cliente.email ? `Email: ${cliente.email}` : null,
    '',
    'Turno gestionado desde BarberManager.',
  ].filter(linea => linea !== null);

  return {
    summary: `${cliente.nombre} — ${servicio.nombre}`,
    description: lineasDescripcion.join('\n'),
    start: {
      dateTime: new Date(turno.inicio).toISOString(),
      timeZone: TZ,
    },
    end: {
      dateTime: new Date(turno.fin).toISOString(),
      timeZone: TZ,
    },
    attendees: [{ email: barbero.email }],
  };
};

/**
 * Crea un evento en el calendario central, invitando al barbero como attendee.
 * Si el barbero no tiene email o faltan credenciales, no llama a la API.
 *
 * @param {Object} turno - { inicio, fin }
 * @param {Object} barbero - { email }
 * @param {Object} servicio - { nombre }
 * @param {Object} cliente - { nombre, telefono?, email? }
 * @returns {Promise<string|null>} google_event_id si OK, null si falla o se saltea
 */
export const crearEvento = async (turno, barbero, servicio, cliente) => {
  if (!credencialesCargadas) {
    console.warn('[googleCalendar] crearEvento — saltado: faltan credenciales');
    return null;
  }
  if (!barbero?.email) {
    console.warn('[googleCalendar] crearEvento — saltado: barbero sin email cargado');
    return null;
  }

  try {
    const respuesta = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: 'none',
      requestBody: armarCuerpoEvento(turno, barbero, servicio, cliente),
    });
    const eventId = respuesta.data.id;
    console.log('[googleCalendar] crearEvento completado | google_event_id:', eventId);
    return eventId;
  } catch (err) {
    console.error('[googleCalendar] Error en crearEvento:', err);
    return null;
  }
};

/**
 * Borra un evento del calendario central. Notifica al barbero (sendUpdates: all).
 *
 * @param {string} google_event_id
 * @returns {Promise<boolean>} true si OK, false si falla o se saltea
 */
export const cancelarEvento = async (google_event_id) => {
  if (!credencialesCargadas) {
    console.warn('[googleCalendar] cancelarEvento — saltado: faltan credenciales');
    return false;
  }
  if (!google_event_id) {
    console.warn('[googleCalendar] cancelarEvento — saltado: google_event_id vacío');
    return false;
  }

  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: google_event_id,
      sendUpdates: 'all',
    });
    console.log('[googleCalendar] cancelarEvento completado | google_event_id:', google_event_id);
    return true;
  } catch (err) {
    console.error('[googleCalendar] Error en cancelarEvento:', err);
    return false;
  }
};

/**
 * Reemplaza fecha/hora y datos relacionados de un evento existente.
 *
 * @param {string} google_event_id
 * @param {Object} nuevoTurno - { inicio, fin }
 * @param {Object} barbero - { email }
 * @param {Object} servicio - { nombre }
 * @param {Object} cliente - { nombre, telefono?, email? }
 * @returns {Promise<boolean>} true si OK, false si falla o se saltea
 */
export const actualizarEvento = async (google_event_id, nuevoTurno, barbero, servicio, cliente) => {
  if (!credencialesCargadas) {
    console.warn('[googleCalendar] actualizarEvento — saltado: faltan credenciales');
    return false;
  }
  if (!google_event_id) {
    console.warn('[googleCalendar] actualizarEvento — saltado: google_event_id vacío');
    return false;
  }

  try {
    await calendar.events.update({
      calendarId: 'primary',
      eventId: google_event_id,
      sendUpdates: 'all',
      requestBody: armarCuerpoEvento(nuevoTurno, barbero, servicio, cliente),
    });
    console.log('[googleCalendar] actualizarEvento completado | google_event_id:', google_event_id);
    return true;
  } catch (err) {
    console.error('[googleCalendar] Error en actualizarEvento:', err);
    return false;
  }
};
