# Formulario de alta de clientes — núcleo de decisiones

> ✅ **Completado (2026-11-11) en `feature/alta-clientes`; pendiente de deploy** (los pasos, en
> [`estado_actual.md`](estado_actual.md) → Pendientes). Documento **archivado**: solo el "por
> qué". El plan con sus fases y lo verificado en cada una está en
> [`plan_alta_clientes.md`](plan_alta_clientes.md). Cómo se da de alta un cliente, en
> [`onboarding.md`](onboarding.md). Schema en [`SQL_Schema.md`](SQL_Schema.md) (`solicitud_alta`).
> Implementación: backend `routes/alta.js`, `controllers/alta.js`, `utils/validarSolicitudAlta.js`,
> `utils/subdominio.js`, `enmascararTokensEnRuta` (`utils/sanitizarLogs.js`), `limiterAlta` y
> `limiterAltaEnvio` (`middlewares/rateLimitMiddleware.js`), `enviarAvisoSolicitudAlta`
> (`services/mail/mailer.js`); front `frontend-alta/`; skill `.claude/skills/alta-cliente/`.

## Problema que resolvió

Para dar de alta una barbería, Facundo le pedía los datos al cliente por WhatsApp y los cargaba a
mano entre `crearTenant.js`, SQL y el panel. Ahora el cliente nuevo completa todo por su cuenta
desde un link privado (`alta.barbermanager.app/<id>`), casi siempre en el celular, y Facundo le
pasa el mail del aviso a la skill `alta-cliente`, que revisa la solicitud y arma la query de alta.
La prioridad fue la experiencia: que completarlo no se sienta como trabajo y se vea profesional.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Qué guarda el formulario (D1) | Una **solicitud** (`solicitud_alta.datos`, jsonb). Facundo la lee y da el alta; nada se crea solo. | Facundo controla cada alta antes de crear nada, y no hay un script de alta nuevo que mantener. |
| Acceso (D2) | Link privado por cliente: el token es el `id` (uuid v4) de la solicitud. Vence a los 30 días. | Evita spam y solicitudes falsas sin captcha: un uuid v4 no se adivina. |
| Credenciales (D3) | El formulario **no pide PINs ni contraseñas**. Se definen al armar la query y Postgres los hashea ahí con `extensions.crypt(…, extensions.gen_salt('bf', 10))`. | Los logins comparan con `bcrypt.compare`, y el hash `$2a$10$` de pgcrypto pasa (verificado con la prueba punta a punta). No se toca el login. |
| Imágenes (D4) | Fuera del formulario: el cliente las sube desde el panel (Gestión → Negocio). | El flujo ya existía; subir archivos complicaba mucho la primera versión. |
| Front propio (D5) | `frontend-alta`, en `alta.barbermanager.app`, sin tenant. | No depende de un tenant existente; meterlo en la landing mezclaría marketing con operación, y la landing se pre-renderiza. |
| Identidad (D6) | **Luz** (acento indigo), con la densidad y el movimiento del turnero. Superficie "Alta" en `sistema_de_disenio.md` §3.9, clases `al-`. | El cliente viene de la landing y sigue en el panel. El blanco y negro es del turnero, la cara al cliente final. |
| Tono (D7) | La diversión está en la respuesta a cada toque: botones grandes, avatares que aparecen, barras que cambian, una tarjeta "Tu barbería" que crece. Sin confeti ni ilustraciones. Una pregunta por pantalla, cuatro capítulos en vez de "paso N de 13". | El sistema de diseño prohíbe lo infantil y la animación decorativa, y tenía que verse profesional. |
| Validación (D8) | Las mismas reglas en el front (al salir del campo y al tocar "Seguir", con foco en el primer error) y en el backend al enviar. Mismos `campo` y **mismos mensajes**. | Se ve profesional y el backend nunca confía en el front. Un error del backend se muestra igual que uno del front. |
| Suscripción (D9) | No se pide: la fecha la decide Facundo en la query (por defecto, fin de mes). | Decisión de Facundo. |
| Pausa del mediodía (D11) | Solo parte en dos el horario de los barberos "igual al local". Un horario propio puede cubrir la pausa; el front lo precarga ya partido. | En la DB el local tiene un rango por día: la pausa no es un dato, es un atajo para armar `barbero_horario`. Hay barberos que trabajan de corrido. |
| Largo del turno (D12) | De 10 a 60 min de a 5, con una barra (antes, 15/20/30/40/45/60). | Decisión de Facundo. `duracion_slot_minutos` acepta de 1 a 240 y el sistema ya anda con largos que no dividen la hora. |
| Alta (D13) | Skill de proyecto `alta-cliente`: con el id del mail lee y verifica la solicitud, propone credenciales **simples** (todavía no hay recuperación de PIN), arma la query y, después del alta, la verifica y arma el mensaje de WhatsApp para el cliente. Nunca escribe en la DB. | Un flujo repetible con las reglas escritas, en lugar de armar la query a mano en cada alta. |

## Decisiones técnicas que salieron de la implementación

**Backend (`/api/alta`)**
- **Montado antes del log de acceso global y de `tenantMiddleware`.** Todavía no hay tenant, y
  el log global escribe el body, que acá trae nombres, mails y teléfonos. El router tiene su
  propio log de acceso (método, ruta enmascarada, status y duración, sin body; saltea los PUT
  exitosos del autoguardado) y cierra con un 404 propio, así ninguna ruta suelta llega al log
  global. Los logs del controller llevan la `referencia`, nunca el id.
- **El token se enmascara en toda ruta escrita** (log, rate limiter y Sentry):
  `enmascararTokenTurnero` pasó a `enmascararTokensEnRuta` y tapa también `/api/alta/<token>` y
  el subdominio consultado.
- **El envío trae `datos` entero** y lo guarda normalizado en la misma sentencia condicional que
  pasa a `enviada`: lo validado es exactamente lo que queda guardado, aunque el último
  autoguardado no haya llegado. Primero se chequea el token (un link falso no sirve para
  averiguar subdominios), después se valida.
- **Escrituras en una sola sentencia condicional** (`WHERE estado = 'borrador' AND vence_en >
  now()`); con 0 filas se relee para distinguir 404 de 409. Un vencido da 404 en todos los
  endpoints.
- **Rate limit:** 120/min por IP para leer, guardar y consultar el subdominio (el autoguardado
  más la consulta del link pasan los 60), y 5/hora para enviar.
- **Aviso por mail best-effort**, después de responder, a `ALTA_AVISO_EMAIL`: referencia,
  negocio e id, sin más datos del cliente.
- **Handler de errores del parseo del body** (`index.js`, global): un JSON roto o un body de más
  de 100 kB responden 400/413 en JSON y se loguean con `console.warn`. Antes Express imprimía el
  stack con `console.error`, y eso llegaba a Sentry y a Discord.

**Frontend**
- **El motor del autoguardado vive fuera de React** (`utils/autoguardado.js`, probado en Node):
  debounce de 800 ms, un solo PUT en vuelo, reintento con el botón, el evento `online` y el
  próximo cambio, y envío inmediato con `keepalive` al ocultarse la página (el cliente cierra
  WhatsApp sin avisar).
- **El envío pausa el autoguardado** (`pausar` / `reanudar`): espera el PUT en vuelo y no programa
  otro. Un PUT que llegara después del envío daría 409 y se leería como "se envió desde otro
  lado". Después de un envío exitoso se muestra "Listo" sin releer la solicitud.
- **Los errores del backend se guardan con la huella del valor de su campo**
  (`utils/erroresServidor.js`) y se muestran en su pantalla como uno del front. Desaparecen apenas
  el cliente cambia ese valor.
- **Los datos de interfaz van en `progreso`** (país del teléfono, "mismo número", días con horario
  propio, etc.): al enviar, el backend guarda solo las claves de la forma de `datos`. La lista
  está en el plan §5.6.
- **Navegación con el historial del navegador**: el "atrás" del celular vuelve un paso, y al abrir
  el link en otro dispositivo se rearma el historial hasta la pantalla guardada. El modo "Editar"
  de la Revisión se lee de la pila.
- **Dirección en partes** (calle, altura o "sin número", piso, provincia, ciudad o barrio), armada
  en un solo texto en `local.direccion`: el backend, la plantilla y el turnero no cambian.
- **`libphonenumber-js` con carga diferida** desde la pantalla 8: el JS inicial bajó de 140,7 a
  105,6 kB con gzip.

**La query de alta** (`.claude/skills/alta-cliente/plantilla_alta.sql`)
- **Una sola sentencia con CTEs:** atómica sin `BEGIN`/`COMMIT` y sin copiar uuids a mano.
- **Lee los datos directo de `solicitud_alta.datos`.** A mano van solo los parámetros (id, PINs,
  usuario, contraseña y vencimiento), que `armarQuery.mjs` valida, escapa y comprueba con
  `EXPLAIN`. Así un `O'Brien` no rompe la query y no hay datos transcriptos.
- **El WhatsApp argentino sin el 9 se carga con el 9** (el formulario lo guarda como el turnero,
  sin el 9; `wa.me` lo necesita).
- **`booking_url` con el turnero propio** (`https://<subdominio>.barbermanager.app/turnos`): es el
  botón "Reservar" del panel. Faltaba en la primera versión y salió en la prueba punta a punta.
- No activa el recordatorio por mail (sigue siendo opt-in).

## Cómo mantenerlo

- **Reglas duplicadas a propósito** (los fronts no comparten código con el backend):
  `backend/src/utils/validarSolicitudAlta.js` ↔ `frontend-alta/src/utils/validaciones.js`, y
  `backend/src/utils/subdominio.js` ↔ `frontend-alta/src/utils/subdominio.js`. Si cambia una
  regla o un mensaje, cambia en los dos.
- **La forma de `datos` tiene versión** (`version: 1`). La plantilla de la skill depende de ella:
  si cambia la forma, cambian la plantilla y `leerSolicitud.mjs`.
- **Las 9 categorías de gasto** están en `CATEGORIAS_GASTO_BASE` (`crearTenant.js`) y en la
  plantilla.
- **Cruce con `feature/mejoras-operativas` (F6):** agrega `tenant.email_duenio`,
  `tenant.telefono_duenio` y `telefono_local` (reemplaza `telefono`), y cambia `crearTenant.js` y
  `onboarding.md`. El formulario ya pide esos datos (`contacto` y `local.telefono`). Al hacer F6,
  la plantilla pasa a las columnas nuevas. Hay que anotarlo en `plan_mejoras_operativas.md` al
  rebasar ese branch (el archivo vive solo ahí).

## Lo que se probó

- Backend: 137 casos con controllers y req/res simulados contra la DB (cada regla de validación,
  tokens mal formados, vencidos, doble envío, enmascarado), más los casos HTTP del montaje, el 404
  del router, el limiter y el 413.
- Front: cada fase en modo celular en el browser pane, incluido el envío real con sus carreras
  contra el autoguardado, sin red, 409, 404 y 429; reducir movimiento emulado con CDP.
- **Punta a punta (2026-11-11):** Facundo completó el formulario como cliente con front y backend
  locales; la skill armó la query; corrió en el SQL Editor; la verificación confirmó PINs y
  contraseña con `bcrypt.compare`; y en producción entraron el login operativo, el PIN de admin y
  el de un barbero, y el turnero mostró turnos. El tenant de prueba (`pepe-barber`) quedó dado de
  baja (`activo = false`).
- **Sin probar todavía:** un celular real (teclado abierto con el "Seguir" visible, lector de
  pantalla, reducir movimiento del sistema) y la vista previa del link en WhatsApp, que necesita
  el dominio publicado.
