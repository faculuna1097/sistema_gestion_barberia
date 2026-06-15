# Plan — Horario de atención y feriados — núcleo de decisiones

> ✅ **Completado (2026-05-21); en producción.** Documento **archivado**: solo el "por qué".
> Schema en [`SQL_Schema.md`](SQL_Schema.md). Implementación: `controllers/horarioAtencion.js`
> + `feriados.js`, `services/horarioAtencionService.js` + `feriadosService.js`, UI en
> `frontend/.../gestion/BloqueHorarioAtencion.jsx` + `BloqueFeriados.jsx`.

## Problema que resolvió

El sistema no tenía noción de "cuándo está abierta la barbería". Los horarios vivían solo a
nivel **barbero** (`barbero_horario`), lo que permitía: cargar bloques de barbero que
contradicen el horario real del local, reservar el 25/12 si algún barbero tenía horario ese
día, y no había un lugar único donde el dueño declare "abrimos Mar-Sáb 10-19". Se sumaron dos
conceptos a nivel tenant: **horario semanal** (`tenant_horario_atencion`) y **feriados**
(`tenant_feriado`), con sus validaciones, cascadas y UI.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Modelado horario semanal | `tenant_horario_atencion`, **1 fila por día abierto** (`hora_inicio`/`hora_fin`); **ausencia de fila = cerrado** | Modelo mínimo; un tenant que abre Mar-Sáb tiene 5 filas. |
| Bloques por día (tenant) | **Un solo bloque** por día | La siesta / cortes internos se modelan con los sub-bloques de cada barbero (`barbero_horario`), no a nivel local. |
| Validación barbero ∩ tenant | **Solo write-time** (al crear/editar bloques de barbero o turnos), sin intersección read-time | El write-time + la cascada mantienen la data consistente, así que recalcular la intersección en cada cálculo de slots sería redundante. Si aparecen inconsistencias difíciles de reproducir, reconsiderar. |
| Achicar el horario del tenant | **Cascada automática**: trunca/elimina bloques de barbero afectados + cancela turnos afectados, con `ConfirmDialog` previo que muestra los conteos | El cambio no puede dejar bloques/turnos fuera de rango; mejor cancelar explícitamente (con aviso) que dejar data inconsistente. |
| Feriados | `tenant_feriado`, 1 fila por feriado, **cierre del día completo** (sin horario especial en MVP); ABM uno por uno (sin import masivo) | Cubre el caso real (cerrar un día puntual) sin sobre-ingeniería. |
| Notificación de cascadas al barbero | **No por mail**; alerta in-app en `frontend-barbero` cuando hay bloques inconsistentes | El barbero ya ve la app; un mail por cada cambio de horario sería ruido. |
| Endpoint público | `GET /api/turnero/tenant` expone `horario_atencion` + `feriados` futuros | El front grisa días cerrados/feriados sin pegarle al endpoint de disponibilidad. |
| Defaults / seeds | tenants nuevos: L-S 10-19 (en `crearTenant.js`); demo L-S 08-22 (amplio, para tests); kingsai Mar-Sáb 10-19 (real) | — |
| UI admin | Bloque dentro de `TabNegocio` (no tab nueva) | Es config del negocio; convive con feriados e imágenes en un solo panel. |

## Detalles que conviene recordar

- **Validación write-time vs validación de slot:** el check contra el horario del tenant
  (422 `dia_cerrado` / `fuera_de_rango`) es **distinto y más barato** que validar que el
  `inicio` caiga en un slot real (esa deuda más gruesa sigue abierta en `estado_actual.md`).
  Se valida en los 3 endpoints de creación/reprogramación de turno + en el PUT de bloques de
  barbero. El algoritmo de slots cortocircuita: día sin fila o feriado → `[]`.
- **Cascada sin transacción:** PgBouncer/Session Pooler no soporta `BEGIN/COMMIT` → la cascada
  corre secuencial con cleanup manual y loguea cada paso; `cancelarEvento` (Calendar) y
  `enviarCancelacionAutomatica` (mail) son **best-effort** (atrapan su error, nunca abortan la
  cascada). El 409 `requiere_confirmacion` no muta estado hasta que el admin confirma.
- El mail `enviarCancelacionPorSuspension` se generalizó a `enviarCancelacionAutomatica`
  (sirve a cascadas de horario y de feriado, con el motivo en el `intro`).

## Cosas que NO entran (postergado, v2)

- Horario especial por feriado (ej. "24/12 abrimos hasta las 14").
- Importación masiva de feriados nacionales.
- Notificación por mail al barbero cuando una cascada le toca los bloques.
- Bloques múltiples por día a nivel tenant (decidido: no hace falta).
- Validación read-time (intersección barbero ∩ tenant en el algoritmo de slots).
- Logs de auditoría de quién cambió el horario (va con el pendiente general de "log de
  actividad" en `estado_actual.md`).

*— Fin del documento (archivado: núcleo de decisiones) —*
