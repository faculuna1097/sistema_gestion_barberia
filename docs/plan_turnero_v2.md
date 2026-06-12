# BARBERSHOP MANAGER — Plan de Implementación del Turnero
**Versión:** 2.0
**Fecha de planificación:** Mayo 2026
**Branch sugerido:** `feature/turnero`
**Estado:** Pendiente de ejecución

---

## 1. Contexto y objetivo

Construir un sistema de turnero online con dos frontends nuevos, ambos
mobile-first, que comparten backend y base de datos con el sistema de gestión
existente.

**Las tres apps frontend del proyecto:**

1. **Gestión (existente, dueño/admin)** → `{subdominio}.barbermanager.app/`
   Panel completo de administración. Acceso por PIN admin.
2. **Turnero del cliente (nuevo)** → `{subdominio}.barbermanager.app/turnos/`
   El cliente final reserva su turno. Anónimo, sin login.
3. **App del barbero (nuevo)** → `{subdominio}.barbermanager.app/barbero/`
   Cada barbero ve solo lo suyo: planilla, agenda, suspensiones, creación
   manual de turnos. Login por nombre + PIN.

**Decisiones arquitectónicas tomadas en chats previos:**
- Backend y base de datos compartidos con el sistema de gestión existente.
- Tres apps frontend separadas, deployadas como path rewrites del mismo
  dominio del tenant.
- Multi-tenant resuelto por subdominio, igual que el sistema de gestión.
- Slots de duración configurable por tenant; cada servicio ocupa N slots.
- Disponibilidad calculada al vuelo (sin tabla de slots pre-generada).
- Identidad del cliente persistente entre reservas (tabla `cliente`).
- `email` y `telefono` del cliente son nullable a nivel DB. La obligatoriedad
  se valida en cada controller según el contexto (turnero público obliga,
  app del barbero permite vacíos).
- Trazabilidad turno → corte mediante FK opcional.
- Google Calendar integrado vía invitación por email (Arquitectura A).
- Tres tipos de consumidores del backend, cada uno con su middleware de auth:
  cliente anónimo (turnero), admin (gestión), barbero (app).
- Endpoints separados por audiencia (`/api/turnero/` para el cliente
  anónimo y `/api/admin/` para el backoffice). Dentro del backoffice, la
  separación admin/barbero se resuelve por rol en el JWT, no por prefijo
  de URL.

---

## 2. Cambios de schema en la base de datos

Ejecutar en el SQL Editor de Supabase, en este orden. Verificar el resultado de
cada paso antes de continuar.

### 2.1 Tablas nuevas

#### Paso 1 — Tabla `cliente`

```sql
CREATE TABLE public.cliente (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  telefono text,
  email text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cliente_pkey PRIMARY KEY (id),
  CONSTRAINT cliente_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT cliente_tenant_email_unique UNIQUE (tenant_id, email)
);
```

**Notas:**
- `nombre` es lo único obligatorio. `email` y `telefono` son nullable porque
  cuando el barbero crea un turno manualmente puede no tener esos datos.
- En PostgreSQL, `NULL ≠ NULL` para efectos de UNIQUE. Pueden coexistir
  múltiples clientes con `email = NULL` sin colisión, y la unicidad sigue
  funcionando para los que sí tienen email cargado.
- El upsert por `(tenant_id, email)` solo aplica cuando hay email. Si no hay
  email (creación desde app del barbero), siempre se inserta cliente nuevo.
- La normalización del email a lowercase se hace en backend antes del upsert.

#### Paso 2 — Tabla `barbero_horario`

```sql
CREATE TABLE public.barbero_horario (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  barbero_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  CONSTRAINT barbero_horario_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_horario_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT barbero_horario_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.barbero(id) ON DELETE CASCADE,
  CONSTRAINT barbero_horario_rango_valido CHECK (hora_fin > hora_inicio)
);
```

**Notas:**
- `dia_semana`: 0 = domingo, 1 = lunes, ..., 6 = sábado (convención de
  PostgreSQL `EXTRACT(DOW FROM fecha)` y de JavaScript `Date.getDay()`).
- Múltiples registros por día permitidos para representar pausas (ej: turno
  mañana 09:00–13:00 y turno tarde 15:00–19:00).
- No-solapamiento entre bloques del mismo día garantizado a nivel DB con un
  constraint `EXCLUDE USING gist` sobre `(barbero_id, dia_semana, timerange(hora_inicio, hora_fin, '[)'))`.
  Requiere crear el tipo `timerange` (PostgreSQL no trae rango para `time`).
  El backend además valida en JS al hacer PUT para devolver un error legible.

#### Paso 3 — Tabla `barbero_suspension`

```sql
CREATE TABLE public.barbero_suspension (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  barbero_id uuid NOT NULL,
  desde timestamp with time zone NOT NULL,
  hasta timestamp with time zone NOT NULL,
  motivo text,
  origen text NOT NULL DEFAULT 'admin' CHECK (origen IN ('admin', 'barbero', 'whatsapp')),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT barbero_suspension_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_suspension_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT barbero_suspension_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.barbero(id) ON DELETE CASCADE,
  CONSTRAINT barbero_suspension_rango_valido CHECK (hasta > desde)
);

CREATE INDEX idx_suspension_barbero_rango ON public.barbero_suspension (barbero_id, desde, hasta);
```

**Notas:**
- Bloqueos puntuales: vacaciones, francos extraordinarios, "me tomo la tarde".
- `desde` y `hasta` son timestamps (no fechas) para permitir rangos finos.
- `origen` distingue suspensiones creadas desde panel admin (`admin`), desde
  la app del barbero (`barbero`), o desde el bot de WhatsApp (`whatsapp`,
  futuro).
- No tiene FK con `turno`. Si una suspensión nueva pisa turnos existentes, el
  backend cancela esos turnos al crear la suspensión (con confirmación
  explícita).

#### Paso 4 — Tabla `turno`

```sql
CREATE TABLE public.turno (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  barbero_id uuid NOT NULL,
  servicio_id uuid NOT NULL,
  inicio timestamp with time zone NOT NULL,
  fin timestamp with time zone NOT NULL,
  estado text NOT NULL DEFAULT 'reservado' CHECK (estado IN ('reservado', 'cancelado', 'completado', 'no_asistio')),
  origen_creacion text NOT NULL DEFAULT 'turnero' CHECK (origen_creacion IN ('turnero', 'barbero', 'admin')),
  token_gestion text NOT NULL UNIQUE,
  google_event_id text,
  created_at timestamp with time zone DEFAULT now(),
  cancelado_en timestamp with time zone,
  cancelado_por text CHECK (cancelado_por IN ('cliente', 'barbero', 'admin', 'suspension')),
  CONSTRAINT turno_pkey PRIMARY KEY (id),
  CONSTRAINT turno_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT turno_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id),
  CONSTRAINT turno_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.barbero(id),
  CONSTRAINT turno_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicio(id),
  CONSTRAINT turno_rango_valido CHECK (fin > inicio)
);

CREATE INDEX idx_turno_barbero_inicio ON public.turno (barbero_id, inicio) WHERE estado = 'reservado';
CREATE INDEX idx_turno_tenant_inicio  ON public.turno (tenant_id, inicio)  WHERE estado = 'reservado';
CREATE INDEX idx_turno_cliente         ON public.turno (cliente_id);

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.turno
  ADD CONSTRAINT turno_no_solapamiento
  EXCLUDE USING gist (
    barbero_id WITH =,
    tstzrange(inicio, fin, '[)') WITH &&
  ) WHERE (estado = 'reservado');
```

**Notas:**
- `inicio` y `fin` ambos almacenados explícitamente. Permite que turnos
  viejos mantengan su duración aunque cambie la duración del servicio.
- El constraint `EXCLUDE USING gist` previene a nivel DB que dos turnos
  `reservado` del mismo barbero se solapen, resolviendo la race condition
  de reserva sin necesidad de transacción explícita (que Session Pooler no
  soporta). El backend captura la violación del constraint y la mapea a
  HTTP 409.
- `btree_gist` es una extensión estándar de PostgreSQL que permite usar
  operadores de igualdad (como `=` sobre `uuid`) dentro de un constraint
  GIST. Ya viene incluida en Supabase, solo hay que activarla.
- `estado`: `reservado` (activo, ocupa slot), `cancelado`, `completado`
  (cliente vino, corte registrado), `no_asistio`.
- `origen_creacion`: distingue de qué frontend salió la reserva. Útil para
  estadísticas y para saber si el turno tiene email del cliente garantizado
  (si origen es `turnero`) o no (si es `barbero` o `admin`).
- `token_gestion`: UUID v4 impredecible. Va en el link del mail
  (`https://demo.barbermanager.app/turnos/{token}/cancelar`). Nullable a
  nivel lógico (los turnos creados desde app barbero/admin sin email no
  necesitan token), pero a nivel DB se genera siempre por simplicidad — no
  hace daño tener un token que nadie va a usar.
- `google_event_id`: ID del evento de Google Calendar. Nullable porque el
  evento puede no haberse creado (barbero sin email registrado, fallo de
  API, etc.).
- `cancelado_por='suspension'`: cancelaciones automáticas disparadas por una
  suspensión nueva.
- Índices parciales sobre `estado='reservado'` aceleran las queries de
  disponibilidad.

### 2.2 Modificaciones a tablas existentes

#### Paso 5 — Agregar `duracion_slot_minutos` a `tenant`

```sql
ALTER TABLE public.tenant
  ADD COLUMN duracion_slot_minutos integer NOT NULL DEFAULT 30
    CHECK (duracion_slot_minutos > 0 AND duracion_slot_minutos <= 240);
```

**Notas:** unidad de tiempo de la grilla del tenant. Configurable desde
sección admin a futuro.

#### Paso 6 — Agregar `cantidad_slots` a `servicio`

```sql
ALTER TABLE public.servicio
  ADD COLUMN cantidad_slots integer NOT NULL DEFAULT 1
    CHECK (cantidad_slots > 0 AND cantidad_slots <= 20);
```

**Notas:** cuántos slots ocupa el servicio. Duración real en minutos =
`tenant.duracion_slot_minutos * servicio.cantidad_slots`.

#### Paso 7 — Agregar `email` a `barbero`

```sql
ALTER TABLE public.barbero
  ADD COLUMN email text;
```

**Notas:** nullable para no romper barberos existentes de Kingsai. Cuando un
barbero no tiene mail cargado, sus turnos no se sincronizan con Google
Calendar (el turno se crea normal, solo no aparece en el calendar).

#### Paso 8 — Agregar `turno_id` a `corte`

```sql
ALTER TABLE public.corte
  ADD COLUMN turno_id uuid REFERENCES public.turno(id);

CREATE UNIQUE INDEX corte_turno_unico
  ON public.corte (turno_id)
  WHERE turno_id IS NOT NULL;
```

**Notas:** nullable. Un corte puede venir de un turno o ser walk-in. Cuando
se registra un corte vinculado, el turno pasa a `completado`. El `UNIQUE`
parcial garantiza que un mismo turno no pueda quedar vinculado a dos cortes
(por doble click o bug), pero permite múltiples cortes con `turno_id NULL`
(walk-ins).

#### Paso 9 — Limpieza de `gasto.created_at`

```sql
ALTER TABLE public.gasto DROP COLUMN created_at;
```

**Notas:** deuda detectada del refactor anterior (`refactor/schema-corte`).
Por consistencia con `corte` y `venta`.

---

## 3. Backend — arquitectura general

### 3.1 Tres tipos de consumidores, un solo middleware de auth

| Consumidor | Frontend | Identificación | Middleware |
|---|---|---|---|
| Cliente anónimo | turnero | Solo subdominio | `tenantMiddleware` (existente) |
| Admin/Dueño | gestión | JWT con `{ tenant_id, rol: 'admin' }` | `tenantMiddleware` + `verificarToken` (refactorizado) |
| Barbero | app barbero | JWT con `{ tenant_id, rol: 'barbero', barbero_id }` | `tenantMiddleware` + `verificarToken` (refactorizado) |

El `tenantMiddleware` corre globalmente como hoy. Existe **un solo**
middleware de autenticación (`verificarToken`) que valida el JWT y distingue
roles por el claim `rol` del payload. La diferencia entre admin y barbero
deja de ser una cuestión de routing (no hay prefijos `/api/admin/*` vs
`/api/barbero/*`) y pasa a ser una cuestión de permisos, resueltos con un
middleware adicional `requiereRol`.

### 3.2 Refactor de `verificarToken`

El `verificarToken` existente se actualiza para:

1. Leer y validar el JWT como hoy.
2. **Comparar `payload.tenant_id` contra `req.tenant_id`** (el que ya inyectó
   `tenantMiddleware` desde el subdominio). Si no coinciden, devolver 403.
   Esto cierra un agujero multi-tenant preexistente.
3. Inyectar `req.rol` y `req.barbero_id` (este último solo si el rol es
   `barbero`) en el request.

```javascript
// /backend/src/middlewares/authMiddleware.js
import jwt from 'jsonwebtoken';

export const verificarToken = (req, res, next) => {
  console.log('[authMiddleware] verificarToken — request recibido | ruta:', req.method, req.url);

  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[authMiddleware] Error: header Authorization ausente o con formato incorrecto');
    return res.status(401).json({ error: 'Acceso no autorizado — token requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Validación cruzada: el tenant del JWT debe coincidir con el del subdominio.
    if (payload.tenant_id !== req.tenant_id) {
      console.error('[authMiddleware] Error: el tenant del token no coincide con el del subdominio');
      return res.status(403).json({ error: 'El token no corresponde a este tenant' });
    }

    req.tenant_id  = payload.tenant_id;
    req.rol        = payload.rol;
    req.barbero_id = payload.barbero_id; // solo presente si rol === 'barbero'

    console.log('[authMiddleware] verificarToken — completado | rol:', req.rol, '| barbero_id:', req.barbero_id);
    next();
  } catch (err) {
    console.error('[authMiddleware] Error en verificarToken:', err.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};
```

### 3.3 Nuevo middleware `requiereRol`

Para rutas que solo puede tocar el admin (ej: alta de barberos, ABM de
servicios), se agrega un middleware factory que recibe la lista de roles
permitidos y devuelve 403 si el rol del request no está en la lista.

```javascript
// /backend/src/middlewares/requiereRolMiddleware.js
export const requiereRol = (...rolesPermitidos) => (req, res, next) => {
  if (!rolesPermitidos.includes(req.rol)) {
    console.error('[requiereRol] Acceso denegado | rol:', req.rol, '| requeridos:', rolesPermitidos);
    return res.status(403).json({ error: 'No tenés permiso para esta acción' });
  }
  next();
};
```

Para rutas que aceptan ambos roles (turnos, horarios, suspensiones,
planilla, clientes), no se usa `requiereRol`. El scoping fino se hace dentro
del controller mirando `req.rol` y `req.barbero_id`.

### 3.4 Endpoints de autenticación

#### Login del admin (existente — se ajusta)

`POST /api/auth/verificar-pin` (ya existe; nombre histórico que se mantiene
para no impactar el frontend de gestión).

**Cambio:** al firmar el JWT, agregar el claim `rol: 'admin'` y
`expiresIn: '30d'`. Antes expiraba a las 12h; pasamos a 30 días explícitos
por consistencia con el login del barbero.

#### Login del barbero (nuevo)

`POST /api/auth/barbero/login`

**Body:** `{ barbero_id, pin }`

**Lógica:**
1. Buscar barbero por `(tenant_id, id, pin)` con `activo = true`.
2. Si no existe, devolver 401.
3. Si existe, generar JWT con payload `{ tenant_id, rol: 'barbero', barbero_id }`
   y `expiresIn: '30d'`. Devolver `{ token, barbero: { id, nombre } }`.

**Por qué se selecciona el barbero antes del PIN:** los PINs se repiten
entre barberos del mismo tenant en la práctica. La app del barbero muestra
una lista de los barberos del tenant (consumida desde el endpoint público
existente `GET /api/barberos`), el barbero toca el suyo, y entonces ingresa
el PIN. Si un barbero olvida su PIN, el dueño lo resetea sin afectar a los
demás.

**Por qué 30 días:** la app del barbero se usa varias veces por día. Un JWT
de 1h forzaría re-login constante. Sin refresh token para MVP; cuando expire,
re-login con PIN.

### 3.5 Estructura de archivos nuevos

Los controllers son **thin wrappers**: arman los filtros según `req.rol` y
`req.barbero_id`, y llaman al service correspondiente. Toda la lógica de
negocio vive en services, lo que evita la duplicación admin/barbero del
plan original.

```
controllers/
  turnero.js                → endpoints públicos del turnero (cliente)
  authBarbero.js            → login del barbero
  turnos.js                 → CRUD turnos (scope según rol)
  horarios.js               → CRUD horarios (scope según rol)
  suspensiones.js           → CRUD suspensiones (scope según rol)
  clientes.js               → búsqueda y listado
  planilla.js               → planilla semanal (scope según rol)
routes/
  turnero.js
  authBarbero.js
  turnos.js
  horarios.js
  suspensiones.js
  clientes.js
  planilla.js
middlewares/
  requiereRolMiddleware.js  → requiereRol(...roles)
services/
  turnosService.js          → lógica de negocio de turnos
  horariosService.js
  suspensionesService.js
  planillaService.js
  googleCalendar.js         → integración con Google Calendar API
  mailer.js                 → envío de mails (confirmaciones, cancelaciones)
```

### 3.6 Registro en `index.js`

```javascript
// Pública (turnero del cliente)
app.use('/api/turnero',           turneroRoutes);

// Logins (sin verificarToken, solo tenantMiddleware)
app.use('/api/auth',              authAdminRoutes);    // ya existe
app.use('/api/auth/barbero',      authBarberoRoutes);  // nuevo

// Backoffice (autenticado con verificarToken; cada ruta declara qué roles acepta)
app.use('/api/admin/turnos',         verificarToken,                          turnosRoutes);
app.use('/api/admin/horarios',       verificarToken,                          horariosRoutes);
app.use('/api/admin/suspensiones',   verificarToken,                          suspensionesRoutes);
app.use('/api/admin/planilla',       verificarToken,                          planillaRoutes);
app.use('/api/admin/clientes',       verificarToken,                          clientesRoutes);
app.use('/api/admin/barberos',       verificarToken, requiereRol('admin'),    barberosRoutes);
app.use('/api/admin/servicios',      verificarToken, requiereRol('admin'),    serviciosRoutes);
```

Las rutas que aceptan ambos roles (turnos, planilla, horarios,
suspensiones, clientes) no llevan `requiereRol`. El controller decide qué
ve cada rol mirando `req.rol`. Las rutas exclusivas de admin (ABM de
barberos y servicios) sí lo llevan.

---

## 4. Endpoints públicos del turnero (`/api/turnero/*`)

Sin token. Solo `tenantMiddleware`.

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/turnero/tenant` | Datos públicos del tenant (nombre, logo). |
| GET | `/api/turnero/servicios` | Servicios activos con precio y duración (en minutos). |
| GET | `/api/turnero/barberos?servicio_id=X` | Barberos activos. Por ahora todos atienden todos los servicios. |
| GET | `/api/turnero/disponibilidad?barbero_id=X&servicio_id=Y&fecha=YYYY-MM-DD` | Slots disponibles (ver sección 7). |
| POST | `/api/turnero/turnos` | Crea el turno. Body: `{ servicio_id, barbero_id, inicio, nombre, telefono, email }`. **Email y teléfono obligatorios** (validados en este controller). Hace upsert del cliente por email. Setea `origen_creacion='turnero'`. Dispara creación de evento en Google Calendar. Devuelve `{ turno_id, token_gestion }`. |
| GET | `/api/turnero/turnos/:token` | Datos del turno por token (página gestión del turno). |
| POST | `/api/turnero/turnos/:token/cancelar` | Cancela el turno. Borra el evento en Google Calendar. |
| POST | `/api/turnero/turnos/:token/reprogramar` | Body con nueva fecha/hora. Actualiza el turno y el evento de Google Calendar. |

---

## 5. Endpoints del backoffice (`/api/admin/*`)

Todos pasan por `verificarToken`. El scoping fino entre admin y barbero se
hace dentro del controller usando `req.rol` y `req.barbero_id`. Las rutas
que solo admite admin llevan además `requiereRol('admin')`.

### Patrón general de scoping dentro de cada controller

```javascript
// En cualquier handler que liste recursos
const filtros = { tenant_id: req.tenant_id };
if (req.rol === 'barbero') {
  filtros.barbero_id = req.barbero_id;
} else if (req.query.barbero_id) {
  filtros.barbero_id = req.query.barbero_id;
}
```

Para POST/PATCH/DELETE sobre recursos asociados a un barbero específico:

- Si `req.rol === 'barbero'`, **se ignora cualquier `barbero_id` del body o
  de la URL** y se usa siempre `req.barbero_id`. Esto preserva la garantía
  contra escalada horizontal: un barbero malicioso no puede crear,
  modificar o cancelar a nombre de otro.
- Si `req.rol === 'admin'`, el `barbero_id` se toma del body o de la URL.

### `/api/admin/turnos` — gestión de turnos

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/admin/turnos?fecha=YYYY-MM-DD` | Si rol=admin: turnos del día de todos los barberos. Si rol=barbero: sus turnos del día. |
| GET | `/api/admin/turnos?barbero_id=X&desde=...&hasta=...` | Turnos de un barbero en un rango. Si rol=barbero, `barbero_id` se ignora y se usa `req.barbero_id`. |
| POST | `/api/admin/turnos` | Reserva manual. Body: `{ servicio_id, barbero_id, inicio, nombre, telefono?, email? }`. **Email y teléfono opcionales.** Si rol=admin: `origen_creacion='admin'`, `barbero_id` del body. Si rol=barbero: `origen_creacion='barbero'`, `barbero_id=req.barbero_id` (ignora body). |
| PATCH | `/api/admin/turnos/:id/estado` | Cambia el estado a `completado` o `no_asistio`. Si rol=barbero, solo permite afectar turnos donde `barbero_id = req.barbero_id` (404 si intenta tocar uno ajeno). |
| DELETE | `/api/admin/turnos/:id` | Cancela el turno. Misma restricción de scope para rol=barbero. |

### `/api/admin/horarios` — horarios

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/admin/horarios/:barbero_id` | Horarios del barbero. Si rol=barbero y `:barbero_id !== req.barbero_id`, devuelve 403. |
| PUT | `/api/admin/horarios/:barbero_id` | Reemplaza completo el horario semanal. Body: array de bloques `{ dia_semana, hora_inicio, hora_fin }`. Misma restricción de scope para rol=barbero. |

### `/api/admin/suspensiones` — suspensiones

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/admin/suspensiones?barbero_id=X` | Suspensiones futuras. Si rol=admin: del barbero pedido. Si rol=barbero: las propias (se ignora `barbero_id` del query). |
| POST | `/api/admin/suspensiones` | Crea suspensión. Body: `{ barbero_id, desde, hasta, motivo? }`. Si rol=admin: `origen='admin'`, `barbero_id` del body. Si rol=barbero: `origen='barbero'`, `barbero_id=req.barbero_id`. Si pisa turnos reservados, devuelve 409 con la lista. Reenviar con `confirmar_cancelacion: true` para ejecutar. Por cada turno cancelado por la suspensión se manda mail al cliente con `services/mailer.js` (motivo de la suspensión + link al turnero para reservar de nuevo). |
| DELETE | `/api/admin/suspensiones/:id` | Elimina la suspensión. No recupera turnos cancelados. Si rol=barbero, solo permite eliminar las propias. |

### `/api/admin/clientes` — búsqueda

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/admin/clientes?busqueda=X` | Búsqueda por nombre/email/teléfono. Disponible para ambos roles. |

### `/api/admin/planilla` — planilla semanal

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/admin/planilla?semana=YYYY-MM-DD&barbero_id=X` | Detalle semanal. Si rol=admin: del barbero pedido. Si rol=barbero: la propia (se ignora `barbero_id` del query). |
| GET | `/api/admin/planilla/resumen?semana=YYYY-MM-DD&barbero_id=X` | Resumen semanal con la misma regla de scoping. |

### Rutas exclusivas de admin

Estas llevan `requiereRol('admin')` en `index.js` y devuelven 403 para
cualquier otro rol:

- `/api/admin/barberos/*` — ABM de barberos (existente, sin cambios).
- `/api/admin/servicios/*` — ABM de servicios (existente, sin cambios).

---

## 6. Modificación al endpoint existente `POST /api/cortes`

El controller `createCorte` recibe ahora un campo opcional `turno_id` en el
body. Si viene:

1. Inserta el corte con `turno_id`.
2. UPDATE en `turno` seteando `estado = 'completado'`.

Operaciones secuenciales con cleanup manual (Session Pooler de Supabase no
permite transacciones explícitas): si el INSERT del corte tiene éxito pero
el UPDATE del turno falla, el handler debe ejecutar un `DELETE` del corte
recién creado para evitar inconsistencia. El `UNIQUE` parcial sobre
`corte.turno_id` (sección 2.2 Paso 8) previene el caso opuesto de dos
cortes vinculados al mismo turno por doble click.

Adicionalmente, la pantalla "registrar corte" en el frontend de gestión y en
la app del barbero consume `GET /api/admin/turnos?fecha=YYYY-MM-DD` (que ya
scopea por rol — admin ve todos los del tenant, barbero ve solo los
propios). No hace falta un endpoint extra.

---

## 7. Algoritmo de disponibilidad

El endpoint `GET /api/turnero/disponibilidad?barbero_id=X&servicio_id=Y&fecha=YYYY-MM-DD`
calcula los slots de inicio disponibles. Toda la lógica vive en JS.

**Pasos:**

1. **Generar grilla cruda.** Para cada bloque de `barbero_horario` del barbero
   ese día de la semana, generar todos los inicios cada
   `tenant.duracion_slot_minutos` minutos.
2. **Calcular fin tentativo.** Para cada inicio,
   `fin = inicio + (duracion_slot_minutos * servicio.cantidad_slots)`.
3. **Filtrar slots que se pasan del bloque.** Si el servicio dura más de lo
   que queda hasta el fin del bloque, descartar.
4. **Filtrar solapamientos con turnos.** Aplicar `a_ini < b_fin AND b_ini < a_fin`
   contra cada turno `reservado` del barbero ese día.
5. **Filtrar solapamientos con suspensiones.** Misma fórmula contra
   `barbero_suspension` que pisen ese día.
6. **Filtrar slots demasiado cercanos al ahora.** Si la fecha consultada
   es hoy, descartar todo slot con
   `inicio <= NOW() + interval 'ANTELACION_MINIMA_MINUTOS minutes'`. El
   margen evita reservas para "dentro de un minuto" que el cliente no
   alcanza a cumplir. Valor inicial: **5 minutos**. Exponerlo como constante
   en `/utils/constantes.js` (`ANTELACION_MINIMA_MINUTOS = 5`), no como
   magic number en el algoritmo. En el futuro podría volverse configurable
   por tenant.

Devuelve array de timestamps en ISO con TZ Argentina.

**Implementación:** todo en TZ `America/Argentina/Buenos_Aires`. Considerar
`luxon` o `date-fns-tz` para aritmética de fechas con timezone.

---

## 8. Integración con Google Calendar

**Arquitectura: A — Invitación por email.**

Una sola cuenta central de Gmail (`turnos.barbermanager@gmail.com`, no por
tenant) crea cada evento e invita al barbero como `attendee` usando
`barbero.email`. Default de Gmail es "agregar invitaciones automáticamente",
así que el evento aparece en el calendar del barbero sin que tenga que
aceptar nada explícitamente.

### 8.1 Setup operativo (una sola vez, fuera del código)

1. Crear cuenta `turnos.barbermanager@gmail.com` en Gmail.
2. Crear proyecto en Google Cloud Console.
3. Habilitar Google Calendar API.
4. Generar credenciales OAuth 2.0 para esa cuenta.
5. Hacer el flujo OAuth manual una vez para obtener `refresh_token`.
6. Guardar credenciales en variables de entorno de Railway:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`,
   `GOOGLE_CALENDAR_EMAIL`.

### 8.2 Servicio `services/googleCalendar.js`

Tres funciones:

- `crearEvento(turno, barbero, servicio, cliente)` → devuelve `google_event_id`.
- `cancelarEvento(google_event_id)` → borra el evento.
- `actualizarEvento(google_event_id, nuevoTurno)` → actualiza fecha/hora.

**Best-effort:** si la llamada falla, el turno se crea/cancela igual en la
DB. El error se loguea pero no rompe el flujo.

### 8.3 Cuándo se invoca

**En todos los turnos**, sin importar el `origen_creacion`, siempre que el
barbero asignado tenga `email` cargado. La integración solo necesita el
email del barbero (no del cliente) para invitarlo al evento, así que el
barbero ve su agenda completa en su calendar independientemente de si la
reserva la hizo el cliente, él mismo o el admin.

Si el barbero no tiene email cargado, el turno se crea normal en la DB
pero no se sincroniza con Google Calendar.

### 8.4 Flujo de creación

1. Endpoint inserta el turno con `google_event_id = null`.
2. Si `barbero.email` no es null, llama a `crearEvento`.
3. Si la llamada tiene éxito, UPDATE en `turno` seteando `google_event_id`.
4. Si falla, loguea y continúa.

### 8.5 Flujo de cancelación

1. UPDATE del turno a `cancelado`.
2. Si tenía `google_event_id`, llama a `cancelarEvento`.
3. Si falla, loguea y continúa. El barbero verá un evento huérfano que
   tendrá que borrar a mano.

---

## 9. Frontends

Tres apps separadas, todas mobile-first, todas en proyectos Vite distintos.

### 9.1 Configuración de routing por path

En Vercel, las tres apps se deployan como rewrites del mismo dominio del
tenant. Cada app es un deploy independiente con su propio build, pero el DNS
y el SSL son compartidos vía el wildcard `*.barbermanager.app`.

| URL | App |
|---|---|
| `{subdominio}.barbermanager.app/` | Gestión (existente). |
| `{subdominio}.barbermanager.app/turnos/` | Turnero del cliente. |
| `{subdominio}.barbermanager.app/barbero/` | App del barbero. |

**Prerequisito — validar la config con placeholders:** la combinación de
tres deploys distintos en el mismo dominio del tenant nunca se probó en
este proyecto. El Paso 0 del orden de ejecución (sección 10) es desplegar
tres apps Vite mínimas de "Hola Mundo" en estas rutas y verificar que
todo responde correctamente, antes de invertir tiempo en cualquier
funcionalidad real.

**Resolución de tenant en cada frontend:** todas leen
`window.location.hostname`, extraen el subdominio, y lo mandan en cada
request como header `X-Tenant-Subdomain`.

**CORS:** la regla actual del backend (`origin.endsWith('.barbermanager.app')`)
ya cubre los tres frontends sin cambios.

### 9.2 Pantallas del turnero del cliente

1. Landing del tenant. Logo, nombre, botón "Reservar turno".
2. Selección de servicio.
3. Selección de barbero.
4. Selección de fecha (calendario simple, los próximos N días).
5. Selección de horario (slots disponibles).
6. Datos del cliente (nombre, teléfono, email — todos obligatorios).
7. Confirmación.
8. Página de gestión del turno (linkeada desde el mail). Datos + botones de
   cancelar/reprogramar.

### 9.3 Pantallas de la app del barbero

1. Login (selección de barbero de la lista del tenant + PIN).
2. Home / Dashboard. Resumen del día.
3. Agenda (vista calendario, sus turnos próximos).
4. Detalle de turno (ver datos, marcar completado/no_asistió, cancelar).
5. Crear turno manual (servicio → fecha → horario → datos del cliente con
   email/teléfono opcionales).
6. Mis horarios (ver y editar el horario semanal habitual).
7. Mis suspensiones (lista, crear nueva, eliminar).
8. Mi planilla (vista semanal, navegable por semana).

### 9.4 Pantallas que se agregan al frontend de gestión existente

1. Vista global de turnos del día (todos los barberos en una sola pantalla,
   tipo timeline o grilla).
2. Gestión de horarios por barbero (selecciona barbero, ve y edita su
   horario semanal).
3. Gestión de suspensiones (selecciona barbero, ve y crea suspensiones).
4. Modificación de pantalla "registrar corte": agrega listado de turnos del
   día del barbero seleccionado, con botón de "registrar este turno como
   corte completado". Mantiene la opción de walk-in.

---

## 10. Orden de ejecución

**Paso 0 — Validar routing de Vercel con apps placeholder.** Antes de
construir nada real, crear tres apps Vite mínimas (cada una con un
`<h1>Hola desde [turnero|barbero|gestion]</h1>`), configurar los rewrites
de Vercel y deployarlas en `demo.barbermanager.app/`, `/turnos/`,
`/barbero/`. Verificar que las tres responden correctamente con sus
assets, que el subdominio se mantiene y que el CORS sigue funcionando. Si
el routing no funciona, descubrirlo ahora ahorra semanas más adelante.

**Paso 1 — SQL en Supabase (sección 2).** Pasos 1 a 9 en orden,
incluyendo el `EXCLUDE USING gist` en `turno` y el `UNIQUE` parcial sobre
`corte.turno_id`.

**Paso 2 — Setup de Google Calendar (sección 8.1).** Crear cuenta, proyecto
en Google Cloud, habilitar API, obtener credenciales y refresh token.
Configurar variables en Railway.

**Paso 3 — Backend: refactor de auth y claim de rol.**
- Refactorizar `verificarToken` para validar `tenant_id` cruzado e inyectar
  `req.rol` y `req.barbero_id` (sección 3.2).
- Implementar middleware `requiereRol` (sección 3.3).
- Ajustar el login del admin existente para firmar JWT con `rol: 'admin'` y
  `expiresIn: '30d'`.
- Implementar `POST /api/auth/barbero/login` (firma JWT con
  `rol: 'barbero', barbero_id, expiresIn: '30d'`).
- Probar con Bruno: login admin, login barbero, requests con tenant
  cruzado (debe dar 403), request con rol insuficiente (debe dar 403).

**Paso 4 — Backend: servicios compartidos.**
Implementar `services/mailer.js` (confirmación, cancelación, reprogramación
de turno, cancelación por suspensión) y `services/googleCalendar.js`
(`crearEvento`, `cancelarEvento`, `actualizarEvento`). Probar manualmente
con scripts aislados antes de integrar.

**Paso 5 — Backend: endpoints públicos del turnero (sección 4).**
Tenant, servicios, barberos, disponibilidad, crear/ver/cancelar/reprogramar
turno. La creación del turno mapea la violación del constraint
`turno_no_solapamiento` a HTTP 409. Probar cada endpoint con Bruno.

**Paso 6 — Backend: endpoints del backoffice (sección 5).**
Implementar los services (`turnosService`, `horariosService`,
`suspensionesService`, `planillaService`) y los thin-wrapper controllers.
Todos los endpoints bajo `/api/admin/*`, con scoping por rol dentro del
controller. Probar cada endpoint con Bruno autenticado como admin y como
barbero, validando que el barbero solo ve y modifica lo suyo.

**Paso 7 — Backend: modificación de `POST /api/cortes`.**
Agregar manejo de `turno_id` opcional con cleanup manual en caso de fallo
del UPDATE.

**Paso 8 — Frontend del turnero del cliente.**
Setup proyecto Vite. Pantallas en orden de la sección 9.2. Probar end-to-end
en `demo.barbermanager.app/turnos/`.

**Paso 9 — Frontend de la app del barbero.**
Setup proyecto Vite. Login + pantallas de la sección 9.3.

**Paso 10 — Modificaciones al frontend de gestión existente.**
Pantallas de la sección 9.4.

**Paso 11 — Pruebas integradas en demo.**
Flujo completo: cliente reserva desde turnero → barbero recibe en su agenda
y en Google Calendar → barbero registra el corte vinculado al turno desde su
app → admin lo ve completado en su panel y en planilla. Adicional: probar
que una suspensión que pisa turnos dispara los mails de cancelación.

**Paso 12 — Branch y merge.** Branch: `feature/turnero`. Merge a main solo
cuando todo el flujo funcione en demo.

---

## 11. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Falla la API de Google Calendar al crear un turno | Media | Best-effort: el turno se crea igual, error logueado, `google_event_id` queda null. |
| Refresh token de Google se invalida por inactividad | Baja | Se usa diariamente. Monitorear logs por 401 de Google. |
| Race condition: dos clientes reservan el mismo slot al mismo tiempo | Baja-media | Constraint `EXCLUDE USING gist` en `turno` a nivel DB (sección 2.1 Paso 4). El backend captura la violación y la mapea a HTTP 409. |
| Cliente reserva con email distinto al que ya tiene → cliente duplicado | Baja | Aceptado para MVP. Pantalla de unificación a futuro. |
| Cliente "Juan sin email" creado por barbero coexiste con "Juan con email" creado online | Baja | Aceptado para MVP. Misma pantalla de unificación. |
| Barbero olvida su PIN | Baja | El admin puede resetearlo desde la sección admin (a implementar como parte de las pantallas existentes de gestión de barberos). |
| Barbero malicioso intenta crear o modificar turnos a nombre de otro barbero | Muy baja | Los controllers bajo `/api/admin/*` ignoran cualquier `barbero_id` del body/URL cuando `req.rol === 'barbero'` y usan siempre `req.barbero_id` del JWT. |
| JWT del tenant A operando sobre el subdominio del tenant B | Baja | `verificarToken` compara `payload.tenant_id` contra `req.tenant_id` del subdominio y devuelve 403 si no coinciden (sección 3.2). |
| Doble vinculación corte→turno por doble click | Baja | `UNIQUE INDEX corte_turno_unico ... WHERE turno_id IS NOT NULL` en la tabla `corte` (sección 2.2 Paso 8). |
| Cliente curioso entra a `demo.barbermanager.app/` (gestión) | Media | Mitigado: el panel admin exige login por PIN. |
| Cliente curioso entra a `/barbero/` | Media | El acceso requiere PIN de barbero. Sin PIN no puede hacer nada. |
| `tenantMiddleware` cachea un tenant inactivado | Baja | Deuda técnica conocida (sección 12). |

---

## 12. Deudas técnicas y trabajo futuro

**Tomadas en este plan, postergadas:**

- **Endpoint admin de invalidación del caché del `tenantMiddleware`** (ya
  anotado en deudas del proyecto).
- **Migrar de Arquitectura A a B en Google Calendar** (OAuth por barbero) si
  en el futuro se quiere lectura bidireccional del calendar.
- **Pantalla de unificación de clientes duplicados.** Recibe dos `cliente_id`
  y reasigna todos los `turno.cliente_id` del que se va al que se queda.
- **Eliminar `tenant.booking_url`** una vez que todos los tenants usen el
  turnero propio.
- **Migrar el logo viejo y eliminar `tenant.logo`** (Paso 7 diferido de la
  feature de imágenes múltiples por tenant). La feature movió el logo a la
  tabla `tenant_imagen` + Supabase Storage; el turnero y el barbero ya lo
  consumen desde ahí (`GET /api/negocio/imagenes`). La columna `tenant.logo`
  sigue viva porque la app `frontend/` todavía la lee. Cuando esa app se
  re-estile y deje de usarla: migrar el logo actual de cada tenant al slot
  `tipo='logo', orden=1` de `tenant_imagen` y hacer `DROP COLUMN logo` de la
  tabla `tenant`.
- **Tabla `notificaciones` o `mails_enviados`** para trazabilidad de envíos.
- **Tabla `metricas_diarias` (rollup)** para acelerar dashboards históricos
  cuando la tabla `corte` crezca lo suficiente.
- **Bot de WhatsApp para barbero** que permita suspender turnos vía
  mensajes. La columna `barbero_suspension.origen='whatsapp'` ya está
  preparada.
- **Reglas más finas de "qué barbero atiende qué servicio"**, si en el
  futuro se quiere restringir (hoy todos los barberos atienden todos los
  servicios; el query param `servicio_id` en `GET /api/turnero/barberos` ya
  está preparado para este caso).
- **Vista restringida del barbero dentro del panel admin de gestión.** El
  backend ya está preparado (rol `barbero` puede consumir `/api/admin/*`
  con scoping automático); solo falta la UI de gestión que detecte el rol
  y oculte secciones que el barbero no puede tocar (ABM de barberos,
  ABM de servicios, vistas de otros barberos, etc.).

**Detectadas pero no del turnero:**

- **Plan `plan_cierre_caja.txt` pendiente de ejecución.** Sin relación
  directa con el turnero. Decidir si se ejecuta antes o después.

---

*— Fin del documento —*
