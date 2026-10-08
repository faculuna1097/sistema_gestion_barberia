# Plan — rediseño UX/UI del turnero

> **Documento de trabajo** del rediseño (branch `feature/turnero-ux`). Lo leen todos los chats
> ejecutores. Al cerrar, se resume en `decisiones_turnero_ux.md` y este archivo se borra.

## Contexto

La landing del turnero es una tarjeta de perfil genérica (foto, logo, nombre, 3 renglones) que deja
~1/3 de la pantalla en blanco; el flujo tiene 8 pantallas rígidas sin "cualquier barbero"; y la UI es
el "Luz" del panel (indigo) aunque la usa el cliente final. La mayoría de los clientes usa **iPhone y
entra desde el link de Instagram** (navegador interno de Instagram).

Resultado buscado: landing "vidriera" con servicios y barberos tocables (ahorran pasos), flujo de 3
pasos con "Cualquiera", identidad propia clara en blanco y negro, transiciones con propósito, agregar
al calendario y los hallazgos de la revisión corregidos.

## Decisiones (usuario, 2026-10-05)

| Tema | Decisión |
|---|---|
| Landing | Vidriera: foto a sangre, servicios y barberos tocables para preseleccionar |
| Identidad | Propia, clara, blanco y negro (acento casi negro en vez de indigo). Tipografía: **Geist** (se mantiene) |
| Flujo | 3 pasos: Servicio → ¿Cuándo? (barbero + día + horario) → Datos y confirmación → Éxito |
| "Cualquiera" | Primera opción de barbero. Asigna al que tenga menos turnos ese día; empate → alfabético |
| Movimiento | Sí, con propósito y respetando "reducir movimiento" |
| Calendario | Botón "Agregar al calendario" en éxito y en la gestión del turno |
| Autocompletado | Obligatorio (hecho en el paso 1) |
| WhatsApp | Preparado y condicional: aparece solo si se carga el número (el usuario lo consulta con el dueño) |
| Fuente de verdad del sistema de diseño | Se muda del turnero a `frontend/` |
| Reseñas en Google (2026-10-07) | Link "Dejanos tu reseña en Google" en la landing + QR impreso en la puerta del local. Sin mail post-turno |
| Origen del cliente (2026-10-07) | Cada turno guarda por qué link llegó el cliente (`?origen=instagram`) |
| Fuera | Tema por barbería, ticket, turno rápido / primer turno disponible, galería de trabajos, "recordarme en este celular" (el navegador de Instagram en iPhone no conserva lo guardado), código por mail |

## Diseño

### Backend

**"Cualquier barbero"** — `barbero_id` pasa a ser opcional en `GET /api/turnero/disponibilidad` y
`GET /api/turnero/dias-disponibles` (`backend/src/controllers/turnero.js`):
- Con `barbero_id`: respuesta idéntica a hoy. La usa la app del barbero
  (`frontend-barbero/src/components/CrearTurno.jsx`).
- Sin `barbero_id`: `/disponibilidad` → `{ slots: [ISO], asignaciones: { [ISO]: barbero_id } }` (unión
  de los barberos activos; cada horario con el barbero que asigna la regla). `/dias-disponibles` →
  `{ dias }` (unión).
- `POST /api/turnero/turnos` no cambia: el front manda el `barbero_id` asignado. Ante un 409 en modo
  "Cualquiera", el front vuelve a pedir la disponibilidad del día y, si el horario sigue libre con otro
  barbero, reintenta una vez; si no, muestra el error y vuelve a los horarios.

**Refactor de `backend/src/services/disponibilidadService.js`**: un cargador único
`cargarDatosAgenda({ tenantId, servicioId, barberoIds, desde, hasta })` con set fijo de queries
(`barbero_id = ANY($n)`; con "todos", primero los barberos activos del tenant). Lo usan
`calcularSlotsDisponibles` y `calcularDiasConDisponibilidad` (firmas y salidas intactas) y las nuevas
`calcularSlotsCualquiera` y `calcularDiasCualquiera`. Reusa `computarSlotsDeUnDia` sin cambios y elimina
el bloque de 7 queries hoy duplicado. Regla en un helper puro `elegirBarbero` (cuenta los turnos del día
por barbero con los datos ya cargados, sin query extra).

**De paso en `turnero.js`**: `REGEX_FECHA` → `esFechaISO` (`utils/validarFecha.js`; paga parte de la
deuda "REGEX_FECHA copiada en 5 controllers"); `precio` como número en `getServicios` y
`getTurnoPorToken` (deuda "Montos como texto"; la app del barbero lo pasa por `fmtPesos`, compatible);
`getTenant` expone `whatsapp` desde `tenant.configuracion.whatsapp` (E.164 validado; `null` si falta)
y `resena_url` desde `tenant.configuracion.resena_url` (URL https validada con `esUrlHttps`; `null`
si falta). Sin cambios de schema.

**Reseñas en Google**: Google no permite publicar reseñas por API; solo se lleva al cliente al
formulario. El link de la landing y el QR de la puerta apuntan a una ruta propia del turnero,
`/turnos/resena?origen=landing|qr`, que redirige a `resena_url`. Esa indirección hace que el QR impreso
siga andando si Google cambia el link (se actualiza el dato, no el cartel). Sin `resena_url`, la ruta
vuelve a la landing y el link no se muestra. Reglas de Google: sin incentivos a cambio de la reseña y
sin filtrar a los clientes contentos (el link es para todos). El link lo saca el dueño desde "Pedir
reseñas" de su Perfil de Empresa de Google (`g.page/r/…/review`).

**Origen del cliente**: el front lee `?origen=` al cargar (ej. el link de la bio de Instagram:
`/turnos?origen=instagram`), lo conserva en memoria durante el flujo y lo manda en
`POST /api/turnero/turnos`. Columna nueva `turno.origen_link` (text, nullable; el SQL lo corre el
usuario, con RLS ya activo en la tabla). El backend acepta `origen` opcional validado con
`^[a-z0-9_-]{1,30}$` (si no cumple, se guarda `null` sin rechazar la reserva). No confundir con
`turno.origen_creacion` (turnero/barbero/admin).

### Front — base

- **Identidad** (`frontend-turnero/src/theme/tokens.js`): fondo blanco; `accent` pasa de indigo a
  zinc-900 (`#18181B`) con su variante de hover (zinc-800) y `accentSoft` neutro; estados
  (success/danger/warning) sin cambios; Geist se queda. Ajustar los usos que dependen del indigo
  (anillo de foco en `index.css`, hover del `Button` primario por `filter: brightness`, punto de "hoy").
- **Navegación con historial** (`App.jsx`): de `paso` numérico a una pila de pantallas con
  `history.pushState` / `popstate`. El "atrás" del celular vuelve un paso; "Volver" regresa a donde vino
  el usuario (las entradas desde la landing saltean pasos). Guarda la dirección para las transiciones.
- **Datos compartidos**: `servicios` y `barberos` se cargan una vez en `App.jsx`, en paralelo con tenant
  e imágenes (hoy cada pantalla los pide de nuevo) y bajan por props.
- **Movimiento**: transición de pantalla con dirección (~240 ms, ease-out-quart; reemplaza el `om-fade`
  uniforme de `PageContainer`); la opción tocada se marca ~150 ms antes de avanzar; horarios escalonados
  al cambiar de día (tope ~200 ms); skeleton → contenido con fundido; éxito sin rebote. Con
  `prefers-reduced-motion: reduce`, fundido corto o nada. Keyframes y unas pocas clases de pseudo-estado
  (`:active`) en `index.css`, documentadas como excepción (como los `om-` de la landing de marketing);
  el resto sigue inline.
- **Helpers** (`src/utils/`):
  - `fecha.js`: `fechaLocalISO` y `fechaDeISO` (ya existen, paso 1) + `DIAS_RESERVABLES = 15` (hoy 15
    en el flujo y 14 en reprogramación).
  - `rutas.js` (nuevo): `RUTA_TURNERO` (de `import.meta.env.BASE_URL`) y `rutaGestion(token)`; los usan
    `App.jsx` (regex del token), éxito, `GestionTurno` y el calendario.
  - `calendario.js` (nuevo, **paso 6**, donde se usa): `armarIcs(evento)` y `linkGoogleCalendar(evento)`.
  - `telefono.js` (existe, paso 1): sumar `fmtTelefono(tel)` en el **paso 4**, donde se muestra el
    teléfono del local.
- **Limpieza**: borrar `src/assets/{hero.png,react.svg,vite.svg}`, `src/App.css`, `public/icons.svg`.

### Landing (vidriera) — `screens/Landing.jsx`

Una columna, botón "Reservar turno" fijo abajo:
1. **Hero**: foto del local (`tipo='local'`, orden 1) de borde a borde (~45% del alto), degradado
   inferior para leer el texto, logo + nombre + estado abierto/cerrado. Sin foto: bloque liso con el logo
   (no el placeholder "FOTO DEL LOCAL").
2. **Servicios**: filas (nombre, duración, precio). Tocar → "¿Cuándo?" con el servicio elegido.
3. **Equipo**: barberos (avatar de iniciales + nombre). Tocar → Servicio con el barbero preseleccionado.
4. **Info**: horario semanal desplegable (`HorarioSemanal`, se conserva), dirección → Maps, teléfono
   formateado, botón de WhatsApp solo si `tenant.whatsapp` viene cargado y link "Dejanos tu reseña en
   Google" solo si `tenant.resena_url` viene cargado (apunta a `/turnos/resena?origen=landing`).

Ruta `/turnos/resena` (en `App.jsx`, junto a la de gestión): redirige con `window.location.replace`
a `tenant.resena_url`, o a la landing si no hay. Archivo del QR para imprimir (SVG, apuntando a
`https://{subdominio}.barbermanager.app/turnos/resena?origen=qr`), generado con un script fuera del
repo (sin sumar dependencias al front) y entregado al usuario.

Skeleton de carga con la silueta real (hoy usa 16:9 y avatar 80 contra 4:3 y 96). `fechaLocalStr` de
`Landing.jsx` se reemplaza por `fechaLocalISO`.

### Flujo de 3 pasos

Entradas: CTA → Servicio · servicio de la landing → ¿Cuándo? · barbero de la landing → Servicio (con
barbero) → ¿Cuándo?

1. **Servicio** (`SeleccionServicio.jsx`): lista con los datos de App, sin fetch propio.
2. **¿Cuándo?** (`SeleccionCuando.jsx`, nuevo; reemplaza `SeleccionBarbero`, `SeleccionFecha` y
   `SeleccionHorario`): chips de barbero ("Cualquiera" primero y por defecto, salvo preselección) → tira
   de días (`DIAS_RESERVABLES`, los sin lugar grisados, nombre del mes cuando cambia) → horarios del día
   por mañana/tarde/noche. Al entrar se elige solo el primer día con lugar; cambiar de barbero recarga
   días y horarios. Tocar un horario → Datos (en "Cualquiera", el barbero sale de `asignaciones`).
   Componente reusable `SelectorDiaHorario` (`components/ui/`), también para la reprogramación;
   reemplaza a `MiniCalendario` y reusa `SlotChip`. Los días con `aria-label` legible ("martes 6 de
   octubre"), no el ISO crudo.
3. **Datos y confirmación** (fusiona `DatosCliente.jsx` con la vista "Revisar" de `Confirmacion.jsx`):
   resumen (día y hora, servicio, barbero —"te atiende X" si vino de Cualquiera—, precio "se paga en el
   local") → nombre, teléfono y email (conservar el `<form>`, los `name`/`autoComplete` y
   `normalizarTelefonoCompleto` del paso 1) → "Confirmar turno". Botón habilitado: si falta algo marca
   los errores y enfoca el primero. `Field` con `aria-invalid` y `aria-describedby` (§5.2 del sistema de
   diseño). Reintento automático del 409 en "Cualquiera".
4. **Éxito**: "Listo, {nombre}. Te esperamos el {día} a las {hora}", resumen, "Agregar al calendario"
   (iPhone/Mac → `.ics`; resto → Google Calendar; link secundario al `.ics`), "Cómo llegar" (si hay
   dirección), "Ver o cambiar mi turno", "Reservar otro turno". Se mantiene el aviso de spam.

Progreso: barra fina de 3 tramos (los salteados, completos), sin el "Paso X de 6" + "01/06" duplicado.
`SummaryRow` del turnero a 14 px al tocarlo (deuda de `estado_actual.md`).

**Riesgo conocido del calendario**: dentro del navegador de Instagram en iPhone, el `.ics` puede no
abrirse. La gestión del turno (que el cliente abre desde el mail, en Safari) también tiene el botón. Si
falla dentro de Instagram, se evalúa aparte adjuntar el `.ics` al mail de confirmación.

### Gestión del turno — `screens/GestionTurno.jsx`

- "Agregar al calendario" para turnos reservados (reusa `calendario.js`).
- Reprogramación con `SelectorDiaHorario` (barbero fijo, `DIAS_RESERVABLES`).
- Rutas con `rutas.js`.

## Hallazgos y dónde se corrigen

| # | Hallazgo | Paso |
|---|---|---|
| 1 | `generarProximosDias` usaba fecha UTC (después de las 21:00 arrancaba mañana) | 1 ✅ |
| 2 | Formulario sin `autocomplete` ni `name` | 1 ✅ |
| 3 | Gestión mostraba el día siguiente en turnos ≥ 21:00 | 1 ✅ |
| 4 | "Reservar otro turno" / "Ir al inicio" llevaban al login del panel | 1 ✅ |
| 5 | `precio` como string y `REGEX_FECHA` local en la API del turnero | 2 |
| 6 | El "atrás" del celular sale del turnero y pierde lo elegido | 3 |
| 7 | Archivos muertos del scaffold | 3 |
| 8 | Horizonte 15 días en el flujo vs. 14 en reprogramación | 3 |
| 9 | Skeleton de la landing distinto al layout real (salto al cargar) | 4 |
| 10 | Teléfono del local sin formato ("1133111686") | 4 |
| 11 | "Octubre De 2026", un solo mes aunque el rango cruce de mes, `aria-label` con el ISO crudo | 5 |
| 12 | Progreso duplicado ("Paso 1 de 6" + "01/06") | 5 |
| 13 | Botón "Revisar reserva" deshabilitado sin decir por qué; `Field` sin `aria-invalid`/`aria-describedby` | 6 |
| 14 | Rebote en la animación de éxito (detector) | 6 |

Deudas nuevas detectadas en el paso 1, para `estado_actual.md` en el paso 7 (no se resuelven acá):
- Los celulares argentinos se guardan en E.164 **sin el 9** (`+5411…`). Hay que decidirlo antes de usar
  el teléfono del cliente para mensajes de WhatsApp (que usan `+549…`).
- Tipear a mano un número que empieza con `+` se traba a los 10 dígitos (el tope cuenta el código de
  país). Pegar o autocompletar funciona. Menor, ya pasaba antes.
- `sistema_de_disenio.md` §8 da como ejemplo que el `Field` del turnero no acepta `autoComplete`; desde
  el paso 1 sí lo acepta.

Del paso 2:
- Un `barbero_id`/`servicio_id` con formato que no es uuid da 500 en la disponibilidad (error 22P02 de
  Postgres; con `ANY($2::uuid[])` también el formato con llaves). Los fronts reales siempre mandan uuid
  válidos. Resolverlo con el mismo criterio que los otros casos de id inválido (auditoría, hallazgo
  UUID 22P02).
- La deuda "REGEX_FECHA copiada en 5 controllers" queda en 4; "Montos como texto" ya no aplica al
  turnero.
- La query de barberos activos de `controllers/barberos.js` duplica `listarBarberosActivos` (ya anotado
  en general como "Duplicación parcial de endpoints `/api/barberos` y `/api/turnero/barberos`").

Del paso 3:
- Resueltas en el paso (para registrarlas en el paso 7):
  - La deuda "El path `/turnos/gestionar/` está hardcodeado en tres lugares" de `estado_actual.md`: los
    dos del front pasan a `utils/rutas.js`; queda el del backend (`turnosService.js#armarLinkGestion`).
  - `om-fade` retenía `transform: translateY(0)` y convertía a `PageContainer` en bloque contenedor de los
    `position: fixed`: el overlay del `ConfirmDialog` de la gestión quedaba atado a la columna (en desktop
    cubría solo la columna; con la página scrolleada, el diálogo podía quedar fuera de pantalla). Las
    entradas `tt-` usan fill-mode `backwards` y sueltan el `transform`. No se vio en vivo (ver abajo).
  - Skeleton del `MiniCalendario`: las celdas medían 16 px de alto contra celdas cuadradas, y la grilla
    saltaba al cargar. Arreglado con `height="auto"`; medido: 43,9 px antes y después, mismo alto de grilla.
- Para los pasos 4 a 6:
  - `Skeleton` es una trampa: su `height` por defecto (16) le gana a un `aspectRatio` pasado por `style`.
    En los skeletons nuevos (landing en el 4, `SelectorDiaHorario` en el 5) pasar `height="auto"`, o
    cambiar el primitivo para que no fije alto cuando hay `aspectRatio`.
  - Reprogramación (`GestionTurno#handleSeleccionarFechaReprog`): si falla la carga de horarios muestra
    "Sin disponibilidad para esa fecha", un error disfrazado de vacío. Cubrirlo en el paso 5 con estado de
    error y reintento.
  - `SeleccionHorario` no tiene "Reintentar" en el error (Fecha, Servicio y Barbero sí). `SeleccionCuando`
    (paso 5) tiene que tenerlo.
  - En demo no hay turnos `reservado` futuros: para probar reprogramación, cancelación y `ConfirmDialog`
    hay que crear uno en demo.
  - Texto debajo de 14 px en el turnero, además de `SummaryRow` (13) y `Field` (12), que ya están en
    "Tamaños escritos a mano" de `estado_actual.md`: nota de cancelación y aviso de spam de `Confirmacion`
    (12), `BannerError`/`BannerMensaje` y las líneas secundarias de las cards de resumen (13), letras de la
    semana del `MiniCalendario` (10). Las pantallas que se rehacen en 5 y 6 pueden subirlos.
- Accesibilidad y sistema de diseño:
  - `mutedSoft` sobre el blanco nuevo da 2,56:1 (deuda #9 de `sistema_de_disenio.md`). Como texto la usan
    la nota de cancelación de `Confirmacion` (12 px), las letras de la semana del `MiniCalendario` (10 px)
    y los placeholders de imagen de `Landing`. `muted` sobre `surfaceAlt` da 4,40:1 (también la #9).
  - El botón "Volver" de `TopBar` mide ~37 px de alto (padding 8 + línea de 21), debajo de los 44 de §5.4:
    la fila mide 44, pero lo tocable es el botón.
  - Hover con `useState` (§4.2) en pantallas táctiles: iOS dispara `mouseenter` al tocar y el estado queda
    "pegado" hasta tocar otra cosa (borde gris en `Card`/`SlotChip`, `accentHover` en el primario). Casi no
    se nota porque la pantalla cambia, pero sí donde no se navega (chips de la reprogramación).
  - `om-dialog-in` y `om-shimmer` no respetan `prefers-reduced-motion` (`om-pop` ya es el hallazgo 14).
  - `index.css` repite a mano colores de `tokens.js` (fondo, foco, scrollbar) porque el CSS no puede
    importar el JS; quedó comentado. Para una sola fuente: exponer los tokens como variables CSS.
  - `Card` tiene `padding` por defecto 14, fuera de la escala 4/8/12/16/24/32.
  - `sistema_de_disenio.md` quedó viejo para el turnero: §2 (cita `om-fade` y "solo `theme.accent`
    (indigo)"), §3.1 (indigo), §4.1 (excepción de clases: sumar las `tt-`), §6.1 (`AvatarIniciales` "con
    tono determinístico por nombre"). Lo cubre en parte el paso 7.
  - `ruta_proyecto.md`: sumar `src/hooks/` (carpeta nueva), `utils/rutas.js` y `utils/movimiento.js`;
    sacar `src/assets/` y `src/App.css`.
- Backend:
  - CORS en producción: un origin no permitido recibe **500** con una página HTML de error (el callback de
    `cors` en `index.js` hace `callback(new Error(...))`) y Express deja el stack en el log por cada pedido
    así. Lo esperable es `callback(null, false)` (sin headers CORS; el navegador bloquea) o un 403.
    Verificado con curl: `Origin: http://127.0.0.1:4175` → 500.
  - `crearTurno` y `reprogramarTurno` solo exigen que el inicio sea futuro: no hay tope de horizonte. El
    front limita a `DIAS_RESERVABLES` (15), pero por API se puede reservar en cualquier fecha futura.
- Para la prueba manual en celulares reales (no se pudo en el navegador del panel):
  - El achique al tocar (`:active`) en iPhone: iOS solo lo aplica si hay un listener de toque; React
    registra los suyos en la raíz, pero falta verlo.
  - El `pushState` ocurre 150 ms después del toque (por la pausa de la elección). Está dentro de la ventana
    de activación del usuario, así que el "atrás" no debería saltear entradas (intervención de Chrome),
    pero conviene confirmarlo.
  - "Reducir movimiento" real del sistema (en el panel se verificó la regla CSS y la pausa simulando
    `matchMedia`) y el overlay del `ConfirmDialog` de la gestión.

Del paso 4:
- Resueltas en el paso (para registrarlas en el paso 7):
  - Hallazgos 9 (skeleton con la silueta real: `LandingSkeleton`, en `Landing.jsx`, con los mismos
    bloques; medido sin salto) y 10 (`fmtTelefono`).
  - Los placeholders de imagen de `Landing` que usaban `mutedSoft` como texto ya no existen (deuda del
    paso 3).
- Para el sistema de diseño (paso 7):
  - Tokens nuevos del hero: `heroScrim`, `heroInkSoft`, `heroSuccess`. El degradado del hero es una
    excepción funcional a "sin gradientes" (§2): contraste del texto sobre la foto (peor caso, foto
    blanca: título 7:1, estado 6,8:1).
  - `Button` acepta `href` y `externo` y se renderiza como `<a>` (link con forma de botón). Sumarlo a
    §6.1; sirve para el paso 6 ("Cómo llegar", calendario, "Ver o cambiar mi turno").
- Para los pasos 5 y 6:
  - Entradas desde la landing (`App.jsx#entrarDesdeLanding`): descartan la selección anterior (conservan
    nombre, teléfono y email) y marcan `reserva.barberoPreelegido` si vino un barbero. Hoy, el servicio de
    la landing va a Barbero, y el servicio elegido con barbero preelegido saltea Barbero. En el paso 5:
    servicio de la landing → ¿Cuándo?; barbero de la landing → Servicio → ¿Cuándo? con ese chip elegido.
    El flag sigue sirviendo para eso; el salteo de Barbero desaparece con la pantalla.
  - Los estados vacíos de servicios y equipo en la landing usan `IconoAlerta`: los íconos de tijera y
    persona son locales de `SeleccionServicio`/`SeleccionBarbero`, que no se tocaban acá. Si el paso 5 los
    mueve a `components/ui`, usarlos también en la landing.
- Deudas nuevas:
  - Sin foto del local, el hero mide ~182 px contra los `45svh` del skeleton: salta al cargar, solo en
    tenants sin foto. Aceptado: el skeleton no sabe si hay foto, y un bloque negro del 45 % sin nada
    sería el espacio desperdiciado que el paso quería sacar.
  - `actualizarFavicon` (`App.jsx`) apunta al logo aunque la imagen no cargue (favicon roto). La landing
    sí cae a las iniciales. Menor.
  - La gestión del turno espera el tenant de App antes de montarse: columna en blanco → skeleton de la
    gestión → contenido. Antes mostraba la silueta de la landing (peor). Si molesta: que `GestionTurno`
    pinte su skeleton mientras App carga, o que no dependa de App para el tenant.
  - `HorarioSemanal` lista el horario semanal sin feriados: en un feriado el hero dice "Cerrado" pero la
    fila de hoy muestra el horario normal. Ya pasaba antes.
  - El `tel:` del local usa los dígitos tal cual están guardados (`tel:1133111686`), sin código de país:
    anda marcando desde Argentina. Emparenta con la deuda del 9 de los celulares (paso 1).
  - En desktop, si hay más barberos que ancho, la fila del equipo muestra la scrollbar horizontal de
    10 px del estilo global de `index.css`. En iPhone no se ve (es superpuesta). Menor.
  - Una dirección de dos renglones centra el ícono del pin entre los dos, en vez de alinearlo con el
    primero. Menor.
  - El archivo del QR para imprimir (en el plan, dentro de este paso) no estaba en el prompt del paso 4:
    queda pendiente.
- Para la prueba manual en celulares reales:
  - El alto del hero (`45svh`) y el degradado sobre la foto real dentro del navegador de Instagram.
  - Los links con `target="_blank"` (Maps, WhatsApp, reseña) dentro del navegador de Instagram: si abren
    en la misma vista o afuera, y si `wa.me` abre la app de WhatsApp.

Del paso 5:
- Resueltas en el paso (para registrarlas en el paso 7):
  - Hallazgos 11 (grilla con título "Octubre", sin "De 2026", o "Octubre – Noviembre" si el rango cruza,
    con "nov" en el día 1; `aria-label` "martes 6 de octubre" / "…, sin turnos") y 12 (`Progress` es una
    barra de 3 tramos con `role="progressbar"` y "Paso N de 3: X"; sin el eyebrow "Paso X de 6").
  - Del paso 3: el botón "Volver" de `TopBar` mide 44 px; la reprogramación muestra error con "Reintentar"
    (ya no "Sin disponibilidad"); "¿Cuándo?" tiene "Reintentar" en días y en horarios; las letras de la
    semana del `MiniCalendario` (10 px, `mutedSoft`) se van con él (el encabezado nuevo usa el estilo de
    etiqueta: 11 px mono en `muted`).
  - Skeletons: el de `SeleccionHorario` medía 40 px contra chips de ~51, y el de la reprogramación 48.
    `SlotChip` pasa a alto fijo (`ALTO_SLOT`, 48) y el skeleton usa el mismo. Medido en 375 px: la grilla
    de días (206 px) y sus celdas, y el primer chip, en la misma posición con skeleton y con datos.
  - Deuda #4 de `sistema_de_disenio.md` §9 (cortes 13/20 hardcodeados): queda sin objeto, los horarios ya
    no se agrupan por mañana, tarde y noche.
- Decisiones del paso (para `decisiones_turnero_ux.md`):
  - Datos y presentación separados: `useDisponibilidad` (hook) pide días y horarios, elige el día y
    descarta respuestas viejas; `SelectorDiaHorario` solo dibuja. Lo comparten "¿Cuándo?" y la
    reprogramación.
  - Respuestas viejas: cada respuesta se guarda con la clave de su pedido (servicio, barbero, día,
    intento) y solo se muestra si coincide con la actual; además, el efecto que la pidió la ignora al
    limpiarse. Probado con demoras: la respuesta tardía no pisa a la nueva.
  - Día elegido: al cambiar de barbero se conserva el día si el barbero nuevo tiene lugar; si no, el
    primero con lugar. Al volver de Datos se abre el día del horario elegido, marcado mientras el barbero
    sea el de la entrada.
  - La reserva se escribe recién al tocar un horario (barbero, `barberoAsignado` y horario juntos): un
    cambio de barbero sin elegir horario no la toca. Sale `fecha` (se deriva de `horario`) y
    `barberoPreelegido` (el barbero marcado al entrar sale de `barbero` + `barberoAsignado`).
  - Días sin scroll (usuario, 2026-10-08): grilla semanal de 7 columnas, de lunes a domingo, con
    encabezado "LUN … DOM" y los 15 días en 3 renglones; los lugares antes del primer día y después del
    último quedan vacíos. Los días que atiende un barbero quedan alineados en columna. Se descartaron la
    tira con scroll, la tira que pasa de renglón (no alinea por día de la semana) y una semana por vez con
    flechas (más toques). Costo: la grilla mide ~206 px contra ~110 de la tira.
  - Días con y sin lugar (usuario, 2026-10-08): la diferencia es de forma, no solo de color. Con lugar,
    caja con borde `mutedSoft` y número fuerte; sin lugar, sin caja (borde transparente, mismo tamaño) y
    texto `mutedSoft` regular. Se descartaron el número tachado (ruido, se lee como "cancelado") y ocultar
    los días sin lugar (los huecos no se ven).
  - Horarios en una sola grilla, sin agrupar por mañana, tarde y noche (usuario, 2026-10-08): ahorra
    alto, para que los horarios no queden tan abajo con la grilla de días.
  - "Cualquier barbero" (usuario, 2026-10-08): renglón propio a todo el ancho, arriba de los barberos,
    como tarjeta de opción (borde + círculo con tilde), no como botón negro (se confundiría con el botón
    principal). Solo el texto, sin línea de ayuda. Los barberos, como chips sin scroll de costado: si no
    entran, pasan al renglón siguiente, centrados (todos los renglones van centrados).
- Para el sistema de diseño y los docs (paso 7):
  - Primitivo nuevo: `SelectorDiaHorario` (reemplaza a `MiniCalendario` en §6.2). Hook nuevo:
    `useDisponibilidad`. `Progress` ya no es el stepper "01/06" (§6.2).
  - `ruta_proyecto.md`: sumar `SeleccionCuando.jsx`, `SelectorDiaHorario.jsx` y `useDisponibilidad.js`;
    sacar `SeleccionBarbero.jsx`, `SeleccionFecha.jsx`, `SeleccionHorario.jsx` y `MiniCalendario.jsx`.
  - El estilo de etiqueta "eyebrow" (mono, 11 px, mayúsculas, `muted`) está copiado a mano en unos diez
    lugares (`ScreenHeader`, `Field`, `SelectorDiaHorario`, `SeleccionCuando`, `GestionTurno`,
    `Confirmacion`…). Candidato a un estilo compartido.
- Para el paso 6:
  - Con "Cualquiera", si el barbero asignado no está en la lista de App (falló la carga, o se sumó un
    barbero después de cargarla), la reserva lleva `{ id, nombre: null }`. El resumen tiene que decir algo
    sin el nombre ("te asignamos un barbero"); hoy `Confirmacion` mostraría el nombre vacío. Caso raro.
  - El reintento del 409 puede reusar `getDisponibilidad(null, servicioId, fecha)` (ya acepta barbero nulo).
  - `fmtFechaLarga` pone el día con cero ("jueves, 08 de octubre") en el resumen, mientras la grilla y
    los `aria-label` dicen "8". Al rehacer el resumen, conviene `day: 'numeric'`.
- Deudas nuevas:
  - **Orden de deploy**: el front de este branch omite `barbero_id` para "Cualquiera", y producción
    todavía no lo acepta (400 "barbero_id, servicio_id, desde y hasta son requeridos"). El backend del
    paso 2 tiene que llegar a producción antes que el front, o junto con él. Para probar, el preview
    atendió esos dos GET con los controllers del branch (req/res simulados, tenant demo, solo lecturas).
  - Ancho tocable de los días: en 375 px cada celda mide ~46 px, pero dentro de la tarjeta de la
    reprogramación (por su padding) baja a ~41 px, y en pantallas de 320 px a ~37 px. El alto es 48.
    Debajo del mínimo de 44 de §5.4 por pocos píxeles; al `MiniCalendario` le pasaba lo mismo.
  - Reprogramación: si falla la confirmación (ej. 409, el horario se ocupó), los horarios del panel no se
    recargan y el aviso sale arriba de la página, fuera de vista si se scrolleó. Ya pasaba antes.
  - `fecha.js` tiene un helper sin uso en el turnero (`fmtFechaCorta`). Como es parte de lo que se copia a
    otros fronts, decidir en el paso 7 si se borra.
- Para la prueba manual en celulares reales:
  - Tocar los días de la grilla con el dedo (celdas de ~45 px) sin errarle al vecino, y la grilla dentro
    de la reprogramación (~41 px).

## Pasos de ejecución

Flujo orquestador: un chat arma los prompts y revisa el diff; un chat ejecutor + un commit por paso, en
esta misma carpeta y en el branch `feature/turnero-ux`. Los ejecutores **prueban ellos mismos en el
navegador** con `vite preview` (puerto fuera de 5173–5176, solo 127.0.0.1) y lo bajan al terminar.

1. ✅ **Hotfix de producción** (branch `fix/turnero-fechas-autocompletado`, mergeado a `main` local el
   2026-10-07; push pendiente porque el sistema está en uso): hallazgos 1–4.
2. ✅ **Backend "Cualquiera"**: refactor de disponibilidad (`cargarDatosAgenda`), `barbero_id`
   opcional, regla de asignación (`elegirBarbero`), hallazgo 5, tope de 62 días en
   `/dias-disponibles`, `whatsapp` y `resena_url` en `getTenant`.
3. ✅ **Front base**: identidad, navegación con historial + transiciones, datos compartidos en App,
   helpers, limpieza (hallazgos 6–8).
4. ✅ **Landing vidriera** (hallazgos 9–10) + link de reseñas y ruta `/turnos/resena`. El archivo del QR lo
   genera el orquestador cuando el dueño pase el link de reseñas.
5. ✅ **¿Cuándo?**: `SelectorDiaHorario` + `SeleccionCuando` + reprogramación de la gestión + barra de
   progreso (hallazgos 11–12).
6. **Datos y confirmación + éxito + calendario** (éxito y gestión) + reintento del 409 (hallazgos
   13–14) + origen del cliente (front, `crearTurno` y el SQL de `turno.origen_link`).
7. **Docs (orquestador)**:
   - `sistema_de_disenio.md`: fuente de verdad → `frontend/src/`; sección "Turnero: identidad propia"
     (acento, movimiento, excepción de clases CSS); §6.2 y §8 actualizados.
   - `CLAUDE.md` §3: rutas de la fuente de verdad → `frontend/src/` y el doc nuevo en el mapa.
   - `estado_actual.md` (incluidas las deudas nuevas de arriba), `ruta_proyecto.md`.
   - `onboarding.md`: el SQL para cargar `configuracion.whatsapp` y `configuracion.resena_url`.
   - `SQL_Schema.md`: la columna `turno.origen_link`.
   - `decisiones_turnero_ux.md` (archiva este plan).

Lectura obligatoria de cada ejecutor: `CLAUDE.md`, `convenciones_tecnicas.md`, `sistema_de_disenio.md`
y este documento (sin limitar la lectura de otros archivos).

### Estado de la ejecución y pendientes del orquestador (al 2026-10-08)

- **Commits del branch `feature/turnero-ux`** (salió de `main` con el hotfix): `d56003f` plan, `565c7cb`
  paso 2, `84fd6cb` plan, `fe7abf7` paso 3, `5597549` paso 4, y el commit del paso 5.
- **`main` local** tiene el hotfix del paso 1 (`7fa9ec7` + merge `6d2c12b`) **sin push**: el usuario lo
  sube cuando se pueda tocar producción (el sistema está en uso).
- **SQL de `turno.origen_link`**: entregado al usuario el 2026-10-08 (`ALTER TABLE public.turno ADD
  COLUMN origen_link text CONSTRAINT turno_origen_link_formato CHECK (origen_link ~
  '^[a-z0-9_-]{1,30}$')`). Confirmar que lo corrió antes de revisar el paso 6.
- **Paso 6**: prompt entregado; corre después del commit del paso 5 y del SQL.
- **Ajustes que hizo el orquestador al revisar** (ya commiteados): `resena_url` + `esUrlHttps` en
  `getTenant` (paso 2); `fmtTelefono` muestra "11 3311-1686" sin 0/15/9 (paso 4); al cambiar de servicio
  se descarta el horario elegido antes (paso 5).
- **Deploy**: al mergear `feature/turnero-ux` a `main`, el backend del paso 2 y el front salen juntos. Si
  Vercel termina antes que Railway, "Cualquiera" puede dar 400 un minuto (el front muestra el error con
  "Reintentar"). El merge sigue el flujo habitual (`--no-ff` local, push solo de `main`, lo hace el
  usuario).
- **QR de la puerta**: lo genera el orquestador (SVG listo para imprimir, en una carpeta que el usuario
  encuentre, no en el repo) apuntando a `https://kingsaistudio.barbermanager.app/turnos/resena?origen=qr`,
  cuando el dueño pase el link de reseñas.
- **Del dueño de Kingsai**: el link "Pedir reseñas" del Perfil de Empresa de Google y si tiene número de
  WhatsApp.
- **Después del deploy**: cambiar el link de la bio de Instagram a
  `https://kingsaistudio.barbermanager.app/turnos?origen=instagram`; cargar `resena_url` / `whatsapp` con
  el SQL de `onboarding.md`; probar en celulares reales (lista de "Verificación").
- **Después del rediseño**: planificar la feature "Base de clientes" (ver "Para después").

## Verificación

- **Backend** (paso 2), script con controllers + req/res simulados contra el tenant demo, solo lecturas:
  - Antes de refactorizar, guardar la salida de `/disponibilidad` y `/dias-disponibles` con
    `barbero_id` para cada barbero del demo en 3 fechas; después del refactor, debe ser idéntica.
  - Sin `barbero_id`: la unión coincide con la de cada barbero; cada asignado tiene ese horario libre y
    la regla se cumple (menos turnos ese día, empate alfabético).
  - `precio` llega como número y `whatsapp` es `null` sin configurar.
- **Front** (pasos 3–6): `npm run lint` y `npm run build` en `frontend-turnero` + pruebas en el
  navegador con `vite preview` (mobile 375 px).
- **Manual del usuario en celulares reales**, después del deploy (iPhone desde Instagram, iPhone en
  Safari, Android Chrome): autocompletado de nombre, email y teléfono dentro de Instagram; gesto
  "atrás"; "Agregar al calendario" desde el éxito y desde la gestión.
- **Regresión**: crear un turno desde la app del barbero (usa `/disponibilidad` con `barbero_id`).

## Para después (fuera de este plan)

- **Base de clientes** (feature aparte, con su propio plan; el usuario quiere tratarla en detalle):
  identidad del cliente por teléfono + E.164 con el 9 en Argentina; unificar duplicados (hoy el
  barbero crea un cliente nuevo por cada turno sin email); cortes sin turno asociados a un cliente;
  ficha de cliente en el panel (visitas, faltas, cancelaciones, gasto, barbero habitual, origen,
  reseña pedida / marca manual); conteo de escaneos del QR. Google no informa qué cliente dejó la
  reseña. Conviene encararla apenas termine el rediseño.
- Cambiar el link de la bio de Instagram a `…/turnos?origen=instagram` después del deploy.
- Cargar `configuracion.resena_url` con el link que pase el dueño (SQL de `onboarding.md`) e imprimir
  el QR.
- Activar WhatsApp cuando el dueño confirme el número (SQL de `onboarding.md`).
- Los mails siguen con el CTA indigo de "Luz"; pasarlos a negro es un cambio chico en
  `backend/src/services/mail/mailer.js` si se quiere coherencia.
- `.ics` adjunto al mail de confirmación, si el botón no funciona dentro de Instagram.

*— Fin del documento —*
