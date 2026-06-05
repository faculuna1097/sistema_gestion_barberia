# Plan de entregabilidad de mail (SPF / DKIM / DMARC)

Documento de plan. **No ejecutado todavía.** Describe cómo migrar el envío de
mails transaccionales del turnero desde el SMTP de Gmail hacia un dominio propio
autenticado, para sacarlos de la carpeta de spam (sobre todo en Outlook/Hotmail).

> Estado al escribir este doc (2026-06-05): el envío sigue saliendo desde
> `turnos.barbermanager@gmail.com` vía SMTP de Gmail. La única mitigación activa
> es el **aviso de "revisar spam"** en la pantalla de confirmación del turnero
> (commit `e9a3a57`). Eso alcanza para hoy; este plan es para el futuro.

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
(ver [`backend/src/services/mailer.js`](../backend/src/services/mailer.js), líneas 45 y 163).

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

---

## 3. Decisiones tomadas

| # | Decisión | Valor | Por qué |
|---|---|---|---|
| 1 | Proveedor | **Resend** | Mejor equilibrio para nuestro caso: built sobre AWS SES, SDK de Node simple, **tier gratis 3.000 mails/mes (100/día)**, panel que entrega los DNS listos para copiar y los verifica. Curva suave para quien recién entra a infra de mail. |
| 2 | Dominio de envío | **Subdominio dedicado** `send.barbermanager.app` | Aísla la reputación de envío del dominio raíz y de los subdominios de tenants (`kingsai.barbermanager.app`, etc.). Si un mail problemático afecta reputación, no contamina el dominio principal. Es la práctica recomendada por Resend. |
| 3 | Registrador / zona DNS | **Namecheap** | Es donde se compró `barbermanager.app`. Los registros se cargan en Namecheap → **Advanced DNS** (asumiendo nameservers de Namecheap / BasicDNS; ver §6 si la zona estuviera delegada a otro lado). |
| 4 | Plan B de entregabilidad | **Postmark** | Solo si tras migrar a Resend Outlook sigue mandando a spam. Es el gold standard transaccional para Outlook, pero el tier gratis es de prueba (~100/mes) y arranca en ~US$15/mes. No se adopta ahora. |

---

## 4. Arquitectura objetivo

```
Backend (Railway)
  └─ Nodemailer  ──SMTP──>  Resend (smtp.resend.com)  ──>  AWS SES  ──>  destinatario
                                   │
        From: BarberManager <turnos@send.barbermanager.app>
        Reply-To: <mail real de la barbería>   (mejora futura, ver §11)

DNS de barbermanager.app (Namecheap)
  ├─ send.barbermanager.app           TXT  SPF        (autoriza a SES)
  ├─ resend._domainkey.send...        TXT  DKIM       (clave pública, la genera Resend)
  ├─ send.barbermanager.app           MX   feedback   (bounces/quejas de SES)
  └─ _dmarc.barbermanager.app         TXT  DMARC      (política + reportes)
```

Se mantiene **Nodemailer** y todo el HTML de los mails. Solo cambia el transporte
(de `service:'gmail'` a SMTP de Resend) y el `From`. El cambio de código es chico.

---

## 5. Plan por fases

### Fase 0 — Pre-requisitos
- [ ] Acceso al panel de Namecheap (cuenta donde se compró el dominio).
- [ ] Decidir el mail de origen exacto. Propuesta: `turnos@send.barbermanager.app` (o `no-reply@send.barbermanager.app`).
- [ ] Decidir a dónde van los reportes DMARC. Propuesta: un buzón propio + un lector gratuito de reportes (ver Fase 3).

### Fase 1 — Crear cuenta y dominio en Resend
- [ ] Crear cuenta en Resend.
- [ ] **Add Domain** → escribir `send.barbermanager.app` (el subdominio, no el dominio raíz).
- [ ] Elegir **región**: si está disponible, **`sa-east-1` (São Paulo)** por cercanía a Argentina (afecta el host del registro MX de feedback y la latencia).
- [ ] Resend muestra una lista de registros DNS a cargar (SPF + DKIM + MX). **Dejar esa pantalla abierta**: esos valores son los que se copian a Namecheap. El DKIM es único por dominio y lo genera Resend — no se inventa.

### Fase 2 — Cargar DNS en Namecheap
Ver §6 para el detalle exacto de cada registro y cómo traducir el "Host". En resumen:
- [ ] Namecheap → Domain List → `barbermanager.app` → **Manage** → **Advanced DNS**.
- [ ] Agregar el **TXT de SPF** del subdominio.
- [ ] Agregar el **TXT de DKIM** (selector `resend`).
- [ ] Agregar el **MX de feedback** del subdominio.
- [ ] Volver a Resend y tocar **Verify**. Cuando los registros propagan, pasan a verde (suele ser minutos; puede tardar hasta 24-48 h, ver §10).

### Fase 3 — DMARC en política suave (monitoreo)
- [ ] Agregar el TXT de DMARC en `_dmarc.barbermanager.app` con `p=none` (ver §6.4).
- [ ] Conectar un lector de reportes DMARC. Opciones gratis: **dmarcian**, **URIports**, **Postmark DMARC** (postmarkapp.com/dmarc) o **Cloudflare DMARC Management**. Mandan los reportes XML legibles.
- [ ] Dejar correr **1–2 semanas** y mirar que el 100% del tráfico legítimo venga de Resend/SES y esté alineado (SPF y DKIM en verde para nuestro dominio).

### Fase 4 — Cambio de código + variables de entorno
- [ ] Implementar el cambio en [`mailer.js`](../backend/src/services/mailer.js) (ver §7).
- [ ] Cargar las variables nuevas en Railway (ver §8).
- [ ] Deploy.

### Fase 5 — Pruebas y verificación
- [ ] Correr [`backend/src/scripts/probarMailer.js`](../backend/src/scripts/probarMailer.js) (manda los 4 tipos de mail).
- [ ] Verificar con mail-tester.com, MXToolbox y (a los días) Google Postmaster (ver §9).
- [ ] Probar una reserva real y mirar que llegue a bandeja de entrada en Gmail **y** en Outlook/Hotmail.

### Fase 6 — Endurecer DMARC
- [ ] Con reportes limpios: subir a `p=quarantine` (opcionalmente con `pct=` para rampar).
- [ ] Tras otra ventana limpia: subir a `p=reject`.
- [ ] Ver §6.4 para los valores exactos de cada escalón.

---

## 6. Registros DNS — detalle

> **Importante**: los valores de SPF/DKIM/MX **los da Resend** en la pantalla de
> verificación del dominio. Acá se muestra la *forma* esperada para que sepas qué
> estás cargando; **el valor real (sobre todo la clave DKIM) se copia del panel**.

### Regla de traducción "Name" (Resend) → "Host" (Namecheap)
Namecheap **auto-agrega `.barbermanager.app`** al Host. Entonces: tomá el `Name`
que muestra Resend y **quitale `.barbermanager.app` del final**; lo que queda es
el Host de Namecheap.

| Lo que muestra Resend (FQDN) | Host a escribir en Namecheap |
|---|---|
| `send.barbermanager.app` | `send` |
| `resend._domainkey.send.barbermanager.app` | `resend._domainkey.send` |
| `_dmarc.barbermanager.app` | `_dmarc` |
| `barbermanager.app` (raíz, si apareciera) | `@` |

### 6.1 SPF (TXT)
- **Type**: TXT Record
- **Host**: `send`
- **Value** (forma típica de Resend/SES): `v=spf1 include:amazonses.com ~all`
- **Por qué**: autoriza a los servidores de Amazon SES (que usa Resend) a enviar en nombre de `send.barbermanager.app`. El `~all` (softfail) marca como sospechoso lo no autorizado sin rechazarlo de una.

### 6.2 DKIM (TXT)
- **Type**: TXT Record
- **Host**: `resend._domainkey.send` (selector `resend`)
- **Value**: `p=MIGfMA0GCSqGSIb3DQ...` (clave pública larga, **copiar exacta del panel de Resend**)
- **Por qué**: Resend firma cada mail con la clave privada; el receptor valida con esta clave pública publicada en DNS. Es lo que prueba que el mail es auténtico y no fue alterado.
- **Nota Namecheap**: pegar el value tal cual, sin comillas extra ni saltos de línea. Si Namecheap parte el valor, igual lo acepta.

### 6.3 MX de feedback (MX)
- **Type**: MX Record
- **Host**: `send`
- **Value**: `feedback-smtp.sa-east-1.amazonses.com` (el host depende de la región elegida en Fase 1 — **copiar del panel**)
- **Priority**: `10`
- **Por qué**: SES usa este MX para manejar rebotes y quejas del subdominio. No afecta la recepción de mails del dominio raíz (es un MX del subdominio `send`, independiente).

### 6.4 DMARC (TXT) — progresión
- **Type**: TXT Record
- **Host**: `_dmarc`

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

### 6.5 Posibles conflictos en Namecheap
- Si existe un **wildcard** (`*`) o registros para los subdominios de tenants, no chocan con `send` (un Host explícito gana sobre el wildcard). Igual, revisar que no haya un registro `send` previo.
- Si el dominio tiene activado **Parking / URL Redirect** de Namecheap, puede meter registros por default que conviene revisar.
- **TTL**: dejar en `Automatic`.

---

## 7. Cambio de código

Archivo: [`backend/src/services/mailer.js`](../backend/src/services/mailer.js).
La idea es **mínima invasión**: mantener Nodemailer y todo el HTML; solo cambiar
el transporte y el `From`. Resend ofrece SMTP, así que no hace falta su SDK.

### 7.1 Transporter (reemplaza el bloque actual `service:'gmail'`)
```js
// Antes (líneas ~32-52): leía GMAIL_APP_PASSWORD + GOOGLE_CALENDAR_EMAIL
// y armaba un transporter con service:'gmail'.

const { RESEND_API_KEY, MAIL_FROM } = process.env;

const credencialesCargadas = Boolean(RESEND_API_KEY && MAIL_FROM);

let transporter = null;
if (credencialesCargadas) {
  transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: { user: 'resend', pass: RESEND_API_KEY },
  });
  console.log('[mailer] transporter Resend inicializado | remitente:', MAIL_FROM);
} else {
  console.warn('[mailer] credenciales NO cargadas — envío inactivo en este proceso');
}
```

### 7.2 From (en `enviarMail`, línea ~163)
```js
// Antes: from: `BarberManager <${GOOGLE_CALENDAR_EMAIL}>`
from: MAIL_FROM,            // ej: 'BarberManager <turnos@send.barbermanager.app>'
// (opcional, ver §11) replyTo: <mail real de la barbería>
```

### 7.3 Detalle importante: desacople de Google Calendar
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

- **TTL** de Namecheap: dejar en Automatic.
- Propagación típica: **minutos a pocas horas**; el máximo formal es **24–48 h**.
- Resend reintenta la verificación solo; si a las pocas horas no pasó a verde, revisar Host/valor en Namecheap (el error más común es haber dejado `.barbermanager.app` de más en el Host, ver §6).

---

## 11. Riesgos, rollback y futuro

**Rollback**: el cambio de código es reversible volviendo el transporter a
`service:'gmail'` y el `From` a `GOOGLE_CALENDAR_EMAIL`. Los registros DNS son
aditivos (no rompen nada existente del dominio).

**Riesgo principal**: endurecer DMARC antes de tiempo → correo legítimo a spam o
perdido. Mitigación: respetar la progresión `none → quarantine → reject` con
reportes limpios entre escalones.

**Mejoras futuras relacionadas** (no bloquean este plan):
- **`Reply-To` por tenant**: hoy no hay `Reply-To`; si un cliente responde, va al
  no-reply. Convendría setear `Reply-To` al mail real de la barbería (multi-tenant:
  saldría de los datos del tenant). Ligado a la deuda de acoplamiento del mailer.
- **Reintentos / cola**: el envío es best-effort y si SMTP falla se pierde el mail
  ([`mailer.js`](../backend/src/services/mailer.js), bloque `catch` de `enviarMail`).
  A más volumen, evaluar reintento o cola.
- **Límite del tier gratis de Resend**: 3.000/mes y 100/día. Con varios tenants
  activos puede quedar corto; monitorear y subir de plan o evaluar Postmark.

---

## 12. Checklist resumido (para el día que se ejecute)

```
[ ] F1  Crear cuenta Resend + Add Domain send.barbermanager.app (región sa-east-1)
[ ] F2  Namecheap → Advanced DNS: cargar SPF (TXT), DKIM (TXT), MX feedback
[ ] F2  Resend → Verify (esperar verde)
[ ] F3  Namecheap: TXT _dmarc con p=none + conectar lector de reportes
[ ] F3  Esperar 1–2 semanas, reportes 100% alineados
[ ] F4  Código: transporter Resend + MAIL_FROM en mailer.js
[ ] F4  Railway: RESEND_API_KEY + MAIL_FROM ; .env.example documentado
[ ] F5  probarMailer.js + mail-tester + MXToolbox + prueba real Gmail/Outlook
[ ] F6  Subir DMARC a quarantine, luego a reject
```

---

*— Fin del documento —*
