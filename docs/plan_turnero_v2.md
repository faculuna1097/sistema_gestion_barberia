# Plan del turnero (v2) — núcleo de decisiones

> ✅ **Implementado y en producción** (turnero del cliente + app del barbero + cambios en el
> panel de gestión). Documento **archivado**: solo el "por qué". Schema en
> [`SQL_Schema.md`](SQL_Schema.md) y resumen en [`estado_actual.md`](estado_actual.md)
> §Schema; auth vigente en `estado_actual.md` §Sistema; rutas en
> [`ruta_proyecto.md`](ruta_proyecto.md).

## Contexto y objetivo

Turnero online con **tres frontends** que comparten backend y DB con el sistema de gestión:

1. **Gestión** (dueño/admin) → `{sub}.barbermanager.app/` — panel completo, PIN.
2. **Turnero del cliente** → `/turnos/` — reserva anónima, sin login.
3. **App del barbero** → `/barbero/` — cada barbero ve lo suyo; login por nombre + PIN.

Las tres se deployan como **path rewrites del mismo dominio del tenant** (Vercel), multi-tenant
por subdominio.

## Decisiones arquitectónicas (el núcleo)

- **Disponibilidad calculada al vuelo**, sin tabla de slots pre-generada. Slots de duración
  **configurable por tenant** (`tenant.duracion_slot_minutos`); cada servicio ocupa **N slots**
  (`servicio.cantidad_slots`) → duración real = slot × cantidad.
- **Identidad del cliente persistente** entre reservas (tabla `cliente`). `email`/`telefono`
  **nullable a nivel DB**; la obligatoriedad se valida **por contexto en cada controller** (el
  turnero público los exige; la app del barbero permite vacíos, porque crea turnos a clientes de
  los que no siempre tiene los datos).
- **Trazabilidad turno → corte** vía FK opcional `corte.turno_id`.
- **Google Calendar por invitación por email (Arquitectura A)** — ver abajo.
- **Tres consumidores, un solo middleware de auth.** `tenantMiddleware` global + **un solo**
  `verificarToken` que distingue rol por el claim del JWT. La diferencia admin/barbero **no es
  routing** (no hay prefijos `/admin` vs `/barbero`) sino **permisos**: `requiereRol(...roles)`
  para lo exclusivo de admin; el resto scopea por rol dentro del controller.
- **Endpoints separados por audiencia, no por rol:** `/api/turnero/*` (público, cliente anónimo)
  vs `/api/admin/*` (backoffice, admin+barbero). Dentro del backoffice, admin vs barbero se
  resuelve por el JWT.
- **Controllers thin-wrapper, lógica en services** (`turnosService`, etc.) → evita duplicar la
  rama admin/barbero.

## Por qué del schema (lo no obvio)

El SQL completo está en `SQL_Schema.md`; acá solo las decisiones que no se leen del schema:

- **`turno` con constraint `EXCLUDE USING gist` (`barbero_id` =, `tstzrange(inicio,fin)` &&) sobre
  `estado='reservado'`.** Previene **a nivel DB** que dos turnos del mismo barbero se solapen,
  resolviendo la race condition de reserva **sin transacción explícita** (el Session Pooler de
  Supabase no las soporta). El backend captura la violación (`23P01`) y la mapea a **HTTP 409**.
  Requiere la extensión `btree_gist`.
- **`inicio` y `fin` ambos almacenados** (no solo `inicio` + duración): así un turno viejo
  mantiene su duración aunque después cambie la duración del servicio.
- **`token_gestion`** UUID impredecible, va en el link del mail. Se genera **siempre** por
  simplicidad (un token que nadie usa no hace daño), aunque los turnos sin email no lo necesiten.
- **`cliente` UNIQUE `(tenant_id, email)`:** en Postgres `NULL ≠ NULL`, así que coexisten
  múltiples clientes sin email; el **upsert por email** solo aplica cuando hay email (si no, se
  inserta cliente nuevo).
- **`barbero.email` nullable:** un barbero sin email no rompe nada — su turno se crea igual, solo
  **no se sincroniza con Google Calendar**.
- **`corte.turno_id` nullable + UNIQUE parcial** (`WHERE turno_id IS NOT NULL`): un turno no puede
  quedar vinculado a dos cortes (doble click/bug), pero permite **múltiples walk-ins** con
  `turno_id NULL`.
- **`barbero_suspension`**: timestamps (no fechas) para rangos finos; **sin FK con `turno`** — si
  una suspensión nueva pisa turnos, el backend los cancela al crearla (con confirmación explícita).

## Algoritmo de disponibilidad

`GET /api/turnero/disponibilidad` calcula los inicios disponibles, todo en JS y en TZ
`America/Argentina/Buenos_Aires` (luxon):

1. Generar grilla cruda desde los bloques de `barbero_horario` del día, cada
   `duracion_slot_minutos`.
2. `fin = inicio + slot × cantidad_slots`; descartar los que se pasan del bloque.
3. Filtrar solapamientos con turnos `reservado` y con suspensiones (`a_ini < b_fin AND b_ini < a_fin`).
4. Si la fecha es hoy, descartar slots demasiado cercanos al ahora: `inicio <= now() +
   ANTELACION_MINIMA_MINUTOS` (5 min, constante en `utils/constantes.js`, no magic number).

(El cortocircuito por día cerrado/feriado del tenant lo agregó después
[`plan_horario_atencion.md`](plan_horario_atencion.md).)

## Google Calendar — Arquitectura A (invitación por email)

**Una sola cuenta central** (`turnos.barbermanager@gmail.com`, no una por tenant) crea cada
evento e invita al barbero como `attendee` usando `barbero.email`. El default de Gmail
("agregar invitaciones automáticamente") hace que el evento aparezca en su calendar sin que
acepte nada.

- **Best-effort:** si la API falla, el turno se crea/cancela igual en la DB; el error se loguea,
  `google_event_id` queda null. No rompe el flujo.
- Se invoca **en todos los turnos** (sin importar el origen) siempre que el barbero tenga email
  cargado. Solo necesita el email del barbero, no del cliente.
- **Migrar a Arquitectura B** (OAuth por barbero, lectura bidireccional del calendar) queda como
  futuro si alguna vez se necesita.

## Anti-escalada horizontal (scoping del backoffice)

En los handlers `/api/admin/*` sobre recursos de un barbero, si `req.rol === 'barbero'` se
**ignora cualquier `barbero_id` del body/URL** y se usa siempre `req.barbero_id` del JWT → un
barbero no puede crear/modificar/cancelar a nombre de otro. Si es admin, el `barbero_id` se toma
del body/URL. Además `verificarToken` compara `payload.tenant_id` contra el del subdominio (403
si no coinciden) — cierra un agujero multi-tenant.

## Trabajo futuro (abierto)

- **Pantalla de unificación de clientes duplicados** (cliente reserva con otro email, o "Juan sin
  email" del barbero vs "Juan con email" online). Aceptado para MVP.
- **Eliminar `tenant.booking_url`** cuando todos los tenants usen el turnero propio.
- **Migrar el logo viejo y `DROP COLUMN tenant.logo`** (el turnero/barbero ya leen el logo de
  `tenant_imagen`; falta que `frontend/` deje de leer la columna).
- **Reglas barbero ↔ servicio** (hoy todos atienden todo; el query param `servicio_id` en
  `GET /api/turnero/barberos` ya está preparado).
- **Bot de WhatsApp** para suspender turnos (`barbero_suspension.origen='whatsapp'` ya previsto).
- **Tablas `notificaciones`/`mails_enviados`** (trazabilidad) y **`metricas_diarias`** (rollup
  para dashboards cuando `corte` crezca).

*— Fin del documento (archivado: núcleo de decisiones) —*
