# Runbook — Go-live del turnero (`feature/turnero` → `main`)

Creado: 2026-06-12. **Doc operativo de un solo uso: archivar tras el go-live** (como los `plan_*.md`).

> Guión **ejecutable** del día del go-live: comandos git exactos, líneas a tocar en
> `vercel.json`, SQL y plan de rollback. El "dónde estamos" general vive en
> [`estado_actual.md`](./estado_actual.md); este doc es el paso a paso para correr el día D.
> Historia/contexto del mail en [`plan_entregabilidad_mail.md`](./plan_entregabilidad_mail.md) §13
> y del recordatorio en [`plan_recordatorio_turnos.md`](./plan_recordatorio_turnos.md) Etapas 3–4.

---

## Qué es este go-live (en una línea)

Mergear `feature/turnero` (167 commits: turnero del cliente + app del barbero + horario de
atención + feriados + mail por Resend + fixes de scoping) a `main`, **abrir los rewrites de
Vercel a todos los tenants** y **activar el mail transaccional en la barbería real (kingsai)**.
No es solo un merge técnico: deja el turnero de kingsai **público y reservable**.

---

## Estado de partida (verificado 2026-06-12) — ya cumplido, NO re-hacer

- [x] Todas las branches hijas (`frontend-barbero-ui`, `horario-atencion`, `imagenes-tenant`,
      `scoping-admin-barbero`, etc.) **ya mergeadas en `feature/turnero`**.
- [x] `feature/turnero` está **167 adelante / 0 atrás** de `main` → merge limpio, sin conflictos.
- [x] Local == `origin/feature/turnero` (sincronizado).
- [x] **`VITE_API_URL` seteada** en los proyectos Vercel de **turnero** y **barbero** (env
      Production) = `https://sistemagestionbarberia-production.up.railway.app`
      (sin barra final, sin `/api` — el código agrega `/api`).
- [x] Templates de mail resueltos.
- [x] **Recordatorio de kingsai = OFF** (se prende post-go-live, Fase 5).
- [x] Railway: `RESEND_API_KEY` + `MAIL_FROM` como **shared variables** en web + cron, con el
      **valor correcto** (`MAIL_FROM = BarberManager <turnos@send.barbermanager.app>`).
- [x] DNS de mail (SPF/DKIM/MX/DMARC) a nivel **dominio**, ya verde — no depende de la rama.

---

## Fase 0 — Verificaciones pre-merge (el día D, antes de tocar nada)

**0.1 — Git al día y merge limpio:**
```bash
git fetch origin
git checkout feature/turnero
git status                              # limpio y al día con origin/feature/turnero
git log --oneline feature/turnero..main # DEBE estar VACÍO (main contenido en la rama)
```

**0.2 — Kingsai listo para abrir reservas** (SQL en Supabase):
```sql
-- ¿Los barberos de kingsai tienen horarios cargados?
SELECT b.id, b.nombre, COUNT(h.id) AS bloques_horario
FROM barbero b
LEFT JOIN barbero_horario h ON h.barbero_id = b.id
WHERE b.tenant_id = 'a1b2c3d4-0000-0000-0000-000000000001'
GROUP BY b.id, b.nombre;

-- ¿El horario de atención del local está cargado?
SELECT * FROM tenant_horario_atencion
WHERE tenant_id = 'a1b2c3d4-0000-0000-0000-000000000001';
```
Confirmar también: servicios y `duracion_slot_minutos` correctos para kingsai.

**0.3 — Recordatorio de kingsai en OFF** (debería estarlo ya; ver Anexo A para verificar).

---

## Fase 1 — Abrir los rewrites (commit en `feature/turnero`)

Quitar el `has` que limita los rewrites a `demo.barbermanager.app`. Va **en `feature/turnero`**
para que el merge lo arrastre y el deploy de Vercel quede consistente de una.

**Editar `frontend/vercel.json`.** Borrar los dos bloques `"has"` (líneas 7 y 12) **y la coma**
de la línea `destination` anterior a cada uno.

ANTES:
```json
{
  "trailingSlash": false,
  "rewrites": [
    {
      "source": "/turnos/:path*",
      "destination": "https://sistema-gestion-barberia-turnero.vercel.app/:path*",
      "has": [{ "type": "host", "value": "demo.barbermanager.app" }]
    },
    {
      "source": "/barbero/:path*",
      "destination": "https://sistema-gestion-barberia-barbero.vercel.app/:path*",
      "has": [{ "type": "host", "value": "demo.barbermanager.app" }]
    }
  ]
}
```

DESPUÉS:
```json
{
  "trailingSlash": false,
  "rewrites": [
    {
      "source": "/turnos/:path*",
      "destination": "https://sistema-gestion-barberia-turnero.vercel.app/:path*"
    },
    {
      "source": "/barbero/:path*",
      "destination": "https://sistema-gestion-barberia-barbero.vercel.app/:path*"
    }
  ]
}
```

Commit + push de la rama:
```bash
git add frontend/vercel.json
git commit -m "chore(vercel): abrir rewrites de /turnos y /barbero a todos los tenants (go-live)"
git push origin feature/turnero
```

---

## Fase 2 — El merge (`--no-ff`) + push

`--no-ff` fuerza un **commit de merge** (aunque podría ser fast-forward). Es lo que permite
revertir todo el go-live con un solo comando si algo sale mal (ver Rollback).

```bash
git checkout main
git pull origin main
git merge --no-ff feature/turnero -m "merge: go-live del turnero (feature/turnero -> main)"
git rev-parse HEAD          # ANOTAR este hash: es el del merge, lo necesitás para el rollback
git push origin main
```

El push dispara en cadena:
- **Vercel** redeploya gestión / turnero / barbero **reales** y abre los rewrites a todos los tenants.
- **Railway (web service)** redeploya `main` con `services/mail/` → arranca el mail transaccional.

---

## Fase 3 — Verificar el web service (mail transaccional de la barbería real)

1. **Smoke test del front:** abrir `https://kingsai.barbermanager.app/turnos` → debe cargar el
   **turnero real** (wizard de reserva), **no** la pantalla de login operativo. Idem
   `/barbero`. (Si sale el login operativo, el `has` no se quitó bien o falta el deploy.)
2. **Reserva real** desde ese turnero → confirmar que el mail de confirmación llega a la
   **bandeja** en Gmail **y** Outlook (Outlook puede caer a Junk por warmup de dominio nuevo;
   es esperado, ver Fase 5).
3. **Logs del web service** (Railway): en el **primer** envío debe aparecer
   `[mailer] proveedor de mail inicializado | remitente por defecto: BarberManager <turnos@send.barbermanager.app>`
   (carga perezosa → aparece con el primer mail, no al bootear).
4. **Verificar el VALOR** (no solo que exista) de `MAIL_FROM` y `RESEND_API_KEY` en el web
   service: deben ser `BarberManager <turnos@send.barbermanager.app>` y la API key de prod.
   (En Tramo 2 el cron tenía un `MAIL_FROM` sandbox viejo y tiró 403 — por eso se chequea el valor.)
5. **Nada que tocar** en DNS ni env vars: ya están a nivel dominio / shared.

---

## Fase 4 — Cron del recordatorio → `main`

En **Railway → servicio cron** (el de `node src/jobs/recordatorios.js`):

- [ ] Cambiar **"Branch connected to production"** de `feature/turnero` a **`main`**. Si no, el
      cron seguiría deployando el código congelado de la rama vieja. (Tras el merge, `main` ya
      tiene el mismo mailer que tenía `feature/turnero`, así que el cambio es seguro.)
- [ ] ⚠️ **NO borrar la branch `feature/turnero`** hasta haber hecho este cambio (el cron
      dependía de ella). Conviene conservarla un tiempo como red de seguridad.

> El recordatorio de kingsai sigue en **OFF** en este punto: cambiar el branch del cron **no**
> lo prende. La activación es la Fase 5.

---

## Fase 5 — Post go-live (cuando el mail transaccional ya se vio andar)

**5.1 — Prender el recordatorio de kingsai** (recién cuando viste mails transaccionales reales
llegando bien). SQL en Anexo A. Ojo: los barberos de kingsai tienen `email = NULL` (no sincroniza
Calendar) pero los **clientes sí** reciben el recordatorio → flip deliberado.

**5.2 — Seguimiento de entregabilidad** (time-gated, independiente del merge):
- Dejar hornear reportes **DMARC** 1–2 semanas con tráfico alineado → recién ahí endurecer
  `p=none → quarantine → reject` (Fase 6 del plan de mail).
- **Re-test de Outlook** tras warmup.
- MXToolbox + Google Postmaster (tendencia, a los días).
- Deuda menor: `npm uninstall nodemailer` (sin uso tras migrar a `fetch`).

---

## Rollback (si el go-live sale mal)

Un solo commit de merge → un solo revert deshace todo:
```bash
git revert -m 1 <hash-del-merge>     # el que anotaste en Fase 2
git push origin main
```
- Devuelve `main` al estado pre-turnero: Vercel redeploya los placeholders **y repone el `has`**;
  el web service de Railway redeploya **sin** mailer. Todo automático por los autodeploys.
- Si ya cambiaste el cron a `main`, también vuelve a un `main` sin mailer; como el recordatorio
  de kingsai está en OFF, no manda nada → inofensivo. Opcional: volver el cron a `feature/turnero`.
- **Gotcha de git:** si después querés **re-mergear** `feature/turnero`, primero hay que
  **revertir el revert** (`git revert <hash-del-revert>`), porque git la considera "ya mergeada".

---

## Anexo A — SQL del recordatorio (Supabase)

```sql
-- Ver estado actual (kingsai y demo como referencia)
SELECT subdominio, configuracion FROM tenant WHERE subdominio IN ('kingsai', 'demo');

-- PRENDER en kingsai (merge superficial: crea recordatorio si no existe, preserva ciudad/moneda)
UPDATE tenant
SET configuracion = COALESCE(configuracion, '{}'::jsonb) || '{"recordatorio": {"activo": true}}'::jsonb
WHERE subdominio = 'kingsai';

-- APAGAR en kingsai
UPDATE tenant
SET configuracion = COALESCE(configuracion, '{}'::jsonb) || '{"recordatorio": {"activo": false}}'::jsonb
WHERE subdominio = 'kingsai';
```
> Se usa `||` (no `jsonb_set`) porque `jsonb_set` no crea el objeto `recordatorio` intermedio si
> todavía no existe. Si en el futuro hay claves anidadas a preservar (ej. `hora_envio`), cambiar a `jsonb_set`.

---

## Anexo B — SQL de emails de barberos kingsai (cuando se carguen)

```sql
-- Ver ids y estado actual
SELECT id, nombre, email FROM barbero
WHERE tenant_id = 'a1b2c3d4-0000-0000-0000-000000000001';

-- Cargar el email de un barbero
UPDATE barbero SET email = 'mail-del-barbero@gmail.com'
WHERE id = '<barbero_id>' AND tenant_id = 'a1b2c3d4-0000-0000-0000-000000000001';
```
**Antes de correrlo:**
1. **Avisarle al barbero.** Apenas tiene email, empieza a recibir invitaciones de Google
   Calendar desde `turnos.barbermanager@gmail.com`. Si no sabe qué son, las puede rechazar o
   marcar spam (ensucia reputación). Cargar el email **después** de coordinarlo con él.
2. **Solo afecta turnos nuevos.** Los turnos creados mientras el email era `NULL` no se
   re-sincronizan a su calendario; solo los creados después invitan al barbero.
3. **No hay otro switch:** el email *es* el interruptor de la sync de Calendar para ese barbero.

---

## Anexo C — Valores de referencia

| Dato | Valor |
|---|---|
| UUID kingsai | `a1b2c3d4-0000-0000-0000-000000000001` |
| UUID demo | `aaaaaaaa-0000-0000-0000-000000000002` |
| Backend (Railway web) | `https://sistemagestionbarberia-production.up.railway.app` |
| `VITE_API_URL` (turnero + barbero, Production) | `https://sistemagestionbarberia-production.up.railway.app` |
| `MAIL_FROM` | `BarberManager <turnos@send.barbermanager.app>` |
| Cron schedule | `30 23 * * *` (23:30 UTC = 20:30 ART) |
| Cuenta central Calendar | `turnos.barbermanager@gmail.com` |

---

## Post-mortem — descubrimientos del go-live (2026-06-12)

El web service de Railway entró en **crash-loop** apenas se pusheó el merge. Eran **tres causas
encadenadas**: cada una tapaba a la siguiente, así que aparecieron de a una a medida que se
resolvían. Servicio restaurado tras pinear Node 22; backend pasó de `502 → 400` (sano) y los
tres fronts quedaron OK.

1. **Faltaban `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el web service.** El merge trajo
   `backend/src/config/supabase.js` (cliente de Supabase **Storage** para imágenes de tenant,
   rama `imagenes-tenant`), que se inicializa al cargar el módulo. El "Estado de partida" de este
   runbook solo verificó `RESEND_API_KEY`/`MAIL_FROM`, **no** estas dos → boot crash
   (`supabaseUrl is required`). La conexión a la DB es por `pg` (otras credenciales), por eso no
   saltó antes. **Fix:** agregarlas al web service — `SUPABASE_URL =
   https://mtmqdnkbustsfawxgroe.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY` desde Supabase →
   Settings → API.

2. **Las shared variables de Railway no se inyectan solas.** Crearlas a nivel proyecto **no** las
   adjunta al servicio: hay que referenciarlas desde el servicio (`${{shared.VAR}}`) o setearlas
   directo. El primer intento (solo crear las shared) no llegó al contenedor y **ni siquiera
   disparó un deploy nuevo** — siguió el mismo crash. Pista en el log: `injecting env (0) from
   .env`. **Fix:** setearlas directo en el web service (o referenciar la shared).

3. **Node 18 + `@supabase/supabase-js` v2 = crash por WebSocket.** Con las vars ya presentes,
   `createClient()` construye **siempre** su cliente de Realtime (websockets), que exige
   `WebSocket` nativo (existe en **Node ≥22**, no en 18). Railway corría Node 18 porque
   `engines: ">=18"` hace que Nixpacks tome el **piso** del rango (no había `Dockerfile`/`.nvmrc`/
   `nixpacks.toml`). Node 20 no sirve (su WebSocket global es experimental detrás de flag).
   **Fix:** pinear `"node": "22.x"` en `backend/package.json` (commit `ec1d155`); de paso saca
   los warnings de "Node 18 deprecated".

**Implicancia para el cron (Fase 4):** el servicio cron sigue en `feature/turnero`, con el mismo
`engines: ">=18"`. Al apuntarlo a `main` se lleva el fix de Node 22 — razón extra para que apunte
a `main` y no a la rama vieja.

**Deuda técnica de fondo (registrar en `estado_actual.md`):** que una credencial o
incompatibilidad del **Storage de imágenes** voltee **todo el backend** al bootear es un
acoplamiento indebido. Fix correcto: inicialización **perezosa** del cliente de Supabase y que un
fallo de Storage devuelva un 500 puntual en vez de matar el proceso. Ver
`backend/src/config/supabase.js`.

---

*— Fin del runbook —*
