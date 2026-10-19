# Plan — App del barbero (`frontend-barbero`)

Plan de trabajo de los cambios a la app del barbero. Cada feature tiene su sección con
decisiones, fases y verificación. Cuando una feature termina, su núcleo de decisiones
se archiva en un `decisiones_*.md` y acá queda una línea con el estado.

Creado: 2026-10-15.

| # | Feature | Estado |
|---|---|---|
| 1 | Grilla de slots y descansos en la Agenda | En curso: Fases 1 a 4 hechas (2026-10-15 / 2026-10-19) y la limpieza de la Agenda (paso 5a, 2026-10-19), probadas en pantalla contra demo, sin deploy; sigue la 5 (panel de gestión) |
| 2 | Planillas: cortes con turno vs. sin turno | Hecha (2026-10-15), sin deploy |

---

## Feature 1 — Grilla de slots y descansos en la Agenda

### Objetivo

1. **Grilla:** la Agenda del día se divide visualmente por slots (línea punteada gris
   entre cada uno), para que el barbero vea dónde entra cada turno y qué huecos tiene.
2. **Descanso:** el barbero toca uno o más slots libres y futuros y los marca como
   descanso. El turnero deja de ofrecerlos y nadie puede reservar ahí. Caso de uso: "no
   tengo turno en la próxima hora, me voy a comer sin que me lo saquen 5 minutos antes".
3. **Control del dueño:** cada descanso queda registrado (también los liberados), y el
   dueño los ve en su panel.

### Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| D1 | El descanso es una fila de **`barbero_suspension` con `tipo = 'descanso'`**. No hay tabla nueva ni filas en `turno`. | Para el sistema, descanso y suspensión significan lo mismo ("este barbero no atiende en este rango"). La tabla ya existe, ya tiene permisos por rol y el algoritmo de disponibilidad ya la excluye. Meterlo en `turno` ensuciaría recordatorios, Calendar, reportes y cortes. |
| D2 | Solo para ese día. Sin recurrencia. | Es una herramienta del momento. Lo recurrente se resuelve partiendo el bloque de horario semanal. |
| D3 | Solo slots **libres y futuros**: el slot es seleccionable si su inicio es posterior a ahora y no se superpone con un turno reservado ni con otra suspensión. | El slot en curso no hace falta: el turnero ya no lo ofrece. |
| D4 | Selección: tocar un slot lo selecciona; tocar el de abajo (o el de arriba) agranda la selección; tocar uno no pegado **reinicia** la selección desde ese; tocar uno ya seleccionado lo saca **junto con lo que queda debajo** (la selección es siempre un bloque continuo). | Un descanso = un rango continuo = una fila. |
| D5 | Sin motivo: siempre "Descanso". | Pedido del usuario. |
| D6 | Un descanso **nunca cancela turnos**. Si al guardarlo algún slot ya está ocupado, el servidor responde 409 y el front recarga. | A diferencia de las suspensiones, el descanso es solo sobre huecos libres. |
| D7 | **Sin borrado físico.** Liberar un descanso (o una suspensión) completa `liberada_en`/`liberada_por`; la fila queda. | Sin esto no hay registro para el dueño. Además alinea la tabla con convenciones §7 ("ABMs — sin DELETE"). |
| D8 | **Liberar vs. terminar antes.** Si el descanso no empezó, "Liberar" lo anula entero. Si está en curso, "Terminar descanso" lo corta en el momento y los slots que quedan se vuelven a ofrecer. Las dos cosas son el mismo dato: `liberada_en = now()`, y el fin efectivo es `LEAST(hasta, liberada_en)`. | Una sola columna cubre los dos casos y conserva el rango original para el registro. |
| D9 | El barbero **no puede liberar** suspensiones creadas por el dueño (`origen = 'admin'`). | Hoy sí puede (ver Fase 2.4). |
| D10 | Control del dueño: **(a) registro visible ahora**, **(b) tope configurable de minutos por día como fase posterior**, solo si se ve abuso real. Sin aviso por mail (genera ruido). | Ver "Registro de descansos" en la Fase 5. |
| D11 | La Agenda también muestra las **suspensiones** del día (ausencias), distinguidas de los descansos. | Hoy el barbero ve el día "libre" aunque esté suspendido. |
### Modelo de datos

```sql
ALTER TABLE barbero_suspension
  ADD COLUMN tipo text NOT NULL DEFAULT 'suspension'
    CHECK (tipo IN ('suspension', 'descanso')),
  ADD COLUMN liberada_en  timestamptz,
  ADD COLUMN liberada_por text CHECK (liberada_por IN ('admin', 'barbero')),
  ADD CONSTRAINT barbero_suspension_rango_valido CHECK (hasta > desde);
```

- **Rango efectivo** de una fila: `[desde, LEAST(hasta, COALESCE(liberada_en, hasta)))`.
  Si `liberada_en <= desde`, el rango es vacío: fue liberada antes de empezar y no bloquea
  nada. Esta expresión se escribe en **un solo lugar** del backend (helper SQL en
  `suspensionesService`) y la reusan todas las lecturas.
- Antes del `ADD CONSTRAINT`, verificar que no haya filas con `hasta <= desde`.
- Va directo a producción (hay una sola DB). Las columnas tienen default o aceptan NULL,
  así que el código actual sigue funcionando hasta que se despliegue el nuevo.
- Actualizar `SQL_Schema.md`.

### Fases

Branch: `feature/descansos-agenda`, hijo de `feature/turnero-ux`, para mergear todo junto
a `main`. Cada fase se verifica antes de pasar a la siguiente.

#### Fase 1 — DB ✅ (2026-10-15)

1. Migración de arriba (la ejecuta el usuario en el SQL editor de Supabase).
2. `SQL_Schema.md` actualizado.

#### Fase 2 — Backend ✅ (2026-10-15)

**2.1 ✅ Cerrar el agujero de la reserva sobre una suspensión** (deuda abierta en
`estado_actual.md`). Hoy `POST /api/turnero/turnos`, `/reprogramar` y
`POST /api/admin/turnos` no validan suspensiones: un cliente que cargó los horarios antes
de que el barbero marcara el descanso puede reservar igual.
- `insertarTurno` (`turnosService.js`) pasa a `INSERT ... SELECT ... WHERE NOT EXISTS
  (suspensión vigente que se superpone)`. Es una sola sentencia; si no inserta nada,
  tira el mismo `SLOT_OCUPADO` que ya se mapea a 409.
- Lo mismo en el `UPDATE` de `reprogramarTurno`.
- Queda la ventana de milisegundos si el descanso y la reserva se crean exactamente a la
  vez: es el TOCTOU sistémico ya aceptado (`auditoria_2026-07.md`). Documentarlo ahí.
- Actualizar la deuda en `estado_actual.md`: el punto de las suspensiones queda cerrado;
  sigue abierto lo del bloque horario y la grilla de slots.

**2.2 ✅ `crearSuspension` atómico.** Hoy cancela los turnos afectados (con mail y Calendar)
y **después** inserta la suspensión. Si el INSERT falla, los clientes quedan cancelados y
notificados sin que exista la suspensión. Como no podemos usar `BEGIN/COMMIT`
(convenciones §6), se resuelve con **una sola sentencia** usando CTEs que modifican datos,
que Postgres ejecuta de forma atómica:

```sql
WITH nueva AS (
  INSERT INTO barbero_suspension (...) VALUES (...) RETURNING *
), canceladas AS (
  UPDATE turno SET estado = 'cancelado', cancelado_en = now(), cancelado_por = 'suspension'
  WHERE <reservados del barbero que se superponen con el rango>
  RETURNING id
)
SELECT (SELECT row_to_json(nueva) FROM nueva) AS suspension,
       (SELECT array_agg(id) FROM canceladas) AS turnos_cancelados;
```

- Los efectos externos (mail al cliente, borrar evento de Calendar) se hacen **después**,
  best-effort y solo sobre los ids que devolvió el `UPDATE`. Así nunca se notifica una
  cancelación que no ocurrió.
- El flujo de 409 con `confirmar_cancelacion` no cambia.
- La sentencia no es idempotente: va con `{ reintentar: false }`.

**2.3 ✅ `listarSuspensiones` con rango.** Hoy solo devuelve las que terminan en el futuro.
- Parámetros opcionales `desde`/`hasta` (fechas `YYYY-MM-DD` en TZ Argentina) y `tipo`.
- Sin parámetros mantiene el comportamiento actual (futuras), así los dos fronts que lo
  usan no cambian.
- Excluye las liberadas antes de empezar; en las demás devuelve el rango efectivo.

**2.4 ✅ Liberar en vez de borrar.** `DELETE /api/admin/suspensiones/:id` pasa a completar
`liberada_en = now()` y `liberada_por = rol`, en vez de `DELETE`.
- Si el rol es barbero y la fila tiene `origen = 'admin'` → 403 (D9).
- Si ya terminó o ya fue liberada → 409.
- El path y el verbo se mantienen para no romper a los dos fronts. Evaluar renombrarlo a
  `POST .../:id/liberar` (lo que hace ya no es un DELETE); recomendado, pero toca los
  dos fronts.
- **Pendiente (para la Fase 4 / 5.2):** el renombre a `POST .../:id/liberar` y los textos
  de los dos fronts, que todavía dicen "Eliminar suspensión" / "no se puede deshacer"
  (`Gestion.jsx` y `SubPanelAusencias`). En el paso de backend solo se ocultó el botón en
  la app del barbero para las suspensiones con `origen = 'admin'`.
  - **Actualización (2026-10-19, Fase 4):** los textos de la app del barbero (`Gestion.jsx`)
    ya hablan de liberar. Siguen pendientes los de `SubPanelAusencias` (5.2) y el renombre.

**Cómo quedó 1 y 2.1–2.4 (2026-10-15), desvíos del plan:**
- **Migración:** `barbero_suspension_rango_valido` (`hasta > desde`) ya existía en la DB sin
  estar en `SQL_Schema.md`; se sacó del `ALTER`. Se sumó
  `barbero_suspension_liberada_completa`: `liberada_en` y `liberada_por` van las dos o ninguna.
- **Helper del rango efectivo:** `finEfectivoSql(alias)` y `suspensionSolapaSql(alias, ini, fin)`
  en `suspensionesService`. La condición de superposición incluye `desde < fin_efectivo`: sin
  eso, una liberada antes de empezar podía figurar como superpuesta. Lo usan
  `cargarDatosAgenda`, `listarSuspensiones`, `insertarTurno`, el `UPDATE` de
  `reprogramarTurno` y `liberarSuspension`.
- **2.2:** el `INSERT` del CTE lleva `WHERE $confirmar OR NOT EXISTS (turno reservado en el
  rango)`. Sin eso, una reserva que entra entre la lectura y la escritura se cancelaba (y se
  avisaba al cliente) sin que nadie lo confirmara; ahora ese caso vuelve al 409 con la lista.
  Los datos para mail/Calendar se leen después, por los ids que devolvió el `UPDATE`. El
  `SELECT` final es `FROM nueva` (no `row_to_json`) para que las fechas sigan llegando como
  `Date`. Los avisos están en try/catch por turno: un fallo ya no termina en 500 con la
  suspensión creada.
- **2.3:** `hasta` es el **fin efectivo** y se suma `hasta_programada` (el original), además de
  `tipo`, `liberada_en`, `liberada_por`. Sin `desde` el rango arranca ahora; sin `hasta`, no
  tiene fin. Las liberadas antes de empezar quedan fuera: el registro de la 5.3 va a necesitar
  verlas (endpoint de planilla o un flag `incluir_liberadas`).
- **2.4:** un `UPDATE` con todas las reglas en el `WHERE`; si no actualiza, una lectura elige
  el código (404 / 403 / 409). Un id con formato inválido da 404 en vez de 500.
- `TIPOS_SUSPENSION` en `utils/constantes.js`; `MENSAJE_SLOT_OCUPADO` en `turnosService`.

**2.5 ✅ Crear descanso.** `POST /api/admin/descansos` con `{ desde, hasta }`. El barbero
crea los propios (se fuerza `req.barbero_id`) y el admin puede pasar `barbero_id`.
Validaciones (todas en el servidor, que es la fuente de verdad):
- Mismo día, `desde` posterior a ahora y `hasta > desde`.
- Cada slot del rango es un inicio real de la grilla del barbero (alineado a su bloque
  horario y a `duracion_slot_minutos`), dentro de un bloque y libre.
- Para no duplicar el algoritmo: reusar `computarSlotsDeUnDia` de
  `disponibilidadService` con `duracionServicioMin = duracionSlotMin` y
  `umbralMinimo = ahora`. El rango es válido si todos sus inicios de slot están en el
  resultado. Requiere que `cargarDatosAgenda` acepte no tener servicio (hoy
  `servicioId` es obligatorio).
- El INSERT lleva `WHERE NOT EXISTS (turno reservado que se superpone)`, el espejo de 2.1.
  Si no inserta → 409.
- `tipo = 'descanso'`, `origen` según el rol, `motivo = null`.

**2.6 ✅ Endpoint de la Agenda.** `GET /api/admin/agenda?fecha=YYYY-MM-DD` (barbero: el
propio; admin: `barbero_id`). Devuelve en una sola respuesta:
- `turnos` del día (lo que hoy devuelve `getTurnos`);
- `suspensiones` del día, de los dos tipos, con su rango efectivo, `tipo` y `origen`;
- `grilla`: los inicios de slot de todos los bloques del barbero ese día, cada uno con
  `{ inicio, fin, estado: 'libre' | 'turno' | 'descanso' | 'suspension' }`;
- `duracion_slot_minutos` y el horario del local ese día (para el rango del timeline).

Así la grilla y qué es seleccionable lo calcula **el backend con el mismo algoritmo del
turnero**, y el front solo dibuja. Una llamada en vez de cuatro (importa por la latencia
a Supabase, ver `performance_frontends.md`). Lo único que el front chequea por su cuenta
es `inicio > ahora`, porque el tiempo corre con la pantalla abierta.

**Cómo quedó el paso 3 (2026-10-15): horario de las suspensiones, 2.5 y 2.6, desvíos del plan:**
- **Arreglo previo (A): horario de las suspensiones.** Los dos fronts mandan `desde`/`hasta` de
  un `datetime-local` (sin zona) y la sesión de la DB está en UTC: una ausencia de 10 a 12 se
  guardaba de 7 a 9. Ahora el backend los interpreta en hora argentina con `parsearInstante`
  (`utils/validarFecha.js`): sin zona → hora argentina, con zona u offset → se respeta, inválido
  → 400. Exige fecha y hora (luxon solo aceptaría `'10:00'` como "hoy a las 10"). La regla quedó
  en `convenciones_tecnicas.md` §4. Los fronts no cambian.
  - `GET /admin/suspensiones?barbero_id=<no-uuid>` → 400 (`22P02`).
  - `reprogramarTurno`: `estado = 'reservado'` en el `WHERE` del `UPDATE`. Si no actualiza, una
    lectura elige el 409: "el turno está en estado X" o "slot ocupado".
- **Grilla:** `calcularGrillaDelDia` en `disponibilidadService`.
  - **El esqueleto** sale de `computarSlotsDeUnDia` sin turnos ni suspensiones (mismo anclaje
    que el turnero), y a cada slot se le pone el estado con el mismo `solapa` (ahora a nivel de
    módulo).
  - **`cargarDatosAgenda`** acepta no tener servicio (duración de un slot) y suma, sin cambiar
    lo que ya devolvía, el `tipo` de cada suspensión y el horario del local por día.
  - **`negocioAtiendeElDia`** (feriado + día de semana) se separó de `negocioAbreElDia`, porque
    la grilla no mira "pasado".
  - **Regresión:** las 4 funciones públicas del turnero dan lo mismo que antes (34
    comparaciones contra `HEAD`).
  - Solo los turnos `reservado` marcan `turno`: el slot de un turno completado o "no asistió"
    sale `libre`. La Agenda dibuja los turnos desde `turnos`, no desde la grilla.
- **2.5:**
  - **Validación:** en vez de `computarSlotsDeUnDia` con `umbralMinimo`, se valida contra la
    grilla con `tramoDeLaGrilla`. El rango tiene que empezar en un slot, seguir con slots
    continuos y terminar justo en el fin del último. Si no → 400 (desalineado, fuera de bloque,
    entre dos bloques, multi-día). Primer slot no posterior a ahora → 400 (sin antelación
    mínima). Algún slot no libre → 409.
  - **`INSERT`:** además del `NOT EXISTS` de turnos, lleva el de suspensiones vigentes. Va con
    `{ reintentar: false }`.
  - **Dónde vive:** el service va en un archivo nuevo, `descansosService.js`. Adentro de
    `suspensionesService` armaba un import circular.
  - **Admin:** un `barbero_id` ajeno, inexistente, inactivo o no-uuid da **404**, igual que
    `crearTurnoAdmin`.
  - **Respuesta:** `201 { descanso }`.
- **2.6:**
  - **Respuesta:** `{ fecha, barbero_id, duracion_slot_minutos, horario_atencion, turnos,
    suspensiones, grilla }`.
  - **`horario_atencion`** es `null` también en feriado.
  - **Formato de los instantes:** la `grilla` va con offset `-03:00` (como `/disponibilidad`).
    `turnos` y `suspensiones` salen como hoy, en UTC (`...Z`), porque se reusan `listarTurnos` y
    `listarSuspensiones` tal cual.
  - **Admin:** el barbero se valida antes de las queries en paralelo (un barbero inactivo da
    404). La app del barbero no paga esa vuelta.
- **Datos de prueba en demo** (pasos 2 y 3; se dejan como datos de prueba de las fases 3 a 5):
  - **Alejo, 20/10:**
    - turnos `reservado`: T1 09:00 (`ccf6fe6b`), T2 12:00 (`512be05c`), T3 12:30 (`1e17feba`);
    - turno cancelado a las 17:00 (`b05a2caf`);
    - S4, suspensión vigente 17:00–18:00 (`744f83c2`);
    - suspensiones vigentes del paso 3: 10:00–10:30 (`b42c9538`) y 10:30–11:00 (`8d1474e1`);
    - descanso vigente 15:00–16:00, del admin (`1ef1c05b`);
    - descanso 14:00–14:30, liberado antes de empezar (`7ac8bc78`);
    - suspensiones del paso 2 liberadas antes de empezar: 10–11, 12–13 y 15–16.
  - **Facundo, 15/10:**
    - descanso 19:00–19:30, terminado a las 19:01 (`ccef5603`);
    - suspensión 14:31–17:01, terminada a las 15:01 (`cbcd6c67`).

**Verificación de la fase:** controllers con `req`/`res` simulados contra el tenant demo,
sin servidor ni Bruno. Casos: reserva sobre un descanso → 409; descanso sobre un turno →
409; descanso desalineado / fuera de bloque / pasado → 400; liberar uno propio, uno
ajeno, uno del admin; terminar uno en curso y ver que el slot siguiente vuelve a
`/disponibilidad`; suspensión con turnos afectados → cancela y crea en una sola
sentencia.

#### Fase 3 — Front del barbero: grilla ✅ (2026-10-19, probada en pantalla en el paso 5a)

- `Agenda.jsx` pasa a consumir `GET /admin/agenda` (reemplaza `getTurnos` + `getTenant`
  en esta pantalla).
- Línea punteada gris (`theme.hairlineSoft`, `dashed`) en cada inicio de slot, desde
  `OFFSET_IZQ`. Las líneas de hora en punto quedan como están (sólidas, con label).
- Descanso: bloque neutro (`surfaceAlt` con rayado sutil) con el texto "Descanso".
  Suspensión: mismo estilo con "Ausencia" (+ motivo si hay).
- Los turnos ya ocupan todos los slots que les tocan (se dimensionan por `inicio`/`fin`).
- Leer `sistema_de_disenio.md` antes de tocar UI.

#### Fase 4 — Front del barbero: selección y descanso ✅ (2026-10-19, probada en pantalla en el paso 5a)

- Los slots `libre` y futuros son tocables (área táctil ≥ 44px: a 80px/hora y slots de
  30 min da 40px; ajustar `PX_POR_HORA` si hace falta).
- Reglas de selección de D4. La selección se ve con un borde/fondo de acento.
- Con algo seleccionado aparece un `StickyFooter`: "Marcar descanso · 13:00–14:00" +
  "Cancelar". Confirma con `ConfirmDialog`.
- Tocar un descanso propio abre un detalle con "Liberar" (si no empezó) o "Terminar
  descanso" (si está en curso). Las suspensiones del admin se ven, pero sin acciones.
- 409 al guardar → mensaje "Ese horario se acaba de ocupar" + recarga de la agenda.
- La pestaña "Suspensiones" de `Gestion.jsx` lista solo `tipo = 'suspension'`.
- La lógica de selección (pura, sin React) va a `utils/` con su propio comentario, porque
  tiene reglas propias y conviene leerla aislada.

**Cómo quedó el paso 4 (2026-10-19): arreglos de backend y fases 3 y 4, desvíos del plan:**
- **Arreglos de backend (hallazgos del paso 3):**
  - `postSuspension` (admin) valida el `barbero_id` con `barberoActivoEnTenant`: ajeno,
    inexistente, inactivo o no-uuid → 404. El FK de `barbero_suspension` no es compuesto con
    `tenant_id`, así que antes se podía cargar una suspensión a un barbero de otro tenant.
  - `parsearInstante` también en `crearTurno`, `reprogramarTurno` y `crearTurnoAdmin`: `'10:00'`,
    una fecha sola o `'...T10'` → 400. El turnero y la app del barbero mandan el ISO con offset
    de `/disponibilidad` y no cambian; el panel no crea turnos.
  - Los mensajes de `liberarSuspension` dicen "descanso" o "suspensión" según `tipo`. El DELETE
    mantiene la clave `suspension` (renombrarla rompía a los fronts) y el objeto suma `tipo`.
  - `GET /admin/turnos?desde=&hasta=` pasa los instantes crudos al SQL: anotado en
    `estado_actual.md`, sin arreglar.
- **Fase 3:**
  - **Altura de los slots:** `pxPorHora = max(80, 48 × 60 / duracion_slot_minutos)`. Slots de
    15 min → 192 px/h; de 30 → 96; de 45 o más → 80 (la escala de antes). Cualquier slot mide
    ≥ 48 px: área táctil ≥ 44 y un turno de un solo slot muestra sus dos renglones. Un
    `PX_POR_HORA` fijo no alcanzaba porque la duración del slot es configurable por negocio.
  - **La agenda se ordena por los slots, no por las horas** (pedido del usuario después de dos
    versiones con horas en punto, que chocaban con los horarios de los slots):
    - la columna izquierda muestra **solo el inicio de cada slot**: con slots de 50 min desde
      las 08:00 se ve 08:00, 08:50, 09:40… Sin horas en punto ni sus líneas. Van en `muted`
      (4,8:1), alineados con el primer renglón de un turno;
    - **cada slot es una celda con borde** (`hairline`, `radiusSm`), separada 2 px de la
      siguiente (`cajaVertical`). Turnos, bloques, la selección y los botones de los slots usan
      la misma geometría. Una celda tocable mide el alto del slot menos 2 px (≥ 46);
    - **rango:** del primer slot (o turno) al último (`calcularRango`), sin margen de horas
      alrededor del horario del local. Un turno fuera de la grilla lo agranda. Los descansos y
      las ausencias se recortan y no lo agrandan (una ausencia de varios días lo estiraría a 24 h);
    - **día sin slots ni turnos:** en vez de un timeline vacío con el rango 7–22 por defecto,
      un `EmptyState` ("No tenés horario de trabajo este día" / "El local no abre este día").
      El alto por defecto solo dimensiona el skeleton de la primera carga.
  - **Bloques:** el descanso, liso (`surfaceAlt`) con ícono `Coffee`; la ausencia, rayada
    (`repeating-linear-gradient` de `surfaceAlt` y `hairline`) con ícono `CalendarOff` y el
    motivo. Texto en `inkSoft` a 14 px (≥ 11,7:1 sobre los dos fondos). Ícono y texto van
    centrados en el bloque, en los dos tipos.
  - **Fechas:** `prepararAgenda` pasa la respuesta a ms una sola vez (`Date.parse`, los dos
    formatos) y todo se ubica en minutos desde la medianoche del día visible.
  - **Además:** un reloj de "ahora" cada 30 s (antes la línea roja se movía solo al recargar);
    si se cambia de día rápido, la respuesta de un día anterior se descarta; después de una
    acción la agenda se recarga sin skeleton.
- **Fase 4:**
  - **Selección:** `utils/seleccionSlots.js` (`esSlotTocable`, `tocarSlot`, `depurarSeleccion`),
    probada con un script de node: 29 casos de D3 y D4, todos OK. La selección se depura en cada
    render: si un slot elegido empieza o se ocupa, sale solo.
  - **Slots tocables:** botones del tamaño de su celda, con `aria-label` ("13:00, libre") y
    `aria-pressed`. Por dentro van vacíos (la hora está a la izquierda); elegidos, muestran
    una tilde. Hover solo si el dispositivo tiene `(hover: hover)` (`sistema_de_disenio.md`
    §9 #19). La selección se dibuja como un solo bloque `accentSoft` con borde de acento,
    que tapa la separación entre celdas.
  - **Pista:** arriba del timeline, "Tocá un horario libre para marcar un descanso", solo si
    hay slots para tocar. No se va al elegir uno, para que el timeline no salte. **Se sacó en
    el paso 5a** (pedido del usuario).
  - **Footer:** `StickyFooter` suma `sobreBottomNav` para pegarse encima de la barra
    (`BottomNav` exporta `ALTO_BOTTOM_NAV`). Los avisos de error de la Agenda, también los de
    turnos, pasaron del banner de arriba al footer: arriba quedaban fuera de vista al scrollear.
  - **Marcar:** `ConfirmDialog` → `POST /admin/descansos` con el ISO de la grilla. El diálogo
    queda en "Procesando…" mientras responde el servidor, y con esa respuesta el descanso se
    dibuja al instante (`agregarDescanso`), sin el rato con el slot vacío que había mientras
    se recargaba la agenda; la recarga sigue después, sin skeleton. 409 → "Ese horario se
    acaba de ocupar" y recarga; 400 → el mensaje del servidor; otro → un genérico.
  - **Descansos pegados, un solo bloque** (pedido del usuario): marcar 13:00 y después 13:30
    se ve y se comporta como marcar 13:00–14:00 de una vez. La unión es **al dibujar**
    (`unirDescansosSeguidos`): en la base siguen siendo dos filas, cada una con su
    antelación. Se descartó extender la fila en el servidor porque se perdería la antelación
    de la segunda marca, que es el dato de control del dueño (D10, 5.3): un barbero podría
    marcar 13:00 con días y extenderlo a último momento sin que se note. Solo se unen
    descansos del mismo origen (el barbero no puede liberar los del admin), nunca ausencias.
  - **Detalle del descanso:** "Liberar" y "Terminar descanso" van directo, **sin
    `ConfirmDialog`**: no tocan a ningún cliente y el botón dentro del detalle ya es un paso
    deliberado. En un descanso unido se liberan todas las partes que no terminaron (un DELETE
    por fila, en paralelo). El detalle queda en "Procesando…" hasta que la agenda recargada
    ya no lo muestra. Uno del admin muestra "Solo el administrador lo puede liberar". El
    detalle del turno y el del descanso comparten la cáscara (`ModalDetalle`).
  - **Gestión → Suspensiones:** lista con `?tipo=suspension`. "Eliminar" pasó a "Liberar"
    ("Terminar" si está en curso), sin "no se puede deshacer" y avisando que los turnos que se
    cancelaron al crearla no vuelven. En `api.js`, `eliminarSuspension` → `liberarSuspension`;
    `Button` acepta `ariaLabel`.
- **Verificación:** lint y build limpios, script de selección 29/29; las funciones puras de la
  geometría, de la unión de descansos y del alta instantánea, probadas en node. La prueba
  visual contra demo (Alejo, martes 20/10) se hizo en el paso 5a.
- **Para la Fase 5:** como un descanso puede ser varias filas pegadas, la Agenda del panel
  (5.1) tiene que unirlas igual al dibujar, y el registro (5.3) tiene que decidir si cuenta
  filas o bloques unidos (cada fila conserva su antelación).

**Cómo quedó el paso 5a (2026-10-19): limpieza de la Agenda del barbero.**
- **`Agenda.jsx` partido en `components/agenda/`** (refactor, sin cambio de comportamiento).
  `Agenda.jsx` queda como orquestador. Las piezas:
  - `datosAgenda.js` y `geometria.js`: funciones puras (la respuesta en minutos, y minutos → px);
  - `NavegadorDia`, `Timeline` y `BloquesTimeline` (turno, descanso/ausencia, slot tocable);
  - `ModalDetalle` (cáscara + `DatoDetalle`), `DetalleTurnoModal` y `DetalleDescansoModal`.

  Las 35 declaraciones de `HEAD` están idénticas en los archivos nuevos, y las funciones puras
  dan lo mismo que las de `HEAD` (36/36 casos). `ModalDetalle`, `DatoDetalle` (parecido a
  `SummaryRow`) y `PUEDE_HOVER` podrían servir fuera de la Agenda: quedan donde están hasta que
  aparezca un segundo uso (`sistema_de_disenio.md` §7.1).
- **Fechas:** `fmtFechaHora` mostraba el día siguiente desde las 21:00 (recortaba el ISO en
  UTC); `generarProximosDias` tenía el mismo bug. Se trajeron `fechaLocalISO` y `fechaDeISO`
  del turnero. `fechaHoyISO` y `sumarDias` pasaron a `utils/fecha.js`: había copias en
  Agenda, CrearTurno, Dashboard y MiPlanilla (`formatearFechaISO`, `sumarSemanas`, `domingoDe`).
- **Acciones de turnos (convenciones §8):** completar, no asistió y cancelar dibujan el cambio
  con el `{ id, estado }` que devuelve el servidor (`aplicarEstadoDeTurno`). Si fallan, el
  aviso y una recarga, porque el turno pudo cambiar por otro lado.
- **14 px:** los dos renglones de `BloqueTurno` (con interlineado de 18 px: a 1,5 no entraban
  en un slot de 48), "Volver a hoy" y las filas de Gestión → Suspensiones.
- **`crearSuspension`** tira el error con `status` (y `turnos_afectados` en el 409), como
  `crearDescanso`; `Gestion.jsx` abre el diálogo de conflicto desde el `catch`.
- **Pedidos del usuario durante la prueba:** se sacó la pista de arriba del timeline. "Volver
  a hoy" se veía raro: hasta que corría el efecto de carga, se dibujaba el timeline del día
  anterior bajo la fecha nueva, y el scroll a "ahora" arrancaba sobre él y se repetía. Ahora
  el skeleton aparece en el mismo render que la fecha (`irADia`).
- **Quedó para decidir:**
  - el salto de 52 px cuando "Volver a hoy" desaparece (alternativa: "Hoy" dentro de la barra
    de fecha);
  - en Gestión → Suspensiones, a 375 px, "hasta martes, 20 de octubre · 23:00 hs" ocupa dos
    renglones al lado del botón "Liberar" (alternativa: "hasta 23:00 hs" si es el mismo día).
- **Pendiente fuera de la Agenda:** el Inicio (`Dashboard.jsx`) tiene las mismas tres acciones
  de turnos sin la convención de §8. Los demás textos de 12 px de la app están en
  `sistema_de_disenio.md` §9 #22.
- **Datos de prueba en demo** (Alejo, 20/10, creados desde la app y sin email):
  - turnos C1 13:00 completado (`a33d738b`), C2 13:50 no asistió (`c45adee2`) y C3 18:00
    cancelado (`b39d3054`);
  - descanso 13:00–14:40, liberado (`7567b1a8`);
  - suspensión 21:30–23:00, liberada (`bb538ff1`).

#### Fase 5 — Panel de gestión (`frontend/`)

**5.1 Agenda del día (`SeccionTurnero`, vista Agenda).** Dibujar los descansos y las
ausencias en la columna de cada barbero, con el mismo estilo neutro que en la app del
barbero. Click → detalle chico: rango, tipo, quién lo creó y cuándo. Es la vista operativa: el
dueño mira el día y ve "Juan está de descanso 13–14".
- Backend: `GET /admin/suspensiones?desde=&hasta=` sin `barbero_id` ya devuelve todas
  (2.3).

**5.2 Ausencias (`TabBarberos` → modal de agenda → "Ausencias").** Lista solo
`tipo = 'suspension'`, para que los descansos no la ensucien. El borrar pasa a "Liberar"
(2.4).

**5.3 Registro de descansos (control, D10-a).** En **Planillas**, que es donde el dueño ya
revisa a cada barbero por semana para pagarle:
- Resumen: columna "Descansos" por barbero, con cantidad y tiempo total
  (ej. `3 · 1 h 30 m`).
- Modal de detalle del barbero: lista de los descansos de la semana, cada uno con
  - día y rango (ej. `mar 14 · 13:00–14:00`);
  - duración efectiva;
  - **antelación**: cuánto antes de empezar lo marcó (`desde − created_at`);
  - **estado**: cumplido / liberado antes de empezar / terminado antes (y cuándo).
- Indicadores de la semana: total de minutos de descanso y **% de la jornada** (minutos de
  descanso sobre minutos de bloque horario de la semana), para comparar barberos con
  jornadas distintas.
- Backend: extender el endpoint de planilla (o uno nuevo `/admin/planilla/descansos`) con
  los descansos de la semana por barbero.
- Alternativa evaluada: un sub-tab "Descansos" en el modal de `TabBarberos`. Descartada
  como lugar principal porque ahí se configura, no se controla.

### Fuera de alcance / posterior

- **Tope de minutos de descanso por día** (D10-b): columna en `tenant` y validación en
  2.5. Solo si el registro muestra abuso.
- Descansos recurrentes (D2).
- Validar en el servidor que el `inicio` de un turno caiga en la grilla y dentro del
  bloque del barbero (el resto de la deuda de 2.1).

---

## Feature 2 — Planillas: cortes con turno vs. sin turno

### Objetivo

En las planillas (la del barbero, `MiPlanilla`, y la del dueño, `SeccionPlanillas`) se
distingue qué corte vino de un turno y cuál fue un cliente de la calle, sin turno.

La Agenda **no** muestra los cortes sin turno: su fuente es el turnero (turnos y
descansos). Se descartó marcar los cortes hechos durante un descanso: un barbero que
quiera inventar cortes lo puede hacer desde el iPad igual, así que la marca no agregaba
control real.

### Cómo está hoy

- El dato ya existe: `corte.turno_id` es `NULL` en los cortes sin turno (los que se
  registran desde el iPad sin turno previo).
- `detalleSemanal` (`planillaService.js`) ya hace `LEFT JOIN turno`, pero solo para sacar
  `cliente_nombre`. No devuelve si el corte tenía turno. Hoy la única pista indirecta es
  que los cortes sin turno no traen nombre de cliente.
- `resumenSemanal` cuenta todos los cortes juntos (`cantidad_cortes`).
- Las dos planillas consumen los mismos endpoints (`/api/admin/planilla` y
  `/api/admin/planilla/resumen`); el backend scopea al barbero cuando el rol es barbero.
  Un cambio en el backend sirve para los dos fronts.

### Decisiones

| # | Decisión | Por qué |
|---|---|---|
| P1 | El backend devuelve el dato explícito: `con_turno` (boolean, `c.turno_id IS NOT NULL`) en cada corte del detalle, y `cortes_con_turno` / `cortes_sin_turno` en el resumen (`COUNT(c.id) FILTER (WHERE ...)`). | Que el front no lo infiera de `cliente_nombre`: es una regla implícita que se rompe sola si mañana un corte sin turno guarda un cliente. Sin cambios de schema. |
| P2 | `cantidad_cortes` se mantiene (es la suma de los dos). | No rompe nada de lo que ya lo usa (comisión fija, KPIs, Excel). |

### Fases

#### Fase A — Backend

- `detalleSemanal`: sumar `con_turno` al SELECT y al objeto de cada corte.
- `resumenSemanal`: sumar `cortes_con_turno` y `cortes_sin_turno` por barbero y en
  `totales`.
- Verificación: controllers con `req`/`res` simulados contra el tenant demo, con una semana
  que tenga cortes de los dos tipos; los dos conteos suman `cantidad_cortes`.

#### Fase B — App del barbero (`MiPlanilla`)

- En la fila de cada corte, junto a la pill de forma de pago, una pill de origen:
  "Turno" o "Sin turno" (estilo neutro, para no competir con la de forma de pago).
- En el resumen de la semana, el número de cortes con el desglose
  (ej. `12 cortes · 8 con turno · 4 sin turno`).

#### Fase C — Panel de gestión (`SeccionPlanillas`)

- Tab Detalle: columna "Origen" ("Turno" / "Sin turno") en la tabla.
- Tab Resumen: columnas "Con turno" y "Sin turno" al lado de "Cortes", también en la fila
  de totales.
- Modal de detalle del barbero: el desglose en las cifras de la semana.
- Excel de los dos tabs: columna "Origen" en el Detalle; "Con turno" y "Sin turno" en el
  Resumen.

Lo de arriba fue la primera propuesta. Lo que se hizo está en "Cómo quedó".

### Cómo quedó (2026-10-15)

Las fases A, B y C están hechas en `feature/descansos-agenda`, sin deploy. El backend tiene que
salir antes que los fronts, o junto con ellos: sin `con_turno`, los fronts no muestran el origen
(ver abajo).

**Decisión de UI: texto, sin color.** Se evaluó diferenciar los cortes por color y se descartó:
- el sistema tiene un solo acento, y el verde y el índigo ya los usa la pill de forma de pago;
- el color no puede ir solo (daltonismo, `sistema_de_disenio.md` §3.1.1);
- la librería de Excel (`xlsx`, versión gratuita) no escribe estilos de celda;
- en el Resumen lo que hay son cantidades, no filas para pintar.

**Fase A (backend), como estaba planeada.** `con_turno` en cada corte del detalle;
`cortes_con_turno` / `cortes_sin_turno` por barbero y en `totales`; `cantidad_cortes` sin cambios.

**Fase B (`MiPlanilla`), desvíos del plan:**
- Los cortes **con turno no llevan pill**: los identifica el nombre del cliente. Los **sin turno**
  llevan una pill neutra "Sin turno", con contorno y sin relleno para no competir con la de forma
  de pago (`muted` sobre blanco pasa AA; sobre `surfaceAlt`, no).
- **Sin desglose en el KPI "Cortes"**: se probó ("8 con turno / 4 sin turno") y el usuario lo
  sacó.

**Fase C (`SeccionPlanillas`), desvíos del plan:**
- **Tab Detalle:** en vez de una columna "Origen", una columna **"Cliente"**: el nombre del cliente
  si el corte vino de un turno, `sin turno` (en minúsculas) si no.
- **Tab Resumen:** una sola columna **"Con turno"** con `N de M` (ej. `8 de 15`), también en la
  fila TOTAL. Los sin turno salen de la resta. Así la tabla no suma dos columnas.
- **Modal del barbero:** en vez de sumar el desglose a las cifras, una lista **"Por origen"** (Con
  turno / Sin turno, con cortes y total generado) con `ListaConBarras`, la misma de "Por forma de
  pago". Muestra cuánta plata entra por el turnero.
- **Excel del Detalle:** columna "Cliente", igual que la pantalla. **Excel del Resumen:** "Con
  turno" y "Sin turno" como dos columnas numéricas, para poder sumar y filtrar.

**Tolerancia a un backend sin el campo:** si `con_turno` no viene, los dos fronts no muestran el
origen. En el panel aparece "—" y la app del barbero no muestra la pill. Antes se rotulaban
todos los cortes como "Sin turno". Pasó en la prueba visual, con el backend sin actualizar.

---

## Próximos cambios en la app del barbero

_(Se agregan acá a medida que se definen.)_
