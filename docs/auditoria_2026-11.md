# Auditoría de seguridad y calidad — 2026-11

> **Estado (2026-11-16): en curso.** Zonas 1, 2 y 3 revisadas; el resto, pendiente o en curso (ver la tabla de zonas).
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
