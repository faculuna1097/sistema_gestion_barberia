# BARBERSHOP MANAGER — Convenciones Técnicas

Este documento es la referencia activa de cómo se escribe código en el proyecto.
Toda regla acá es estándar y se aplica sin excepción salvo acuerdo explícito.

---

## 1. Logs

El criterio es simple: **se loguea solo lo que aporta señal cuando algo se rompe o cuando audita un cambio de estado.** Todo lo demás es ruido y empeora la lectura.

### Formato
- Prefijo `[modulo]` en minúscula, donde `modulo` es el nombre del archivo (sin extensión).
- Estructura: `[modulo] nombreFuncion — descripción | dato1: valor | dato2: valor`
- Los datos se separan con ` | `, key-value.
- Nunca loguear arrays/objetos completos: solo `.length` o los campos relevantes.
- Nunca loguear PINs, passwords, tokens JWT ni `req.body` que pueda contenerlos.
- Si necesitás loguear `req.body`, pasalo por `sanitizarObjeto` (`backend/src/utils/sanitizarLogs.js`) — enmascara campos sensibles.

### Backend — qué SÍ se loguea

1. **Errores en `catch`** — siempre con el `err` completo (no solo `err.message`), para preservar el stack trace.
   ```js
   console.error('[modulo] Error en nombreFuncion:', err);
   ```
2. **Eventos de negocio que mutan estado** — POST/PUT/PATCH/DELETE exitosos en escrituras relevantes (crear/cancelar turno, eliminar movimiento de caja, cambiar PIN, cascadas de cancelación por feriado/suspensión/cambio de horario). Conciso, con el id de la entidad y el dato clave:
   ```js
   console.log('[turnos] cancelarTurno completado | turno_id:', turnoId);
   ```
3. **Conflictos de negocio relevantes** — `console.warn` cuando un caso raro y real ocurre: slot ocupado, stock insuficiente, turno ya vinculado a otro corte, estado no cancelable, suscripción vencida.
4. **Eventos de seguridad** — `console.warn` en intentos de login fallidos (PIN incorrecto, credenciales operativas incorrectas, tenant no encontrado). Sirven para detectar abuso.
5. **Arranque del proceso** — un log por subsistema cuando se inicializa (DB pool, mailer, integración Calendar, servidor escuchando). Son one-shot, no contaminan runtime.
6. **Log de acceso HTTP global** — uno por request, vive en el middleware de `index.js`. No replicarlo por función.

### Backend — qué NO se loguea

- **No** "request recibido" al entrar a cada función — el log de acceso HTTP global ya cubre eso.
- **No** "completado" en lecturas (GET) — el resultado se ve en la respuesta HTTP.
- **No** validaciones de input faltante (400) — error del cliente, no accionable.
- **No** pasos intermedios de "devuelvo array vacío porque X" — debug de desarrollo.
- **No** entrada/salida de middlewares que corren en cada request (auth, tenant) — ruido masivo.

Excepción: los scripts CLI en `backend/src/scripts/` quedan fuera de estas reglas — ahí `console.log` es la interfaz del script, no logging de runtime.

### Frontend — regla simple

En el navegador del cliente nadie lee la consola en producción. Por eso el criterio es estricto: **solo se loguea lo que salió mal.**

1. **Errores en `catch`** — `console.error('[modulo] Error en X:', err.message)`. En frontend no hay stack server-side que preservar, alcanza con `err.message`.
2. **Degradaciones funcionales** — `console.warn` cuando una falla recuperable degrada la experiencia: `localStorage` inaccesible, una imagen opcional no carga, 401 que dispara redirect a login.

Nada más. **Sin trace de navegación, sin "paso N — X seleccionado", sin "completado" de cargas o de guardados, sin render/montado, sin "navegando a Y".** La UI ya da feedback al usuario; la consola no es el lugar.

### Convención de nivel
- `console.log` — eventos de negocio normales (escrituras exitosas, arranque).
- `console.warn` — algo anómalo pero recuperable (conflicto de negocio, degradación frontend, login fallido).
- `console.error` — algo que rompió el flujo (entró al `catch`).

---

## 2. Manejo de errores

- En `catch`, la variable es siempre `err`. Nunca `error`.
- En backend, loguear el `err` completo (preserva el stack trace). En frontend, alcanza con `err.message`.
- En frontend: `setEliminando(true)` / `setCargando(true)` van **antes** del `try`, no dentro.

### Ids que llegan del cliente

Todo id de una request se valida con `esUUID` (`backend/src/utils/validarUuid.js`) antes de tocar la DB. Sin eso, Postgres responde con el error `22P02` y el usuario ve un 500. No se atrapa el `22P02`: se valida antes.

Qué se responde depende de dónde viene el id:

| Origen | Respuesta | Mensaje |
|---|---|---|
| URL o body | **404** | El mismo que ese recurso usa cuando no existe (un id mal formado cuenta como "no existe"). |
| Query param | **400** | `barbero_id debe ser un UUID válido` (`MENSAJE_BARBERO_ID_INVALIDO`, en el caso de `barbero_id`). |

- Con rol barbero, el `barbero_id` del query o del body se ignora: se valida solo cuando se usa. Ese scoping vive en `backend/src/utils/scopingRol.js`, salvo en `horarios.js`, que responde 403.
- Un id opcional se valida solo si vino. Por ejemplo, `createCorte` sin `turno_id` es un cliente sin turno.
- Los helpers `barberoActivoEnTenant`, `socioActivoEnTenant` y `calcularDuracionServicio` ya validan el formato: un id mal formado devuelve "no encontrado" y el caller responde 404.
- Un status dice la categoría del error, y el mensaje dice el detalle. No se inventan status ni se reusa uno con otro significado (405 es "método no permitido").

---

## 3. Asincronía

- `async/await` en todos los controladores y `useEffect`.
- Nunca `.then().catch()`.
- En `useEffect` con fetch: `async/await` + `finally` para resetear estados de carga.

---

## 4. Timezone y fechas

### Constante TZ
La constante `TZ = 'America/Argentina/Buenos_Aires'` vive centralizada en
`backend/src/utils/constantes.js`. Importar desde ahí en cada archivo que la
use:
```js
import { TZ } from '../utils/constantes.js';
```
Nunca hardcodear el string en queries ni redeclararlo al tope del archivo.

### Aritmética de fechas con TZ
Para cualquier cómputo que requiera sumar minutos, comparar rangos, o
generar grillas en TZ Argentina, usar **luxon** (`DateTime.fromISO(s, { zone: TZ })`,
`.plus({ minutes })`, `.setZone()`). Evitar `new Date(...toLocaleString('en-US', ...))`
en código nuevo.

### Queries SQL
Formato correcto:
```sql
DATE(timestamp AT TIME ZONE tz) = (NOW() AT TIME ZONE tz)::date
```
**Nunca** usar `CURRENT_DATE AT TIME ZONE tz` — `CURRENT_DATE` es tipo `date`, no `timestamp`.

### Fechas desde Postgres
Las columnas `DATE` llegan como objetos `Date` de JS, no strings.
Para comparar como string, convertir siempre con:
```js
new Date(fecha).toISOString().slice(0, 10)
```

### Fechas que llegan del cliente
Las fechas de calendario (`'YYYY-MM-DD'`) que llegan por query o body se validan con
`esFechaISO` de `utils/validarFecha.js` (formato + fecha real: `2026-02-31` es inválida), y "hoy"
en hora argentina sale de `hoyISO()`. No redeclarar un regex de fecha en cada controller.

Los **instantes** (fecha y hora, columnas `timestamptz`) que llegan del cliente se parsean con
`parsearInstante` del mismo archivo, **nunca** se pasan crudos al SQL ni se comparan con `new Date()`:
- sin zona (`'2026-10-20T10:00'`, lo que manda un `<input type="datetime-local">`) → **hora argentina**.
  Si el string llega crudo a Postgres, la sesión (UTC) lo toma como UTC y el horario se corre 3 h;
- con `Z` u offset (`'...-03:00'`) → se respeta;
- inválido, sin hora o solo hora → `null` → el controller responde 400.

Devuelve un `DateTime` en `TZ` (ver la excepción para instantes más abajo); a la DB se le pasa
`.toISO()`, que lleva el offset.

### Normalización canónica vs presentación
Son dos capas distintas; no mezclarlas:

- **Normalización (canónica)** — sacar las rarezas de la DB y dejar **una sola
  forma interna**, determinista y sin locale. Va en el **borde de lectura del
  backend**, apenas sale la query: el backend es el dueño de la base y el único
  que debería conocer que un `TIME` llega `'HH:MM:SS'` o que un `DATE` llega como
  objeto `Date`. La API expone el valor ya canónico (`'HH:MM'`, `'YYYY-MM-DD'`),
  nunca el crudo de pg → ningún cliente (gestión, barbero, turnero, scripts)
  reimplementa el recorte. Lo mismo con los montos: pg entrega los `NUMERIC` como
  string y la API los expone como número.
- **Presentación** — convertir lo canónico a algo para un humano (`"9 de junio,
  14:30hs"`). Depende de locale/contexto → va en el **borde de render del
  frontend**, lo más tarde posible. Nunca guardar un string de presentación
  dentro de un objeto de dominio (perdés la capacidad de comparar/reordenar/recalcular).

Regla práctica: **normalizá temprano (al leer en el backend), presentá tarde (al
renderizar en el front).** El front puede mantener una red defensiva idempotente
en su propio borde (ej. `aHoraCorta` en `utils/fecha.js`), pero el contrato de la
API es canónico.

**Excepción para instantes (`timestamptz`):** la "normalización" no es un recorte
de string sino mantener el **objeto rico** (`DateTime` de luxon en `TZ`) el mayor
tiempo posible, y serializar a string sólo en el borde. No stringificar un instante
apenas sale de la base: la lógica intermedia lo necesita como objeto para la
aritmética de fechas (sumar minutos, comparar rangos).

---

## 5. Multi-tenancy

- En todos los controllers: `req.tenant_id` siempre. Nunca constante local hardcodeada.
- `tenantMiddleware.js` lee el header `X-Tenant-Subdomain` enviado por el frontend, resuelve `tenant_id` desde DB con caché en memoria, y lo inyecta en `req.tenant_id`.
- Fallback a `TENANT_ID` en `.env` solo para desarrollo local (localhost no tiene subdominio).
- El frontend extrae el subdominio de `window.location.hostname` al arrancar, y solo si el hostname termina en `.barbermanager.app`; cualquier otro host (localhost, una IP de red local) da `undefined` y cae al fallback de `TENANT_ID`.
- `publicHeaders` en `api.js` incluye `X-Tenant-Subdomain` en todas las funciones públicas.
- `apiFetch` incluye `X-Tenant-Subdomain` en todas las llamadas del panel admin.

---

## 6. Base de datos — Supabase Session Pooler

- **Nunca** `pool.connect()`.
- **Nunca** `BEGIN` / `COMMIT` (incompatibilidad con PgBouncer free plan, IPv4-only).
- Inserts secuenciales con cleanup manual si algo falla.
- `db.js` exporta como named exports `query` (lo que usa todo el código), `cerrarPool` (cierre limpio del cron), `testConnection` e `iniciarKeepAlive` (arranque). El pool crudo no se exporta.
- Pool con `max: 3`, `ssl: { ca: <config/supabase-ca.crt>, rejectUnauthorized: true }` y `statement_timeout` de 5s por conexión (un `SET` en el hook `onConnect`: el pooler descarta `options` y el parámetro `statement_timeout` del `Pool`).
- Toda tabla nueva se crea con RLS activado y sin policies (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`): cierra la API automática de Supabase, y el backend entra igual porque se conecta como dueño de las tablas. El SQL editor no lo activa solo. Ver `estado_actual.md` → RLS.
- `query()` reintenta **una vez** ante errores de conexión (no de SQL). Las escrituras no idempotentes que no deben reejecutarse (ajustes relativos de stock, `stock_actual = stock_actual ± $1`) van con `query(sql, params, { reintentar: false })` — ver `utils/stock.js`.

---

## 7. ABMs — sin DELETE

No se eliminan registros en ABMs. Se usa el campo `activo` (true/false) para preservar integridad referencial.

---

## 8. Frontend — patrones generales

### apiFetch (Opción B)
- Recibe solo el path relativo: `apiFetch('/recurso/endpoint')`.
- Construye la URL internamente.
- `BASE_URL` no se exporta. Los componentes no conocen la URL base.
- No pasar `headers: { 'Content-Type': 'application/json' }` — `apiFetch` lo agrega internamente.

### Eventos táctiles
- **Siempre `onClick`. Nunca `onPointerDown`.** (`onPointerDown` dispara al apretar, no se puede cancelar deslizando afuera, y rompe la accesibilidad por teclado.) El rediseño migró todo a `onClick`; ver `sistema_de_disenio.md` §4.3.

### Después de una acción: la pantalla nunca queda vieja ni vacía
Decidido el 2026-10-19, en la Agenda del barbero. Cuando el usuario confirma una acción que cambia datos (crear, liberar, cancelar…), entre que confirma y la recarga la pantalla no muestra un rato el estado anterior ni un hueco vacío:
- **Mientras responde el servidor**, el diálogo (o el botón) queda en "Procesando…".
- **Con la respuesta**, el cambio se dibuja al instante con los datos que devolvió el servidor, no con lo que el front supone que pasó. Recién ahí se cierra el diálogo. Después se recarga por detrás, sin skeleton, para confirmar. Ej.: `agregarDescanso` (`frontend-barbero/src/components/agenda/datosAgenda.js`) dibuja el descanso con la fila que devolvió `POST /admin/descansos`.
- **Si la respuesta no alcanza para dibujar el cambio** (ej. liberar un descanso en curso, que lo acorta y vuelve a abrir slots), el diálogo sigue en "Procesando…" hasta que termina la recarga, y se cierra con la pantalla ya actualizada.
- **Nada se dibuja antes de que responda el servidor** (sin UI optimista): si falla (409, 400), no hay nada que deshacer.

Dónde está aplicada: en todas las acciones de la app del barbero. En la Agenda, marcar un descanso lo dibuja con `agregarDescanso` y liberarlo espera la recarga; no asistió y cancelar un turno lo dibujan con `aplicarEstadoDeTurno`, con el `{ id, estado }` que devuelve el servidor. En el Inicio (`Dashboard.jsx`), las mismas dos acciones cambian el estado del turno en la lista con esa respuesta (desde el 2026-10-19). Falta en el resto de los fronts, que no están relevados.

### Estructura del panel admin
- Cada `SeccionXxx` es autónoma y carga sus datos en `useEffect([])`.
- `PanelAdmin` solo maneja layout. No hay precarga global del panel.
- `App.jsx`: `precargarDatos` como `useCallback`, se llama al arrancar y al cerrar sesión admin (para que los flujos reflejen cambios de Gestión sin reiniciar la app).

### Scroll global del panel
- `contenidoWrapper` (flex column) contiene `BannerAviso` + `main`.
- El `main` tiene `flex: 1` y `overflow: auto`.
- Las secciones no tienen overflow propio.

### Posicionamiento de helpers
- Las funciones helper (ej: `ExcelIcon`) van **arriba** del componente que las usa, nunca después del `default export`.

### Lint
- `npx eslint .` pasa sin errores ni warnings en los cuatro fronts.
- **`react-hooks/set-state-in-effect` está apagada en los cuatro** (`eslint.config.js`). El patrón de carga de datos del proyecto (§3: `useEffect` con `async/await` y `setCargando(true)`) dispara falsos positivos: en el montaje `cargando` ya es `true`, así que React descarta el render. Decidido el 2026-10-30, en vez de reescribir ese patrón en todas las pantallas.

---

## 9. Stack y deploy (referencia)

Stack y deploy viven en [`estado_actual.md`](estado_actual.md) §Stack y §Deploy. Lo visual, en [`sistema_de_disenio.md`](sistema_de_disenio.md).

---

## 10. Medición de performance

Reglas para que los números signifiquen algo (aprendidas midiendo el turnero y gestión):

- **Nunca medir sobre `npm run dev`.** El dev server sirve módulos sueltos, sin minificar, sin
  gzip, con HMR → miente. Medir **siempre** sobre build de prod servido con `vite preview`
  (`npm run build` → `npm run preview`).
- **Network tab:** `☑ Disable cache` (simula 1ª visita) + **throttling** (Fast/Slow 4G; sin
  throttle localhost sirve en ~5 ms y la cascada miente).
- **Emular el celular real, no el iPad.** El User-Agent cambia lo que sirve el server: en iPad
  Google Fonts mandó 6 `.ttf`; en iPhone real, 2 `.woff2` (fuentes variables). Medir el
  dispositivo equivocado dio un diagnóstico peor que la realidad.
- **Gestión, turnero y barbero son CSR puro (Vite SPA):** el HTML llega vacío; el bundle pega doble
  en mobile (descarga **y** ejecución, ~3–4× más lenta en celular). Para la CPU del celular la cura
  es **mandar menos JS** (code-split), no cachear (el cache no ahorra parse/execute).
- **La landing es la excepción: se pre-renderiza (SSG)** desde 2026-10-01. El HTML llega completo y
  React hidrata encima, así que el contenido pinta sin esperar al JS. Al medirla, el primer paint
  ya no depende del bundle; mirá el salto de layout (CLS) y la hidratación. Detalle en
  [`decisiones_landing_ia.md`](./decisiones_landing_ia.md).
- **Medí antes de optimizar.** El cuello casi nunca es lo que uno sospecha: el JS del turnero
  parecía el problema y estaba exonerado (descarga 300 ms, ejecución 237 ms @ CPU 4×); el cuello
  real era el backend.
- **Local no mide bien la red ni el cold start del backend.** Apunta a la LAN (latencia ~0) y un
  backend local no duerme. La penalidad de conexión fría es **proporcional a la distancia
  backend↔DB** → medir contra el deploy real (la topología correcta), no contra local.
- **Trampas de herramienta:** `curl -I` (HEAD) sobre Supabase Storage devuelve `Cache-Control:
  no-cache` siempre (enmascara el header real) → medir con **GET** (`curl -s -o NUL -D -`).
- **Regla de negocio innegociable:** **nunca cachear disponibilidad/slots** (riesgo de doble
  booking). Cachear solo lo **público y estable**: imágenes, nombre/horario/ubicación del negocio.

---

*— Fin del documento —*
