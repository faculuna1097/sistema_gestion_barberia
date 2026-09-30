# Onboarding de un nuevo cliente

Runbook interno para dar de alta una barbería nueva en el sistema.

> Este documento es para uso interno. La guía que recibe el cliente sobre cómo usar el sistema vive en `manual_cliente.md` (pendiente).

---

## Pre-requisitos

Antes de arrancar, tener:

- Repo del backend clonado y dependencias instaladas (`npm install` en `/backend`).
- Acceso al panel de Supabase del proyecto.
- Datos del cliente: nombre del negocio, subdominio deseado, PIN inicial de 4 dígitos, y usuario + password del modo operativo (el login del iPad del local; password de 8+ caracteres).

> El `.env` local no necesita configuración especial para correr los scripts. `crearTenant.js` no lee `TENANT_ID`.

---

## Flujo completo

1. El cliente acuerda contratar el sistema y te pasa: nombre del negocio, subdominio deseado, PIN inicial y las credenciales operativas que quiere.
2. Corrés `crearTenant.js` para dar de alta el tenant en la DB.
3. Corrés `generarHashOperativo.js` para cargarle las credenciales del modo operativo.
4. Cargás los dueños del negocio (tabla `socio`) y las categorías de gasto, por SQL.
5. Verificás que el subdominio responde, el login operativo entra y el PIN funciona.
6. Le entregás al cliente la URL, las credenciales operativas y el PIN. Le mandás el manual por separado.
7. (Opcional, cuando llegue) Cargás el logo y las imágenes del cliente desde el panel (Gestión → Negocio).

---

## Paso 1 — Crear el tenant

Desde la raíz de `/backend`:

```bash
node src/scripts/crearTenant.js "Nombre Barbería" subdominio 1234
```

**Argumentos:**
- Nombre del negocio (entre comillas si tiene espacios).
- Subdominio (sin puntos ni espacios, en minúscula).
- PIN inicial de 4 dígitos.

**El script hace:**
- Valida que el PIN sea de 4 dígitos numéricos.
- Verifica que el subdominio no exista ya en la DB.
- Hashea el PIN con bcrypt.
- Setea `suscripcion_vigente_hasta` al último día del mes actual.
- Setea `configuracion` con el default `{ "ciudad": "Buenos Aires", "moneda": "ARS" }`.
- Inserta el tenant con `activo = true`.
- Seedea el horario de atención default en `tenant_horario_atencion`: **Lunes a Sábado 10:00-19:00** (domingo cerrado). El dueño lo ajusta desde el panel admin (Gestión → Negocio) al activar la cuenta.
- Imprime el UUID, nombre, subdominio, fecha de suscripción, horario y URL.

> Si el seed del horario falla (caso raro), el script igual termina con éxito: el tenant queda creado y se avisa por consola para cargar el horario manualmente desde el admin.

**Output esperado:**

```
[crearTenant] ✅ Tenant creado correctamente
  ID:           <uuid>
  Nombre:       Nombre Barbería
  Subdominio:   subdominio
  Suscripción:  vigente hasta YYYY-MM-DD
  Horario:      L-S 10:00-19:00 (default, ajustable desde el admin)
  URL:          subdominio.barbermanager.app
```

---

## Paso 2 — Credenciales del modo operativo

`crearTenant.js` **no** crea las credenciales operativas, y sin ellas el front se queda en la
pantalla de login operativo (es lo primero que muestra si no hay sesión). Se cargan con
`generarHashOperativo.js`, que hoy no recibe argumentos: antes de correrlo, editá las
constantes del tope del archivo (`TENANT_ID` = el UUID que imprimió el Paso 1, `USUARIO_PLANO`,
`PASSWORD_PLANO`). **No commitees ese cambio.**

```bash
node src/scripts/generarHashOperativo.js
```

Hashea la password con bcrypt y hace el `UPDATE` de `operativo_usuario` + `operativo_password_hash`
en la fila del tenant (si ya había credenciales, las pisa). Después el cliente las puede cambiar
desde el panel (Gestión → Seguridad).

---

## Paso 2b — Dueños del negocio (socios)

Los aportes y retiros que se cargan en Caja van contra un dueño elegido de una lista (tabla
`socio`). Sin dueños cargados, el formulario no deja guardarlos. No hay pantalla de alta: se
cargan por SQL (Supabase → SQL Editor).

```sql
-- Dueño que no corta (o cuyos barberos todavía no están cargados):
INSERT INTO socio (tenant_id, nombre) VALUES ('<tenant_uuid>', '<Nombre>');

-- Dueños que también cortan, vinculados a su fila de barbero:
INSERT INTO socio (tenant_id, nombre, barbero_id)
SELECT tenant_id, nombre, id FROM barbero
WHERE tenant_id = '<tenant_uuid>' AND id IN ('<barbero_id>', '<barbero_id>');

-- Vincular después un dueño a su barbero:
UPDATE socio SET barbero_id = '<barbero_id>'
WHERE id = '<socio_id>' AND tenant_id = '<tenant_uuid>';
```

- El vínculo con `barbero` es opcional y hoy no lo lee ningún código.
- Un dueño no se borra: se desactiva con `UPDATE socio SET activo = false WHERE id = '<socio_id>'`.
  Sus movimientos lo siguen referenciando.
- Comisión 100% no implica ser dueño: un barbero que alquila el sillón también la tiene.

---

## Paso 2c — Categorías de gasto

`crearTenant.js` no crea categorías de gasto, y sin ellas el flujo de gasto del iPad queda
vacío. Hoy se cargan a mano por SQL, con la misma lista base que usa Kingsai:

```sql
INSERT INTO categoria_gasto (tenant_id, nombre) VALUES
  ('<tenant_uuid>', 'Alquiler'),
  ('<tenant_uuid>', 'Impuestos'),
  ('<tenant_uuid>', 'Otros'),
  ('<tenant_uuid>', 'Productos'),
  ('<tenant_uuid>', 'Servicios');
```

La categoría "Productos" dispara en el iPad el recordatorio de actualizar el stock. Hay una
deuda abierta para automatizar esta carga (ver `estado_actual.md`).

---

## Paso 3 — Verificación

Tres checks rápidos antes de entregar el sistema al cliente.

### 3.1 — El subdominio responde

Abrir en el navegador:

```
https://<subdominio>.barbermanager.app
```

Debe cargar la pantalla de login del modo operativo.

Si rebota con error de "tenant no encontrado" o similar, ver la sección de Notas más abajo.

### 3.2 — El login operativo entra

Ingresar usuario y password operativos. Debe cargar la pantalla principal del modo operativo
(los 3 botones grandes: Nuevo Corte, Nueva Venta, Nuevo Gasto).

### 3.3 — El PIN funciona

En la pantalla principal, tocar el ícono de candado (esquina inferior derecha) e ingresar el PIN.

Debe entrar al panel de admin sin errores. Si rebota con 401 o 402, algo está mal en el alta o la suscripción.

---

## Paso 4 — Entrega al cliente

Pasarle al cliente:

- URL de acceso: `https://<subdominio>.barbermanager.app`
- Usuario y password operativos (para el iPad del local)
- PIN inicial (recordarle que lo cambie desde Gestión → Seguridad apenas entre)
- El manual del cliente (ver `manual_cliente.md` cuando exista)

**Checklist interno antes de entregar:**

- [ ] Tenant creado en DB con UUID conocido.
- [ ] Credenciales operativas cargadas y probadas.
- [ ] Dueños cargados en `socio` (vinculados a su barbero si cortan).
- [ ] Categorías de gasto cargadas.
- [ ] Subdominio responde correctamente.
- [ ] PIN entra al panel admin.
- [ ] Suscripción vigente hasta fin del mes actual (default automático del script).
- [ ] Horario de atención seedeado (L-S 10:00-19:00) — recordarle al cliente que lo ajuste a su horario real desde Gestión → Negocio.
- [ ] Cliente recibió URL, credenciales operativas, PIN y manual.

---

## Paso 5 — Cargar el logo y las imágenes (cuando el cliente las envíe)

Puede pasar el día del alta o semanas después. El sistema funciona perfecto sin logo ni imágenes.

**Se hace desde el panel admin, no por SQL.** Con el PIN admin, entrar a **Gestión → Negocio →
Imágenes** y subir:

- **Logo** (hasta 2),
- **Foto del local** (hasta 2 — es el fondo del modo operativo),
- **Cortes de ejemplo** (hasta 4).

El front comprime la imagen a WebP, la sube a Supabase Storage y la registra en la tabla
`tenant_imagen` (cupo fijo por tipo). El logo viaja a todos los fronts vía
`GET /api/negocio/imagenes` — **no** por una columna en `tenant` (la vieja `tenant.logo` se
dropeó tras migrar a `tenant_imagen`).

### Verificar

Refrescar el panel: el logo aparece en el header y la foto del local, de fondo en el modo operativo.

---

## Notas

### Caché del middleware

El `tenantMiddleware` cachea en memoria las resoluciones de `subdominio → { tenant_id, operativo_token_version, admin_token_version }`. El caché se invalida al reiniciar el server **o** vía invalidación explícita: automática al rotar la password operativa o el PIN admin, y manual con el endpoint de plataforma (ver "Baja de un tenant" más abajo).

Para alta de clientes nuevos esto no es problema — el subdominio es nuevo y el caché no lo tiene (y los 404 tampoco se cachean). El caché entra en juego cuando editás a mano un tenant **ya cacheado** (baja, cambio de subdominio): ahí hay que invalidar para que el cambio pegue sin esperar al próximo redeploy.

### Baja de un tenant (o cambio de subdominio) — invalidar el caché

Cuando editás a mano un tenant que el server de prod ya tiene cacheado (darlo de baja, cambiarle el subdominio, o tocar `operativo_token_version`/`activo` por SQL), el cambio **no pega hasta invalidar el caché**. Se hace con un endpoint de plataforma que disparás manualmente desde Bruno (no hay UI — es una herramienta de ops).

**Prerequisito (una sola vez):** la env var `PLATFORM_ADMIN_KEY` debe estar seteada en Railway. Por defecto **no** lo está (el endpoint queda deshabilitado → responde 503). Setearla dispara un autodeploy, así que hacelo en un momento de poco tráfico, la primera vez que vayas a usar el endpoint.

**Ejemplo — dar de baja la barbería `exbarberia`:**

1. **Baja en la DB** (Supabase → SQL Editor):
   ```sql
   UPDATE tenant SET activo = false WHERE subdominio = 'exbarberia';
   ```
   En este punto el server de prod todavía tiene el `tenant_id` viejo en su caché → el local seguiría operando.

2. **Invalidar el caché desde Bruno:**
   - **Método:** `POST`
   - **URL:** `https://<backend-railway>/api/plataforma/cache/invalidate`
   - **Headers:** `X-Platform-Key: <valor de PLATFORM_ADMIN_KEY>` y `Content-Type: application/json`
   - **Body (JSON):** `{ "subdominio": "exbarberia" }`
   - Esperás **200** → `{ "ok": true, "subdominio": "exbarberia" }`.

3. **Verificar el corte:** cualquier request de ese local (ej. login operativo con header `X-Tenant-Subdomain: exbarberia`) ahora resuelve `WHERE activo = true` → **404 "Tenant no encontrado"**. Quedó cortado al instante.

Mismo patrón para **cambio de subdominio** (invalidás el subdominio viejo) o cualquier edición manual por SQL sobre un tenant ya cacheado. **El alta de un tenant nuevo no necesita este paso** (el subdominio nuevo no está cacheado, y los 404 tampoco se cachean).

**Caveat (limitación conocida):** el caché es por proceso. Hoy Railway corre 1 instancia, así que invalidar sirve. Si en el futuro hay >1 instancia, la invalidación solo limpiaría la que recibió el request (haría falta Redis/pubsub — fuera de alcance hoy).

### Activar el recordatorio de turnos (opt-in por tenant)

El mail de recordatorio (la noche anterior) está **apagado por default** en cada tenant; se
prende a propósito, recién cuando los mails transaccionales del tenant ya se vieron llegar bien.

```sql
-- Ver estado actual
SELECT subdominio, configuracion FROM tenant WHERE subdominio = '<subdominio>';

-- PRENDER (merge superficial: crea recordatorio si no existe, preserva ciudad/moneda)
UPDATE tenant
SET configuracion = COALESCE(configuracion, '{}'::jsonb) || '{"recordatorio": {"activo": true}}'::jsonb
WHERE subdominio = '<subdominio>';

-- APAGAR
UPDATE tenant
SET configuracion = COALESCE(configuracion, '{}'::jsonb) || '{"recordatorio": {"activo": false}}'::jsonb
WHERE subdominio = '<subdominio>';
```

> Se usa `||` (no `jsonb_set`) porque `jsonb_set` no crea el objeto `recordatorio` intermedio si
> todavía no existe. Si en el futuro hay claves anidadas a preservar (ej. `hora_envio`), cambiar a `jsonb_set`.
> Ojo: si los barberos del tenant tienen `email = NULL`, sus turnos no sincronizan con Calendar,
> pero los **clientes** igual reciben el recordatorio → flip deliberado.

### Cargar el email de un barbero (activa la sync con Google Calendar)

El `email` del barbero **es el interruptor** de la sincronización con Google Calendar. Sin email,
sus turnos se crean normal pero no aparecen en su calendar.

```sql
-- Ver ids y estado actual
SELECT id, nombre, email FROM barbero WHERE tenant_id = '<tenant_uuid>';

-- Cargar el email de un barbero
UPDATE barbero SET email = 'mail-del-barbero@gmail.com'
WHERE id = '<barbero_id>' AND tenant_id = '<tenant_uuid>';
```

**Antes de correrlo:**
1. **Avisarle al barbero.** Apenas tiene email, empieza a recibir invitaciones de Google Calendar
   desde `turnos.barbermanager@gmail.com`. Si no sabe qué son, las puede rechazar o marcar spam
   (ensucia reputación). Cargar el email **después** de coordinarlo con él.
2. **Solo afecta turnos nuevos.** Los turnos creados mientras el email era `NULL` no se
   re-sincronizan; solo los creados después invitan al barbero.
3. **No hay otro switch:** el email *es* el interruptor de la sync de Calendar para ese barbero.

### Renovación mensual de suscripción

El script setea la suscripción inicial hasta fin del mes en curso. Para renovar:

```sql
UPDATE tenant
SET suscripcion_vigente_hasta = 'YYYY-MM-DD'
WHERE subdominio = '<subdominio>';
```

La fecha sugerida es el último día del mes que el cliente acaba de pagar.

---

*— Fin del documento —*
