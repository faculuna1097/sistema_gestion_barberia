# Auditoría del proyecto — 2026-07

Repaso sistemático del proyecto buscando puntos débiles, mejoras y riesgos de
seguridad. Auditoría de **solo lectura** (no se modificó código durante el
relevamiento). Cada hallazgo lleva severidad: **crítico / alto / medio / bajo**.

La auditoría **no re-reporta** las deudas ya registradas en `estado_actual.md`
salvo para confirmar que siguen vigentes o para matizar su diagnóstico; el foco
está en lo que **no** estaba anotado.

Metodología: 7 fases ordenadas por riesgo. **Auditoría completa (7/7 fases).**

| Fase | Área | Estado |
|---|---|---|
| 1 | Autenticación y autorización | ✅ Completa |
| 2 | Multi-tenancy y aislamiento de datos | ✅ Completa |
| 3 | Endpoints públicos del turnero | ✅ Completa |
| 4 | Base de datos y capa de acceso | ✅ Completa |
| 5 | Configuración, infra y dependencias | ✅ Completa |
| 6 | Calidad del backend (bugs y robustez) | ✅ Completa |
| 7 | Frontends (los tres + landing) | ✅ Completa |

---

## Resumen ejecutivo y backlog priorizado

**Veredicto general:** la base es sólida en lo que más importa para un sistema
multi-tenant — **aislamiento de lectura perfecto** (ninguna query fuga datos de
otro tenant), **cero SQL injection** (todo parametrizado), **cero sinks de XSS**,
higiene de secretos impecable, y piezas bien construidas (mailer con escape, job
de recordatorios con claim atómico, validación cruzada de tenant en el JWT). Los
hallazgos se concentran en **escrituras que confían en el cliente** y en **falta
de límites/hardening**, no en fugas de datos entre tenants por lectura.

**Conteo:** 1 crítico · 3 altos · 6 medios · 7 bajos.

### Orden de ataque recomendado

| # | Hallazgo | Sev. | Esfuerzo | Por qué en este orden |
|---|---|---|---|---|
| **2.1** | `barbero_id`/`servicio_id` sin validar ownership → DoS de agenda cross-tenant | 🔴 Crítico | Medio (FK compuesto + migración) | Único que rompe aislamiento entre tenants; explotable sin auth con UUIDs públicos |
| **3.1** | Sin rate limiting en la reserva pública → email bombing + spam + agota agenda | 🟠 Alto | Medio (rate limit + captcha) | Ataca la entregabilidad (activo real) y amplifica 2.1 y 4.1 |
| **1.1** | Sesión de barbero/admin no revocable (30 días) | 🟠 Alto | Medio (token_version + 7.1) | Empleados rotan; hoy no hay corte de acceso. Requiere 7.1 en el front |
| **7.1** | Front no maneja 401 (admin/barbero) | 🟡 Medio | Bajo | Prerequisito de 1.1; hacerlos juntos |
| **6.1** | Montos sin validar (negativos/no numéricos) | 🟡 Medio | Bajo (validador central) | Corrupción silenciosa de balances por typo |
| **5.2** | Falta `helmet` / headers de seguridad | 🟡 Medio | Bajo (2 líneas) | Hardening barato; ayuda con 3.3 |
| **4.1** | Pool de 3 conexiones sin rate limiting → DoS | 🟡 Medio | Bajo | Se cierra en gran parte con 3.1 |
| **6.2** | Updates de stock multi-paso sin compensación | 🟡 Medio | Medio | Consistencia de inventario; se entrelaza con 4.2 |
| **5.1** | `xlsx` HIGH sin fix por npm | 🟡 Medio | Medio (migrar lib) | Planificar cambio a SheetJS oficial / exceljs |
| — | Bajos: 1.3, 2.2, 2.3, 3.2, 3.3, 4.2, 4.3, 4.4, 5.3, 5.4, 6.3, 7.2, 7.3 | 🟢 Bajo | Varía | Hardening y limpieza; atacar por oportunidad |

**Combos que conviene resolver juntos:**
- **1.1 + 7.1** — revocación de sesión + manejo de 401 en el front (uno necesita
  al otro).
- **3.1 + 4.1** — un rate limiter cierra el abuso público y el DoS de pool a la vez.
- **6.1 + 6.2** — un validador de montos + un helper de stock con compensación
  cubren ambos.
- **2.1 (FK compuesto)** cierra estructuralmente el CRÍTICO sin tocar cada handler.

**Nota:** este documento es de auditoría (solo lectura). Ninguna corrección se
aplicó todavía; cada fix merece su propio branch/chat con su testing.

---

## Fase 1 — Autenticación y autorización

### Verificado correcto
- **Aislamiento de tenant en el token:** `verificarToken` cruza
  `payload.tenant_id` contra el `req.tenant_id` del subdominio y responde 403 si
  difieren. Un JWT de un tenant no sirve sobre el subdominio de otro.
- **Scoping horizontal barbero↔barbero:** confirmado query por query en
  `turnosService.js` (`cambiarEstado`, `completarTurnoConCorte`,
  `cancelarTurnoPorId`, `listarTurnos`): cuando el rol es barbero, el
  `barbero_id` se agrega al `WHERE` de la query, no solo se deriva en JS.
- **Todas las rutas protegidas tienen middleware:** revisado el montaje en
  `index.js` (líneas 159–199). No hay ruta protegida sin `verificarToken`. Las
  rutas mixtas (`/ventas`, `/gastos`, `/horario-atencion`) delegan el chequeo de
  rol por método dentro del router; verificado.
- **Mensajes de login genéricos:** los tres logins responden lo mismo en todo
  camino de fallo (no filtran existencia de tenant/usuario/barbero).
- **Clave de plataforma:** comparación en tiempo constante (`timingSafeEqual`
  sobre digests SHA-256) y fail-safe (sin `PLATFORM_ADMIN_KEY` → 503, rechaza
  todo).
- **Credenciales con bcrypt**, nunca en texto plano ni en logs (el logger global
  pasa el body por `sanitizarObjeto`).

### Hallazgos

#### 1.1 [ALTO] Desactivar o cambiar el PIN de un barbero no cierra su sesión activa
`verificarToken` solo valida firma + tenant + (para operativo) `token_version`.
Los JWT de **admin y barbero duran 30 días y no tienen revocación**: si se marca
un barbero `activo = false` o se le cambia el PIN, su token existente sigue
siendo aceptado hasta 30 días. El token operativo sí tiene
`operativo_token_version` para revocación inmediata; admin y barbero no tienen
equivalente. **No estaba documentado** (la deuda registrada solo cubre el caso
operativo). Relevante para un negocio con rotación de empleados.

**Fix propuesto:** columna `token_version` en `barbero` (y equivalente para el
admin en `tenant`), incluida en el payload al firmar y chequeada en
`verificarToken`; se bumpea al desactivar el barbero o cambiarle el PIN. Mismo
patrón que ya existe para operativo.

> **RESUELTO (tanda 3):** replicado el patrón operativo para ambos roles.
> Columnas nuevas: `barbero.token_version` y `tenant.admin_token_version`
> (integer NOT NULL DEFAULT 0 — **requieren migración SQL antes del deploy**).
> Al firmar, `authPanel` (ambos paths) y `authBarbero` incluyen `tv` en el
> payload. Al verificar (`authMiddleware`): el admin se chequea contra el
> caché del `tenantMiddleware` (extendido con `admin_token_version`, sin
> SELECT por request); el barbero, con UNA query por request que trae
> `token_version` Y `activo` — rechaza 401 si el tv no coincide **o** si el
> barbero está desactivado (esto cierra directamente el "barbero desactivado
> mantiene acceso"; la opción de cachear por barbero_id queda anotada en el
> código para cuando el volumen lo amerite). Bumps: `cambiarPinAdmin`
> incrementa `admin_token_version` en el mismo UPDATE e invalida el caché del
> tenant; `editarBarbero` incrementa `barbero.token_version` al cambiar el PIN
> o desactivar. Tokens viejos sin `tv` se tratan como 0 (no rompe sesiones
> vigentes hasta la primera rotación). Flujo real de revocación pendiente de
> smoke-test post-migración + deploy.
>
> **Addendum (tanda 3):** endurecido `verificarToken` para que un fallo de DB no
> desloguee. Antes, un solo `try` envolvía la verificación de firma **y** las
> queries de versión/activo, y el `catch` respondía 401 ante cualquier error —
> así un blip de conexión (la query del barbero corre en cada request) expulsaba
> al usuario al login. Ahora son dos etapas: (1) firma/expiración en su propio
> try → 401 (auth real); (2) lectura de versión/activo en otro try → cualquier
> throw de la DB es 500 (recuperable), y solo un mismatch de `tv` o `activo=false`
> da 401 explícito. Verificado en frío (`node --check` + round-trip: firma
> inválida→401, tenant cruzado→403, barbero/admin con DB caída→500, sin llamar a
> `next()`).

#### 1.2 [MEDIO] PIN de 4 dígitos + sin rate limiting = fuerza bruta viable
Ya registrado como deuda conocida (rate limiting ausente). Se refuerza: 10.000
combinaciones, sin bloqueo tras N intentos, sin captcha. Los `console.warn` de
login fallido registran el abuso pero no lo frenan. El costo de N bcrypt por
intento lo hace lento pero no imposible. Recomendación: subir su prioridad
apenas haya más de un tenant en producción.

> **RESUELTO (tanda 2):** los 3 logins (`/api/auth/panel`, `/api/auth/barbero`,
> `/api/auth/operativo`) montan `limiterLogin`
> (`middlewares/rateLimitMiddleware.js`): 10 intentos **fallidos** por IP cada
> 15 min, compartido entre los tres endpoints (rotar de endpoint no multiplica
> el presupuesto). Los logins exitosos no consumen cupo
> (`skipSuccessfulRequests`), así una barbería detrás de un mismo router no se
> bloquea sola. Respuesta 429 con mensaje genérico. Requiere el
> `app.set('trust proxy', 1)` agregado en `index.js` (proxy de Railway).
> Comportamiento en vivo pendiente de smoke-test en el primer deploy.

#### 1.3 [BAJO] El algoritmo del JWT no está fijado en `jwt.verify`
Se llama `jwt.verify(token, secret)` sin `{ algorithms: ['HS256'] }`. Con
secreto simétrico el riesgo real es bajo (jsonwebtoken v9 ya rechaza `alg: none`
por defecto y no hay clave pública que habilite confusión RS256→HS256), pero
fijar el algoritmo explícitamente es hardening barato y estándar. Aplica a los
tres puntos de firma/verificación.

> **RESUELTO (tanda 1):** `config/jwt.js` fija `HS256` tanto al firmar
> (`algorithm`) como al verificar (`algorithms: ['HS256']`); verificado con un
> token HS384 firmado con el mismo secreto → rechazado con `invalid algorithm`.

#### 1.4 [BAJO — informativo] `JWT_SECRET` accedido directo sin validación al boot
Ya está en las deudas de `estado_actual.md`, pero con un diagnóstico inexacto:
el doc dice que sin `JWT_SECRET` el sistema "firma con `undefined` sin error".
En realidad `jwt.sign`/`jwt.verify` **lanzan** si el secreto falta, así que el
sistema falla **cerrado**, no abierto — es robustez de arranque, no una
vulnerabilidad. Centralizar en `config/jwt.js` con validación al boot sigue
siendo lo correcto. (Corregir la redacción de la deuda original.)

> **RESUELTO (tanda 1):** creado `backend/src/config/jwt.js` — lee `JWT_SECRET`
> una sola vez, en producción aborta el arranque si falta (en dev arranca con
> warn), y expone `firmarToken`/`verificarFirmaToken` con HS256 fijado y
> expiración 30d centralizada. Refactorizados `authPanel.js`, `authBarbero.js`,
> `authOperativo.js` y `authMiddleware.js` (ya ningún archivo accede a
> `process.env.JWT_SECRET` directo). Redacción de la deuda en
> `estado_actual.md` corregida y marcada resuelta.

**Prioridad de ataque sugerida en esta fase:** 1.1 primero (hueco real no
documentado), luego 1.2 cuando escale el número de tenants, después 1.3 como
hardening de rutina.

---

## Fase 2 — Multi-tenancy y aislamiento de datos

Barrido query por query de los 26 controllers y los 11 services (todas las
cláusulas `WHERE`, `INSERT`, `UPDATE`, `DELETE`).

### Verificado correcto
- **Lectura: aislamiento total.** No existe ni un solo `SELECT` que devuelva
  datos de una tabla scopeada por tenant sin filtrar por `tenant_id` (directo o
  vía JOIN con la condición `t.tenant_id = $N`). Verificado en balances, caja,
  inicio, ventas, gastos, clientes, planilla, turnos, turnero, gestión,
  imágenes, feriados, horarios, suspensiones y disponibilidad.
- **Mutación por `id` de PK sin `tenant_id`:** existe (p. ej.
  `UPDATE producto SET stock_actual ... WHERE id = $2` en ventas/caja, o
  `UPDATE turno SET estado ... WHERE id = $2` en turnosService), pero en **todos**
  los casos el `id` proviene de un `SELECT` previo ya scopeado por tenant dentro
  del mismo request. No es una fuga: la cadena de `id` nace de datos del propio
  tenant. Queda como observación de defensa-en-profundidad (ver 2.2).
- **Borrado de imágenes** (`deleteImagen`) filtra por `id AND tenant_id` antes de
  tocar Storage — un tenant no puede borrar archivos de otro.
- **`createVenta`** rechaza (404) si el `producto_id` no pertenece al tenant
  antes de descontar stock.
- **Lookups por `token_gestion`** (turnero público) filtran además por
  `tenant_id`, aunque el token sea UNIQUE global — defensa correcta.

### Hallazgos

#### 2.1 [CRÍTICO] Las escrituras no validan que `barbero_id`/`servicio_id` pertenezcan al tenant → DoS de disponibilidad cross-tenant

> **Severidad confirmada CRÍTICA (2026-07).** La query sobre `pg_constraint`
> confirmó que `turno_no_solapamiento` es
> `EXCLUDE USING gist (barbero_id WITH =, tstzrange(inicio, fin, '[)') WITH &&) WHERE (estado = 'reservado')`
> — **sin `tenant_id`**. El constraint es **global por barbero**, así que el
> escenario de DoS descrito abajo es real, no hipotético.

Los caminos de creación confían en el `barbero_id` (y en cortes, también el
`servicio_id`) que manda el cliente **sin verificar que pertenezcan al tenant
del request**:
- `registrarCorte` (`cortesService.js`) — inserta el corte con `barbero_id` y
  `servicio_id` del body directo. Solo valida ownership del `turno_id` (vía FK).
- `crearTurno` (turnero **público**, sin auth) y `crearTurnoAdmin` — validan el
  `servicio_id` contra el tenant (vía `calcularDuracionServicio`), pero **no** el
  `barbero_id`. `insertarTurno` lo inserta tal cual.

Los FK de `corte`/`turno` sobre `barbero_id` y `servicio_id` son **globales**
(`REFERENCES barbero(id)`, no compuestos con `tenant_id`), así que un id de otro
tenant pasa el FK. Y como **`GET /api/turnero/barberos` expone públicamente los
UUID de los barberos de cualquier tenant**, la barrera de "UUID no adivinable"
no aplica: un atacante enumera los barberos de un tenant B desde su turnero
público y luego crea turnos/cortes que referencian a ese barbero.

**Consecuencias:**
- **Corrupción de integridad:** un turno/corte con `tenant_id = A` referenciando
  un barbero de B. Al listar (JOIN a `barbero`), el tenant A vería el **nombre**
  del barbero de B — fuga de lectura acotada.
- **DoS de disponibilidad cross-tenant (CONFIRMADO):** como el constraint
  `EXCLUDE GIST` es global por `barbero_id` (sin `tenant_id`), un turno inyectado
  bajo el tenant A para el barbero de C reserva a ese barbero **globalmente** en
  ese rango. Cuando un cliente legítimo de C intenta reservar ese horario, el
  INSERT choca con el constraint (23P01) → 409 "slot ocupado". Pero
  `disponibilidadService` filtra por `tenant_id = C`, así que **C sigue mostrando
  el slot como disponible** aunque toda reserva falle. C no ve el turno fantasma
  en su panel (también filtra por su tenant) → no puede encontrarlo ni cancelarlo.

**Exploit sin auth y sin infraestructura propia:** el atacante no necesita un
tenant propio. Usa el turnero público de **cualquier** tenant "lanzador" X como
vector: `POST /api/turnero/turnos` con `X-Tenant-Subdomain: X`, un `servicio_id`
de X (público vía `/api/turnero/servicios`) y el `barbero_id` de la **víctima C**
(público vía `/api/turnero/barberos`). Mientras el horario caiga dentro de las
horas de atención de X, el turno se crea (`tenant_id = X`, `barbero_id =
C_barbero`) y bloquea a C. Repitiendo sobre los slots del día, se le tapa la
agenda entera a C de forma invisible para C. Todos los UUID necesarios son
públicos.

> Atenuante operativo hoy: el turno fantasma queda con `tenant_id = X`, así que
> el tenant lanzador X **sí** lo ve en su panel (con el nombre del barbero de C
> vía JOIN) y su admin podría cancelarlo. No lo ve la víctima C. El alta de
> tenants es manual hoy, pero el vector **no** requiere ser tenant — cualquiera
> con acceso HTTP al turnero público puede lanzarlo usando un tenant existente
> como trampolín.

Está emparentado con la deuda ya documentada "el POST no valida que `inicio`
caiga en un slot real", pero el ángulo de **ownership de `barbero_id` por
tenant** no está registrado, y la consecuencia (DoS cross-tenant) es nueva.

**Fix propuesto (senior):** FK **compuestos** `(tenant_id, barbero_id) REFERENCES
barbero(tenant_id, id)` y `(tenant_id, servicio_id) REFERENCES servicio(tenant_id, id)`
en `turno` y `corte` (requiere `UNIQUE(tenant_id, id)` en `barbero`/`servicio`).
Esto hace que la DB **rechace estructuralmente** cualquier referencia cross-tenant,
sin depender de validación en cada handler. Alternativa mínima: un `SELECT 1 FROM
barbero WHERE id=$1 AND tenant_id=$2 AND activo=true` antes de cada insert.

> **RESUELTO (tanda 4, 2026-07).** Se aplicó la defensa **estructural + red de
> seguridad app**:
> - **DB:** `UNIQUE (tenant_id, id)` en `barbero`, `servicio` y `turno`; FK
>   compuestos `(tenant_id, barbero_id)` y `(tenant_id, servicio_id)` en `turno` y
>   `corte`, más `(tenant_id, turno_id)` en `corte` (MATCH SIMPLE → walk-ins con
>   `turno_id` NULL no se rompen). Migración aplicada en demo y prod tras confirmar
>   0 referencias cross-tenant preexistentes. El EXCLUDE global por `barbero_id` se
>   dejó intacto: ya no es explotable porque el turno cross-tenant no puede
>   insertarse. Constraints nuevos reflejados en `SQL_Schema.md`.
> - **App:** `barberosService.barberoActivoEnTenant` (helper centralizado) valida
>   el barbero (tenant + activo) antes del insert en `crearTurno`, `crearTurnoAdmin`
>   y `createCorte`; el servicio se valida vía `calcularDuracionServicio`. Los INSERT
>   de turno/corte mapean la violación de FK (23503) a 4xx limpio como backstop de
>   carrera (`insertarTurno` → `REFERENCIA_INVALIDA` → 404; `registrarCorte` →
>   `BARBERO_INVALIDO`/`SERVICIO_INVALIDO`/`TURNO_INEXISTENTE` por `err.constraint`).
> - **No incluido (defensa en profundidad opcional):** FK compuesto de
>   `turno.cliente_id` — `cliente_id` nunca es client-controlled (sale de
>   `upsertCliente`, scopeado por tenant), así que no aporta superficie.

#### 2.2 [BAJO] Mutaciones por `id` sin `tenant_id` redundante (defensa en profundidad)
Varias UPDATE/DELETE operan por PK (`WHERE id = $1`) confiando en que el `id`
vino de un SELECT scopeado previo. Es correcto hoy, pero frágil ante un refactor
que separe esas dos queries. Sumar `AND tenant_id = $N` a esas mutaciones es
barato y elimina la dependencia implícita. Prioridad baja.

Además del FK compuesto, conviene evaluar **agregar `tenant_id` al constraint
EXCLUDE** (`EXCLUDE USING gist (tenant_id WITH =, barbero_id WITH =, tstzrange
WITH &&)`). Con FK compuesto que garantiza que el barbero pertenece al tenant,
ambas defensas se refuerzan. Nota: el FK compuesto por sí solo ya cierra el
agujero (un turno de A no puede referenciar un barbero de C); el `tenant_id` en
el EXCLUDE es defensa en profundidad.

#### 2.3 [BAJO — doc] Comentario stale en `turnosOperativo.js`
La cabecera dice "Sin auth — solo tenantMiddleware", pero en `index.js` la ruta
`/api/turnos` está protegida con `verificarToken + requiereRol('operativo',
'admin')`. El comentario induce a error sobre la superficie pública. Corregir.

> **RESUELTO (tanda 1):** cabecera de `turnosOperativo.js` corregida — ahora
> documenta la protección real (`verificarToken + requiereRol` en `index.js`).

**Acción pendiente de la fase — RESUELTA (2026-07):** confirmada la definición
del constraint vía `pg_constraint`: es global por `barbero_id`, sin `tenant_id`
→ 2.1 queda en CRÍTICO.

---

## Fase 3 — Endpoints públicos del turnero

Superficie anónima: `GET /api/turnero/*` (negocio, barberos, servicios,
disponibilidad, días), `POST /api/turnero/turnos` (reserva) y la gestión por
token (`GET/DELETE/PATCH /api/turnero/turnos/gestionar/:token`).

### Verificado correcto
- **`token_gestion` fuerte:** se genera con `crypto.randomUUID()` (UUID v4, 122
  bits de entropía) — no adivinable ni enumerable por fuerza bruta.
- **Lookups por token scopeados:** todo `GET/cancelar/reprogramar` filtra por
  `token_gestion AND tenant_id`, aunque el token ya sea UNIQUE global.
- **Mailer a prueba de inyección HTML:** `construirHtml` pasa **todos** los
  valores dinámicos por `escaparHtml` antes de interpolar — incluido el `intro`,
  que contiene `cliente.nombre`. Un nombre con `<script>`/`<img onerror>` se
  neutraliza. Confirmado en los 5 tipos de mail. (El render en el panel admin /
  app barbero se valida en Fase 7, pero React escapa por defecto.)
- **Reprogramar/cancelar exigen el token** (secreto por turno), así que no son
  abusables masivamente como la creación.

### Hallazgos

#### 3.1 [ALTO] Sin rate limiting ni anti-automatización en la reserva pública → email bombing + polución + agota agenda
`POST /api/turnero/turnos` es anónimo y no tiene ningún límite de tasa, captcha
ni control de automatización. Cada request crea un turno real **y dispara un mail
de confirmación a la dirección de email que el atacante ponga en el body**.
Consecuencias:
- **Email bombing desde un dominio autenticado:** el atacante manda mails no
  solicitados a víctimas arbitrarias, firmados con el SPF/DKIM del dominio del
  negocio → **daña la reputación de entregabilidad** (el activo que costó
  construir en la migración a Resend) y quema la cuota de Resend.
- **Polución de datos:** llena `turno` y `cliente` de basura.
- **Agota la agenda:** cada turno basura ocupa un slot real del barbero;
  amplifica directamente el DoS de 2.1 (acá sin siquiera necesitar el truco
  cross-tenant: reservas masivas sobre el propio tenant ya tapan la agenda).

La deuda documentada de rate limiting está acotada a los **logins**; esta
superficie pública de escritura no está cubierta y es más expuesta (no requiere
credenciales). **Fix:** rate limit por IP + por (tenant, email/teléfono),
captcha/turnstile en el turnero, y un tope de reservas activas por cliente.

> **RESUELTO (tanda 2):** `POST /api/turnero/turnos` monta doble limiter por IP
> (`middlewares/rateLimitMiddleware.js`): anti-ráfaga 3/min + techo 10/hora.
> Los GET del turnero quedan sin límite propio (el wizard navega con muchas
> lecturas) — los cubre el backstop global de 300 req/min/IP. **Follow-ups
> deliberadamente fuera de esta tanda:** captcha/Turnstile (requiere cuenta
> externa + widget en el front; solo si el abuso persiste), límite por
> (tenant, email/teléfono), tope de reservas activas por cliente, y manejo del
> 429 en la UI del turnero (hoy mostraría un error genérico en vez de
> "demasiados intentos"). Comportamiento en vivo pendiente de smoke-test en el
> primer deploy.

#### 3.2 [MEDIO] Validación de inputs públicos débil o ausente
En `crearTurno`: `nombre` y `telefono` **no tienen validación** de longitud ni
formato (texto libre sin tope), y `REGEX_EMAIL` es `/.+@.+\..+/` — extremadamente
permisivo (acepta espacios, markup, direcciones inválidas). Sin límite de tamaño
de body en Express (ver Fase 5), un `nombre` puede pesar megabytes y guardarse en
la DB. **Fix:** topes de longitud (`nombre` ≤ 80, `telefono` ≤ 30), regex de
email más estricta o validación real, y `express.json({ limit: '...' })`.

#### 3.3 [BAJO] PII del cliente accesible al portador del `token_gestion` (token en la URL)
`GET .../gestionar/:token` devuelve `cliente.email` y `cliente.telefono`. El
token viaja en el **path de la URL** (`/turnos/gestionar/:token`), y las URLs se
filtran por `Referer`, historial del navegador y logs. Quien obtenga el link ve
la PII del cliente. Es inherente al diseño "gestión por link" y de bajo riesgo,
pero conviene: no incluir la PII completa en esa respuesta si la pantalla no la
necesita, y evitar que el token termine en `Referer` hacia terceros
(`Referrer-Policy`).

**Prioridad de ataque en esta fase:** 3.1 primero (se combina con el CRÍTICO
2.1 y ataca un activo real, la entregabilidad), luego 3.2, después 3.3.

---

## Fase 4 — Base de datos y capa de acceso

### Verificado correcto
- **SQL injection: descartado.** El 100% de las queries usa placeholders
  parametrizados (`$1, $2, ...`). Se enumeraron **todas** las interpolaciones de
  string en SQL del backend: son únicamente (a) la constante `TZ`
  (`AT TIME ZONE '${TZ}'`, hardcodeada en `utils/constantes.js`), (b) construcción
  de **números** de placeholder (`$${paramIndex}`, `$${indice}` — no valores),
  (c) fragmentos de `WHERE`/`SET` **hardcodeados** (`filtroExtra = ' AND
  c.barbero_id = $5'`, `setClauses` con columnas fijas). En ningún caso se
  concatena input del usuario. El UPDATE dinámico de `adminOperativo` arma los
  `SET` con strings fijos y los valores por parámetro.
- **Retry de conexión bien acotado:** `query()` reintenta **una** vez y **solo**
  ante errores de red/conexión (`esErrorDeConexion` distingue SQLSTATE de
  integridad/sintaxis de los de socket). No reintenta errores de SQL.

### Hallazgos

#### 4.1 [MEDIO] Pool de 3 conexiones en instancia única + sin rate limiting = DoS por agotamiento de pool
`db.js` configura `max: 3` (límite del plan gratuito de Supabase) y corre 1 sola
instancia en Railway. Sin rate limiting (ver 3.1), un puñado de requests
concurrentes a un endpoint lento —o mantenidas abiertas a propósito— agota las 3
conexiones y **encola/estanca toda la API para todos los tenants**. El techo de
concurrencia es muy bajo y es un objetivo trivial. Mitigar: rate limiting (3.1),
`statement_timeout` en las queries, y monitorear saturación del pool. Subir `max`
depende del plan de Supabase.

> **RESUELTO (tanda 2, corregido):** dos piezas. (a) Backstop global de rate
> limiting en `index.js` (`limiterGlobal`, 300 req/min/IP) que corta el goteo
> masivo desde una IP antes de que toque el pool. (b) `statement_timeout=5000` en
> `config/db.js`. **Nota de corrección:** la implementación original vía parámetro
> de startup (`options: '-c statement_timeout=5000'`) resultó ser un **no-op** —
> se verificó en frío con un script (`SHOW statement_timeout` quedaba en el default
> de `2min`) que el pooler de Supabase (Supavisor) **descarta** los parámetros
> `options`. Se corrigió a un `SET statement_timeout` a nivel SQL vía
> `pool.on('connect')`, verificado end-to-end (un `pg_sleep(10)` se cancela a ~2s
> con SQLSTATE 57014). `max: 3` no se tocó (límite del plan). Nota adicional: el
> default de Supabase ya era 120s (no era "sin timeout"), pero 120s con 3
> conexiones es una ventana de DoS amplia; 5s la cierra. Monitorear saturación del
> pool sigue abierto como mejora operativa.

#### 4.2 [MEDIO] UPDATEs relativos no idempotentes + retry-once pueden doble-aplicar ante un blip de conexión
Los contadores de stock se actualizan de forma **relativa**: `UPDATE producto SET
stock_actual = stock_actual - $1` (venta) y `+ $1` (borrado/edición). Si el socket
muere en la ventana entre que la DB commitea ese UPDATE y entrega el ack, el
retry de `query()` **reejecuta la misma sentencia** → el stock se descuenta (o
restaura) **dos veces**. Es la misma clase que la deuda de idempotencia ya
documentada para `/turnos`, pero acá el efecto es corrupción silenciosa de un
contador de inventario, no un 409 confuso. Los UPDATE de estado de turno
(`estado = 'completado'`, valor fijo) son idempotentes y no sufren esto.
**Fix:** para operaciones no idempotentes, o bien no reintentar, o bien
idempotency key / relectura-y-verificación tras el retry.

> **RESUELTO parcial (tanda 5) — cerrado para stock:** se eligió la opción "no
> reintentar" para las escrituras **relativas de stock**, que son la clase con
> peor consecuencia (corrupción silenciosa del inventario). `query()` acepta ahora
> un tercer arg `{ reintentar }` (default `true`, no cambia ningún caller
> existente); el helper `utils/stock.js` ejecuta todas las mutaciones de stock con
> `{ reintentar: false }`, y el restock relativo de `gestion.editarProducto`
> (`stock_actual + agregar_stock`, único UPDATE) también opta por no reintentar.
> Trade-off asumido: un fallo visible raro ante un blip
> —que el usuario reintenta— en vez de un doble-descuento silencioso. NO se tocó
> el retry de lecturas ni de writes idempotentes (SET de valor fijo como
> `estado='completado'`/`'reservado'`, DELETE): siguen reintentando sin riesgo.
> **Residual documentado:** los INSERT no idempotentes (turno protegido por la
> 23P01, venta, gasto) siguen reintentables; su doble-apply produce un fallo/fila
> visible, no corrupción de contador. El fix duro (idempotency keys) queda como la
> deuda arquitectónica mayor ya anotada para `/turnos`.

#### 4.3 [BAJO] `ssl: { rejectUnauthorized: false }` — el certificado de la DB no se valida
La conexión a Postgres cifra el tráfico pero **no autentica el certificado** del
servidor → MITM teórico entre Railway y Supabase. El comentario dice que es
"requerido por Supabase Session Pooler", pero Supabase publica su CA y se puede
pinnear (`ssl: { ca: <supabase-ca-pem> }`) para validación completa sin romper la
conexión. Riesgo real bajo (tráfico entre dos nubes mayores), pero es hardening
estándar y hoy está explícitamente desactivado.

#### 4.4 [BAJO — ya documentado] Cliente de Supabase Storage con init eager
`config/supabase.js` crea el cliente `service_role` al importar el módulo. Ya
está en las deudas de `estado_actual.md` (fue una de las causas del crash-loop
del go-live). Se reafirma: init perezoso + fallo puntual de Storage en vez de
tumbar el arranque. Cross-ref, no hallazgo nuevo.

**Prioridad de ataque en esta fase:** 4.1 y 4.2 son los accionables (el resto es
hardening / ya documentado). 4.1 se cierra en gran parte con el mismo rate
limiting de 3.1.

---

## Fase 5 — Configuración, infra y dependencias

### Verificado correcto
- **Higiene de secretos: impecable.** Ningún `.env` real trackeado (solo
  `backend/.env.example` con placeholders); ningún secreto hardcodeado en el
  código (las referencias a `SUPABASE_SERVICE_ROLE_KEY` son lecturas de
  `process.env`); el historial de git nunca contuvo un `.env` real.
- **CORS seguro:** `origin.endsWith('.barbermanager.app')` no es explotable — un
  atacante no puede registrar un origen `*.barbermanager.app` (es el dominio
  propio), y `evilbarbermanager.app` **no** matchea (falta el punto previo). La
  rama amplia de red local está correctamente gateada por `NODE_ENV !==
  'production'`.
- **Sin superficie CSRF:** la auth usa Bearer token en el header `Authorization`
  + `localStorage`, no cookies. Al no haber credenciales ambientes, CSRF no
  aplica y el `credentials: true` del CORS es inocuo.
- **Body acotado:** el upload de imágenes usa `express.raw({ type: 'image/webp',
  limit: '1mb' })` y `express.json()` trae el default de 100 kb. Refina 3.2: el
  `nombre` del cliente llega hasta ~100 kb (grande pero acotado), no megabytes.

### Hallazgos

#### 5.1 [MEDIO] `xlsx` (SheetJS) con vuln HIGH y sin fix por npm — dependencia de runtime del panel
`frontend` (gestión) depende de `xlsx` para exportar a Excel. `npm audit` reporta
**high**: Prototype Pollution (GHSA-4r6h-8v6p-xvw6) + ReDoS (GHSA-5pgg-2g8v-p4x9),
**sin fix disponible** en el paquete de npm (SheetJS abandonó la distribución por
npm). Exploitabilidad acotada (lo usa un admin autenticado sobre datos del propio
tenant), pero es una HIGH sin ruta de parche. **Fix:** migrar a la distribución
oficial de SheetJS (su CDN propio) o cambiar a `exceljs`.

#### 5.2 [MEDIO] Faltan headers de seguridad en la API (`helmet` ausente)
`index.js` no usa `helmet` ni `app.disable('x-powered-by')`. La API responde sin
`X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`, HSTS, ni
`Referrer-Policy`, y filtra `X-Powered-By: Express` (disclosure menor de stack).
Los frontends en Vercel reciben algunos headers de la plataforma, pero la API no.
**Fix:** `app.use(helmet())` + `app.disable('x-powered-by')`. Barato y estándar.
(El `Referrer-Policy` también ayuda con 3.3, el token en la URL.)

> **RESUELTO (tanda 1):** `helmet@8.3.0` instalado; `app.use(helmet())` con
> defaults como primer middleware de la cadena (antes de CORS y de toda ruta)
> + `app.disable('x-powered-by')` en `index.js`. helmet no toca los headers
> `Access-Control-*`, el CORS queda intacto (verificado por lectura del orden).

#### 5.3 [BAJO] `qs` (backend) — DoS moderada, con fix trivial
Dependencia transitiva `qs` 6.11.1 con DoS remoto (GHSA-q8mj-m7cp-5q26),
severidad moderate. **Fix:** `npm audit fix` en `/backend` (no rompe API).

> **RESUELTO (tanda 1):** `npm audit fix` aplicado — `qs` 6.15.0→6.15.3 y 4
> transitivas más, todos bumps patch en el lockfile (`package.json` sin
> cambios de versión). `npm audit` re-corrido: **0 vulnerabilidades**.

#### 5.4 [BAJO] Vulns dev-only en `vite`/`esbuild` (los tres frontends)
`npm audit` marca high en `esbuild` (GHSA-g7r4-m6w7-qqqr, lectura de archivos vía
el **dev server** en Windows). **Solo afecta el entorno de desarrollo local**, no
el build de producción servido por Vercel. Mantener `vite` actualizado; sin
urgencia. Nota: `frontend-turnero` y `frontend-barbero` tienen **0**
vulnerabilidades de runtime (todo lo suyo es dev-only).

#### 5.5 [BAJO — pendiente] `frontend-landing` no auditado en esta fase
El audit de dependencias cubrió backend + 3 frontends de la app. El landing
(`frontend-landing`) queda para la Fase 7 (superficie estática, riesgo bajo).

**Prioridad de ataque en esta fase:** 5.1 (HIGH sin patch, planificar migración)
y 5.2 (hardening barato de alto valor) primero; 5.3 es un `npm audit fix` de un
minuto; 5.4 sin urgencia.

---

## Fase 6 — Calidad del backend (bugs y robustez)

### Verificado correcto
- **Job de recordatorios robusto:** claim atómico (`UPDATE ... WHERE
  recordatorio_enviado_en IS NULL RETURNING id` — marca **antes** de enviar → no
  hay doble envío, y el lote es re-ejecutable), `try/catch` por tenant **y** por
  turno (un fallo aislado no tira el resto), y cierre limpio del pool con
  `process.exit` acorde para que Railway Cron lea la corrida.
- **Sin error swallowing en backend:** los `catch` loguean el `err` completo y
  responden un 500 genérico — no se traga el error ni se filtra stack trace al
  cliente. (El swallow conocido es solo en el frontend, ya documentado.)
- **El path de completar turno SÍ valida montos** (`precio >= 0`, `propina >= 0`,
  `NaN`) — es el patrón correcto que los otros writes deberían imitar (ver 6.1).

### Hallazgos

#### 6.1 [MEDIO] Las creaciones de venta/gasto/corte no validan los montos → valores negativos o no numéricos corrompen datos financieros e inventario
Los writes financieros directos solo chequean **presencia** (truthy), no tipo ni
signo:
- `createGasto` / `updateGasto`: `monto` se valida con `!monto`. Un `monto`
  **negativo** pasa y se guarda (infla el balance al restar un gasto negativo); y
  paradójicamente un `monto = 0` legítimo se **rechaza** (0 es falsy).
- `createVenta` / `updateVenta`: `cantidad` y `precio_unitario` solo truthy. Una
  `cantidad` **negativa** pasa el check, **aumenta** el stock (`stock - (-n)`) y
  registra una venta de cantidad negativa; un `precio_unitario` negativo registra
  ingreso negativo.
- `createCorte`: solo valida `precio === undefined`, no el signo.

Contrasta con `completarTurno`, que sí valida. Requiere estar autenticado
(operativo/admin), así que el vector principal es un **error de tipeo** que
corrompe silenciosamente planillas/balances, o un empleado que quiera falsear
reportes. **Fix:** un validador numérico central (`Number.isFinite` + `>= 0`)
aplicado a todos los writes financieros; de paso arregla el rechazo de 0.

> **RESUELTO (tanda 1):** creado `backend/src/utils/validarNumero.js`
> (`esMontoValido`: finito `>= 0`; `esCantidadValida`: entero `>= 1`; ambos
> aceptan string numérico porque los NUMERIC de pg viajan como string y el
> front los reenvía crudos). Aplicado en `createVenta`, `updateVenta`,
> `createGasto`, `updateGasto` y `createCorte` (incluida `propina` opcional),
> reemplazando los guards truthy. Verificado con 20 casos vía `node -e`.

#### 6.2 [MEDIO] Los paths de edición/borrado hacen updates de stock multi-paso sin compensación → estado parcial si falla a mitad
`updateVenta` ejecuta **3 escrituras secuenciales** (restaurar stock viejo →
actualizar la fila de venta → descontar stock nuevo). Si una intermedia falla, no
hay rollback ni cleanup: p. ej. el stock viejo ya se restauró (+) pero la venta
no se actualizó y el descuento nuevo no ocurrió → stock inflado e inconsistente.
`createVenta` sí tiene cleanup compensatorio; `updateVenta`, `deleteVenta` y
`caja.eliminarMovimiento` **no**. Es un patrón sistémico (mismo esquema en
`eliminarMovimiento`: borra corte → revierte turno; restaura stock → borra venta).
Además se compone con el doble-apply del retry (4.2): cada UPDATE relativo puede
aplicarse dos veces ante un blip.

Con la restricción de "sin transacciones" (PgBouncer, §6 convenciones) la
atomicidad total es difícil, pero como mínimo estos paths deberían: (a) espejar el
cleanup compensatorio de `createVenta`, y (b) reducir la aritmética de stock a la
menor cantidad de sentencias posible. A futuro, evaluar mover estas operaciones a
una función almacenada (atomicidad del lado del server, compatible con el pooler).

> **RESUELTO (tanda 5):** creado `backend/src/utils/stock.js` con
> `aplicarMutacionesStock(mutaciones)`: aplica ajustes relativos de stock
> (`{producto_id, delta}`) en secuencia, auto-revierte (best-effort, logueado) si
> una mutación falla a mitad, y devuelve un revertidor para que el llamador
> compense si un paso posterior (la fila de venta/corte) falla. Patrón de diseño:
> **la fila se escribe último** y las mutaciones de stock se revierten con el delta
> inverso conocido → nunca hay que reconstruir la fila para compensar. Aplicado en:
> - `createVenta` — el descuento pasa por el helper (unifica + hereda no-reintento
>   de 4.2); su cleanup (DELETE de la venta insertada) queda como el catch externo.
> - `updateVenta` — **colapso de escrituras**: mismo producto → 1 UPDATE por el
>   delta neto (`cantidadVieja − cantidad`), o cero si no cambió la cantidad, en vez
>   de restaurar+redescontar. Producto distinto → 2 mutaciones. La fila de venta se
>   escribe al final y se compensa el stock si falla.
> - `deleteVenta` y `caja.eliminarMovimiento` (rama venta) — restaurar stock
>   primero, borrar después; compensa el restore si el DELETE falla.
> - `caja.eliminarMovimiento` (rama corte) — **reordenada**: revierte el turno
>   primero, borra el corte después; si el DELETE falla, devuelve el turno a
>   'completado' (compensación inline, no usa el helper de stock porque no es stock).
>
> Verificado en frío con `node --check` en los 4 archivos. El flujo HTTP real no se
> ejercitó (requiere bootear); los caminos de fallo/compensación se razonaron paso
> a paso. La función almacenada (atomicidad dura del lado server) sigue como mejora
> a futuro — requiere cambio de schema, fuera de esta tanda (una sola DB de prod).

#### 6.3 [BAJO] Guardas `!monto` / `!cantidad` rechazan 0 pero aceptan negativos
Smell de lógica, subconjunto de 6.1: `if (!monto)` trata `0` como "faltante". Se
resuelve con el mismo validador numérico central.

> **RESUELTO (tanda 1):** cerrado junto con 6.1 — el validador central acepta
> `0` como monto legítimo y rechaza negativos/no-números.

**Prioridad de ataque en esta fase:** 6.1 primero (integridad de datos con vector
accidental muy plausible), 6.2 después (consistencia de stock; se entrelaza con
4.2). Ambos se resuelven bien centralizando: un validador de montos y un helper de
mutación de stock con compensación.

---

## Fase 7 — Frontends (los tres + landing)

### Verificado correcto
- **Sin sinks de XSS:** cero usos de `dangerouslySetInnerHTML`, `innerHTML`,
  `eval` o `new Function` en todo el código. React escapa por defecto → el
  `nombre` de cliente sin sanitizar (3.2) es **seguro** al renderizarse en el
  panel/app. El escape del mailer (Fase 3) cubre el canal de email. No hay
  vector de XSS almacenado.
- **Landing limpio:** `frontend-landing` depende solo de `react`, `react-dom` y
  `lucide-react` → **0 vulnerabilidades** de runtime (cierra el pendiente 5.5).
- **401 del operativo bien manejado:** `apiFetchOperativo` intercepta el 401,
  limpia el token y dispara el callback de redirección al login.
- **Degradación de `localStorage`:** todos los accesos van envueltos en
  `try/catch` (modo privado / storage deshabilitado no rompe la app).

### Hallazgos

#### 7.1 [MEDIO] `apiFetch` (admin) y la app barbero no manejan el 401 → sesión "colgada" y bloquea la revocación de 1.1
Solo `apiFetchOperativo` reacciona al 401. El `apiFetch` del panel admin
(`frontend/src/services/api.js`) devuelve el 401 crudo y cada caller lo trata como
un error genérico (`throw new Error('Error al obtener…')`); la app barbero
(`frontend-barbero`) tampoco tiene manejo de 401 (solo 409). Consecuencias:
- **UX:** si el JWT admin/barbero expira (30 días) o es rechazado, el usuario
  queda "logueado" (token en memoria/localStorage) pero **toda acción falla** con
  errores sueltos, sin redirección limpia al login.
- **Bloquea 1.1:** el fix de revocación de sesión de barbero/admin (hallazgo
  CRÍTICO/ALTO 1.1) **depende** de que el frontend maneje el 401 resultante. Hoy
  no lo hace → un token revocado no mandaría al login, solo rompería la pantalla.

**Fix:** centralizar el manejo de 401 en `apiFetch` y en el wrapper de la app
barbero, con el mismo patrón que `apiFetchOperativo` (limpiar token + callback de
redirección). Es prerequisito natural del fix de 1.1.

> **RESUELTO (tanda 3):** mismo patrón que `apiFetchOperativo` en ambos fronts.
> Panel de gestión: `apiFetch` intercepta el 401, limpia `authToken` y dispara
> el callback registrado con `setOnUnauthorizedAdmin`; `App.jsx` resetea el
> estado del panel (token, rol, barberoSesion) y vuelve a la pantalla de login
> del panel. Cubre tanto al admin como al barbero que entra al panel por PIN
> (comparten `apiFetch`). App barbero: ídem con `setOnUnauthorized`; ahí el
> token vive solo en memoria (useState + módulo — **no** en localStorage, la
> nota de 7.3 es inexacta en ese punto), así que la limpieza es de estado y
> React renderiza el Login. Comportamiento en vivo pendiente de smoke-test.

#### 7.2 [BAJO — ya documentado] Divergencia en la extracción de subdominio (panel de gestión)
`frontend/src/services/api.js` usa la heurística vieja `partes.length >= 3 ?
partes[0] : undefined`, mientras turnero/barbero usan
`hostname.endsWith('.barbermanager.app')`. Ya está en `estado_actual.md`. Impacto
solo en dev local (una IP `192.168.x` computa `subdominio = '192'`). Cross-ref, no
hallazgo nuevo. En producción ambas heurísticas coinciden.

#### 7.3 [BAJO — nota de diseño] Tokens en `localStorage`
Los tokens operativo y barbero viven en `localStorage` (decisión documentada:
sobrevivir al reload del iPad). Es aceptable **hoy** porque no hay ningún sink de
XSS (ver arriba), pero implica un acoplamiento: cualquier XSS futuro = robo total
del token (a diferencia de una cookie `httpOnly`). **Mantener la propiedad
"sin sinks de XSS"** es lo que sostiene la seguridad de esta decisión — vigilar
que no se introduzca `dangerouslySetInnerHTML` ni scripts de terceros sin control.

**Prioridad de ataque en esta fase:** 7.1 (hacerlo junto con 1.1, es su
prerequisito de frontend); 7.2 y 7.3 quedan como cross-refs de bajo riesgo.
