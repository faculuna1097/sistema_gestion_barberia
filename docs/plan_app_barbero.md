# Plan — App del barbero (`frontend-barbero`)

Plan de trabajo de los cambios a la app del barbero. Cada feature tiene su sección con
decisiones, fases y verificación. Cuando una feature termina, su núcleo de decisiones
se archiva en un `decisiones_*.md` y acá queda una línea con el estado.

Creado: 2026-10-15.

| # | Feature | Estado |
|---|---|---|
| 1 | Grilla de slots y descansos en la Agenda | Hecha (2026-10-29), en producción desde el 2026-11-05. Decisiones en [`decisiones_descansos.md`](./decisiones_descansos.md) |
| 2 | Planillas: cortes con turno vs. sin turno | Hecha (2026-10-15), en producción desde el 2026-11-05. Decisiones en [`decisiones_descansos.md`](./decisiones_descansos.md) → "Feature 2" |

Las dos están en `feature/descansos-agenda`; el merge y el deploy, en
[`estado_actual.md`](./estado_actual.md) → Pendientes.

### Datos de prueba en demo

Quedaron de las pruebas de las dos features y sirven para probar la Agenda y Planillas:

- **Alejo, martes 20/10:** turnos en todos los estados (reservado, completado, no asistió,
  cancelado), ausencias vigentes y liberadas, un descanso del admin y descansos liberados antes
  de empezar.
- **Alejo, miércoles 21/10:** un bloque de dos descansos unidos (12:10–13:50) y un descanso
  terminado antes (16:20–17:10, cortado a las 16:40), cargados con `created_at` a mano para ver
  la antelación en el registro de Planillas.
- **Facundo, 15/10:** un descanso y una ausencia terminados antes.
- **Semanas de mayo (Alejo y Facundo):** cortes con y sin turno, y "no asistió" completados por
  el admin.

---

## Próximos cambios en la app del barbero

_(Se agregan acá a medida que se definen.)_
