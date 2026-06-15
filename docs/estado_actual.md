# Estado actual del proyecto

Última actualización: 2026-06-13. **Go-live del turnero mergeado a `main` y en producción** (`kingsai.barbermanager.app`): turnero del cliente, app del barbero, acceso de barberos al panel, horario de atención + feriados y rediseño del panel de gestión, todo live. Backend fijado a **Node 22** en Railway (supabase-js v2 necesita WebSocket nativo — ver post-mortem en [`postmortem_golive_turnero.md`](./postmortem_golive_turnero.md)). El mailer de Resend está activo tanto en el web service como en el cron. Quedan solo residuales operativos/time-gated de entregabilidad de mail — ver Pendientes.

Para convenciones de código, ver [`/docs/convenciones_tecnicas.md`](./convenciones_tecnicas.md).

---

## Stack

- **Frontend:** React + Vite, inline styles + módulo `theme` (design tokens), fuente Geist, acento indigo. Los tres fronts (gestión, turnero, barbero) migrados al sistema de diseño "Luz" (ver `docs/sistema_de_disenio.md`). El verde `#1a7a4a` + DM Sans del scaffold original quedaron deprecados con el rediseño.
- **Backend:** Node.js + Express, ES Modules (`import/export`).
- **DB:** PostgreSQL via Supabase Session Pooler.
- **Auth:** bcrypt + JWT. Token admin en memoria (`useState` en `App.jsx`). Token operativo en `localStorage` con clave `token_operativo` (sobrevive al reload del iPad). Token barbero en `localStorage` desde `frontend-barbero`.

---

## Deploy

### Backend — Railway
- URL: `https://sistemagestionbarberia-production.up.railway.app`
- Root Directory: `/backend`
- Start command: `node src/index.js`
- Variables de entorno: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `NODE_ENV=production`, `PORT=3000`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_EMAIL`, `RESEND_API_KEY`, `MAIL_FROM`. **`PLATFORM_ADMIN_KEY`** (opcional) habilita el endpoint de plataforma `POST /api/plataforma/cache/invalidate`; **sin setear por ahora a propósito** → el endpoint responde 503 (fail-safe). Setearla recién al usar el endpoint en prod (dispara autodeploy; hacerlo en momento de poco tráfico).
- **Dos servicios Railway:** el **web service** (esta API) y un **servicio cron** de recordatorios (`node src/jobs/recordatorios.js`), ambos deployando de `main`. `RESEND_API_KEY` + `MAIL_FROM` están como **shared variables** referenciadas en los dos, así que el mailer de Resend está activo en ambos.
- `TENANT_ID` eliminado de Railway — ya no se usa en producción.
- Las cuatro `GOOGLE_*` corresponden a la cuenta central `turnos.barbermanager@gmail.com` (organizador de eventos del turnero), consumidas por `services/googleCalendar.js`. El refresh token es estable (app publicada en Google Cloud, no expira por inactividad).

### Frontend — Vercel

Tres proyectos deployados en Vercel, todos auto-deploy en push a `main`.

| Proyecto | Root | URL Vercel |
|---|---|---|
| Gestión | `/frontend` | `sistema-gestion-barberia.vercel.app` |
| Turnero del cliente | `/frontend-turnero` | `sistema-gestion-barberia-turnero.vercel.app` |
| App del barbero | `/frontend-barbero` | `sistema-gestion-barberia-barbero.vercel.app` |

Existe además un cuarto front en el repo, **`/frontend-landing`** (página de marketing de BarberManager, commit `53ac14e`), **pendiente de deploy en Vercel**.

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
   — `5173` turnero, `5174` barbero. El `host: true` expone el dev server a la
   red local; los puertos fijos hacen las URLs predecibles.
2. **`VITE_API_URL`** debe apuntar a la IP de red local de la PC (no a
   `localhost`, que para el celular sería el celular mismo). Se setea en el
   `.env` de cada frontend (gitignored): `VITE_API_URL=http://<IP-PC>:3001`.
   La IP se obtiene con `ipconfig`; es DHCP, puede cambiar.
3. Backend corriendo localmente (`node src/index.js`), `NODE_ENV=development`.
4. En el celular: `http://<IP-PC>:5173/turnos/` y `http://<IP-PC>:5174/barbero/`
   (con la barra final del `base` path, sin ella da 404).
5. Firewall de Windows debe permitir el acceso de Node a la red privada.

---

## Tenants

| Tenant | Tipo | Subdominio | UUID |
|---|---|---|---|
| Kingsai Studio | Producción | `kingsai` | `a1b2c3d4-0000-0000-0000-000000000001` |
| Demo | Desarrollo | `demo` | `aaaaaaaa-0000-0000-0000-000000000002` |

URL de producción: `kingsai.barbermanager.app` ✅ funcionando.

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

## Schema del turnero (ejecutado; backend y frontends en producción)

El schema del turnero se ejecutó en Supabase el 2026-05-11 (decisiones en
`decisiones_turnero.md`). Resumen de cambios:

### Tablas nuevas
- **`cliente`** — `id, tenant_id, nombre, telefono?, email?, created_at`. UNIQUE `(tenant_id, email)` (permite múltiples NULL).
- **`barbero_horario`** — `id, tenant_id, barbero_id, dia_semana (0–6), hora_inicio, hora_fin`. Múltiples bloques por día permitidos (para pausas).
- **`barbero_suspension`** — `id, tenant_id, barbero_id, desde, hasta, motivo?, origen ('admin'|'barbero'|'whatsapp'), created_at`. Índice `(barbero_id, desde, hasta)`.
- **`turno`** — schema completo con `inicio/fin`, `estado`, `origen_creacion`, `token_gestion` UNIQUE, `google_event_id?`, trazabilidad de cancelación. **EXCLUDE GIST `turno_no_solapamiento`** validado funcionalmente (PostgreSQL bloquea dos turnos solapados del mismo barbero a nivel DB, código `23P01` → el backend lo mapeará a HTTP 409). 3 índices parciales sobre `estado='reservado'`. Extensión `btree_gist` habilitada.

### Modificaciones a tablas existentes
- **`tenant.duracion_slot_minutos`** integer NOT NULL default 30. Kingsai y Demo heredaron 30. Si Kingsai necesita slots de otra duración, se ajusta a mano más adelante.
- **`servicio.cantidad_slots`** integer NOT NULL default 1. Los 7 servicios existentes quedaron con 1 slot (= 30 min). Idem ajuste manual si hace falta.
- **`barbero.email`** text nullable. Los 8 barberos quedaron con `email = NULL`; sus turnos no se sincronizarán con Google Calendar hasta que se les cargue.
- **`corte.turno_id`** uuid nullable, FK a `turno`. Índice `UNIQUE corte_turno_unico WHERE turno_id IS NOT NULL` (previene doble vínculo). Los 606 cortes históricos quedaron con `turno_id = NULL` (walk-ins).

### Postergado del plan original
- **`gasto.created_at`** — el DROP del Paso 1.9 se postergó. Cuando se retome, decidir qué hacer con esa columna (eliminarla, renombrarla, o asignarle un propósito definido).

---

## Decisiones arquitecturales

### Multi-tenancy por subdominio
- `tenantMiddleware.js` lee el header `X-Tenant-Subdomain`, resuelve `tenant_id` desde DB con caché en memoria, e inyecta `req.tenant_id`.
- Fallback a `TENANT_ID` en `.env` para desarrollo local (localhost no tiene subdominio).
- El frontend extrae el subdominio de `window.location.hostname` al arrancar: solo lo considera subdominio si el hostname termina en `.barbermanager.app`; cualquier otro host (localhost, una IP de red local) devuelve `undefined` y cae al fallback de `TENANT_ID`. La heurística anterior ("≥3 partes separadas por punto") tomaba un octeto de una IP como subdominio.
- `publicHeaders` en `api.js` incluye `X-Tenant-Subdomain` en todas las funciones públicas.
- `apiFetch` incluye `X-Tenant-Subdomain` en todas las llamadas del panel admin.
- **Caché del middleware:** las entradas resueltas se guardan en memoria como `{ tenant_id, operativo_token_version }` por subdominio (query única `resolverPorSubdominio`, reusada por todo). Se invalidan al reiniciar **o** vía invalidación explícita: automática al rotar la password operativa (`adminOperativo` llama `invalidar(subdominio)` en proceso → preserva la revocación inmediata de tokens operativos) y manual con el endpoint de plataforma `POST /api/plataforma/cache/invalidate` (para baja / cambio de subdominio editados a mano en la DB). Ver `onboarding.md` → "Baja de un tenant". (commit `0fa087a`)

### Estructura del panel admin
- Cada `SeccionXxx` es autónoma y carga sus datos en `useEffect([])`.
- `PanelAdmin` solo maneja layout. No hay precarga global del panel.
- `App.jsx`: `precargarDatos` como `useCallback`, se llama al arrancar y al cerrar sesión admin (para que los flujos reflejen cambios de Gestión sin reiniciar la app).

### Scroll global del panel
- `contenidoWrapper` (flex column) contiene `BannerAviso` + `main`.
- El `main` tiene `flex: 1` y `overflow: auto`.
- Las secciones no tienen overflow propio.

---

## Lógica de suscripción

> Esta sección documenta el comportamiento del sistema de bloqueo por suscripción vencida. Cuando exista `producto.md`, la parte de UX migra ahí.

### Datos
- Columna en tabla `tenant`: `suscripcion_vigente_hasta date`.
- Para renovar un cliente: `UPDATE tenant SET suscripcion_vigente_hasta = 'YYYY-MM-DD'`.

### Comportamiento por días desde el vencimiento
- **Días 1–4:** sin aviso, sin bloqueo.
- **Días 5–10:** banner amarillo en el panel si `suscripcion_vigente_hasta < primer día del mes`.
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
- Caja — Tab 1 (Movimientos del día) ✅
- Caja — Tabs 2 y 3 (Cierre + Historial) ⏸️ postergado, ver pendientes
- Planillas ✅
- Gastos ✅
- Ventas ✅
- Balances ✅
- Turnero (vista global de turnos del día) ✅
- Gestión (6 tabs) ✅

### Sistema
- Auth: bcrypt + JWT ✅ — `usuario_registro` eliminado del schema. `verificarToken` valida `tenant_id` cruzado (cierra agujero multi-tenant) e inyecta `req.rol` + `req.barbero_id`. JWT admin: `{ tenant_id, rol: 'admin' }` con 30d (login via `POST /api/auth/panel/login`, login unificado que resuelve rol admin/barbero según el PIN). JWT barbero: `{ tenant_id, rol: 'barbero', barbero_id }` con 30d (login via `POST /api/auth/barbero/login`). JWT operativo: `{ tenant_id, rol: 'operativo', tv }` con 30d (login via `POST /api/auth/operativo/login`); `tv` es la `operativo_token_version` del tenant al momento de firmar — `adminOperativo` la incrementa al cambiar la password operativa, y `verificarToken` rechaza con 401 cualquier token operativo cuyo `tv` no coincida con el actual (invalidación inmediata sin esperar a la expiración natural). Middleware `requiereRol(...roles)` aplicado en `/api/admin/barberos`, `/api/admin/servicios`, `/api/admin/productos`, `/api/admin/negocio`, `/api/admin/turnero/config` y `/api/admin/operativo`. Endpoints operativos (`/api/cortes`, `/api/turnos`, `POST /api/ventas`, `POST /api/gastos`) protegidos con `requiereRol('operativo', 'admin')`; `GET /mensual`, `PUT` y `DELETE` de ventas/gastos siguen requiriendo `requiereRol('admin')`. Frontend gestión: pantalla `PantallaLoginOperativo` precede al MainScreen cuando no hay `token_operativo` en localStorage; el helper `apiFetchOperativo` en `services/api.js` inyecta el token operativo y maneja 401 redirigiendo al login. Tab `Seguridad` en SeccionGestion permite cambiar PIN admin, usuario operativo y password operativa desde el panel (controllers `adminOperativo.js` con GET/PUT en `/api/admin/operativo/credenciales`).
- Bloqueo/aviso por suscripción ✅ mergeado a `main`.
- Multi-tenancy por subdominio ✅ en producción (`kingsai.barbermanager.app`).
- Migración de schema `refactor/schema-corte` ✅ mergeado a `main`.

---

## Pendientes

- **Caja — Tabs 2 y 3 (Cierre de caja + Historial):** postergado. No hay plan escrito; si se retoma, branch sugerido `feature/cierre-caja` (implicaría `ALTER TABLE cierre_caja` con columnas de saldo inicial — `efectivo_inicial`, `mp_inicial`, etc.).
- **Log de actividad:** registrar quién eliminó qué y cuándo (hoy las eliminaciones no dejan rastro).
- **Generación de QR de Mercado Pago** para cobro en el momento desde el iPad.
- **Envío de planillas/datos por WhatsApp.**
- **Entregabilidad de mail (time-gated, no bloquea nada):** Fase 6 DMARC — endurecer de `p=none` a `quarantine` y luego `reject` tras 1–2 semanas de reportes 100% alineados; re-test de Outlook tras warmup (hoy los mails con link caen a Junk por reputación de dominio nuevo); seguir MXToolbox + Google Postmaster. Detalle histórico en [`decisiones_mail_entregabilidad.md`](./decisiones_mail_entregabilidad.md).
- **Recordatorio de turno — activación en kingsai (opt-in):** prender `configuracion.recordatorio = { "activo": true }` en el tenant cuando se decida. Ojo: los barberos de kingsai tienen `email = NULL` (no sincroniza Calendar), pero los clientes sí reciben el recordatorio → flip deliberado. (Opcional) índice parcial sobre `turno` y correr el lote 2×/día si crece el volumen. Detalle en [`decisiones_mail_recordatorio.md`](./decisiones_mail_recordatorio.md).
- **Validar en prod las optimizaciones de backend de performance** (ya implementadas, impacto a confirmar): keep-alive del pool (`db.js` + `index.js`) y `getTenant` paralelizado. Medir en frío contra Railway. Detalle en [`performance_frontends.md`](./performance_frontends.md).

---

## Deudas técnicas conocidas

- **Columna `tenant.configuracion`:** se setea por default con `{"ciudad": "Buenos Aires", "moneda": "ARS"}` en `crearTenant.js` para mantener consistencia con los tenants existentes, pero falta verificar si efectivamente se usa en algún controller. Si no se usa, evaluar si conviene eliminarla o si es para uso futuro.
- ✅ **Caché del `tenantMiddleware` sin invalidación — Resuelto (2026-06-11, commit `0fa087a`).** Ya tiene invalidación (automática al rotar la password operativa + endpoint de plataforma manual). Ver el pendiente resuelto arriba y `onboarding.md` → "Baja de un tenant".
- **Evaluar separar credenciales del tenant a una tabla `tenant_credenciales` (1:1).** Hoy la tabla `tenant` mezcla datos públicos (nombre, logo, contacto) con secretos: `pin_admin`, `operativo_usuario`, `operativo_password_hash`, `operativo_token_version`. Un `SELECT *` o un endpoint que devuelva el tenant arrastra esos secretos a cualquier consulta general — riesgo de fuga. La idea es mover esas 4 columnas a una tabla `tenant_credenciales` con FK 1:1, de modo que las queries públicas no las toquen nunca. No es por tamaño de la tabla (17 columnas es normal) sino por higiene de seguridad. Refactor con impacto en backend (auth, middleware operativo): merece su propio branch/chat.
- **Sin rate limiting en los endpoints de login** (`/api/auth/panel/login`, `/api/auth/barbero/login`, `/api/auth/operativo/login`). Nada limita los intentos → un ataque de fuerza bruta contra un PIN o usuario/password es posible. Aceptado para el MVP; sumar rate limiting (por IP y/o tenant) cuando crezca el número de tenants. Prioridad media.
- **Duplicación parcial de endpoints `/api/barberos` y `/api/turnero/barberos`:** ambos devuelven `{id, nombre}` filtrados por tenant. El primero es operativo (JWT), el segundo público para el wizard del cliente y el selector pre-PIN de la app del barbero. La duplicación es aceptable porque cada uno sirve una audiencia distinta (autenticada vs anónima). Si en el futuro el endpoint público gana campos extra (foto, especialidad) que no quieran exponerse autenticadamente, la separación se justifica sola. `/api/servicios`, `/api/productos` y `/api/categorias` ya no tienen contraparte pública — quedaron limpios.
- **Mailing del turnero — migrado a la API HTTP de Resend ✅; DMARC publicado ✅; activo en producción.** El `services/mail/mailer.js` (movido desde `services/mailer.js`) ya no usa Nodemailer + SMTP de Gmail: delega el envío en una capa de proveedor (`mail/mailProvider.js` contrato agnóstico → `mail/resendProvider.js`, `fetch` a `api.resend.com` con timeout de 15 s). Mantiene todo el HTML y los 5 tipos de mail; suma `From` por-tenant (display name = nombre del negocio) y `text` (multipart). Motivo del cambio: Railway Hobby bloquea el SMTP saliente → en prod no salía ningún mail. Dominio de envío propio `send.barbermanager.app` **verificado** (SPF/DKIM/MX en verde; zona DNS en Vercel). Commit `ecc5484`, validado end-to-end contra Resend. **Avance (2026-06-09):** env vars `RESEND_API_KEY` + `MAIL_FROM` cargadas en Railway como **shared variables** en los dos servicios; **DMARC `p=none` publicado** (Postmark DMARC como lector de reportes); verificación local (mail-tester **9.5/10**, Gmail en bandeja, **Outlook a Junk por reputación de dominio nuevo** → re-test tras warmup). **El mailer corre en producción** en el web service y en el cron (ambos deployan de `main`). Plan y referencia histórica en [`decisiones_mail_entregabilidad.md`](./decisiones_mail_entregabilidad.md). **Tramo 2 ✅ (2026-06-09):** un Run Now del servicio cron en Railway **envió un recordatorio real por HTTP** (`message_id` de Resend, **Delivered**, Gmail en bandeja) → **egress HTTPS desde producción confirmado** y **Etapa 3 del recordatorio verificada** ([`decisiones_mail_recordatorio.md`](./decisiones_mail_recordatorio.md)). En esa corrida saltó que el `MAIL_FROM` del cron tenía el valor sandbox viejo (`onboarding@resend.dev`) sin actualizar → Resend devolvía 403; corregido a `turnos@send.barbermanager.app` (al ser shared variable, el valor corregido ya vale para ambos servicios).
- **`POST /api/turnero/turnos`, `/reprogramar` y `POST /api/admin/turnos` no validan que `inicio` caiga en un slot real.** Confían en `/api/turnero/disponibilidad` + el frontend para elegir solo slots válidos. El constraint EXCLUDE GIST protege contra solapamientos con otros turnos, pero un `inicio` fuera de bloque horario o sobre una suspensión se aceptaría si no choca con otro turno reservado. Blindar requeriría reejecutar el algoritmo en cada POST. Postergado.
- **(2026-06-11) — `POST /api/turnero/turnos` sin idempotency key — turno huérfano posible en el reintento de conexión (raro).** El helper `query()` (`config/db.js`) reintenta una vez ante errores de conexión (ver commit de esta fecha). En la ventana angosta en que un socket muere *después* de que la DB commitea el INSERT del turno pero *antes* de entregar el resultado, el reintento reejecuta el INSERT → choca con el constraint EXCLUDE GIST (`23P01`) → el cliente recibe 409 "slot ocupado" aunque su turno **sí** quedó creado (sin mail de confirmación ni evento de Calendar, porque el 409 corta antes del best-effort). **Integridad intacta** (el constraint impide el doble turno); es CX confuso, no corrupción. Pasa igual sin el reintento (el usuario reintentaría a mano y caería en el mismo 409), así que el reintento no lo empeora. **Fix pro:** idempotency key por intento de reserva (el front manda un id único, el back devuelve el mismo turno en vez de reintentar el INSERT). Bajo riesgo en prod (conexiones rápidas y estables, salto corto Railway↔Supabase — ver `optimizacion_frontend.md`). Postergado.
- **Upsert de cliente pisa `nombre/telefono`** con los últimos datos enviados. Aceptado para MVP, pantalla de unificación de clientes pendiente.
- **Título del evento de Google Calendar** está hardcodeado como `${servicio.nombre} — ${cliente.nombre}` en `services/googleCalendar.js#armarCuerpoEvento`. Pedido cambiarlo a solo `cliente.nombre` en el chat aparte de reescritura de templates de mail.
- ✅ **Validación de `tv` operativo hace 1 SELECT por request — Resuelto (2026-06-11, commit `0fa087a`).** El caché del `tenantMiddleware` ahora guarda `operativo_token_version` (helper `leerTokenVersionOperativo(req)`); `verificarToken` la lee del caché en vez de un SELECT por request operativo. La revocación inmediata se preserva porque el único escritor de la versión (`adminOperativo`, confirmado por grep) invalida el caché en proceso al rotar la password. El patrón se replicaría sin costo extra si más adelante se invalidan tokens admin/barbero.
- **`adminOperativo.actualizarCredencialesOperativas` no chequea `rowCount`.** El UPDATE devuelve 204 incluso si el `tenant_id` no existe (en la práctica `tenantMiddleware` ya lo blinda, pero el endpoint sería más honesto con un `rowCount === 0 → 404`). Cosmético.
- **`process.env.JWT_SECRET` accedido directo** en `authOperativo.js`, `authMiddleware.js` y `controllers/auth*.js`. Si la env var falta en Railway, `jwt.sign` firma con `undefined` sin error explícito al arrancar. Centralizar en `config/jwt.js` con validación al boot evitaría sorpresas silenciosas. Cosmético.
- **(2026-06-12) — Cliente de Supabase Storage = dependencia dura de arranque del backend.** `backend/src/config/supabase.js` crea el cliente al cargar el módulo; una credencial faltante o una incompatibilidad del runtime (p. ej. Node sin `WebSocket` nativo) tumba **toda** la API al bootear — fue el crash-loop del go-live del turnero. Fix: init **perezoso** del cliente (construirlo en el primer uso de Storage, no al importar) + que un fallo de Storage devuelva un 500 puntual en vez de `process.exit`/crash. Prioridad media. Post-mortem completo (las 3 causas encadenadas: env vars de Supabase faltantes, shared variables de Railway no inyectadas, Node 18 sin WebSocket) en [`postmortem_golive_turnero.md`](./postmortem_golive_turnero.md).
- **El path `/turnos/gestionar/` está hardcodeado en tres lugares.** Backend (`turnosService.js#armarLinkGestion`), `frontend-turnero/src/App.jsx` (regex `extraerTokenDeURL`) y `frontend-turnero/src/screens/Confirmacion.jsx` (redirección post-reserva). Si la ruta cambia hay que tocar dos repos. Origen: un fix de 2026-05-20 — `armarLinkGestion` generaba `/turnos/:token` pero el frontend solo monta la pantalla de gestión con `/turnos/gestionar/:token`, así que el mail caía al wizard de reserva. Bajo riesgo, queda anotado.
- **La restricción "no completar turnos futuros" es solo client-side.** `frontend-barbero` oculta las acciones "completar"/"no asistió" para turnos cuyo `inicio` todavía no pasó, pero `PATCH /api/admin/turnos/:id/estado` no valida la antelación: una request directa podría marcar `completado` un turno futuro. Blindar requeriría un check de `inicio <= now()` en `turnosService`. Bajo riesgo (la UI ya lo previene), pero queda anotado.
- **`/api/admin/turnos` y `/api/admin/planilla` aceptaban token operativo.** ✅ **Resuelto (Fase 6)** — ambas pasaron a `requiereRol('admin','barbero')` en `index.js`, excluyendo al operativo. Se verificó que ningún flujo operativo del iPad las llama (usa `/api/turnos` y `/api/cortes`); el frontend de gestión las consume con token admin (`apiFetch`) y `frontend-barbero` con token barbero (`apiFetch`), ambos cubiertos por el nuevo `requiereRol`. El scoping por barbero (filtrar por `req.barbero_id`, ignorando cualquier `barbero_id` ajeno del query) lo siguen haciendo los controllers (`turnos.js#getTurnos`, `planilla.js`).
- **`/api/admin/horarios`, `/api/admin/suspensiones` y `/api/admin/clientes` — escalada horizontal AUDITADA (sin agujero) + escalada vertical operativo→admin RESUELTA (2026-06-11, commit `ca2fc96`, commiteado).** Branch `fix/scoping-admin-barbero` (desde `feature/turnero`). Estos tres eran los únicos `/api/admin/*` montados solo con `verificarToken`, sin `requiereRol`; `frontend-barbero` los reusa con su token barbero (`GET/PUT /admin/horarios/:barberoId`, `GET/POST/DELETE /admin/suspensiones`, `GET /admin/clientes/mis-clientes`, `GET /admin/clientes?busqueda=`).
  1. **Escalada horizontal (barbero↔barbero) — auditada, SIN cambios de código.** Los 7 endpoints fuerzan el scoping in-controller por `req.barbero_id` cuando `rol === 'barbero'`: `/horarios/:barberoId` devuelve 403 si el id del path es ajeno; suspensiones y `mis-clientes` ignoran el `barbero_id` arbitrario del query/body y usan el propio; `DELETE /suspensiones/:id` verifica ownership en el WHERE (ajena → 404). `GET /admin/clientes?busqueda=` es tenant-scoped por diseño (los clientes no tienen dueño barbero). Verificado en Bruno.
  2. **Escalada vertical (operativo→admin) — era un agujero real, FIX aplicado.** Como el scoping in-controller solo distingue `rol === 'barbero'` vs el resto, un **token operativo** caía en la rama admin y quedaba tratado como admin (editar la agenda de cualquier barbero, suspender a cualquiera, leer el directorio de clientes del tenant). Fix: `requiereRol('admin','barbero')` en las 3 líneas de `index.js`, igual que sus hermanos `/admin/turnos` y `/admin/planilla` (cierra para estos 3 el mismo hueco que la Fase 6 cerró para turnos/planilla). Sin impacto en consumidores reales (panel admin = token admin, app barbero = token barbero); el operativo ahora recibe 403. Verificado en Bruno (operativo→403, barbero propio→OK, barbero ajeno→403/404, admin sin restricción). Commit `ca2fc96` (solo `backend/src/index.js`).
  3. **`/api/admin/horario-atencion` (revisado de paso) — seguro, sin cambio.** No necesita guard a nivel mount: aplica `requiereRol` **por método** en su route file (`GET` admin+barbero, `PUT` solo admin); el operativo recibe 403 en ambos. Patrón correcto cuando los verbos necesitan roles distintos.
  4. **Unificación / duplicación funcional — QUEDA ABIERTA** (solo anotado, no atacado): (a) `barbero_horario` tiene dos escritores, `horariosService.js` (el endpoint de gestión) y `horarioAtencionService.js` (cascada al cambiar el horario de atención del tenant); (b) el idiom de scoping `req.rol === 'barbero' ? req.barbero_id : <param>` está duplicado en 6 handlers (horarios/suspensiones/clientes) → candidato a centralizar en un helper/middleware; (c) la lectura de clientes (`clientes.js`) y la creación find-or-create del turnero (`turnosService.js`) viven separadas. Mantener separados por audiencia es válido (como `/api/barberos` vs `/api/turnero/barberos`); revisar si conviene unificar.
- **Logger estructurado a futuro.** Hoy todo el logging del backend usa `console.log/warn/error` directo contra stdout, y Railway lo indexa así como está. Funciona porque el sistema es chico (1 backend, pocos tenants en producción). Cuando el volumen crezca — varios tenants activos, necesidad de filtrar por nivel/tenant/request_id, o integración con una plataforma de observability tipo Sentry/Datadog — corresponde migrar a un logger estructurado (Pino es la opción senior por performance; Winston si se prioriza ecosistema). Disparadores sugeridos: ≥3 tenants en producción, o contratación de Sentry/equivalente. No es convención, es decisión postergada hasta tener el problema real.
- **Extracción del subdominio inconsistente entre los tres frontends (el de gestión quedó con la heurística vieja).** `frontend-turnero` y `frontend-barbero` resuelven el tenant con `hostname.endsWith('.barbermanager.app') ? hostname.split('.')[0] : undefined` (`*/src/services/api.js`). El **frontend de gestión** (`frontend/src/services/api.js`) todavía usa la heurística vieja `partes.length >= 3 ? partes[0] : undefined`. Esto **contradice** lo que ya documenta §Decisiones arquitecturales → Multi-tenancy por subdominio, que dice que esa heurística fue reemplazada justamente porque "tomaba un octeto de una IP como subdominio": el cambio se aplicó a turnero/barbero pero **no** al de gestión. Consecuencia concreta: probando el panel desde una IP de red local (ej. `192.168.0.5`) el gestión computa `subdominio = '192'` y manda un `X-Tenant-Subdomain` espurio (el flujo de "probar frontends en la red local" documentado más arriba lo dispara). Bajo riesgo en producción (en `*.barbermanager.app` ambas heurísticas dan lo mismo), pero es un bug latente en dev. Fix: alinear el de gestión con el `endsWith`.
- **Lógica de subdominio y helpers de UI duplicados en los tres frontends.** La extracción de subdominio, `theme/tokens.js`, los helpers de fecha (`fecha.js` en turnero/barbero, `fechas.js` en gestión) y de formato (`formato.js` vs `formatos.js`), `index.css` y los 13 primitivos universales están copiados en cada app Vite. Es el costo conocido de tener tres proyectos separados sin paquete compartido. La deuda anterior es síntoma directo: una copia se actualizó y las otras no. Evaluar un workspace / paquete compartido si la divergencia se vuelve recurrente; por ahora queda anotado.

- **(2026-06-11) — Rebote de overscroll de iOS asoma el fondo por detrás del footer del turnero (cosmético).** En Safari iOS, cuando el contenido supera el alto del viewport y el usuario hace overscroll en el **borde inferior**, el rebote elástico deja asomar el fondo de la app (`theme.bg`, casi blanco) por detrás del `StickyFooter` (`position: sticky; bottom: 0`), recortando visualmente el CTA. Reproducido en el turnero: `Landing` con la tabla de horarios desplegada y `GestionTurno` con el panel de reprogramar abierto (ambos casos en que el contenido se hace más alto que la pantalla). **Mitigación aplicada (commit de esta fecha):** `overscroll-behavior: none` en `html, body` (`frontend-turnero/src/index.css`) — desactivó el **pull-to-refresh** (objetivo principal: evitar que un arrastre accidental recargue y pierda el progreso del wizard) pero **no suprime del todo el rebote del borde inferior** en iOS (limitación conocida de `overscroll-behavior` sobre el scroll de documento en Safari). En la misma tanda, `PageContainer` pasó de `100vh` a `100dvh` para que el footer no quede tapado por la toolbar dinámica de Safari. **Estado:** queda como glitch cosmético menor, **sin pérdida de datos**. **Fix definitivo:** layout "app-shell" (el documento no scrollea; solo scrollea una zona interna; el footer es hijo fijo, no `sticky`). Descartado por ahora por el riesgo de regresión en las pantallas con formulario (el teclado de iOS y los scrollers internos se llevan mal) — retomar en una pasada deliberada de "sensación nativa" con testeo de las pantallas de formulario.

### Deudas vivas del frontend del panel (consolidadas del registro archivado)

El rediseño del panel de gestión cerró todas sus deudas accionables; quedan estas, **todas de prioridad baja**. Historia completa de cómo se resolvió cada deuda del rediseño en [`deudas_tecnicas_frontend.md`](./deudas_tecnicas_frontend.md) (archivado). Se conservan los números `#NN` originales para las referencias cruzadas en commits y docs.

- **#48 (abierta) — Naming "Admin" en el login unificado por PIN.** Desde que el login por PIN se unificó (admin y barbero entran por la misma pantalla; el backend resuelve el rol según el PIN), el naming "Admin" quedó stale en `frontend`: `screens/PantallaLoginAdmin.jsx` (+ sub-componentes `ShellLoginAdmin`, `BotonCancelarEsquina`, prefijo de log `[pantallaLoginAdmin]`), el estado `currentScreen === "loginAdmin"` y el handler `cerrarSesionAdmin` en `App.jsx`. Cosmético, sin impacto funcional. Resolver en un cleanup de naming aparte → `PantallaLoginPanel` / `loginPanel` / `cerrarSesionPanel`.
- **#27 (aceptada) — Semántica engañosa de la columna comisión del subtotal del día** (`SeccionPlanillas`, tab Detalle). El `thead` no tiene columna "Comisión"; el slot "Pago" del `tfoot` muestra `comisión + propinas` sin label explícito (solo el eyebrow mono indica `XX% + prop` o `$N/c + prop`). Mantenido a pedido del usuario durante el rediseño. Revisitar como mejora UX si aparece pedido: (a) fila aparte "Comisión del día" + "A pagar al barbero", o (b) columna "Comisión" en el thead.
- **#28 (aceptada) — Acoplamiento sutil entre tabs en `SeccionPlanillas`.** `infoComisionActiva` se deriva de `resumenData` pero se consume en el tab Detalle (comisión por día). El `Promise.all` que carga ambos endpoints en paralelo lo garantiza hoy. Si se separan los fetches (lazy load por tab) o se mueve el cálculo al backend, se rompe en silencio (el Detalle quedaría sin comisión hasta que cargue el Resumen).
- **#42 (aceptada) — `BloqueFeriados` con overflow propio.** `max-height:260` + `overflowY:auto` en la lista: divergencia consciente de la convención "las secciones no tienen overflow propio", justificada porque la lista de feriados es de largo variable dentro del bloque sin scroll de `TabNegocio`. Revisar si en el futuro el panel de Gestión pasa a scrollear normalmente.
- **#43 (aceptada / nota de producto) — Nombre del negocio + URL de reservas sin self-service** (`TabNegocio`). Se removió el formulario de esos dos campos (se editan directo en la DB porque cambian muy poco); el endpoint `GET/PUT /admin/negocio` sigue existiendo y `App.jsx`/`PanelAdmin` leen el nombre. Si el producto se vende a terceros que quieran renombrar su negocio o cambiar la plataforma de turnos sin tocar la DB, reponer un formulario mínimo.
- **#45 (aceptada) — Bloque del barbero en un día que el local cerró después no se valida** (`TabBarberos`). Si el local cierra un día donde un barbero ya tenía un bloque cargado, ese bloque se sigue mostrando editable pero `validarHorario` no lo marca inválido (no hay rango del local contra el cual validar: `horarioLocal[dia]` es `undefined`). Caso de borde poco frecuente, dejado fuera de alcance al resolver #40. Si se quiere endurecer: marcar inválido todo bloque en día cerrado del local (con `horarioLocal != null`).
- **(nueva, 2026-06-10) — Fallo de DELETE silencioso en las secciones de movimientos** (`SeccionVentas`, `SeccionGastos` y `SeccionCaja`→`TabMovimientos`). El handler `confirmarEliminar` de las tres traga el error en el `catch` con solo `console.error` (sin feedback al usuario) y cierra el `ConfirmDialog` igual: si el DELETE falla (red/servidor), la fila reaparece al recargar pero el usuario no se entera de que no se borró. Detectado al cablear el Toast de export (helper `cargarChunk`, 2026-06-10). Fix natural: surfacear el error con el mismo patrón `<Toast tone="danger">` que ya se usa para el export (estado de feedback local) — o, mejor, esperar al Toast flotante global ([`sistema_de_disenio.md`](./sistema_de_disenio.md) §9 deuda #16) y migrar los tres a la vez. Bajo riesgo, anotado.
*— Fin del documento —*
