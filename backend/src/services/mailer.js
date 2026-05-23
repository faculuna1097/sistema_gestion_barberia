// Envío de mails transaccionales del turnero. Usa Nodemailer + SMTP de Gmail
// con App Password de la cuenta turnos.barbermanager@gmail.com (la misma que
// figura como organizador de los eventos de Google Calendar).
// Comportamiento best-effort: si faltan credenciales, si el cliente no tiene
// email, o si SMTP devuelve error, se loguea y se devuelve false sin propagar.
// El HTML de los mails sigue el sistema de diseño "Luz" (ver
// docs/sistema_de_disenio.md): card clara centrada, acento indigo único,
// tipografía neutra. Geist no carga de forma confiable en clientes de mail,
// así que se usa el stack de fallback de los tokens.

import nodemailer from 'nodemailer';

const TZ = 'America/Argentina/Buenos_Aires';

// Espejo (parcial) de los tokens del tema "Luz". El backend no puede importar
// frontend-turnero/src/theme/tokens.js, así que se replican acá los valores
// que usa el HTML de los mails. Si cambian los tokens, sincronizar esto.
const paleta = {
  bg:       '#FAFAFA',
  surface:  '#FFFFFF',
  ink:      '#09090B',
  inkSoft:  '#27272A',
  muted:    '#71717A',
  hairline: '#E4E4E7',
  accent:   '#4F46E5',
  accentInk:'#FFFFFF',
  success:  '#15803D',
  danger:   '#B91C1C',
  fontBody: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

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
 * Escapa caracteres con significado en HTML para que valores dinámicos
 * (nombres de servicio, barbero, motivos) no rompan ni inyecten markup.
 * Función interna, no exportada.
 *
 * @param {string} valor
 * @returns {string} texto seguro para interpolar en HTML
 */
const escaparHtml = (valor) => {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/**
 * Construye el HTML de un mail transaccional con la estética del tema "Luz":
 * card clara centrada, eyebrow de estado, filas de detalle y CTA opcional.
 * Función interna, no exportada.
 *
 * @param {Object} opciones
 * @param {string} opciones.eyebrow - micro-label de estado (ej. "Turno confirmado")
 * @param {string} opciones.eyebrowColor - color del eyebrow (token de paleta)
 * @param {string} opciones.titulo - título principal del mail
 * @param {string} opciones.intro - línea de texto introductoria
 * @param {Array<{label: string, valor: string}>} opciones.filas - detalle del turno
 * @param {{label: string, url: string}|null} [opciones.cta] - botón de acción
 * @returns {string} HTML completo del mail
 */
const construirHtml = ({ eyebrow, eyebrowColor, titulo, intro, filas, cta }) => {
  // Filas de detalle estilo SummaryRow: label muted a la izquierda,
  // valor ink a la derecha, separador hairline entre filas.
  const filasHtml = filas.map((fila, i) => {
    const borde = i < filas.length - 1
      ? `border-bottom:1px solid ${paleta.hairline};`
      : '';
    return `
      <tr>
        <td style="padding:12px 0;${borde}font-size:14px;color:${paleta.muted};">${escaparHtml(fila.label)}</td>
        <td style="padding:12px 0;${borde}font-size:14px;color:${paleta.ink};font-weight:500;text-align:right;">${escaparHtml(fila.valor)}</td>
      </tr>`;
  }).join('');

  // Botón CTA "bulletproof" (tabla anidada) — siempre indigo, acento único.
  const ctaHtml = cta ? `
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
      <tr>
        <td style="border-radius:10px;background:${paleta.accent};">
          <a href="${escaparHtml(cta.url)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:500;color:${paleta.accentInk};text-decoration:none;border-radius:10px;">${escaparHtml(cta.label)}</a>
        </td>
      </tr>
    </table>` : '';

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${paleta.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${paleta.bg};font-family:${paleta.fontBody};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:${paleta.surface};border:1px solid ${paleta.hairline};border-radius:14px;">
          <tr>
            <td style="padding:32px 24px;">
              <div style="font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:${eyebrowColor};">${escaparHtml(eyebrow)}</div>
              <h1 style="margin:8px 0 0;font-size:24px;font-weight:600;color:${paleta.ink};">${escaparHtml(titulo)}</h1>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:${paleta.inkSoft};">${escaparHtml(intro)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
                ${filasHtml}
              </table>
              ${ctaHtml}
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:${paleta.muted};font-family:${paleta.fontBody};">BarberManager</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Envía un mail. Wrapper interno con manejo de errores y logging común.
 *
 * @param {Object} opciones - { destino, asunto, texto, html, nombreFuncion }
 * @returns {Promise<boolean>} true si OK, false si falla
 */
const enviarMail = async ({ destino, asunto, texto, html, nombreFuncion }) => {
  try {
    await transporter.sendMail({
      from: `BarberManager <${GOOGLE_CALENDAR_EMAIL}>`,
      to: destino,
      subject: asunto,
      text: texto,
      html,
    });
    console.log(`[mailer] ${nombreFuncion} completado | destino:`, destino);
    return true;
  } catch (err) {
    console.error(`[mailer] Error en ${nombreFuncion}:`, err);
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
  if (debeSaltarseEnvio('enviarConfirmacion', cliente)) return false;

  const fechaTexto = formatearFecha(turno.inicio);
  const asunto = `Turno confirmado — ${fechaTexto}`;
  const texto = `Turno confirmado.\n\nServicio: ${servicio.nombre}\nBarbero: ${barbero.nombre}\nFecha: ${fechaTexto}\n\nGestionar: ${linkGestion}`;
  const html = construirHtml({
    eyebrow: 'Turno confirmado',
    eyebrowColor: paleta.success,
    titulo: 'Tu turno está confirmado',
    intro: `Hola ${cliente.nombre ?? ''}, te esperamos. Acá están los detalles de tu reserva.`,
    filas: [
      { label: 'Servicio', valor: servicio.nombre },
      { label: 'Barbero', valor: barbero.nombre },
      { label: 'Fecha', valor: fechaTexto },
    ],
    cta: { label: 'Gestionar turno', url: linkGestion },
  });

  return enviarMail({ destino: cliente.email, asunto, texto, html, nombreFuncion: 'enviarConfirmacion' });
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
  if (debeSaltarseEnvio('enviarCancelacion', cliente)) return false;

  const fechaTexto = formatearFecha(turno.inicio);
  const asunto = `Turno cancelado — ${fechaTexto}`;
  const texto = `Turno cancelado.\n\nServicio: ${servicio.nombre}\nBarbero: ${barbero.nombre}\nFecha: ${fechaTexto}\nCancelado por: ${canceladoPor}`;
  const html = construirHtml({
    eyebrow: 'Turno cancelado',
    eyebrowColor: paleta.danger,
    titulo: 'Tu turno fue cancelado',
    intro: `Hola ${cliente.nombre ?? ''}, te avisamos que este turno quedó cancelado.`,
    filas: [
      { label: 'Servicio', valor: servicio.nombre },
      { label: 'Barbero', valor: barbero.nombre },
      { label: 'Fecha', valor: fechaTexto },
      { label: 'Cancelado por', valor: canceladoPor.charAt(0).toUpperCase() + canceladoPor.slice(1) },
    ],
    cta: null,
  });

  return enviarMail({ destino: cliente.email, asunto, texto, html, nombreFuncion: 'enviarCancelacion' });
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
  if (debeSaltarseEnvio('enviarReprogramacion', cliente)) return false;

  const fechaTexto = formatearFecha(turno.inicio);
  const asunto = `Turno reprogramado — ${fechaTexto}`;
  const texto = `Turno reprogramado.\n\nServicio: ${servicio.nombre}\nBarbero: ${barbero.nombre}\nNueva fecha: ${fechaTexto}\n\nGestionar: ${linkGestion}`;
  const html = construirHtml({
    eyebrow: 'Turno reprogramado',
    eyebrowColor: paleta.accent,
    titulo: 'Tu turno cambió de fecha',
    intro: `Hola ${cliente.nombre ?? ''}, actualizamos tu turno a una nueva fecha.`,
    filas: [
      { label: 'Servicio', valor: servicio.nombre },
      { label: 'Barbero', valor: barbero.nombre },
      { label: 'Nueva fecha', valor: fechaTexto },
    ],
    cta: { label: 'Gestionar turno', url: linkGestion },
  });

  return enviarMail({ destino: cliente.email, asunto, texto, html, nombreFuncion: 'enviarReprogramacion' });
};

/**
 * Mail de cancelación automática de un turno (disparada por el sistema, no
 * por el cliente). Cubre tanto suspensiones de barbero como cambios del
 * horario de atención del local. El texto del cuerpo y la fila "Motivo" se
 * pasan por parámetro para que el cliente vea un mensaje acorde a la causa.
 *
 * @param {Object} turno - { inicio }
 * @param {Object} barbero - { nombre }
 * @param {Object} servicio - { nombre }
 * @param {Object} cliente - { nombre, email }
 * @param {Object} opciones - { intro: string, motivo: string }
 *   intro:  párrafo introductorio del mail (qué pasó, en tono al cliente).
 *   motivo: valor mostrado en la fila "Motivo" de la tabla.
 * @param {string} linkTurnero - URL para reservar de nuevo
 * @returns {Promise<boolean>}
 */
export const enviarCancelacionAutomatica = async (turno, barbero, servicio, cliente, opciones, linkTurnero) => {
  if (debeSaltarseEnvio('enviarCancelacionAutomatica', cliente)) return false;

  const fechaTexto = formatearFecha(turno.inicio);
  const motivo = opciones?.motivo ?? '(sin motivo)';
  const intro = opciones?.intro ?? `Hola ${cliente.nombre ?? ''}, tuvimos que cancelar este turno.`;
  const asunto = `Turno cancelado — ${fechaTexto}`;
  const texto = `${intro}\n\nServicio: ${servicio.nombre}\nBarbero: ${barbero.nombre}\nFecha: ${fechaTexto}\nMotivo: ${motivo}\n\nReservar de nuevo: ${linkTurnero}`;
  const html = construirHtml({
    eyebrow: 'Turno cancelado',
    eyebrowColor: paleta.danger,
    titulo: 'Tu turno fue cancelado',
    intro,
    filas: [
      { label: 'Servicio', valor: servicio.nombre },
      { label: 'Barbero', valor: barbero.nombre },
      { label: 'Fecha', valor: fechaTexto },
      { label: 'Motivo', valor: motivo },
    ],
    cta: { label: 'Reservar de nuevo', url: linkTurnero },
  });

  return enviarMail({ destino: cliente.email, asunto, texto, html, nombreFuncion: 'enviarCancelacionAutomatica' });
};
