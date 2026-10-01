# Estado actual del proyecto

Última actualización: 2026-10-01 (landing pre-renderizada y lista para IA: SSG, robots, sitemap, JSON-LD, `llms.txt`, `og-image`, Vercel Analytics y copy nuevo; pendiente de deploy). Antes, 2026-09-30: movimientos extra (aportes, retiros y otros ingresos), RLS en todas las tablas y modales de detalle en Planillas y Balances. **Go-live del turnero mergeado a `main` y en producción** (`kingsaistudio.barbermanager.app`): turnero del cliente, app del barbero, acceso de barberos al panel, horario de atención + feriados y rediseño del panel de gestión, todo live. Backend fijado a **Node 22** en Railway (supabase-js v2 necesita WebSocket nativo — ver post-mortem en [`postmortem_golive_turnero.md`](./postmortem_golive_turnero.md)). El mailer de Resend está activo tanto en el web service como en el cron. **(2026-06-15) Landing de marketing en producción** en `barbermanager.app` (apex canónico, `www` redirige). Quedan solo residuales operativos/time-gated de entregabilidad de mail — ver Pendientes.

Para convenciones de código, ver [`/docs/convenciones_tecnicas.md`](./convenciones_tecnicas.md).

---

## Stack

- **Frontend:** React + Vite, inline styles + módulo `theme` (design tokens), fuente Geist, acento indigo. Los cuatro fronts (gestión, turnero, barbero, landing) usan el sistema de diseño "Luz" (ver `docs/sistema_de_disenio.md`). El verde `#1a7a4a` + DM Sans del scaffold original quedaron deprecados con el rediseño.
- **Backend:** Node.js + Express, ES Modules (`import/export`).
- **DB:** PostgreSQL via Supabase Session Pooler.
- **Auth:** bcrypt + JWT. Token del panel (admin o barbero) en memoria (`let authToken` en `frontend/src/services/api.js`; `App.jsx` lo setea con `setAuthToken`). Token operativo en `localStorage` con clave `token_operativo` (sobrevive al reload del iPad). Token barbero **en memoria** (módulo `api.js` de `frontend-barbero`, `let authToken`) — no persiste en `localStorage`, así que un reload obliga a re-loguear por PIN. Único token en `localStorage`: el operativo.

---

## Deploy

### Backend — Railway
- URL: `https://sistemagestionbarberia-production.up.railway.app`
- Root Directory: `/backend`
- Start command: `node src/index.js`
- Variables de entorno: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `NODE_ENV=production`, `PORT=3000`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_EMAIL`, `RESEND_API_KEY`, `MAIL_FROM`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Storage de imágenes, `config/supabase.js`). **`PLATFORM_ADMIN_KEY`** (opcional) habilita el endpoint de plataforma `POST /api/plataforma/cache/invalidate`; **sin setear por ahora a propósito** → el endpoint responde 503 (fail-safe). Setearla recién al usar el endpoint en prod (dispara autodeploy; hacerlo en momento de poco tráfico).
- **Dos servicios Railway:** el **web service** (esta API) y un **servicio cron** de recordatorios (`node src/jobs/recordatorios.js`), ambos deployando de `main`. `RESEND_API_KEY` + `MAIL_FROM` están como **shared variables** referenciadas en los dos, así que el mailer de Resend está activo en ambos.
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
  | `/api/admin/{turnos, horarios, suspensiones, clientes, planilla}` | admin, barbero (el controller scopea por barbero) |
  | `/api/admin/{barberos, servicios, productos, negocio, turnero/config, operativo, feriados, imagenes, socios}` | admin |
  | `/api/admin/horario-atencion` (dentro del router) | `GET`: admin, barbero · `PUT`: admin |
  | `POST /api/plataforma/cache/invalidate` | fuera de tenant/JWT; header `X-Platform-Key` |

  Frontend gestión: `PantallaLoginOperativo` precede al MainScreen cuando no hay `token_operativo` en localStorage; `apiFetchOperativo` (`services/api.js`) inyecta el token operativo y ante 401 redirige al login. El tab `Seguridad` de SeccionGestion cambia PIN admin, usuario operativo y password operativa.
- Bloqueo/aviso por suscripción ✅ mergeado a `main`.
- Multi-tenancy por subdominio ✅ en producción (`kingsaistudio.barbermanager.app`).
- Migración de schema `refactor/schema-corte` ✅ mergeado a `main`.

---

## Pendientes

- **Movimientos extra — migrar los retiros históricos de Kingsai.** Hasta el 2026-09-30 los retiros de los dueños se cargaban como gasto (categoría "Otros"). Hay que pasarlos a `movimiento_extra` con su dueño, con la feature ya deployada: filas elegidas a mano, `INSERT … SELECT` + `DELETE` en una sola ejecución del SQL editor, con respaldo en CSV. Hasta entonces, la ganancia de esos meses sigue descontando los retiros. Detalle en [`decisiones_movimientos_extra.md`](./decisiones_movimientos_extra.md).
- **Balances — separar servicios y productos en el histórico (analizar después del deploy de los modales de detalle).** `GET /balances/historico` trae servicios y productos sumados dentro de `ingresos_brutos`, así que el modal del mes los muestra en un solo renglón ("Servicios y productos" = ingresos brutos − otros ingresos). Opción: que el endpoint devuelva también `ingresos_servicios` e `ingresos_productos` (campos nuevos, no rompen nada) y el modal los muestre por separado, como el mensual.
- **Landing para IA — deploy y verificación en producción.** El branch `feature/landing-ia` está mergeado a `main` local; sale con el próximo push. Antes del push: activar Vercel Web Analytics en el proyecto de la landing (Analytics → Enable). Después:
  1. Verificar que `curl -A GPTBot https://barbermanager.app/` traiga la página completa con el JSON-LD.
  2. Verificar que `robots.txt`, `sitemap.xml`, `llms.txt` y `og-image.png` respondan 200.
  3. Pasar el Rich Results Test y validator.schema.org.
  4. Revisar la vista previa del link en WhatsApp.
  5. Hacer las acciones fuera del sitio (Search Console, Bing Webmaster Tools, directorios).

  Detalle en [`decisiones_landing_ia.md`](./decisiones_landing_ia.md).
- **Caja — Tabs 2 y 3 (Cierre de caja + Historial):** postergado. No hay plan escrito; si se retoma, branch sugerido `feature/cierre-caja` (implicaría `ALTER TABLE cierre_caja` con columnas de saldo inicial — `efectivo_inicial`, `mp_inicial`, etc.).
- **Log de actividad:** registrar quién eliminó qué y cuándo (hoy las eliminaciones no dejan rastro).
- **Generación de QR de Mercado Pago** para cobro en el momento desde el iPad.
- **Envío de planillas/datos por WhatsApp.**
- **Entregabilidad de mail (time-gated, no bloquea nada):** Fase 6 DMARC — endurecer de `p=none` a `quarantine` y luego `reject` tras 1–2 semanas de reportes 100% alineados; re-test de Outlook tras warmup (hoy los mails con link caen a Junk por reputación de dominio nuevo); seguir MXToolbox + Google Postmaster. Detalle histórico en [`decisiones_mail_entregabilidad.md`](./decisiones_mail_entregabilidad.md).
- **Recordatorio de turno — activación en kingsai (opt-in):** prender `configuracion.recordatorio = { "activo": true }` en el tenant cuando se decida. Ojo: los barberos de kingsai tienen `email = NULL` (no sincroniza Calendar), pero los clientes sí reciben el recordatorio → flip deliberado. (Opcional) índice parcial sobre `turno` y correr el lote 2×/día si crece el volumen. Detalle en [`decisiones_mail_recordatorio.md`](./decisiones_mail_recordatorio.md).
- **Validar en prod las optimizaciones de backend de performance** (ya implementadas, impacto a confirmar): keep-alive del pool (`db.js` + `index.js`) y `getTenant` paralelizado. Medir en frío contra Railway. Detalle en [`performance_frontends.md`](./performance_frontends.md).

---

## Deudas técnicas conocidas

- **Claves sin uso en `tenant.configuracion`:** la columna sí se usa (`recordatoriosService.js` lee `configuracion.recordatorio.activo`), pero las claves `ciudad` y `moneda` que `crearTenant.js` setea por default no las lee ningún código. Evaluar si se eliminan del default o si son para uso futuro.
- **`crearTenant.js` no crea las credenciales operativas.** Un tenant recién creado no puede pasar `PantallaLoginOperativo` hasta que se corre `generarHashOperativo.js`, que tiene tenant/usuario/password como constantes a editar a mano (ver `onboarding.md` → Paso 2). Fix: que `crearTenant.js` reciba usuario/password operativos, o que el script tome argumentos.
- **`gasto.created_at` redundante con `gasto.timestamp`:** el DROP que planeaba el schema del turnero (2026-05) se postergó. Cuando se retome, decidir si se elimina, se renombra o se le asigna un propósito.
- **Evaluar separar credenciales del tenant a una tabla `tenant_credenciales` (1:1).** Hoy la tabla `tenant` mezcla datos públicos (nombre, contacto) con secretos: `pin_admin`, `operativo_usuario`, `operativo_password_hash`, `operativo_token_version`. Un `SELECT *` o un endpoint que devuelva el tenant arrastra esos secretos a cualquier consulta general — riesgo de fuga. La idea es mover esas 4 columnas a una tabla `tenant_credenciales` con FK 1:1, de modo que las queries públicas no las toquen nunca. No es por tamaño de la tabla (es normal) sino por higiene de seguridad. Refactor con impacto en backend (auth, middleware operativo): merece su propio branch/chat.
- **Duplicación parcial de endpoints `/api/barberos` y `/api/turnero/barberos`:** ambos devuelven `{id, nombre}` filtrados por tenant. El primero es operativo (JWT), el segundo público para el wizard del cliente y el selector pre-PIN de la app del barbero. La duplicación es aceptable porque cada uno sirve una audiencia distinta (autenticada vs anónima). Si en el futuro el endpoint público gana campos extra (foto, especialidad) que no quieran exponerse autenticadamente, la separación se justifica sola. `/api/servicios`, `/api/productos` y `/api/categorias` ya no tienen contraparte pública — quedaron limpios.
- **Mailing del turnero — migrado a Resend (API HTTP vía `fetch`), dominio propio autenticado (SPF/DKIM/MX) y DMARC `p=none` publicado; en producción.** Capa de proveedor en `services/mail/`. Decisiones y rationale en [`decisiones_mail_entregabilidad.md`](./decisiones_mail_entregabilidad.md); residuales time-gated (endurecer DMARC, re-test Outlook) en Pendientes.
- **`POST /api/turnero/turnos`, `/reprogramar` y `POST /api/admin/turnos` no validan que `inicio` caiga en un slot real.** Sí validan el horario de atención del local y los feriados (`validarTurnoEnHorario` + `existeFeriado`), pero no el bloque horario del barbero, sus suspensiones ni la grilla de slots: para eso confían en `/api/turnero/disponibilidad` + el frontend. El constraint EXCLUDE GIST protege contra solapamientos con otros turnos, pero un `inicio` fuera del bloque del barbero o sobre una suspensión se aceptaría si no choca con otro turno reservado. Blindar requeriría reejecutar el algoritmo en cada POST. Postergado.
- **(2026-06-11) — `POST /api/turnero/turnos` sin idempotency key — turno huérfano posible en el reintento de conexión (raro).** El helper `query()` (`config/db.js`) reintenta una vez ante errores de conexión (ver commit de esta fecha). En la ventana angosta en que un socket muere *después* de que la DB commitea el INSERT del turno pero *antes* de entregar el resultado, el reintento reejecuta el INSERT → choca con el constraint EXCLUDE GIST (`23P01`) → el cliente recibe 409 "slot ocupado" aunque su turno **sí** quedó creado (sin mail de confirmación ni evento de Calendar, porque el 409 corta antes del best-effort). **Integridad intacta** (el constraint impide el doble turno); es CX confuso, no corrupción. Pasa igual sin el reintento (el usuario reintentaría a mano y caería en el mismo 409), así que el reintento no lo empeora. **Fix pro:** idempotency key por intento de reserva (el front manda un id único, el back devuelve el mismo turno en vez de reintentar el INSERT). Bajo riesgo en prod (conexiones rápidas y estables, salto corto Railway↔Supabase — ver `performance_frontends.md`). Postergado.
- **Upsert de cliente pisa `nombre/telefono`** con los últimos datos enviados. Aceptado para MVP, pantalla de unificación de clientes pendiente.
- **Título del evento de Google Calendar** está hardcodeado como `${cliente.nombre} — ${servicio.nombre}` en `services/googleCalendar.js#armarCuerpoEvento`. Pedido cambiarlo a solo `cliente.nombre` (pendiente).
- **`adminOperativo.actualizarCredencialesOperativas` no chequea `rowCount`.** El UPDATE devuelve 204 incluso si el `tenant_id` no existe (en la práctica `tenantMiddleware` ya lo blinda, pero el endpoint sería más honesto con un `rowCount === 0 → 404`). Cosmético.
- **El path `/turnos/gestionar/` está hardcodeado en tres lugares.** Backend (`turnosService.js#armarLinkGestion`), `frontend-turnero/src/App.jsx` (regex `extraerTokenDeURL`) y `frontend-turnero/src/screens/Confirmacion.jsx` (redirección post-reserva). Si la ruta cambia hay que tocar dos repos. Origen: un fix de 2026-05-20 — `armarLinkGestion` generaba `/turnos/:token` pero el frontend solo monta la pantalla de gestión con `/turnos/gestionar/:token`, así que el mail caía al wizard de reserva. Bajo riesgo, queda anotado.
- **La restricción "no completar turnos futuros" es solo client-side.** `frontend-barbero` oculta las acciones "completar"/"no asistió" para turnos cuyo `inicio` todavía no pasó, pero `PATCH /api/admin/turnos/:id/estado` no valida la antelación: una request directa podría marcar `completado` un turno futuro. Blindar requeriría un check de `inicio <= now()` en `turnosService`. Bajo riesgo (la UI ya lo previene), pero queda anotado.
- **Unificación / duplicación funcional en `/api/admin/horarios|suspensiones|clientes` (abierto).** (a) `barbero_horario` tiene dos escritores (`horariosService` y la cascada de `horarioAtencionService`); (b) el idiom de scoping `req.rol === 'barbero' ? req.barbero_id : <param>` está duplicado en ~6 handlers → candidato a centralizar en un helper/middleware; (c) la lectura de clientes (`clientes.js`) y el find-or-create del turnero (`turnosService.js`) viven separadas. La escalada horizontal (barbero↔barbero) y la vertical (operativo→admin) ya fueron auditadas/resueltas (commit `ca2fc96`).
- **Logger estructurado a futuro.** Hoy todo el logging del backend usa `console.log/warn/error` directo contra stdout, y Railway lo indexa así como está. Funciona porque el sistema es chico (1 backend, pocos tenants en producción). Cuando el volumen crezca — varios tenants activos, necesidad de filtrar por nivel/tenant/request_id, o integración con una plataforma de observability tipo Sentry/Datadog — corresponde migrar a un logger estructurado (Pino es la opción senior por performance; Winston si se prioriza ecosistema). Disparadores sugeridos: ≥3 tenants en producción, o contratación de Sentry/equivalente. No es convención, es decisión postergada hasta tener el problema real.
- **Lógica de subdominio y helpers de UI duplicados en los frontends.** La extracción de subdominio, `theme/tokens.js`, `utils/fecha.js`, `utils/formato.js`, `index.css` y los primitivos universales están copiados en cada app Vite. Es el costo conocido de tener proyectos separados sin paquete compartido; ya pasó que una copia se actualizó y las otras no (la heurística de subdominio del panel, resuelta en la auditoría 2026-07, 7.2). Evaluar un workspace / paquete compartido si la divergencia se vuelve recurrente; por ahora queda anotado.
- **Deudas diferidas de la auditoría 2026-07** (TOCTOU sistémico, idempotency keys para `venta`/`gasto`, defensa en profundidad de multi-tenancy, anti-abuso extra del turnero, recorte de PII en `getTurnoPorToken`, warning de pg@9, monitoreo del pool, función almacenada de stock): aceptadas con rationale; el detalle vive en [`auditoria_2026-07.md`](./auditoria_2026-07.md) §Deudas diferidas.
- **(2026-09-29) — `TZ` redeclarada localmente** en `controllers/inicio.js:6` y `services/googleCalendar.js:9`, contra convenciones §4 (importar de `utils/constantes.js`). Mismo valor, sin impacto funcional. Migrarlas al import la próxima vez que se toquen.
- **(2026-09-29) — Comentarios de código que citan secciones inexistentes de `performance_frontends.md`:** `config/db.js` (`iniciarKeepAlive`, "§5-bis") e `index.js` (`startServer`, "§7 #1"). El doc se resumió y esas secciones ya no existen. Cambiar la cita al nombre del doc sin sección.
- **(2026-09-29) — Default de `PUBLIC_BASE_URL` apunta al puerto equivocado.** `turnosService.js` (`construirLinkGestion`, `armarLinkTurnero`) usa `http://localhost:5173` cuando el request no trae subdominio (solo pasa en dev), pero 5173 es el panel de gestión; el turnero corre en 5175. En dev, los links de los mails caen en la app equivocada salvo que se setee `PUBLIC_BASE_URL`. Sin impacto en producción. Fix: default `http://localhost:5175`.
- **SELECT enriquecido de turno casi duplicado en tres lugares** (ex DT-2 de `decisiones_mail_recordatorio.md`): `enriquecerTurno`, el lookup de `cancelarTurnoPorId` y la query del recordatorio comparten casi las mismas columnas/JOINs. Candidato a centralizar (fragmento o vista). No bloqueante.
- **`cancelarTurnoPorId` no selecciona `tn.direccion`** (ex DT-3; `turnosService.js`, verificado 2026-09-29): `construirContextoMail` arma `tenant.direccion` desde `fila.tenant_direccion`, que en ese camino llega `undefined`. Hoy no rompe (`filaDireccion` devuelve null), pero el mail de cancelación sale sin dirección y el contrato es frágil. Fix: sumar la columna al SELECT.

- **(2026-06-11) — Rebote de overscroll de iOS asoma el fondo por detrás del footer del turnero (cosmético).** En Safari iOS, cuando el contenido supera el alto del viewport y el usuario hace overscroll en el **borde inferior**, el rebote elástico deja asomar el fondo de la app (`theme.bg`, casi blanco) por detrás del `StickyFooter` (`position: sticky; bottom: 0`), recortando visualmente el CTA. Reproducido en el turnero: `Landing` con la tabla de horarios desplegada y `GestionTurno` con el panel de reprogramar abierto (ambos casos en que el contenido se hace más alto que la pantalla). **Mitigación aplicada (commit de esta fecha):** `overscroll-behavior: none` en `html, body` (`frontend-turnero/src/index.css`) — desactivó el **pull-to-refresh** (objetivo principal: evitar que un arrastre accidental recargue y pierda el progreso del wizard) pero **no suprime del todo el rebote del borde inferior** en iOS (limitación conocida de `overscroll-behavior` sobre el scroll de documento en Safari). En la misma tanda, `PageContainer` pasó de `100vh` a `100dvh` para que el footer no quede tapado por la toolbar dinámica de Safari. **Estado:** queda como glitch cosmético menor, **sin pérdida de datos**. **Fix definitivo:** layout "app-shell" (el documento no scrollea; solo scrollea una zona interna; el footer es hijo fijo, no `sticky`). Descartado por ahora por el riesgo de regresión en las pantallas con formulario (el teclado de iOS y los scrollers internos se llevan mal) — retomar en una pasada deliberada de "sensación nativa" con testeo de las pantallas de formulario.

- **(2026-06-19) — Doble fetch del branding del tenant en el login del barbero.** `frontend-barbero/src/App.jsx` agrega un `useEffect` de arranque que pide `getTenant()` + `getImagenesNegocio()` para setear el favicon y el título del tab; `components/Login.jsx` ya pedía esos mismos dos endpoints para brandear su propia UI (logo + nombre). En la pantalla de login ambos corren → dos GET por endpoint. Son best-effort y el navegador cachea el GET, así que el costo es marginal. Se dejó así **a propósito** para no acoplar el branding del documento (favicon/título, que debe aplicar también con sesión activa) a la lógica de la pantalla de login. Fix si molesta: subir el fetch a un único punto (`App.jsx`) y pasar logo/nombre a `Login` por prop. Bajo riesgo, a analizar después.

- **(2026-09-29) — Comisión: decisión de negocio "siempre porcentaje"; el tipo `fijo` queda como resto latente.** **Por ahora no existen barberos con comisión fija: siempre es porcentual.** El schema admite `barbero.comision_tipo = 'fijo'` y la planilla lo calcula (`planillaService.resumenSemanal`, `SeccionPlanillas.calcularComisionDia`, `MiPlanilla.calcularComisionDia` en la app del barbero), pero Balances (`controllers/balances.js`, mensual e histórico) trata toda comisión como porcentaje y su columna "Comisión %" muestra `valor%`. Decisión (2026-09-29): las comisiones son siempre porcentaje. Verificado ese día: no hay barberos `fijo` en la DB, y la UI de Gestión no expone el tipo (solo se podría setear directo en la DB). **(2026-09-30) Además, con `fijo` las propinas no cierran:** el backend y `MiPlanilla` calculan `valor × cortes` sin propinas, pero el subtotal del día de Planillas (`BloqueDia`) y el Excel del Detalle les suman las propinas también con `fijo`; con un barbero `fijo`, los días no sumarían lo de la semana. Hoy no pasa por lo anterior. Si se quiere cerrar del todo: sacar `fijo` del CHECK del schema y de los cálculos de la planilla (anotado también en `SQL_Schema.md` y en los comentarios de esos cálculos).

- **(2026-09-29) — `barbero.activo` y `barbero.created_at` aceptan NULL** (y también `activo` en `servicio`, `producto` y `categoria_gasto`: `boolean DEFAULT true` sin `NOT NULL`). Un NULL no entra ni en `activo = true` ni en `activo = false`, y la regla de qué barberos listan Planillas y Balances usa las dos columnas de `barbero`. Verificado 2026-09-29: no hay NULLs en `barbero` (las otras tablas no se revisaron). Fix: `ALTER TABLE ... ALTER COLUMN ... SET NOT NULL`, que va directo a producción (hay una sola DB). Baja prioridad.

Deudas detectadas durante la feature de movimientos extra (2026-09-30), verificadas contra los docs:

- **`req.body` sin fallback (Express 5).** 27 handlers en 15 controllers desestructuran `req.body` directo; en Express 5 `req.body` es `undefined` si no llega body, así que un POST o PUT sin body tira `TypeError` y responde 500 en vez de 400. Arreglo para todos: un middleware después de `express.json()` que haga `req.body ??= {}`. Hoy solo `crearMovimientoExtra` y el endpoint de plataforma usan `req.body || {}`.
- **Borrar con un `id` que no es UUID da 500** en todas las ramas de `caja.eliminarMovimiento`: el `22P02` solo se maneja en los services.
- **`getCategorias` no filtra `activo`** (`controllers/categorias.js`), aunque su comentario dice "activas": desactivar una categoría no la saca del iPad. Ojo al arreglarlo: `categoria_gasto.activo` acepta NULL (ver la deuda de columnas nullables).
- **Gasto sin categoría:** Gastos usa `LEFT JOIN categoria_gasto` ("Sin categoría"), pero Balances mensual y Caja usan `JOIN` y lo pierden, y el histórico no hace join: los totales pueden no coincidir. Hoy el alta exige categoría, así que solo afecta filas viejas o cargadas a mano.
- **`gasto.categoria_id` no se valida contra el tenant** en `createGasto` / `updateGasto` (la auditoría cubrió barbero, servicio y producto). Riesgo bajo: hace falta conocer el UUID de una categoría ajena.
- **La comisión no queda guardada en el corte:** Balances y Planillas usan el % actual del barbero, así que cambiar el % de un barbero cambia los balances de meses pasados.
- **El borrado de gastos y ventas está implementado dos veces** (`gastos.js` / `ventas.js` y `caja.eliminarMovimiento`); la auditoría ya tuvo que arreglar el mismo bug en los dos lados.
- **`REGEX_FECHA` copiada en 5 controllers** (feriados, turnero, turnosOperativo, turnos, planilla). El código nuevo usa `esFechaISO` de `utils/validarFecha.js`; falta migrar esas copias.
- **Montos como texto:** varias respuestas viejas devuelven el `NUMERIC` de pg como string (`createGasto`, los listados de gastos y ventas); las de Caja, movimientos extra y Balances devuelven número. La regla quedó en `convenciones_tecnicas.md` §4; falta migrar las viejas.
- **`getBalanceHistorico` acepta `cantidad` negativa:** `?cantidad=-5` deja la ventana en el futuro y responde `[]` en vez de 400 o del valor por defecto.
- **Redondeo de comisiones distinto:** el mensual redondea la comisión por barbero y después suma; el histórico suma sin redondear. Pueden diferir en centavos. Desde el modal del histórico, "Ver el mes completo" lleva al mensual del mismo mes, así que la diferencia queda a un click (en pantalla se ve solo si cruza el redondeo a pesos enteros de `fmtPesos`).
- **Categorías de gasto por tenant, cargadas a mano.** `crearTenant.js` no crea categorías: se cargan por SQL (ver `onboarding.md`, Paso 2c), así que cada tenant tiene su propia copia de la misma lista base. Idea del usuario: una lista base común más categorías propias por cliente. El schema ya tiene `tenant_id` nullable y `es_default`, pero `getCategorias` solo trae las del tenant. Recomendación (2026-09-30): sembrar la lista base en cada tenant al crearlo (desde `crearTenant.js`) en vez de filas globales con `tenant_id` NULL. Las filas globales obligan a casos especiales en cada consulta, y no dejan que un cliente renombre u oculte una categoría base sin otro mecanismo. Sembrar por tenant mantiene las consultas en `tenant_id = $1` y permite un FK compuesto que cierra la deuda de `categoria_id`. Decidir en su propio chat.
- Menores: `gastos.js` sin JSDoc; `getGastosMensual` corre sus dos consultas en serie; el comentario del bloque "RUTAS DEL BACKOFFICE" de `index.js` dice "admin + barbero", pero la mayoría de sus rutas son solo admin.
- **Propias de movimientos extra:** sin edición (corregir es borrar y volver a cargar) y sin pantalla de alta de socios (se cargan por SQL, ver `onboarding.md`).
- **(nueva, 2026-10-01) — Subdominios de tenant sin `robots.txt` ni `noindex`.** Google puede indexar el login del panel (`<title>Barber Manager</title>`) una vez por tenant, y eso compite con la landing en las búsquedas de la marca. Evaluar un `noindex` para el panel (header `X-Robots-Tag` en el `vercel.json` del proyecto de gestión) que no alcance al turnero (`/turnos`), que sí conviene indexar.
- **(nueva, 2026-10-01) — Landing: `linkWhatsApp()` y `linkEmail()` no manejan `null`.** El comentario de `config/landing.js` dice que la UI lo maneja, pero con `CONTACTO.whatsapp` en `null` los CTA armarían `https://wa.me/null?...` (los módulos de SEO sí lo cubren). Menor: hoy los valores están cargados.
- **(nueva, 2026-10-01) — Landing: datos de la competencia con fecha.** El bloque "¿Y frente a otras apps de turnos?" y la FAQ 5 afirman cosas de Fresha, Booksy y Setmore relevadas el 01/10/2026. Revisarlas cada tanto (o si cambian sus precios) y actualizar la nota al pie. Cómo, en [`decisiones_landing_ia.md`](./decisiones_landing_ia.md).

### Deudas vivas del frontend del panel (consolidadas del registro archivado)

El rediseño del panel de gestión cerró todas sus deudas accionables; quedan estas, **todas de prioridad baja**. Historia completa de cómo se resolvió cada deuda del rediseño en [`deudas_tecnicas_frontend.md`](./deudas_tecnicas_frontend.md) (archivado). Se conservan los números `#NN` originales para las referencias cruzadas en commits y docs.

- **#48 (abierta) — Naming "Admin" en el login unificado por PIN.** Desde que el login por PIN se unificó (admin y barbero entran por la misma pantalla; el backend resuelve el rol según el PIN), el naming "Admin" quedó stale en `frontend`: `screens/PantallaLoginAdmin.jsx` (+ sub-componentes `ShellLoginAdmin`, `BotonCancelarEsquina`, prefijo de log `[pantallaLoginAdmin]`), el estado `currentScreen === "loginAdmin"` y el handler `cerrarSesionAdmin` en `App.jsx`. Cosmético, sin impacto funcional. Resolver en un cleanup de naming aparte → `PantallaLoginPanel` / `loginPanel` / `cerrarSesionPanel`.
- **#27 (aceptada) — Semántica engañosa de la columna comisión del subtotal del día** (`SeccionPlanillas`, tab Detalle). El `thead` no tiene columna "Comisión"; el slot "Pago" del `tfoot` muestra `comisión + propinas` sin label explícito (solo el eyebrow mono indica `XX% + prop` o `$N/c + prop`). Mantenido a pedido del usuario durante el rediseño. Revisitar como mejora UX si aparece pedido: (a) fila aparte "Comisión del día" + "A pagar al barbero", o (b) columna "Comisión" en el thead. **(2026-09-30)** En el Resumen, la columna "Comisión" pasó a llamarse "A pagar" (con la pista `XX% + prop`), y la columna del Excel de los dos tabs pasó a "A pagar ($)". Así "comisión" queda solo para la comisión sin propinas, como en Balances y en el modal de detalle. El tab Detalle en pantalla sigue como se describe acá.
- **#28 (aceptada) — Acoplamiento sutil entre tabs en `SeccionPlanillas`.** `infoComisionActiva` se deriva de `resumenData` pero se consume en el tab Detalle (comisión por día). El `Promise.all` que carga ambos endpoints en paralelo lo garantiza hoy. Si se separan los fetches (lazy load por tab) o se mueve el cálculo al backend, se rompe en silencio (el Detalle quedaría sin comisión hasta que cargue el Resumen). **(2026-09-30)** Ahora también al revés: el modal de detalle del Resumen (`ModalDetalleBarbero`) usa los cortes de `detalleData` para el total por día y por forma de pago. Si se separan los fetches, hay que cargar los dos antes de abrirlo.
- **#42 (aceptada) — `BloqueFeriados` con overflow propio.** `max-height:260` + `overflowY:auto` en la lista: divergencia consciente de la convención "las secciones no tienen overflow propio", justificada porque la lista de feriados es de largo variable dentro del bloque sin scroll de `TabNegocio`. Revisar si en el futuro el panel de Gestión pasa a scrollear normalmente.
- **#43 (aceptada / nota de producto) — Nombre del negocio + URL de reservas sin self-service** (`TabNegocio`). Se removió el formulario de esos dos campos (se editan directo en la DB porque cambian muy poco); el endpoint `GET/PUT /admin/negocio` sigue existiendo y `App.jsx`/`PanelAdmin` leen el nombre. Si el producto se vende a terceros que quieran renombrar su negocio o cambiar la plataforma de turnos sin tocar la DB, reponer un formulario mínimo.
- **#45 (aceptada) — Bloque del barbero en un día que el local cerró después no se valida** (`TabBarberos`). Si el local cierra un día donde un barbero ya tenía un bloque cargado, ese bloque se sigue mostrando editable pero `validarHorario` no lo marca inválido (no hay rango del local contra el cual validar: `horarioLocal[dia]` es `undefined`). Caso de borde poco frecuente, dejado fuera de alcance al resolver #40. Si se quiere endurecer: marcar inválido todo bloque en día cerrado del local (con `horarioLocal != null`).
- **(nueva, 2026-06-10) — Fallo de DELETE silencioso en las secciones de movimientos** (`SeccionVentas`, `SeccionGastos` y `SeccionCaja`→`TabMovimientos`). El handler `confirmarEliminar` de las tres traga el error en el `catch` con solo `console.error` (sin feedback al usuario) y cierra el `ConfirmDialog` igual: si el DELETE falla (red/servidor), la fila reaparece al recargar pero el usuario no se entera de que no se borró. Detectado al cablear el Toast de export (helper `cargarChunk`, 2026-06-10). Fix natural: surfacear el error con el mismo patrón `<Toast tone="danger">` que ya se usa para el export (estado de feedback local) — o, mejor, esperar al Toast flotante global ([`sistema_de_disenio.md`](./sistema_de_disenio.md) §9 deuda #16) y migrar los tres a la vez. Bajo riesgo, anotado.
- **(nueva, 2026-09-29) — Fórmula de comisión repetida en tres lugares.** `planillaService.resumenSemanal` (backend), `SeccionPlanillas.calcularComisionDia` (panel) y `MiPlanilla.calcularComisionDia` (`frontend-barbero`) calculan la comisión cada uno por su lado. Ya divergieron una vez: el Excel del Detalle de Planillas ponía la comisión de cada día sin propinas mientras la semanal las incluía (resuelto el 2026-09-29: el subtotal del día ahora suma las propinas, igual que el "Pago" en pantalla). Reglas de negocio vigentes (2026-09-29): la comisión es siempre porcentaje y las propinas van siempre al barbero. Fix de fondo: que el backend devuelva también la comisión por día y los fronts dejen de calcularla.
- **(nueva, 2026-09-29) — `npm run lint` del front de gestión falla en `main`** (7 errores + 1 warning, ninguno funcional; los fronts de barbero y turnero pasan limpio): 2 falsos positivos `'Icon' is defined but never used` (`PanelAdmin.jsx:114` y `KpiCard` en `SeccionBalances.jsx`: el parámetro renombrado `icon: Icon` solo se usa como JSX y `no-unused-vars` no lo ve; se resolvería sumando `argsIgnorePattern: '^[A-Z_]'` a la regla, igual que el `varsIgnorePattern` que ya tiene), 3 de `react-hooks/set-state-in-effect` (`App.jsx:231` y `:269`, `FondoLocal.jsx:106`; ver deuda #13 de [`sistema_de_disenio.md`](./sistema_de_disenio.md)), `token` asignado y sin usar (`App.jsx:136`), `react-refresh/only-export-components` (`screens/flows/wizard.jsx:356`) y el warning `exhaustive-deps` del efecto del histórico en `SeccionBalances`. El de la landing quedó en verde el 2026-10-01 (pre-renderizado, ver [`decisiones_landing_ia.md`](./decisiones_landing_ia.md)). Tarea sugerida: "lint en verde en los cuatro fronts".
- **(pendiente de producto) — ¿`ScreenHeader` en todo el admin?** Se sacaron de Gestión, Turnero, Planillas, Balances y Caja (decisión D15 en [`decisiones_redisenio_panel_gestion.md`](./decisiones_redisenio_panel_gestion.md)); quedan solo en `SeccionVentas` y `SeccionGastos` (verificado 2026-09-29). Falta decidir si se sacan también de ahí o se conservan.
- **(nueva, 2026-09-29) — `SeccionInicio.jsx:423` usa `.then(r => r.json())`** dentro del `Promise.all`, contra convenciones §3 (nunca `.then()`). Pasarlo a `async/await` la próxima vez que se toque Inicio.
- **(nueva, 2026-09-30) — Caja esconde todo mientras carga o si falla.** El estado de carga y el de error reemplazan también el selector de día y los totales: si un día falla, solo queda "Reintentar" y no se puede cambiar de día sin salir de la sección.
- **(nueva, 2026-09-30) — Errores sin mensaje del servidor se muestran crudos** en los modales de Caja, Gastos y Ventas: "Failed to fetch" si no hay red, o el texto del parser si la respuesta no es JSON (un 502 del proxy). Arreglar los tres juntos con un mensaje genérico en español.
- **(nueva, 2026-09-30) — Etiqueta neutra sobre fila con hover.** "Aporte" y "Retiro" (Caja) y `BadgeCategoria` (Gastos) usan `surfaceAlt`, igual que el hover de la fila, y pierden el fondo al pasar el mouse.
- **(nueva, 2026-09-30) — Tamaños escritos a mano:** `fontSize: 13` en los bloques de error de Gastos y Ventas; 15 y 12 en `Field`. Además, `Field` no acepta `maxLength`. `SummaryRow` también usa `fontSize: 13` para el valor, en las copias de los tres fronts (en el panel no lo usa ninguna pantalla; en el turnero y el barbero sí): baja del mínimo de 14 del sistema de diseño (§3.6), así que se arregla en las tres copias a la vez.
- **(nueva, 2026-09-30) — `Modal`: valores escritos a mano y sin manejo del foco.** El fondo oscuro (`rgba(9, 9, 11, 0.5)`) y la sombra (`0 20px 40px rgba(0,0,0,0.15)`) no salen de `theme`: no hay token de overlay y `shadowMd` es más liviana (sumar tokens `overlay` / `shadowLg` en `tokens.js`, que es el mismo en los cuatro fronts). Además, el modal no lleva el foco adentro al abrirse, no lo encierra y no lo devuelve al cerrar: con teclado, Tab sigue recorriendo la pantalla de atrás (ESC sí cierra). Afecta a todos los modales del panel.
- **(nueva, 2026-09-30) — Formas de pago en tres lugares** (`formatPago`, `OPCIONES_FORMA_PAGO` y `BadgeFormaPago`); el Excel de Gastos usa un ternario propio.
- **(nueva, 2026-09-30) — `BotonFormaPago` (SeccionTurnero) y `GrupoOpciones` (SeccionCaja) son el mismo patrón**, con su rótulo `labelEyebrow` duplicado. Al unificarlos, promover `GrupoOpciones` a `/ui` (§7.1 del sistema de diseño).
- **(nueva, 2026-09-30) — Menores:** comentario viejo en `SeccionGastos.jsx` ("las categorías traen id numérico"; son UUID); encabezado de `SelectorDia.jsx` con la ruta vieja.

*— Fin del documento —*
