# Estado actual del proyecto

Última actualización: 2026-11-06 (**monitoreo de producción en producción**, `feature/monitoreo-prod`: Sentry en el backend, avisos al celular por Discord desde Railway, UptimeRobot y Sentry, y las skills `salud-prod` y `arreglo-prod` para diagnosticar y resolver desde el celular con Claude en la nube. `main` protegido: se entra siempre por PR. Ver "Monitoreo de producción" en Estado funcional y [`decisiones_monitoreo_prod.md`](./decisiones_monitoreo_prod.md). Próximo: `feature/mejoras-operativas`, rebasada sobre este `main`). Antes, 2026-11-05 (**`feature/descansos-agenda` mergeado a `main` y en producción**, merge `a1b5ed7`: rediseño del turnero, descansos en la Agenda, cortes con/sin turno, deudas técnicas y health sin tenant. Hechos también el relleno + `NOT NULL` de `corte.comision_porcentaje` y el rename a "Productos para venta"; lo que queda, en Pendientes. Próximo: `feature/mejoras-operativas`, `docs/plan_mejoras_operativas.md`). Antes, 2026-11-05 (integrada a mano la rama `claude/mobile-login-issue-7extzq`: `/api/health` sin tenant, log del rechazo por tenant y mensajes de falla por causa en los logins y el turnero). Antes, 2026-11-04 (deudas técnicas resueltas en `feature/descansos-agenda` antes del merge; las que quedan, aceptadas con su motivo, en "Deudas técnicas conocidas". Falta mergear y desplegar, ver Pendientes). Antes, 2026-10-29 (Feature 1 de la app del barbero —grilla de slots, descansos y registro en Planillas— terminada en el branch `feature/descansos-agenda`, que trae adentro `feature/turnero-ux`). Antes, 2026-10-08 (rediseño UX/UI del turnero terminado en el branch `feature/turnero-ux`). Antes, 2026-10-01 (landing pre-renderizada y lista para IA: SSG, robots, sitemap, JSON-LD, `llms.txt`, `og-image`, Vercel Analytics y copy nuevo; pendiente de deploy). Antes, 2026-09-30: movimientos extra (aportes, retiros y otros ingresos), RLS en todas las tablas y modales de detalle en Planillas y Balances. **Go-live del turnero mergeado a `main` y en producción** (`kingsaistudio.barbermanager.app`): turnero del cliente, app del barbero, acceso de barberos al panel, horario de atención + feriados y rediseño del panel de gestión, todo live. Backend fijado a **Node 22** en Railway (supabase-js v2 necesita WebSocket nativo — ver post-mortem en [`postmortem_golive_turnero.md`](./postmortem_golive_turnero.md)). El mailer de Resend está activo tanto en el web service como en el cron. **(2026-06-15) Landing de marketing en producción** en `barbermanager.app` (apex canónico, `www` redirige). Quedan solo residuales operativos/time-gated de entregabilidad de mail — ver Pendientes.

Para convenciones de código, ver [`/docs/convenciones_tecnicas.md`](./convenciones_tecnicas.md).

---

## Stack

- **Frontend:** React + Vite, inline styles + módulo `theme` (design tokens), fuente Geist. Gestión, barbero y landing usan el sistema de diseño "Luz", con acento indigo (ver `docs/sistema_de_disenio.md`). El turnero parte de Luz con identidad propia en blanco y negro desde su rediseño de 2026-10 (§3.8 del mismo doc). El verde `#1a7a4a` + DM Sans del scaffold original quedaron deprecados con el rediseño.
- **Backend:** Node.js + Express, ES Modules (`import/export`).
- **DB:** PostgreSQL via Supabase Session Pooler.
- **Auth:** bcrypt + JWT. Token del panel (admin o barbero) en memoria (`let authToken` en `frontend/src/services/api.js`; `App.jsx` lo setea con `setAuthToken`). Token operativo en `localStorage` con clave `token_operativo` (sobrevive al reload del iPad). Token barbero **en memoria** (módulo `api.js` de `frontend-barbero`, `let authToken`) — no persiste en `localStorage`, así que un reload obliga a re-loguear por PIN. Único token en `localStorage`: el operativo.

---

## Deploy

### Backend — Railway
- URL: `https://sistemagestionbarberia-production.up.railway.app`
- Root Directory: `/backend`
- Start command: `npm start` (= `node --import ./src/instrument.js src/index.js`; carga Sentry antes de arrancar el server)
- Variables de entorno: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `NODE_ENV=production`, `PORT=3000`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_EMAIL`, `RESEND_API_KEY`, `MAIL_FROM`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Storage de imágenes, `config/supabase.js`), `SENTRY_DSN` (shared variable, el DSN del proyecto `barberia-backend-prod` de Sentry). **`PLATFORM_ADMIN_KEY`** (opcional) habilita el endpoint de plataforma `POST /api/plataforma/cache/invalidate`; **sin setear por ahora a propósito** → el endpoint responde 503 (fail-safe). Setearla recién al usar el endpoint en prod (dispara autodeploy; hacerlo en momento de poco tráfico).
- **Dos servicios Railway:** el **web service** (esta API) y un **servicio cron** de recordatorios (`node src/jobs/recordatorios.js`), ambos deployando de `main`. `RESEND_API_KEY` + `MAIL_FROM` + `SENTRY_DSN` están como **shared variables** referenciadas en los dos, así que el mailer de Resend y Sentry están activos en ambos.
- `TENANT_ID` eliminado de Railway — ya no se usa en producción.
- Las cuatro `GOOGLE_*` corresponden a la cuenta central `turnos.barbermanager@gmail.com` (organizador de eventos del turnero), consumidas por `services/googleCalendar.js`. El refresh token es estable (app publicada en Google Cloud, no expira por inactividad).

### Frontend — Vercel

Cuatro proyectos deployados en Vercel, todos auto-deploy en push a `main`.

| Proyecto | Root | URL Vercel / dominio |
|---|---|---|
| Gestión | `/frontend` | `sistema-gestion-barberia.vercel.app` |
| Turnero del cliente | `/frontend-turnero` | `sistema-gestion-barberia-turnero.vercel.app` |
| App del barbero | `/frontend-barbero` | `sistema-gestion-barberia-barbero.vercel.app` |
| Landing (marketing) | `/frontend-landing` | `barbermanager.app` (apex, canónico) |

**Landing — en producción (2026-06-15).** Página de marketing de BarberManager
(`/frontend-landing`, commit `53ac14e`), proyecto Vercel propio con auto-deploy
en push a `main`. Es un **one-pager** sin router (`base: '/'`), así que **no
necesita `vercel.json`**. Configuración de dominio:
- **`barbermanager.app` (apex)** es el **canónico**: sirve el landing directo (200).
- **`www.barbermanager.app`** redirige **308 → apex**.
- El apex estaba libre (404 `DEPLOYMENT_NOT_FOUND`) antes de este deploy. Asignar
  `www` explícitamente al proyecto del landing **sobrescribe el wildcard
  `*.barbermanager.app`** del proyecto de gestión (un dominio exacto le gana al
  wildcard en Vercel) — `kingsaistudio` y los demás subdominios de tenant siguen
  resolviendo al panel, sin regresión.
- El `og:url` y el `<link rel="canonical">` del `index.html` apuntan al apex
  (`https://barbermanager.app/`).

**(2026-10-01) Landing pre-renderizada y lista para IA** (branch `feature/landing-ia`).
- **Pre-renderizado:** `npm run build` genera el HTML completo de la página (antes llegaba
  un `#root` vacío y los crawlers de IA, que no ejecutan JS, no veían nada) y React hidrata
  encima.
- **Archivos para buscadores e IA:** robots, sitemap, datos estructurados (JSON-LD),
  `llms.txt` y `og-image`.
- **Analytics:** Vercel Web Analytics, plan Hobby (sin eventos, ventana de 1 mes).
- **Contenido:** el copy apunta a Argentina; precio $30.000/mes con barberos ilimitados.
  Incluye un bloque frente a Fresha, Booksy y Setmore, con datos fechados.

El build corre el script `build` del `package.json` (`vite build` + build SSR +
`scripts/prerender.js`): el proyecto de Vercel **no** tiene que tener el Build Command
sobrescrito. Decisiones y mantenimiento en
[`decisiones_landing_ia.md`](./decisiones_landing_ia.md).

El proyecto de gestión actúa de shell: su `/frontend/vercel.json` proxea
`/turnos/*` y `/barbero/*` a los otros dos proyectos vía rewrites.
`trailingSlash: false` para normalizar URLs y que los rewrites se apliquen
sobre `/turnos` (sin barra) — sin esa normalización, Vercel trata las URLs
con barra final como acceso a directorio y devuelve 404 antes de procesar
rewrites.

Los rewrites de `/turnos/*` y `/barbero/*` aplican a **todos los tenants**: el
`has` condition que durante la fase placeholder los limitaba a
`demo.barbermanager.app` se removió en el go-live (commit `19c3642`). Las apps
de turnero/barbero resuelven el tenant desde `window.location.hostname` (el
rewrite de Vercel es transparente), así que kingsai y futuros tenants funcionan
sin tocar nada.

`VITE_API_URL = https://sistemagestionbarberia-production.up.railway.app`
(sin barra final) está seteada en los tres proyectos (gestión, turnero y
barbero); los tres consumen el backend en producción.

Wildcard domain `*.barbermanager.app` configurado en el proyecto de gestión
solamente; los otros dos se acceden vía rewrites del primero.

### Dominio y DNS
- Dominio: `barbermanager.app` (comprado en Namecheap).
- DNS delegado a Vercel via nameservers `ns1.vercel-dns.com` / `ns2.vercel-dns.com`.

### CORS
Función dinámica en `index.js`: acepta `localhost:5173` y cualquier `*.barbermanager.app`.
Además, **cuando `NODE_ENV !== 'production'`** acepta cualquier origen de red
local (localhost, `127.x`, `10.x`, `192.168.x`, `172.16–31.x`) para poder
probar los frontends desde otros dispositivos de la red (ej. un celular). En
producción esa rama no aplica y el CORS sigue tan estricto como antes.

### Probar los frontends en un dispositivo de la red local

Para abrir el turnero o la app del barbero desde un celular en la misma WiFi:

1. **`vite.config.js` de cada frontend** tiene `server: { host: true, port: N }`
   — `5173` gestión, `5174` barbero, `5175` turnero, `5176` landing. El `host: true` expone el dev server a la
   red local; los puertos fijos hacen las URLs predecibles.
2. **`VITE_API_URL`** debe apuntar a la IP de red local de la PC (no a
   `localhost`, que para el celular sería el celular mismo). Se setea en el
   `.env` de cada frontend (gitignored): `VITE_API_URL=http://<IP-PC>:3001`.
   La IP se obtiene con `ipconfig`; es DHCP, puede cambiar.
3. Backend corriendo localmente (`node src/index.js`), `NODE_ENV=development`.
4. En el celular: `http://<IP-PC>:5175/turnos/` y `http://<IP-PC>:5174/barbero/`
   (con la barra final del `base` path, sin ella da 404).
5. Firewall de Windows debe permitir el acceso de Node a la red privada.

---

## Tenants

| Tenant | Tipo | Subdominio | UUID |
|---|---|---|---|
| Kingsai Studio | Producción | `kingsaistudio` | `a1b2c3d4-0000-0000-0000-000000000001` |
| Demo | Desarrollo | `demo` | `aaaaaaaa-0000-0000-0000-000000000002` |
| Luxuri BarberClub | Producción (alta 2026-10-19) | `luxuribarberclub` | `d7990463-a5ee-47a4-a276-6dcb722f1189` |

URL de producción: `kingsaistudio.barbermanager.app` ✅ funcionando.

### Setup de dev local para la integración con Google Calendar

Las cuatro variables `GOOGLE_*` también están cargadas en `backend/.env`
(local, gitignored) con los mismos valores que Railway. Esto permite probar
end-to-end la integración con Google Calendar durante desarrollo, **siempre
y cuando se use el tenant demo**, no Kingsai.

Para que los eventos lleguen a algún lado durante el dev, hay barberos del
tenant demo con email cargado a un dev real:

| `barbero_id` | Nombre | Email | Tenant |
|---|---|---|---|
| `a74343cf-9388-452f-bcff-7df58d63244b` | facundo | `faculunacarp@gmail.com` | demo |

Los barberos de Kingsai siguen con `email = NULL` hasta que se coordine con
ellos personalmente. Cargar emails reales de Kingsai sin avisarles antes
generaría invitaciones de Google que ellos no entenderían.

---

## Decisiones arquitecturales

### Multi-tenancy por subdominio
La convención (header `X-Tenant-Subdomain`, fallback `TENANT_ID`, extracción del subdominio en el front) está en [`convenciones_tecnicas.md`](./convenciones_tecnicas.md) §5. El schema vive en [`SQL_Schema.md`](./SQL_Schema.md).

- **Caché del middleware:** las entradas resueltas se guardan en memoria como `{ tenant_id, operativo_token_version, admin_token_version }` por subdominio (query única `resolverPorSubdominio`, reusada por todo). Se invalidan al reiniciar **o** vía invalidación explícita: automática al rotar la password operativa (`adminOperativo`) o el PIN admin (`gestion.cambiarPinAdmin`) — ambos llaman `invalidar(subdominio)` en proceso → preserva la revocación inmediata de esos tokens — y manual con el endpoint de plataforma `POST /api/plataforma/cache/invalidate` (para baja / cambio de subdominio editados a mano en la DB). Ver `onboarding.md` → "Baja de un tenant".

La estructura del panel admin y el scroll global son convenciones: ver [`convenciones_tecnicas.md`](./convenciones_tecnicas.md) §8.

### RLS activado en todas las tablas (2026-09-30)
Las 18 tablas de `public` tienen Row Level Security activado y **sin policies**. Supabase expone `public` por su API automática (Data API) y los roles `anon` / `authenticated` tienen todos los permisos sobre las tablas; con RLS activado y sin policies, por esa API no se lee ni se escribe nada. El backend no se ve afectado: se conecta por el pooler como `postgres`, que es el dueño de las tablas, y al dueño RLS no le aplica. Ningún frontend usa Supabase (solo el backend, para Storage, con la `service_role`).

- Hasta esa fecha solo lo tenían `tenant_feriado`, `tenant_horario_atencion` y `tenant_imagen`; las otras 13 estaban abiertas para quien tuviera la anon key (que no está publicada en ningún front).
- **Regla:** toda tabla nueva se crea con `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. El SQL editor no lo activa solo; el editor de tablas de Supabase sí.
- **Gotcha:** si el backend (o el cron) se conectara con un rol que no es el dueño, RLS no da error: devuelve cero filas y la app se ve vacía. Se revierte con `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`.
- **Mejora opcional pendiente:** apagar la Data API desde la configuración del proyecto de Supabase, ya que la app no la usa. RLS no cubre `TRUNCATE`, pero esa API no lo expone.
- Verificado en producción el mismo día: el panel de gestión funciona igual con RLS activado en todas las tablas.

---

## Lógica de suscripción

> Esta sección documenta el comportamiento del sistema de bloqueo por suscripción vencida. Cuando exista `producto.md`, la parte de UX migra ahí.

### Datos
- Columna en tabla `tenant`: `suscripcion_vigente_hasta date`.
- Para renovar un cliente: `UPDATE tenant SET suscripcion_vigente_hasta = 'YYYY-MM-DD'`.

### Comportamiento según el día del mes actual
Aplica solo si la suscripción no se renovó (`suscripcion_vigente_hasta` anterior al primer día del mes actual). Lógica en `backend/src/utils/suscripcion.js`.
- **Días 1–4 del mes:** sin aviso, sin bloqueo.
- **Días 5–10:** banner amarillo en el panel.
- **Día 11+:** bloqueo total del panel (HTTP 402). Modo operativo (cortes/ventas/gastos) **no se bloquea**.

### Implementación
- El check ocurre **después** de verificar el PIN, para no filtrar info del tenant a quien no sabe el PIN.
- `loginPanel()` en `api.js` distingue 402 (`err.bloqueado = true`) del resto de errores.
- `BannerAviso` tiene X para cerrar manualmente. No reaparece hasta la próxima sesión.

---

## Estado funcional

### Modo operativo
- `FlujoCorte` ✅
- `FlujoVenta` ✅
- `FlujoGasto` ✅
- **(2026-10-29, en producción desde el 2026-11-05)** En los pasos de confirmación de los tres flujos, el botón de confirmar queda siempre a la vista: el resumen scrollea dentro de su tarjeta (`PanelWizard` con `pie` + `TarjetaResumen`, `sistema_de_disenio.md` §6.4). El panel y `FondoLocal` miden `100dvh` (con `100vh` de respaldo) por la barra de Safari del iPad. **Arreglo de `FondoLocal`:** la foto agrandada hacía scrolleable al contenedor, y el panel se corría ~33 px hacia arriba al enfocar un botón.

### Panel admin
- Inicio ✅
- Caja — Tab 1 (Movimientos del día) ✅, con el alta de aportes, retiros y otros ingresos (el "+" de la fila de pestañas)
- Caja — Tabs 2 y 3 (Cierre + Historial) ⏸️ postergado, ver pendientes
- Planillas ✅. En el Resumen semanal, al tocar un barbero se abre su detalle (cifras de la semana, pago, total generado por día y por forma de pago), también en el modo barbero.
- Gastos ✅
- Ventas ✅
- Balances ✅: "Ganancia del mes" con los otros ingresos; aportes y retiros aparte, cerrando en "Queda en el negocio". Decisiones en [`decisiones_movimientos_extra.md`](./decisiones_movimientos_extra.md). En el histórico, al tocar un mes se abre su detalle: la cuenta de la ganancia, la variación contra el mes anterior y los aportes y retiros, en el modo del botón de comisiones (el "vs anterior" también sigue a ese botón). El "vs anterior" compara contra el mes calendario anterior; si ese mes no tuvo movimientos, queda vacío (solo pasa con el primer mes de uso del sistema).
- Turnero (vista global de turnos del día) ✅
- Gestión (6 tabs) ✅

### Turnero del cliente (rediseño 2026-10, en producción desde el 2026-11-05)
- Landing "vidriera": foto del local a sangre, servicios y equipo tocables (llevan directo al paso que corresponde), horario semanal, dirección, teléfono, y WhatsApp y "Dejanos tu reseña en Google" solo si están cargados en `tenant.configuracion` ✅
- Flujo de 3 pasos: Servicio → "¿Cuándo?" (barbero, con "Cualquier barbero" primero; grilla de días y horarios) → "Confirmá tu turno" (resumen + datos + confirmar) → éxito con "Agregar al calendario", "Cómo llegar" y la gestión del turno ✅
- "Cualquier barbero": el backend asigna al que tenga menos turnos ese día (empate, alfabético); ante un 409, el front reintenta una vez con otro barbero libre ✅
- El "atrás" del celular vuelve un paso; transiciones con dirección, respetando "reducir movimiento" ✅
- Gestión del turno (link del mail): ver, agregar al calendario, cancelar y reprogramar ✅
- `/turnos/resena`: redirige al link de reseñas de Google (lo usan el link de la landing y el QR de la puerta) ✅
- Origen del cliente: el `?origen=` del link (ej. la bio de Instagram) se guarda en `turno.origen_link` ✅
- Decisiones en [`decisiones_turnero_ux.md`](./decisiones_turnero_ux.md).

### Descansos en la Agenda y cortes con/sin turno (en producción desde el 2026-11-05)
- App del barbero: la Agenda se ordena por slots, con en gris las horas del local en que el barbero no tiene slots; muestra los descansos y las ausencias del día ✅
- Descansos: el barbero marca slots libres y futuros y el turnero deja de ofrecerlos; los libera, o los termina antes si están en curso. Los pegados se ven como uno ✅
- Un turno se completa solo al registrar su corte (iPad o panel); la app del barbero ofrece "No asistió" y "Cancelar" ✅
- Panel: descansos y ausencias en la Agenda del Turnero, con su detalle; Gestión → Barberos → Ausencias con "Liberar" ✅
- Planillas: registro de descansos (columna en el Resumen, sección en el modal del barbero, hoja en el Excel) y cortes con/sin turno, también en `MiPlanilla` ✅
- Decisiones en [`decisiones_descansos.md`](./decisiones_descansos.md).

### Monitoreo de producción (en producción desde el 2026-11-06)
- **Avisos al celular**, en el canal `#alertas-prod` del server de Discord `BarberManager prod`. Ninguno usa Claude:
  - **Railway** (webhook del proyecto): deploy fallido o crash, de los dos servicios.
  - **UptimeRobot** (monitor `API prod`): `GET /api/health` cada 5 min; avisa la caída y la vuelta. También manda mail.
  - **Sentry** (proyecto `barberia-backend-prod`, plan gratis, 5.000 errores/mes): todo `console.error` del backend y del cron, con los tags `tenant`, `tenant_id` y `rol`, sin datos personales ni IPs. Reglas: `Issue nuevo`, `Issue que vuelve`, `Pico de errores` (> 50 en 1 h) y `Rate limiter sigue` (como mucho una por hora por tipo de límite). Cómo escribir código con esto: [`convenciones_tecnicas.md`](./convenciones_tecnicas.md) §1 → "Backend — Sentry".
- **Diagnosticar y resolver desde el celular:** app de Claude → **Code** → sesión con el repo, el entorno **`barberia-prod`** de claude.ai/code y **Sonnet** (Haiku no sirve: se saltea pasos e inventa datos). "¿Cómo está prod?" corre la skill `salud-prod` (solo lectura de logs de Railway); "arreglalo" corre `arreglo-prod`: arreglo de código por PR (vos tocás **Merge** en la app de GitHub), reinicio o rollback que hacés vos en railway.com desde el navegador del celular, o SQL que corrés vos en Supabase. Probado de punta a punta el 2026-11-06 (PR #4).
- **Garantías:** `main` protegido por el ruleset `proteger-main` (exige PR, sin excepciones) y una lista `deny` en `.claude/settings.json` con los comandos de Railway que escriben. En la nube no hay carteles de permiso: la sesión corre los comandos sola.
- Decisiones en [`decisiones_monitoreo_prod.md`](./decisiones_monitoreo_prod.md).

### Sistema
- Auth: bcrypt + JWT ✅. `verificarToken` (`middlewares/authMiddleware.js`) valida la firma (HS256, `config/jwt.js`), cruza el `tenant_id` del token contra el del subdominio (403 si difieren) e inyecta `req.rol` + `req.barbero_id`. Todos los JWT duran 30d y llevan `tv` (token version) para revocación inmediata:

  | Rol | Login | Payload | Revocación (`tv` distinto → 401) |
  |---|---|---|---|
  | admin | `POST /api/auth/panel/login` (unificado: resuelve admin/barbero según el PIN) | `{ tenant_id, rol, tv }` | `tenant.admin_token_version`, se incrementa al cambiar el PIN admin |
  | barbero | `POST /api/auth/panel/login` o `POST /api/auth/barbero/login` | `{ tenant_id, rol, barbero_id, tv }` | `barbero.token_version` (lo incrementa `editarBarbero`); además 401 si el barbero quedó `activo = false` |
  | operativo | `POST /api/auth/operativo/login` | `{ tenant_id, rol, tv }` | `tenant.operativo_token_version`, se incrementa al cambiar la password operativa |

  Roles por ruta (`requiereRol`, montado en `index.js` salvo donde se indica):

  | Rutas | Roles |
  |---|---|
  | `/api/auth/*`, `/api/turnero/*`, `GET /api/negocio`, `GET /api/negocio/imagenes` | públicas (los logins con `limiterLogin`) |
  | `/api/cortes`, `/api/turnos`, `/api/barberos`, `/api/servicios`, `/api/productos`, `/api/categorias` | operativo, admin |
  | `/api/ventas`, `/api/gastos` (rol por método, dentro del router) | `POST`: operativo, admin · `GET /mensual`, `PUT`, `DELETE`: admin |
  | `/api/caja`, `/api/inicio`, `/api/balances` | admin |
  | `/api/admin/{turnos, horarios, suspensiones, descansos, agenda, clientes, planilla}` | admin, barbero (el controller scopea por barbero) |
  | `/api/admin/{barberos, servicios, productos, negocio, turnero/config, operativo, feriados, imagenes, socios}` | admin |
  | `/api/admin/horario-atencion` (dentro del router) | `GET`: admin, barbero · `PUT`: admin |
  | `POST /api/plataforma/cache/invalidate` | fuera de tenant/JWT; header `X-Platform-Key` |

  Frontend gestión: `PantallaLoginOperativo` precede al MainScreen cuando no hay `token_operativo` en localStorage; `apiFetchOperativo` (`services/api.js`) inyecta el token operativo y ante 401 redirige al login. El tab `Seguridad` de SeccionGestion cambia PIN admin, usuario operativo y password operativa.
- Bloqueo/aviso por suscripción ✅ mergeado a `main`.
- Multi-tenancy por subdominio ✅ en producción (`kingsaistudio.barbermanager.app`).
- Migración de schema `refactor/schema-corte` ✅ mergeado a `main`.

---

## Pendientes

- **Rate limiter: `req.ip` es la IP de un proxy de Railway, no la del cliente (bug, anotado 2026-11-06).** `app.set('trust proxy', 1)` (`backend/src/index.js`) supone que Railway agrega un solo salto al `X-Forwarded-For`, pero agrega más de uno: en la prueba de la fase 3 del monitoreo, el borde de Railway registró la IP real del cliente y el limiter vio otra (de un proxy interno), que además cambia entre requests. Consecuencias: los usuarios que entran por el mismo nodo comparten el cupo (10 logins fallidos / 15 min, 300 req/min globales), así que unos PIN mal tipeados en un local pueden bloquearle el login a otro; un atacante reparte sus intentos entre nodos; y la IP del log del 429 no es la del cliente. Arreglo en un branch `fix/` propio: primero ver qué headers manda Railway (cuántos saltos, o si hay uno propio con la IP del cliente) y después ajustar `trust proxy` o la clave del limiter, probándolo contra prod con requests de prueba a demo.
- **Migrar el backend de Node 22 a 24 o 26 antes del 2027-04-30** (fin de soporte de Node 22). `backend/package.json` fija `"engines": { "node": "22.x" }`. Requisito a mantener: Node ≥ 22, por el WebSocket nativo que pide `@supabase/supabase-js`.
- **Monitoreo — residuales:**
  - Confirmar con `salud-prod` que el cron de recordatorios del 2026-11-06 (20:30) corrió bien con Sentry cargado: es la primera corrida con el código nuevo.
  - Pasar las 4 reglas de alerta de Sentry de "All environments" a `production`, cuando el proyecto `barberia-backend-prod` ya haya recibido eventos (hasta entonces, Sentry no ofrece la opción). No cambia nada en la práctica: a ese proyecto solo le manda producción.
  - Probar la lista `deny` desde la nube: pedirle a la sesión un `railway variables` y que quede bloqueado.
- **Rediseño del turnero y descansos en la Agenda — lo que queda después del deploy.** Mergeado a `main` (`a1b5ed7`) y desplegado el 2026-11-05, con los locales cerrados. Verificado ese día: `/api/health` sin header responde 200; el panel trae `x-robots-tag: noindex` en `/` y `/barbero`, y `/turnos` no; y las fuentes salen de `/fonts` con `Cache-Control: public, max-age=31536000, immutable`. En la DB, también ese día: 0 ausencias vigentes que correr 3 h; relleno de los 38 cortes que cargó el backend anterior y `corte.comision_porcentaje` a `NOT NULL`; y "Productos" renombrada a "Productos para venta" en los 3 tenants. Decisiones en [`decisiones_turnero_ux.md`](./decisiones_turnero_ux.md) y [`decisiones_descansos.md`](./decisiones_descansos.md).
  1. **Falta después del deploy:**
     - **Recargar el iPad y la app del barbero**, en kingsai y en luxuribarberclub. Después, en el iPad: Planillas y Caja sin "$ NaN", y un gasto de "Productos para venta" muestra el aviso de actualizar el stock.
     - Cambiar el link de la bio de Instagram de Kingsai a `https://kingsaistudio.barbermanager.app/turnos?origen=instagram`.
     - **Logo de Kingsai a 300 px:** el tope nuevo vale solo para las subidas nuevas. Volver a subir el logo desde Gestión → Negocio → Imágenes: medido con la misma librería, pasa de 486 px y 63,9 kB a 300 px y 30,4 kB.
     - (opcional) En Search Console, "Inspección de URLs" sobre `/turnos` confirma que se puede indexar.
     - **Opcional, `barbero.comision_tipo`:** ningún front publicado la usa. Se puede borrar sacándola antes del backend (`gestion.js` la lee y la escribe; Planillas y Balances la devuelven por compatibilidad).
     - **Opcional, el `COALESCE` de la comisión:** con el `NOT NULL`, `porcentajeComisionSql` (`backend/src/utils/comision.js`) ya no necesita caer en el % actual del barbero, y el comentario del archivo todavía habla de la columna nullable.
  2. **Datos de los dueños para la versión nueva** (relevado el 2026-11-04):
     - **Kingsai:** el link "Pedir reseñas" de su Perfil de Empresa de Google, si tiene número de WhatsApp y el teléfono del local (`tenant.telefono` está vacío). Sin los tres, la landing del turnero muestra solo la dirección. Cargar el WhatsApp y el link con el SQL de [`onboarding.md`](./onboarding.md) → "Cargar el WhatsApp y el link de reseñas", y el teléfono desde Gestión → Negocio. Con el link cargado, generar el QR de la puerta (SVG para imprimir, fuera del repo) apuntando a `https://kingsaistudio.barbermanager.app/turnos/resena?origen=qr`.
     - **Horarios de los barberos:** en kingsai solo Chancle tiene horario cargado (Lucas, Migue, Tomi y Tute, ninguno), y en luxuribarberclub ninguno de sus 2 barberos. Un barbero sin horario aparece en el "Equipo" del turnero pero no tiene horarios para reservar, "Cualquier barbero" no lo asigna, y en la app del barbero su Agenda queda toda gris y no puede marcar descansos. Si van a usar el turnero o la app, cargarlos desde Gestión → Barberos.
     - **Categorías de gasto:** contarles a los dos dueños qué va en cada una de las 9 (tabla del paso 2c de [`onboarding.md`](./onboarding.md)). En kingsai venían cargando insumos y limpieza en "Productos", y eso les mostraba el recordatorio de stock sin motivo.
     - **Luxuri:** el mismo relevamiento que kingsai (teléfono, WhatsApp y reseñas: hoy no tiene ninguno). Su suscripción vence el 2026-11-30.
  3. **Prueba del turnero en celulares reales** (iPhone abriendo el link desde Instagram, iPhone en Safari, Android con Chrome):
     - Autocompletado de nombre, email y teléfono dentro de Instagram (incluido el formato `+54 9 …`); el teclado al enfocar el primer campo con error y la tecla "Ir".
     - El gesto "atrás" vuelve un paso (el `pushState` ocurre 150 ms después del toque, dentro de la ventana de activación del usuario).
     - "Cualquier barbero" muestra el barbero asignado.
     - Transiciones con y sin "reducir movimiento"; el achique al tocar en iPhone; el overlay del `ConfirmDialog` de la gestión.
     - "Agregar al calendario" desde el éxito (riesgo conocido: dentro de Instagram el `.ics` puede no abrir) y desde la gestión (Safari, desde el mail). Volver a agregarlo después de reprogramar: Calendario de Apple debería actualizar el evento; el link de Google crea uno nuevo.
     - "Reservar otro turno" desde la gestión cae en `/turnos/`; un turno de las 21:00 o más tarde muestra el día correcto en la gestión.
     - Landing con y sin foto del local: el alto del hero y el degradado dentro de Instagram; sin botón de WhatsApp si no hay número; los links externos (Maps, WhatsApp, reseña) dentro de Instagram (si abren afuera, y si `wa.me` abre la app).
     - Tocar los días de la grilla con el dedo sin errarle al vecino (~50 px de ancho; ~45 en la reprogramación).
     - Lo cambiado el 2026-11-03 que solo se probó en el navegador: tipear el teléfono con `+54 9 …` o con `0…15` (no se traba en 10 dígitos); los datos del cliente siguen cargados al volver un paso y en "Reservar otro turno" desde el éxito; ningún botón ni tarjeta queda con el hover "pegado" después de tocarlo; con el teclado abierto, el pie fijo no tapa el campo enfocado ni su error; y la gestión del turno sin red (cancelar o reprogramar) muestra "No pudimos conectarnos…".
  4. **Prueba de los descansos en producción**, en el tenant demo (`demo.barbermanager.app`), para no tocar turnos de clientes de kingsai. Antes, renovar la suscripción de demo: venció el 2026-10-30, y desde el día 11 del mes el panel queda bloqueado (402). `UPDATE tenant SET suscripcion_vigente_hasta = '2027-12-31' WHERE subdominio = 'demo';`
     - App del barbero: la Agenda por slots, con las horas sin slots en gris. Marcar un descanso de dos slots y ver que el turnero de demo ya no los ofrece; liberarlo y ver que vuelven. Marcar un slot pegado a otro descanso: se ve un solo bloque.
     - Una ausencia nueva de 10:00 a 12:00, cargada desde el panel, se ve de 10:00 a 12:00 en la Agenda del barbero y en la del Turnero.
     - Panel: los descansos y ausencias en la Agenda del Turnero, con su detalle; Gestión → Barberos → Ausencias, "Liberar". Planillas: la columna "Descansos", la sección del modal del barbero, la hoja "Descansos" del Excel, "Con turno" en el Resumen y "Cliente" en el Detalle.
     - iPad (Safari): cobrar un turno reservado lo deja completado. En los tres flujos, el botón de confirmar se ve sin scrollear, también con un resumen largo (una venta con varios productos).
     - En kingsai, solo mirar: la Agenda de un barbero y las Planillas de la semana.
  5. **Regresión:** crear un turno desde la app del barbero (usa `/disponibilidad` con `barbero_id`).
  6. Si el `.ics` no abre dentro de Instagram: evaluar adjuntarlo al mail de confirmación.
- **Subdominio viejo `kingsai.barbermanager.app` (anotado 2026-11-05, decidir según los logs).** Desde el rename a `kingsaistudio` (2026-08-16), el host viejo sigue vivo: el wildcard de Vercel lo sirve, pero el backend no lo reconoce. Un link de reserva viejo de un cliente, o un bookmark del dueño o de un barbero, cae ahí y ve "No encontramos este local" (turnero) o "No hay un local activo en esta dirección" (panel y app del barbero). No se redirige desde `frontend/vercel.json`: eso metería el subdominio de un tenant en el código compartido. Después del deploy, mirar los logs de Railway:
  - Si aparece `[tenantMiddleware] … subdominio no resuelve a un tenant activo | subdominio: kingsai`, hay links viejos en circulación. Se resuelve en el dashboard de Vercel, sin código: asignar `kingsai.barbermanager.app` como dominio exacto del proyecto del panel, con redirect 308 a `kingsaistudio.barbermanager.app`. Es el mismo mecanismo que `www` → apex, y Vercel mantiene la ruta (`/turnos/...`, `/barbero`, `/turnos/gestionar/<token>`).
  - Si no aparece en unas semanas, se descarta.
- **Sacar el alias `DELETE /api/admin/suspensiones/:id` en un deploy posterior al merge.** Liberar es `POST /api/admin/suspensiones/:id/liberar`; el `DELETE` queda, con el mismo handler, para los fronts anteriores. Cuando los dos fronts nuevos estén en producción y el iPad y los celulares recargados, borrar la línea del `DELETE` de `backend/src/routes/suspensiones.js`.
- **Alerta en el Inicio del panel: turnos que ya terminaron y siguen reservados.** Desde que un turno se completa solo con su corte ([`decisiones_descansos.md`](./decisiones_descansos.md)), un turno al que el cliente vino pero que no se cobró sobre el turno (o al que faltó y nadie lo marcó) queda reservado para siempre. Una alerta en el Inicio le avisaría al dueño. Preguntas abiertas:
  1. **Criterio:** recomendado, `fin < ahora` (el turno ya terminó entero).
  2. **Alcance:** solo los de hoy, o también los de días anteriores.
  3. **Qué acción ofrece:** ir al turno en el Turnero, completarlo, marcarlo como "no asistió".
  4. **Cada cuánto se refresca:** al cargar el Inicio, o cada cierto tiempo con la pantalla abierta.
- **Base de clientes — próxima feature, con su propio plan** (el usuario quiere tratarla en detalle; conviene encararla apenas salga el rediseño del turnero, mientras casi nadie lo usa). Alcance conversado: identidad del cliente por teléfono, con el E.164 con el 9 en Argentina (hoy se guarda sin él); unificar duplicados (el barbero crea un cliente nuevo por cada turno sin email); asociar a un cliente los cortes sin turno; ficha del cliente en el panel (visitas, faltas, cancelaciones, gasto, barbero habitual, origen, reseña pedida o marcada a mano); conteo de escaneos del QR. Google no informa qué cliente dejó la reseña.
- **(opcional) Mails del turnero en negro.** Los mails siguen con el botón indigo de Luz; pasarlos al negro del turnero es un cambio chico en `backend/src/services/mail/mailer.js`.
- **Comisión del barbero con una barra de 5 en 5 (idea, 2026-11-03).** En Gestión → Barberos, el % se cargaría con una barra que va de 0 a 100 de a 5, en vez de un número libre, para evitar % con decimales y los centavos que generan al redondear. Hoy el backend acepta cualquier número de 0 a 100 (`gestion.js`) y la comisión de cada corte se redondea a centavos (`backend/src/utils/comision.js`). Si se hace, conviene que el backend valide el múltiplo de 5 también.
- **Balances — separar servicios y productos en el histórico (analizar después del deploy de los modales de detalle).** `GET /balances/historico` trae servicios y productos sumados dentro de `ingresos_brutos`, así que el modal del mes los muestra en un solo renglón ("Servicios y productos" = ingresos brutos − otros ingresos). Opción: que el endpoint devuelva también `ingresos_servicios` e `ingresos_productos` (campos nuevos, no rompen nada) y el modal los muestre por separado, como el mensual.
- **Landing para IA — verificación en producción.** El branch `feature/landing-ia` está en producción desde el push del 2026-10-01. Comprobado el 2026-11-04 con `curl`: `curl -A GPTBot https://barbermanager.app/` trae la página con el JSON-LD; `robots.txt`, `sitemap.xml`, `llms.txt` y `og-image.png` responden 200; y Vercel Web Analytics está activo (`/_vercel/insights/script.js` responde 200). Falta, sin confirmar:
  1. Pasar el Rich Results Test y validator.schema.org.
  2. Revisar la vista previa del link en WhatsApp.
  3. Hacer las acciones fuera del sitio (Search Console, Bing Webmaster Tools, directorios).

  Detalle en [`decisiones_landing_ia.md`](./decisiones_landing_ia.md).
- **Color de montos — llevarlo a los otros fronts.** La regla (verde solo en resultados, rojo en salidas, ningún monto en indigo) está en [`sistema_de_disenio.md`](./sistema_de_disenio.md) §3.1.1 y aplicada en el panel de gestión desde el 2026-10-01 y en la app del barbero (`MiPlanilla`) desde el 2026-10-19. `fmtPesos` es igual en los cuatro fronts desde el 2026-11-03 (`$ 8.000`, `-$ 130.000`). Falta (ya se puede: `feature/descansos-agenda` salió con el `muted` y el `fmtPesos` nuevos): volver a sacar la captura de Planillas de la landing (`frontend-landing/public/screenshots/seccionPlanillas.jpg`) y regenerar la `og-image.png`, que la usa (`scripts/og-image.html`): hoy muestran los totales en indigo.
- **Caja — Tabs 2 y 3 (Cierre de caja + Historial):** postergado. No hay plan escrito; si se retoma, branch sugerido `feature/cierre-caja` (implicaría `ALTER TABLE cierre_caja` con columnas de saldo inicial — `efectivo_inicial`, `mp_inicial`, etc.).
- **Log de actividad:** registrar quién eliminó qué y cuándo (hoy las eliminaciones no dejan rastro).
- **Generación de QR de Mercado Pago** para cobro en el momento desde el iPad.
- **Envío de planillas/datos por WhatsApp.**
- **Entregabilidad de mail (time-gated, no bloquea nada):** Fase 6 DMARC — endurecer de `p=none` a `quarantine` y luego `reject` tras 1–2 semanas de reportes 100% alineados; re-test de Outlook tras warmup (hoy los mails con link caen a Junk por reputación de dominio nuevo); seguir MXToolbox + Google Postmaster. Detalle histórico en [`decisiones_mail_entregabilidad.md`](./decisiones_mail_entregabilidad.md).
- **Recordatorio de turno — activación en kingsai (opt-in):** prender `configuracion.recordatorio = { "activo": true }` en el tenant cuando se decida. Ojo: los barberos de kingsai tienen `email = NULL` (no sincroniza Calendar), pero los clientes sí reciben el recordatorio → flip deliberado. (Opcional) índice parcial sobre `turno` y correr el lote 2×/día si crece el volumen. Detalle en [`decisiones_mail_recordatorio.md`](./decisiones_mail_recordatorio.md).
- **Validar en prod las optimizaciones de backend de performance** (ya implementadas, impacto a confirmar): keep-alive del pool (`db.js` + `index.js`) y `getTenant` paralelizado. Medir en frío contra Railway. Detalle en [`performance_frontends.md`](./performance_frontends.md).

---

## Deudas técnicas conocidas

- **Evaluar separar credenciales del tenant a una tabla `tenant_credenciales` (1:1).** Hoy la tabla `tenant` mezcla datos públicos (nombre, contacto) con secretos: `pin_admin`, `operativo_usuario`, `operativo_password_hash`, `operativo_token_version`. Un `SELECT *` o un endpoint que devuelva el tenant arrastra esos secretos a cualquier consulta general — riesgo de fuga. La idea es mover esas 4 columnas a una tabla `tenant_credenciales` con FK 1:1, de modo que las queries públicas no las toquen nunca. No es por tamaño de la tabla (es normal) sino por higiene de seguridad. Refactor con impacto en backend (auth, middleware operativo): merece su propio branch/chat.
- **Duplicación parcial de endpoints `/api/barberos` y `/api/turnero/barberos`:** ambos devuelven `{id, nombre}` filtrados por tenant. El primero es operativo (JWT), el segundo público para el wizard del cliente y el selector pre-PIN de la app del barbero. La duplicación es aceptable porque cada uno sirve una audiencia distinta (autenticada vs anónima). Los dos usan `listarBarberosActivos` (`services/barberosService.js`). Si en el futuro el endpoint público gana campos extra (foto, especialidad) que no quieran exponerse autenticadamente, la separación se justifica sola. `/api/servicios`, `/api/productos` y `/api/categorias` ya no tienen contraparte pública — quedaron limpios.
- **`POST /api/turnero/turnos`, `/reprogramar` y `POST /api/admin/turnos` no validan que `inicio` caiga en un slot real.** Sí validan el horario de atención del local y los feriados (`validarTurnoEnHorario` + `existeFeriado`) y, desde 2026-10-15, que no pisen una **suspensión o descanso vigente** del barbero (`NOT EXISTS` en la misma sentencia del `INSERT`/`UPDATE`, con el rango efectivo; [`decisiones_descansos.md`](./decisiones_descansos.md) → "Concurrencia"). Lo que sigue abierto: no validan el **bloque horario del barbero** ni la **grilla de slots**; para eso confían en `/api/turnero/disponibilidad` + el frontend. El constraint EXCLUDE GIST protege contra solapamientos con otros turnos, pero un `inicio` fuera del bloque del barbero o desalineado se aceptaría si no choca con otro turno. Blindar requeriría reejecutar el algoritmo en cada POST. Postergado.
- **(2026-06-11) — `POST /api/turnero/turnos` sin idempotency key — turno huérfano posible en el reintento de conexión (raro).** El helper `query()` (`config/db.js`) reintenta una vez ante errores de conexión (ver commit de esta fecha). En la ventana angosta en que un socket muere *después* de que la DB commitea el INSERT del turno pero *antes* de entregar el resultado, el reintento reejecuta el INSERT → choca con el constraint EXCLUDE GIST (`23P01`) → el cliente recibe 409 "slot ocupado" aunque su turno **sí** quedó creado (sin mail de confirmación ni evento de Calendar, porque el 409 corta antes del best-effort). **Integridad intacta** (el constraint impide el doble turno); es CX confuso, no corrupción. Pasa igual sin el reintento (el usuario reintentaría a mano y caería en el mismo 409), así que el reintento no lo empeora. **Fix pro:** idempotency key por intento de reserva (el front manda un id único, el back devuelve el mismo turno en vez de reintentar el INSERT). Bajo riesgo en prod (conexiones rápidas y estables, salto corto Railway↔Supabase — ver `performance_frontends.md`). Postergado.
- **Upsert de cliente pisa `nombre/telefono`** con los últimos datos enviados. Aceptado para MVP, pantalla de unificación de clientes pendiente. Entra en la feature "Base de clientes" (Pendientes).
- **El path `/turnos/gestionar/` está escrito en dos lugares.** Backend (`turnosService.js#armarLinkGestion`) y `frontend-turnero/src/utils/rutas.js` (`rutaGestion` / `extraerTokenGestion`, la única fuente del turnero desde 2026-10; antes eran tres lugares). Si la ruta cambia hay que tocar los dos. Origen: un fix de 2026-05-20 — `armarLinkGestion` generaba `/turnos/:token` pero el frontend solo monta la pantalla de gestión con `/turnos/gestionar/:token`, así que el mail caía al wizard de reserva. Bajo riesgo, queda anotado.
- **Unificación / duplicación funcional en `/api/admin/clientes` (abierto).** La lectura de clientes (`clientes.js`) y el find-or-create del turnero (`turnosService.js`) viven separadas. La escalada horizontal (barbero↔barbero) y la vertical (operativo→admin) ya fueron auditadas/resueltas (commit `ca2fc96`).
- **Logger estructurado a futuro.** Hoy todo el logging del backend usa `console.log/warn/error` directo contra stdout, y Railway lo indexa así como está. Funciona porque el sistema es chico (1 backend, pocos tenants en producción). Cuando el volumen crezca — varios tenants activos, necesidad de filtrar por nivel/tenant/request_id, o integración con una plataforma de observability tipo Sentry/Datadog — corresponde migrar a un logger estructurado (Pino es la opción senior por performance; Winston si se prioriza ecosistema). Disparadores sugeridos: ≥3 tenants en producción, o necesitar filtrar por request_id. **(2026-11-06)** Sentry ya está (monitoreo de producción) y no cambió esto: captura los `console.error` tal como están, y el tenant le llega como tag desde los middlewares. No es convención, es decisión postergada hasta tener el problema real.
- **Lógica de subdominio y helpers de UI duplicados en los frontends.** La extracción de subdominio, `theme/tokens.js`, `index.css` y los primitivos universales están copiados en cada app Vite. `utils/fecha.js` y `utils/formato.js` no son copias: el panel y el turnero no comparten ninguna función de fecha, y lo que sí se repite son cinco funciones de fecha entre el barbero y el turnero, `fmtPesos` (copia idéntica del panel en los cuatro fronts desde el 2026-11-03) y `capitalizar` (detalle en `sistema_de_disenio.md` §8). Es el costo conocido de tener proyectos separados sin paquete compartido; ya pasó que una copia se actualizó y las otras no (la heurística de subdominio del panel, resuelta en la auditoría 2026-07, 7.2). Evaluar un workspace / paquete compartido si la divergencia se vuelve recurrente; por ahora queda anotado. El `tokens.js` y el `index.css` del turnero divergen **a propósito** desde 2026-10 (identidad propia, `sistema_de_disenio.md` §3.8): eso no es deuda.
- **Deudas diferidas de la auditoría 2026-07** (TOCTOU sistémico, idempotency keys para `venta`/`gasto`, defensa en profundidad de multi-tenancy, anti-abuso extra del turnero, monitoreo del pool, función almacenada de stock): aceptadas con rationale; el detalle vive en [`auditoria_2026-07.md`](./auditoria_2026-07.md) §Deudas diferidas.

- **(2026-06-11) — Rebote de overscroll de iOS asoma el fondo por detrás del footer del turnero (cosmético).** En Safari iOS, cuando el contenido supera el alto del viewport y el usuario hace overscroll en el **borde inferior**, el rebote elástico deja asomar el fondo de la app (`theme.bg`, casi blanco) por detrás del `StickyFooter` (`position: sticky; bottom: 0`), recortando visualmente el CTA. Reproducido en el turnero: `Landing` con la tabla de horarios desplegada y `GestionTurno` con el panel de reprogramar abierto (ambos casos en que el contenido se hace más alto que la pantalla). **Mitigación aplicada (commit de esta fecha):** `overscroll-behavior: none` en `html, body` (`frontend-turnero/src/index.css`) — desactivó el **pull-to-refresh** (objetivo principal: evitar que un arrastre accidental recargue y pierda el progreso del wizard) pero **no suprime del todo el rebote del borde inferior** en iOS (limitación conocida de `overscroll-behavior` sobre el scroll de documento en Safari). En la misma tanda, `PageContainer` pasó de `100vh` a `100dvh` para que el footer no quede tapado por la toolbar dinámica de Safari. **Estado:** queda como glitch cosmético menor, **sin pérdida de datos**. **Fix definitivo:** layout "app-shell" (el documento no scrollea; solo scrollea una zona interna; el footer es hijo fijo, no `sticky`). Descartado por ahora por el riesgo de regresión en las pantallas con formulario (el teclado de iOS y los scrollers internos se llevan mal) — retomar en una pasada deliberada de "sensación nativa" con testeo de las pantallas de formulario.

Deudas detectadas durante la feature de movimientos extra (2026-09-30), verificadas contra los docs:

- **Cantidades `bigint` como texto:** desde 2026-11-02 todos los montos de la API salen como número (`convenciones_tecnicas.md` §4), también `updateGasto`, los `precio` de servicios y productos y el `comision_valor` de barberos y de Caja. Siguen como string los `bigint` de los totales de gastos y ventas (`cantidad` y `cantidad_total`): no son montos, y los fronts los pasan por `Number()`.
- **Propias de movimientos extra:** sin edición (corregir es borrar y volver a cargar) y sin pantalla de alta de socios (se cargan por SQL, ver `onboarding.md`).
- **(nueva, 2026-10-01) — Landing: `linkWhatsApp()` y `linkEmail()` no manejan `null`.** El comentario de `config/landing.js` dice que la UI lo maneja, pero con `CONTACTO.whatsapp` en `null` los CTA armarían `https://wa.me/null?...` (los módulos de SEO sí lo cubren). Menor: hoy los valores están cargados.
- **(nueva, 2026-10-01) — Landing: datos de la competencia con fecha.** El bloque "¿Y frente a otras apps de turnos?" y la FAQ 5 afirman cosas de Fresha, Booksy y Setmore relevadas el 01/10/2026. Revisarlas cada tanto (o si cambian sus precios) y actualizar la nota al pie. Cómo, en [`decisiones_landing_ia.md`](./decisiones_landing_ia.md).

Deudas detectadas durante el rediseño del turnero (2026-10), verificadas contra los docs. Las de UI y accesibilidad están en [`sistema_de_disenio.md`](./sistema_de_disenio.md) §9 (#9 y #18).

- **Celulares argentinos en E.164 sin el 9** (`+5411…`). Hay que decidirlo antes de usar el teléfono del cliente para mensajes de WhatsApp (que usan `+549…`). Entra en "Base de clientes". Pariente: el `tel:` del local en la landing usa los dígitos tal cual están guardados, sin código de país (anda marcando desde Argentina).
- **Turnero, carga:**
  - Sin foto del local, el hero mide ~182 px contra los `45svh` del skeleton y salta al cargar. Aceptado: el skeleton no sabe si hay foto.
  - La gestión del turno espera el tenant de `App` antes de montarse: la columna queda en blanco y después aparece el skeleton. El skeleton ya tiene los mismos bloques que el contenido (desde el 2026-11-03, no salta).
- **Turnero, reintento del 409:** con "Cualquier barbero" suma un POST al límite de 3 por minuto: dos intentos fallidos seguidos pueden dar 429 antes. Raro.
- **(aceptada, 2026-11-03) — Cada 409 al reservar deja un cliente sin turno.** `crearTurno` (`controllers/turnero.js`) crea o actualiza el cliente antes de intentar el turno, así que si el horario se ocupó el cliente queda guardado sin turno. No se ve en ninguna pantalla (el listado de clientes sale de los turnos). Entra en la feature "Base de clientes" (Pendientes), que reescribe esa parte.

Deudas detectadas durante la Feature 1 de la app del barbero (2026-10-15 / 2026-10-29), verificadas contra los docs. Decisiones de la feature en [`decisiones_descansos.md`](./decisiones_descansos.md).

- **El % de la jornada del registro de descansos usa el horario actual del barbero.** No hay historial de `barbero_horario`: en una semana pasada en la que el barbero tenía otro horario, el divisor es el de hoy y el % es aproximado. Arreglarlo requiere guardar el horario por vigencia (fecha desde / hasta).

### Deudas vivas del frontend del panel (consolidadas del registro archivado)

El rediseño del panel de gestión cerró todas sus deudas accionables; quedan estas, **todas de prioridad baja**. Historia completa de cómo se resolvió cada deuda del rediseño en [`deudas_tecnicas_frontend.md`](./deudas_tecnicas_frontend.md) (archivado). Se conservan los números `#NN` originales para las referencias cruzadas en commits y docs.

- **#27 (aceptada) — Semántica engañosa de la columna comisión del subtotal del día** (`SeccionPlanillas`, tab Detalle). El `thead` no tiene columna "Comisión"; el slot "Pago" del `tfoot` muestra `comisión + propinas` sin label explícito (solo el eyebrow mono indica `XX% + prop`). Mantenido a pedido del usuario durante el rediseño. Revisitar como mejora UX si aparece pedido: (a) fila aparte "Comisión del día" + "A pagar al barbero", o (b) columna "Comisión" en el thead. **(2026-09-30)** En el Resumen, la columna "Comisión" pasó a llamarse "A pagar" (con la pista `XX% + prop`), y la columna del Excel de los dos tabs pasó a "A pagar ($)". Así "comisión" queda solo para la comisión sin propinas, como en Balances y en el modal de detalle. El tab Detalle en pantalla sigue como se describe acá.
- **#28 (aceptada) — Acoplamiento sutil entre tabs en `SeccionPlanillas`.** `infoComisionActiva` se deriva de `resumenData` pero se consume en el tab Detalle: desde el 2026-11-03 la comisión del día sale de los cortes del detalle (la manda el backend), y del resumen solo se toma si mostrar el pago del día y el % de respaldo. El `Promise.all` que carga ambos endpoints en paralelo lo garantiza hoy. Si se separan los fetches (lazy load por tab), el Detalle quedaría sin el pago del día hasta que cargue el Resumen. **(2026-09-30)** Ahora también al revés: el modal de detalle del Resumen (`ModalDetalleBarbero`) usa los cortes de `detalleData` para el total por día y por forma de pago. Si se separan los fetches, hay que cargar los dos antes de abrirlo.
- **#42 (aceptada) — `BloqueFeriados` con overflow propio.** `max-height:260` + `overflowY:auto` en la lista: divergencia consciente de la convención "las secciones no tienen overflow propio", justificada porque la lista de feriados es de largo variable dentro del bloque sin scroll de `TabNegocio`. Revisar si en el futuro el panel de Gestión pasa a scrollear normalmente.
- **#43 (aceptada / nota de producto) — Nombre del negocio + URL de reservas sin self-service** (`TabNegocio`). Se removió el formulario de esos dos campos (se editan directo en la DB porque cambian muy poco); el endpoint `GET/PUT /admin/negocio` sigue existiendo y `App.jsx`/`PanelAdmin` leen el nombre. Si el producto se vende a terceros que quieran renombrar su negocio o cambiar la plataforma de turnos sin tocar la DB, reponer un formulario mínimo.
- **(aceptada, 2026-11-03) — Con el iPad vertical, el Resumen semanal de Planillas y el Histórico de Balances siguen más anchos que su tarjeta.** Por debajo de 1024 px el resto de las tablas del panel entra (`usePantallaAngosta`, `sistema_de_disenio.md` §4.6), pero estas dos tienen muchas columnas numéricas y quedan algunas fuera de la vista. Aceptado porque tocar la fila abre el detalle (del barbero o del mes) con todas las cifras.

*— Fin del documento —*
