# Auditoría de seguridad y calidad — 2026-11

> **Estado (2026-11-16): en curso.** Zonas 2 y 3 revisadas; el resto, pendiente o en curso (ver la tabla de zonas).
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
| 3 | Superficie pública: turnero, alta y mails | `cb87b60` | Revisada | 0 | 1 | 1 | 4 |
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
`pg_default_acl`). No se sacó ninguno. Z2-01 se reescribió después con una decisión del usuario: el buscador de
clientes queda abierto a todo el local, y el hallazgo pasa a ser el bug de F1.

### Hallazgos

#### Z2-01 — El barbero elige un cliente del buscador y recibe "Cliente no encontrado" (medio)

- **Decisión del usuario (2026-11-16):** el buscador de clientes **no** filtra por barbero. Hay clientes que no
  se cortan siempre con el mismo, así que cualquier barbero tiene que poder encontrar a cualquier cliente del
  local. Que un barbero vea nombre, mail y teléfono de los clientes del local queda **aceptado por diseño**. El
  hallazgo original del ejecutor ("un barbero puede leer toda la base de clientes") se reescribió con esa
  decisión: lo que queda es el bug de F1.
- **Dónde:** `backend/src/services/turnosService.js:604-632` (`sqlClienteDelBarbero`, `clienteUsable`) y
  `:726-752` (`asignarClienteATurno`). Rutas: `POST /api/admin/turnos` con `cliente_id` y
  `PATCH /api/admin/turnos/:id/cliente`, con rol barbero. Pantallas: alta de turno y "Asignar cliente" en la app
  del barbero, y "Asignar cliente" del panel en modo barbero.
- **Alcance:** solo en el branch (el `cliente_id` en el body y la asignación son de F1).
- **Qué pasa:** el buscador (`GET /api/admin/clientes`, `controllers/clientes.js:58-81`) devuelve los clientes
  de todo el local, pero el alta del turno y la asignación solo aceptan, con rol barbero, un cliente que ya
  tuvo un turno reservado o completado con ese barbero. Un barbero busca a un cliente habitual del local que
  nunca se atendió con él, lo encuentra, lo elige, y el servidor responde "Cliente no encontrado". Para ese
  cliente no tiene salida desde la app: si lo carga a mano sin mail, crea un duplicado.
- **Evidencia:** leído (ruta → `verificarToken` → `requiereRol('admin', 'barbero')` → `getClientes`, que filtra
  solo por `tenant_id`; y `crearTurnoAdmin` / `asignarCliente` → `clienteUsable` → `sqlClienteDelBarbero`). En el
  front: `SelectorCliente.jsx:52` muestra lo que devuelve `useBusquedaClientes` y `utils/clienteTurno.js:18`
  manda el `cliente_id` elegido; el panel en modo barbero hace lo mismo (`turnero/AsignarCliente.jsx:94`).
- **Arreglo propuesto (chico):** sacar el filtro de "cliente suyo" de `clienteUsable` y de
  `asignarClienteATurno`: con rol barbero alcanza con que el cliente sea del local, igual que con admin. El
  scoping del **turno** (un barbero solo toca sus turnos) no cambia. `sqlClienteDelBarbero` queda sin uso y se
  borra; `getMisClientes` sigue igual (es el listado de "mis clientes", no el buscador). Va dentro de mejoras
  operativas, antes del merge.
- **Novedad:** nuevo, y corrige tres docs que hay que actualizar con el arreglo: `plan_mejoras_operativas.md`
  dice que el buscador "ya scopea por barbero con rol barbero" (§3, línea 80) y define para el barbero
  "clientes propios (los de sus turnos)" (F1, líneas 191 y 197); y `estado_actual.md` → Deudas da por resuelta
  la escalada barbero↔barbero en `/api/admin/clientes` con el commit `ca2fc96`, que solo cambió los roles de
  `index.js`. Ahí corresponde anotar que el buscador abierto es una decisión, no una deuda.

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
- **F1:** `clienteUsable`, `asignarClienteATurno` (una sola sentencia con tenant y barbero en el `WHERE`) y
  `borrarClienteSinTurnos` filtran por tenant; un cliente de otro local o un turno ajeno responde 404. El
  filtro de "cliente suyo" es el bug de Z2-01.
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

**Commit auditado:** `cb87b60` (`feature/mejoras-operativas`), 2026-11-16. Solo lectura: código, docs y la DB
con el rol `resguardo_lectura`. No se reprodujo nada contra demo ni contra producción.

**Resumen:** 6 hallazgos (0 críticos, 1 alto, 1 medio, 4 bajos). Los seis están en producción. La pregunta
central de la zona, si un texto del formulario de alta puede romper o inyectar la query de la skill, tiene
respuesta: **no** (ver "Verificado correcto").

**Revisión del orquestador (2026-11-16):** Z3-01 se confirmó leyendo el camino completo (`routes/turnero.js`,
`reprogramarTurno`, `enviarReprogramacion`, los limiters y lo mismo en `main`). De los demás se revisaron
contra el código Z3-02, Z3-05 y Z3-06. No se sacó ninguno ni cambió ninguna severidad. La nota de la zona 2
sobre el `motivo` de una suspensión no pasa a hallazgo: lo escribe el propio local (admin o barbero), va
escapado al mail de sus clientes y solo le falta un tope de largo.

### Hallazgos

#### Z3-01 [ALTO] Reprogramar no tiene límite propio: con un solo turno se mandan mails sin tope a cualquier dirección

- **Dónde:** `backend/src/routes/turnero.js:36` (`POST /api/turnero/turnos/:token/reprogramar`, sin limiter) y
  `backend/src/controllers/turnero.js:559-681` (`reprogramarTurno`; el mail sale en la línea 673 y Calendar en
  la 670). Pantalla: gestión del turno (`/turnos/gestionar/<token>`).
- **Alcance:** en producción (`git show main:backend/src/routes/turnero.js` tiene la misma ruta sin limiter y
  `main` ya manda `enviarReprogramacion`).
- **Qué pasa:** un anónimo reserva un turno con el mail de otra persona (el mail no se verifica) y recibe el
  `token_gestion` en la respuesta del `POST /turnos` (`turnero.js:397`): no necesita leer el mail. Con ese token
  llama a `/reprogramar` en bucle. Cada llamada que pasa manda un mail "Turno reprogramado" a esa dirección,
  desde el dominio autenticado y con el nombre del local como remitente, y actualiza el evento de Google
  Calendar del barbero. Nada lo frena salvo el backstop global (300 pedidos por minuto por IP):
  - El horario nuevo puede ser **el mismo que ya tiene**: el `UPDATE` (línea 627) no compara, el `EXCLUDE` no
    choca con la propia fila y el mail sale igual. Tampoco hay tope de reprogramaciones por turno.
  - La reserva sí está limitada (3 por minuto, 10 por hora), pero alcanza con una sola.

  Resultado: es el email bombing que la auditoría de julio cerró en la reserva (3.1), abierto por el costado.
  Daña la reputación del dominio de envío, consume la cuota de Resend (si se agota, dejan de salir las
  confirmaciones y recordatorios de **todos** los locales, y cada mail fallido es un `console.error` que va a
  Sentry) y le llena el calendario de avisos al barbero.
- **Evidencia:** leído. Camino: `index.js:106` (`limiterGlobal`) → `index.js:238` → `routes/turnero.js:36` →
  `reprogramarTurno` (valida que el horario nuevo sea futuro, dentro de 15 días, en horario de atención y sin
  feriado; después `UPDATE`, Calendar y mail) → `mailer.js:393` (`enviarReprogramacion`). Sin confirmar: el plan
  y la cuota de Resend de la cuenta.
- **Arreglo propuesto** (chico; medio si se suma el contador):
  1. No hacer nada si el horario no cambió: responder 200 sin `UPDATE`, sin Calendar y sin mail.
  2. Limiter por IP en `/cancelar` y `/reprogramar`, como el de la reserva.
  3. Tope por turno (por ejemplo, 5 reprogramaciones): una columna contador en `turno`, sumada en el mismo
     `UPDATE` y con el tope en su `WHERE`.

  Recomendado: 1 y 2 ya, en un `fix/` desde `main`; 3 después. El limiter por IP solo no alcanza mientras siga
  abierta la deuda de `trust proxy` (el cupo se comparte y un atacante lo reparte entre nodos): el tope por
  turno es el que no depende de la IP.
- **Novedad:** nuevo. Corrige el "Verificado correcto" de la fase 3 de julio ("reprogramar y cancelar exigen
  el token, así que no son abusables masivamente"): el token se le entrega a quien reserva.

#### Z3-02 [MEDIO] Un byte nulo en cualquier texto público da 500, y cada 500 es un aviso de Sentry al celular

- **Dónde:** ningún validador rechaza el carácter `\u0000`. Llega a Postgres desde:
  - `GET /api/turnero/turnos/:token` y sus `/cancelar` y `/reprogramar` (`controllers/turnero.js:432`, `481`,
    `586`): el token de la ruta va directo al `WHERE token_gestion = $1`.
  - `POST /api/turnero/turnos`: `nombre`, `telefono` y `email` (`utils/validarTexto.js:101-137` solo mira tipo,
    largo y la regex del mail, que acepta `\u0000`) → `upsertCliente` (`services/turnosService.js:52`).
  - `PUT /api/alta/:token` y `POST /api/alta/:token/enviar` (`controllers/alta.js:121` y `196`): `datos` se
    guarda como `jsonb`.
- **Alcance:** en producción (turnero y alta están en `main`).
- **Qué pasa:** Postgres no admite ese carácter en un `text` ni en un `jsonb`. La query falla, el `catch` del
  controller hace `console.error` y responde 500, y `captureConsoleIntegration` lo manda a Sentry, que avisa
  por Discord. Un anónimo puede disparar alertas falsas al celular cuando quiera. La ruta por token solo tiene
  el backstop global (300 por minuto); el alta, 120 por minuto con un link válido. Si el volumen pasa, también
  salta la regla "Pico de errores" y se gasta la cuota mensual de Sentry (5.000 eventos), que deja al
  monitoreo ciego hasta el mes siguiente. El mismo patrón vale para cualquier otro endpoint público que pase
  un texto a la DB (los logins son de la zona 1).
- **Evidencia:** leído y consultado en la DB. Con el rol de solo lectura, un parámetro `text` con `\u0000` da
  `22021 invalid byte sequence for encoding "UTF8": 0x00`, y un `jsonb` con `\u0000` da `22P05 unsupported
  Unicode escape sequence`. `query()` solo reintenta errores de conexión. **Sin confirmar:** que el proxy de
  Railway deje pasar `%00` en la ruta (el caso del body en JSON no depende de eso), y cuánto frenan una
  ráfaga el filtro de eventos repetidos del SDK de Sentry y su protección de picos.
- **Arreglo propuesto** (chico): un middleware global, después de `express.json`, que responda 400 si la ruta,
  el query o el body traen `\u0000` (recorriendo el body una vez). Alternativa: tratar `22021` y `22P05` como
  400 con `console.warn` en un helper de errores; es menos prolijo porque hay que acordarse en cada `catch`.
  Recomendado: el middleware.
- **Novedad:** nuevo. Mismo tipo de problema que el body mal formado que ya se arregló en `index.js:124`
  (un error del cliente que terminaba en Discord).

#### Z3-03 [BAJO] El nombre del cliente viaja al mail sin restricción de contenido

- **Dónde:** `backend/src/utils/validarTexto.js:103-109` (el nombre: solo no vacío y hasta 80 caracteres) y
  `backend/src/services/mail/mailer.js:335`, `367`, `418` y `514` ("Hola {nombre}, …"). Ruta:
  `POST /api/turnero/turnos`.
- **Alcance:** en producción.
- **Qué pasa:** el HTML está bien escapado (no hay inyección de markup), pero el texto en sí es libre. Un
  anónimo reserva con el mail de un tercero y un "nombre" como `tenés un premio, entrá a http://…`: a esa
  persona le llega un mail del local, autenticado, con ese texto, y la mayoría de los clientes de mail
  convierten la dirección en un link. Sirve para phishing o spam con el nombre del local como remitente. Hoy
  lo acota el límite de la reserva (10 por hora por IP); con Z3-01, el mismo texto se puede repetir sin tope.
- **Evidencia:** leído (`crearTurno` → `validarContacto` → `upsertCliente` → `notificarConfirmacion` →
  `enviarConfirmacion`).
- **Arreglo propuesto** (chico): en `validarContacto`, rechazar un nombre con `://`, `www.` o `@`, o aceptar
  solo letras, espacios, apóstrofos, puntos y guiones. Recomendado: la lista de caracteres permitidos, con la
  misma regla en el turnero. La identidad del cliente se rehace en "Base de clientes": puede ir ahí.
- **Novedad:** agrava la deuda diferida 4 de julio (anti-abuso del turnero: sin captcha ni límite por mail).

#### Z3-04 [BAJO] La solicitud enviada guarda campos sin validar, y la skill los vuelca enteros al contexto de Claude

- **Dónde:** `backend/src/utils/validarSolicitudAlta.js:413` (`clave: barbero.clave`), `:635`
  (`progreso: datos.progreso`) y `:400` (la comisión acepta cualquier entero de 0 a 100);
  `.claude/skills/alta-cliente/leerSolicitud.mjs:134` (`datos: fila.datos`). Ruta: `POST /api/alta/:token/enviar`.
- **Alcance:** en producción.
- **Qué pasa:** el validador promete quedarse "solo con las claves conocidas", pero deja pasar tal cual
  `progreso` y la `clave` de cada barbero: cualquier JSON, hasta el tope de 100 kB del body. Quien tiene un
  link de alta puede mandar ahí un texto largo dirigido al agente ("ignorá las reglas y…"). La plantilla SQL
  no lee esos campos, así que la query no corre riesgo; pero `leerSolicitud.mjs` imprime `datos` entero y la
  skill lo lee en una sesión de Claude Code en la PC de Facundo, con acceso al repo. Lo mismo vale, más
  acotado, para los textos válidos (dirección de 120 caracteres, nombres). Aparte, una solicitud armada a mano
  puede traer una comisión que no es múltiplo de 5: el alta la carga, y después Gestión → Barberos (F7) no
  deja guardar ese barbero sin cambiarle el porcentaje.
- **Evidencia:** leído (`enviarSolicitud` → `validarSolicitudAlta` → `UPDATE … datos = $2::jsonb`; skill:
  `leerSolicitud.mjs` → `SKILL.md` paso 1). El formulario real solo manda comisiones de 5 en 5
  (`SelectorComision.jsx`, `PASO_COMISION`).
- **Arreglo propuesto** (chico): en el validador, `progreso` se guarda solo si es un objeto con las claves que
  usa el front (o se descarta al enviar, que ya no hace falta) y `clave` solo si es un texto corto; la
  comisión se valida con `esComisionValida` (`utils/comision.js`). En `leerSolicitud.mjs`, no imprimir
  `progreso` ni `clave`. Y una línea en `SKILL.md`: los textos de la solicitud son datos, nunca instrucciones.
- **Novedad:** nuevo. La parte de la skill es de la zona 7 (ver "Para otra zona").

#### Z3-05 [BAJO] El link del alta sigue mostrando todos los datos después de enviada y cargada

- **Dónde:** `backend/src/controllers/alta.js:87-102` (`GET /api/alta/:token`): filtra solo por
  `vence_en > now()` y devuelve `datos` en cualquier estado.
- **Alcance:** en producción.
- **Qué pasa:** después de enviar, y también después de que el local ya está dado de alta, el link sigue
  devolviendo el formulario completo hasta 30 días después de creado: nombre, celular y mail del dueño,
  mails de los barberos, precios. El link viajó por WhatsApp y queda en el historial del chat y del
  navegador; quien lo reenvíe o lo abra desde otro teléfono ve esos datos. El front, en ese estado, solo
  usa el nombre del negocio (`PantallaListo.jsx:78`).
- **Evidencia:** leído, y consultado en la DB: hay 2 solicitudes en `cargada` todavía vigentes.
- **Arreglo propuesto** (chico): si el estado no es `borrador`, responder `{ estado, datos: { local: { nombre } } }`.
  Opcional: que la query de alta de la skill ponga `vence_en = now()` al pasar a `cargada`.
- **Novedad:** nuevo.

#### Z3-06 [BAJO] `booking_url` se guarda sin validar el esquema y el iPad lo abre con `window.open`

- **Dónde:** `backend/src/controllers/gestion.js:565-579` (`PUT /api/admin/negocio`: solo recorta) y
  `frontend/src/screens/MainScreen.jsx:455` (`window.open(bookingUrl, "_blank")`, botón "Reservar" del modo
  operativo). El valor sale por `GET /api/negocio`, que es público.
- **Alcance:** en producción.
- **Qué pasa:** el campo acepta `javascript:…`. Lo puede escribir solo un admin (hoy por API: el formulario
  se sacó del panel, deuda #43), así que no hay escalada directa. El riesgo es de persistencia: alguien que
  supo el PIN de admin deja ahí un script, y aunque después le cambien el PIN, se ejecuta en el origen del
  panel cada vez que alguien toca "Reservar" en el iPad, donde vive el token operativo en `localStorage`. Es
  justo el caso que la decisión de julio (7.3) dejó como condición: "aceptable mientras no haya sinks de XSS".
- **Evidencia:** leído, y consultado en la DB: 0 tenants con un `booking_url` que no empiece con `https://`.
- **Arreglo propuesto** (chico): validar con `esUrlHttps` en `editarNegocio` (400 si no pasa) y, en el
  panel, no abrir nada que no empiece con `https://`. El alta ya lo arma bien (`plantilla_alta.sql:66`).
- **Novedad:** nuevo. El sink está en el panel: lo cruzo con la zona 6.

### Verificado correcto

**Formulario de alta y skill**

- **La query de alta no se puede inyectar ni romper desde el formulario.** `plantilla_alta.sql` no interpola
  ningún dato del cliente: los lee de `solicitud_alta.datos` con operadores `jsonb` (`->>`,
  `jsonb_array_elements`). A mano van solo el id (validado con `esUUID`), los PINs (`^\d{4}$`), el usuario, la
  contraseña y la fecha, que `armarQuery.mjs` escapa duplicando comillas; la DB tiene
  `standard_conforming_strings = on` (consultado), así que la barra invertida no escapa nada. Un `O'Brien` o un
  `'); DROP …` en un nombre queda como texto.
- Los casts de la plantilla (`::smallint`, `::time`, `::int`, `::numeric`) reciben solo valores que el envío ya
  normalizó, y una solicitud `enviada` no se puede volver a escribir por la API (`WHERE estado = 'borrador'` en
  los dos `UPDATE`). El único camino para cambiarla es SQL a mano, y la skill vuelve a validar antes
  (`leerSolicitud.mjs`).
- El `JOIN` por nombre de barbero de la plantilla es seguro: el envío rechaza nombres repetidos sin distinguir
  mayúsculas. Los CHECK de `tenant.email_duenio` y `telefono_duenio` aceptan lo que acepta el validador.
- Token del link: `uuid_generate_v4()` (122 bits al azar; consultado el default de la columna), vence a los
  30 días (`vence_en`), y un token mal formado, inexistente o vencido da el mismo 404 en los cuatro endpoints.
- Quien tiene el link puede leer, autoguardar y enviar **su** solicitud, y nada más: no hay ningún camino de
  `/api/alta` a datos de un tenant. La consulta de subdominio exige un token vigente (se chequea antes de
  responder) y solo dice libre u ocupado, que es información pública.
- Autoguardado: exige un objeto, reemplaza en vez de acumular, y el tamaño lo corta `express.json` (100 kB; el
  413 sale en JSON y con `console.warn`). La fila más grande hoy pesa 1,4 kB.
- Reenvío: el segundo envío da 409 y no manda mail; el estado va en el `WHERE` del `UPDATE`, así que dos
  envíos a la vez no pasan los dos. Rate limit: 120 por minuto para leer y guardar, 5 por hora para enviar.
- Mail de aviso: el nombre del negocio y la referencia pasan por `escaparHtml`; el asunto lleva solo la
  referencia, que escribe Facundo; el destino sale de una variable de entorno. Sin inyección de cabeceras: el
  envío es un JSON a la API de Resend, no SMTP.
- `/api/alta` queda fuera del log global (que escribe el body), tiene su log sin body y con el token
  enmascarado, y cierra con su propio 404.
- `frontend-alta`: sin `dangerouslySetInnerHTML` ni `innerHTML`; los únicos `href` con datos son el mapa
  (`encodeURIComponent`) y el WhatsApp de contacto, que es una constante. El token se manda con
  `encodeURIComponent`. `noindex` en el HTML y en `vercel.json`. RLS activado en `solicitud_alta` (consultado).

**Turnero**

- F9: cancelar y reprogramar exigen `estado = 'reservado' AND inicio > now()` en el `WHERE` del `UPDATE`, con
  el reloj de la base, y el 409 distingue "ya empezó" de "cambió de estado". El front deja de ofrecer las
  acciones y muestra el contacto del local.
- La gestión por token devuelve del cliente solo el nombre; ni mail ni teléfono. Todas las búsquedas filtran
  por `token_gestion AND tenant_id`. El token es `crypto.randomUUID()`.
- Reprogramación: el horario nuevo tiene que ser futuro, dentro de los 15 días, en horario de atención, sin
  feriado, sin pisar otro turno (`EXCLUDE`) ni una suspensión (`NOT EXISTS` en la misma sentencia). Lo que
  falta es la cantidad (Z3-01).
- "Cualquier barbero": el backend valida que el `barbero_id` sea del tenant y esté activo. Que el cliente
  mande otro barbero que el asignado no es un problema: elegir barbero es una función del turnero. El
  reintento del 409 es uno solo y pide de nuevo la disponibilidad.
- `origen`: `normalizarOrigen` (minúsculas, `^[a-z0-9_-]{1,30}$`), la misma regla en el front y un CHECK en la
  columna. Si no cumple, se guarda `null`.
- `/turnos/resena` no es un redirect abierto: el destino no sale de la URL sino de `tenant.resena_url`, que
  el backend entrega solo si es `https:` y el front vuelve a chequear antes del `location.replace`. El
  `?origen=` no participa del destino.
- Links con datos del dueño: mapa con `encodeURIComponent`; `tel:` solo con dígitos y `+`; `wa.me` solo con
  dígitos, y el backend entrega el WhatsApp solo si es E.164. Los links externos llevan
  `rel="noopener noreferrer"`. Ninguno puede terminar en `javascript:`. En la DB, el único tenant con WhatsApp
  cargado tiene un E.164 válido.
- Sinks de XSS: ninguno en `frontend-turnero` (sin `dangerouslySetInnerHTML`, `innerHTML` ni `eval`). El
  `link.href` del favicon y los `src` de imágenes usan la URL que arma el backend sobre Supabase Storage.
- `.ics`: `escaparTexto` cubre `\`, `;`, `,` y los tres saltos de línea, así que el nombre del servicio, del
  local o la dirección no pueden agregar líneas ni propiedades. Líneas plegadas a 75 octetos, CRLF. El link de
  Google Calendar se arma con `URLSearchParams`.
- El token de la ruta de gestión se pasa a la API sin decodificar: un `%2F..` no cambia de endpoint.
- Endpoints públicos: `GET /api/turnero/tenant` devuelve id, nombre, teléfono del local, WhatsApp, link de
  reseñas, dirección, horario y feriados; `GET /api/negocio`, nombre y `booking_url`. Ninguno trae PIN, hashes,
  versiones de token, suscripción, ni el mail o el celular del dueño (el handler de admin es otro,
  `getNegocioAdmin`). `/barberos` devuelve id y nombre; `/servicios`, id, nombre, precio y duración.
- Ids y fechas del query y del body se validan con `esUUID`, `esFechaISO` y `parsearInstante` (los tres exigen
  `string`, así que un parámetro repetido o un objeto dan 400 y no 500). `/dias-disponibles` tiene tope de 62
  días.
- El link de gestión de los mails se arma con el subdominio del header, pero ese header ya tuvo que coincidir
  exacto con un tenant activo: no se puede apuntar el link a otro dominio.

**Mails**

- Los seis mails (confirmación, cancelación, reprogramación, cancelación automática, recordatorio, aviso de
  alta) y el de recuperación pasan todos los valores dinámicos por `escaparHtml`, incluidos el título, la
  introducción con el nombre del cliente, cada fila y los `href` (entre comillas dobles, que el escape cubre).
- Asuntos: llevan solo fechas formateadas por el servidor, o textos fijos (recuperación). El único con un dato
  externo es el del aviso de alta, con la referencia que escribe Facundo.
- Remitente: el nombre del local va entre comillas con `"` y `\` escapados. Destinatario: el mail del cliente
  ya normalizado y validado con una regex que no admite espacios ni un segundo `@`.
- El link de recuperación viaja en el HTML escapado y el mail del dueño se loguea enmascarado.

**Imágenes**

- Subir y borrar son solo de admin (`requiereRol('admin')`). El body tiene que declararse `image/webp` y pesar
  hasta 1 MB; el nombre del archivo lo arma el servidor (`<tenant>/<tipo>/<uuid>.webp`), sin nada del cliente.
- No se verifica que los bytes sean un WebP real, pero no hay riesgo: se sirve desde el dominio de Supabase
  Storage, siempre con `Content-Type: image/webp`.
- El borrado filtra por `tenant_id` y valida el id. El cupo por tipo lo respalda `UNIQUE (tenant_id, tipo,
  orden)` (consultado en la DB).

### Para otra zona

- **Zona 2 (y 7):** el caché de `tenantMiddleware` es un objeto plano (`backend/src/middlewares/tenantMiddleware.js:23`
  y `:37`). Con el header `X-Tenant-Subdomain: constructor` (o `toString`, `__proto__`), `tenantCache[subdominio]`
  devuelve una propiedad heredada, el middleware lo da por resuelto y sigue con `req.tenant_id = undefined`.
  No encontré una lectura que devuelva datos así (las queries filtran por `tenant_id = NULL` y no traen nada),
  pero conviene un `Map` o `Object.create(null)`, y revisar los caminos de escritura. En producción.
- **Zona 7:** la skill `alta-cliente` lee en el contexto de Claude textos que escribe un tercero (Z3-04).
- **Zona 7:** el log de acceso global (`index.js:201-209`) escribe el body de `POST /api/turnero/turnos` con
  el nombre, el teléfono y el mail del cliente (`sanitizarObjeto` tapa solo credenciales), y
  `mailer.js:248` escribe el mail del cliente en cada envío. Esos logs los lee la sesión de diagnóstico.
- **Zona 7:** `/turnos/gestionar/<token>` no lleva `X-Robots-Tag: noindex` (`frontend/vercel.json` excluye
  todo `/turnos` para que la landing del turnero se indexe).
- **Zona 6:** el sink de Z3-06 está en el panel (`MainScreen.jsx:455`).
- **Zona 5:** el `UPDATE` de la reprogramación por link (`turnero.js:627`) cambia solo `inicio` y `fin`; no
  toca `recordatorio_enviado_en`. No miré qué hace el job con un turno reprogramado después del recordatorio.
- **Zona 8:** los `GET` de disponibilidad del turnero no tienen límite propio (solo los 300 por minuto
  globales) y cada uno son varias queries contra un pool de 3.
- **Docs:** `SQL_Schema.md` no menciona `tenant_imagen_unico UNIQUE (tenant_id, tipo, orden)`, que existe en
  la DB. Y la nota de julio en 3.3 atribuye a `helmet` que el token no salga en el `Referer`: `helmet` cubre
  las respuestas de la API, no la página (que sirve Vercel). Lo que hoy lo evita es la política por defecto
  del navegador y el `rel="noreferrer"` de los links externos.

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
