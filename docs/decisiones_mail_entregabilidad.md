# Plan de entregabilidad de mail (SPF / DKIM / DMARC) — núcleo de decisiones

> ✅ **Migración completada y verificada en producción (2026-06-09); en `main`.**
> Documento **archivado**: se conserva solo el "por qué" de las decisiones. El estado
> vivo está en [`estado_actual.md`](estado_actual.md) (Deploy + Deudas). La
> implementación vive en `backend/src/services/mail/`.

## Por qué hubo que migrar (diagnóstico)

Dos problemas, en orden de gravedad:

1. **Railway (plan Hobby) bloquea el SMTP saliente** (puertos 25/465/587). Con el
   SMTP de Gmail, **en producción no salía ningún mail** (timeout ~2 min →
   `ETIMEDOUT`/`ENETUNREACH`); los transaccionales solo andaban en local. Dejó de ser
   un tema de spam: sin migrar, el mail no funcionaba en prod. **Implicancia de
   diseño:** la migración tiene que usar la **API HTTP del proveedor** (HTTPS/443), no
   su SMTP (Railway lo bloquea igual).
2. **Spam / autenticación.** El `From` era `BarberManager <turnos.barbermanager@gmail.com>`.
   SPF/DKIM/DMARC autentican el **dominio del `From`**, y `gmail.com` no lo controlamos
   → configurarlos en `barbermanager.app` no servía de nada. Outlook/Hotmail penalizan
   fuerte el mismatch nombre/dominio + el SMTP de Gmail de consumidor (sin reputación de
   envío). No se arregla sobre el dominio actual: hay que enviar desde dominio propio
   autenticado.

## Decisiones tomadas (el núcleo)

| # | Decisión | Por qué |
|---|---|---|
| 1 | Proveedor: **Resend** | API HTTP simple sobre AWS SES, tier gratis 3.000/mes (100/día), panel que entrega y verifica los DNS. Curva suave. |
| 2 | Dominio de envío: **subdominio dedicado `send.barbermanager.app`** | Aísla la reputación de envío del dominio raíz y de los subdominios de tenants. Práctica recomendada por Resend. |
| 3 | Zona DNS: **Vercel** (no Namecheap) | El dominio se compró en Namecheap pero los NS están delegados a Vercel (`vercel-dns.com`); los registros van en Vercel → Domains → DNS Records. |
| 4 | Transporte: **`fetch` nativo + API HTTP de Resend** (no SMTP, no SDK) | SMTP bloqueado por Railway (arriba). `fetch` y no el SDK: API simple, una dependencia menos, menos mantenimiento. |
| 5 | Plan B: **Postmark** | Gold standard para Outlook, pero arranca ~US$15/mes. Solo si Outlook sigue mandando a spam tras warmup. No adoptado. |

## Capa de abstracción del proveedor (por qué)

El resto de la app **no conoce Resend**. Queda detrás de un contrato chico
(`mail/mailProvider.js` → `send({ to, subject, html, from?, replyTo?, text? })`),
implementado por `mail/resendProvider.js` (`fetch` a `api.resend.com`, timeout 15 s con
`AbortController`, expone `estaConfigurado`). `mailer.js` arma el HTML y los 5 tipos de
mail y **delega** el envío; no toca endpoint ni API key. Objetivo: una futura migración
(Postmark, SES directo) es cambiar **un** archivo, no la lógica. El timeout evita que una
caída de Resend cuelgue procesos del backend (en especial el cron del recordatorio, que
procesa en serie). El envío loguea el `message_id` de Resend para trazabilidad.

## Gotchas que conviene recordar

- **Desacople de Google Calendar:** antes `GOOGLE_CALENDAR_EMAIL` servía para Calendar
  **y** remitente de mail. Ahora `GOOGLE_*` + `GMAIL_APP_PASSWORD` son **solo Calendar**;
  el mail usa `RESEND_API_KEY` + `MAIL_FROM`. No borrar las de Calendar.
- **Quirk del bounce subdomain de SES:** Resend muestra el Name del SPF/MX como
  `send.send` (no es typo): SES antepone `send.` al dominio de envío → FQDN
  `send.send.barbermanager.app`. Equivocar ese Name es el error más común al cargar DNS.
- **Rollback:** volver a Gmail SMTP **no es válido en prod** (Railway lo bloquea). El
  rollback real es a un estado previo de Resend; en última instancia el mailer es
  best-effort (si falla, se pierde el mail).

## DMARC — progresión (endurecer con cuidado)

Publicado en `_dmarc.barbermanager.app` arrancando en `p=none` (monitoreo, con `rua` a un
lector de reportes — se usó Postmark DMARC, gratis). **Solo subir de escalón cuando los
reportes muestran 100% del correo legítimo pasando SPF y/o DKIM alineado:**

- `p=none` → observa, no rechaza nada (estado inicial seguro).
- `p=quarantine` → lo no alineado va a spam (se puede rampar con `pct=`).
- `p=reject` → rechazo directo (máxima protección anti-spoofing).

Endurecer antes de tiempo manda correo legítimo a spam o lo pierde. El paso
`none→quarantine→reject` queda como pendiente time-gated en `estado_actual.md`.

## Mejoras futuras (no bloquean)

- **`Reply-To` por tenant:** hoy no hay; una respuesta del cliente va al no-reply.
  Convendría setearlo al mail real de la barbería (multi-tenant). Ligado al desacople del mailer.
- **Reintentos / cola:** el envío es best-effort; a más volumen, evaluar.
- **Límite del tier gratis** (3.000/mes, 100/día): con varios tenants puede quedar corto.

*— Fin del documento (archivado: núcleo de decisiones) —*
