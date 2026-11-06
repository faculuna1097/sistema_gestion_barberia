# Rediseño UX/UI del turnero — núcleo de decisiones

> ✅ **Implementado** en el branch `feature/turnero-ux` (2026-10-05 a 2026-10-08), más un hotfix previo
> en `main`. En producción desde el 2026-11-05; la prueba en celulares reales está en
> [`estado_actual.md`](estado_actual.md) → Pendientes. Documento **archivado**: solo el "por qué". La
> identidad visual vigente vive en [`sistema_de_disenio.md`](sistema_de_disenio.md) §3.8; las rutas en
> [`ruta_proyecto.md`](ruta_proyecto.md); el schema en [`SQL_Schema.md`](SQL_Schema.md); el alta de
> WhatsApp y reseñas en [`onboarding.md`](onboarding.md). Las decisiones de base del turnero (disponibilidad al
> vuelo, EXCLUDE GIST, Calendar) siguen en [`decisiones_turnero.md`](decisiones_turnero.md).

## Contexto y objetivo

La landing del turnero era una tarjeta de perfil genérica que dejaba un tercio de la pantalla en
blanco; el flujo tenía 6 pantallas rígidas sin "cualquier barbero"; y la UI era el "Luz" del panel
(indigo) aunque la usa el cliente final. Casi todos los clientes usan **iPhone y entran desde el link de
Instagram**, que abre el navegador interno de Instagram.

Objetivo: que se diferencie de los turneros tradicionales sin volverse un juego (es una página para
sacar un turno). Landing "vidriera" que ahorre pasos, flujo corto, identidad propia, movimiento con
propósito, y los bugs de la revisión corregidos.

## Decisiones de producto (usuario, 2026-10-05 a 2026-10-08)

| Tema | Decisión |
|---|---|
| Landing | Vidriera: foto del local a sangre, servicios y barberos tocables que preseleccionan y saltean pasos |
| Identidad | Propia, clara, en blanco y negro (acento casi negro). Se mantiene Geist. Sin tema por barbería ("solo tengo un cliente") |
| Flujo | 3 pasos: Servicio → ¿Cuándo? (barbero + día + horario) → Confirmá tu turno (resumen + datos) → Éxito |
| "Cualquier barbero" | Primera opción, en un renglón propio. Asigna al que tenga menos turnos ese día; empate, alfabético |
| Días | Grilla semanal (lunes a domingo, 15 días en 3 renglones), sin scroll |
| Horarios | Una sola grilla, sin agrupar por mañana, tarde y noche (ahorra alto) |
| Movimiento | Transiciones sí, con propósito y respetando "reducir movimiento". Sin ticket |
| Calendario | "Agregar al calendario" en el éxito y en la gestión del turno |
| Autocompletado | Obligatorio |
| WhatsApp | Botón solo si se carga el número |
| Reseñas en Google | Link en la landing + QR impreso en la puerta. Sin mail post-turno ("la mayoría lo ignora") |
| Origen del cliente | Cada turno guarda por qué link llegó (`?origen=instagram`) |
| Sistema de diseño | La fuente de verdad se muda del turnero al panel (`frontend/`) |
| Descartados | "Turno rápido / primer turno disponible" (no convenció cómo se veía; lo reemplaza "Cualquier barbero"), ticket, galería de trabajos, tema por barbería, "recordarme en este celular", código de acceso por mail |

### Login sin fricción: por qué no hay login

Se evaluaron "recordarme en este celular" y un código por mail. Se descartaron los dos:
- **Recordarme no sirve con el público real.** Safari (ITP) borra lo guardado por un sitio después de 7
  días sin interacción, y el navegador interno de Instagram en iPhone usa el mismo motor (WKWebView): el
  dato no sobrevive entre visitas espaciadas, que es el caso de una barbería.
- **El código por mail agrega un paso sin resolver nada:** para administrar el turno ya están el mail de
  confirmación y el de recordatorio, con el link de gestión.
- Lo que sí baja la fricción: el **autocompletado** del navegador (`name`/`autoComplete` en cada campo,
  dentro de un `<form>`) y la normalización del teléfono que entrega (`+54 9 11 …` u `011 15 …` → país
  + número nacional de 10 dígitos).

## Decisiones técnicas — backend

- **"Cualquier barbero" es un modo de la disponibilidad, no un endpoint nuevo.** `barbero_id` pasa a ser
  opcional en `GET /api/turnero/disponibilidad` y `/dias-disponibles`. Con `barbero_id`, la respuesta es
  idéntica a la de antes (la usa la app del barbero). Sin él: `/disponibilidad` → `{ slots, asignaciones:
  { [ISO]: barbero_id } }` y `/dias-disponibles` → `{ dias }` (la unión de los barberos activos).
- **`POST /api/turnero/turnos` no cambia:** el front manda el `barbero_id` que asignó la regla. Así el
  backend no tiene un camino nuevo de creación, y el EXCLUDE GIST sigue siendo la protección contra el
  doble turno.
- **Regla en un helper puro** (`elegirBarbero`): cuenta los turnos del día por barbero con los datos ya
  cargados, sin query extra. Desempate: nombre con `localeCompare('es', { sensitivity: 'base' })`, y
  después el id (determinístico).
- **Un solo cargador de agenda** (`cargarDatosAgenda`, `barbero_id = ANY($n::uuid[])`): reemplazó el
  bloque de 7 queries que estaba duplicado. Set fijo de queries, independiente de cuántos barberos o
  días. Verificado con la salida de antes y después del refactor, idéntica para cada barbero del demo.
- **Tope de 62 días** en el rango de `/dias-disponibles` (`DIAS_MAXIMOS_RANGO_DISPONIBILIDAD`): con
  "todos los barberos", un rango sin tope es una consulta cara a pedido de un anónimo.
- **Normalizar en el borde del backend** (convenciones §4): `getTurnoPorToken` devuelve `inicio`/`fin` con
  offset `-03:00` (pg devuelve `Date` y se serializaba en UTC, y el front cortaba el día con
  `slice(0, 10)`: un turno de las 21:00 aparecía al día siguiente); `precio` como número.
- **WhatsApp y reseñas como datos del tenant** (`tenant.configuracion.whatsapp` y `.resena_url`), sin
  columnas nuevas: `getTenant` los expone validados (E.164 / `https://`) o `null`, y el front muestra el
  botón o el link solo si vienen.
- **`turno.origen_link`** (text, nullable, CHECK `^[a-z0-9_-]{1,30}$`): dato de marketing, **nunca
  rechaza una reserva**. Si no cumple el formato, se guarda `null`. Misma regla en el front
  (`leerOrigen`) y en el backend (`normalizarOrigen`). No confundir con `origen_creacion` (quién creó
  el turno: turnero, barbero o admin).

## Decisiones técnicas — reseñas en Google

- Google no deja publicar reseñas por API: solo se puede llevar al cliente al formulario. El link lo saca
  el dueño desde "Pedir reseñas" de su Perfil de Empresa.
- **Indirección propia:** el link de la landing y el QR de la puerta apuntan a `/turnos/resena?origen=…`,
  que redirige a `resena_url`. Si Google cambia el link, se actualiza el dato y el cartel impreso sigue
  andando.
- **Reglas de Google:** sin incentivos a cambio de la reseña y sin filtrar a los contentos (el link es
  para todos).
- Google no informa qué cliente dejó la reseña: lo que se puede medir es quién la pidió o escaneó el QR
  (queda para "Base de clientes").

## Decisiones técnicas — front

- **Identidad:** el acento pasa de indigo a zinc-900 y el fondo a blanco; Geist y las reglas del sistema
  se mantienen. Detalle vigente en `sistema_de_disenio.md` §3.8.
- **Navegación integrada al historial** (`useNavegacion`): una pila de pantallas con `pushState`/`popstate`
  y un id de flujo. El "atrás" del celular vuelve un paso en vez de sacar al cliente del turnero. Al
  confirmar, `cerrarFlujo` reemplaza la pantalla por el éxito, así el "atrás" no vuelve a la confirmación
  ni puede reenviar la reserva. Una entrada vieja o una recarga vuelven a la landing. La dirección de la
  navegación decide la de la transición.
- **Datos compartidos:** servicios y barberos se piden una vez en `App` (`useListaRemota`, con
  "Reintentar"), en paralelo con el tenant, y bajan por props.
- **Movimiento con propósito:** la opción tocada queda marcada ~150 ms antes de avanzar
  (`useEleccionConPausa`), las pantallas entran con dirección, los horarios aparecen escalonados con tope
  y la tilde del éxito entra sin rebote. Con "reducir movimiento", fundido corto o nada.
- **Datos separados de la presentación en "¿Cuándo?":** `useDisponibilidad` pide días y horarios, elige
  el día y descarta respuestas viejas (cada respuesta se guarda con la clave de su pedido y solo se
  muestra si coincide con la actual); `SelectorDiaHorario` solo dibuja. Lo comparten "¿Cuándo?" y la
  reprogramación. **Nunca se cachea la disponibilidad.**
- **La reserva se escribe recién al tocar un horario** (barbero, `barberoAsignado` y horario juntos): un
  cambio de barbero sin elegir horario no la toca. Al cambiar de barbero se conserva el día si el nuevo
  tiene lugar. Al cambiar de servicio se descarta el horario elegido antes.
- **Días con y sin lugar se distinguen por forma, no solo por color:** con lugar, caja con borde y número
  fuerte; sin lugar, sin caja y texto suave. Se descartaron el número tachado (se lee como "cancelado") y
  ocultar los días (los huecos no se ven).
- **"Confirmá tu turno" en una sola pantalla:** el resumen arriba, los datos abajo y el botón siempre
  habilitado: si falta algo, marca los errores y enfoca el primero (antes el botón quedaba deshabilitado
  sin decir por qué). El email se valida con la misma regex que el backend.
- **409 con "Cualquier barbero":** un solo GET de la disponibilidad del día; si el horario sigue libre con
  otro barbero, la reserva pasa a ese barbero y se reintenta **una vez**. Si no, "Ese horario se acaba de
  ocupar" y el botón pasa a "Elegir otro horario". Con un barbero elegido a mano, no se reintenta (el
  cliente lo eligió a él).
- **Errores del envío en el pie fijo**, arriba del botón (`role="alert"`), para que se vean aunque el
  formulario esté scrolleado. Sin conexión, un texto propio en vez del "Failed to fetch" del navegador.
- **Calendario sin dependencias:** `.ics` armado a mano (CRLF, UTC, escapado, líneas partidas a 75
  bytes, aviso 1 h antes) y link de Google Calendar. En iPhone, iPad y Mac el botón baja el `.ics`
  (lo abre Calendario de Apple) y el link de abajo abre Google; en el resto, al revés. Se decide por user
  agent porque Safari no tiene otra forma (el iPad se anuncia como Mac). El UID es el `turno_id`: agregarlo
  de nuevo desde la gestión, después de reprogramar, actualiza el evento en vez de duplicarlo.
- **El origen vive fuera de la reserva:** se lee una vez al cargar y "Reservar otro turno" no lo borra
  (sigue siendo la misma visita).

## Hotfix previo (paso 1, en `main`)

Antes del rediseño salieron, en un branch propio, cuatro bugs que afectaban a producción:
- El calendario arrancaba mañana después de las 21:00 (la fecha se calculaba en UTC).
- La gestión mostraba el día siguiente en turnos de las 21:00 o más tarde.
- "Reservar otro turno" llevaba al login del panel.
- El formulario no tenía autocompletado.

## Riesgos conocidos

- Dentro del navegador de Instagram en iPhone, el `.ics` puede no abrirse. Queda el botón de la gestión
  (que el cliente abre desde el mail, en Safari). Si falla, plan B: adjuntar el `.ics` al mail de
  confirmación.
- El front de este branch omite `barbero_id` para "Cualquier barbero": backend y front tienen que salir
  juntos (ver `estado_actual.md` → Pendientes).

## Trabajo futuro (abierto)

- **Base de clientes** (próxima feature, con su propio plan): identidad por teléfono con el 9,
  unificar duplicados, ficha del cliente con visitas, faltas, origen y reseña. Ver `estado_actual.md`.
- Activar WhatsApp y cargar el link de reseñas cuando el dueño pase los datos; imprimir el QR.
- Pasar los mails del turnero del indigo al negro, si se quiere coherencia.

*— Fin del documento (archivado: núcleo de decisiones) —*
