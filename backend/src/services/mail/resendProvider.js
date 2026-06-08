// Implementación del contrato de mailProvider (ver mailProvider.js) contra la API
// HTTP de Resend (https://api.resend.com/emails), usando fetch nativo (sin SDK).
// Por qué HTTP y no SMTP: Railway plan Hobby bloquea el SMTP saliente (puertos
// 25/465/587), así que el envío sale por HTTPS/443. Acá vive TODO lo específico de
// Resend: endpoint, Authorization Bearer, mapeo replyTo→reply_to y parseo del
// message id. Las credenciales salen de env (RESEND_API_KEY, MAIL_FROM).

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
// 15 s: corta requests colgados para que una caída de Resend no bloquee al
// backend, en especial al cron de recordatorios (procesa los turnos en serie).
const TIMEOUT_MS = 15000;

const { RESEND_API_KEY, MAIL_FROM } = process.env;

// Flag que consulta el mailer para saltarse el envío con un warn limpio, en vez
// de lanzar un error por cada mail cuando el proceso no tiene credenciales.
export const estaConfigurado = Boolean(RESEND_API_KEY && MAIL_FROM);

/**
 * Envía un mail vía la API HTTP de Resend. Implementa el contrato de
 * mailProvider.send (ver mailProvider.js). La política best-effort (tragar el
 * error y devolver false) la decide el caller (mailer.js), no este provider: acá
 * se lanza ante cualquier fallo.
 *
 * @param {Object} opciones
 * @param {string} [opciones.from] - header From completo; si falta, usa MAIL_FROM
 * @param {string} opciones.to - destinatario
 * @param {string} opciones.subject - asunto
 * @param {string} opciones.html - cuerpo HTML
 * @param {string} [opciones.text] - cuerpo de texto plano (fallback multipart)
 * @param {string} [opciones.replyTo] - dirección de respuesta (opcional)
 * @returns {Promise<{id: string}>} message id de Resend
 * @throws {Error} si Resend responde con status !ok o si se aborta por timeout
 */
export const send = async ({ from, to, subject, html, text, replyTo }) => {
  // Timeout explícito con AbortController: si Resend no responde en 15 s, se
  // aborta el request (fetch rechaza con AbortError) y el finally limpia el timer.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      // reply_to: la API de Resend usa snake_case; el contrato es camelCase.
      // Los campos undefined (from si no se pasó, text, reply_to) los omite
      // JSON.stringify, así que no se mandan vacíos.
      body: JSON.stringify({ from: from ?? MAIL_FROM, to, subject, html, text, reply_to: replyTo }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { id: data.id };
  } finally {
    clearTimeout(t);
  }
};
