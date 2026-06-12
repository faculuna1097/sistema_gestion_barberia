# Plan de entregabilidad de mail (SPF / DKIM / DMARC)

Documento de plan. ✅ **MIGRACIÓN COMPLETADA Y VERIFICADA EN PROD / ARCHIVADO (2026-06-09).**
Describe cómo se migró el envío de mails transaccionales del turnero desde el SMTP de Gmail
hacia un dominio propio autenticado vía **Resend**, para (1) que los mails **salgan** desde
producción y (2) que lleguen a bandeja de entrada y no a spam (sobre todo en Outlook/Hotmail).

> **Estado del cierre:** el objetivo central está logrado y probado en prod — el mail
> **sale desde Railway** por HTTP (Tramo 2, 2026-06-09) y el dominio está autenticado
> (SPF/DKIM/MX/DMARC). Quedan dos residuales que **no bloquean** y que se trackean en el
> **Checklist del merge** de [`estado_actual.md`](estado_actual.md): **(a)** el **merge
> `feature/turnero → main`**, que activa el mailer en el web service de la barbería real;
> **(b)** seguimiento de entregabilidad time-gated — **Fase 6** (endurecer DMARC
> `none→quarantine→reject` tras 1–2 semanas de reportes limpios), re-test de Outlook tras
> warmup, MXToolbox/Postmaster. Este documento queda como **referencia histórica**; el
> estado vigente vive en `estado_actual.md`.

> **Progreso (2026-06-09):** Fases 1, 2, 4 (código + env vars en el cron) y 3 (DMARC
> `p=none`) ✅; Fase 5 validada en local. Dominio `send.barbermanager.app` verificado;
> código migrado a la API HTTP de Resend (commit `ecc5484`); env vars `RESEND_API_KEY` +
> `MAIL_FROM` cargadas en Railway como **shared variables** referenciadas en **los dos**
> servicios (web y cron) — pero **solo el cron corre el código nuevo** (deploya de
> `feature/turnero`); el **web service deploya de `main`**, que todavía no tiene el
> mailer, así que el mail para la **barbería real queda atado al merge
> `feature/turnero → main`** (ver §13). Verificación local con `probarMailer.js`:
> **mail-tester 9.5/10** (SPF+DKIM en verde; el -0.5 es el link demo que no resuelve),
> **Gmail → bandeja de entrada** ✅, **Outlook/Microsoft → la mayoría a Junk** (reputación
> de dominio nuevo, no es bug de código; ver §5 Fase 5). DMARC `p=none` publicado en
> Vercel (`_dmarc`) con `rua` a **Postmark DMARC**, propagado y resolviendo.
> **Tramo 2 ✅ (2026-06-09):** el servicio cron en Railway envió un recordatorio real por
> HTTP (`message_id` de Resend, **Delivered**) → **el mail sale de verdad desde
> producción** (egress HTTPS confirmado; el bloqueo de SMTP quedó atrás), y llegó a la
> **bandeja de entrada de Gmail**. Único escollo, ya resuelto: el `MAIL_FROM` del cron
> tenía el valor viejo de sandbox (`onboarding@resend.dev`) que nunca se actualizó → Resend
> devolvía 403 (con el remitente sandbox solo deja enviar a la cuenta dueña); corregido a
> `turnos@send.barbermanager.app`. Al ser **shared variable**, el valor corregido ya vale
> para **ambos** servicios. Con esto se **verifica la Etapa 3** del recordatorio.
> **Pendiente:** dejar correr los reportes DMARC 1–2 semanas, re-test de Outlook tras
> warmup, y el merge a `main` (§13). **Corrección previa:** la zona DNS está en **Vercel**
> (NS `vercel-dns.com`), no en Namecheap. Ver §3, §6, §12 y §13.

> **Actualización 2026-06-08 — dos cambios de contexto que mandan sobre el resto del doc:**
> 1. **Driver primario nuevo:** el backend corre en **Railway plan Hobby**, que
>    **bloquea el SMTP saliente** (puertos 25/465/587, anti-spam de la plataforma).
>    Hoy *ningún* mail sale desde producción — los transaccionales se probaron sólo
>    en local. Dejó de ser sólo un tema de spam: sin esta migración el mail **no
>    funciona en prod**. Detalle en §2.1.
> 2. **Corrección de transporte:** por (1), la migración usa la **API HTTP de
>    Resend** (`api.resend.com`, HTTPS/443), **no su SMTP** (`smtp.resend.com:465`,
>    que Railway bloquea igual que a Gmail). Ver §3 (decisión 5), §4 y §7.
>
> **Este plan es ahora prerrequisito de la Etapa 3 de
> [`plan_recordatorio_turnos.md`](plan_recordatorio_turnos.md):** el cron de
> recordatorios no puede enviar hasta que el mail salga por HTTP, así que ese plan
> quedó pausado en su puerta de verificación hasta cerrar al menos las Fases 1, 2 y 4
> de acá.
>
> Estado previo (2026-06-05): el envío salía desde `turnos.barbermanager@gmail.com`
> vía SMTP de Gmail; la única mitigación era el **aviso de "revisar spam"** en la
> confirmación del turnero (commit `e9a3a57`).

---

## 1. Objetivo

Que los mails de confirmación, cancelación y reprogramación lleguen a la bandeja
de entrada y no a spam, configurando autenticación de dominio real:

- **SPF**: registro DNS que declara qué servidores pueden enviar en nombre del dominio.
- **DKIM**: firma criptográfica en cada mail que prueba que salió del dominio y no fue alterado.
- **DMARC**: política que le dice al receptor qué hacer cuando SPF/DKIM no "alinean" con el dominio del `From`, y a dónde mandar reportes.

---

## 2. Diagnóstico (por qué hoy cae en spam)

El `From` actual es `BarberManager <turnos.barbermanager@gmail.com>`
(ver [`backend/src/services/mail/mailer.js`](../backend/src/services/mail/mailer.js); estado previo a la migración).

El problema de raíz: **el dominio del `From` es `gmail.com`, que no controlamos.**
SPF/DKIM/DMARC autentican el dominio del `From`, así que configurarlos en
`barbermanager.app` no haría nada por estos mails (ningún filtro mira a
`barbermanager.app`; miran a `gmail.com`).

Además, Outlook/Hotmail penalizan fuerte:
1. **Mismatch nombre/dominio**: nombre "BarberManager" + dirección `@gmail.com` se lee como patrón de spoofing.
2. **SMTP de Gmail de consumidor** no está pensado para envío transaccional/automático y no tiene reputación de envío.
3. **No hay reputación de dominio propio** que construir — `gmail.com` se comparte con millones de cuentas.

**Conclusión**: no se puede arreglar sobre el dominio actual. Hay que enviar
desde dominio propio vía proveedor transaccional, y ahí sí configurar SPF/DKIM/DMARC.

### 2.1 Segundo driver (descubierto 2026-06-08): Railway bloquea el SMTP

Antes que el spam, hay un bloqueo más básico: **Railway (plan Hobby) bloquea el
tráfico SMTP saliente** (puertos 25/465/587; sólo Pro/Enterprise lo habilitan). El
síntoma es una conexión a `:465` que se cuelga ~2 min y expira (`ETIMEDOUT`), o
`ENETUNREACH`. Consecuencia: **hoy no sale ningún mail desde producción** — los
transaccionales se probaron sólo en local. Se detectó al correr el cron de
recordatorios contra Railway (ver [`plan_recordatorio_turnos.md`](plan_recordatorio_turnos.md),
Etapa 3).

**Implicancia de diseño:** la migración a Resend tiene que usar su **API HTTP** (sale
por HTTPS/443), no su interfaz SMTP (`smtp.resend.com:465`), que Railway bloquearía
igual. Es además lo que Railway recomienda para planes sin SMTP. Esto reemplaza la
idea original de "mantener nodemailer con SMTP de Resend" (ver §4 y §7 corregidos).

---

## 3. Decisiones tomadas

| # | Decisión | Valor | Por qué |
|---|---|---|---|
| 1 | Proveedor | **Resend** | Mejor equilibrio para nuestro caso: built sobre AWS SES, API HTTP simple, **tier gratis 3.000 mails/mes (100/día)**, panel que entrega los DNS listos para copiar y los verifica. Curva suave para quien recién entra a infra de mail. |
| 2 | Dominio de envío | **Subdominio dedicado** `send.barbermanager.app` | Aísla la reputación de envío del dominio raíz y de los subdominios de tenants (`kingsai.barbermanager.app`, etc.). Si un mail problemático afecta reputación, no contamina el dominio principal. Es la práctica recomendada por Resend. |
| 3 | Registrador / zona DNS | Dominio en **Namecheap**, zona DNS en **Vercel** | `barbermanager.app` se compró en Namecheap, pero los nameservers están delegados a Vercel (`ns1/ns2.vercel-dns.com`), donde vive el frontend. **Los registros DNS se cargan en Vercel → Domains → barbermanager.app → DNS Records**, no en Namecheap (su Advanced DNS está inactivo). Confirmado con `nslookup -type=ns` y ya registrado en `estado_actual.md`. Ver §6. |
| 4 | Plan B de entregabilidad | **Postmark** | Solo si tras migrar a Resend Outlook sigue mandando a spam. Es el gold standard transaccional para Outlook, pero el tier gratis es de prueba (~100/mes) y arranca en ~US$15/mes. No se adopta ahora. |
| 5 | Transporte | **`fetch` nativo + API HTTP de Resend** | Railway Hobby bloquea el SMTP saliente (§2.1), así que `smtp.resend.com:465` fallaría igual que Gmail; la API HTTP sale por HTTPS/443. Se usa `fetch` nativo, **no el SDK**: la API es muy simple, evita una dependencia, menos superficie de mantenimiento y menos riesgo de incompatibilidades futuras; el proyecto no usa features avanzadas que justifiquen el SDK. |

---

## 4. Arquitectura objetivo

```
Backend (Railway, Hobby)
  └─ fetch nativo  ──HTTPS:443──>  Resend API (api.resend.com)  ──>  AWS SES  ──>  destinatario
                                         │
        From: BarberManager <turnos@send.barbermanager.app>
        Reply-To: <mail real de la barbería>   (mejora futura, ver §11)

DNS de barbermanager.app (zona en Vercel — DNS Records)
  ├─ send.send.barbermanager.app             TXT  SPF      (autoriza a SES; subdominio de bounce)
  ├─ resend._domainkey.send.barbermanager.app TXT DKIM     (clave pública, la genera Resend)
  ├─ send.send.barbermanager.app             MX   feedback (bounces/quejas de SES)
  └─ _dmarc.barbermanager.app                TXT  DMARC    (política + reportes)
```

Se mantiene **todo el HTML** de los mails (`construirHtml` y los 5 tipos). Cambia el
**transporte**: en vez de `nodemailer` con `service:'gmail'` (SMTP, bloqueado en
Railway Hobby, §2.1), el envío pasa a la **API HTTP de Resend** vía **`fetch` nativo**
(decisión 5, §3), detrás de una capa de proveedor (§7.1) y con el `From` en el dominio
propio. nodemailer y el SDK de Resend no se usan.

---

## 5. Plan por fases

### Fase 0 — Pre-requisitos
- [x] Acceso al panel de DNS — **Vercel** (la zona de `barbermanager.app` está delegada ahí, no a Namecheap).
- [x] Mail de origen: `turnos@send.barbermanager.app` (el display name es el nombre del negocio por tenant; el default es `MAIL_FROM`).
- [x] Decidir a dónde van los reportes DMARC. **Resuelto:** lector gratuito **Postmark DMARC**; `rua=mailto:re+ek7hqwournl@dmarc.postmarkapp.com` (ver Fase 3).

### Fase 1 — Crear cuenta y dominio en Resend ✅
- [x] Crear cuenta en Resend.
- [x] **Add Domain** → `send.barbermanager.app` (el subdominio, no el dominio raíz).
- [x] Elegir **región** (afecta el host del MX de feedback y la latencia).
- [x] Resend muestra los registros DNS a cargar (SPF + DKIM + MX). El DKIM es único por dominio y lo genera Resend — no se inventa. Esos valores se cargan en **Vercel** (Fase 2).

### Fase 2 — Cargar DNS en Vercel ✅
Ver §6 para el detalle exacto de cada registro y el mapeo de "Name". En resumen:
- [x] Vercel → **Domains** → `barbermanager.app` → **DNS Records**.
- [x] Agregar el **TXT de DKIM** (Name `resend._domainkey.send`).
- [x] Agregar el **TXT de SPF** (Name `send.send`).
- [x] Agregar el **MX de feedback** (Name `send.send`, priority 10).
- [x] Volver a Resend y tocar **Verify** → **en verde** (DKIM, SPF y MX).

### Fase 3 — DMARC en política suave (monitoreo) ✅ (publicado; reportes en curso)
- [x] Agregar el TXT de DMARC en `_dmarc.barbermanager.app` con `p=none` (ver §6.4).
      **Publicado en Vercel (2026-06-09)**, valor exacto:
      `v=DMARC1; p=none; pct=100; rua=mailto:re+ek7hqwournl@dmarc.postmarkapp.com; sp=none; aspf=r;`
      Propagado y resolviendo (verificado contra `8.8.8.8` y `1.1.1.1`).
- [x] Conectar un lector de reportes DMARC. **Elegido: Postmark DMARC** (dmarc.postmarkapp.com) — gratis, resumen semanal por mail. (Alternativas evaluadas: dmarcian, URIports, Cloudflare DMARC — esta última descartada porque la zona DNS está en Vercel, no en Cloudflare.)
- [ ] Dejar correr **1–2 semanas** y mirar que el 100% del tráfico legítimo venga de Resend/SES y esté alineado (SPF y DKIM en verde para nuestro dominio). **En curso** (los reportes agregados llegan en lotes diarios; el panel de Postmark empieza a poblarse en ~24–72 h).

### Fase 4 — Cambio de código + variables de entorno
- [ ] Crear la capa de mail `src/services/mail/` (§7.1): `mailProvider.js` (contrato),
      `resendProvider.js` (`fetch` + timeout + logging) y mover `mailer.js` ahí,
      actualizando los imports que lo referencian (turnosService, recordatoriosService,
      scripts, jobs).
- [ ] Implementar el envío con **`fetch` nativo** a `api.resend.com` (§7.2): reemplaza el
      transporter `service:'gmail'`. Incluye timeout de 15 s con `AbortController` y
      logging de tipo/destinatario/tenant/`message_id` (§7.3). **Quitar el
      `dns.setDefaultResultOrder('ipv4first')`** (código muerto, §7).
- [x] Cargar las variables nuevas en Railway (ver §8). Cargadas como **shared variables**
      referenciadas en **los dos** servicios (web y cron). **Ojo (ver §13):** el web
      service deploya de `main` (sin el mailer todavía) y el cron de `feature/turnero`
      (con el mailer). O sea, hoy las env vars solo se *usan* en el cron; en el web
      quedan inertes hasta el merge a `main`.
- [x] Deploy. El push de `ecc5484` a `origin/feature/turnero` redeployó el **cron** con
      el código de Resend. Esto **desbloquea la verificación de la Etapa 3** de
      [`plan_recordatorio_turnos.md`](plan_recordatorio_turnos.md) (= Tramo 2, pendiente).

### Fase 5 — Pruebas y verificación (local ✅ · Outlook y prod pendientes)
- [x] Correr [`backend/src/scripts/probarMailer.js`](../backend/src/scripts/probarMailer.js) (manda los 4 tipos de mail). Ahora toma el **destino por argumento de CLI** (`node src/scripts/probarMailer.js destino@x.com`; default `faculunacarp@gmail.com`).
- [x] **mail-tester.com: 9.5/10** — SPF ✅ y DKIM ✅ verdes y alineados. El -0.5 es el link de gestión demo (`…/TOKEN-DEMO`) que no resuelve: **artefacto del test** (en prod el link es real con token válido). El test inicial salió con `onboarding@resend.dev` (sandbox) por un `.env` no guardado → 403; corregido a `turnos@send.barbermanager.app` y re-corrido OK.
- [x] **Gmail → bandeja de entrada** los 4 mails ✅.
- [ ] **Outlook/Microsoft → PENDIENTE (reputación de dominio nuevo, NO es bug de código).** Probado con `…@alumnos.frgp.utn.edu.ar` (backend Exchange Online): entró solo el mail **sin links** (cancelación); los 3 con botón + link a Maps cayeron a **Junk**. Microsoft manda a Junk dominios sin historial aunque SPF/DKIM pasen. Mitigación: DMARC ya publicado (ayuda en Microsoft) + **warmup** (días/semanas de envío) + en prod los links resuelven. **Re-testear en unos días.**
- [ ] MXToolbox y (a los días) Google Postmaster (ver §9). Pendiente.
- [x] **Tramo 2 (2026-06-09):** salida real desde el **cron en Railway** confirmada — recordatorio enviado por HTTP, `message_id` de Resend, **Delivered**, Gmail inbox. Egress HTTPS OK; cerró la verificación de la Etapa 3 del recordatorio. (Incidente `MAIL_FROM` sandbox → 403, ya resuelto: ver bloque de progreso.)
- [ ] Reserva real desde el **web service de prod** → bandeja en Gmail **y** Outlook: **bloqueado hasta el merge a `main`** (el web service no tiene el mailer todavía; ver §13).

### Fase 6 — Endurecer DMARC
- [ ] Con reportes limpios: subir a `p=quarantine` (opcionalmente con `pct=` para rampar).
- [ ] Tras otra ventana limpia: subir a `p=reject`.
- [ ] Ver §6.4 para los valores exactos de cada escalón.

---

## 6. Registros DNS — detalle

> **Importante**: los valores de SPF/DKIM/MX **los da Resend** en la pantalla de
> verificación del dominio. Acá se muestra la *forma* esperada para que sepas qué
> estás cargando; **el valor real (sobre todo la clave DKIM) se copia del panel**.

### Regla de traducción "Name" (Resend) → "Name" (Vercel)
**La zona está en Vercel**, no en Namecheap. Resend muestra los `Name` **relativos a
la raíz `barbermanager.app`**, y el campo `Name` de Vercel también es relativo a la
raíz → **el Name de Vercel es idéntico al que muestra Resend, tal cual** (no hay que
transformar nada).

Dato clave: para el SPF y el MX, Resend muestra `send.send`. **No es un typo**: SES
usa un subdominio de bounce (`send.`) **adelante** del dominio de envío
(`send.barbermanager.app`), así que el FQDN real es `send.send.barbermanager.app`.

| Lo que muestra Resend (Name) | Name a escribir en Vercel | Tipo |
|---|---|---|
| `resend._domainkey.send` | `resend._domainkey.send` | TXT (DKIM) |
| `send.send` | `send.send` | TXT (SPF) y MX |
| `_dmarc` | `_dmarc` | TXT (DMARC) |

### 6.1 SPF (TXT)
- **Type**: TXT
- **Name** (Vercel): `send.send`  → FQDN `send.send.barbermanager.app`
- **Value** (forma típica de Resend/SES): `v=spf1 include:amazonses.com ~all`
- **Por qué**: autoriza a los servidores de Amazon SES (que usa Resend) a enviar desde el subdominio de bounce. El `~all` (softfail) marca como sospechoso lo no autorizado sin rechazarlo de una.

### 6.2 DKIM (TXT)
- **Type**: TXT
- **Name** (Vercel): `resend._domainkey.send` (selector `resend`)
- **Value**: `p=MIGfMA0GCSqGSIb3DQ...` (clave pública larga, **copiar exacta del panel de Resend**)
- **Por qué**: Resend firma cada mail con la clave privada; el receptor valida con esta clave pública publicada en DNS. Es lo que prueba que el mail es auténtico y no fue alterado.
- **Nota Vercel**: pegar el value tal cual, sin comillas extra ni saltos de línea. Vercel parte solo los valores largos (>255 chars) en chunks; no hay que hacer nada.

### 6.3 MX de feedback (MX)
- **Type**: MX
- **Name** (Vercel): `send.send`  → FQDN `send.send.barbermanager.app`
- **Value**: `feedback-smtp.<región>.amazonses.com` (el host depende de la región elegida en Fase 1 — **copiar del panel**)
- **Priority**: `10`
- **Por qué**: SES usa este MX para manejar rebotes y quejas en el subdominio de bounce. No afecta la recepción de mails del dominio raíz (es un MX de `send.send`, independiente).

### 6.4 DMARC (TXT) — progresión
- **Type**: TXT
- **Name** (Vercel): `_dmarc`

**Escalón 1 — monitoreo (arrancar acá):**
```
v=DMARC1; p=none; rua=mailto:dmarc@barbermanager.app; fo=1; adkim=r; aspf=r
```
- `p=none`: no rechaza nada, solo observa. No puede romper entregas.
- `rua=`: a dónde mandar los reportes agregados (apuntar al buzón/lector elegido).
- `fo=1`: pedir reporte forense ante cualquier fallo de alineación.
- `adkim=r` / `aspf=r`: alineación **relajada** (default), tolera subdominios.

**Escalón 2 — cuarentena (tras 1–2 semanas limpias):**
```
v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@barbermanager.app; sp=quarantine; adkim=r; aspf=r
```
- `p=quarantine`: lo no alineado va a spam en vez de rechazarse.
- `sp=quarantine`: política para subdominios.
- `pct=`: se puede empezar en `pct=25` o `50` para rampar gradualmente antes de `100`.

**Escalón 3 — rechazo (tras otra ventana limpia):**
```
v=DMARC1; p=reject; rua=mailto:dmarc@barbermanager.app; sp=reject; adkim=r; aspf=r
```
- `p=reject`: el receptor rechaza directamente lo que no pasa DMARC. Máxima protección anti-spoofing del dominio.

> **Cuándo endurecer**: solo subir de escalón cuando los reportes muestran que
> el 100% del correo legítimo pasa SPF **y/o** DKIM alineado. Si endurecés con
> algo legítimo todavía fallando, ese correo se va a spam (quarantine) o se
> pierde (reject).

### 6.5 Posibles conflictos en Vercel
- El proyecto de gestión tiene un **wildcard** `*.barbermanager.app` para los subdominios de tenants. No choca con `send.send` ni con el DKIM: un registro explícito gana sobre el wildcard. Igual, revisar que no haya un `send.send` previo.
- **No tocar** los registros que Vercel auto-gestiona para el frontend (el A de la raíz, los de cada proyecto). Estos 3 (DKIM/SPF/MX) son aditivos.
- **TTL**: dejar el default de Vercel (60 s).

---

## 7. Cambio de código

Archivos: [`backend/src/services/mail/mailer.js`](../backend/src/services/mail/mailer.js) más los
módulos nuevos de la capa de mail (§7.1). La idea es **mínima invasión funcional**:
mantener todo el HTML (`construirHtml`) y la forma de las funciones de envío; cambiar
sólo **cómo se manda** (el transporte) y el `From`. Como Railway Hobby bloquea SMTP
(§2.1), el envío usa la **API HTTP de Resend** con **`fetch` nativo** (decisión 5, §3),
sin SDK ni nodemailer. También se quita el `dns.setDefaultResultOrder('ipv4first')` que
se había agregado (código muerto: el problema era el puerto SMTP, no el DNS).

### 7.1 Capa de abstracción del proveedor

El resto de la app **no debe conocer Resend**. El proveedor queda detrás de un contrato
chico, de modo que una futura migración (Postmark, SES directo, otro) sea cambiar **un**
archivo y no tocar la lógica de mails. Estructura:

```txt
src/services/mail/
├── mailProvider.js     # contrato del proveedor (agnóstico)
├── resendProvider.js   # implementación con fetch contra la API de Resend
└── mailer.js           # lógica de mails (construirHtml + los 5 tipos); delega el envío
```

Responsabilidades:

- **`mailProvider.js`** — define el contrato que cualquier proveedor debe cumplir:
  ```js
  async send({ to, subject, html, replyTo }) // → { id }  (message id del proveedor)
  ```
  Es el único punto que `mailer.js` importa para enviar. El contrato es agnóstico
  (camelCase `replyTo`); cada provider traduce a su propia API. **Implementación final
  (commit `ecc5484`):** el contrato sumó `from` opcional (display name por-tenant; si
  falta, el provider usa `MAIL_FROM`) y `text` (fallback de texto plano → multipart,
  mejor score de entregabilidad), y el provider expone `estaConfigurado` (booleano)
  para que el mailer saltee el envío con un warn limpio cuando faltan credenciales.
- **`resendProvider.js`** — implementa `send(...)` con `fetch` hacia
  `https://api.resend.com/emails` (§7.2). Acá vive **todo** lo específico de Resend
  (endpoint, `Authorization: Bearer`, mapeo `replyTo` → `reply_to`, parseo del `id`).
- **`mailer.js`** — mantiene **toda** la lógica existente (`construirHtml` y los mails de
  confirmación, cancelación, reprogramación, cancelación automática y recordatorio) y
  **delega el envío** en `mailProvider.send()` (§7.3). No conoce el endpoint ni la API
  key de Resend.

> Este cambio **no modifica comportamiento funcional**: los mismos mails, el mismo HTML,
> el mismo best-effort. Sólo **reduce el acoplamiento tecnológico** — la app deja de
> depender directamente de un proveedor de envío.
>
> **Nota de implementación (Fase 4):** mover `mailer.js` a `src/services/mail/` cambia su
> ruta, así que hay que actualizar los imports que lo referencian (turnosService,
> recordatoriosService, scripts, jobs). Es mecánico, pero va en el mismo paso.

### 7.2 `resendProvider.js` — envío con `fetch`, timeout y parseo del id

Transporte elegido (decisión 5, §3): **`fetch` nativo + API HTTP de Resend**, sin SDK.
Toda la API key y el `From` salen de env vars (§8).

```js
// resendProvider.js — implementa el contrato de mailProvider.send()
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 15000; // 15 s: corta requests colgados; una caída de Resend no bloquea el backend

export const send = async ({ to, subject, html, replyTo }) => {
  const { RESEND_API_KEY, MAIL_FROM } = process.env;

  // Timeout explícito con AbortController: si Resend no responde en 15 s, se aborta.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to, subject, html, reply_to: replyTo }), // mapea replyTo → reply_to
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { id: data.id }; // message id de Resend, para trazabilidad (§7.3)
  } finally {
    clearTimeout(t);
  }
};
```

- **Timeout:** `AbortController` a **15 s**. Objetivo: evitar requests colgados y que una
  caída de Resend bloquee procesos del backend — en especial el cron del recordatorio,
  que procesa turnos en serie.
- **Errores:** ante `!res.ok` o abort, **lanza**; la política best-effort la decide
  `mailer.js` (§7.3), no el provider.

### 7.3 `mailer.js` — delega, arma el `From` y loguea el envío

`mailer.js` deja de tocar el transporte: arma el HTML como hoy y llama a
`mailProvider.send({ to, subject, html, replyTo })` dentro del try/catch best-effort. El
`From` ya no es `GOOGLE_CALENDAR_EMAIL` sino `MAIL_FROM`
(ej. `BarberManager <turnos@send.barbermanager.app>`), y lo aplica el provider.

**Logging mínimo recomendado** (donde se conocen el tipo de mail y el tenant): por cada
envío, registrar **tipo de mail**, **destinatario**, **tenant** y el **`message_id`** que
devuelve `send()`. Objetivo: soporte y trazabilidad — cuando un cliente diga "no me
llegó", se correlaciona el evento con el panel de Resend por el `message_id`.

```js
// dentro del envío, tras delegar en mailProvider.send():
const { id } = await mailProvider.send({ to, subject, html, replyTo });
console.log(`[mailer] enviarMail — enviado | tipo: ${tipo} | to: ${to} | tenant: ${tenantSubdominio} | message_id: ${id}`);
// en el catch (best-effort): console.error('[mailer] enviarMail — fallo | tipo/to/tenant ...', err); return false;
```

### 7.4 Detalle importante: desacople de Google Calendar
Hoy `GOOGLE_CALENDAR_EMAIL` se usa para **dos** cosas: organizador de Calendar y
remitente de mail. Este cambio **lo desacopla**: `GOOGLE_CALENDAR_EMAIL` y
`GMAIL_APP_PASSWORD` quedan **solo para Google Calendar**; el mail pasa a usar
`RESEND_API_KEY` + `MAIL_FROM`. No borrar las variables de Calendar.

---

## 8. Variables de entorno

Agregar en **Railway** (y en `backend/.env.example` para documentar):
```
RESEND_API_KEY=re_...            # API key generada en el panel de Resend
MAIL_FROM=BarberManager <turnos@send.barbermanager.app>
```
Las de Calendar (`GOOGLE_CALENDAR_EMAIL`, `GMAIL_APP_PASSWORD`) **quedan**, ya no
las usa el mailer pero sí Calendar. `GMAIL_APP_PASSWORD` puede borrarse solo
cuando se confirme que nada más la usa.

---

## 9. Verificación

> **Conceptos en dos líneas**: estas herramientas reciben un mail tuyo (o leen tu
> DNS) y te dicen si SPF, DKIM y DMARC pasan y alinean. "Alinear" = el dominio
> que firma/autoriza coincide con el dominio del `From`.

1. **mail-tester.com** — da una dirección temporal; le mandás un mail desde el sistema y te puntúa /10. Buscar: SPF ✅, DKIM ✅, DMARC ✅ y que no haya "your message is not signed" ni blacklists. Apuntar a 9–10/10.
2. **MXToolbox SuperTool** (mxtoolbox.com/SuperTool.aspx):
   - `spf:send.barbermanager.app` → debe encontrar el TXT y validarlo.
   - `dkim:send.barbermanager.app:resend` → valida el selector `resend`.
   - `dmarc:barbermanager.app` → muestra la política publicada.
3. **Google Postmaster Tools** (postmaster.google.com) — agregar el dominio; a los días muestra reputación de dominio/IP y % de autenticación hacia Gmail. Útil para tendencia, no inmediato.
4. **Prueba real**: reservar un turno y confirmar que llega a **bandeja de entrada** en una cuenta Gmail y una Outlook/Hotmail (el dolor original).

### Criterios de aceptación
- mail-tester ≥ 9/10 con SPF/DKIM/DMARC en verde.
- Mail de prueba en bandeja de entrada en Gmail **y** Outlook/Hotmail.
- Reportes DMARC mostrando 100% del tráfico legítimo alineado antes de endurecer.

---

## 10. Tiempos de propagación DNS

- **TTL** en Vercel: default 60 s.
- Propagación típica: **minutos a pocas horas**; el máximo formal es **24–48 h**.
- Resend reintenta la verificación solo; si a las pocas horas no pasó a verde, revisar Name/valor en Vercel (el error más común es equivocarse en el Name — recordar que SPF y MX van en `send.send`, no `send`, ver §6).

---

## 11. Riesgos, rollback y futuro

**Rollback**: el cambio de código es reversible, pero **ojo**: volver a Gmail SMTP
(`service:'gmail'`) **no es un rollback válido en producción** — Railway Hobby bloquea
ese SMTP (§2.1), así que por ahí no sale mail en prod. El rollback real es a un estado
previo de Resend (o, en última instancia, quedarse sin envío: el mailer es
best-effort). Los registros DNS son aditivos (no rompen nada existente del dominio).

**Riesgo principal**: endurecer DMARC antes de tiempo → correo legítimo a spam o
perdido. Mitigación: respetar la progresión `none → quarantine → reject` con
reportes limpios entre escalones.

**Mejoras futuras relacionadas** (no bloquean este plan):
- **`Reply-To` por tenant**: hoy no hay `Reply-To`; si un cliente responde, va al
  no-reply. Convendría setear `Reply-To` al mail real de la barbería (multi-tenant:
  saldría de los datos del tenant). Ligado a la deuda de acoplamiento del mailer.
- **Reintentos / cola**: el envío es best-effort y si SMTP falla se pierde el mail
  ([`mailer.js`](../backend/src/services/mail/mailer.js), bloque `catch` de `enviarMail`).
  A más volumen, evaluar reintento o cola.
- **Límite del tier gratis de Resend**: 3.000/mes y 100/día. Con varios tenants
  activos puede quedar corto; monitorear y subir de plan o evaluar Postmark.

---

## 12. Checklist resumido (para el día que se ejecute)

```
[x] F1  Crear cuenta Resend + Add Domain send.barbermanager.app
[x] F2  Vercel → DNS Records: DKIM (TXT), SPF (TXT en send.send), MX feedback (send.send)
[x] F2  Resend → Verify (en verde)
[x] F3  Vercel: TXT _dmarc con p=none + lector de reportes (Postmark DMARC) — publicado y propagado
[ ] F3  Esperar 1–2 semanas, reportes 100% alineados (en curso)
[x] F4  Código: capa mail/ (mailProvider + resendProvider) + From por-tenant en mailer.js + .env.example (commit ecc5484)
[x] F4  Railway: RESEND_API_KEY + MAIL_FROM como shared vars en web Y cron — PERO solo el cron corre el código (web=main, ver §13)
[~] F5  probarMailer.js ✅ + mail-tester 9.5 ✅ + Gmail inbox ✅ | Outlook → Junk (reputación, re-test) | MXToolbox/reserva real pendientes
[x] F5  Tramo 2: salida real desde el cron en Railway + Etapa 3 del recordatorio ✅ (2026-06-09)
[ ] F6  Subir DMARC a quarantine, luego a reject
[ ] MERGE  feature/turnero → main: activa el mail en la barbería real (web service); ver §13
```

---

## 13. Topología de despliegue y activación en la barbería real (post-merge a `main`)

> **Hallazgo clave (2026-06-09):** en Railway hay **dos servicios** que deployan de
> **ramas distintas**, así que "el mail anda en prod" significa cosas distintas según
> el servicio:
>
> | Servicio Railway | Rama que deploya | ¿Tiene el mailer de Resend? |
> |---|---|---|
> | **web** (API que usa la barbería real, Kingsai) | `main` | **No** — `main` está ~136 commits atrás, sin `services/` ni mailer |
> | **cron** (recordatorios) | `feature/turnero` | **Sí** — incluye `ecc5484` |
>
> Consecuencia: hoy el mail solo puede salir desde el **cron**. La **barbería real**
> (web service, `main`) **no manda mail** todavía — de hecho esa versión nunca tuvo la
> feature. El mail para la barbería real se activa **con el merge `feature/turnero →
> main`**.

### Qué YA quedó listo para el merge (no hay que volver a tocarlo)
- **Env vars en Railway:** `RESEND_API_KEY` + `MAIL_FROM` están como **shared variables**
  referenciadas en **ambos** servicios (web y cron). Cuando el código de mail llegue a
  `main`, el web service ya las tiene → se activan solas, sin tocar Railway.
  **Nota (2026-06-09, Tramo 2):** verificá el *valor*, no solo que la var exista. El
  `MAIL_FROM` había quedado con el remitente sandbox viejo (`onboarding@resend.dev`) y
  nunca se actualizó → el cron tiró un 403 de Resend en la primera corrida real. Al ser
  shared variable, corregir el valor una vez (a `BarberManager <turnos@send.barbermanager.app>`)
  lo dejó bien para **ambos** servicios, así que el web service ya hereda el valor correcto.
- **DNS (SPF/DKIM/MX/DMARC):** son a nivel **dominio** (`send.barbermanager.app` /
  `_dmarc.barbermanager.app`), no dependen de la rama → ya sirven para el web service
  apenas tenga el código.

### Qué hay que hacer/verificar EN el merge
- [ ] El merge trae `services/mail/` + sus imports a `main` → el web service empieza a
      mandar mail (confirmación / cancelación / reprogramación / cancelación automática).
- [ ] **Verificar el remitente en el web service** tras el primer deploy de `main`: en
      el primer envío los logs tienen que mostrar `[mailer] proveedor de mail
      inicializado | remitente por defecto: BarberManager <turnos@send.barbermanager.app>`
      (el mailer se carga perezoso, no en el boot, así que ese log aparece recién con el
      primer mail, no al arrancar).
- [ ] **Re-test de entregabilidad desde el web service de prod** con una reserva real:
      bandeja en Gmail **y** Outlook (ojo Outlook, ver Fase 5 — warmup en curso).
- [ ] **Nada que tocar en DNS ni en env vars** (ver arriba; ya están).

### `.env` local (no se commitea, gitignored)
- `MAIL_FROM` local quedó en `BarberManager <turnos@send.barbermanager.app>` (el
  remitente real). El `onboarding@resend.dev` fue solo para el primer test sin dominio.

---

*— Fin del documento —*
