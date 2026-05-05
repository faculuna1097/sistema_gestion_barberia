# Estado actual del proyecto

Última actualización: mayo 2026.

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
- Variables de entorno: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `NODE_ENV=production`, `PORT=3000`
- `TENANT_ID` eliminado de Railway — ya no se usa en producción.

### Frontend — Vercel
- URL genérica: `https://sistema-gestion-barberia.vercel.app`
- Root Directory: `/frontend`
- `VITE_API_URL = https://sistemagestionbarberia-production.up.railway.app` (sin barra final)
- Auto-deploy en push a `main`.
- Wildcard domain `*.barbermanager.app` configurado en Vercel.

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
- Auth: bcrypt + JWT ✅ — `usuario_registro` eliminado del schema.
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
- **Software propio de turnero** para integrar con el sistema de gestión.

---

## Deudas técnicas conocidas

- **Columna `tenant.configuracion`:** se setea por default con `{"ciudad": "Buenos Aires", "moneda": "ARS"}` en `crearTenant.js` para mantener consistencia con los tenants existentes, pero falta verificar si efectivamente se usa en algún controller. Si no se usa, evaluar si conviene eliminarla o si es para uso futuro.
- **Caché del `tenantMiddleware` sin invalidación:** ver pendiente "Endpoint admin de invalidación de caché". Es la mitigación planificada.

*— Fin del documento —*
