# Plan — Horario de atención y feriados

Plan para introducir el concepto de **horario de atención del negocio** y
**feriados** a nivel tenant, con sus validaciones, cascadas y UI de
gestión. Toda la administración la hace el dueño desde el panel admin.

Última actualización: 2026-05-20.
Branch: `feature/horario-atencion` (hija de `feature/turnero`).

---

## 0. Registro de avance

| Paso | Estado | Notas |
|---|---|---|
| 3.1 Schema SQL `tenant_horario_atencion` | ✅ Hecho (2026-05-20) | Tabla creada y seed ejecutado en Supabase. Kingsai 5 filas, Demo 6 filas. `SQL_Schema.md` actualizado. |
| 3.2 Seed inicial | ✅ Hecho (2026-05-20) | Incluido en el SQL del paso 3.1. |
| 3.3 Endpoints admin | ✅ Hecho (2026-05-20) | GET + PUT con cascada. Service/controller/route nuevos. `cancelado_por='admin'` (sin migración). Mail `enviarCancelacionPorSuspension` generalizado → `enviarCancelacionAutomatica`. |
| 3.4 Endpoint público | ✅ Hecho (2026-05-20) | `getTenant` ahora devuelve `horario_atencion` (días abiertos) y `feriados: []` (placeholder Fase 2). |
| 3.5 Validaciones write-time | ✅ Hecho (2026-05-20) | Helpers `validarRangoEnHorario` (pura) y `validarTurnoEnHorario` en `horarioAtencionService.js`. 422 en `putHorarios` (bloques de barbero) y en los 3 endpoints de turno (crear público, reprogramar, crear admin). |
| 3.6 Cortocircuito en slots | ✅ Hecho (2026-05-20) | Sexta query en el `Promise.all` de `calcularSlotsDisponibles`. Si no hay fila en `tenant_horario_atencion` para el día → `return []`. |
| 3.7 Cascada | ✅ Hecho (2026-05-20) | El grueso (`calcularDelta`, `ejecutarCascada`, `reemplazarHorario`) ya quedó en 3.3. Verificado contra el plan línea por línea: implementación completa. Best-effort de `cancelarEvento` y `enviarCancelacionAutomatica` garantizado — ambas atrapan su error internamente y devuelven `false`, nunca lanzan, así que un fallo de Calendar/mail no aborta la cascada. 409 sin confirmar no muta estado. Escenarios destructivos (409 sin confirmar / 200 con cascada / truncado / día cerrado / idempotencia) probados en Bruno. |
| 3.8 Admin UI (`TabNegocio`) | ✅ Hecho (2026-05-21) | Componente nuevo `BloqueHorarioAtencion.jsx` renderizado dentro de `TabNegocio`. 7 días con toggle + pickers `<input type="time" step="1800">`, validación cliente de rango, flujo de confirmación de cascada vía modal local (estilo `SeccionGastos`, no primitivo extraído). Mantiene el estilo viejo del panel admin (`onPointerDown`, verde, `DM Sans`). |
| 3.9 Frontend-barbero alerta | ✅ Hecho (2026-05-21) | `getTenant` agregado a `services/api.js`. `TabHorarios` carga el horario del tenant en paralelo. Banner amarillo (`theme.warning`) cuando hay bloques fuera de rango, recalculado en vivo con `useMemo`. Pickers de hora limitados con `min`/`max` al rango del negocio + borde rojo en bloques fuera. Días cerrados: botón "Agregar" deshabilitado y texto "El negocio no abre este día". Helpers puros `normalizarHora` y `bloqueFueraDeRango`. |
| 4.1 Schema SQL `tenant_feriado` | ✅ Hecho (2026-05-21) | Tabla creada en Supabase. Se omitió el `CREATE INDEX` explícito: el constraint `UNIQUE (tenant_id, fecha)` ya provee el índice equivalente. `SQL_Schema.md` actualizado. Sin seed (los feriados son ABM puro). |
| 4.2 Endpoints admin | ✅ Hecho (2026-05-21) | GET/POST/DELETE `/api/admin/feriados`. Service/controller/route nuevos. POST con flujo 409 (`feriado_ya_existe` / `requiere_confirmacion`) + cascada de cancelación de turnos (sólo turnos, no toca `barbero_horario`). Mail con `motivo: 'Feriado'` y descripción en el `intro`. Se permite feriado de hoy (cierre de imprevisto); se rechaza fecha pasada. Ruta registrada en `index.js`. |
| 4.3 Endpoint público | ✅ Hecho (2026-05-21) | `getTenant` ahora devuelve `feriados` (futuros, `fecha >= hoy` en TZ Argentina) reemplazando el placeholder `[]` de la Fase 1. |
| 4.4 Cortocircuito en slots | ✅ Hecho (2026-05-21) | Séptima query en el `Promise.all` de `calcularSlotsDisponibles`. Si la fecha tiene fila en `tenant_feriado` → `return []`, después del check de día cerrado. Validación 422 `feriado` agregada en los 3 endpoints de creación/reprogramación de turno (público, reprogramar, admin) reusando `existeFeriado`. |
| 4.5 Cascada al cargar feriado | ✅ Hecho (2026-05-21) | Implementada en el paso 4.2 dentro de `feriadosService.js` (`calcularDeltaFeriado` + `ejecutarCascadaFeriado`). Sólo cancela turnos; no toca `barbero_horario` (un feriado no altera el horario semanal del barbero). |
| 4.6 Admin UI (`TabNegocio`) | ✅ Hecho (2026-05-21) | Componente nuevo `BloqueFeriados.jsx` renderizado dentro de `TabNegocio`, debajo del horario de atención. Botón "Agregar feriado" → modal de alta (`<input type="date">` con `min`=hoy + descripción opcional); flujo 409 (`feriado_ya_existe` → error inline en el modal; `requiere_confirmacion` → modal de confirmación de cascada). Lista de feriados futuros con botón `×` por fila → `ConfirmDialog` de eliminación. Modales locales (estilo `SeccionGastos`, no primitivos extraídos). Mantiene el estilo viejo del panel admin (`onPointerDown`, verde, `DM Sans`). |

---

## 1. Contexto y motivación

Hoy el sistema no tiene noción de "cuándo está abierta la barbería". Los
horarios de trabajo están sólo a nivel **barbero** (`barbero_horario`), lo
que permite:

- Cargar bloques de barberos que contradigan los horarios reales del local
  (ej. un barbero con horario domingo 8-12 aunque el local cierre domingos).
- No representar feriados de ningún tipo — un cliente puede reservar el
  25/12 si algún barbero tiene horario ese día.
- El admin no tiene un lugar único donde declarar "abrimos Mar-Sáb 10-19".

Este plan suma dos conceptos nuevos:

1. **Horario semanal del tenant** (`tenant_horario_atencion`).
2. **Feriados puntuales del tenant** (`tenant_feriado`).

Con sus validaciones, cascadas y UI.

---

## 2. Decisiones tomadas (resumen)

| Tema | Decisión |
|---|---|
| Modelado horario semanal | Tabla `tenant_horario_atencion`, 1 fila por día abierto, `hora_inicio` + `hora_fin`. Sin fila = cerrado. |
| Bloques múltiples por día (tenant) | No. Un solo bloque. Los barberos tienen sub-bloques dentro (siguen usando `barbero_horario` como hoy). |
| Validación de barberos contra horario tenant | Sólo **write-time** (al crear/editar bloques de barbero). Sin intersección read-time. |
| Qué pasa cuando el admin achica el horario del tenant | Cascada automática: truncar/eliminar bloques de barbero afectados + cancelar turnos afectados. Confirm dialog previo con conteos. |
| Modelado de feriados | Tabla `tenant_feriado`, 1 fila por feriado. Cierre del día completo (sin horario especial en MVP). |
| Cargar feriados | ABM uno por uno desde el admin. Sin importación masiva. |
| Notificación a barberos por cascadas | No por mail. Alerta in-app en `frontend-barbero` cuando hay bloques inconsistentes. |
| Default para tenants nuevos | L-S 10:00-19:00 en `scripts/crearTenant.js`. Anotar en `/docs/onboarding.md`. |
| Demo tenant seed | L-S 08:00-22:00 (amplio, para que los scripts de test tengan margen). |
| Kingsai tenant seed | Mar-Sáb 10:00-19:00 (real). |
| Endpoint público `/api/turnero/tenant` | Expone `horario_atencion` y `feriados` futuros. Sirve al front para grisar días cerrados sin pegarle al endpoint de disponibilidad. |
| UI admin | Bloque nuevo dentro de `TabNegocio` (no tab nueva). |
| Orden de ataque | Fase 1 (horario + validaciones + cascada) → Fase 2 (feriados). Un commit por fase. |

---

## 3. Fase 1 — Horario semanal del tenant + validaciones

### 3.1 Schema SQL

```sql
CREATE TABLE public.tenant_horario_atencion (
  id          uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL,
  dia_semana  smallint NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio time NOT NULL,
  hora_fin    time NOT NULL,
  CONSTRAINT tenant_horario_atencion_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_horario_atencion_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT tenant_horario_atencion_dia_unico
    UNIQUE (tenant_id, dia_semana),
  CONSTRAINT tenant_horario_atencion_horas_validas
    CHECK (hora_inicio < hora_fin)
);
```

**Convención de `dia_semana`**: 0=domingo, 1=lunes, ..., 6=sábado.
Idéntica a la usada por `barbero_horario` y por el algoritmo de slots
(`disponibilidadService.js` línea 76: `fechaArg.weekday % 7`).

**Ausencia de fila = cerrado ese día.** Si un tenant abre sólo Mar-Sáb,
tiene 5 filas (dia_semana 2,3,4,5,6).

### 3.2 Seed inicial

Ejecutar como parte de la migración:

```sql
-- Kingsai: Mar-Sáb 10:00-19:00
INSERT INTO tenant_horario_atencion (tenant_id, dia_semana, hora_inicio, hora_fin)
SELECT id, dia, '10:00', '19:00'
FROM tenant CROSS JOIN unnest(ARRAY[2,3,4,5,6]) AS dia
WHERE subdominio = 'kingsai';

-- Demo: L-S 08:00-22:00 (amplio, para tests)
INSERT INTO tenant_horario_atencion (tenant_id, dia_semana, hora_inicio, hora_fin)
SELECT id, dia, '08:00', '22:00'
FROM tenant CROSS JOIN unnest(ARRAY[1,2,3,4,5,6]) AS dia
WHERE subdominio = 'demo';
```

### 3.3 Endpoints admin

| Método | Path | Rol | Descripción |
|---|---|---|---|
| GET | `/api/admin/horario-atencion` | admin | Devuelve los 7 días con su estado (`abierto`/`cerrado`) y horario si aplica. |
| PUT | `/api/admin/horario-atencion` | admin | Reemplaza el horario semanal completo (PUT total, no PATCH). Dispara la cascada si achica. |

**Shape GET response** (siempre 7 días, aunque algunos cerrados):
```json
[
  { "dia_semana": 0, "abierto": false },
  { "dia_semana": 1, "abierto": false },
  { "dia_semana": 2, "abierto": true, "hora_inicio": "10:00", "hora_fin": "19:00" },
  ...
]
```

**Shape PUT body**:
```json
{
  "horarios": [
    { "dia_semana": 2, "hora_inicio": "10:00", "hora_fin": "19:00" },
    { "dia_semana": 3, "hora_inicio": "10:00", "hora_fin": "19:00" },
    ...
  ],
  "confirmar_cascada": false
}
```

**Comportamiento del PUT**:

1. Validar shape.
2. Calcular el **delta** con el horario actual: qué bloques de barbero
   van a quedar afuera, qué turnos `reservado` quedan afuera.
3. Si `delta.barberos_afectados.length > 0 || delta.turnos_a_cancelar.length > 0`
   y `confirmar_cascada === false`:
   responder **409** con `{ codigo: 'requiere_confirmacion', delta: {...} }`.
4. Si `confirmar_cascada === true` (o no había delta):
   ejecutar la cascada (sección 3.7) en una sola transacción
   *(¡ojo PgBouncer! Ver sección 3.7 sobre cómo lo manejamos sin `BEGIN`)*.
5. Reemplazar `tenant_horario_atencion` (DELETE + INSERT del payload).
6. Responder 200 con el nuevo horario y un resumen de la cascada
   (`{ horarios: [...], cascada: { bloques_truncados, bloques_eliminados, turnos_cancelados } }`).

**Archivos a crear/modificar**:
- `backend/src/controllers/horarioAtencion.js` (nuevo).
- `backend/src/routes/adminHorarioAtencion.js` (nuevo).
- `backend/src/services/horarioAtencionService.js` (nuevo) — encapsula la
  cascada para que sea testeable y reusable.
- `backend/src/index.js` — registrar la ruta.

### 3.4 Endpoint público

Modificar `controllers/turnero.js#getTenant` para incluir el horario:

```json
{
  "id": "...",
  "nombre": "Kingsai Studio",
  "logo_url": "...",
  "horario_atencion": [
    { "dia_semana": 2, "hora_inicio": "10:00", "hora_fin": "19:00" },
    ...
  ],
  "feriados": []  // se llena en Fase 2
}
```

Cliente puede usar `horario_atencion` para grisar días en `MiniCalendario`
cuando se retome la deuda 1+2 del rediseño del turnero (postergada).

### 3.5 Validaciones write-time

#### 3.5.1 Al crear/editar bloques de `barbero_horario`

Tanto desde `/api/admin/horarios` (controller `horarios.js`) como cuando
el barbero edita los suyos desde `frontend-barbero` (mismo controller),
validar antes del INSERT/UPDATE:

```
Para cada bloque que se quiere guardar:
  Buscar fila en tenant_horario_atencion con el mismo dia_semana.
  Si no existe → rechazar con 422 { codigo: 'dia_cerrado', mensaje: 'El negocio no abre ese día' }.
  Si bloque.hora_inicio < tenant.hora_inicio O bloque.hora_fin > tenant.hora_fin
    → rechazar con 422 { codigo: 'fuera_de_rango', mensaje: 'Bloque fuera del horario del negocio', limite: {...} }.
```

**Frontend (`frontend-barbero` y panel admin TabBarberos)**: además de
mostrar el error del 422, los pickers de hora deben limitar las opciones
a [tenant.hora_inicio, tenant.hora_fin]. Defensa en doble capa.

#### 3.5.2 Al crear/reprogramar turnos

Aplica a `POST /api/turnero/turnos`, `POST /api/turnero/turnos/:token/reprogramar`,
`POST /api/admin/turnos`. Validar antes del INSERT:

```
día_semana = weekday(inicio)
Buscar fila en tenant_horario_atencion con ese dia_semana.
Si no existe → 422 { codigo: 'dia_cerrado' }.
Si inicio < tenant.hora_inicio O fin > tenant.hora_fin → 422 { codigo: 'fuera_de_rango' }.
```

Hoy ya hay una deuda técnica anotada en `estado_actual.md` (línea 206)
sobre que estos endpoints no validan que `inicio` caiga en un slot real.
**No la atacamos acá** — sólo agregamos la validación contra el horario
del tenant (es un check distinto, más grueso, mucho más barato).

### 3.6 Cortocircuito en el algoritmo de slots

Modificar `services/disponibilidadService.js#calcularSlotsDisponibles`:

Agregar una sexta query en el `Promise.all` (al lado de las 5 existentes):

```js
query(
  `SELECT hora_inicio, hora_fin
   FROM tenant_horario_atencion
   WHERE tenant_id = $1 AND dia_semana = $2`,
  [tenantId, diaSemana]
),
```

Antes del loop de `horariosRes.rows`, agregar:

```js
if (horarioTenantRes.rows.length === 0) {
  // El negocio no abre ese día → no hay slots.
  return [];
}
```

No hace falta intersectar con los bloques del barbero, porque la
validación write-time + la cascada garantizan que todos los bloques de
barbero ya están dentro del rango del tenant.

### 3.7 Cascada al achicar el horario del tenant

Cuando el `PUT /api/admin/horario-atencion` reduce el rango (o elimina
un día), ejecutar antes del UPDATE final:

**Paso 1 — Identificar bloques de barbero afectados**:
- Para cada `dia_semana` que pasa a estar cerrado:
  todos los bloques de `barbero_horario` de ese día → marcar para **eliminar**.
- Para cada `dia_semana` que se mantiene abierto pero achica el rango:
  - Bloques enteramente afuera → eliminar.
  - Bloques parcialmente afuera → truncar (`hora_inicio = max(bloque.hora_inicio, tenant_nuevo.hora_inicio)`, `hora_fin = min(bloque.hora_fin, tenant_nuevo.hora_fin)`).

**Paso 2 — Identificar turnos `reservado` afectados**:
Calcular para cada turno futuro (`estado = 'reservado' AND inicio > NOW()`):
- `weekday(inicio AT TIME ZONE TZ)` en convención 0-6.
- Si ese día_semana pasa a cerrado → cancelar.
- Si el rango del nuevo horario no contiene completamente `[inicio, fin]` → cancelar.

**Paso 3 — Ejecutar la cascada**:
- `DELETE` / `UPDATE` sobre `barbero_horario` según el paso 1.
- Para cada turno marcado en paso 2:
  - `UPDATE turno SET estado='cancelado', cancelado_en=NOW(), cancelado_por='admin'`.
    (La columna `cancelado_por` tiene un CHECK que sólo admite
    `cliente|barbero|admin|suspension`; no existe `motivo_cancelacion`.
    El motivo viaja sólo en el mail.)
  - Best-effort: `cancelarEvento(turno.google_event_id)` (no bloqueante).
  - Best-effort: `enviarCancelacionAutomatica(...)` (función generalizada a
    partir de `enviarCancelacionPorSuspension`) con `intro` que explica el
    cambio de horario y `motivo: 'Cierre'`.
- `DELETE FROM tenant_horario_atencion WHERE tenant_id=$1` + `INSERT` del payload.

**Nota sobre transaccionalidad**:
PgBouncer/Session Pooler no soporta `BEGIN`/`COMMIT` (ver
`/docs/convenciones_tecnicas.md` §6). Como ya hacemos en `cortes.js` con
cleanup manual, ejecutamos secuencialmente y registramos cada paso. Si
algo falla en medio, loguear con suficiente contexto para limpiar a
mano. La probabilidad real de fallo es baja porque son operaciones sobre
nuestras propias tablas.

**Endpoint devuelve el resumen**:
```json
{
  "horarios": [...],
  "cascada": {
    "bloques_truncados": 3,
    "bloques_eliminados": 1,
    "turnos_cancelados": 5
  }
}
```

### 3.8 Admin UI — bloque dentro de `TabNegocio`

Agregar un bloque nuevo en `frontend/src/screens/admin/sections/gestion/TabNegocio.jsx`:

**Estructura visual**:
```
─── Horario de atención ──────────────────────
  [Domingo]  ⚪ Cerrado    [    ] [    ]
  [Lunes]    ⚫ Abierto    [10:00] [19:00]
  [Martes]   ⚫ Abierto    [10:00] [19:00]
  ...
  [Sábado]   ⚫ Abierto    [10:00] [19:00]

  [ Guardar cambios ]
```

- 7 filas fijas, una por día.
- Toggle abierto/cerrado por día.
- Cuando "abierto", dos pickers `<input type="time">` (apertura/cierre).
- Botón "Guardar cambios" abajo. Disabled si no hay cambios.

**Flujo del guardar**:
1. Click "Guardar cambios" → llamada al PUT con `confirmar_cascada: false`.
2. Si el backend responde 409 `requiere_confirmacion`:
   abrir `ConfirmDialog` con:
   > "Este cambio cancelará **X turnos** ya reservados y modificará/eliminará
   > **Y bloques** de horarios de barberos. ¿Continuar?"
   > [Cancelar] [Confirmar]
3. Si confirma → llamada al PUT con `confirmar_cascada: true`.
4. Si no había delta → guardado directo + toast de éxito.
5. Mostrar el resumen del cascada (toast o sección debajo del bloque):
   "X turnos cancelados · Y bloques actualizados".

**Picker visual**: usar `<input type="time" step="1800">` para limitar a
medias horas (consistente con `duracion_slot_minutos=30`).

### 3.9 Frontend-barbero — alerta in-app

En `frontend-barbero/src/components/Gestion.jsx` (tab "Mis Horarios"),
si al cargar los bloques del barbero alguno cae fuera del horario actual
del tenant (caso transición, antes de que la cascada haya corrido o si
se cargó data manualmente), mostrar un banner amarillo arriba:

> ⚠ Tenés bloques de horario fuera del horario actual del negocio.
> Estos bloques no aparecerán como disponibles. Ajustalos para reflejar
> tu disponibilidad real.

El banner se calcula client-side comparando los bloques que devuelve
`GET /api/admin/horarios/:barbero_id` contra el `horario_atencion` que
devuelve `GET /api/turnero/tenant` (que ya es público).

Pickers de hora en frontend-barbero: limitar a `[tenant.hora_inicio,
tenant.hora_fin]` por día. Mismo patrón que el admin.

### 3.10 Criterios de aceptación — Fase 1

- [x] Migración SQL ejecutada en Supabase (tabla + seed Kingsai/demo).
- [x] `GET /api/turnero/tenant` devuelve `horario_atencion` (array de 7 o menos).
- [x] `GET /api/admin/horario-atencion` devuelve los 7 días.
- [x] `PUT /api/admin/horario-atencion` con cambio inocuo → 200, sin cascada.
- [x] `PUT /api/admin/horario-atencion` con cambio destructivo + `confirmar_cascada=false` → 409 con delta.
- [x] `PUT /api/admin/horario-atencion` con cambio destructivo + `confirmar_cascada=true` → cascada ejecuta, turnos cancelados, mails enviados, eventos de calendar cancelados.
- [x] `POST /api/admin/horarios/:barbero_id` con bloque fuera del rango del tenant → 422.
- [x] Idem desde `frontend-barbero` (pickers limitados con `min`/`max`).
- [x] `POST /api/turnero/turnos` con inicio fuera del horario del tenant → 422.
- [x] Algoritmo de slots devuelve `[]` cuando la fecha cae en día cerrado.
- [x] `TabNegocio.jsx` muestra el bloque, edita los 7 días, llama al PUT con confirmación.
- [x] `Gestion.jsx` de frontend-barbero muestra banner amarillo si hay bloques fuera de rango.
- [x] `/docs/SQL_Schema.md` actualizado con la nueva tabla.
- [x] `/docs/ruta_proyecto.md` actualizado con el nuevo controller/route/service.
- [x] `/docs/estado_actual.md` actualizado (Fase 1 documentada; nota de "sin mergear" hasta el merge).

---

## 4. Fase 2 — Feriados

### 4.1 Schema SQL

```sql
CREATE TABLE public.tenant_feriado (
  id          uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL,
  fecha       date NOT NULL,
  descripcion text,
  created_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT tenant_feriado_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_feriado_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT tenant_feriado_fecha_unica UNIQUE (tenant_id, fecha)
);

CREATE INDEX tenant_feriado_tenant_fecha_idx
  ON tenant_feriado (tenant_id, fecha);
```

**Cobertura**: cierre del día completo. No hay `hora_inicio`/`hora_fin`
en este MVP (postergado).

### 4.2 Endpoints admin

| Método | Path | Rol | Descripción |
|---|---|---|---|
| GET | `/api/admin/feriados` | admin | Lista feriados del tenant. Query param opcional `?desde=YYYY-MM-DD` (default = hoy). |
| POST | `/api/admin/feriados` | admin | Carga un feriado. Body: `{ fecha, descripcion?, confirmar_cascada }`. |
| DELETE | `/api/admin/feriados/:id` | admin | Elimina un feriado. **No "descancela" turnos** (ya están cancelados con mail enviado). |

**Comportamiento del POST** (similar al PUT del horario):
1. Validar shape (`fecha` YYYY-MM-DD, futura o de hoy).
2. Si la fecha ya existe → 409 `feriado_ya_existe`.
3. Identificar turnos `reservado` ese día.
4. Si hay turnos y `confirmar_cascada === false` → 409 `requiere_confirmacion` con conteo.
5. Si confirma o no hay turnos → cancelar turnos (mismo flujo que en Fase 1
   con motivo "Feriado: <descripcion>") e insertar el feriado.

**Archivos a crear/modificar**:
- `backend/src/controllers/feriados.js` (nuevo).
- `backend/src/routes/adminFeriados.js` (nuevo).
- `backend/src/services/feriadosService.js` (nuevo).

### 4.3 Endpoint público

Modificar `controllers/turnero.js#getTenant` para incluir feriados
**futuros** (fecha >= hoy):

```json
{
  "id": "...",
  "nombre": "...",
  "horario_atencion": [...],
  "feriados": [
    { "fecha": "2026-12-25", "descripcion": "Navidad" },
    { "fecha": "2027-01-01", "descripcion": "Año Nuevo" }
  ]
}
```

### 4.4 Cortocircuito en el algoritmo de slots

Modificar `services/disponibilidadService.js#calcularSlotsDisponibles`:

Agregar una séptima query en el `Promise.all`:

```js
query(
  `SELECT 1 FROM tenant_feriado WHERE tenant_id = $1 AND fecha = $2`,
  [tenantId, fecha]
),
```

Después del check del horario:

```js
if (feriadoRes.rows.length > 0) {
  return [];  // El día es feriado, no hay slots.
}
```

### 4.5 Cascada al cargar un feriado

Igual flujo que la cascada del horario, simplificado a 1 día:
- Identificar turnos `reservado` cuya `DATE(inicio AT TIME ZONE TZ)` coincida con el feriado.
- Cancelar con motivo `Feriado: <descripcion>`.
- Best-effort: cancelar evento de Calendar + mail al cliente.

### 4.6 Admin UI — bloque dentro de `TabNegocio`

Justo debajo del bloque de Horario de atención:

**Estructura visual**:
```
─── Feriados ────────────────────────────────
  [ Agregar feriado ]

  📅 2026-12-25 · Navidad                    [×]
  📅 2027-01-01 · Año Nuevo                  [×]
  ...
```

- Botón "Agregar feriado" abre un modal con `<input type="date">` + campo descripción opcional.
- Al guardar: mismo flujo de confirmación que en Fase 1 (si hay turnos a cancelar, ConfirmDialog primero).
- Lista de feriados futuros, cada uno con botón eliminar (X).
- Click en X → `ConfirmDialog`: "Eliminar este feriado? Los turnos cancelados no se restauran".

### 4.7 Criterios de aceptación — Fase 2

- [x] Migración SQL ejecutada (tabla `tenant_feriado`; índice explícito omitido, el constraint UNIQUE lo cubre).
- [x] `GET /api/turnero/tenant` ahora también devuelve `feriados` (futuros). Verificado con Bruno.
- [x] `GET /api/admin/feriados` lista los feriados. Verificado con Bruno.
- [x] `POST /api/admin/feriados` con día sin turnos → 201, feriado guardado. Verificado con Bruno.
- [x] `POST /api/admin/feriados` con día con turnos + `confirmar_cascada=false` → 409. Verificado con Bruno.
- [x] `POST /api/admin/feriados` con día con turnos + `confirmar_cascada=true` → cascada ejecuta. Verificado con Bruno.
- [x] `DELETE /api/admin/feriados/:id` elimina el feriado. Verificado con Bruno.
- [x] Algoritmo de slots devuelve `[]` para una fecha que es feriado. Verificado con Bruno.
- [x] `POST /api/turnero/turnos` con `inicio` que cae en feriado → 422. Verificado con Bruno.
- [x] `TabNegocio.jsx` muestra el bloque de feriados, agrega/elimina.
- [x] `/docs/SQL_Schema.md`, `/docs/ruta_proyecto.md`, `/docs/estado_actual.md` actualizados.

---

## 5. Pendientes que dispara este plan (anotar para otros chats)

- **`/docs/onboarding.md`**: agregar paso "El script `crearTenant.js`
  ahora seedea horario L-S 10:00-19:00 por default. El dueño lo ajusta
  desde el admin al activar la cuenta."
- **`scripts/crearTenant.js`**: que inserte las 6 filas default
  (`tenant_horario_atencion`) tras crear el tenant.
- **`scripts/testAdminEndpoints.js`**: agregar tests de
  - PUT horario-atencion inocuo / con cascada
  - validación 422 al crear bloque de barbero fuera de rango
  - validación 422 al crear turno fuera de horario
  - POST feriado / cascada
- ~~**Deuda 1+2 del rediseño del turnero**~~ ✅ resuelto: `MiniCalendario`
  grisa días cerrados y feriados con `tenant.horario_atencion` +
  `tenant.feriados`, sin endpoint `/disponibilidad/dias`. Queda pendiente
  sólo la precisión por barbero (días donde el barbero específico no tiene
  slots) — ver `sistema_de_disenio.md` §9 #3.

---

## 6. Cosas que NO entran en este plan (postergado)

- **Horario especial por feriado** (ej. "24/12 abrimos hasta las 14"). v2.
- **Importación masiva de feriados nacionales** ("Cargar feriados AR 2026"). v2.
- **Notificación por mail al barbero** cuando una cascada le toca sus bloques. v2.
- **Bloques múltiples por día a nivel tenant** (siesta del local). Decidimos
  no necesitarlo — los barberos individuales pueden tener sus propios
  cortes internos.
- **Validación read-time** (intersección barbero ∩ tenant en el algoritmo
  de slots). Innecesaria si write-time + cascada mantienen la data
  consistente. Si en algún momento aparecen casos de inconsistencia
  difíciles de reproducir, reconsiderar.
- **Logs de auditoría** de quién achicó el horario y cuándo. Va con el
  pendiente general de "log de actividad" en `estado_actual.md`.

---

*— Fin del documento —*
