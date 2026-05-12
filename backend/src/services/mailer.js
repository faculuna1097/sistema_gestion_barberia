// Envío de mails transaccionales del turnero. Usa Nodemailer + SMTP de Gmail
// con App Password de la cuenta turnos.barbermanager@gmail.com (la misma que
// figura como organizador de los eventos de Google Calendar).
// Comportamiento best-effort: si faltan credenciales, si el cliente no tiene
// email, o si SMTP devuelve error, se loguea y se devuelve false sin propagar.
// El contenido de los mails está intencionalmente minimalista — se reescribe
// en un chat aparte.

import nodemailer from 'nodemailer';

const TZ = 'America/Argentina/Buenos_Aires';

const {
  GMAIL_APP_PASSWORD,
  GOOGLE_CALENDAR_EMAIL,
} = process.env;

const credencialesCargadas = Boolean(GMAIL_APP_PASSWORD && GOOGLE_CALENDAR_EMAIL);

let transporter = null;

if (credencialesCargadas) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GOOGLE_CALENDAR_EMAIL,
      pass: GMAIL_APP_PASSWORD,
    },
  });
  console.log('[mailer] transporter inicializado | remitente:', GOOGLE_CALENDAR_EMAIL);
} else {
  console.warn('[mailer] credenciales NO cargadas — el envío de mails queda inactivo en este proceso');
}

/**
 * Formatea un timestamp como "14/05 10:30" en TZ Argentina.
 * Función interna, no exportada.
 *
 * @param {string|Date} timestamp
 * @returns {string} fecha legible
 */
const formatearFecha = (timestamp) => {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).format(new Date(timestamp));
};

/**
 * Envía un mail. Wrapper interno con manejo de errores y logging común.
 *
 * @param {Object} opciones - { destino, asunto, texto, nombreFuncion }
 * @returns {Promise<boolean>} true si OK, false si falla
 */
const enviarMail = async ({ destino, asunto, texto, nombreFuncion }) => {
  try {
    await transporter.sendMail({
      from: `BarberManager <${GOOGLE_CALENDAR_EMAIL}>`,
      to: destino,
      subject: asunto,
      text: texto,
      html: `<pre style="font-family: Arial, sans-serif;">${texto}</pre>`,
    });
    console.log(`[mailer] ${nombreFuncion} — completado | destino:`, destino);
    return true;
  } catch (err) {
    console.error(`[mailer] Error en ${nombreFuncion}:`, err.message);
    return false;
  }
};

/**
 * Chequea precondiciones comunes (credenciales y email del cliente).
 * Loguea + devuelve true si hay que saltearse el envío.
 *
 * @param {string} nombreFuncion
 * @param {Object} cliente
 * @returns {boolean} true si hay que saltearse, false si se puede enviar
 */
const debeSaltarseEnvio = (nombreFuncion, cliente) => {
  if (!credencialesCargadas) {
    console.warn(`[mailer] ${nombreFuncion} — saltado: faltan credenciales`);
    return true;
  }
  if (!cliente?.email) {
    console.warn(`[mailer] ${nombreFuncion} — saltado: cliente sin email`);
    return true;
  }
  return false;
};

/**
 * Mail de confirmación de turno reservado.
 *
 * @param {Object} turno - { inicio, fin }
 * @param {Object} barbero - { nombre }
 * @param {Object} servicio - { nombre }
 * @param {Object} cliente - { nombre, email }
 * @param {string} linkGestion - URL para cancelar/reprogramar
 * @returns {Promise<boolean>}
 */
export const enviarConfirmacion = async (turno, barbero, servicio, cliente, linkGestion) => {
  console.log('[mailer] enviarConfirmacion — request recibido | cliente_email:', cliente?.email ?? '(null)');
  if (debeSaltarseEnvio('enviarConfirmacion', cliente)) return false;

  const fechaTexto = formatearFecha(turno.inicio);
  const asunto = `Turno confirmado — ${fechaTexto}`;
  const texto = `Turno confirmado.\n\nServicio: ${servicio.nombre}\nBarbero: ${barbero.nombre}\nFecha: ${fechaTexto}\n\nGestionar: ${linkGestion}`;

  return enviarMail({ destino: cliente.email, asunto, texto, nombreFuncion: 'enviarConfirmacion' });
};

/**
 * Mail de cancelación de turno hecha por cliente/barbero/admin.
 * Para cancelaciones por suspensión usar enviarCancelacionPorSuspension.
 *
 * @param {Object} turno - { inicio }
 * @param {Object} barbero - { nombre }
 * @param {Object} servicio - { nombre }
 * @param {Object} cliente - { nombre, email }
 * @param {'cliente'|'barbero'|'admin'} canceladoPor
 * @returns {Promise<boolean>}
 */
export const enviarCancelacion = async (turno, barbero, servicio, cliente, canceladoPor) => {
  console.log('[mailer] enviarCancelacion — request recibido | cliente_email:', cliente?.email ?? '(null)', '| canceladoPor:', canceladoPor);
  if (debeSaltarseEnvio('enviarCancelacion', cliente)) return false;

  const fechaTexto = formatearFecha(turno.inicio);
  const asunto = `Turno cancelado — ${fechaTexto}`;
  const texto = `Turno cancelado.\n\nServicio: ${servicio.nombre}\nBarbero: ${barbero.nombre}\nFecha: ${fechaTexto}\nCancelado por: ${canceladoPor}`;

  return enviarMail({ destino: cliente.email, asunto, texto, nombreFuncion: 'enviarCancelacion' });
};

/**
 * Mail de reprogramación de turno (cambio de fecha/hora).
 *
 * @param {Object} turno - { inicio, fin } con los NUEVOS valores
 * @param {Object} barbero - { nombre }
 * @param {Object} servicio - { nombre }
 * @param {Object} cliente - { nombre, email }
 * @param {string} linkGestion - URL para cancelar/reprogramar
 * @returns {Promise<boolean>}
 */
export const enviarReprogramacion = async (turno, barbero, servicio, cliente, linkGestion) => {
  console.log('[mailer] enviarReprogramacion — request recibido | cliente_email:', cliente?.email ?? '(null)');
  if (debeSaltarseEnvio('enviarReprogramacion', cliente)) return false;

  const fechaTexto = formatearFecha(turno.inicio);
  const asunto = `Turno reprogramado — ${fechaTexto}`;
  const texto = `Turno reprogramado.\n\nServicio: ${servicio.nombre}\nBarbero: ${barbero.nombre}\nNueva fecha: ${fechaTexto}\n\nGestionar: ${linkGestion}`;

  return enviarMail({ destino: cliente.email, asunto, texto, nombreFuncion: 'enviarReprogramacion' });
};

/**
 * Mail de cancelación automática disparada por una suspensión del barbero.
 *
 * @param {Object} turno - { inicio }
 * @param {Object} barbero - { nombre }
 * @param {Object} servicio - { nombre }
 * @param {Object} cliente - { nombre, email }
 * @param {string|null} motivoSuspension
 * @param {string} linkTurnero - URL para reservar de nuevo
 * @returns {Promise<boolean>}
 */
export const enviarCancelacionPorSuspension = async (turno, barbero, servicio, cliente, motivoSuspension, linkTurnero) => {
  console.log('[mailer] enviarCancelacionPorSuspension — request recibido | cliente_email:', cliente?.email ?? '(null)');
  if (debeSaltarseEnvio('enviarCancelacionPorSuspension', cliente)) return false;

  const fechaTexto = formatearFecha(turno.inicio);
  const asunto = `Turno cancelado — ${fechaTexto}`;
  const texto = `Turno cancelado por suspensión del barbero.\n\nServicio: ${servicio.nombre}\nBarbero: ${barbero.nombre}\nFecha: ${fechaTexto}\nMotivo: ${motivoSuspension ?? '(sin motivo)'}\n\nReservar de nuevo: ${linkTurnero}`;

  return enviarMail({ destino: cliente.email, asunto, texto, nombreFuncion: 'enviarCancelacionPorSuspension' });
};
