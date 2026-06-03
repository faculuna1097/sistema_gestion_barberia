# Plan — Acceso de barberos al panel (vista reducida por PIN)

> Documento de plan para ejecutar en un chat nuevo. Autocontenido.
> Creado: 2026-06-03. Entrega: **un único branch `feature/acceso-barberos-panel`
> hijo de `feature/turnero`, con un commit por fase** (ver §6 y §10).
>
> **Estado (2026-06-03):** Fases 1, 2 y 3 ✅ hechas (Fase 3 = backend del login
> unificado). Próximo chat: **Fase 4** (frontend: login + estado de rol). Detalle
> en §6 y §10.

---

## Regla permanente durante la ejecución — registro de deudas técnicas

A medida que leas o construyas código en este plan, **anotá deudas técnicas,
posibles bugs, code smells y decisiones cuestionables** que detectes, estén o no
relacionadas con esta feature. No te desvíes a arreglarlas (salvo que el usuario
lo pida): el trabajo es **registrarlas**.

Dónde registrarlas:
- **Frontend de gestión** → `docs/deudas_tecnicas_frontend.md` (registro vivo).
- **Backend / schema / otros** → mencionarlas en el cierre del chat y, si
  corresponde, en `docs/estado_actual.md` (sección "Deudas técnicas conocidas").
- **Siempre** mencionarlas al usuario al final de cada respuesta, para que decida
  si se atacan, se posponen o se descartan (CLAUDE.md §1, "Revisión activa del código").

Deudas ya conocidas que se cruzan con este plan (no resolver acá, solo tener presente):
- `services/api.js:18` (gestión) usa la heurística vieja de subdominio
  (`partes.length >= 3`), ya reemplazada en turnero/barbero por "termina en
  `.barbermanager.app`".
- PINs (`barbero.pin`, `tenant.pin_admin`) y la idea de mover credenciales a
  `tenant_credenciales` (ver `estado_actual.md`).

---

## 1. Objetivo

Permitir que un **barbero** acceda al panel de gestión (el iPad del mostrador,
`/frontend`) usando **la misma pantalla de PIN que el admin**, y que según el PIN
ingresado el sistema decida el rol:

- PIN del admin → panel completo (como hoy).
- PIN de un barbero → **vista reducida**: solo **su Planilla** y **su Turnero**.

Caso de uso: el barbero, parado en el iPad del local, quiere ver rápido cómo
viene su día (planilla) y qué tiene por delante (turnos). El análisis económico
profundo lo hace desde su app propia (`frontend-barbero`), que **no se toca** en
este plan.

### Alcance

**Incluye:**
- Login unificado por PIN en el panel (admin o barbero según el PIN).
- Vista reducida del panel para rol barbero: Planilla (solo la propia) + Turnero
  (solo el propio).
- Validación de **unicidad de PIN** dentro del tenant (pre-requisito técnico).

**No incluye:**
- Cambios en `frontend-barbero` (la app del barbero sigue con selector + PIN).
- Hashing nuevo / tabla `tenant_credenciales` (deuda aparte, ver §9).
- Acciones de gestión desde el turnero del barbero en v1 (ver decisión D1).

---

## 2. Por qué esto es no-trivial: el problema de la unicidad de PIN

Los PINs **están hasheados con bcrypt**, tanto el del admin (`tenant.pin_admin`)
como el de cada barbero (`barbero.pin`). Ver `controllers/authAdmin.js:48` y
`controllers/authBarbero.js:47` (`bcrypt.compare`).

Consecuencias:

1. **No se puede buscar un barbero por PIN con `WHERE pin = $1`.** Un hash bcrypt
   es no determinista (salt por hash). Para resolver "qué barbero tiene este PIN"
   hay que traer los barberos del tenant y hacer `bcrypt.compare` uno por uno.

2. **Hoy los PINs de barbero se repiten a propósito.** Lo dice el comentario en
   `controllers/authBarbero.js:9-11`: la app del barbero usa selector + PIN
   *porque* los PINs no son únicos. Para que un PIN solo identifique a un barbero
   en el login del panel, **hay que forzar unicidad** dentro del tenant,
   incluyendo el `pin_admin`.

   - Si dos barberos comparten PIN → el login sería ambiguo.
   - Si un barbero comparte PIN con el admin → como el login chequea admin
     primero, **ese barbero entraría como admin** (escalada de privilegios).
     Esto es lo más grave y es la razón por la que la unicidad es obligatoria.

Por eso la **Fase 0 (unicidad)** es pre-requisito y bloquea la activación del
login unificado en cualquier tenant.

---

## 3. Modelo actual relevante (para no re-descubrirlo)

### Auth / sesión del panel (`/frontend`)
- Dos tokens: **operativo** (usuario+password, en `localStorage`, el iPad está
  siempre logueado) y **admin** (PIN, solo en memoria). Ver `services/api.js`
  (`authToken`, `apiFetch`, `tokenOperativo`, `apiFetchOperativo`).
- Login admin: `POST /api/auth/admin/login` con `{ pin }` → `{ token, aviso_pago }`.
  Controller `controllers/authAdmin.js`. Token JWT: `{ tenant_id, rol: 'admin' }`.
- Login barbero (lo usa `frontend-barbero`, **no** el panel): `POST /api/auth/barbero/login`
  con `{ barbero_id, pin }` → `{ token, barbero }`. Token: `{ tenant_id, rol: 'barbero', barbero_id }`.
- `middlewares/authMiddleware.js` (`verificarToken`) inyecta `req.tenant_id`,
  `req.rol` y, si rol barbero, `req.barbero_id`.

### Scoping por rol (la pieza de oro, ya construida)
- `controllers/planilla.js:21,48`: `if (req.rol === 'barbero') barberoId = req.barbero_id;`
  → con token barbero, `/admin/planilla` y `/admin/planilla/resumen` devuelven
  **solo su data**. Validado (Paso 6 del turnero, 34 tests).
- Mismo patrón esperado en `/admin/turnos` (`controllers/turnos.js` /
  `services/turnosService.js`). **Verificar al inicio de la Fase 6** que
  `/admin/turnos` acepta rol barbero y filtra por `req.barbero_id`.

### Frontend del panel
- `App.jsx`: máquina de pantallas por `currentScreen`. Al validar el PIN admin
  (`currentScreen === "loginAdmin"`), hace `setToken` + `setAuthToken` y entra a
  `"admin"` → `<PanelAdmin />`.
- `screens/PantallaLoginAdmin.jsx`: teclado de PIN, llama `loginAdmin(pin)`.
- `screens/admin/PanelAdmin.jsx`: sidebar con `SECCIONES` (8 ítems). Renderiza
  `<SeccionActual />` **sin props**.
- `screens/admin/sections/SeccionPlanillas.jsx`: usa `apiFetch('/admin/planilla...')`.
  Muestra `ChipFiltro` por barbero (`detalleData.map`) + selecciona `detalle[0]`.
- `screens/admin/sections/SeccionTurnero.jsx`: usa `getBarberosAdmin()` (`/barberos`),
  `getServiciosAdmin()` (`/admin/servicios`), `getAdminHorarioAtencion()`
  (`/admin/horario-atencion`) y `getAdminTurnos()`. Pills de barbero + agenda/lista
  + modal con acciones (completar/no_asistió/cancelar).

### ABM de barberos (donde va la validación de unicidad)
- `controllers/gestion.js`: `crearBarbero` (línea 45) y `editarBarbero` (línea 83)
  hashean el PIN con `bcrypt.hash(pin, 10)` y **NO validan unicidad**.
- `controllers/gestion.js`: `cambiarPinAdmin` (línea 391) cambia `tenant.pin_admin`,
  tampoco valida contra los PINs de barberos.
- Frontend: `screens/admin/sections/gestion/TabBarberos.jsx` →
  `ModalDatosBarbero` (POST/PUT `/admin/barberos`). El cambio de PIN admin vive en
  `TabSeguridad.jsx`.

---

## 4. Decisión de diseño central

**Login unificado por PIN en un endpoint nuevo `POST /api/auth/panel/login`.**

Recibe `{ pin }` y resuelve:

1. `bcrypt.compare(pin, tenant.pin_admin)` → si matchea: **rol admin**. Evalúa
   suscripción (igual que hoy: 402 bloqueo / `aviso_pago` / OK) y emite JWT admin.
2. Si no: trae los barberos **activos** del tenant y hace `bcrypt.compare(pin, b.pin)`
   en loop:
   - exactamente 1 match → **rol barbero**, emite JWT barbero `{ tenant_id, rol:'barbero', barbero_id }`.
   - 0 matches → 401 `PIN incorrecto`.
   - >1 match → no debería ocurrir si la Fase 0 está aplicada; loguear `warn` y
     responder 401 genérico (no adivinar a quién loguear).

Respuesta: `{ token, rol: 'admin'|'barbero', aviso_pago?, barbero? }`
(`barbero: { id, nombre }` solo cuando rol barbero).

Costo: 1 + N `bcrypt.compare` por login (N = barberos activos, ~8). Aceptable
para un login esporádico.

El frontend reusa `authToken` + `apiFetch` para ambos roles: el backend distingue
por el contenido del JWT, no el front.

---

## 5. Decisiones de producto (confirmadas por el usuario — 2026-06-03)

| # | Decisión | Resolución |
|---|---|---|
| **D1** | Turnero del barbero: ¿read-only o con acciones? | **Read-only en v1.** Ocultar completar/no_asistió/cancelar en modo barbero. Completar = registrar corte ya se hace por FlujoCorte operativo y por su app; duplicarlo acá agrega caminos y confusión. |
| **D2** | Suscripción vencida para rol barbero | **No bloquear ni avisar.** El bloqueo apunta al dueño (el modo operativo tampoco se bloquea). El 402/`aviso_pago` solo aplica al path admin. |
| **D3** | Sección de aterrizaje en modo barbero | **Turnero** (lo más accionable al llegar). Trivial de cambiar a Planilla. |
| **D4** | Copy de la pantalla de PIN | Neutralizar el título "Panel de administrador" → algo como "Ingresá tu PIN" sin mencionar admin, porque ahora sirve a ambos roles. |
| **D5** | Identidad visible en modo barbero | Mostrar el nombre del barbero en el sidebar (en vez de / además de `nombreNegocio`) para que sepa que entró como él. Cosmético. |

---

## 6. Plan por fases

> **Estrategia de entrega (decidida): un único branch `feature/acceso-barberos-panel`
> hijo de `feature/turnero`, con un commit por fase** (no un branch/merge por fase).
> 1. **Fase 1 (unicidad)** → commit. No cambia ninguna UX existente, solo agrega un
>    409 ante colisión de PIN.
> 2. **Fase 2 (datos)** → con la validación ya aplicada, sanear PINs únicos por
>    tenant (Kingsai, Demo) con calma.
> 3. **Fases 3–6 (login unificado + frontend)** → commits sucesivos en el mismo branch.
>
> Así el saneamiento de datos queda separado de la feature nueva, y cuando llega
> el login unificado los datos ya están sanos.

### Fase 0 / 1 — Backend: unicidad de PIN (pre-requisito)

**Objetivo:** que sea imposible guardar dos PINs iguales en un tenant (barbero
vs barbero y barbero vs admin).

1. **Helper compartido** `utils/pin.js` (o similar):
   - `async function pinColisiona(pinPlano, { tenantId, excluirBarberoId })`:
     - `SELECT pin_admin FROM tenant WHERE id = $1` → `bcrypt.compare`.
     - `SELECT id, pin FROM barbero WHERE tenant_id = $1 AND id <> $excluir` →
       loop `bcrypt.compare`. (Comparar contra **todos**, activos e inactivos,
       para que una reactivación futura no genere colisión.)
     - Devuelve `true` si alguno matchea.
2. `controllers/gestion.js`:
   - `crearBarbero`: antes del INSERT, si `pinColisiona(pin, { tenantId })` →
     `409 { error: 'Ese PIN ya está en uso por otro barbero o por el admin' }`.
   - `editarBarbero`: igual, solo cuando viene `pin`, con `excluirBarberoId = id`.
   - `cambiarPinAdmin`: antes del UPDATE, si `pinColisiona(pin_nuevo, { tenantId })`
     (acá sin excluir barberos) → `409`.
3. **Frontend** (`TabBarberos.jsx` → `ModalDatosBarbero`, y `TabSeguridad.jsx`):
   ya propagan `data.error` del backend al estado de error del modal
   (`gestion.js` patrón existente). Verificar que el `409` muestre el mensaje
   inline. Probablemente no requiera cambios, solo confirmar.

**Criterio de aceptación Fase 1:** intentar crear/editar un barbero con un PIN ya
usado, o cambiar el PIN admin a uno de un barbero, devuelve 409 con mensaje claro.

> **Estado: ✅ Hecha (2026-06-03)** — commiteado en `feature/acceso-barberos-panel`.
> - `utils/pin.js` → `pinColisiona(pinPlano, { tenantId, excluirBarberoId })`: compara
>   contra `pin_admin` y todos los barberos del tenant (activos e inactivos) con
>   `bcrypt.compare`. Query con guard `$2::uuid IS NULL OR id <> $2` para excluir al
>   propio barbero al editar sin duplicar la query.
> - `gestion.js`: 409 en `crearBarbero`, `editarBarbero` (con `excluirBarberoId`) y
>   `cambiarPinAdmin`. Mensaje único: "Ese PIN ya está en uso por otro barbero o por el admin".
> - Frontend: **sin cambios** — `ModalDatosBarbero` y `ModalCambiarPin` ya propagan
>   `data.error` del 409 a su error inline (verificado en lectura, no tocado).
> - Deudas menores plegadas: validación de rango 0–100 de `comision_valor` en crear/editar;
>   log de PIN admin incorrecto en `cambiarPinAdmin` → `console.warn` (convención §1.4).
> - Efecto secundario aceptado: reingresar el PIN admin actual en `cambiarPinAdmin` ahora
>   devuelve 409 (rechaza el no-op), con el mismo mensaje genérico.
> - **Deuda diferida a Fase 3:** el mismo fix de log (`console.log`→`console.warn` en el
>   PIN incorrecto) queda pendiente en `authAdmin.js:51` y `authBarbero.js:50`; se aplica
>   al tocar auth en la Fase 3 (ahí ya se está en zona de login).

### Fase 2 — Datos: garantizar PINs únicos en tenants productivos

Operativo, **fuera de código** (coordinar con el dueño):
- Para cada tenant (Kingsai, Demo), reasignar PINs **únicos** a cada barbero y al
  admin, usando el ABM ya con validación (Fase 1).
- No se pueden "leer" los PINs actuales (están hasheados); se definen nuevos.
- Dejar registrado el set de PINs por tenant donde el dueño lo administre.

> **Bloqueante:** no activar el login unificado (Fase 3 en uso real) hasta tener
> esto hecho por tenant, o un barbero con PIN colisionando con el admin entraría
> como admin.

> **Estado: ✅ Resuelta (2026-06-03)** — el dueño reasignó PINs únicos por tenant tras
> aplicar la validación de la Fase 1. Desbloquea la activación real del login unificado.

### Fase 3 — Backend: endpoint de login unificado

1. **Refactor** de la evaluación de suscripción: extraer la lógica de
   `authAdmin.loginAdmin` (días 5–10 → `aviso_pago`, día 11+ → bloqueo) a un
   helper `utils/suscripcion.js#evaluarSuscripcion(suscripcion_vigente_hasta)` →
   `{ bloqueado, aviso_pago }`. Hacer que `authAdmin` lo use también (evita
   duplicar).
2. **Nuevo** `controllers/authPanel.js#loginPanel` + `routes/authPanel.js`
   (`POST /api/auth/panel/login`), registrado en `index.js` junto a las otras
   rutas de auth. Lógica de §4. Reglas:
   - Path admin: si `evaluarSuscripcion().bloqueado` → 402 (igual que hoy).
   - Path barbero: **sin** chequeo de suscripción (D2). `aviso_pago` no se manda.
   - Logs de seguridad (convención §1.4): `warn` en PIN no reconocido y en el
     caso `>1 match`.
3. **Mantener** `/api/auth/admin/login` por ahora (o eliminarlo si se confirma
   que solo lo usa el `loginAdmin` del frontend de gestión, que migra al nuevo
   endpoint en Fase 4). Marcar como cleanup.
4. **Verificar** que `/admin/turnos` (y `/admin/planilla`) estén montados con un
   `requiereRol` que **incluya 'barbero'** (no solo 'admin'). Si alguno es
   `requiereRol('admin')` estricto, ampliarlo a `('admin','barbero')`.

**Criterio de aceptación Fase 3 (Bruno/scripts):** PIN admin → `{rol:'admin'}`;
PIN de barbero → `{rol:'barbero', barbero{...}}`; PIN inexistente → 401.

> **Estado: ✅ Hecha (2026-06-03)** — backend completo, en `feature/acceso-barberos-panel`.
> - `utils/suscripcion.js` → `evaluarSuscripcion(suscripcionVigenteHasta)` → `{ bloqueado, aviso_pago }`,
>   función pura (sin logs ni `res`). `authAdmin.loginAdmin` refactorizado para consumirla (se le
>   quitaron los imports de `DateTime`/`TZ`). Comportamiento idéntico (mismo 402 y `aviso_pago`).
> - `controllers/authPanel.js#loginPanel` + `routes/authPanel.js`, montado en `POST /api/auth/panel/login`
>   (solo `tenantMiddleware`). Admin-first (1 `bcrypt.compare` contra `pin_admin`, con `evaluarSuscripcion`
>   → 402 si bloqueado); si no, loop sobre barberos activos; 1 match → rol barbero, 0 → 401, >1 → `warn`
>   + 401 genérico. Path barbero sin chequeo de suscripción (D2).
> - `requiereRol` auditado: `/admin/turnos` y `/admin/planilla` **ya** aceptaban barbero (van sin
>   `requiereRol`, el scoping lo hace el controller). `/admin/horario-atencion` se abrió a barbero **por
>   método**: el control de rol pasó de `index.js` al router (`GET` → `requiereRol('admin','barbero')`,
>   `PUT` → `requiereRol('admin')`), así el barbero lee la jornada del local pero no la modifica.
> - Deuda de logs plegada: `console.log`→`console.warn` en los logins fallidos de `authAdmin.js`
>   (tenant no encontrado, PIN incorrecto, suscripción vencida) y `authBarbero.js` (barbero no
>   encontrado, PIN incorrecto).
> - Validado con Bruno (7 tests): login admin / barbero / PIN inexistente / sin PIN; GET horario con
>   token barbero (200), PUT con token barbero (403).
> - **Cleanup pendiente (Fase 4):** `/api/auth/admin/login` sigue vivo; su único caller (el `loginAdmin`
>   del frontend de gestión) migra a `/panel/login` en la Fase 4 y ahí se elimina el endpoint viejo.
> - **Deuda nueva detectada** (registrada en `estado_actual.md`): `/admin/turnos` y `/admin/planilla`
>   aceptan token operativo (no tienen `requiereRol`); pre-existente, hardening posible a
>   `requiereRol('admin','barbero')`.

### Fase 4 — Frontend: login + estado de rol

1. `services/api.js`: nueva `loginPanel(pin)` → `POST /auth/panel/login`,
   devuelve `{ token, rol, aviso_pago, barbero }`. Mantener el manejo de 402
   (`err.bloqueado = true`) como en `loginAdmin`. (Puede reemplazar a `loginAdmin`,
   su único caller es `PantallaLoginAdmin`.)
2. `screens/PantallaLoginAdmin.jsx`:
   - `validarPin` llama `loginPanel`. En éxito, `onAcceso(token, { rol, aviso_pago, barbero })`.
   - Copy neutral (D4).
3. `App.jsx`:
   - Estado nuevo: `rolPanel` (`'admin'|'barbero'`) y `barberoSesion` (`{id,nombre}|null`).
   - En el bloque `currentScreen === "loginAdmin"`, el `onAcceso` recibe `(token, info)`:
     `setToken`, `setAuthToken(token)`, `setRolPanel(info.rol)`,
     `setBarberoSesion(info.barbero ?? null)`, `setAvisosPago(info.rol==='admin' && info.aviso_pago)`,
     `setCurrentScreen("admin")`.
   - `cerrarSesionAdmin`: limpiar también `rolPanel` y `barberoSesion`.
   - Render: `<PanelAdmin rol={rolPanel} barberoSesion={barberoSesion} ... />`.

### Fase 5 — Frontend: PanelAdmin con menú condicional

`screens/admin/PanelAdmin.jsx`:
1. Recibir props `rol` (default `'admin'`) y `barberoSesion`.
2. Derivar la lista de secciones: si `rol === 'barbero'`, filtrar `SECCIONES` a
   `['planillas', 'turnero']` (no mutar la constante; derivar `seccionesVisibles`).
3. `seccionActiva` inicial: `'turnero'` si barbero (D3), `'inicio'` si admin.
4. Pasar el modo a las secciones. Como el render es `<SeccionActual />`, pasar
   props comunes: `<SeccionActual modoBarbero={rol === 'barbero'} barberoSesion={barberoSesion} />`.
   Las secciones que no los usan los ignoran.
5. (D5) Mostrar `barberoSesion.nombre` en el header del sidebar cuando rol barbero.

### Fase 6 — Frontend: secciones en modo barbero

**`SeccionPlanillas.jsx`** (recibe `modoBarbero`):
- Con token barbero, `/admin/planilla` ya devuelve solo su data. El componente
  funciona casi sin cambios (`detalleData` con un solo barbero, `detalle[0]`
  autoseleccionado).
- Si `modoBarbero`: ocultar la fila de `ChipFiltro` de barberos (sobra con uno).
- Resto igual (toggle comisiones, selector de semana, export). Es **su** comisión.

**`SeccionTurnero.jsx`** (recibe `modoBarbero` + `barberoSesion`):
- Si `modoBarbero`:
  - **No** llamar `getBarberosAdmin()` (la ruta `/barberos` puede no aceptar rol
    barbero, y no queremos las columnas de todos). Usar `barberos = [barberoSesion]`.
  - Ocultar el filtro de pills de barbero (sobra con uno).
  - `getAdminTurnos(fecha, barberoSesion.id)` — el backend igual filtra por el
    token; pasar el id mantiene la UI coherente.
  - Acciones del modal (completar/no_asistió/cancelar): **ocultar** (D1 read-only).
  - `getServiciosAdmin()` (`/admin/servicios`, rol admin): solo se usa para
    completar → **saltear** en modo barbero (no se necesita sin acciones).
  - `getAdminHorarioAtencion()` (`/admin/horario-atencion`): define el rango de la
    agenda. El backend ya permite rol barbero en el `GET` de esa ruta (resuelto en
    la Fase 3, lectura inocua de la jornada del local), así que el rango sale
    correcto sin necesidad de fallback.

> **Backend — hardening de rutas (resuelve la deuda registrada en `estado_actual.md`):**
> en esta fase, endurecer `/api/admin/turnos` y `/api/admin/planilla` a
> `requiereRol('admin','barbero')`. Hoy van sin `requiereRol`, así que aceptan
> cualquier token válido —incluido el operativo del iPad—, y un operativo podría
> leer la planilla/turnos de cualquier barbero pasando su `barbero_id` por query.
> Verificar antes que ningún flujo del iPad las llame con token operativo (el flujo
> operativo usa `/api/turnos` y `/api/cortes`, no `/api/admin/*`, así que en
> principio es seguro). `/admin/horario-atencion` ya quedó resuelto en la Fase 3
> (GET admin+barbero, PUT admin-only); para el turnero del barbero la única ruta
> imprescindible sigue siendo `/admin/turnos`.

---

## 7. Pruebas / criterios de aceptación (end-to-end)

1. **Admin** entra con su PIN → panel completo (8 secciones), sin regresiones.
2. **Barbero** entra con su PIN → solo Planilla y Turnero; ambas muestran **solo
   lo suyo**.
3. Un barbero **no** puede ver datos de otro: probar que `/admin/planilla` y
   `/admin/turnos` con su token ignoran cualquier `barbero_id` ajeno en el query.
4. PIN inexistente → "PIN incorrecto" (sin filtrar si el tenant existe).
5. Unicidad: no se puede crear/editar un barbero con PIN repetido ni poner el PIN
   admin igual al de un barbero (409).
6. Suscripción vencida (día 11+): admin → bloqueado; barbero → entra igual (D2).
7. Cerrar sesión desde el panel del barbero vuelve al MainScreen operativo y
   limpia el token barbero.

---

## 8. Riesgos y seguridad

- **Escalada por colisión admin↔barbero:** mitigada por unicidad (Fase 1) +
  orden admin-first + `warn` en `>1 match`. **No activar sin Fase 2.**
- **Acceso físico al iPad:** el modo barbero no re-verifica identidad más allá
  del PIN; cualquiera que sepa el PIN de un barbero ve su planilla (datos
  económicos). Es inherente al diseño elegido y aceptado (es el iPad del local
  detrás del login operativo). Si más adelante molesta, se evalúa PIN por sección.
- **Costo bcrypt en login:** N+1 compares por login del panel. Con ~8 barberos es
  despreciable; si un tenant tuviera decenas, revisar.

---

## 9. Archivos afectados (checklist)

**Backend**
- [x] `utils/pin.js` (nuevo) — `pinColisiona`. ✅ Fase 1.
- [x] `utils/suscripcion.js` (nuevo) — `evaluarSuscripcion` (refactor de authAdmin). ✅ Fase 3.
- [x] `controllers/gestion.js` — unicidad en `crearBarbero`, `editarBarbero`, `cambiarPinAdmin`. ✅ Fase 1.
- [x] `controllers/authAdmin.js` — usar `evaluarSuscripcion` (refactor). ✅ Fase 3.
- [x] `controllers/authPanel.js` (nuevo) — `loginPanel`. ✅ Fase 3.
- [x] `routes/authPanel.js` (nuevo) + registro en `index.js`. ✅ Fase 3.
- [x] Revisar `requiereRol` de `/admin/turnos`, `/admin/planilla`, `/admin/horario-atencion` (incluir `'barbero'`). ✅ Fase 3.
- [ ] `index.js` — endurecer `/admin/turnos` y `/admin/planilla` a `requiereRol('admin','barbero')` (excluir operativo; deuda en `estado_actual.md`). → Fase 6.

**Frontend (`/frontend`)**
- [ ] `services/api.js` — `loginPanel`.
- [ ] `screens/PantallaLoginAdmin.jsx` — usar `loginPanel`, copy neutral, pasar rol/barbero al `onAcceso`.
- [ ] `App.jsx` — estado `rolPanel` + `barberoSesion`, wiring del login y cierre de sesión.
- [ ] `screens/admin/PanelAdmin.jsx` — menú condicional + props a secciones.
- [ ] `screens/admin/sections/SeccionPlanillas.jsx` — `modoBarbero` (ocultar chips).
- [ ] `screens/admin/sections/SeccionTurnero.jsx` — `modoBarbero` (barbero único, sin acciones, fetches condicionales).

**Datos (operativo)**
- [x] Reasignar PINs únicos por tenant (Fase 2). ✅ Hecho por el dueño (2026-06-03).

**No se toca:** `frontend-barbero`, `controllers/authBarbero.js` (sigue sirviendo
a la app del barbero con selector + PIN, compatible con PINs únicos).

---

## 10. Para confirmar al iniciar el chat de ejecución

- D1–D5 de §5: **confirmadas** (2026-06-03). D1 = turnero read-only.
- Orden de ejecución: **un único branch `feature/acceso-barberos-panel`, commit por
  fase** (ver §6): Fase 1 (unicidad) → Fase 2 (sanear PINs) → Fases 3–6 (login
  unificado + frontend).
- **Avance al 2026-06-03:**
  - **Fase 1 ✅ hecha** (commit en `feature/acceso-barberos-panel`): `utils/pin.js` +
    409 en `gestion.js`. Deudas menores plegadas (rango de comisión, log a `warn`).
  - **Fase 2 ✅ resuelta** por el dueño (PINs únicos reasignados por tenant).
  - **Fase 3 ✅ hecha** — backend del login unificado: `utils/suscripcion.js`
    (`evaluarSuscripcion`), `controllers/authPanel.js` + `routes/authPanel.js`
    (`POST /api/auth/panel/login`), refactor de `authAdmin.js` para reusar el helper,
    y `/admin/horario-atencion` abierto a barbero por método (GET sí, PUT admin-only).
    `/admin/turnos` y `/admin/planilla` ya aceptaban barbero. Deuda de log plegada en
    `authAdmin.js` y `authBarbero.js`. Validado con Bruno.
  - **Próximo: Fase 4** — frontend: `loginPanel` en `api.js`, `PantallaLoginAdmin`
    usando el endpoint nuevo (copy neutral), `App.jsx` con estado `rolPanel` +
    `barberoSesion`. Ahí se elimina `/api/auth/admin/login` (cleanup).
- Nada pendiente de decisión: el plan está cerrado y listo para ejecutar la Fase 4.

*— Fin del documento —*
