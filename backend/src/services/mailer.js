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
 * Capitaliza la primera letra de un string. Función interna, no exportada.
 *
 * @param {string} texto
 * @returns {string} texto con la primera letra en mayúscula
 */
const capitalizar = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto);

/**
 * Formatea un timestamp como "Miércoles, 10 de junio" en TZ Argentina.
 * Función interna, no exportada.
 *
 * @param {string|Date} timestamp
 * @returns {string} fecha larga en español, con el día de semana capitalizado
 */
const formatearFechaLarga = (timestamp) => {
  const texto = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  }).format(new Date(timestamp));
  return capitalizar(texto);
};

/**
 * Formatea solo la hora de inicio como "11:30" en TZ Argentina.
 * Función interna, no exportada.
 *
 * @param {string|Date} timestamp
 * @returns {string} hora en formato HH:mm
 */
const formatearHora = (timestamp) => {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).format(new Date(timestamp));
};

/**
 * Formatea un timestamp compacto para el asunto: "Mié 10/06 · 11:30".
 * Función interna, no exportada.
 *
 * @param {string|Date} timestamp
 * @returns {string} día de semana abreviado + fecha + hora
 */
const formatearFechaAsunto = (timestamp) => {
  const fecha = new Date(timestamp);
  const dia = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: TZ })
    .format(fecha)
    .replace('.', '');
  // es-AR no rellena el mes con cero al combinar día y mes, así que extraigo
  // las partes y las relleno a mano para tener siempre dd/mm.
  const partes = {};
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'numeric', timeZone: TZ })
    .formatToParts(fecha)
    .forEach((p) => { partes[p.type] = p.value; });
  const diaMes = `${partes.day.padStart(2, '0')}/${partes.month.padStart(2, '0')}`;
  return `${capitalizar(dia)} ${diaMes} · ${formatearHora(fecha)}`;
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
 * @param {Array<{label: string, valor: string, href?: string}>} opciones.filas - detalle del turno (si una fila trae href, su valor se muestra como link)
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
    // Si la fila trae `href`, el valor se renderiza como link (acento indigo,
    // no botón, para respetar el acento único del sistema de diseño). El valor
    // y el href se escapan por separado.
    const valorHtml = fila.href
      ? `<a href="${escaparHtml(fila.href)}" style="color:${paleta.accent};text-decoration:none;">${escaparHtml(fila.valor)}</a>`
      : escaparHtml(fila.valor);
    return `
      <tr>
        <td style="padding:12px 0;${borde}font-size:14px;color:${paleta.muted};">${escaparHtml(fila.label)}</td>
        <td style="padding:12px 0;${borde}font-size:14px;color:${paleta.ink};font-weight:500;text-align:right;">${valorHtml}</td>
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
 * @param {Object} opciones - { destino, asunto, texto, html, nombreFuncion, remitente }
 *   remitente: nombre visible del "from" (default "BarberManager")
 * @returns {Promise<boolean>} true si OK, false si falla
 */
const enviarMail = async ({ destino, asunto, texto, html, nombreFuncion, remitente }) => {
  try {
    await transporter.sendMail({
      from: { name: remitente || 'BarberManager', address: GOOGLE_CALENDAR_EMAIL },
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
 * Mapea una fila enriquecida de turno (resultado de un SELECT con JOINs a
 * barbero, servicio y cliente que usa los alias estándar del proyecto:
 * inicio, fin, barbero_nombre, barbero_email, servicio_nombre, cliente_nombre,
 * cliente_email, cliente_telefono) a los objetos de dominio que consumen el
 * mailer y Google Calendar. Centraliza el desempaquetado que antes estaba
 * duplicado en cada caller. El bloque `tenant` queda con campos undefined si
 * la query no trae tenant_nombre / tenant_direccion (hoy solo lo consume el
 * mail de confirmación, que se alimenta de enriquecerTurno con el JOIN).
 *
 * @param {Object} fila - fila cruda de la query, con los alias estándar
 * @returns {{turno: {inicio, fin}, barbero: {nombre, email}, servicio: {nombre}, cliente: {nombre, email, telefono}, tenant: {nombre, direccion}}}
 */
export const construirContextoMail = (fila) => ({
  turno:    { inicio: fila.inicio, fin: fila.fin },
  barbero:  { nombre: fila.barbero_nombre, email: fila.barbero_email },
  servicio: { nombre: fila.servicio_nombre },
  cliente:  { nombre: fila.cliente_nombre, email: fila.cliente_email, telefono: fila.cliente_telefono },
  tenant:   { nombre: fila.tenant_nombre, direccion: fila.tenant_direccion },
});

/**
 * Mail de confirmación de turno reservado.
 *
 * @param {Object} turno - { inicio, fin }
 * @param {Object} barbero - { nombre }
 * @param {Object} servicio - { nombre }
 * @param {Object} cliente - { nombre, email }
 * @param {string} linkGestion - URL para cancelar/reprogramar
 * @param {Object} tenant - { nombre, direccion } datos del negocio: el nombre
 *   se usa como remitente y la dirección (puede venir vacía) arma la fila de
 *   ubicación con link a Google Maps
 * @returns {Promise<boolean>}
 */
export const enviarConfirmacion = async (turno, barbero, servicio, cliente, linkGestion, tenant) => {
  if (debeSaltarseEnvio('enviarConfirmacion', cliente)) return false;

  const fechaLarga = formatearFechaLarga(turno.inicio);
  const hora = formatearHora(turno.inicio);
  const asunto = `Turno confirmado — ${formatearFechaAsunto(turno.inicio)}`;

  // Filas de detalle. La dirección se agrega solo si el negocio la tiene
  // cargada; su href abre la búsqueda en Google Maps (en el celular, la app).
  const filas = [
    { label: 'Servicio', valor: servicio.nombre },
    { label: 'Barbero', valor: barbero.nombre },
    { label: 'Fecha', valor: fechaLarga },
    { label: 'Horario', valor: hora },
  ];
  const direccion = tenant?.direccion?.trim();
  if (direccion) {
    const urlMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
    filas.push({ label: 'Dirección', valor: direccion, href: urlMaps });
  }

  // Texto plano (fallback para clientes que no renderizan HTML).
  const lineaDireccion = direccion ? `\nDirección: ${direccion}` : '';
  const texto = `Turno confirmado.\n\nServicio: ${servicio.nombre}\nBarbero: ${barbero.nombre}\nFecha: ${fechaLarga}\nHorario: ${hora}${lineaDireccion}\n\nGestionar: ${linkGestion}`;

  const html = construirHtml({
    titulo: tenant.nombre,
    eyebrow: 'Turno confirmado',
    eyebrowColor: paleta.success,
    intro: `Hola ${cliente.nombre ?? ''}, te esperamos. Acá están los detalles de tu reserva.`,
    filas,
    cta: { label: 'Gestionar turno', url: linkGestion },
  });

  return enviarMail({ destino: cliente.email, asunto, texto, html, nombreFuncion: 'enviarConfirmacion', remitente: tenant?.nombre });
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
