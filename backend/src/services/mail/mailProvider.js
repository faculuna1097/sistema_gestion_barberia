// Contrato del proveedor de mail (agnóstico del proveedor concreto). Es el ÚNICO
// punto que mailer.js importa para enviar: para migrar de proveedor (Postmark,
// SES directo, otro) se reapunta el re-export de abajo y NO se toca la lógica de
// los mails. Acá no hay nada específico de Resend.
//
// Contrato que todo proveedor debe cumplir:
//   async send({ from, to, subject, html, text, replyTo }) → { id }
//     - from:    header From completo (opcional; el provider cae a su default)
//     - to:      destinatario
//     - subject: asunto
//     - html:    cuerpo HTML
//     - text:    cuerpo de texto plano (opcional; fallback multipart)
//     - replyTo: dirección de respuesta (opcional)
//     → devuelve { id } con el message id del proveedor (para trazabilidad)
//   estaConfigurado: boolean — si el proceso tiene credenciales para enviar
//     (lo consulta el mailer para saltarse el envío con un warn limpio).

export { send, estaConfigurado } from './resendProvider.js';
