# Onboarding de un nuevo cliente

Runbook interno para dar de alta una barbería nueva en el sistema.

> Este documento es para uso interno. La guía que recibe el cliente sobre cómo usar el sistema vive en `manual_cliente.md` (pendiente).

---

## Pre-requisitos

Antes de arrancar, tener:

- Repo del backend clonado y dependencias instaladas (`npm install` en `/backend`).
- Acceso al panel de Supabase del proyecto.
- Datos del cliente: nombre del negocio, subdominio deseado, PIN inicial de 4 dígitos.

> El `.env` local no necesita configuración especial para correr `crearTenant.js`. El script no lee `TENANT_ID`.

---

## Flujo completo

1. El cliente acuerda contratar el sistema y te pasa: nombre del negocio, subdominio deseado, PIN inicial.
2. Corrés `crearTenant.js` para dar de alta el tenant en la DB.
3. Verificás que el subdominio responde y el PIN funciona.
4. Le entregás al cliente la URL y el PIN. Le mandás el manual por separado.
5. (Opcional, cuando llegue) Subís el logo del cliente a Supabase Storage y actualizás la DB.

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
- Imprime el UUID, nombre, subdominio, fecha de suscripción y URL.

**Output esperado:**

```
[crearTenant] ✅ Tenant creado correctamente
  ID:           <uuid>
  Nombre:       Nombre Barbería
  Subdominio:   subdominio
  Suscripción:  vigente hasta YYYY-MM-DD
  URL:          subdominio.barbermanager.app
```

---

## Paso 2 — Verificación

Dos checks rápidos antes de entregar el sistema al cliente.

### 2.1 — El subdominio responde

Abrir en el navegador:

```
https://<subdominio>.barbermanager.app
```

Debe cargar la pantalla principal del modo operativo (los 3 botones grandes: Nuevo Corte, Nueva Venta, Nuevo Gasto).

Si rebota con error de "tenant no encontrado" o similar, ver la sección de Notas más abajo.

### 2.2 — El PIN funciona

En la pantalla principal, tocar el ícono de candado (esquina inferior derecha) e ingresar el PIN.

Debe entrar al panel de admin sin errores. Si rebota con 401 o 402, algo está mal en el alta o la suscripción.

---

## Paso 3 — Entrega al cliente

Pasarle al cliente:

- URL de acceso: `https://<subdominio>.barbermanager.app`
- PIN inicial (recordarle que lo cambie desde Gestión → PIN Admin apenas entre)
- El manual del cliente (ver `manual_cliente.md` cuando exista)

**Checklist interno antes de entregar:**

- [ ] Tenant creado en DB con UUID conocido.
- [ ] Subdominio responde correctamente.
- [ ] PIN entra al panel admin.
- [ ] Suscripción vigente hasta fin del mes actual (default automático del script).
- [ ] Cliente recibió URL, PIN y manual.

---

## Paso 4 — Subir el logo (cuando el cliente lo envíe)

Este paso puede pasar el día del alta o semanas después. El sistema funciona perfecto sin logo (queda `null` en la DB).

### 4.1 — Subir el archivo a Supabase Storage

1. Entrar a Supabase → Storage → bucket `logos` (público).
2. Subir el archivo del cliente. Naming sugerido: `logo_<subdominio>.<extension>` (ej: `logo_kingsai.jpeg`).
3. Copiar la URL pública del archivo. Formato:
   ```
   https://<proyecto>.supabase.co/storage/v1/object/public/logos/<nombre_archivo>
   ```

### 4.2 — Actualizar la DB

En el SQL Editor de Supabase:

```sql
UPDATE tenant
SET logo = 'https://<proyecto>.supabase.co/storage/v1/object/public/logos/<nombre_archivo>'
WHERE subdominio = '<subdominio>';
```

### 4.3 — Verificar

Refrescar el panel del cliente. El logo debe aparecer en el header.

---

## Notas

### Caché del middleware

El `tenantMiddleware` cachea las resoluciones de `subdominio → tenant_id` en memoria. Si das de alta un tenant, lo borrás y volvés a crear otro con el mismo subdominio dentro de la misma sesión del servidor, podés ver datos inconsistentes hasta el próximo reinicio de Railway.

Para alta de clientes nuevos esto no es problema — el subdominio es nuevo y el caché no lo tiene. Solo aparece si reciclás subdominios o borrás tenants. Ver pendiente en `estado_actual.md`: endpoint admin de invalidación de caché.

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
