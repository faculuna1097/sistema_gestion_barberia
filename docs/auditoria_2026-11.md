# Auditoría de seguridad y calidad — 2026-11

> **Estado (2026-11-17): en curso.** Zonas 1 a 5 revisadas; el resto, pendiente o en curso (ver la tabla de zonas).
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
| 1 | Autenticación, sesiones y recuperación | `fef2fd0` | Revisada | 0 | 2 | 1 | 5 |
| 2 | Aislamiento entre tenants y permisos por rol | `cb87b60` | Revisada | 0 | 0 | 1 | 3 |
| 3 | Superficie pública: turnero, alta y mails | `cb87b60` | Revisada | 0 | 1 | 1 | 4 |
| 4 | Plata: caja, planillas, balances y stock | `1e148fb` | Revisada | 0 | 0 | 4 | 6 |
| 5 | Agenda, turnos y concurrencia | `dd99386` | Revisada | 0 | 0 | 2 | 7 |
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

**Commit auditado:** `fef2fd0` (`feature/mejoras-operativas`), 2026-11-16. Solo lectura: código, docs y la DB
con el rol `resguardo_lectura`. No se escribió nada en demo ni se hicieron pedidos a producción. Lo único que
se ejecutó fuera de la lectura fue una prueba local de la librería `bcrypt` (sin base ni servidor), para
confirmar Z1-04.

**Resumen:** 8 hallazgos (0 críticos, 2 altos, 1 medio, 5 bajos). Z1-01 (alto) y Z1-02 (medio) están solo en
el branch (son de la recuperación por mail, F6): conviene arreglarlos antes del merge. Z1-03 (alto) está en
producción.

**Revisión del orquestador (2026-11-16):** Z1-01 se confirmó leyendo el camino completo (`index.js`,
`limiterLogin`, `solicitarRecuperacion`, `emitirToken`). De los demás se revisaron contra el código Z1-02,
Z1-03 y Z1-07. No se sacó ninguno; Z1-03 subió de medio a alto. Lo que cerró julio
sigue cerrado (detalle en "Verificado correcto").

**Cruce con Z2-02 y Z3-06** (pedido por el orquestador):

- **Z2-02** (`X-Tenant-Subdomain: constructor`) no cambia nada en esta zona. Con `tenant_id` indefinido, los
  tres logins responden su 401 genérico (la query por `id = NULL` no trae filas), `solicitar` responde 404,
  `validar` y `usar` no encuentran el token, y `verificarToken` responde 403. `invalidar('constructor')` no
  borra nada. Los intentos sí cuentan en el límite de logins, como cualquier fallo.
- **Z3-06** (`booking_url` con `javascript:`) sí cambia algo: es un sink de XSS en el origen del panel, y la
  decisión de julio (7.3) de dejar el token operativo en `localStorage` valía "mientras no haya sinks". Desde
  F5 pesa más, por dos motivos. Uno: en ese mismo origen ahora también se guarda la sesión del barbero por
  30 días (`barbero_sesion`), porque el panel, el turnero y la app del barbero se sirven desde el mismo host
  (`frontend/vercel.json`, rewrites de `/turnos` y `/barbero`) y comparten `localStorage`. Dos: el script se
  abre con `window.open` sin `noopener`, así que puede tocar la página del panel que lo abrió y leer el PIN
  de admin cuando alguien lo tipee en el iPad; con el PIN, desde F6, se cambia el mail de recuperación
  (Z1-02). No sube la severidad de Z3-06 (lo sigue pudiendo escribir solo un admin), pero es un motivo más
  para arreglarlo antes del merge. Sin confirmar: que Safari del iPad ejecute un `javascript:` pasado a
  `window.open` (no se probó).

### Hallazgos

#### Z1-01 [ALTO] Pedir el link de recuperación no tiene límite por IP: mails al dueño cada 2 minutos y la cuota de Resend agotada para todos

- **Dónde:** `backend/src/index.js:234-237` (`/api/auth/recuperar` con `limiterLogin`),
  `backend/src/middlewares/rateLimitMiddleware.js:79-85` (`skipSuccessfulRequests: true`),
  `backend/src/controllers/authRecuperar.js:74-122` (`solicitarRecuperacion`) y
  `backend/src/services/recuperacionService.js:104-128` (`emitirToken`, freno de 2 minutos). Ruta:
  `POST /api/auth/recuperar/solicitar`. Pantallas: "¿Olvidaste tu contraseña?" y "¿Olvidaste tu PIN?".
- **Alcance:** solo en el branch (`authRecuperar.js` y `recuperacionService.js` no existen en `main`).
- **Qué pasa:** `limiterLogin` cuenta solo las respuestas fallidas, y `solicitar` responde siempre 200. O sea
  que ese endpoint, en la práctica, no tiene límite por IP (el comentario de `index.js:235-236` lo dice: el
  único freno es el de 2 minutos por local y por tipo). Un anónimo, con un script y sabiendo solo el
  subdominio (que es público), puede:
  1. **Llenarle la casilla al dueño:** un mail cada 2 minutos por tipo, dos tipos: 60 mails por hora por
     local, sin fin, desde el dominio autenticado y con el nombre del local.
  2. **Agotar la cuota de Resend de todos los locales:** con los 3 locales activos que hoy tienen mail
     cargado son 180 mails por hora. El plan gratuito tiene un tope diario compartido (Z3-01): se agota en
     menos de una hora, y ese día no salen confirmaciones, recordatorios ni links de recuperación de ningún
     local. Cada mail que falla es un `console.error` que va a Sentry. Con un solo local alcanza: tarda algo
     menos de dos horas.
  3. **Acortar el link del dueño:** cada link nuevo anula los anteriores sin usar. Si el atacante pide uno
     apenas termina el freno, el link que el dueño acaba de recibir deja de servir a los 2 minutos (le llega
     otro, pero tiene que usar siempre el último).
- **Evidencia:** leído. Camino: `index.js:106` (`limiterGlobal`, 300 por minuto) → `index.js:237`
  (`limiterLogin`) → `solicitarRecuperacion` → `emitirToken` → `enviarRecuperacion` (`mailer.js:585`). En
  `express-rate-limit` 8.6.0, con `skipSuccessfulRequests` el contador se descuenta cuando la respuesta
  termina con status menor a 400 (`requestWasSuccessful`). Consultado en la DB: 4 tenants activos, 3 con
  `email_duenio`. Sin confirmar: el número exacto del tope diario de Resend.
- **Arreglo propuesto** (chico):
  1. Un limiter propio para `solicitar`, que cuente todos los pedidos (por ejemplo, 5 por hora por IP).
  2. Un tope por local que no dependa de la IP: en `emitirToken`, además del freno de 2 minutos, no emitir
     si ya hay N links de ese tenant en las últimas 24 horas (por ejemplo, 6 entre los dos tipos). Es una
     condición más en la misma sentencia y usa el índice que ya existe.
  3. Subir el freno entre mails de 2 a 10 minutos.

  Recomendado: 1 y 2 antes del merge. El 2 es el que importa mientras siga abierta la deuda de `trust proxy`
  (el cupo por IP se comparte y se puede repartir). El punto 3 de "Qué pasa" queda cubierto con el 2.
- **Novedad:** nuevo. Misma familia que Z3-01 (mails sin tope desde un endpoint público), más lento: Z3-01
  agota la cuota en un minuto y este en una hora.

#### Z1-02 [MEDIO] Cambiar el mail del dueño no avisa a nadie: quien tuvo el PIN una vez se queda con la recuperación

- **Dónde:** `backend/src/controllers/gestion.js:518-555` (`editarContactoNegocio`,
  `PUT /api/admin/negocio/contacto`). Pantalla: Gestión → Negocio → Contacto.
- **Alcance:** solo en el branch (el endpoint y la recuperación son de F6).
- **Qué pasa:** el cambio está bien protegido (solo rol admin y pide el PIN de admin otra vez), pero es
  silencioso. Alguien que supo el PIN de admin alguna vez (un encargado, un ex socio, un barbero que lo vio
  tipear en el iPad) pone su propio mail como mail del dueño. Nadie recibe un aviso. Desde ese momento puede
  pedir "¿Olvidaste tu PIN?" o "¿Olvidaste tu contraseña?" cuando quiera y elegir credenciales nuevas, aunque
  el dueño ya haya cambiado el PIN. Antes de F6, cambiar el PIN alcanzaba para dejar afuera a un intruso;
  ahora no, y el dueño solo se entera si abre Gestión → Negocio y mira el mail. Además:
  - Los links ya emitidos siguen sirviendo hasta 1 hora después de cambiar el mail (y también después de
    cambiar el PIN desde Gestión → Seguridad): nada los anula.
  - Cambiar el PIN o la contraseña del iPad tampoco avisa al mail del dueño.
- **Evidencia:** leído. `index.js:303` (`verificarToken`, `requiereRol('admin')`) →
  `editarContactoNegocio` → `verificarPinAdmin` → `UPDATE tenant SET email_duenio …`. No hay envío de mail ni
  escritura sobre `token_recuperacion` en ese camino, ni en `cambiarPinAdmin` (`gestion.js:610`) ni en
  `actualizarCredencialesOperativas`.
- **Arreglo propuesto** (chico; medio con el aviso de credenciales):
  1. Al cambiar `email_duenio`, mandar un aviso al mail **anterior** ("El mail de recuperación de {local}
     cambió. Si no fuiste vos, escribinos"), con el mailer que ya existe.
  2. En el mismo cambio, anular los links pendientes del tenant (`vence_en = now()`).
  3. Opcional: avisar también al mail del dueño cuando cambia el PIN de admin o la contraseña del iPad, y
     anular los links pendientes de ese tipo.

  Recomendado: 1 y 2 antes del merge; 3 en la tanda de deudas.
- **Novedad:** nuevo.

#### Z1-03 [ALTO] El PIN de admin (4 dígitos) se puede adivinar desde internet en días: el único freno es por IP

- **Severidad (revisada por el orquestador):** sube de medio a alto. El resultado es que un anónimo toma la
  cuenta de admin de un local, y el único freno (el cupo por IP) hoy no se cumple por la deuda de
  `trust proxy`. No llega a crítico porque necesita días de intentos sostenidos y no pasa en silencio: cada
  corte del límite de logins manda un aviso a Sentry y a Discord (`crearHandler429`), así que un ataque así
  se ve desde el primer día.
- **Dónde:** `backend/src/controllers/authPanel.js:34-119` (`POST /api/auth/panel/login`) y
  `backend/src/middlewares/rateLimitMiddleware.js:79-85`. Vale igual para `POST /api/auth/barbero/login`.
- **Alcance:** en producción (los logins y el limiter no cambiaron respecto de `main`).
- **Qué pasa:** el login del panel es público y pide solo el PIN. El freno es de 10 fallos cada 15 minutos
  por IP: 960 intentos por día. Con 10.000 combinaciones, una sola IP encuentra el PIN de admin en 10 días
  como mucho (5 en promedio), y como cada intento se compara contra el admin y contra todos los barberos
  activos, el PIN de algún barbero cae antes (en el local más grande, 5 PIN en juego: uno cada 2 días). Con
  varias IP el tiempo se divide. No hay ningún contador por local ni bloqueo progresivo: el local no se
  entera, y el aviso de Sentry por el límite de logins llega al celular de Facundo, no al dueño.

  La auditoría de julio (1.2) dio esto por resuelto con esa misma cuenta ("~10 días por IP"). Dos cosas lo
  empeoraron desde entonces: la deuda de `trust proxy` (el cupo por IP hoy no se atribuye bien y se puede
  repartir entre nodos de Railway), y F6, que le da más valor al PIN: con él se cambia el mail de
  recuperación y la cuenta queda tomada aunque después cambien el PIN (Z1-02).
- **Evidencia:** leído (`index.js:233` → `limiterLogin` → `loginPanel`: una comparación `bcrypt` contra el
  admin y una por barbero activo). Consultado en la DB: los 4 tenants activos tienen entre 2 y 4 barberos
  activos. No se probó contra producción.
- **Arreglo propuesto** (medio). Opciones:
  1. **PIN de admin más largo** (6 dígitos): un millón de combinaciones, casi 3 años por IP con el límite
     actual. No agrega forma de bloquearle el login a un local. Toca el login unificado (hoy asume 4 dígitos
     para todos), la validación, las dos pantallas de PIN y hay que pedirle a cada dueño que lo cambie.
  2. **Contador de fallos por local**, con espera creciente y aviso al mail del dueño. Frena también el
     ataque repartido entre IP, pero le deja a un anónimo una forma de trabarle el login por PIN a un local
     (el iPad sigue andando: su sesión ya está abierta).
  3. Arreglar `trust proxy` (ya anotado en Pendientes) y dejar el resto como está.

  Recomendado: 3 ya, porque hoy el límite por IP ni siquiera se cumple, y 1 para el PIN de admin. El de los
  barberos puede seguir en 4 dígitos: ve y toca solo lo suyo.
- **Novedad:** agrava el hallazgo 1.2 de julio (cerrado) y la deuda de `trust proxy` de `estado_actual.md` →
  Pendientes.

#### Z1-04 [BAJO] Un PIN o una contraseña que no es texto, o un `barbero_id` mal formado, dan 500 y un aviso de Sentry

- **Dónde:** `backend/src/controllers/authPanel.js:38` y `:58`, `authBarbero.js:28`, `:33-38` y `:47`,
  `authOperativo.js:31` y `:61`. Rutas: los tres `POST /api/auth/*/login`.
- **Alcance:** en producción (los tres archivos son iguales en `main`).
- **Qué pasa:** los logins chequean que el dato venga (`!pin`), no que sea texto. Un anónimo manda
  `{"pin": 1234}` (número, sin comillas): `bcrypt.compare` tira "data and hash must be strings", el `catch`
  hace `console.error`, responde 500 y Sentry avisa por Discord. Lo mismo con `password` numérica en el login
  del iPad. En el login del barbero, además, `barbero_id` va a la query sin pasar por `esUUID`: cualquier
  texto que no sea un UUID da el error `22P02` de Postgres y otro 500 (la convención de §2 pide validarlo
  antes). Está acotado por el límite de logins (un 500 cuenta como fallo: 10 cada 15 minutos por IP), pero
  son alertas falsas al celular, y cada una le gasta cupo de login a quien comparta esa IP.
- **Evidencia:** leído, y probado en local solo con la librería (`bcrypt` 6.0.0: `compare` con un número, un
  objeto, un array o `true` rechaza la promesa; con un hash mal formado devuelve `false`). El `22P02` del
  `barbero_id` no se reprodujo: es el caso que describe `convenciones_tecnicas.md` §2.
- **Arreglo propuesto** (chico): en los tres logins, 400 si `pin`, `usuario` o `password` no son `string`, y
  en `loginBarbero`, el 401 genérico si `barbero_id` no pasa `esUUID`. Lo mismo, de paso, en `crearBarbero`,
  `editarBarbero` y `cambiarPinAdmin` (`gestion.js:99`, `:165` y `:616`): el `/^\d{4}$/.test(pin)` acepta el
  número 1234 y después `bcrypt` tira. Esos tres son solo de admin.
- **Novedad:** nuevo.
- **Amplía Z3-02** (el byte nulo): en esta zona, el único campo de un login o de la recuperación que llega
  crudo a Postgres es ese `barbero_id` (cualquier texto que no sea UUID, con o sin `\u0000`, da 500). El PIN,
  el usuario y la contraseña del iPad no llegan a la base (van a `bcrypt` o a un `===`; un PIN con `\u0000`
  devuelve `false`, probado). En la recuperación, `token` y `tipo` se validan antes de la query, y `nueva`
  se guarda ya hasheada. El middleware global que propone Z3-02 cubre el caso del `barbero_id` con nulo,
  pero no el del UUID mal formado ni el del tipo.

#### Z1-05 [BAJO] El mail del dueño, a medio tapar, se le entrega a cualquiera que lo pida

- **Dónde:** `backend/src/services/recuperacionService.js:58-64` (`enmascararEmail`) y
  `backend/src/controllers/authRecuperar.js:93-117`. Ruta: `POST /api/auth/recuperar/solicitar`.
- **Alcance:** solo en el branch.
- **Qué pasa:** la respuesta trae las dos primeras letras del mail del dueño y el dominio entero
  (`fa•••@gmail.com`), sin pedir nada a cambio: alcanza con el subdominio. Con un mail de Gmail es poco. Con
  un dominio propio (`juan@mibarberia.com`) es casi el mail completo. Sirve para apuntarle un phishing al
  dueño: el atacante sabe a qué proveedor escribirle y puede disparar un mail real de recuperación justo
  antes de mandar el suyo. Además, `{ enviado: false }` le dice a cualquiera qué locales no tienen mail
  cargado. Que un local exista no es dato nuevo (el turnero ya lo confirma).
- **Evidencia:** leído, y consultado en la DB: hoy 0 de los 3 mails cargados son de dominio propio y ninguno
  tiene un usuario de 4 letras o menos.
- **Arreglo propuesto** (chico): tapar también el dominio (`fa•••@g•••.com`). El dueño reconoce su mail
  igual. La respuesta sin mail (`enviado: false`) puede quedar: la pantalla la necesita para decirle a quién
  escribirle.
- **Novedad:** nuevo. Responde la nota de las zonas 2 y 3.

#### Z1-06 [BAJO] La app del barbero deja la sesión guardada 30 días sin preguntar, también en un dispositivo compartido

- **Dónde:** `frontend-barbero/src/utils/sesion.js:79-88` (`guardarSesion`) y `frontend-barbero/src/App.jsx:152`
  (`onLogin`) y `:165` (`cerrarSesion`). Pantalla: login de la app del barbero.
- **Alcance:** solo en el branch (`sesion.js` no existe en `main`: ahí la sesión vive en memoria).
- **Qué pasa:** después del PIN la sesión queda en `localStorage` por 30 días, siempre. Un barbero que entra
  a `/barbero` desde el iPad del local, la compu del mostrador o el celular de un compañero deja su sesión
  abierta ahí, salvo que se acuerde de tocar "Cerrar sesión": el que agarre ese dispositivo ve su agenda (con
  nombre, mail y teléfono de sus clientes) y su planilla, y puede cancelarle turnos o marcarle descansos.
  Para el panel el proyecto ya decidió lo contrario por este mismo motivo ("el token del panel sigue en
  memoria: el iPad es compartido"). Aparte, "Cerrar sesión" borra el token del dispositivo pero no lo
  revoca: ante un celular perdido, lo único que corta la sesión es que el dueño le cambie el PIN o lo
  desactive, y eso no está dicho en ninguna pantalla.
- **Evidencia:** leído (`Login` → `onLogin` → `guardarSesion`; `leerSesion` al cargar el módulo; el 401 y
  "Cerrar sesión" llaman a `borrarSesion`). La revocación del lado del servidor sí funciona (ver "Verificado
  correcto").
- **Arreglo propuesto** (chico): una casilla "Mantener la sesión en este celular" en el login (marcada por
  defecto si se quiere conservar la comodidad), y una línea en `onboarding.md` o en Gestión → Barberos:
  "si un barbero pierde el celular, cambiale el PIN". Como la app todavía no tiene usuarios, se puede decidir
  sin cuidar costumbres.
- **Novedad:** nuevo. Es un caso que no cubre la deuda ya anotada del token en `localStorage` (esa habla de
  XSS, no del dispositivo compartido).

#### Z1-07 [BAJO] La confirmación con el PIN de admin no tiene tope de intentos

- **Dónde:** `backend/src/utils/pin.js:41-46` (`verificarPinAdmin`), usado en `gestion.js:530` (contacto),
  `gestion.js:622` (cambio de PIN) y `adminOperativo.js:105` (credenciales del iPad). Rutas:
  `PUT /api/admin/negocio/contacto`, `/api/admin/negocio/pin-admin` y `/api/admin/operativo/credenciales`.
- **Alcance:** en producción para el cambio de PIN y las credenciales del iPad (en `main` responden 401 en
  vez de 403, con la misma falta de límite); solo en el branch para el contacto.
- **Qué pasa:** esos tres endpoints piden el PIN otra vez para que una sesión de admin abierta no alcance
  para cambiar credenciales. Pero un PIN incorrecto responde 403 todas las veces que haga falta: el único
  freno es el global de 300 pedidos por minuto, y con eso los 10.000 PIN se prueban en media hora. Quien
  tenga una sesión de admin pero no el PIN (el panel quedó abierto en una compu y copia el token desde las
  herramientas del navegador, o un script inyectado por Z3-06) saca el PIN, y con el PIN se queda con la
  cuenta (Z1-02). Desde el iPad, a mano, no es practicable.
- **Evidencia:** leído (`index.js:303` y `:305` montan los routers solo con `verificarToken` y
  `requiereRol('admin')`).
- **Arreglo propuesto** (chico): un limiter para esos tres `PUT` que cuente los 403 (por ejemplo, 5 fallos
  cada 15 minutos por IP), o cerrar la sesión de admin al tercer PIN de confirmación incorrecto.
  Recomendado: el limiter.
- **Novedad:** nuevo.

#### Z1-08 [BAJO] El bloqueo por suscripción vencida se chequea solo al entrar

- **Dónde:** `backend/src/controllers/authPanel.js:60-66` (el único uso de `evaluarSuscripcion`) y
  `backend/src/middlewares/authMiddleware.js` (no la mira).
- **Alcance:** en producción.
- **Qué pasa:** el 402 sale únicamente en el login del admin. Un token de admin ya emitido sigue sirviendo
  en toda la API hasta que vence (30 días) o hasta que se recarga la página. Un dueño que entra el día 10
  (con el aviso amarillo) y no cierra esa pestaña sigue usando el panel completo pasado el día 11, hasta un
  mes. No expone datos de nadie: es un límite comercial que se puede esquivar sin querer. El chequeo no
  filtra nada antes del PIN (el 402 sale solo después de que el PIN de admin coincidió) y no bloquea al
  barbero ni al iPad, como está decidido.
- **Evidencia:** leído (`grep` de `evaluarSuscripcion`: un solo uso).
- **Arreglo propuesto** (medio): guardar `suscripcion_vigente_hasta` en la entrada del caché del tenant y
  evaluarla en `verificarToken` para el rol admin (402, que el front ya sabe mostrar en el login; habría que
  manejarlo en `apiFetch`). Ojo con el caché: renovar la suscripción por SQL pediría invalidarlo, igual que
  una baja. Alternativa más simple: aceptarlo y anotarlo en "Lógica de suscripción".
  Recomendado: aceptarlo y anotarlo, salvo que aparezca un caso real.
- **Novedad:** nuevo (el doc dice "bloqueo total del panel" sin esta salvedad).

### Verificado correcto

**Lo que cerró julio y sigue cerrado**

- **1.1, revocación por `tv`:** los tres logins firman con `tv`; `verificarToken` lo compara en los tres
  roles (admin y operativo contra el caché del tenant, barbero con su query, que además corta si quedó
  inactivo). `editarBarbero` sube `token_version` al cambiar el PIN y al desactivar; `cambiarPinAdmin` y el
  cambio de contraseña del iPad suben la suya en el mismo `UPDATE`.
- **1.1, 401 contra 500:** la firma y el vencimiento dan 401 sin tocar la DB; una falla de la consulta de
  revocación da 500 y no cierra la sesión. `tenantMiddleware` también responde 500 ante una falla de la DB.
- **1.2, `limiterLogin`:** montado en los cuatro routers de `/api/auth` (`index.js:230-237`), con un contador
  compartido. Lo que no cubre es `solicitar` (Z1-01).
- **1.3 y 1.4, JWT:** `config/jwt.js` es el único que lee `JWT_SECRET`, fija HS256 al firmar y al verificar,
  y en producción no arranca sin el secreto. Ningún otro archivo llama a `jsonwebtoken`.
- **Mensajes genéricos:** cada login responde lo mismo en todos sus caminos de fallo ("PIN incorrecto",
  "Usuario o PIN incorrecto", "Credenciales inválidas"), también con tenant inactivo o sin credenciales.
- **7.1, el 401 en los fronts:** `apiFetch` del panel y de la app del barbero limpian el token y vuelven al
  login; la app del barbero además borra la sesión guardada.
- **Aislamiento del token:** `verificarToken` cruza el tenant del token con el del subdominio (403).

**Recuperación por mail (F6)**

- **Token:** 32 bytes de `crypto.randomBytes` en base64url. En la DB se guarda solo el SHA-256
  (`token_hash`, `UNIQUE`). Consultado: 2 filas, las dos usadas, 0 vigentes, todas con hash de 64 caracteres;
  la tabla tiene RLS y ninguna policy.
- **Vencimiento y un solo uso:** vence a la hora (default de la columna, con el reloj de la base). `usarToken`
  marca el token y cambia la credencial en una sola sentencia, con `usado_en IS NULL AND vence_en > now()` en
  el `WHERE`: dos pedidos a la vez con el mismo link no pasan los dos. `validar` no lo consume, así que el
  lector de links de un cliente de mail no lo gasta. Un link nuevo anula los anteriores del mismo tipo.
- **Atado al tenant:** las tres queries filtran por `tenant_id` además del hash; un link de un local no sirve
  en el subdominio de otro, y responde lo mismo que uno vencido o usado.
- **Sesiones:** usar el link sube `admin_token_version` u `operativo_token_version` en la misma sentencia y
  después invalida el caché: las sesiones de ese rol quedan cerradas en el pedido siguiente.
- **A qué mail va:** a `tenant.email_duenio`, leído en el momento. No hay ningún dato del pedido que elija el
  destino. Sin mail cargado no se genera nada.
- **Quién cambia ese mail y el celular:** solo el rol admin (`requiereRol('admin')` en `/api/admin/negocio`),
  y además con el PIN de admin en el body. Un barbero o el token del iPad reciben 403. El `GET` público
  (`/api/negocio`) no los devuelve: el de admin es otro handler. Lo que falta es el aviso (Z1-02).
- **El link:** el host se arma con el header de subdominio, que ya tuvo que coincidir exacto con un tenant
  activo; en producción no hay `TENANT_ID` de respaldo. No se puede apuntar a otro dominio.
- **El fragmento `#recuperar=`:** el navegador no lo manda al servidor, así que no queda en los logs de
  Vercel. `App.jsx:57-66` lo lee al cargar el módulo y lo saca de la URL con `replaceState`. El panel no
  carga scripts de terceros ni tiene Sentry en el front. Al backend viaja en el body, y el log de acceso tapa
  `token` y `nueva`; los logs del controller llevan solo el tenant y el tipo; a Sentry no va el body. Los
  `console.error` del front escriben el mensaje y el status, no el token.
- **Inyección en el mail:** el asunto es fijo; el nombre del local, el usuario del iPad y el link pasan por
  el escape del HTML (lo revisó la zona 3); el envío es un JSON a Resend, sin cabeceras armadas a mano.
- **Unicidad en la recuperación del PIN:** el PIN nuevo se compara contra todos los barberos (activos e
  inactivos) y un choque da 409 sin gastar el link. Poder repetir el PIN anterior del admin es una decisión.
- **Fuerza bruta del token:** 256 bits; `validar` y `usar` con un token que no sirve dan 400, que sí cuenta
  en `limiterLogin`.

**PIN, login unificado y suscripción**

- **Unicidad de PIN:** la validan todos los caminos que escriben un PIN: `crearBarbero`, `editarBarbero`,
  `cambiarPinAdmin`, la recuperación y el alta (`armarQuery.mjs:127-129` rechaza PIN repetidos entre el admin
  y los barberos). El login resuelve primero el admin, y ante más de un barbero con el mismo PIN responde 401
  sin elegir. No se puede comprobar en la DB si hoy hay PIN repetidos sin probar PIN contra los hashes, y eso
  no se hizo.
- **Hashes:** los 5 `pin_admin` y las contraseñas del iPad son bcrypt de costo 10. De 22 barberos, 20
  también; los otros 2 son barberos inactivos de demo con un texto de 1 carácter en `pin`, que `bcrypt`
  rechaza siempre (probado: devuelve `false`, no tira).
- **Tiempos de respuesta:** un PIN que no es de nadie recorre siempre al admin y a todos los barberos; el
  login del iPad compara la contraseña aunque el usuario no coincida. No se distingue "usuario existe" por
  tiempo. En el login del barbero, un `barbero_id` inexistente responde más rápido, pero la lista de
  barberos ya es pública.
- **Suscripción:** el 402 sale recién después de que el PIN de admin coincidió; con un PIN incorrecto no se
  sabe nada del estado del local. La salvedad está en Z1-08.

**Sesión del barbero (F5)**

- La sesión guardada es el mismo JWT de 30 días: cambiarle el PIN o desactivarlo la corta en el pedido
  siguiente (401, y la app borra lo guardado). `leerSesion` descarta una sesión vencida o mal formada.
- "El último barbero" es solo su id, que ya es público (`/api/turnero/barberos`).
- Cada subdominio es un origen distinto: lo guardado para un local no se lee desde otro.

**Caché del tenant**

- Los tres caminos que cambian una versión de token invalidan la entrada: `cambiarPinAdmin`, el cambio de
  contraseña del iPad y `usarRecuperacion`. Cambiar solo el usuario del iPad o el contacto del dueño no toca
  ninguna versión, así que no hace falta. La clave del caché es el header tal como llega, y solo un valor
  exacto resuelve a cada tenant, así que `invalidar` borra la entrada correcta.
- Lo que sigue igual y ya está anotado: el caché es por proceso (el hallazgo del 2026-11-13 en
  `plan_mejoras_operativas.md`) y una baja a mano pide reiniciar el servicio.

### Sin revisar

- No se reprodujo nada en demo: los ocho hallazgos se cerraron leyendo.
- El tope diario exacto de la cuenta de Resend (cambia en cuánto tarda Z1-01, no si pasa).
- Si Safari del iPad ejecuta un `javascript:` en `window.open` (es de Z3-06).
- De los fronts se leyó la lógica (tokens, almacenamiento, logs, manejo de 401 y 402), no el render completo
  de `PantallaRecuperacion`, `SolicitudRecuperacion`, `BloqueContacto` ni `TabSeguridad`.

### Para otra zona

- **Zona 6:** el panel, el turnero y la app del barbero comparten origen y `localStorage` (rewrites de
  `frontend/vercel.json`): un sink de XSS en cualquiera de los tres expone `token_operativo` y
  `barbero_sesion`. Sumarlo al criterio de la zona.
- **Zona 7:** el log de acceso escribe el `usuario` del login del iPad y el `barbero_id` de cada intento
  (`sanitizarObjeto` tapa solo las claves de su lista). Y `loginOperativo` registra los fallos con
  `console.log`, no con `console.warn` como pide la convención §1 para los eventos de seguridad
  (`authOperativo.js:46`, `:55` y `:64`).
- **Zona 8:** `POST /api/auth/recuperar/solicitar` hace dos queries por pedido y hoy solo lo frena el límite
  global (se arregla con Z1-01). Cada intento fallido del login del panel cuesta una comparación `bcrypt` por
  barbero activo más la del admin.
- **Docs (para el cierre de mejoras operativas):** `estado_actual.md` → "Caché del middleware" no nombra a la
  recuperación entre los caminos que invalidan; el comentario de cabecera de `authBarbero.js:9-11` dice que
  los PIN se repiten y que la lista sale de `GET /api/barberos`, y las dos cosas dejaron de ser ciertas; y
  el de `rateLimitMiddleware.js:70` habla de 3 endpoints de login (son 4 routers).

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
- **Cuota de Resend (confirmado por el usuario, 2026-11-16):** la cuenta está en el plan gratuito, con un tope
  diario de envíos compartido por todos los locales. Por este camino el tope se agota en menos de un minuto.
  Ojo al medir el arreglo: el límite de la reserva (10 por hora por IP) también deja pasar más mails por día
  que ese tope, así que los puntos 1 y 2 llevan reprogramar al mismo nivel que la reserva, no más abajo. Eso
  es la deuda diferida 4 de julio (anti-abuso del turnero), que con el plan gratuito pesa más de lo que se
  anotó.
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

Commit auditado: `1e148fb`. Todo lo que registra o calcula plata es igual en `main` y en el branch
(`git diff main...HEAD` sobre los controllers, services y utils de la zona solo muestra F7 en `gestion.js` y
`comision.js`, y cambios de texto en `FlujoCorte`, `SeccionPlanillas` y `MiPlanilla`): los diez hallazgos están
**en producción**. No se reprodujo nada en demo ni se escribió en la base; los datos salen de `consultar.js`
(2026-11-16).

**Resumen:** 0 críticos, 0 altos, 4 medios, 6 bajos. Lo central de la zona está bien: la comisión, las propinas,
los gastos y la ganancia salen de una sola fórmula en el backend y dan lo mismo en Planillas, MiPlanilla,
Balances (mensual e histórico) y los Excel. Lo que no coincide es el "facturado" del Inicio contra Balances
(Z4-03). En la base de un local real hay dos grupos de cortes viejos mal guardados (Z4-01 y Z4-02); ninguno se
puede generar hoy.

**Revisión del orquestador (2026-11-16):** sin críticos ni altos, se revisó una muestra. Contra la base: los 12
pares duplicados (Z4-01) y los 12 totales sin propina (Z4-02) de kingsaistudio. Contra el código: Z4-03
(`inicio.js` contra `balances.js`), Z4-04 (`createCorte` no compara el precio con el catálogo), Z4-06 y Z4-10.
No se sacó ninguno ni cambió ninguna severidad. Un dato que la sección no trae: la misma consulta de Z4-01
devuelve además 4 pares en demo, del 29 y 30 de octubre; son de pruebas y no cambian la conclusión.

### Hallazgos

#### Z4-01 [MEDIO] En kingsaistudio quedaron 12 cortes duplicados por doble toque, y siguen contando

- **Dónde:** tabla `corte` (datos). El camino que los generó ya no existe: `frontend/src/screens/flows/FlujoCorte.jsx`
  antes del rediseño del 2026-05-29 (`6d89c04`).
- **Alcance:** en producción (datos de kingsaistudio).
- **Qué pasa:** hay 12 pares de cortes iguales (mismo barbero, servicio, monto y forma de pago, los dos sin turno)
  cargados con entre 0 y 0,65 segundos de diferencia: 2 en abril, 9 en mayo y 1 en junio (el último, el 05/06).
  Nadie carga dos cortes en medio segundo: son dobles toques en "Confirmar". El segundo corte de cada par sigue
  en la base, así que esos 12 cobros están contados dos veces en Caja, Planillas y Balances de esos meses. En 6
  de los 12 el barbero tenía 100 % (no cambia la ganancia del local, sí los ingresos brutos); en los otros 6, la
  planilla de esa semana le sumó al barbero una comisión de más. Son 2 barberos.
- **Por qué no es alto:** la causa está cerrada. Desde el 05/06 no hay ningún par a menos de 6 segundos en los
  2.154 cortes posteriores (los pares de 6 a 60 segundos que sí hay, 228, son el ritmo normal de cargar varios
  cortes seguidos: cada uno pasa por los 6 pasos y los 2,5 s de la pantalla de éxito). En ventas y gastos no hay
  ningún par a menos de 10 segundos, en ningún tenant.
- **Evidencia:** consultado en la DB (self-join de `corte` por tenant, barbero, servicio, `monto_total` y
  `forma_pago`, con la diferencia de `timestamp`). El front de hoy: `disabled={enviando}` en los tres flujos
  (`FlujoCorte.jsx:385`, `FlujoVenta.jsx:253`, `FlujoGasto.jsx:235`) y la pantalla de éxito reemplaza al botón.
- **Arreglo propuesto** (chico, de datos, lo decide el dueño): listarle los 12 pares con día, hora, barbero y
  monto, y que confirme cuáles borrar desde Caja (o por SQL, uno de cada par). La consulta que los encuentra:
  cortes del mismo tenant, barbero, servicio, `monto_total` y `forma_pago` con menos de 3 segundos entre sí. De
  fondo, la deuda de la idempotency key sigue igual (ver Novedad).
- **Novedad:** nuevo como dato. Corrige el alcance de la deuda diferida 2 de julio ("idempotency keys para
  `turno`, `venta` y `gasto`"): el corte sin turno tampoco tiene clave y no figura en esa lista, y es el único
  de los tres que ya dejó duplicados reales.

#### Z4-02 [BAJO] 12 cortes de kingsaistudio tienen el total guardado sin la propina

- **Dónde:** tabla `corte`, columna `monto_total` (datos). Lo leen `backend/src/controllers/caja.js:53` y
  `backend/src/controllers/inicio.js:20`, `:41`, `:60`, `:103` y `:123`.
- **Alcance:** en producción (datos de kingsaistudio; 4 casos iguales en demo).
- **Qué pasa:** 12 cortes del 25/03 al 04/04 de 2026 (los primeros días de uso) tienen `monto_total = precio`,
  con una propina cargada aparte: la diferencia es, en los 12, exactamente la propina. Desde el 07/04 todos los
  cortes con propina cierran. Caja de esos días muestra esos cortes sin la propina (y el neto por forma de pago
  queda corto por ese monto). Planillas y Balances no se ven afectados: leen `precio` y `propina` por separado.
- **Evidencia:** consultado en la DB (`monto_total <> precio + propina`: 12 en kingsaistudio, 4 en demo, 0 en
  los otros tenants). Hoy `registrarCorte` calcula `monto_total = precio + propina` (`cortesService.js:79`).
- **Arreglo propuesto** (chico, un SQL que corre el usuario):
  `UPDATE corte SET monto_total = precio + COALESCE(propina, 0) WHERE monto_total <> precio + COALESCE(propina, 0);`
  (16 filas). Opcional y más grande: un `CHECK (monto_total = precio + propina)` después del arreglo, o dejar
  de guardar el total y calcularlo.
- **Novedad:** nuevo.

#### Z4-03 [MEDIO] El "facturado" del Inicio no es el "ingreso" de Balances: suma las propinas y no los otros ingresos

- **Dónde:** `backend/src/controllers/inicio.js:20`, `:60` y `:103` (`SUM(monto_total)` de cortes, más ventas)
  contra `backend/src/controllers/balances.js:140` y `:271-273` (`SUM(c.precio)` + productos + otros ingresos).
  Pantallas: Inicio → "facturado hoy" y "facturado este mes" (`SeccionInicio.jsx:192` y `:236`); Balances →
  "Ingresos del negocio" y la fila "Total" de "Ingresos por barbero" (`SeccionBalances.jsx:724` y `:930`).
- **Alcance:** en producción.
- **Qué pasa:** las dos pantallas responden "cuánto entró este mes" con reglas distintas.
  - El Inicio suma `corte.monto_total`, que incluye la **propina**. Balances la deja afuera a propósito ("van al
    barbero, no se incluyen en el balance", `SeccionBalances.jsx:753`).
  - El Inicio **no** suma los "otros ingresos" (`movimiento_extra`); Balances sí.

  Ejemplo con demo: en octubre el Inicio daría $ 104.201 y Balances, en "Sin comisiones", $ 98.201 (la
  diferencia son los $ 6.000 de propinas). En septiembre, $ 34.500 contra $ 488.001: $ 3.000 de propinas de más
  y $ 456.501 de otros ingresos de menos. En kingsaistudio hay 348 cortes con propina: la diferencia aparece
  todos los meses. El comparativo "vs mes anterior" del Inicio arrastra lo mismo.
- **Evidencia:** leído (las dos queries lado a lado) y consultado en la DB (las dos sumas sobre demo, mes por mes).
- **Arreglo propuesto** (chico): que `inicio.js` use la misma regla que Balances: `SUM(precio)` en vez de
  `SUM(monto_total)`, más los movimientos con `afectaResultado` (`utils/movimientos.js`). Alternativa: dejar el
  número y cambiar el rótulo a "cobrado" (lo que pasó por la caja, propinas incluidas), que es lo que hoy mide.
  Recomendada la primera: "facturado" y "ingresos" tienen que ser el mismo número.
- **Novedad:** nuevo.

#### Z4-04 [MEDIO] El iPad cobra con la lista de precios que cargó al abrirse, y el backend guarda el precio que manda el iPad

- **Dónde:** `frontend/src/App.jsx:300-321` y `:405` (`precargarDatos` corre al iniciar sesión en el iPad, al
  cerrar el panel en ese iPad y al volver de una venta; `FlujoCorte` vuelve con `volverAlInicio`, sin recargar);
  `frontend/src/screens/flows/FlujoCorte.jsx:144` (`precio: servicioSeleccionado.precio`) y `FlujoVenta.jsx:106`;
  `backend/src/controllers/cortes.js:45` y `ventas.js:24` (validan el rango, no contra el catálogo).
  Rutas: `POST /api/cortes`, `POST /api/ventas`.
- **Alcance:** en producción.
- **Qué pasa:** el dueño cambia el precio de un servicio desde su celular o su compu (Gestión → Servicios). El
  iPad del local, que queda abierto días enteros con la sesión guardada, sigue mostrando y registrando el precio
  viejo hasta que alguien lo recarga o entra y sale del panel en ese mismo iPad. Cada corte de ese período queda
  con el precio viejo: Caja, la planilla del barbero (su comisión se calcula sobre ese precio) y Balances quedan
  por debajo de lo que se cobró de verdad, sin ningún aviso. El turnero ya le muestra al cliente el precio nuevo.
  Con los productos pasa lo mismo hasta la primera venta (que recarga el catálogo al volver), y un barbero o un
  servicio nuevo no aparece en el iPad hasta recargar.
- **Evidencia:** leído (`App.jsx` → `FlujoCorte` → `registrarCorte` → `createCorte` → `cortesService.registrarCorte`,
  que inserta `$4::numeric` tal como llega). En demo, 9 cortes de los últimos 30 días tienen un precio distinto
  al actual de su servicio (son pruebas; no distingue este caso de un cambio de precio posterior).
- **Arreglo propuesto:**
  1. (chico, recomendado) recargar los catálogos al entrar a cada flujo, o al volver a la pantalla principal y
     cuando la pestaña vuelve al primer plano (`visibilitychange`).
  2. (medio, como red) que `POST /api/cortes` y `POST /api/ventas` con rol operativo comparen el precio recibido
     con el del catálogo y respondan 409 "El precio cambió, actualizá la pantalla" si difieren. El completar del
     panel (`POST /api/admin/turnos/:id/completar`) deja editar el precio a propósito y no cambia.
- **Novedad:** nuevo.

#### Z4-05 [MEDIO] Un corte mal cargado no se puede corregir sin cambiarle la fecha

- **Dónde:** no existe `PUT /api/cortes/:id`; `backend/src/controllers/caja.js:287-340` (borrar) y
  `backend/src/services/cortesService.js:98-103` (el `INSERT` no recibe fecha: `timestamp` es `now()`).
  Pantalla: Caja → Movimientos del día.
- **Alcance:** en producción.
- **Qué pasa:** ventas y gastos se editan; un corte, no. Si el dueño ve el lunes que un corte del sábado quedó
  con la forma de pago, el servicio o la propina mal, lo único que puede hacer es borrarlo en Caja y cargarlo
  de nuevo, y el corte nuevo entra con la fecha y la hora de ese momento. La plata pasa del sábado al lunes: la
  Caja del sábado queda sin ese cobro, y la planilla del barbero lo cuenta en otra semana (y en otro mes si
  cruza el fin de mes). Si el corte venía de un turno, el turno vuelve a "reservado" y completarlo desde el
  Turnero del panel también lo registra con la hora de hoy.
- **Evidencia:** leído (rutas de `cortes.js`, `eliminarMovimiento`, `registrarCorte`, `completarTurnoConCorte`).
- **Arreglo propuesto** (medio): `PUT /api/cortes/:id` solo admin, para forma de pago, propina, precio y
  servicio, sin tocar `timestamp`, `barbero_id`, `turno_id` ni `comision_porcentaje`, y recalculando
  `monto_total`; con su modal en Caja, como el de ventas. Alternativa más chica: que el alta acepte una fecha
  pasada, como `crearMovimientoExtra` (`caja.js:227-230`). Recomendada la edición: no pasa por el borrado ni
  toca el turno.
- **Novedad:** nuevo. La deuda anotada es solo la de movimientos extra ("sin edición", `estado_actual.md`).

#### Z4-06 [BAJO] De 21 a 24 hs, el comparativo del Inicio rotula mal el día y, el último día del mes, el mes anterior

- **Dónde:** `backend/src/controllers/inicio.js:147-159` (`ahora.getDate()`, `ahora.getFullYear()`,
  `ahora.getMonth()`: hora del servidor, no argentina). Pantalla: Inicio → "Estadísticas del mes"
  (`SeccionInicio.jsx:222` y `:257`).
- **Alcance:** en producción.
- **Qué pasa:** las queries usan hora argentina, pero el día y el mes anterior del rótulo salen del reloj del
  servidor (UTC). Desde las 21:00 el dueño ve "Noviembre — del 1 al 17" siendo 16, al lado de la tarjeta del
  día que dice 16. El último día del mes a esa hora es peor: "Noviembre — del 1 al 1" y "vs Noviembre al día
  1", cuando los números son de todo noviembre contra octubre. Los montos están bien; lo que confunde es el
  rótulo, justo a la hora en que se cierra la caja.
- **Evidencia:** leído, y simulado el cálculo de las etiquetas con `TZ=UTC node` (solo JS, sin base): a las
  21:30 del 30/11 da `mes_anterior: noviembre`, `dia_corte: 1`. Supone que el contenedor de Railway corre en
  UTC (no hay `TZ` en el código ni en las variables documentadas): **sin confirmar** en Railway.
- **Arreglo propuesto** (chico): sacar día y meses con luxon en `TZ` (`DateTime.now().setZone(TZ)`), como pide
  `convenciones_tecnicas.md` §4.
- **Novedad:** nuevo.

#### Z4-07 [BAJO] La propina siempre toma la forma de pago del corte

- **Dónde:** `corte.forma_pago` es una sola por corte (`SQL_Schema.md`); `FlujoCorte.jsx` pasos 4 y 5;
  `caja.js:53` (el movimiento de Caja es `monto_total`, con esa forma de pago).
- **Alcance:** en producción.
- **Qué pasa:** no hay pagos mixtos en ningún camino: cada corte, venta, gasto y movimiento extra tiene una
  sola forma de pago, así que no hay partes que sumar ni que puedan descuadrar. El costo es el caso más común
  de propina: el cliente paga el corte por Mercado Pago y deja la propina en efectivo. Se registra todo como
  Mercado Pago, y "Mercado Pago neto" de Caja queda por encima de lo que entró a la cuenta. Tampoco se puede
  registrar un corte pagado mitad y mitad.
- **Evidencia:** leído (schema, `createCorte`, `registrarCorte`, `getMovimientosDia`, `calcularNeto` en
  `SeccionCaja.jsx:540`).
- **Arreglo propuesto** (medio, decisión de producto): una `forma_pago_propina` opcional en `corte` (por
  defecto, la del corte), un paso más en el iPad solo si hay propina, y que Caja parta el movimiento en dos.
  Si no se hace, anotarlo como límite conocido.
- **Novedad:** nuevo.

#### Z4-08 [BAJO] El stock solo se puede sumar: un error de carga no tiene arreglo desde el panel

- **Dónde:** `backend/src/controllers/gestion.js:27-34` y `:410-420` (`agregar_stock` entero >= 0);
  `frontend/src/screens/admin/sections/gestion/TabProductos.jsx` ("Unidades a agregar").
- **Alcance:** en producción.
- **Qué pasa:** si el dueño carga 100 unidades en vez de 10, o se rompe o se regala un producto, no hay forma
  de bajar el stock: Gestión solo suma, y lo único que resta es una venta (que además mete plata que no
  existió en Caja y Balances). El stock queda mal hasta que alguien lo corrija por SQL, y la alerta de stock
  bajo del Inicio deja de servir para ese producto.
- **Evidencia:** leído (`editarProducto`, `errorStockProducto`, `TabProductos`).
- **Arreglo propuesto** (chico): aceptar un ajuste negativo en `agregar_stock` solo al editar, con el tope en
  el `WHERE` (`stock_actual + $5 >= 0`), y en el front un "Corregir stock" separado de "Unidades a agregar".
- **Novedad:** nuevo.

#### Z4-09 [BAJO] Borrar un corte con turno da 500 si el horario de ese turno ya lo tiene otro turno reservado

- **Dónde:** `backend/src/controllers/caja.js:311-315` (`UPDATE turno SET estado = 'reservado'`, sin atrapar
  `23P01`). Ruta: `DELETE /api/caja/movimientos/corte/:id`.
- **Alcance:** en producción.
- **Qué pasa:** el `EXCLUDE` de `turno` solo mira los `reservado`, y la disponibilidad también
  (`disponibilidadService.js:242`): cuando un turno se cobra antes de su hora (el cliente llegó temprano), su
  horario vuelve a ofrecerse. Si otro cliente lo reserva y después el dueño quiere borrar ese corte, devolver
  el turno a "reservado" choca con el `EXCLUDE`, el borrado responde 500 "Error al eliminar corte" (con aviso
  de Sentry) y el corte no se puede borrar mientras el otro turno siga reservado.
- **Evidencia:** leído; **sin reproducir** (habría que escribir en demo y la severidad no lo justifica).
- **Arreglo propuesto** (chico): atrapar `23P01` en ese `UPDATE` y borrar el corte igual, dejando el turno
  como está (completado sin corte) o pasándolo a cancelado; lo decide la zona 5 junto con su nota sobre este
  mismo `UPDATE`.
- **Novedad:** nuevo; complementa la nota de la zona 2 sobre `caja.js:312`.

#### Z4-10 [BAJO] El Excel de Caja ignora el filtro "Solo Barberos"

- **Dónde:** `frontend/src/screens/admin/sections/SeccionCaja.jsx:582` (`movimientos.map`, no
  `movimientosFiltrados`) contra `:535-545` (la tabla y los dos netos sí usan el filtro).
- **Alcance:** en producción.
- **Qué pasa:** con "Solo Barberos" activo, la pantalla saca los cortes de comisión 100 % y recalcula los
  netos; el Excel que se baja en ese momento trae todos los movimientos. Quien suma la columna "Monto" del
  Excel no llega al número que tenía en pantalla.
- **Evidencia:** leído.
- **Arreglo propuesto** (chico): exportar `movimientosFiltrados`, o agregar al nombre del archivo que es la
  vista completa. F4 (socios) va a tocar ese filtro: conviene arreglarlo ahí.
- **Novedad:** nuevo.

### Verificado correcto

**El mismo número en cada pantalla**

| Número | Pantallas comparadas | Dónde se calcula | ¿Coincide? |
|---|---|---|---|
| Comisión de un corte | Planillas (Detalle), MiPlanilla, Excel del Detalle | `comisionCorteSql` (backend); los fronts solo suman `c.comision` | Sí |
| Comisión de la semana y "A pagar" | Planillas (Resumen y modal), MiPlanilla, Excel del Resumen | `resumenSemanal` (`comision_servicios`, `comision`) | Sí |
| Comisiones del mes | Balances mensual, histórico y sus Excel | `comisionCorteSql` en las dos queries | Sí |
| Comisión semanal contra mensual | Planillas contra Balances | Misma expresión, redondeo por corte | Sí (los cortes de una semana partida entre dos meses caen en el mes de su fecha) |
| Monto de servicios | Planillas, MiPlanilla, Balances | `SUM(c.precio)` | Sí |
| Propinas | Planillas, MiPlanilla, nota de Balances | `SUM(c.propina)` | Sí |
| Ingresos del mes | Inicio contra Balances | `SUM(monto_total)` contra `SUM(precio)` + otros ingresos | **No** (Z4-03) |
| Total de cortes del día | Caja contra Inicio ("facturado hoy") | `monto_total` en los dos | Sí (los dos con propina) |
| Ventas | Caja, Inicio, Ventas, Balances | `cantidad * precio_unitario` | Sí |
| Gastos | Caja, Gastos, Balances (egresos) | `gasto.monto` | Sí |
| Ganancia del mes | Balances mensual, histórico, modal del mes y Excel | `balance_neto` del backend; "Sin comisiones" = brutos − egresos en el front y en `balanceSinComisiones` | Sí |
| Queda en el negocio | Balances mensual, modal del mes, Excel | `quedaEnElNegocio` (front, una sola función) | Sí (el Excel va siempre con comisiones; está comentado en el código) |
| Netos de Caja | Pantalla contra Excel de Caja | `calcularNeto` contra filas del Excel | Sí sin filtro; **no** con "Solo Barberos" (Z4-10) |

- **Límites de día, semana y mes:** todas las queries cortan en hora argentina (`DATE(timestamp AT TIME ZONE)`,
  `TO_CHAR(… 'YYYY-MM')`, `DATE_TRUNC` sobre el instante ya convertido). Un corte a las 23:50 o a las 00:10, y
  el último día del mes, caen en el mismo día y mes en Caja, Inicio, Planillas y Balances. La semana empieza el
  lunes en las tres pantallas que la usan (`semanaDesde` con luxon, `DATE_TRUNC('week')` en el Inicio,
  `lunesDeEstaSemana` en MiPlanilla): un corte del domingo es de la semana que termina. Confirmado que la sesión
  de la base está en UTC y que `DATE_TRUNC('week', <date>)` compara bien contra la fecha argentina. Lo único
  fuera de hora argentina son las etiquetas de Z4-06.
- **Redondeo:** la comisión se redondea a centavos por corte y los totales son sumas de esos valores, en todas
  las pantallas; ningún front recalcula un porcentaje. `fmtPesos` muestra pesos enteros: con precios en pesos
  enteros y comisiones de 5 en 5 casi nunca hay centavos (en producción, 0 cortes con comisión con centavos).
- **Comisión guardada contra el % actual:** todas las pantallas usan `corte.comision_porcentaje`
  (`porcentajeComisionSql`). El % actual del barbero (`comision_valor`) solo se usa para el texto de un barbero
  sin cortes en el período. `registrarCorte` copia el % en el mismo `INSERT`.
- **F7:** `esComisionValida` (entero, 0 a 100, múltiplo de 5) está en los dos caminos que escriben el % desde
  la app: `crearBarbero` y `editarBarbero` (`gestion.js:102` y `:156`). El tercer camino es el alta por SQL
  (plantilla de la skill y `crearTenant.js`), que cubre Z3-04. En la base: 0 barberos y 0 cortes con un % que
  no sea múltiplo de 5 o esté fuera de 0 a 100, en todos los tenants.
- **Un % que no es múltiplo de 5 (nota de Z3-04):** Planillas, Balances y Caja lo manejan bien. La fórmula no
  depende del múltiplo, `textoPorcentajeComision` muestra decimales y "Solo Barberos" compara `< 100`. El único
  efecto es el ya anotado: Gestión → Barberos no deja guardar a ese barbero sin cambiarle el %.
- **Montos:** `esMontoValido`, `sumaMontosValida`, `esCantidadValida` y `esFormaPagoValida` están en todas las
  altas y ediciones (corte, completar turno, venta, gasto); el movimiento extra exige monto > 0. Lo cerrado en
  julio (6.1 y 6.3) sigue cerrado. En la base: 0 montos negativos, 0 ventas con cantidad <= 0, 0 gastos sin
  categoría.
- **Editar y eliminar:**
  - Venta: la edición aplica el delta neto de stock y la baja lo devuelve, las dos por `utils/stock.js`, con la
    fila escrita al final y compensación si falla. `deleteVenta` y Caja comparten `eliminarVenta`.
  - Gasto de "Productos para venta": no toca el stock en ningún camino (es solo un recordatorio en el iPad),
    así que editarlo o borrarlo no puede aplicar nada dos veces.
  - Movimiento extra: el borrado filtra por tipo y tenant; no hay edición (deuda anotada).
  - Corte: al borrarlo desaparece de todas las queries (ninguna pantalla guarda totales) y su turno vuelve a
    "reservado". No se puede cobrar dos veces: `corte_turno_unico`, más el 409 de `registrarCorte` ante un
    turno ya completado.
- **Aportes y retiros:** no entran en el Inicio, ni en Planillas, ni en la ganancia de Balances
  (`afectaResultado` en `utils/movimientos.js`, una sola fuente). En Caja suman o restan al neto por forma de
  pago, que es lo correcto (es plata que entró o salió de la caja). Un socio inactivo no se puede elegir en un
  alta (`socioActivoEnTenant`), y sus movimientos siguen saliendo en Caja y en Balances (los `JOIN` no filtran
  por `activo`). Lo mismo con los cortes de un barbero dado de baja.
- **Doble envío:** en los tres flujos del iPad, en el alta de movimientos extra, en editar y eliminar de
  Ventas, Gastos y Caja, y en completar un turno desde el panel, el botón queda deshabilitado mientras
  responde el servidor. Ningún `fetch` del panel reintenta solo (`apiFetch`, `apiFetchOperativo`,
  `fetchConDiagnostico`). El cobro de un turno, además, lo protege el backend. Los datos lo confirman (Z4-01).
- **Stock:** lo mueven solo `utils/stock.js` (ventas) y `crearProducto` / `editarProducto` (sumas, sin
  reintento y con el tope en el `WHERE`). En la base: 0 productos con stock negativo o nulo.
- **Datos en la base (todos los tenants):** 0 cortes con `turno_id` de un turno no completado; 17 turnos
  completados sin corte, todos de demo y el último del 20/10 (anteriores a "un turno se completa solo con su
  corte"); 0 movimientos extra de socios inactivos; los 3 cortes con turno de otro barbero que ya contó la zona
  2 (demo); 1 corte de demo con un servicio distinto al de su turno (anterior a la sincronización).
- **Hoy no se puede generar** un corte con turno de otro barbero ni con el total mal: el `UPDATE` del turno
  filtra por `barbero_id` y el total se calcula en `registrarCorte`.

**Sin revisar:** el render completo de `SeccionGastos`, `SeccionVentas`, `TabProductos` y `MiPlanilla` (se
leyeron las cuentas, los handlers y los Excel, no cada componente); el modal de completar de `SeccionTurnero`
(solo que el botón se deshabilita); `descansosSemanal` (no es plata; zona 5); y la zona horaria real del
contenedor de Railway (Z4-06).

### Para otra zona

- **Zona 5:** borrar el corte de un turno que se había completado desde "no asistió" lo deja en "reservado",
  no en "no asistió" (`caja.js:312`). Y Z4-09: ese mismo `UPDATE` puede chocar con el `EXCLUDE`.
- **Zona 5:** el iPad deja cobrar un turno antes de su hora, y desde ese momento el turnero vuelve a ofrecer
  ese horario (la disponibilidad solo cuenta los `reservado`, `disponibilidadService.js:242`).
- **Zona 6:** inyección de fórmulas en Excel: el de Caja exporta `Detalle` con la descripción de un gasto o
  de un otro ingreso (texto libre, el gasto lo escribe cualquiera en el iPad) y el de Planillas, el nombre del
  cliente del turnero (`SeccionCaja.jsx:586`, `SeccionPlanillas.jsx` → `exportarExcel`).
- **Zona 6:** `createGasto` y `updateGasto` aceptan una descripción de solo espacios (`gastos.js:23`); el iPad
  lo evita con `trim()`, el modal de edición del panel no se revisó.
- **Zona 8:** `getResumenDia` hace 6 queries y `getComparativoMes` 4, en tandas de a dos, cada vez que se abre
  el Inicio; y los filtros por mes con `TO_CHAR(timestamp AT TIME ZONE …) = $2` (Balances, Ventas, Gastos) no
  pueden usar un índice sobre `timestamp`.
- **Docs:** el encabezado de `backend/src/utils/comision.js:10-12` todavía habla de la columna nullable (ya
  anotado como opcional en `estado_actual.md`). La deuda diferida 2 de julio debería nombrar también al corte
  sin turno (Z4-01).

---

## Zona 5. Agenda, turnos y concurrencia

**Commit auditado:** `dd99386` (`feature/mejoras-operativas`), 2026-11-16/17. Solo lectura: código, docs y la
DB con el rol `resguardo_lectura`. No se reprodujo nada en demo: ningún hallazgo es alto ni crítico.

**Resumen:** 9 hallazgos (0 críticos, 0 altos, 2 medios, 7 bajos). Ocho están en producción y uno solo en el
branch (Z5-09). Dato que pesa en todas las severidades: **hoy ningún local real tiene turnos**. En la base hay
158 turnos de demo y 1 de kingsaistudio (cancelado, de septiembre); luxuribarberclub y monte-sinai, ninguno, y
ningún local real tiene ausencias, descansos ni feriados cargados. Nada de lo que sigue le pasó a un cliente:
es lo que va a pasar cuando un local empiece a usar el turnero propio.

**Revisión del orquestador (2026-11-17):** sin críticos ni altos, se revisó una muestra contra el código: Z5-01
(`horarios.js` y `horariosService.js` no consultan turnos), Z5-02 (el 409 del feriado devuelve solo la cantidad
y el mail sale solo con `cliente_email`), Z5-03 (`buscarTurnosAfectados` y el CTE de `crearSuspension` no
filtran `inicio > now()`) y Z5-06 (`reclamarTurno` y el `UPDATE` de la reprogramación). Contra la base, el
conteo de turnos por local. No se sacó ninguno ni cambió ninguna severidad.

### Hallazgos

#### Z5-01 [MEDIO] Cambiar el horario de un barbero no dice nada de los turnos reservados que quedan afuera

- **Dónde:** `backend/src/controllers/horarios.js:51-124` (`putHorarios`) y
  `backend/src/services/horariosService.js:79-101` (`reemplazarHorarios`). Ruta: `PUT /api/admin/horarios/:barbero_id`
  (admin, o el barbero sobre el suyo). Pantallas: Gestión → Barberos → Horarios del panel
  (`TabBarberos.jsx:308`) y Gestión de la app del barbero.
- **Alcance:** en producción (los dos archivos son iguales en `main`).
- **Qué pasa:** el dueño le saca los sábados a un barbero, o le corta la tarde, y guarda. El horario se
  reemplaza y listo: no se mira si ese barbero tiene turnos reservados en lo que dejó de trabajar. Esos turnos
  siguen `reservado`, el cliente tiene su mail de confirmación y va a recibir el recordatorio, y el sábado
  llega al local y su barbero no está. Nadie recibió un aviso al guardar. Las otras tres formas de cerrar
  agenda sí lo resuelven: la ausencia lista los turnos y pide confirmar, y el feriado y el horario del local
  cancelan con confirmación. El turno no desaparece (la Agenda del barbero y el Turnero del panel lo siguen
  mostrando, porque se dibujan desde los turnos y no desde la grilla), pero hay que ir a buscarlo día por día.
- **Evidencia:** leído (ruta → `putHorarios`, que valida forma, solapamiento y horario del local →
  `reemplazarHorarios`; en los fronts, el guardado no consulta turnos). En la DB hay 1 turno reservado futuro
  fuera del horario de su barbero, en demo.
- **Arreglo propuesto** (medio): al guardar, contar los turnos reservados futuros del barbero que quedan fuera
  de los bloques nuevos. Dos opciones:
  1. **Avisar y dejar decidir (recomendada):** 409 `requiere_confirmacion` con la lista (día, hora, cliente),
     como la ausencia. Al confirmar, el horario se guarda y los turnos **quedan** (no se cancelan): el dueño ya
     sabe cuáles son y decide si los atiende igual o los cancela uno por uno. Es lo más chico y no manda mails
     que nadie pidió.
  2. Cascada completa como la del horario del local (cancelar con mail). Más grande, y cancelar clientes por
     un cambio de horario del barbero es una decisión que conviene que el dueño tome turno por turno.
- **Novedad:** nuevo. `decisiones_horario_atencion.md` cubre la cascada del horario del local, no la del
  barbero. Pariente de la deuda "la reserva no valida el bloque horario del barbero", pero es otro camino: acá
  el turno era válido cuando se reservó.

#### Z5-02 [MEDIO] El feriado y el cambio de horario del local cancelan turnos de clientes sin mail y solo informan la cantidad

- **Dónde:** `backend/src/controllers/feriados.js:81-88` y `horarioAtencion.js:90-102` (el 409 devuelve solo
  `delta.turnos_cancelados`), `services/feriadosService.js:110` y `horarioAtencionService.js:256`
  (`if (t.cliente_email)`: sin mail, no hay aviso). Pantallas: Gestión → Negocio → Feriados
  (`BloqueFeriados.jsx:358`) y Horario de atención (`BloqueHorarioAtencion.jsx:317`).
- **Alcance:** en producción. F1 (solo en el branch) lo agranda: los turnos "Sin datos" nunca tienen mail.
- **Qué pasa:** el dueño carga un feriado para el viernes. El diálogo dice "se cancelan 6 turnos" y, al
  confirmar, "6 turnos cancelados". De esos 6, los que cargó un barbero sin mail del cliente (lo habitual
  cuando el turno se anota por WhatsApp o en el local) y los "Sin datos" se cancelan igual, pero a esos
  clientes no les llega nada, y el dueño no sabe cuáles son ni cuántos: la pantalla no los nombra en ningún
  momento. El viernes vienen y el local está cerrado. Para encontrarlos hay que abrir el Turnero del panel día
  por día y mirar los cancelados. El barbero tampoco se entera si no tiene mail cargado (sin mail no hay evento
  de Calendar; hoy ningún barbero de un local real lo tiene).
- **Evidencia:** leído (los dos controllers, las dos cascadas y los dos diálogos). La ausencia sí devuelve la
  lista con el nombre (`suspensionesService.js:114-119`), pero tampoco dice quién se queda sin aviso.
- **Arreglo propuesto** (medio): que el 409 y la respuesta final de las tres cascadas traigan la lista de
  turnos (día, hora, barbero, cliente, teléfono) con un campo `avisado` (tenía mail o no), y que el diálogo
  separe "a estos les llega un mail" de "a estos avisales vos", con el teléfono a mano. Sin cambios de schema.
- **Novedad:** nuevo; F1 lo agrava.

#### Z5-03 [BAJO] Una ausencia que empieza en el pasado cancela turnos que ya pasaron y le manda al cliente "tuvimos que cancelar este turno"

- **Dónde:** `backend/src/controllers/suspensiones.js:72-79` (solo valida `hasta > desde`) y
  `services/suspensionesService.js:94-107` y `:183-203` (los turnos afectados son todos los `reservado` que
  pisan el rango, sin `inicio > now()`). Ruta: `POST /api/admin/suspensiones`. Pantallas: Gestión → Barberos →
  Ausencias (los dos `datetime-local` de `TabBarberos.jsx:679-689` no tienen mínimo) y Gestión de la app del
  barbero.
- **Alcance:** en producción.
- **Qué pasa:** a las 11:00 un barbero se va enfermo y el dueño carga la ausencia "hoy de 9:00 a 20:00" (el
  día entero, que es lo natural). Los turnos de 9:00 a 11:00 que el barbero atendió pero que no se cobraron
  sobre el turno (se cobraron como cliente sin turno, o todavía no se cobraron) siguen `reservado`, así que
  entran en la lista, se cancelan y cada cliente recibe un mail diciendo que el barbero suspendió su agenda y
  su turno se canceló, después de haberse cortado. Además el turno queda `cancelado` y ya no se puede cobrar
  sobre él. El diálogo muestra la lista con día y hora, así que un dueño atento lo ve; pero es la única cascada
  que toca turnos pasados: la del feriado y la del horario filtran `inicio > now()`, y desde F9 ni el cliente
  ni el barbero pueden cancelar un turno que ya empezó.
- **Evidencia:** leído (controller → `crearSuspension` → `buscarTurnosAfectados` y el CTE `canceladas`).
- **Arreglo propuesto** (chico): sumar `AND t.inicio > now()` en `buscarTurnosAfectados` y en los dos lugares
  del CTE. La ausencia se puede seguir cargando con inicio pasado (sirve para el registro y para el % de la
  jornada); lo que cambia es que no cancela lo que ya empezó.
- **Novedad:** nuevo. Es la regla de F9 que faltó llevar a este camino.

#### Z5-04 [BAJO] Borrar un corte devuelve su turno a "reservado" sin mirar la hora, de dónde venía ni si el horario sigue libre

Junta las notas de las zonas 2 y 4 sobre `caja.js:312`. El 500 del choque con el `EXCLUDE` ya está reportado
como **Z4-09** y no se repite: acá va el resto y la propuesta para los cuatro casos.

- **Dónde:** `backend/src/controllers/caja.js:309-322`. Ruta: `DELETE /api/caja/movimientos/corte/:id` (admin).
  Pantalla: Caja → Movimientos del día.
- **Alcance:** en producción.
- **Qué pasa:** al borrar un corte con turno, el turno pasa de `completado` a `reservado` y nada más. Tres
  consecuencias que el dueño no ve venir (Caja no le dice que el corte tenía un turno):
  1. **Turno de un día anterior:** queda un `reservado` en el pasado. Tiene salida (se puede volver a
     completar desde el Turnero del panel, o marcar "no asistió"), pero no desde el iPad, que lista solo los
     de hoy, y nadie avisa que quedó pendiente. Con el cierre nocturno de F3, esa misma noche pasaría a "no
     asistió" con `no_asistio_por = 'sistema'`: un cliente que vino y pagó quedaría con una falta.
  2. **Turno que el admin había completado desde "no asistió":** vuelve a `reservado`, no a "no asistió". No
     hay dónde leer el estado anterior. Es el mismo caso 1 con otro origen.
  3. **Turno de hoy que todavía no terminó:** vuelve a `reservado`, reaparece en el iPad y vuelve a ocupar su
     horario. Es lo correcto, salvo que el horario ya lo haya tomado otro (Z4-09).
- **Evidencia:** leído (`eliminarMovimiento`; `listarTurnosOperativos` filtra `reservado` y la fecha de hoy;
  `cambiarEstado` y `completarTurnoConCorte` aceptan un reservado pasado sin límite de antigüedad).
- **Qué debería pasar, por caso** (arreglo chico a medio, todo en `eliminarMovimiento` y el diálogo de Caja):

  | Caso | Hoy | Propuesta |
  |---|---|---|
  | El turno no terminó y su horario sigue libre | → `reservado` | Igual. Es correcto. |
  | El turno ya terminó (hoy o un día anterior) | → `reservado` en el pasado | Igual, **pero avisando**: es el único estado desde el que se puede volver a cobrar un turno de otro día. El diálogo de borrado dice "Este corte es del turno de las 15:00 de Juan: el turno vuelve a quedar pendiente de cobro", y F3 lo muestra en "turnos sin cobrar". |
  | Venía de "no asistió" | → `reservado` | Igual que el anterior. No vale la pena guardar el estado previo: si de verdad faltó, se vuelve a marcar (y el cierre de F3 lo hace solo). |
  | Otro turno ya tomó ese horario (Z4-09) | 500, el corte no se puede borrar | Atrapar `23P01`, borrar el corte igual y dejar el turno `cancelado` (`cancelado_por = 'admin'`, sin mail), devolviendo un aviso para que Caja diga "el horario de ese turno ya lo tiene otro cliente: quedó cancelado". No puede volver a `reservado` (lo impide el `EXCLUDE`) y `completado` sin corte es justo la inconsistencia que cuenta la zona 4. |

  Lo que más reduce todo esto es **Z4-05** (editar un corte en vez de borrarlo y recargarlo): la mayoría de los
  borrados de un corte con turno son para corregir la forma de pago o el monto.
- **Novedad:** nuevo; completa Z4-09 y las notas de las zonas 2 y 4. Conviene decidirlo antes de F3 (fase 7 de
  mejoras operativas), porque el cierre nocturno convierte el caso 1 en una falta mal puesta.

#### Z5-05 [BAJO] Un turno cobrado antes de su hora deja de ocupar su horario: el turnero lo vuelve a ofrecer

Es la pregunta que dejó la zona 4. Respuesta: **en el caso común es lo esperado; hay dos caminos donde no**.

- **Dónde:** `backend/src/services/disponibilidadService.js:237-246` (la disponibilidad y la grilla cuentan
  solo `estado = 'reservado'`), el `EXCLUDE` (también solo `reservado`), `services/turnosService.js:451-513`
  (`completarTurnoConCorte` no mira la fecha ni la hora del turno) y `frontend/.../SeccionTurnero.jsx:1250`
  ("Completar" en cualquier turno reservado, también de un día futuro).
- **Alcance:** en producción.
- **Qué pasa:**
  - **Esperado:** el cliente del turno de las 15:00 llega a las 14:20, el barbero está libre, lo corta y lo
    cobra a las 14:50. El turno pasa a completado y las 15:00 quedan libres de verdad. Que el turnero las
    ofrezca (por cinco minutos, hasta la antelación mínima) es correcto.
  - **No esperado, 1:** en el iPad, el selector "Turnos de hoy" lista todos los reservados del barbero. Si al
    cobrar al cliente de las 15:00 se elige por error el turno de las 17:00, el de las 17:00 queda completado y
    su horario libre: el turnero lo ofrece el resto de la tarde, otro cliente lo reserva y a las 17:00 llegan
    dos. Corregirlo es borrar el corte, y ahí aparece Z4-09.
  - **No esperado, 2:** desde el Turnero del panel se puede completar un turno de mañana o de la semana que
    viene (un clic de más mirando otro día). Queda un corte con fecha de hoy y el horario libre para el turnero.
  - En la Agenda del barbero el turno completado se sigue dibujando encima de su horario, así que el barbero
    no puede marcar un descanso ahí, pero el turnero sí lo reserva: es el único punto donde la Agenda y la
    disponibilidad muestran cosas distintas.
- **Evidencia:** leído. En la DB hay 2 pares de turnos superpuestos del mismo barbero entre `reservado` y
  `completado`, los dos en demo.
- **Arreglo propuesto** (chico):
  1. `completarTurnoConCorte` rechaza (409) un turno de un día posterior a hoy, y el panel no ofrece
     "Completar" en esos días.
  2. En el iPad, el selector marca cuál es el turno más cercano a la hora actual, o pide confirmar si el
     elegido empieza dentro de más de una hora ("Este turno es a las 17:00, ¿es el que estás cobrando?").

  No se propone que la disponibilidad cuente los completados: rompería el caso esperado.
- **Novedad:** nuevo.

#### Z5-06 [BAJO] Un turno reprogramado después de su recordatorio no vuelve a recibir recordatorio

Responde la nota de la zona 3.

- **Dónde:** `backend/src/controllers/turnero.js:627` (el `UPDATE` cambia `inicio` y `fin`; no toca
  `recordatorio_enviado_en`) y `services/recordatoriosService.js:71-74` (el lote toma solo los turnos con esa
  columna en `NULL`). Pantalla: gestión del turno, "Reprogramar".
- **Alcance:** en producción (hoy solo demo tiene el recordatorio activo).
- **Qué pasa:** el lote de las 20:30 le manda al cliente el recordatorio de su turno de mañana. El cliente
  entra por ese mismo mail y lo pasa al viernes. El turno queda marcado como ya avisado, así que el jueves a la
  noche el lote lo saltea y el cliente no recibe recordatorio del horario nuevo. Es justo el cliente que más lo
  necesita: el que cambió el turno. **No** recibe un recordatorio del horario viejo: el mail se arma con los
  datos del turno en el momento del envío. Sí recibe el mail de reprogramación.
- **Evidencia:** leído (`reprogramarTurno`, `obtenerTurnosDelLote`, `reclamarTurno`). En la DB: 0 turnos con
  recordatorio de un día que no sea la víspera (no pasó todavía).
- **Arreglo propuesto** (chico): `recordatorio_enviado_en = NULL` en el `UPDATE` de la reprogramación. No puede
  duplicar: el lote corre una vez por día y solo mira los turnos de mañana, así que un turno movido dentro del
  mismo día después del lote no vuelve a entrar. De paso, sumar `AND estado = 'reservado'` al `WHERE` de
  `reclamarTurno`: hoy, un turno cancelado entre la lectura del lote y su claim (segundos) recibe igual el
  recordatorio.
- **Novedad:** nuevo. `decisiones_mail_recordatorio.md` acepta las reservas hechas después del lote; este caso
  no está.

#### Z5-07 [BAJO] La validación del horario del local deja pasar un turno que cruza la medianoche

- **Dónde:** `backend/src/services/horarioAtencionService.js:81-95` y `:107-116` (`validarRangoEnHorario`
  compara `'HH:MM'` de inicio y de fin como texto). La usan `POST /api/turnero/turnos`,
  `/turnos/:token/reprogramar` y `POST /api/admin/turnos`.
- **Alcance:** en producción.
- **Qué pasa:** con un local que abre de 10:00 a 19:00, un turno de 23:40 a 00:10 pasa la validación: `23:40`
  no es menor que `10:00`, y `00:10` no es mayor que `19:00`. Por las pantallas no se llega (la disponibilidad
  nunca ofrece ese horario), pero un pedido armado a mano contra el endpoint público sí: aparecen turnos a
  medianoche en la Agenda del barbero, con su evento de Calendar y su mail. No bloquea horarios reales. La
  misma comparación está en `calcularDelta` (`:202-204`), así que la cascada del horario tampoco los ve.
- **Evidencia:** leído. En la DB: 1 turno reservado fuera del horario del local, en demo y ya pasado.
- **Arreglo propuesto** (chico): rechazar si `finDT` no es del mismo día que `inicioDT` (hora argentina), antes
  de comparar las horas.
- **Novedad:** corrige la deuda "no validan que `inicio` caiga en un slot real" de `estado_actual.md`, que
  afirma que el horario del local sí se valida: se valida, salvo este borde. El resto de esa deuda (bloque del
  barbero y grilla) sigue igual y no se repite.

#### Z5-08 [BAJO] El iPad no muestra un turno marcado "no asistió", aunque el backend está preparado para cobrarlo

- **Dónde:** `backend/src/services/turnosService.js:337-351` (`listarTurnosOperativos` filtra
  `estado = 'reservado'`) contra `controllers/cortes.js:18-19` y `:82` (`createCorte` acepta `no_asistio` del
  día: "elegirlo dice que el cliente vino"). Pantallas: `FlujoCorte` del iPad y "No asistió" de la app del
  barbero (`DetalleTurnoModal.jsx:74-80`, disponible desde el minuto en que empieza el turno).
- **Alcance:** en producción.
- **Qué pasa:** el turno es a las 10:00. A las 10:03 el barbero lo marca "no asistió"; a las 10:08 llega el
  cliente y lo atiende igual. Al cobrar, el turno ya no está en el selector del iPad: el cobro entra como
  cliente sin turno, el turno queda con la falta, y la planilla cuenta un corte "sin turno" de más. La única
  corrección es que el dueño lo complete desde el Turnero del panel ese mismo día. La rama del backend que lo
  resolvía desde el iPad no se puede alcanzar.
- **Evidencia:** leído (`FlujoCorte.jsx:103` → `getTurnosDelDia` → `GET /api/turnos` → `listarTurnosOperativos`).
- **Arreglo propuesto** (chico): que `listarTurnosOperativos` devuelva también los `no_asistio` del día, con
  su estado, y el selector los muestre al final con la etiqueta "No asistió". El resto ya está hecho.
- **Novedad:** nuevo.

#### Z5-09 [BAJO] Asignar un cliente a un turno "Sin datos" es de una sola vez: un error no se puede corregir

- **Dónde:** `backend/src/services/turnosService.js:691-693` y `:760` (`cliente_id IS NULL` como condición).
  Ruta: `PATCH /api/admin/turnos/:id/cliente`. Pantallas: "Asignar cliente" en la app del barbero y en el
  Turnero del panel.
- **Alcance:** solo en el branch (F1).
- **Qué pasa:** el barbero busca "Juan", toca al Juan equivocado y confirma. El turno queda con ese cliente y
  ni él ni el dueño lo pueden cambiar: un segundo intento responde 409 "El turno ya tiene un cliente asignado",
  y el botón desaparece. Si el turno está reservado, la salida es cancelarlo y cargarlo de nuevo; si ya está
  completado, no hay ninguna, y la planilla y la futura ficha del cliente quedan con el corte a nombre de otro.
  La regla de no pisar está bien para la carrera entre dos pantallas, que es para lo que se escribió.
- **Evidencia:** leído (`verificarTurnoAsignable`, `asignarClienteATurno`, y los dos fronts: el botón sale solo
  con `!turno.cliente_id`).
- **Arreglo propuesto** (chico a medio): permitirle al admin reemplazar el cliente de un turno (un
  `reemplazar: true` que saca el `cliente_id IS NULL` del `WHERE`, solo con rol admin), con "Cambiar" en el
  detalle del turno del panel. El barbero sigue sin poder pisar.
- **Novedad:** nuevo.

### Verificado correcto

**Estados del turno y transiciones** (todas las que existen en el código, por camino). El CHECK de la base
admite `reservado`, `cancelado`, `completado` y `no_asistio`; no hay ningún `UPDATE turno SET estado` fuera de
esta tabla.

| De → a | Camino | Condiciones (dónde se controlan) |
|---|---|---|
| (nuevo) → `reservado` | Turnero público, `POST /api/turnero/turnos` | Futuro (+5 min), dentro de 15 días, horario del local, sin feriado; sin otro turno (`EXCLUDE`) ni ausencia o descanso (`NOT EXISTS` en el `INSERT`) |
| (nuevo) → `reservado` | App del barbero (wizard y atajo de la Agenda), `POST /api/admin/turnos` | Igual, sin el tope de 15 días; con cliente nuevo, existente o "Sin datos" |
| `reservado` → `reservado` (otro horario) | Cliente, link del mail, `/reprogramar` | El turno no empezó (`inicio > now()` en el `WHERE`); el horario nuevo cumple lo mismo que una reserva. No hay reprogramación desde el backoffice |
| `reservado` → `cancelado` | Cliente, link del mail, `/cancelar` | No empezó (en el `WHERE`). `cancelado_por = 'cliente'` |
| `reservado` → `cancelado` | App del barbero y panel, `DELETE /api/admin/turnos/:id` | No empezó (en el `WHERE`); el barbero, solo los suyos |
| `reservado` → `cancelado` | Ausencia, `POST /api/admin/suspensiones` con confirmación | Todo `reservado` que pise el rango, **también los pasados** (Z5-03). `cancelado_por = 'suspension'` |
| `reservado` → `cancelado` | Feriado y cambio de horario del local, con confirmación | `inicio > now()`; `cancelado_por = 'admin'` |
| `reservado` → `completado` | iPad, `POST /api/cortes` con `turno_id` | Turno del barbero elegido; el iPad lista los de hoy. Sin control de hora (Z5-05) |
| `reservado` → `completado` | Panel, `POST /api/admin/turnos/:id/completar` | Admin (el backend también acepta al barbero sobre los suyos; ninguna pantalla suya lo ofrece). Cualquier día (Z5-05) |
| `reservado` → `no_asistio` | App del barbero y panel, `PATCH .../estado` | Ya empezó (lectura previa; el `WHERE` repite `estado = 'reservado'`). Sin límite hacia atrás |
| `no_asistio` → `completado` | Panel (solo admin) e iPad | Solo el mismo día del turno, en la misma sentencia. El iPad no llega a ofrecerlo (Z5-08) |
| `completado` → `reservado` | Caja, borrar el corte (admin) | Ninguna (Z5-04, Z4-09) |
| `cancelado` → (nada) | — | Terminal. Si el iPad cobra un turno cancelado, el corte entra sin turno y el turno no se revive |
| Sin cambio de estado | Asignar cliente (`reservado` o `completado`), job de recordatorios (`recordatorio_enviado_en`), Calendar (`google_event_id`) | — |

- **"Un turno se completa solo con su corte":** se respeta en todos los caminos. `PATCH .../estado` rechaza
  `completado` (400); los dos únicos caminos a `completado` pasan por `registrarCorte`, que marca el turno e
  inserta el corte en una sola sentencia. En la DB: 0 cortes con turno no completado; 17 completados sin corte,
  todos de demo y anteriores al 2026-10-20 (hoy no se pueden generar).
- **Estados sin salida:** ninguno que no sea por diseño. Un `reservado` pasado se puede completar desde el panel
  o marcar "no asistió"; `cancelado` y, pasado su día, `no_asistio` son terminales a propósito. En la DB: 24
  reservados con el fin pasado, todos de demo (18 de más de 30 días); es la deuda ya anotada que resuelve F3.
- **Turno pasado:** cancelar y reprogramar exigen `inicio > now()` con el reloj de la base y en el `WHERE`, en
  los tres caminos (cliente, barbero, admin). "No asistió" exige lo contrario. Los fronts ofrecen cada acción
  con la misma regla (`DetalleTurnoModal`, `Dashboard` del barbero, `SeccionTurnero`).
- **Turno sin cliente (F1):** no queda ningún `JOIN cliente` que no sea `LEFT JOIN` (`sqlTurnoEnriquecido`,
  `listarTurnos`, `listarTurnosOperativos`, `getTurnoPorToken`, `planillaService`). El único `JOIN turno` desde
  `cliente` es `getMisClientes`, donde corresponde. Todos los mails cortan si no hay email
  (`debeSaltarseEnvio`), y las cascadas y el recordatorio lo chequean antes de armar el mail. Calendar nombra
  el evento "Sin datos" y lo actualiza al asignar el cliente. Asignar dos veces da 409 sin pisar (una sola
  sentencia con `cliente_id IS NULL`); a un turno cancelado o "no asistió", 409. Las listas de turnos afectados
  de una ausencia muestran "Sin datos" (`textoCliente`) en los dos fronts.
- **Cascadas sin transacción:** la ausencia inserta y cancela en una sola sentencia (o todo o nada), y avisa
  después solo por los ids que canceló. El feriado y el horario del local cancelan turno por turno con
  `estado = 'reservado'` en el `WHERE`, y graban el feriado o el horario nuevo **al final**: si algo falla a
  mitad de camino, los turnos ya cancelados quedaron avisados, el feriado o el horario no se guardó, y repetir
  la acción recalcula y termina el resto. Un fallo de mail o de Calendar no corta la cascada. Lo que no hacen
  bien es informar (Z5-02).
- **Descansos:** `crearDescanso` valida contra la misma grilla que usa el turnero (alineado, dentro de un
  bloque, futuro, libre) y repite la ocupación en el `INSERT`. Liberar pone todas las reglas en el `WHERE`
  (dos pedidos no liberan dos veces; el barbero no libera lo del admin). El rango efectivo tiene una sola
  definición (`finEfectivoSql`, `suspensionSolapaSql`) y la usan la disponibilidad, la grilla, las reservas, la
  reprogramación y los listados; `unirDescansos` hace el mismo cálculo en JS. La Agenda del barbero y la del
  panel reciben los mismos bloques ya unidos del backend. En la DB: 0 turnos reservados sobre una ausencia o un
  descanso vigente, y 0 ausencias o descansos vigentes superpuestos entre sí.
- **Disponibilidad:** el último slot del día entra solo si el servicio termina antes del fin del bloque; un
  servicio más largo que el hueco no se ofrece; cada bloque ancla en su `hora_inicio`, así que con slots de 50
  minutos lo que sobra al final queda sin ofrecer (y la Agenda lo dibuja en gris). No hay cruce de medianoche
  posible en la grilla: los bloques son `time` con `hora_fin > hora_inicio`. "Hoy" y "ahora" salen de luxon en
  hora argentina, con la antelación de 5 minutos; un día pasado devuelve vacío; feriado o día cerrado, vacío.
  "Cualquier barbero" usa el mismo cálculo por barbero. Días y horarios salen de la misma función, así que la
  tira de días no puede ofrecer un día sin horarios. En la DB: 0 bloques de barbero fuera del horario del
  local y 0 turnos reservados en un feriado.
- **Fechas:** todos los instantes del cliente pasan por `parsearInstante` y llegan al SQL con offset
  (`toISO()`); ninguno llega crudo. Las comparaciones con "ahora" que deciden algo se hacen en la base
  (`now()`) o con luxon en `TZ`. Las fechas `DATE` convertidas con `toISOString()` (feriados) dan el día
  correcto mientras el proceso corra en UTC o en una zona al oeste (Railway y las máquinas de desarrollo); los
  fronts no usan `toISOString()` para sacar "hoy" (`getFechaHoy`, `fechaLocalISO`).
- **Concurrencia entre dos personas:** dos reservas del mismo horario, el `EXCLUDE`. Cliente que cancela y
  barbero que cobra a la vez: gana el primero y el otro recibe su 409 (o, en el iPad, el corte entra sin
  turno). Dos cobros del mismo turno: 409 y `corte_turno_unico`. Barbero que marca "no asistió" y admin que
  completa: el `WHERE` de cada uno. Dos asignaciones de cliente: `cliente_id IS NULL`. No encontré ninguna
  carrera fuera de las ya aceptadas (reserva contra ausencia o descanso en el mismo instante).
- **Recordatorios:** el claim es un solo `UPDATE ... WHERE recordatorio_enviado_en IS NULL` antes de enviar: dos
  corridas no mandan dos mails. Opt-in estricto (`activo === true`); hoy solo demo lo tiene. Un turno cancelado
  no entra al lote. Un turno sin mail se saltea antes del claim.
- **Calendar:** todas las llamadas atrapan su error y devuelven `null` o `false`: una falla de Google no rompe
  la reserva, la cancelación ni la reprogramación. Cancelar por cualquiera de los cinco caminos borra el
  evento; reprogramar lo actualiza. Sin mail del barbero no se crea evento. Un evento solo puede quedar
  huérfano si Google falla justo al cancelar (aceptado en `decisiones_turnero.md`, queda un `console.error`).
  Al evento van el nombre, el teléfono y el mail del cliente, que el barbero ya ve en su app.

**Sin revisar:** el render completo de `SeccionTurnero` (se leyeron el detalle del turno, las acciones y qué
pide), `CrearTurno.jsx` y `HojaReservar.jsx` (solo qué mandan), `Gestion.jsx` de la app del barbero (solo el
flujo de la ausencia) y `descansosSemanal` de Planillas. No se ejecutó nada: `unirDescansos` y el algoritmo de
slots se revisaron leyendo, sin casos de prueba.

### Para otra zona

- **Zona 8:** `duracion_slot_minutos` acepta de 1 a 240 (`turneroConfig.js:42`). Con un valor muy chico, cada
  consulta pública de disponibilidad arma cientos de slots por barbero y por día, y `/dias-disponibles` lo
  repite por 15 días. Además, cambiarlo no avisa que mueve la grilla de todos los barberos y la duración de
  todos los servicios.
- **Zona 8:** las cascadas del feriado y del horario del local hacen, turno por turno y en serie, un `UPDATE`,
  una llamada a Calendar y un mail, dentro del mismo request: con decenas de turnos son decenas de segundos.
- **Zona 7:** el lote de recordatorios escribe en el log el nombre y el mail del cliente
  (`recordatoriosService.js:154` y `:161`).
- **Zona 6:** en el Turnero del panel, "Completar" aparece en turnos de días futuros (Z5-05), y el borrado de
  un corte en Caja no dice que el corte tiene un turno (Z5-04).
- **Docs:** `SQL_Schema.md` no nombra `tenant_feriado_fecha_unica UNIQUE (tenant_id, fecha)` ni
  `turno_rango_valido CHECK (fin > inicio)`, que existen en la DB. El comentario de `caja.js:305-306` dice que
  el registro "solo completa turnos reservado": también completa `no_asistio`.

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
