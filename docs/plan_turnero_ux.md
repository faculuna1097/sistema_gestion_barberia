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
`getTenant` expone `whatsapp` desde `tenant.configuracion.whatsapp` (E.164 validado; `null` si falta).
Sin cambios de schema.

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
  - `calendario.js` (nuevo): `armarIcs(evento)` y `linkGoogleCalendar(evento)`.
  - `telefono.js` (existe, paso 1): sumar `fmtTelefono(tel)` para mostrar el teléfono del local.
- **Limpieza**: borrar `src/assets/{hero.png,react.svg,vite.svg}`, `src/App.css`, `public/icons.svg`.

### Landing (vidriera) — `screens/Landing.jsx`

Una columna, botón "Reservar turno" fijo abajo:
1. **Hero**: foto del local (`tipo='local'`, orden 1) de borde a borde (~45% del alto), degradado
   inferior para leer el texto, logo + nombre + estado abierto/cerrado. Sin foto: bloque liso con el logo
   (no el placeholder "FOTO DEL LOCAL").
2. **Servicios**: filas (nombre, duración, precio). Tocar → "¿Cuándo?" con el servicio elegido.
3. **Equipo**: barberos (avatar de iniciales + nombre). Tocar → Servicio con el barbero preseleccionado.
4. **Info**: horario semanal desplegable (`HorarioSemanal`, se conserva), dirección → Maps, teléfono
   formateado, botón de WhatsApp solo si `tenant.whatsapp` viene cargado.

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

## Pasos de ejecución

Flujo orquestador: un chat arma los prompts y revisa el diff; un chat ejecutor + un commit por paso, en
esta misma carpeta y en el branch `feature/turnero-ux`. Los ejecutores **prueban ellos mismos en el
navegador** con `vite preview` (puerto fuera de 5173–5176, solo 127.0.0.1) y lo bajan al terminar.

1. ✅ **Hotfix de producción** (branch `fix/turnero-fechas-autocompletado`, mergeado a `main` local el
   2026-10-07; push pendiente porque el sistema está en uso): hallazgos 1–4.
2. **Backend "Cualquiera"**: refactor de disponibilidad, `barbero_id` opcional, regla de asignación,
   hallazgo 5 y `whatsapp` en `getTenant`.
3. **Front base**: identidad, navegación con historial + transiciones, datos compartidos en App,
   helpers, limpieza (hallazgos 6–8).
4. **Landing vidriera** (hallazgos 9–10).
5. **¿Cuándo?**: `SelectorDiaHorario` + `SeleccionCuando` + reprogramación de la gestión + barra de
   progreso (hallazgos 11–12).
6. **Datos y confirmación + éxito + calendario** (éxito y gestión) + reintento del 409 (hallazgos 13–14).
7. **Docs (orquestador)**:
   - `sistema_de_disenio.md`: fuente de verdad → `frontend/src/`; sección "Turnero: identidad propia"
     (acento, movimiento, excepción de clases CSS); §6.2 y §8 actualizados.
   - `CLAUDE.md` §3: rutas de la fuente de verdad → `frontend/src/` y el doc nuevo en el mapa.
   - `estado_actual.md` (incluidas las deudas nuevas de arriba), `ruta_proyecto.md`.
   - `onboarding.md`: el SQL para cargar `configuracion.whatsapp`.
   - `decisiones_turnero_ux.md` (archiva este plan).

Lectura obligatoria de cada ejecutor: `CLAUDE.md`, `convenciones_tecnicas.md`, `sistema_de_disenio.md`
y este documento (sin limitar la lectura de otros archivos).

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

- Activar WhatsApp cuando el dueño confirme el número (SQL de `onboarding.md`).
- Los mails siguen con el CTA indigo de "Luz"; pasarlos a negro es un cambio chico en
  `backend/src/services/mail/mailer.js` si se quiere coherencia.
- `.ics` adjunto al mail de confirmación, si el botón no funciona dentro de Instagram.

*— Fin del documento —*
