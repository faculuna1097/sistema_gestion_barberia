# PLAN — Login del modo operativo

**Versión:** 1.0
**Fecha de planificación:** Mayo 2026
**Branch sugerido:** `feature/login-operativo`
**Resuelve:** punto 6 del audit de pendientes post-turnero (`GET /api/turnos` público + cualquier otro endpoint operativo público). Cierra también el punto 4 (enmascarar credenciales en logs) como subproducto.
**Estado:** Pendiente de ejecución.

---

## 1. Contexto

Hoy el "modo operativo" (iPad del local, FlujoCorte / FlujoVenta / FlujoGasto y vista de turnos del día) consume endpoints públicos sin autenticación: `/api/cortes`, `/api/ventas`, `/api/gastos`, `/api/turnos`. Esto significa que cualquiera que conozca el subdominio puede:

- Listar los turnos del día de un barbero (con nombres de clientes).
- Hacer POST de cortes/ventas/gastos arbitrarios.
- Listar/eliminar movimientos.

Aceptado como MVP cuando había un solo tenant en producción (Kingsai). Bloqueante para sumar más tenants.

---

## 2. Decisiones tomadas

1. **Credenciales:** columnas en `tenant` (`operativo_usuario`, `operativo_password_hash`). Un usuario operativo por tenant. Si más adelante se necesita multiusuario, se migra a una tabla `usuario_operativo` sin romper este diseño.
2. **Endpoints operativos aceptan rol `operativo` o `admin`** (admin es jerárquicamente superior).
3. **Setup inicial:** manual durante el onboarding del tenant (lo hace el dev). La password y el usuario se pueden cambiar desde el panel admin (`SeccionGestion`).
4. **Flujo del frontend de gestión:** entrada al sitio → **Login operativo (usuario + password)** → pantalla con los flujos operativos (FlujoCorte / FlujoVenta / FlujoGasto / Turnero) + ícono de candado → click en candado → PIN admin → Panel admin.
5. **Password:** mínimo 8 caracteres, sin más restricciones de complejidad.
6. **Token operativo:** JWT con `{ tenant_id, rol: 'operativo' }`, `expiresIn: '30d'`. Mismo `JWT_SECRET` que admin/barbero. Almacenado en `localStorage` con clave `token_operativo`.
7. **Sin "recordarme":** siempre localStorage, sin checkbox. Es el iPad del local, no un dispositivo público.
8. **Usuario operativo case-sensitive.** Igual que la password. Sin normalización.
9. **Rate limiting de logins:** fuera de scope. Deuda futura.

---

## 3. Cambios en la base de datos

### Paso 1 — Agregar columnas a `tenant`

```sql
ALTER TABLE public.tenant
  ADD COLUMN operativo_usuario text,
  ADD COLUMN operativo_password_hash text;
```

**Notas:**
- Ambas nullable. Un tenant sin credenciales cargadas no puede usar el modo operativo (el endpoint de login devuelve 401).
- En el mismo paso, setear credenciales iniciales para Kingsai y demo. Los valores se acuerdan en el chat de ejecución (Kingsai requiere coordinación con Federico antes del deploy). Hashes generados con un script Node aparte (`backend/src/scripts/generarHashOperativo.js` o similar, throwaway).

```sql
-- valores reales se completan en el chat de ejecución
UPDATE tenant SET operativo_usuario = '<usuario>', operativo_password_hash = '<bcrypt>' WHERE subdominio = 'kingsai';
UPDATE tenant SET operativo_usuario = '<usuario>', operativo_password_hash = '<bcrypt>' WHERE subdominio = 'demo';
```

---

## 4. Backend

### Paso 2 — Endpoint de login operativo

**`POST /api/auth/operativo/login`**

- Sin `verificarToken`, solo `tenantMiddleware`.
- Body: `{ usuario, password }`.
- Lógica:
  1. Validar `usuario` y `password` no vacíos. Devolver 400 si falta alguno.
  2. `SELECT operativo_usuario, operativo_password_hash FROM tenant WHERE id = $tenant_id`.
  3. Si `operativo_usuario` o `operativo_password_hash` son NULL → 401 con mensaje genérico ("Credenciales inválidas"). **No exponer que el tenant no tiene credenciales.**
  4. Comparar `usuario` (case-sensitive) y `bcrypt.compare(password, hash)`.
  5. Si falla cualquiera de los dos → 401 genérico (mismo mensaje, mismo timing si se puede).
  6. Si pasa → firmar JWT con `{ tenant_id, rol: 'operativo' }`, `expiresIn: '30d'`.
  7. Responder `{ token }`.

Archivos nuevos:
- `controllers/authOperativo.js`
- `routes/authOperativo.js`

Registro en `index.js`:
```javascript
app.use('/api/auth/operativo', authOperativoRoutes);
```

### Paso 3 — Endpoint para cambiar credenciales operativas (desde panel admin)

**`PUT /api/admin/operativo/credenciales`**

- Auth: `verificarToken` + `requiereRol('admin')`.
- Body: `{ usuario?, password? }` (ambos opcionales — se puede cambiar solo uno).
- Lógica:
  1. Validar al menos uno de los dos viene cargado.
  2. Si viene `password`, validar mínimo 8 caracteres.
  3. Si viene `usuario`, validar al menos 3 caracteres.
  4. Hashear la password con bcrypt (saltRounds según convención del proyecto — confirmar al ejecutar).
  5. UPDATE en `tenant` solo de las columnas que vinieron.
  6. Responder 204.

Archivos nuevos:
- `controllers/operativoCredenciales.js`
- `routes/adminOperativoCredenciales.js`

Registro en `index.js`:
```javascript
app.use('/api/admin/operativo', verificarToken, requiereRol('admin'), adminOperativoRoutes);
```

### Paso 4 — Enmascarar passwords/PINs en logs

El logging global de `index.js` (deuda técnica conocida) loguea el body completo de cada request. Esto incluye PIN admin, PIN barbero, y ahora password operativa. Es bloqueante porque las credenciales viajarían en texto plano a Railway.

**Solución:** middleware antes del logger que clona el body y reemplaza keys sensibles con `***`. Lista inicial:
- `/api/auth/verificar-pin` → enmascarar `pin`
- `/api/auth/barbero/login` → enmascarar `pin`
- `/api/auth/operativo/login` → enmascarar `password`
- `/api/admin/operativo/credenciales` → enmascarar `password`

Implementación: helper `sanitizarBodyParaLog(req)` que devuelve una copia del body con las keys sensibles reemplazadas. Aplicado en el logger global.

**Este paso va ANTES del Paso 5** para que durante la transición ningún password viaje en claro a logs.

### Paso 5 — Inventario y protección de endpoints operativos

**Acción del chat de ejecución:** leer `backend/src/index.js` y listar todos los endpoints sin `verificarToken`. Para cada uno, decidir si va al lado "protegido" o "público".

**Endpoints conocidos a proteger (`verificarToken` + `requiereRol('operativo', 'admin')`):**

| Endpoint | Razón |
|---|---|
| `POST /api/cortes` | Operativo |
| `POST /api/ventas` | Operativo |
| `POST /api/gastos` | Operativo |
| `GET /api/turnos` (operativo, NO `/api/turnero/*`) | Operativo, expone datos de clientes |
| GET/DELETE de cortes/ventas/gastos (si existen como públicos) | Operativo |

**Endpoints que se mantienen públicos (NO tocar):**

| Endpoint | Razón |
|---|---|
| `GET /api/productos` | El turnero del cliente también los consume |
| `GET /api/servicios` | Idem |
| `GET /api/barberos` | Idem; lo usa la app del barbero para el selector de login |
| `GET /api/negocio` | Datos públicos del tenant |
| Todo `/api/turnero/*` | Pública por diseño (cliente anónimo) |
| Todo `/api/auth/*` | Logins |

**Riesgo a evitar:** olvidarse un endpoint operativo público y dejarlo desprotegido. El inventario tiene que ser exhaustivo. Por eso este paso es explícito y se hace mirando `index.js` con confirmación uno por uno.

---

## 5. Frontend de gestión

### Paso 6 — Nuevo flujo de entrada

**Pantallas:**

```
Entrada (/)
  → Login operativo (usuario + password)
      → Pantalla principal del modo operativo:
          - FlujoCorte
          - FlujoVenta
          - FlujoGasto
          - (otros flujos)
          - 🔒 candado en alguna esquina
              → PIN admin (modal o pantalla)
                  → Panel admin (PanelAdmin actual)
```

**Cambios concretos en `App.jsx`:**
- Nuevo estado `tokenOperativo` (string | null), inicializado desde `localStorage.getItem('token_operativo')`.
- Al iniciar:
  - Si hay `tokenOperativo` → entra directo a la pantalla principal del modo operativo.
  - Si no hay → pantalla de login operativo.
- El flujo del PIN admin queda como hoy (se accede desde el candado, no desde la pantalla inicial).
- **Logout operativo:** botón visible en la pantalla principal del modo operativo. Borra `tokenOperativo` de localStorage y de estado, vuelve al login.

**Llamadas API:**
- Crear helper `apiFetchOperativo` paralelo al `apiFetch` admin, que inyecta `Authorization: Bearer <tokenOperativo>` en cada request a endpoints operativos.
- Manejo de 401: si el backend responde 401, borrar `tokenOperativo` y mandar a re-login.
- Refactor de los flujos actuales (FlujoCorte, FlujoVenta, FlujoGasto) para usar `apiFetchOperativo` en lugar de fetch directo público.

**Decisión a confirmar al ejecutar:** si conviene un solo helper unificado que detecte el contexto, o dos helpers separados. Lo decidimos al leer `services/api.js`.

### Paso 7 — Sección "Credenciales del modo operativo" en `SeccionGestion`

Nuevo tab (o sub-sección dentro de un tab existente — decidir al ejecutar):

**Campos:**
- Usuario (precargado con el actual, editable).
- Password (vacío; solo se actualiza si se escribe algo).
- Botón "Guardar".

**Validaciones del lado cliente:**
- Password mínimo 8 caracteres si se escribió algo.
- Usuario mínimo 3 caracteres si se cambia.

**Llamada:** `PUT /api/admin/operativo/credenciales` con solo los campos que cambiaron.

**Feedback al usuario:** mensaje de éxito/error inline.

---

## 6. Migración y rollout

### Paso 8 — Coordinación con Kingsai

Antes de mergear a `main`:
1. Acordar usuario y password con Federico (dueño de Kingsai).
2. Generar hash con script Node throwaway.
3. Incluir el UPDATE de Kingsai en el SQL del Paso 1.
4. Avisar a Federico que la próxima vez que abra el iPad le va a pedir credenciales.

**Crítico:** si Kingsai recibe el código antes de tener credenciales seteadas, el iPad deja de funcionar (los endpoints operativos rechazan los requests sin token). Por eso el SQL del Paso 1 ya incluye el UPDATE.

---

## 7. Orden de ejecución (resumen para el próximo chat)

1. **SQL en Supabase** — Paso 1 (columnas nuevas + UPDATE de Kingsai y demo con credenciales acordadas). Hashes generados con script Node throwaway.
2. **Backend — login operativo** (`POST /api/auth/operativo/login`).
3. **Backend — cambio de credenciales** (`PUT /api/admin/operativo/credenciales`).
4. **Backend — enmascarar passwords/PINs en logs.** Va antes que el Paso 5.
5. **Backend — inventariar endpoints operativos públicos en `index.js`** y aplicar `verificarToken` + `requiereRol('operativo', 'admin')` uno por uno con confirmación.
6. **Frontend de gestión — nuevo flujo de entrada** (login operativo → modo operativo → candado → PIN admin).
7. **Frontend de gestión — sección de credenciales en `SeccionGestion`.**
8. **Pruebas integradas en demo:**
   - Login operativo con credenciales correctas.
   - Login operativo con credenciales incorrectas (debe dar 401 genérico).
   - Registrar corte/venta/gasto autenticado.
   - Intentar POST sin token (debe dar 401).
   - Token vencido → redirige a login.
   - Cambiar credenciales desde admin.
   - Login con nuevas credenciales.
   - Cambiar usuario (no password) y viceversa.

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Kingsai deja de operar el día del deploy | UPDATE en el mismo SQL del Paso 1 con credenciales acordadas con Federico |
| Olvido de algún endpoint operativo público y queda desprotegido | Paso 5 explícito de inventario completo de `index.js` antes de codear cada protección |
| Password de Kingsai/demo se loguea en Railway durante la transición | Paso 4 (enmascarar) va antes que el Paso 5 (proteger endpoints) |
| Token operativo expira a los 30d en medio de un día de trabajo | Manejo de 401 → redirige a login. Es 30 días, debería renovarse antes de vencer |
| Admin pierde el PIN y la password operativa al mismo tiempo | Reseteo manual en DB por el dev (igual que hoy con el PIN admin) |
| Cambio de credenciales operativas desde panel admin no invalida tokens existentes | Aceptado para MVP. JWT son self-contained; para invalidar habría que mantener una blacklist o cambiar el secret. Deuda futura |
| Brute force contra `/api/auth/operativo/login` | Aceptado para MVP. Rate limiting es deuda futura |

---

## 9. Detalles técnicos a confirmar al inicio del chat de ejecución

Lo que no se puede definir sin leer código:

1. **Credenciales iniciales para Kingsai y demo** (usuario + password en texto plano, para generar el hash). Acordar con Federico para Kingsai.
2. **Inventario de endpoints públicos actuales** en `backend/src/index.js`.
3. **Convención de saltRounds de bcrypt** en el código actual.
4. **En qué TabGestión se mete la sección de credenciales operativas** (tab existente o nuevo). Decisión al leer `SeccionGestion`.
5. **Cómo está implementado hoy el flujo de entrada en `App.jsx`** y la estructura del modo operativo, para saber qué se reescribe y qué se preserva.
6. **Cómo está estructurado `services/api.js`** del frontend de gestión, para decidir si conviene un helper `apiFetchOperativo` separado o uno unificado con detección de contexto.

---

## 10. Trabajo futuro relacionado (no parte de este plan)

- **Endpoint admin de invalidación del caché del `tenantMiddleware`** (deuda preexistente). No bloquea este plan porque las credenciales operativas no se cachean (se leen frescas en cada login).
- **Rate limiting de logins** (admin, barbero, operativo).
- **Multiusuario operativo** (uno por empleado, con trazabilidad). Migración de columnas en `tenant` a tabla `usuario_operativo`.
- **Invalidación de tokens operativos al cambiar credenciales.** Hoy un token viejo sigue siendo válido hasta su expiración natural aunque la password haya cambiado.
- **Renombrar `/api/auth/verificar-pin` → `/api/auth/admin/login`** para consistencia con `/api/auth/barbero/login` y `/api/auth/operativo/login`.

---

*— Fin del documento —*
