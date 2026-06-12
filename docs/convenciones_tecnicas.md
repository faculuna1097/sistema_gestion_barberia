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
- Si necesitás loguear `req.body`, pasalo por `sanitizarObjeto` (definido en `backend/src/index.js`) — enmascara campos sensibles.

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
Nunca hardcodear el string en queries ni redeclararlo al tope del archivo
en código nuevo. (Algunos archivos previos al refactor del turnero siguen
con la declaración local; ver deudas técnicas en `estado_actual.md`.)

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

### Normalización canónica vs presentación
Son dos capas distintas; no mezclarlas:

- **Normalización (canónica)** — sacar las rarezas de la DB y dejar **una sola
  forma interna**, determinista y sin locale. Va en el **borde de lectura del
  backend**, apenas sale la query: el backend es el dueño de la base y el único
  que debería conocer que un `TIME` llega `'HH:MM:SS'` o que un `DATE` llega como
  objeto `Date`. La API expone el valor ya canónico (`'HH:MM'`, `'YYYY-MM-DD'`),
  nunca el crudo de pg → ningún cliente (gestión, barbero, turnero, scripts)
  reimplementa el recorte.
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
- El frontend extrae el subdominio de `window.location.hostname` al arrancar.
- `publicHeaders` en `api.js` incluye `X-Tenant-Subdomain` en todas las funciones públicas.
- `apiFetch` incluye `X-Tenant-Subdomain` en todas las llamadas del panel admin.

---

## 6. Base de datos — Supabase Session Pooler

- **Nunca** `pool.connect()`.
- **Nunca** `BEGIN` / `COMMIT` (incompatibilidad con PgBouncer free plan, IPv4-only).
- Inserts secuenciales con cleanup manual si algo falla.
- `db.js` exporta `{ query }` como named export.
- Pool con `max: 3`, `ssl: { rejectUnauthorized: false }`.

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
- `onPointerDown` en botones operativos. **Nunca** `onClick`.
- Aplica a: teclas del teclado de PIN, botones de selección en flujos, selectores de mes, botones exportar, tabs.

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

---

## 9. Stack y deploy (referencia)

- **Frontend:** React + Vite, inline styles, tipografía **Geist**, acento único **indigo `#4F46E5`** (token `theme.accent`). *(El verde `#1a7a4a` y "DM Sans" eran el stack viejo pre-rediseño; la fuente de verdad visual es `sistema_de_disenio.md` + `theme/tokens.js`.)*
- **Backend:** Node.js + Express, ES Modules (`import/export`).
- **DB:** PostgreSQL via Supabase Session Pooler.
- **Auth:** bcrypt + JWT (token en memoria, `useState` en `App.jsx`).
- **Deploy:** Backend en Railway, Frontend en Vercel, dominio `barbermanager.app`.

---

*— Fin del documento —*
