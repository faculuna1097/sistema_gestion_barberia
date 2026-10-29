# Descansos en la Agenda y cortes con/sin turno — núcleo de decisiones

> ✅ **Completado (2026-10-29) en `feature/descansos-agenda`; pendiente de merge y deploy**
> (ver [`estado_actual.md`](estado_actual.md) → Pendientes). Documento **archivado**: solo el
> "por qué". Schema en [`SQL_Schema.md`](SQL_Schema.md) (`barbero_suspension`).
> Implementación: backend `services/suspensionesService.js` (`finEfectivoSql`,
> `suspensionSolapaSql`, `crearSuspension`, `liberarSuspension`), `services/descansosService.js`
> (`crearDescanso`, `unirDescansos`, `listarBloquesDescanso`),
> `disponibilidadService.calcularGrillaDelDia`, `planillaService.descansosSemanal`,
> `cortesService.registrarCorte`, `utils/validarFecha.js` (`parsearInstante`); app del barbero
> `components/agenda/` + `utils/seleccionSlots.js`; panel `SeccionTurnero` (Agenda),
> `TabBarberos` (Ausencias), `SeccionPlanillas` (registro) + `utils/descansos.js`.

## Problema que resolvió

El barbero no tenía forma de cuidar un hueco libre: si a las 13:00 no tenía turno y se iba a
comer, el turnero se lo podía ocupar cinco minutos antes. Además la Agenda no mostraba las
suspensiones (el barbero veía el día "libre" aunque estuviera ausente) y la grilla no dejaba ver
dónde entraba cada turno. Se sumaron: la Agenda dividida por slots, el **descanso** (el barbero
marca slots libres y nadie puede reservar ahí) y un **registro** para que el dueño controle cuánto
descansa cada uno.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Modelo | Un descanso es una fila de **`barbero_suspension` con `tipo = 'descanso'`** (`'suspension'` es la ausencia de siempre). Sin tabla nueva y sin filas en `turno`. | Para el sistema, descanso y ausencia dicen lo mismo: "este barbero no atiende en este rango". La tabla ya tenía permisos por rol y la disponibilidad ya la excluía. En `turno` ensuciaría recordatorios, Calendar, reportes y cortes. |
| Liberar, no borrar | Liberar completa `liberada_en` / `liberada_por`; la fila queda. **Rango efectivo:** `[desde, LEAST(hasta, liberada_en))`, escrito una sola vez (`finEfectivoSql`, `suspensionSolapaSql`) y reusado por todas las lecturas y escrituras. Si `liberada_en <= desde`, el rango es vacío. | Sin la fila no hay registro para el dueño, y alinea la tabla con "ABMs sin DELETE" (convenciones §7). Una sola columna cubre "liberar antes de empezar" y "terminar antes", y conserva el rango original. |
| Qué se puede marcar | Solo slots **libres y futuros** de la grilla del barbero (la misma que usa el turnero), del mismo día y sin recurrencia. Sin motivo. | Es una herramienta del momento; lo recurrente se resuelve con el horario semanal. El slot en curso ya no lo ofrece el turnero. |
| Selección | Un bloque continuo: tocar el slot de al lado lo agranda, uno no pegado reinicia la selección y sacar uno saca también lo que queda debajo. | Un descanso = un rango continuo = una fila. |
| Liberar / terminar antes | Si no empezó, "Liberar" lo anula entero; si está en curso, "Terminar descanso" lo corta ahora y los slots que quedan se vuelven a ofrecer. Los dos son `liberada_en = now()`. Sin `ConfirmDialog`. | No toca a ningún cliente y el botón está dentro del detalle: ya es un paso deliberado. |
| Lo del admin | El barbero **no** libera descansos ni ausencias con `origen = 'admin'` (403); los ve sin acciones. | Lo que carga el dueño lo decide el dueño. |
| Turnos | Un descanso **nunca cancela turnos**: si al guardarlo un slot ya está ocupado, 409 y el front recarga. Una ausencia sí cancela (con confirmación, como siempre). | El descanso es solo sobre huecos; cancelar clientes es una decisión que no se toma de pasada. |
| Descansos pegados | Se muestran y se cuentan como **un bloque**. La regla vive solo en el backend (`unirDescansos`) y la reciben las dos agendas y el registro. En la base siguen siendo filas separadas. | Marcar 13:00 y después 13:30 es, para el barbero y para el dueño, lo mismo que marcar 13:00–14:00. No se extiende la fila en el servidor: se perdería la antelación de la segunda marca, que es justo el dato de control (alguien podría marcar con días y extenderlo a último momento). En una sola definición porque la usan tres lugares. |
| Hora de los instantes | `desde`/`hasta` sin zona se interpretan en **hora argentina** (`parsearInstante`); con zona u offset se respetan; sin hora o inválidos, 400. | Los fronts mandan el `datetime-local` sin zona y la sesión de la DB está en UTC: una ausencia de 10 a 12 se guardaba de 7 a 9. La regla quedó en `convenciones_tecnicas.md` §4. |
| Completar un turno | Un turno se completa **solo al registrar su corte** (iPad o panel, `registrarCorte`). La app del barbero ya no ofrece "Completado"; `PATCH .../estado` acepta solo `no_asistio`. | El iPad lista solo los turnos `reservado`: un turno completado a mano sin corte terminaba cobrado como cliente sin turno, y la planilla lo contaba mal. |
| Control del dueño | Registro en **Planillas** (donde ya revisa a cada barbero por semana): cantidad, tiempo y % de la jornada, con detalle por bloque. Sin aviso por mail; un tope de minutos por día solo si se ve abuso. | Planillas es donde se controla; el modal de `TabBarberos` es donde se configura. Un mail por descanso sería ruido. |

## Concurrencia

No hay transacciones (convenciones §6), así que cada regla que importa va **en la misma
sentencia** que escribe:

- **Reservar sobre un descanso o ausencia:** `insertarTurno` y el `UPDATE` de `reprogramarTurno`
  llevan `NOT EXISTS (suspensión vigente que se superpone)`. Si no escriben, el mismo 409 de slot
  ocupado.
- **Crear un descanso:** el `INSERT` lleva `NOT EXISTS` de turnos reservados y de otras
  suspensiones vigentes. Antes se valida contra la grilla (`calcularGrillaDelDia`): alineado a los
  slots, dentro de un bloque y futuro (si no, 400).
- **`crearSuspension`:** un CTE inserta la suspensión y cancela los turnos que pisa, en una sola
  sentencia. El `INSERT` lleva `WHERE $confirmar OR NOT EXISTS (turno reservado en el rango)`: una
  reserva que entra entre la lectura y la escritura vuelve al 409 en vez de cancelarse sin que
  nadie lo confirme. El mail y Calendar van después, best-effort, solo sobre los ids que devolvió
  el `UPDATE`.
- **`registrarCorte`:** un CTE marca el turno completado e inserta el corte. Si el turno ya no
  está reservado: desde el iPad, si se canceló, el corte entra sin turno (el cobro existió); si
  ya estaba completado, 409.
- **TOCTOU aceptado:** si una reserva y un descanso del mismo barbero se escriben exactamente a
  la vez, ninguna sentencia ve a la otra y quedan superpuestas (un `EXCLUDE` no compara dos
  tablas). El residual es un turno sobre un descanso que el barbero ve en su Agenda. Rationale
  en [`auditoria_2026-07.md`](auditoria_2026-07.md) §Deudas diferidas, punto 1.

## Regla de unir descansos

Dos partes se unen si son del mismo barbero y del mismo **origen**, están pegadas por su rango
**original** y **convivieron** (la segunda se marcó antes de que terminara la primera). Cada
parte se suma al bloque cuya última parte se une con ella, que no siempre es la anterior: un
horario liberado se puede volver a marcar y la fila nueva queda ordenada entre la liberada y su
continuación.

- Nunca se unen ausencias, ni un descanso del barbero con uno del admin (el barbero no puede
  liberar los del admin).
- Estado del bloque: `liberado` (todas sus partes se liberaron antes de empezar),
  `terminado_antes`, `pendiente`, `en_curso` o `cumplido`.
- La antelación del bloque es la de su primera parte; cada parte trae la suya.

## Registro del dueño

`GET /admin/planilla/descansos?semana=` (`descansosSemanal`), con los mismos barberos que el
Resumen. En modo barbero, cada uno ve el suyo.

- **Qué mide:** cantidad de bloques y minutos efectivos (los liberados antes de empezar se listan
  pero no cuentan); por bloque, día, rango, estado y **antelación** (`desde − created_at`). En un
  bloque unido se ve también la antelación de la parte marcada más tarde, que es la que delata una
  extensión de último momento.
- **% de la jornada:** minutos de descanso sobre minutos de jornada de la semana. La jornada son
  los bloques de horario del barbero en los días que abre el local, sin feriados, menos sus
  ausencias (con multirange: dos ausencias superpuestas no se restan dos veces). Sirve para
  comparar barberos con jornadas distintas.
- **Limitación:** usa el horario **actual** del barbero (no hay historial de horarios). En una
  semana pasada en la que tenía otro horario, el % es aproximado.
- Va también en el Excel del Resumen: columnas por barbero y una hoja "Descansos" con un renglón
  por bloque.

## Feature 2 — Cortes con y sin turno en las planillas

En las dos planillas (`MiPlanilla` y `SeccionPlanillas`) se distingue el corte que vino de un
turno del cliente de la calle.

- **El backend manda el dato explícito:** `con_turno` en cada corte del detalle
  (`turno_id IS NOT NULL`) y `cortes_con_turno` / `cortes_sin_turno` en el resumen;
  `cantidad_cortes` sigue siendo la suma. Que el front no lo infiera de `cliente_nombre`.
- **Texto, sin color:** el sistema tiene un solo acento, el verde y el índigo ya los usa la pill
  de forma de pago, el color no puede ir solo (§3.1.1) y el Excel no escribe estilos.
- **App del barbero:** solo los sin turno llevan pill ("Sin turno", con contorno); los con turno
  ya tienen el nombre del cliente.
- **Panel:** columna "Cliente" en el Detalle (`sin turno` si no hubo); "Con turno" como `N de M`
  en el Resumen; "Por origen" en el modal del barbero (cuánta plata entra por el turnero). En el
  Excel del Resumen van como dos columnas numéricas.
- **Tolerancia:** sin `con_turno` (backend viejo), los fronts no muestran el origen en vez de
  rotular todo como "Sin turno".
- La Agenda no muestra los cortes sin turno, y no se marcan los cortes hechos durante un descanso:
  quien quiera inventar cortes lo puede hacer igual desde el iPad.

## Cosas que NO entran (postergado)

- Tope de minutos de descanso por día (columna en `tenant` y validación en el alta). Solo si el
  registro muestra abuso.
- Descansos recurrentes.
- Historial de horarios del barbero (el % de la jornada de semanas pasadas).
- Renombrar `DELETE /admin/suspensiones/:id` a `POST .../:id/liberar`.
- Validar en el servidor que el `inicio` de un turno caiga en la grilla y dentro del bloque del
  barbero (deuda en `estado_actual.md`).

*— Fin del documento (archivado: núcleo de decisiones) —*
