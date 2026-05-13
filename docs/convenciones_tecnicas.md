# BARBERSHOP MANAGER — Convenciones Técnicas

Este documento es la referencia activa de cómo se escribe código en el proyecto.
Toda regla acá es estándar y se aplica sin excepción salvo acuerdo explícito.

---

## 1. Logs

### Formato
- Prefijo `[recurso]` en minúscula. El recurso es el nombre del archivo.
- Log de request recibido: `[recurso] nombreFuncion — request recibido | dato: valor`
- Log de operación completada: `[recurso] nombreFuncion — completado | dato: valor`
- Log de error: `console.error('[recurso] Error en nombreFuncion:', err.message)`

### Cuándo loguear
Siempre en estos 4 puntos:
1. Request recibido al inicio de cada controlador.
2. Operación completada tras cada INSERT/UPDATE exitoso.
3. Error en cada `catch`.
4. Eventos importantes en el frontend: carga de datos y envíos.

### Cuándo NO loguear
- Eventos de UI: clicks, cambios de tab, navegación, keystrokes, incrementos.
- Logs de montado en el cuerpo del componente (van en `useEffect([])`).
- Arrays completos: solo loguear `.length`, nunca el objeto.
- Nunca loguear PINs, passwords ni tokens JWT.

---

## 2. Manejo de errores

- En `catch`, la variable es siempre `err`. Nunca `error`.
- En el log siempre `err.message`, nunca el objeto completo.
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

- **Frontend:** React + Vite, inline styles, DM Sans, color primario `#1a7a4a`.
- **Backend:** Node.js + Express, ES Modules (`import/export`).
- **DB:** PostgreSQL via Supabase Session Pooler.
- **Auth:** bcrypt + JWT (token en memoria, `useState` en `App.jsx`).
- **Deploy:** Backend en Railway, Frontend en Vercel, dominio `barbermanager.app`.

---

*— Fin del documento —*
