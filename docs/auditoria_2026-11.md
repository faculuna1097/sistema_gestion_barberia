# Auditoría de seguridad y calidad — 2026-11

> **Estado (2026-11-16): en curso.** Zona 2 revisada; el resto, pendiente o en curso (ver la tabla de zonas).
>
> Auditoría de **solo lectura**: no se modifica código, ni la base, ni configuración. Los arreglos se deciden
> al final, hallazgo por hallazgo, y van aparte. El plan (decisiones, zonas, filtro de hallazgos y fases) está
> en [`plan_auditoria_2026-11.md`](./plan_auditoria_2026-11.md).

Se audita el branch `feature/mejoras-operativas`, que contiene todo `main` más las fases hechas de mejoras
operativas. Commit base al crear este documento: `e80815c`. Si el branch avanza durante la auditoría, cada
zona anota el commit que auditó.

La auditoría anterior es la de julio ([`auditoria_2026-07.md`](./auditoria_2026-07.md)).

---

## Resumen ejecutivo

*Pendiente: se escribe en la consolidación (fase 9), con el veredicto general, el conteo por severidad y la
tabla de todos los hallazgos con su destino.*

---

## Zonas

| Zona | Área | Commit auditado | Estado | Crítico | Alto | Medio | Bajo |
|---|---|---|---|---|---|---|---|
| 1 | Autenticación, sesiones y recuperación | — | Pendiente | — | — | — | — |
| 2 | Aislamiento entre tenants y permisos por rol | `cb87b60` | Revisada | 0 | 0 | 1 | 3 |
| 3 | Superficie pública: turnero, alta y mails | — | Pendiente | — | — | — | — |
| 4 | Plata: caja, planillas, balances y stock | — | Pendiente | — | — | — | — |
| 5 | Agenda, turnos y concurrencia | — | Pendiente | — | — | — | — |
| 6 | Panel de gestión y app del barbero (front) | — | Pendiente | — | — | — | — |
| 7 | Operación, infraestructura y dependencias | — | Pendiente | — | — | — | — |
| 8 | Rendimiento y consumo del backend | — | Pendiente | — | — | — | — |

Estados: **Pendiente** (sin empezar), **Escrita** (el ejecutor terminó su sección) y **Revisada** (el
orquestador la revisó contra el código y la commiteó).

## Formato y severidades

Cada hallazgo se identifica como `Z<zona>-<nn>` (ej. `Z3-02`) y lleva título, severidad, dónde, alcance ("en
producción" o "solo en el branch"), qué pasa, evidencia, arreglo propuesto con su tamaño y novedad. El detalle
del formato y la guía de severidad (crítico, alto, medio, bajo) están en el plan, §4. La zona 8 cambia "Qué
pasa" por "Costo" y lee la severidad según cuánto pesa (plan, §5 → Zona 8).

Cada zona cierra con "Verificado correcto" (lo que se revisó y está bien, una línea por punto) y "Para otra
zona" (lo que se encontró de paso y le toca a otra).

---

## Zona 1. Autenticación, sesiones y recuperación

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 2. Aislamiento entre tenants y permisos por rol

Commit auditado: `cb87b60`. Hecha en dos tandas (código primero; base y fronts después). Lo poco que quedó
sin mirar está en "Sin revisar", al final de la sección.

**Revisión del orquestador (2026-11-16):** los cuatro hallazgos se confirmaron contra el código y la base
(`clientes.js`, `tenantMiddleware.js`, `authMiddleware.js`, `turnosService.js`, `pg_constraint`, `relacl` y
`pg_default_acl`). No se sacó ninguno.

### Hallazgos

#### Z2-01 — Un barbero puede leer toda la base de clientes del local (medio)

- **Severidad (revisada por el orquestador):** queda en medio. Es una escalada dentro del tenant, pero de solo
  lectura y sobre datos de contacto: no deja escribir nada ni ver plata del local, que es lo que la escala
  reserva para "alto". El bug visible de F1 se arregla con el mismo cambio y tiene que salir antes del merge.

- **Dónde:** `backend/src/controllers/clientes.js:58-81` (`getClientes`), ruta `GET /api/admin/clientes?busqueda=`,
  montada con `requiereRol('admin', 'barbero')` en `backend/src/index.js:297`.
- **Alcance:** en producción (`git show main:backend/src/controllers/clientes.js` trae la misma query; el diff
  del branch son 3 líneas de comentario).
- **Qué pasa:** un barbero con su PIN (token de rol barbero) llama al buscador con dos letras cualesquiera y
  recibe nombre, email y teléfono de clientes de **todo el local**, no solo de los suyos: la query filtra por
  `tenant_id` y nada más (no usa `req.rol` ni `req.barbero_id`). El tope es de 50 filas por búsqueda, pero
  repitiendo con otras letras (`@g`, `11`, `an`…) se lleva la base entera. Un barbero que se va del local se
  lleva los contactos de los clientes de sus compañeros. `GET /mis-clientes`, en el mismo archivo, sí scopea.
- **Agravado por F1 (solo en el branch):** `clienteUsable` y `asignarClienteATurno`
  (`services/turnosService.js:623` y `:726`) restringen al barbero a "sus" clientes, pero el buscador que los
  alimenta sigue devolviendo los de todos. Además de la fuga, es un bug que el barbero ve: busca a un cliente
  habitual del local que nunca se atendió con él, lo encuentra, lo elige, y el alta del turno o la asignación
  le responden "Cliente no encontrado". Confirmado en el front: `SelectorCliente.jsx:52` muestra lo que
  devuelve `useBusquedaClientes` (que llama a `buscarClientes` sin filtrar) y `utils/clienteTurno.js:18` manda
  el `cliente_id` elegido. El panel en modo barbero hace lo mismo (`turnero/AsignarCliente.jsx:94`).
- **Evidencia:** leído (ruta → `verificarToken` → `requiereRol` → `getClientes` → query). El front de `main` ya
  lo usa con token barbero (`frontend-barbero/src/components/CrearTurno.jsx:478` en `main`).
- **Arreglo propuesto (chico):** con rol barbero, sumar a la query el mismo `EXISTS` de `sqlClienteDelBarbero`
  (exportarlo de `turnosService.js` y usarlo también en `getMisClientes`, que hoy repite el criterio a mano).
  Alternativa: dejar el buscador abierto y devolverle al barbero solo `id` y `nombre` de los clientes ajenos;
  no la recomiendo, porque contradice la decisión de F1 ("clientes propios").
- **Novedad:** corrige un diagnóstico. `plan_mejoras_operativas.md` §3 (línea 80) dice que `GET
  /api/admin/clientes` "ya scopea por barbero con rol barbero", y `estado_actual.md` → Deudas da la escalada
  barbero↔barbero por resuelta (commit `ca2fc96`): ese commit solo cerró el acceso del rol operativo.

#### Z2-02 — El caché de tenants deja pasar subdominios como `constructor` con `tenant_id` indefinido (bajo)

- **Dónde:** `backend/src/middlewares/tenantMiddleware.js:23` y `:37-38` (`tenantCache = {}`), todas las rutas
  que pasan por `tenantMiddleware`.
- **Alcance:** en producción (mismas líneas en `main`).
- **Qué pasa:** el caché es un objeto común. Un anónimo que manda `X-Tenant-Subdomain: constructor` (o
  `__proto__`, `toString`) hace que `tenantCache[subdominio]` devuelva una propiedad heredada, que es "truthy":
  el middleware no consulta la DB, no responde 404 y sigue con `req.tenant_id = undefined`. Hoy no se llega a
  datos de nadie: todas las queries leídas comparan `tenant_id = $1` (con `NULL` no devuelven filas) y
  `verificarToken` responde 403 porque el token trae otro tenant. El riesgo es que se rompe la garantía "después
  del middleware hay un tenant válido": una query futura con filtro opcional de tenant quedaría abierta.
- **Evidencia:** leído; no reproducido (no hizo falta levantar nada).
- **Arreglo propuesto (chico):** `const tenantCache = new Map()` (o `Object.create(null)`), y validar el formato
  del header con `motivoFormatoSubdominio` antes de buscar.
- **Novedad:** nuevo.

#### Z2-03 — `anon` y `authenticated` tienen todos los permisos sobre las 20 tablas: lo único que las cierra es acordarse del RLS (bajo)

- **Dónde:** la base (`pg_class.relacl` y `pg_default_acl` del schema `public`). No hay código del repo.
- **Alcance:** en producción.
- **Qué pasa:** las 20 tablas tienen RLS activado y sin policies, así que hoy por la Data API no se lee ni se
  escribe nada. Pero `anon` y `authenticated` conservan `SELECT, INSERT, UPDATE, DELETE, TRUNCATE` sobre todas,
  y los permisos por defecto de `postgres` y `supabase_admin` se los dan a cada tabla nueva. Una tabla creada
  desde el SQL editor sin el `ENABLE ROW LEVEL SECURITY` (ya pasó: 13 tablas estuvieron así hasta el
  2026-09-30) queda abierta para quien tenga la anon key. Y la Data API **se usa**: la web de Kingsai lee las
  vistas `web_*` con el rol `anon` (`SQL_Schema.md`), así que no se puede apagar, como propone `estado_actual.md`.
- **Sin confirmar:** si la anon key llega al navegador de la web de Kingsai o se usa solo al construir el sitio
  (ese sitio no está en este repo). `estado_actual.md` → RLS dice que "no está publicada en ningún front":
  conviene revisarlo ahí. Tampoco se puede ver desde la base qué schemas expone la Data API (está en el
  dashboard de Supabase).
- **Evidencia:** consultado en la DB (`aclexplode(relacl)`, `pg_default_acl`, `relrowsecurity`, `pg_policy`).
- **Arreglo propuesto (chico, un SQL que corre el usuario):** `REVOKE ALL` sobre las 20 tablas a `anon` y
  `authenticated` (dejando el `SELECT` de `anon` en las 3 vistas, que es lo único que necesitan), y
  `ALTER DEFAULT PRIVILEGES` para que las tablas nuevas nazcan sin esos permisos. El backend no se ve afectado:
  entra como `postgres`. Así una tabla sin RLS deja de ser un agujero, y `TRUNCATE` deja de depender de que la
  API no lo exponga.
- **Novedad:** corrige y completa "RLS activado en todas las tablas" de `estado_actual.md` (la mejora opcional
  de apagar la Data API no es posible mientras la web de Kingsai la use).

#### Z2-04 — `turno.cliente_id` ahora llega del cliente y su FK no es compuesto (bajo)

- **Dónde:** FK `turno_cliente_id_fkey` (`FOREIGN KEY (cliente_id) REFERENCES cliente(id)`); `POST
  /api/admin/turnos` con `cliente_id` y `PATCH /api/admin/turnos/:id/cliente` (`controllers/turnos.js:191` y
  `:368`).
- **Alcance:** solo en el branch (el `cliente_id` en el body es de F1).
- **Qué pasa:** hoy nada: `clienteUsable` y el `UPDATE ... FROM cliente` de `asignarClienteATurno` validan el
  tenant. Pero la deuda diferida 3 de julio dejó este FK simple porque "`cliente_id` nunca es
  client-controlled", y eso dejó de ser cierto. Si un camino futuro se olvida la validación, la base acepta un
  turno con un cliente de otro local y el `LEFT JOIN cliente` mostraría su nombre, mail y teléfono.
- **Evidencia:** consultado en la DB (`pg_constraint`) y leído. Conteo actual de turnos con cliente de otro
  tenant: 0.
- **Arreglo propuesto (chico, schema):** `UNIQUE (tenant_id, id)` en `cliente` y FK compuesto
  `(tenant_id, cliente_id)` en `turno` (MATCH SIMPLE, así los turnos "Sin datos" no se rompen). Los otros FK
  simples con id del cliente (`barbero_horario.barbero_id`, `barbero_suspension.barbero_id`,
  `venta.producto_id`) están en la misma situación desde antes, validados por la app; si se toca el schema,
  conviene hacerlos todos juntos.
- **Novedad:** agrava la deuda diferida 3 de `auditoria_2026-07.md` (cambió su rationale).

### Verificado correcto

- **En la base (consultado el 2026-11-16):** las 20 tablas de `public` tienen RLS activado, sin policies y sin
  forzar, todas de `postgres`. Las 3 vistas `web_*` filtran al tenant de Kingsai y exponen solo nombre, precio
  y horarios. `web_deploy_kingsai()` no la puede ejecutar `anon`. `resguardo_lectura` tiene solo `SELECT` en
  `public` (con `BYPASSRLS`, que necesita para leer) y no entra a `vault`, `auth` ni `storage`.
- **FKs compuestos `(tenant_id, X)` que existen:** `turno` → barbero y servicio; `corte` → barbero, servicio y
  turno; `gasto` → categoría; `socio` → barbero; `movimiento_extra` → socio. Las tablas nuevas (`socio`,
  `movimiento_extra`) los tienen; `token_recuperacion` solo referencia al tenant.
- **Filas cruzadas entre tenants:** 0 en `barbero_horario`, `barbero_suspension`, `venta`, `turno`→`cliente` y
  `socio`. `cierre_caja` está vacía. Hay 3 cortes cuyo turno es de otro barbero del mismo local: son de demo,
  de junio, anteriores al cobro en una sola sentencia; hoy `registrarCorte` no lo permite.
- **Leídos completos en la segunda tanda:** `controllers/turnero.js` (lo público devuelve del tenant solo
  nombre, teléfono del local, WhatsApp, reseñas, dirección, horario y feriados; la gestión por token filtra
  además por tenant), `caja.eliminarMovimiento`, `recordatoriosService` y el job.

- **Montaje de rutas (`index.js`) contra la tabla de roles de `estado_actual.md`:** coinciden, incluidas las
  rutas nuevas (`descansos`, `agenda`, `socios`, `auth/recuperar`) y los roles por método de `ventas`, `gastos`
  y `horario-atencion`. No hay ruta de datos sin `verificarToken` salvo las públicas documentadas.
- **Rol operativo:** no entra a ningún `/api/admin/*`, ni a caja, inicio ni balances (`requiereRol`).
- **`verificarToken`:** cruza el tenant del token contra el del subdominio y revoca por `tv` en los tres roles.
- **Scoping del barbero** (`utils/scopingRol.js`): fuerza el `barbero_id` del token en `turnos.js` (listar,
  crear, no asistió, completar, asignar cliente, cancelar), `agenda.js`, `descansos.js`, `suspensiones.js`
  (liberar: solo propias y no las del admin), `planilla.js` (los tres endpoints; los totales son solo los
  suyos) y `clientes.getMisClientes`. `horarios.js` responde 403 ante el horario de otro.
- **F1:** `clienteUsable`, `asignarClienteATurno` (una sola sentencia con tenant, barbero y "cliente suyo" en el
  `WHERE`) y `borrarClienteSinTurnos` filtran por tenant; un cliente o turno ajeno responde 404.
- **Filtro por `tenant_id`, query por query, en:** `turnosService`, `cortesService`, `suspensionesService`,
  `descansosService`, `planillaService`, `horariosService`, `barberosService`, `sociosService`,
  `categoriasService`, `movimientosService`, `sqlTurnoEnriquecido` (todos sus usos pasan tenant o un id propio).
- **Filtro por `tenant_id`, por esqueleto de las queries** (sin leer la lógica completa): `caja`, `gastos`,
  `ventas`, `balances`, `inicio`, `feriados` + `feriadosService`, `imagenes`, `gestion`, `turnero`,
  `turneroConfig`, `adminOperativo`, los cuatro `auth*`, `recuperacionService`, `horarioAtencionService`,
  `disponibilidadService`, `utils/stock.js`, `utils/pin.js`.
- **Ids del cliente validados contra el tenant por la app:** `barbero_id` (`barberoActivoEnTenant` /
  `barberoEnTenant`), `servicio_id` (`calcularDuracionServicio`), `socio_id`, `categoria_id`, `producto_id`
  (ventas), `turno_id` (en la misma sentencia de `registrarCorte`, con tenant y barbero), `cliente_id`.
- **`/api/alta`:** solo toca `solicitud_alta`; lo único de tenants es si un subdominio existe, y exige un link
  vigente. **`/api/plataforma`:** solo invalida el caché, con clave; sin la variable responde 503.
- **Residuales de defensa en profundidad (ya aceptados en julio, 2.2):** `enriquecerTurno` y el `UPDATE` de
  `google_event_id` por id sin tenant; se suman, del mismo tipo, `ventas.js:77` (cleanup por id) y
  `recordatoriosService.reclamarTurno`. Los ids salen siempre de una query propia.

### Sin revisar

- La lógica completa de `gestion.js`, `balances.js`, `inicio.js` y `disponibilidadService.js`: se revisó que
  cada query filtre por tenant, no el resto (son solo admin, o le tocan a las zonas 4 y 5).
- Si el panel en modo barbero pide o dibuja datos de admin (zona 6): el backend los niega con 403.
- La configuración de la Data API en el dashboard de Supabase (no se ve desde la base).

### Para otra zona

- **Zona 1:** `POST /api/auth/recuperar/solicitar` es público y devuelve `email` del dueño (ver si el
  enmascarado alcanza).
- **Zona 3:** el `motivo` de una suspensión no tiene tope de largo y viaja al mail de cancelación
  (`suspensiones.js:61`).
- **Zona 7:** sin `PLATFORM_ADMIN_KEY`, cada pedido anónimo a `/api/plataforma/cache/invalidate` hace un
  `console.error` (`plataformaAuthMiddleware.js:43`), que llega a Sentry y a Discord. CORS acepta
  `http://localhost:5173` también en producción (`index.js:87`).
- **Zona 7:** `resguardo_lectura` puede ejecutar `net.http_get` y `net.http_post` (pg_net), y su solo lectura
  por defecto (`default_transaction_read_only`) la puede cambiar la propia sesión: quien tenga esa credencial
  puede hacer pedidos HTTP salientes desde la base. Además lee `tenant` (hashes de PIN y de la contraseña del
  iPad) y `token_recuperacion`, que terminan en el backup.
- **Zona 5:** borrar un corte desde Caja devuelve su turno a 'reservado' aunque ya haya pasado
  (`caja.js:312`).

---

## Zona 3. Superficie pública: turnero, alta y mails

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 4. Plata: caja, planillas, balances y stock

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 5. Agenda, turnos y concurrencia

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 6. Panel de gestión y app del barbero (front)

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 7. Operación, infraestructura y dependencias

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 8. Rendimiento y consumo del backend

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Segunda pasada

*Pendiente: se escribe en la fase 10, antes del PR de merge de `feature/mejoras-operativas`, sobre el diff de
las fases hechas después de esta auditoría.*

---

*— Fin del documento —*
