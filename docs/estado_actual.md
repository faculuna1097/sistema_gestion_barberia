# Estado actual del proyecto

Última actualización: 2026-05-14 (Paso 9 del turnero — frontend funcional de la app del barbero).

Para convenciones de código, ver [`/docs/convenciones_tecnicas.md`](./convenciones_tecnicas.md).

---

## Stack

- **Frontend:** React + Vite, inline styles, DM Sans, color primario `#1a7a4a`.
- **Backend:** Node.js + Express, ES Modules (`import/export`).
- **DB:** PostgreSQL via Supabase Session Pooler.
- **Auth:** bcrypt + JWT (token en memoria, `useState` en `App.jsx`).

---

## Deploy

### Backend — Railway
- URL: `https://sistemagestionbarberia-production.up.railway.app`
- Root Directory: `/backend`
- Start command: `node src/index.js`
- Variables de entorno: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `NODE_ENV=production`, `PORT=3000`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_EMAIL`.
- `TENANT_ID` eliminado de Railway — ya no se usa en producción.
- Las cuatro `GOOGLE_*` corresponden a la cuenta central `turnos.barbermanager@gmail.com` (organizador de eventos del turnero). Cargadas pero todavía no consumidas por código — se activan recién en el Paso 4 (`services/googleCalendar.js`). El refresh token es estable (app publicada en Google Cloud, no expira por inactividad).

### Frontend — Vercel

Tres proyectos deployados en Vercel, todos auto-deploy en push a `main`.

| Proyecto | Root | URL Vercel |
|---|---|---|
| Gestión | `/frontend` | `sistema-gestion-barberia.vercel.app` |
| Turnero del cliente | `/frontend-turnero` | `sistema-gestion-barberia-turnero.vercel.app` |
| App del barbero | `/frontend-barbero` | `sistema-gestion-barberia-barbero.vercel.app` |

El proyecto de gestión actúa de shell: su `/frontend/vercel.json` proxea
`/turnos/*` y `/barbero/*` a los otros dos proyectos vía rewrites.
`trailingSlash: false` para normalizar URLs y que los rewrites se apliquen
sobre `/turnos` (sin barra) — sin esa normalización, Vercel trata las URLs
con barra final como acceso a directorio y devuelve 404 antes de procesar
rewrites.

Durante la fase placeholder del turnero, los rewrites están limitados al
hostname `demo.barbermanager.app` mediante un `has` condition. Cuando se
deploye el código real (post-merge de `feature/turnero` a `main`), se
remueve esa restricción para que `/turnos/` y `/barbero/` funcionen también
en producción (kingsai y futuros tenants). Ver pendientes.

`VITE_API_URL` solo está seteada en el proyecto de gestión:
`VITE_API_URL = https://sistemagestionbarberia-production.up.railway.app`
(sin barra final). El turnero ya consume backend (`VITE_API_URL` pendiente de setear en Vercel).
El barbero ya consume backend (`VITE_API_URL` pendiente de setear en Vercel).

Wildcard domain `*.barbermanager.app` configurado en el proyecto de gestión
solamente; los otros dos se acceden vía rewrites del primero.

### Dominio y DNS
- Dominio: `barbermanager.app` (comprado en Namecheap).
- DNS delegado a Vercel via nameservers `ns1.vercel-dns.com` / `ns2.vercel-dns.com`.

### CORS
Función dinámica en `index.js`: acepta `localhost:5173` y cualquier `*.barbermanager.app`.

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

## Schema del turnero (ejecutado, sin código backend todavía)

Paso 1 de `plan_turnero_v2.md` ejecutado en Supabase el 2026-05-11. Resumen
de cambios:

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
- El frontend extrae el subdominio de `window.location.hostname` al arrancar.
- `publicHeaders` en `api.js` incluye `X-Tenant-Subdomain` en todas las funciones públicas.
- `apiFetch` incluye `X-Tenant-Subdomain` en todas las llamadas del panel admin.
- **Caché del middleware:** las entradas resueltas se guardan en memoria y solo se invalidan al reiniciar el servidor. Cambios sobre la tabla `tenant` (alta, baja, modificación de subdominio) no se reflejan hasta el próximo reinicio. Ver pendientes: endpoint de invalidación.

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
- `verificarPin()` en `api.js` distingue 402 (`err.bloqueado = true`) del resto de errores.
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
- Gestión (5 tabs) ✅

### Sistema
- Auth: bcrypt + JWT ✅ — `usuario_registro` eliminado del schema. `verificarToken` valida `tenant_id` cruzado (cierra agujero multi-tenant) e inyecta `req.rol` + `req.barbero_id`. JWT admin: `{ tenant_id, rol: 'admin' }` con 30d. JWT barbero: `{ tenant_id, rol: 'barbero', barbero_id }` con 30d (login via `POST /api/auth/barbero/login`). Middleware `requiereRol(...roles)` disponible pero todavía no aplicado en ninguna ruta.
- Bloqueo/aviso por suscripción ✅ mergeado a `main`.
- Multi-tenancy por subdominio ✅ en producción (`kingsai.barbermanager.app`).
- Migración de schema `refactor/schema-corte` ✅ mergeado a `main`.

---

## Pendientes

- **Endpoint admin de invalidación de caché:** `POST /api/admin/cache/invalidate` que reciba un subdominio y lo borre del caché en memoria del `tenantMiddleware`. Necesario para que cambios sobre `tenant` (alta, baja, modificación de subdominio) se reflejen sin reiniciar Railway. Hoy el caché solo se vacía al reiniciar el servidor.
- **Caja Tab 2 (Cierre de caja) y Tab 3 (Historial de cierres)** — plan completo en `plan_cierre_caja.txt`. Incluye `ALTER TABLE cierre_caja` con columnas nuevas (`efectivo_inicial`, `mp_inicial`, etc.). Branch sugerido: `feature/cierre-caja`.
- **Acceso de barberos al panel:** vista reducida con solo sus propios cortes.
- **Seguridad modo operativo:** PIN de apertura con token de 30 días en `localStorage` (Opción A — el iPad no vuelve a pedir PIN salvo expiración o cierre manual).
- **Log de actividad:** registrar quién eliminó qué y cuándo (hoy las eliminaciones no dejan rastro).
- **Generación de QR de Mercado Pago** para cobro en el momento desde el iPad.
- **Envío de planillas/datos por WhatsApp.**
- **Software propio de turnero** para integrar con el sistema de gestión. En curso en branch `feature/turnero`. Placeholders Vite ya deployados en Vercel y validados (routing por path funciona). Schema de DB ejecutado en Supabase (Paso 1 ✅). Setup operativo de Google Calendar completo: cuenta central `turnos.barbermanager@gmail.com` creada, proyecto en Google Cloud con Calendar API habilitada, OAuth consent screen publicado, credenciales Desktop app generadas, refresh token obtenido y cuatro variables `GOOGLE_*` cargadas en Railway (Paso 2 ✅). Refactor de auth + login barbero implementado y probado con Bruno (Paso 3 ✅). Services compartidos `services/googleCalendar.js` (crear/cancelar/actualizar evento, best-effort) y `services/mailer.js` (4 tipos de mail vía Nodemailer + SMTP de Gmail con App Password) implementados y validados end-to-end con los scripts `backend/src/scripts/probar*.js` (Paso 4 ✅). Endpoints públicos `/api/turnero/*` implementados con `controllers/turnero.js` + `routes/turnero.js` + `services/disponibilidadService.js` (algoritmo de slots con luxon en TZ Argentina) y `utils/constantes.js` (`TZ`, `ANTELACION_MINIMA_MINUTOS = 5`); cubre GET tenant/servicios/barberos/disponibilidad y POST crear/ver/cancelar/reprogramar turno con mapeo del constraint `turno_no_solapamiento` (`23P01`) a HTTP 409 e integración best-effort con Google Calendar y mailer. Validado end-to-end con Bruno en tenant demo (Paso 5 ✅). Endpoints del backoffice `/api/admin/*` implementados con services (`turnosService`, `horariosService`, `suspensionesService`, `planillaService`) y thin-wrapper controllers; scoping por rol (admin ve todo del tenant, barbero solo lo propio); `requiereRol('admin')` en barberos y servicios; rutas admin de barberos/servicios reusan handlers de `gestion.js` sin duplicación. `controllers/turnero.js` refactorizado para reusar helpers de `turnosService.js`. Validado con 34 tests automatizados (`scripts/testAdminEndpoints.js`) — 34/34 passed (Paso 6 ✅). `POST /api/cortes` modificado para aceptar `turno_id` opcional: si viene, inserta el corte vinculado y marca el turno como `completado`; si no viene, flujo walk-in idéntico al original. Cleanup manual si el UPDATE del turno falla. Tres errores específicos capturados: UNIQUE violation del índice parcial `corte_turno_unico` → 409, FK violation → 400, UUID inválido → 400. Validado con Bruno en tenant demo (Paso 7 ✅). Frontend funcional del turnero del cliente implementado: wizard de reserva (7 pasos: landing → servicio → barbero → fecha → horario → datos → confirmación) + pantalla de gestión del turno por token (ver datos, cancelar, reprogramar). `services/api.js` con 8 funciones que consumen `/api/turnero/`. Navegación por estado `paso` en `App.jsx`, sin react-router. Ruta `/turnos/gestionar/:token` detectada por `window.location.pathname`. Sin estilos — funcionalidad pura para validar integración con el backend. Probado end-to-end (Paso 8 ✅). Frontend funcional de la app del barbero implementado: Login (selector de barbero + PIN, mismo formato visual que gestión) → Dashboard (turnos del día como lista con gestión de estados: completado/no_asistió/cancelar) → Crear turno manual (wizard: servicio → fecha → horario → datos cliente con buscador de clientes existentes) → Agenda (timeline vertical tipo Google Calendar mobile con franjas horarias, bloques posicionados por hora, indicador de hora actual, navegación por día) → Mi Planilla (detalle + resumen semanal navegable) → Gestión (tabs: Mis Horarios con editor de bloques semanales + Mis Suspensiones con manejo de conflicto 409) → Clientes (lista de clientes históricos del barbero con filtro local). `services/api.js` con 17 funciones (4 públicas + 13 protegidas vía `apiFetch`). Navegación por estado `seccion` en `App.jsx`, sin react-router. Token JWT en variable de módulo (mismo patrón que gestión). Endpoint nuevo `GET /api/admin/clientes/mis-clientes` (query derivada de turno, sin tabla extra). Sin estilos — funcionalidad pura. Probado end-to-end (Paso 9 ✅). Próximo: Paso 10 del plan (migración de rutas `/api/gestion/*` → `/api/admin/*` en frontend de gestión).
- **Remover `has` condition de `frontend/vercel.json`** cuando se deploye el código real del turnero. Hoy los rewrites a `/turnos/*` y `/barbero/*` solo se aplican en `demo.barbermanager.app` para no afectar producción durante la fase placeholder.

---

## Deudas técnicas conocidas

- **Columna `tenant.configuracion`:** se setea por default con `{"ciudad": "Buenos Aires", "moneda": "ARS"}` en `crearTenant.js` para mantener consistencia con los tenants existentes, pero falta verificar si efectivamente se usa en algún controller. Si no se usa, evaluar si conviene eliminarla o si es para uso futuro.
- **Caché del `tenantMiddleware` sin invalidación:** ver pendiente "Endpoint admin de invalidación de caché". Es la mitigación planificada.
- **Logging global filtra el body completo de cada request** (`index.js`). En las rutas de auth (`/api/auth/verificar-pin`, `/api/auth/barbero/login`) eso significa que el PIN viaja en texto plano a los logs de Railway. A mitigar agregando una lista de rutas cuyo body no se loguea (o de keys sensibles que se reemplazan por `***`).
- **Inconsistencia de nombres en rutas de auth:** `POST /api/auth/verificar-pin` para admin vs `POST /api/auth/barbero/login` para barbero. Renombrar el del admin a `/login` queda postergado a la migración de `/api/gestion/*` a `/api/admin/*` (Paso 10 del plan).
- **Coexistencia `/api/gestion/*` y `/api/admin/*`:** las rutas viejas (`/api/gestion/barberos`, `/api/gestion/servicios`, `/api/planillas/*`) siguen activas porque el frontend de gestión las consume. Las nuevas `/api/admin/barberos` y `/api/admin/servicios` reusan los mismos handlers con `requiereRol('admin')`. La migración del frontend a los nuevos prefijos se hace en el Paso 10.
- **Mailing del turnero vía Nodemailer + SMTP de Gmail.** Hoy el `services/mailer.js` envía desde `turnos.barbermanager@gmail.com` usando una App Password (16 chars, generada con 2FA activa). Gmail limita a ~500 mails/día por cuenta. Cuando el volumen crezca (varios tenants activos), migrar a Resend (o Postmark) con dominio propio `turnos@barbermanager.app`: requiere verificar el dominio en Vercel DNS con registros SPF/DKIM y reemplazar el transport interno del service. La API pública del service (`enviarConfirmacion`, `enviarCancelacion`, `enviarReprogramacion`, `enviarCancelacionPorSuspension`) no cambia, por eso queda encapsulado.
- **`controllers/auth.js` no usa luxon todavía.** Calcula el día del mes en TZ Argentina con `new Date(toLocaleString('en-US', {timeZone}))` (patrón previo a la introducción de luxon). Con la dependencia ya instalada para el turnero, conviene migrar ese cálculo en un chat aparte para no mezclar refactors con features.
- **`POST /api/turnero/turnos`, `/reprogramar` y `POST /api/admin/turnos` no validan que `inicio` caiga en un slot real.** Confían en `/api/turnero/disponibilidad` + el frontend para elegir solo slots válidos. El constraint EXCLUDE GIST protege contra solapamientos con otros turnos, pero un `inicio` fuera de bloque horario o sobre una suspensión se aceptaría si no choca con otro turno reservado. Blindar requeriría reejecutar el algoritmo en cada POST. Postergado.
- **Upsert de cliente pisa `nombre/telefono`** con los últimos datos enviados. Aceptado para MVP, pantalla de unificación de clientes pendiente.
- **Título del evento de Google Calendar** está hardcodeado como `${servicio.nombre} — ${cliente.nombre}` en `services/googleCalendar.js#armarCuerpoEvento`. Pedido cambiarlo a solo `cliente.nombre` en el chat aparte de reescritura de templates de mail.

*— Fin del documento —*
