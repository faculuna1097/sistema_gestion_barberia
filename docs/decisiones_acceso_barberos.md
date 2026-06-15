# Plan — Acceso de barberos al panel (vista reducida por PIN) — núcleo de decisiones

> ✅ **Completado (2026-06-04); en producción.** Documento **archivado**: solo el "por qué".
> El login unificado vigente (`/api/auth/panel/login`) está en [`estado_actual.md`](estado_actual.md)
> §Sistema. Implementación: `controllers/authPanel.js`, `utils/pin.js`, `utils/suscripcion.js`;
> frontend en `PantallaLoginAdmin.jsx` + `PanelAdmin.jsx` + `SeccionPlanillas`/`SeccionTurnero`.

## Objetivo

Que un **barbero** entre al panel (`/frontend`, el iPad del mostrador) con **la misma pantalla
de PIN que el admin**, y que el sistema decida el rol según el PIN: admin → panel completo;
barbero → **vista reducida** (solo **su** Planilla y **su** Turnero). Caso de uso: el barbero,
parado en el iPad, quiere ver rápido cómo viene su día. El análisis profundo lo hace desde su
app propia (`frontend-barbero`), que **no se toca** en este plan.

## Por qué es no-trivial: la unicidad de PIN

Los PINs (admin `tenant.pin_admin` y barbero `barbero.pin`) están **hasheados con bcrypt**:

1. **No se puede buscar un barbero por PIN con `WHERE pin = $1`** (bcrypt es no determinista,
   salt por hash) → hay que traer los barberos del tenant y hacer `bcrypt.compare` uno por uno.
2. **Los PINs de barbero se repiten a propósito** (la app del barbero usa selector + PIN
   *porque* no son únicos). Para que un PIN identifique a un solo barbero en el login del panel,
   hay que **forzar unicidad** dentro del tenant, **incluido `pin_admin`**.
   - Lo más grave: si un barbero comparte PIN con el admin, como el login chequea admin primero,
     **ese barbero entraría como admin** (escalada de privilegios). Por eso la unicidad es
     pre-requisito y bloquea la activación del login unificado.

## Decisión de diseño central

**Login unificado por PIN en `POST /api/auth/panel/login`.** Recibe `{ pin }` y resuelve
**admin-first**: `bcrypt.compare` contra `pin_admin` → si matchea, rol admin (con chequeo de
suscripción). Si no, loop `bcrypt.compare` sobre los barberos **activos**: exactamente 1 match →
rol barbero; 0 → 401; >1 → no debería pasar con unicidad aplicada → `warn` + 401 genérico (no
adivinar a quién loguear). Costo: 1 + N `bcrypt.compare` por login (N ≈ barberos activos),
aceptable para un login esporádico. El frontend reusa `authToken` + `apiFetch` para ambos roles;
el backend distingue por el contenido del JWT.

## Decisiones de producto (D1–D5)

| # | Decisión | Por qué |
|---|---|---|
| D1 | Turnero del barbero **read-only** en v1 (sin completar/no_asistió/cancelar) | "Completar = registrar corte" ya se hace por el FlujoCorte operativo y por su app; duplicarlo en el panel agrega caminos y confusión. |
| D2 | Suscripción vencida **no** bloquea ni avisa al barbero | El bloqueo apunta al dueño (el modo operativo tampoco se bloquea). El 402/`aviso_pago` solo aplica al path admin. |
| D3 | Sección de aterrizaje del barbero = **Turnero** | Es lo más accionable al llegar. |
| D4 | Copy de la pantalla de PIN **neutral** ("Acceso al panel") | Ahora sirve a ambos roles; "Panel de administrador" quedaba stale. |
| D5 | Mostrar el **nombre del barbero** en el sidebar en modo barbero | Que sepa que entró como él. Cosmético. |

## Seguridad

- **Escalada por colisión admin↔barbero:** mitigada por unicidad (validada en `crearBarbero`/
  `editarBarbero`/`cambiarPinAdmin` con `utils/pin.js#pinColisiona`, que compara contra el admin
  y todos los barberos —activos e inactivos— del tenant) + orden admin-first + `warn` en `>1 match`.
  No se activó el login unificado real hasta sanear los PINs por tenant.
- **Acceso físico al iPad:** el modo barbero no re-verifica identidad más allá del PIN; quien sepa
  el PIN de un barbero ve su planilla (datos económicos). Inherente al diseño y aceptado (es el
  iPad del local detrás del login operativo). Si molesta, se evalúa PIN por sección.

*— Fin del documento (archivado: núcleo de decisiones) —*
