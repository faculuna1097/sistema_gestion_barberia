# Registro de deudas técnicas — frontend (panel de gestión)

Este documento es el **registro vivo** de las deudas técnicas detectadas durante el
rediseño del panel de gestión (ver `docs/plan_redisenio_frontend_gestion.md`).
Acá vive el plan escalonado para resolverlas y el seguimiento de cada una.

**Regla de oro**: una deuda no se borra. Cuando se resuelve, se cambia su estado a
`✅`, se anota **fecha + commit**, y se mueve al apéndice "Resueltas" al final.
Cuando aparece una deuda nueva, se le da el siguiente número libre y se suma a la
etapa que corresponda por **superficie compartida** (ver criterio de orden abajo).

**Orden de trabajo de cada deuda**: primero se modifica/soluciona, después se
**verifica** (visual y/o funcionalmente según corresponda), y **recién después de
verificar** se cambia el estado a `✅` y se mueve al apéndice. Nunca al revés.

Los números (#NN) son los **originales** del plan de rediseño — se conservan para no
romper referencias cruzadas en commits, chats y otros docs.

---

## Leyenda de estados

| Símbolo | Estado | Significado |
|---|---|---|
| 🔲 | Abierta | Detectada, sin empezar. |
| 🚧 | En curso | Se está trabajando en ella (anotar en qué chat/branch). |
| ✅ | Resuelta | Cerrada. Anotar fecha + commit. Mover al apéndice. |
| 💤 | Aceptada | Decisión consciente de NO resolver (divergencia/nota de producto). No requiere acción. |

**Prioridad**: `Alta` (seguridad / integridad de datos / bloquea otra cosa) · `Media` (mejora real de UX o robustez) · `Baja` (riesgo bajo, cosmética o "nunca pasa hoy").

---

## Criterio de orden (por qué estas etapas)

Las deudas se agrupan por **superficie/archivo compartido**, no por complejidad. Razón:
el costo dominante al resolverlas es cargar y entender el contexto de cada archivo;
abrir un archivo una sola vez y arreglar todo lo que vive ahí es más barato y más
seguro (menos regresiones) que volver al mismo archivo en chats distintos. Dentro de
cada etapa el orden es por **dependencia + riesgo**. Las dos últimas etapas (Backend y
Cleanup global) son la excepción: viven en otro contexto y van al final por diseño.

---

## Tabla-resumen (registro)

| # | Deuda | Etapa | Archivos | Prioridad | Estado |
|---|---|---|---|---|---|
| 38 | `Modal` sin scroll interno | 1 | `ui/Modal.jsx` | Media | ✅ |
| 25 | `Modal` id estático en `aria-labelledby` | 1 | `ui/Modal.jsx` | Baja | ✅ |
| 24 | `ConfirmDialog` no reusa `Modal` | 1 | `ui/ConfirmDialog.jsx`, `ui/Modal.jsx` | Media | ✅ |
| 17 | `EmptyState` no acepta `tone` | 2 | `ui/EmptyState.jsx` | Media | ✅ |
| 41 | Wrapper "label + `InputTiempo`" duplicado | 2 | `ui/InputTiempo.jsx`, `TabBarberos`, `BloqueFeriados` | Baja | 🔲 |
| 40 | Editor de horario no acota al rango del local | 3 | `TabBarberos` | Media | ✅ |
| 39 | `humanizarDiasEnMensaje` acoplado al wording backend | 3 | `TabBarberos` | Baja | ✅ |
| 35 | Cambio de credenciales operativas sin re-auth | 4 | `TabSeguridad`, backend | Alta | ✅ |
| 36 | Carga de usuario operativo no distingue error de vacío | 4 | `TabSeguridad` | Media | ✅ |
| 33 | `Number()` sin validar NaN en precio/stock | 5 | `TabServicios`, `TabProductos` | Baja | 🔲 |
| 18 | Tabla ad-hoc con `role=table` en `SeccionInicio` | 6 | `SeccionInicio` | Media | 🔲 |
| 4 / 21 | Hover de fila: `useState` vs `:hover` scoped | 6 | Caja, Ventas, Gastos, Planillas, Balances, Turnero | Media | ✅ |
| 23 | `CampoFijo` local candidato a primitivo (resto resuelto) | 6 | `SeccionVentas` | Baja | 🔲 |
| 12 | `tenant.logo` legacy expuesto en `GET /negocio` | 7 (backend) | backend | Media | 🔲 |
| 31 | `getNegocio()` no expone `horario_atencion` | 7 (backend) | backend, `SeccionTurnero` | Media | 🔲 |
| 32 | `/admin/turnos` no devuelve `forma_pago` | 7 (backend) | backend, `SeccionTurnero` | Media | 🔲 |
| 34 | `agregar-stock` no transaccional con PUT producto | 7 (backend) | backend, `TabProductos` | Media | 🔲 |
| 44 | Endpoints de horarios devuelven `HH:MM:SS` (el front recorta) | 7 (backend) | backend, `TabBarberos` | Baja | 🔲 |
| 11 | `onPointerDown` en `MainScreen` | 8 (Fase 5.5) | `MainScreen` | Media | 🔲 |
| 14 | `LogoCirculo` duplicado en los dos logins | 8 (Fase 5.5) | `PantallaLoginAdmin`, `PantallaLoginOperativo` | Baja | 🔲 |
| 5 | Re-auditar focus visible en primitivos | 8 (Fase 6) | `ui/*` | Baja | 🔲 |
| 6 | Contraste WCAG no verificado | 8 (Fase 6) | `theme/tokens.js` | Media | ✅ |
| 8 | Convivencia `formato.js`/`formatos.js` + `fecha.js`/`fechas.js` | 8 (Fase 6) | `utils/*` | Media | ✅ |
| 9 | Vulnerabilidades de `npm audit` | 8 (Fase 6) | `package.json` | Alta | ✅ |
| 27 | Semántica engañosa columna comisión (Planillas) | — | `SeccionPlanillas` | Baja | 💤 |
| 28 | Acoplamiento sutil entre tabs (Planillas) | — | `SeccionPlanillas` | Baja | 💤 |
| 42 | `BloqueFeriados` con overflow propio | — | `BloqueFeriados` | Baja | 💤 |
| 43 | Nombre/URL del negocio sin self-service | — | `TabNegocio` | Baja | 💤 |
| 45 | Bloque en día que el local cerró después no se valida | — | `TabBarberos` | Baja | 💤 |

---

# Plan escalonado

## Etapa 1 — Primitivo `Modal` + `ConfirmDialog` · ✅ COMPLETA
Todo vivía en `components/ui/Modal.jsx` y `components/ui/ConfirmDialog.jsx`. Se arregló el
primitivo `Modal` primero (#38, #25) y luego #24 (`ConfirmDialog` reusa `Modal`
internamente). Las tres resueltas — ver apéndice. Impacto transversal: estos primitivos
los usan casi todas las secciones.

---

## Etapa 2 — Primitivos visuales sueltos
Cada uno es un primitivo autocontenido cuyo arreglo "se propaga" a todos sus callers.
#41 además toca `TabBarberos` y `BloqueFeriados`, así que conviene hacerlo justo antes
de la Etapa 3 (que vuelve a `TabBarberos`).

### #17 — `EmptyState` no acepta `tone` · Media · ✅ (2026-06-01)
*(mejora opcional, no deuda contra otros fronts — D9)*: el wrapper del glyph fijaba `color: theme.muted`, por lo que cuando se usaba con `IconoAlerta` (estados de error) el ícono se veía gris en lugar de rojo.

**Resuelta (2026-06-01, branch `fix/deudas-frontend`).** Se sumó prop `tone` (`'muted' | 'danger' | 'success' | 'warning'`, default `'muted'`) al primitivo `EmptyState`. El default deja el render **pixel-idéntico** al de antes (cero regresión en los empties normales). Las variantes semánticas tintan el wrapper del glyph con su `*Soft` (fondo) + color fuerte (el glyph hereda vía `currentColor`) y omiten el borde (tratamiento B, mismo lenguaje cromático que `Toast` y los badges de estado). Se propagó `tone="danger"` a los **13 callsites de error** (`EmptyState` + `IconoAlerta`): `SeccionInicio`, `Caja`, `Ventas`, `Gastos`, `Planillas`, `Balances` (×2), `Turnero`, `TabServicios`, `TabProductos`, `TabBarberos`, `TabTurnero`, `PantallaLoginAdmin` ("Acceso suspendido"). Build verificado OK.

### #41 — Wrapper "label + `InputTiempo`" duplicado — candidato a primitivo (`CampoTiempo`) · Baja · 🔲
Existe como sub-componente local en `TabBarberos` (eyebrow mono + `InputTiempo` full, para el form de ausencias) y, tras el chat de `TabNegocio`, también inline en el modal de alta de `BloqueFeriados` (label "Fecha" + `InputTiempo type="date"`). 2 usos del mismo patrón. Si aparece un 3er uso (§7.1), promover un `CampoTiempo` a `components/ui/` — o, alternativa más limpia, sumar una prop `label` opcional al propio `InputTiempo` para que se autoetiquete como `Field`. Bajo riesgo; sin promover por ahora.

**Decisión sobre el picker (2026-06-01)**: `InputTiempo` se queda con **inputs nativos** (`<input type="time|date|datetime-local">`). El picker lo aporta el SO/navegador y no es controlable por CSS; en el iPad objetivo (D5) eso es ya la rueda nativa de Apple, que es justo lo deseado. Se descartó construir un picker propio en JS (sumaría complejidad/dependencia y perdería la rueda táctil de iOS). La parte "promover `CampoTiempo`" queda abierta esperando el 3er uso.

---

## Etapa 3 — `TabBarberos` · ✅ COMPLETA
Ambas viven en `TabBarberos`. #40 y #39 resueltas (2026-06-01) — ver apéndice. De paso
se abrió la deuda backend #44 (API devuelve `HH:MM:SS`) y el caso aceptado #45 (bloque
en día que el local cerró después).

### #40 — Sin verdad-cliente del rango horario del local en el editor de horarios del barbero · Media · ✅ (2026-06-01)
Se bloquea el **día** cerrado del local (card atenuada, sin "Agregar bloque"), pero en un día abierto el editor deja cargar **cualquier** rango horario (ej. 08:00–22:00 aunque el local atienda 10:00–19:00). El backend lo rechazaba, pero la UI no lo prevenía.

**Resuelta (2026-06-01, branch `fix/deudas-frontend`).** Se agregó un validador client-side `validarHorario(bloques, horarioLocal)` que corre antes del PUT y devuelve un mapa `{ [index]: {inicioInvalido, finInvalido, mensaje} }`. Detecta por bloque: (1) inicio/fin vacío, (2) `inicio ≥ fin`, (3) bloque fuera del rango de atención del local ese día, (4) solapamiento con otro bloque del mismo día (esto último cierra #39). Cada `InputTiempo` ofensor queda con `invalid` (borde rojo) + mensaje micro inline debajo de la fila; "Guardar horarios" se deshabilita si hay cualquier error. Además se pasan `min`/`max` (rango del local) al `InputTiempo` para acotar el picker nativo donde el navegador lo respete — **soft**, el guard real es la validación. Degradación: si `horarioLocal` es `null` (no se pudo leer la atención) no se valida rango, igual que no se bloquean días.
**Bug encontrado y corregido en verificación**: los bloques existentes vienen de la DB en `HH:MM:SS` y el rango del local en `HH:MM`; comparar `'22:00:00' > '22:00'` da `true` (prefijo más largo) → marcaba un bloque idéntico al horario del local como fuera de rango. Se normaliza todo a `HH:MM` al entrar al estado (`normalizarBloques`, vía el helper centralizado `aHoraCorta` en `utils/fecha.js`). Quedó anotada la deuda de backend **#44** (la API debería devolver `HH:MM`).
*(De paso, en este mismo chat se bajó el botón "Guardar horarios" del cuerpo del panel al footer del modal, junto a "Cerrar", visible solo en el tab Horario — mejora de UI, no parte de la deuda.)* Build verificado OK; verificado funcionalmente por el usuario.

### #39 — `humanizarDiasEnMensaje` acoplado al wording del backend · Baja · ✅ (2026-06-01)
El mensaje de solapamiento del backend se traducía client-side con un regex sobre `"día N"` → nombre del día. Si el backend cambiaba el wording, el regex dejaba de matchear y el mensaje se mostraba crudo.

**Resuelta (2026-06-01, branch `fix/deudas-frontend`) — opción (b).** Como #40 ya metió validación client-side, el solapamiento se valida también en el cliente (dentro de `validarHorario`: por día se ordenan los bloques por inicio y se comparan adyacentes) y el mensaje se construye localmente. Eso volvió innecesaria la traducción del wording del backend: se **eliminó `humanizarDiasEnMensaje`** y el catch de `guardar` ahora muestra `err.message` crudo (caso que en la práctica ya no se gatilla porque el solapamiento se previene antes del PUT). El editor dejó de depender del wording del backend para cualquier error de horario. Se rompió a propósito la decisión previa del registro ("aceptar la fragilidad") porque ya estábamos validando client-side y la duplicación de la regla de solapamiento es mínima.

---

## Etapa 4 — `TabSeguridad` · ✅ COMPLETA
Ambas vivían en `TabSeguridad` (#35 además tocó backend). #35 y #36 resueltas (2026-06-01)
— ver apéndice. #35 era la de mayor prioridad de todo el registro (seguridad).

### #35 — Cambio de credenciales operativas sin re-autenticación · Alta · ✅ (2026-06-01)
Cambiar usuario o contraseña del modo operativo no pide la contraseña actual (a diferencia del PIN admin, que sí pide el PIN actual). El flujo asume sesión admin ya autenticada (protegida por PIN admin), pero alguien con acceso físico al panel abierto podría cambiar credenciales operativas sin reto. Evaluar pedir contraseña actual / re-validar PIN admin antes de estos cambios. Deuda de seguridad, no visual.

**Resuelta (2026-06-01, branch `fix/deudas-frontend`).** Se exige re-autenticación con el **PIN de administrador** antes de cambiar usuario o contraseña operativos (en ambos cambios, decisión del usuario). Se eligió el PIN admin —y no la contraseña operativa actual— porque es la credencial que el dueño realmente tiene y que ya gobierna el acceso al panel; es simétrico con `cambiarPinAdmin` y uniforme para los dos cambios (el hash de la password operativa es one-way y el backend ni la conoce al renombrar el usuario).
**Enforcement server-side (clave):** el control vive en el backend, no solo en la UI. `actualizarCredencialesOperativas` (`controllers/adminOperativo.js`) ahora recibe `pin_admin`, valida presencia (400), hace `SELECT pin_admin` del tenant (404) y `bcrypt.compare` → **401** si no coincide, **antes** de cualquier UPDATE (calco de `cambiarPinAdmin`). Un fix solo-frontend hubiera sido teatro (bypasseable llamando la API directo).
**Frontend** (`TabSeguridad.jsx`): `ModalCambiarUsuario` y `ModalCambiarPassword` suman un campo "PIN de administrador" (4 dígitos, `type=password`, filtro `\D`) al final del form; "Guardar" exige el PIN completo; se manda `pin_admin` en el body y el 401 cae en el Toast danger existente. El servicio `actualizarCredencialesOperativas` no se tocó (ya propaga `data.error` y serializa `datos`). De paso se actualizó el comentario de cabecera de `adminOperativo.js` (la nota de UX "Dejar vacío para no modificar" no reflejaba el flujo real de modales dedicados). Verificado funcionalmente por el usuario (PIN correcto → cambia; PIN incorrecto → 401 sin tocar DB; sin PIN → Guardar deshabilitado).

### #36 — Carga del usuario operativo sin reintento · Media · ✅ (2026-06-01)
Si `getCredencialesOperativas()` falla, `usuarioOperativo` queda `null` y la fila muestra el pill "Sin configurar" — semánticamente erróneo (no es que no esté configurado, es que no se pudo cargar). Distinguir el estado de error del estado "vacío real" (ej. flag `errorCarga` que muestre un Toast/Reintentar en lugar del pill).

**Resuelta (2026-06-01, branch `fix/deudas-frontend`).** Se sumó estado `errorCarga` y se extrajo la carga a `cargarUsuario` (`useCallback`), reutilizable como pre-carga y reintento. El catch ya no hace `setUsuarioOperativo(null)`: marca `errorCarga`, separando el error del vacío real. La fila "Usuario" ahora tiene **4 estados**: cargando (`—`) · error ("No se pudo cargar." + botón `Reintentar`) · usuario · sin configurar (pill, solo el vacío genuino). Se eligió **reintento inline** en el slot de valor (opción a) en vez de extender el primitivo `Toast` con una acción (opción b, descartada por inflar scope y tocar un primitivo compartido). De paso se cerró un bug secundario: el lápiz de editar quedaba habilitado en error y abría `ModalCambiarUsuario` con `usuarioActual=''` (trataba el usuario real como vacío) — ahora se deshabilita con `cargandoUsuario || errorCarga`. Se quitó el guard `cancelado` de unmount (innecesario en React 19). Build verificado OK; verificado funcionalmente por el usuario.

---

## Etapa 5 — Inputs numéricos CRUD (`TabServicios` / `TabProductos`)

### #33 — `Number()` sin validar NaN en inputs de precio/stock · Baja · 🔲
El guardado castea con `Number(valor)`. Hoy mitigado por el filtro `\D` (los inputs solo aceptan dígitos), pero si el backend recibiera el body por otra vía no habría guard. Bajo riesgo. Revisitar si se agrega validación de formularios formal.

---

## Etapa 6 — Tablas densas / hover (secciones de reporte)
Superficie grande (Caja, Ventas, Gastos, Planillas, Balances, Inicio). Conviene
hacerla cuando se pueda medir con datos reales (cierre de Fase 4).

### #18 — Tabla ad-hoc con `role="table"/"row"/"cell"` en `SeccionInicio` · Media · 🔲
Parche de accesibilidad mientras `DataTable` no existía. Ahora el primitivo `DataTable` ya existe (cerró #20) — evaluar reemplazar la tabla ad-hoc de stock por el primitivo. (Caveat: la tabla de Inicio no tiene sort/filtros/paginación; valorar si `DataTable` aporta o si alcanza con limpiar los roles.)

### #4 / #21 — Hover de fila: `useState` vs `:hover` scoped · Media · ✅ (2026-05-29)
**#4** (heredada del sistema de diseño #8): inline-styles + `useState` para hover — este front es el que más riesgo tiene por las tablas densas. **Parte "medir" cerrada**: ninguna tabla densa usó `useState`-por-fila; todas resolvieron el hover por CSS (`:hover`), que es cero re-renders. No había problema de performance que arreglar.
**#21**: las 6 tablas de reporte (Caja, Ventas, Gastos, Planillas, Balances, Turnero) usaban cada una un `<style>` inline con clase scoped propia (`om-caja-fila`, `om-ventas-fila`, …) con **regla idéntica** (`background: surfaceAlt` al hover). El scope por sección no aportaba nada → duplicación pura.

**Resuelta (2026-05-29, Fase 6 Etapa B)**: las 6 copias se reemplazaron por **una sola clase global `.om-fila-hover`** en `index.css` (`transition: background .12s ease-out` + `:hover { background: #F4F4F5 }` = `theme.surfaceAlt`; el hex se inlinea siguiendo la convención del resto de `index.css`, capa base global). Cada sección borró su `<style>` local y pasó sus `<tr>` a `className="om-fila-hover"`. Turnero, cuyas filas son clickeables, movió el `cursor: pointer` a `style` inline en el `<tr>` (antes vivía en su clase scoped). El primitivo `DataTable` mantiene su propio hover con `useId` por instancia (empaqueta también `focus-visible`) — no se tocó. Build verificado OK.

### #23 — `CampoFijo` local candidato a primitivo · Baja · 🔲
*(El resto de #23 ya está resuelto — ver apéndice.)* `CampoFijo` (input no editable estético) sigue local en `SeccionVentas` (único uso). Promover a `components/ui/` si aparece en otra sección.

---

## Etapa 7 — Backend
Otro contexto/repo. Se atacan en un chat de backend dedicado. Varias desbloquean
mejoras de frontend ya identificadas.

### #12 — Campo `tenant.logo` legacy · Media · 🔲
El backend todavía expone `logo` en `GET /negocio`. El front ya no lo lee (el logo viene de `tenant_imagen` tipo='logo'). Limpieza del backend pendiente para el merge de `feature/turnero` a `main` (anotada por el usuario, posiblemente ya en `estado_actual.md`).

### #31 — Endpoint admin no expone `horario_atencion` global del tenant · Media · 🔲
`getNegocio()` devuelve `nombre_negocio`, `booking_url`, `logo` pero no las horas de operación. La agenda de `SeccionTurnero` deriva el rango del propio dataset de turnos (min/max con padding 1h, clamp a 08:00–22:00); si no hay turnos, fallback puro 08:00–22:00.
**Actualización (chat B Gestión)**: el endpoint `GET/PUT /admin/horario-atencion` **ya existe** — devuelve el horario semanal por día (`[{dia_semana, abierto, hora_inicio, hora_fin}]`, días cerrados con horas `null`). Lo consumen `BloqueHorarioAtencion` (CRUD) y `TabBarberos` (defaults de bloque + bloqueo de días cerrados). **Pendiente de frontend**: `SeccionTurnero` debería reemplazar su cálculo min/max de turnos por este valor para mostrar la jornada real aun sin turnos cargados.

### #32 — Endpoint `/admin/turnos` no devuelve `forma_pago` · Media · 🔲
Para turnos `completado`, el dueño querría ver en qué se pagó (efectivo / MP / etc.) desde el modal de detalle. Hoy el endpoint no lo trae (el campo vive en `pago` o `corte`, no en `turno`). Cuando se extienda el endpoint, sumar la fila al modal y promover `BadgeFormaPago` a primitivo (sería el 5to uso confirmado: Caja, Ventas, Gastos, Planillas, Turnero).

### #34 — `/admin/productos/:id/agregar-stock` no es transaccional con el PUT del producto · Media · 🔲
El guardado hace PUT producto y luego PUT agregar-stock como dos requests. Si falla el segundo, el primero ya quedó persistido (queda el producto guardado pero sin el stock sumado). Es backend — evaluar endpoint único que reciba producto + delta de stock, o transacción. Anotado para chat backend.

### #44 — Endpoints de horarios devuelven `HH:MM:SS` (el front recorta a `HH:MM`) · Baja · 🔲
`GET/PUT /admin/horarios/:barberoId` y `GET/PUT /admin/horario-atencion` devuelven las horas en `HH:MM:SS` (TIME crudo de la DB). El `<input type="time">` y las comparaciones de rango trabajan en `HH:MM`, así que el front recorta con `aHoraCorta` (`utils/fecha.js`) en `construirHorarioLocal` y `normalizarBloques`. Detectada al resolver #40 (comparar `'22:00:00' > '22:00'` daba `true`). **Mejora backend**: devolver las horas ya en `HH:MM` para que el front no tenga que adaptar. Riesgo: es cambio de contrato de API — verificar que no rompa otros consumidores (agenda admin, turnero público). Mientras tanto el front es defensivo igual. Anotado para chat backend.

---

## Etapa 8 — Cleanup global / Fase 6
Transversales por diseño. Van al final, alineadas con la Fase 6 del plan de rediseño.
Las dos primeras (#11, #14) caen naturalmente en el rediseño de `MainScreen` (Fase 5.5).

### #11 — `onPointerDown` en `MainScreen` · Media · 🔲
Prohibido por sistema de diseño §4.3 (rompe accesibilidad por teclado, no se puede cancelar deslizando). Reemplazar por `onClick`. **Resuelto ya en PanelAdmin (Fase 3) y en los dos logins (Fase 4)**; queda **solo `MainScreen`** para Fase 5.5.

### #14 — `LogoCirculo` duplicado · Baja · 🔲
El helper que muestra el logo del tenant dentro de un círculo (con fallback a icono `Lock`) está implementado dos veces: `PantallaLoginAdmin.jsx` y `PantallaLoginOperativo.jsx`. Dos usos = momento de promover a `components/ui/` per §7.1, pero hay matiz: la versión admin acepta `lockColor` para reflejar el estado del PIN. **Plan**: promover a primitivo cuando MainScreen necesite el mismo patrón en Fase 5.5 (tercer caso). Mientras tanto, mantenerlas sincronizadas si se modifica alguna. Implementación actual: `object-fit: cover` (caveat: logos no-cuadrados pueden recortarse — iterar si aparece en producción).

### #5 — Re-auditar focus visible en primitivos · Baja · 🔲
Deuda heredada del sistema de diseño #12 (focus visible global). Re-auditar primitivos. (Nota: la Fase 2 dejó verificado que todos los interactivos quedan cubiertos por el `*:focus-visible` global — esto es un repaso de cierre.)

### #6 — Contraste WCAG no verificado · Media · ✅ (2026-05-29)
Deuda heredada del sistema de diseño #9. Auditar contraste de toda la paleta/tipografía contra WCAG AA.

**Auditada (2026-05-29, Fase 6 Etapa B).** Alcance acordado: contraste de color AA de la paleta de tokens (el grueso de la deuda); el foco por teclado queda cubierto por el `*:focus-visible` global (ya verificado en Fase 2 / deuda #5); ARIA pantalla-por-pantalla y reduced-motion quedan fuera de alcance. Umbrales: 4.5:1 texto normal, 3:1 texto grande / UI.

**Resultado: la paleta (derivada de Stripe/Clerk) es esencialmente AA-compliant para texto.**
- Texto principal holgado: `ink` sobre bg/surface/surfaceAlt 18–20:1; `inkSoft` ~14:1; `accentInk` (blanco) sobre `accent` 6.3:1.
- Acento/estados sobre `surface` y su `*Soft`: `accent` 6.3/5.6, `danger` 6.5/5.3, `success` 5.0/4.57, `warning` 5.0/4.51 — todos ≥4.5 (success/warning sobre su soft pasan al filo).

**Dos casos no-conformes, ambos aceptados como excepción consciente:**
- **`muted` (#71717A) sobre `surfaceAlt` (#F4F4F5) = 4.40:1** (falla AA texto normal por 0.1). Solo ocurre con texto secundario (ej. columna "fecha" en Ventas/Gastos) cuando la fila está en **hover transitorio** (`om-fila-hover`); sobre `bg` (4.63) y `surface` (4.83) sí pasa. **Decisión del usuario: aceptar (opción b)** — la diferencia 4.40 vs 4.50 es imperceptible y el estado es transitorio. No se tocó el token (además `muted` es token global compartido con turnero, cuya fuente de verdad vive en `frontend-turnero`). Si algún día se ajusta, oscurecer `muted` a ~#67676F lo lleva a ≥4.5 sin cambio visible.
- **`mutedSoft` (#A1A1AA) sobre `surface` = 2.56:1** — uso exclusivo placeholder / disabled. WCAG exime explícitamente los controles deshabilitados; placeholder es zona gris de la spec. **Decisión del usuario: dejar como está** (estándar de industria). 

Deuda cerrada.

### #8 — Convivencia de utils de formato/fecha · Media · ✅ (2026-05-29)
Convivencia temporal de `utils/formato.js` (nuevo, singular) y `utils/formatos.js` (viejo, plural). Misma situación con `fecha.js` y `fechas.js`. **No era deuda permanente** — se cerró en Fase 6 (eliminar los plurales una vez migrados todos los imports). Mientras duró: al tocar un archivo se migraban sus imports al singular nuevo.

**Avance (2026-05-29, Fase 6 Etapa A)**: `utils/formatos.js` (plural) **eliminado** — tenía 0 imports. Los 3 `Selector*` (`SelectorMes/Dia/Semana`) migrados a `utils/fecha` (singular). Quedó pendiente `utils/fechas.js` (plural), importado solo por `FlujoCorte`.

**Resuelta (2026-05-29, Fase 6 Etapa B)**: `FlujoCorte` (último importador) migrado de `utils/fechas` → `utils/fecha` (singular) — `getFechaHoy`/`formatHora` idénticas (`formatHora` es la canónica con TZ fija) → cero cambio de comportamiento; `utils/fechas.js` **eliminado**. Y consolidación §2.1 cerrada: dentro de `frontend` no había colisiones reales de nombres (las versiones del turnero `fmtHora`/`fmtFechaCorta` no existen acá — otro repo, divergencia intencional D9); la única redundancia interna, `formatARS` (0 usos, opción `{prefijo}` muerta), se colapsó en `fmtPesos` (canónico, implementación inline). `utils/` queda solo con `fecha.js` + `formato.js`. **Deuda cerrada del todo.**

### #9 — Vulnerabilidades reportadas por `npm audit` · Alta · ✅ (2026-05-29)
Detectadas al instalar `lucide-react` en Fase 1 — preexistentes en el árbol de dependencias.
- **Con fix disponible** (resolver con `npm audit fix`): `vite` (3 advisories, alta), `postcss` (XSS, moderada), `picomatch` (ReDoS + injection, alta), `brace-expansion` (DoS, moderada), `flatted` (prototype pollution, alta).
- **Sin fix oficial**: `xlsx` (prototype pollution + ReDoS, alta). SheetJS no publica fix en npm. Evaluar migrar a `exceljs` o aceptar el riesgo documentado.
- Tratamiento: resolver al final de todo (Fase 6) para no mezclar scope con el rediseño visual.

**Resuelta (2026-05-29, Fase 6 Etapa A)**: corrido `npm audit fix` (sin `--force`) tras desinstalar Tailwind — las **5 con fix quedaron resueltas** (`vite`, `postcss`, `picomatch`, `brace-expansion`, `flatted`). Build verificado OK después de los bumps. Sobre **`xlsx`** (high, sin fix oficial): **decisión del usuario = aceptar el riesgo documentado**. Las dos vulns (prototype pollution + ReDoS) se gatillan al *leer* hojas maliciosas; en este proyecto solo *generamos* exports (nunca parseamos archivos de terceros), así que el vector no existe en nuestro flujo. Reevaluar migración a `exceljs` solo si en algún momento se agrega importación de Excel.

---

## Notas / aceptadas (sin acción ahora)

Decisiones conscientes de no resolver. Se listan para no perderlas; se reactivan solo
si cambia el contexto (pedido de usuario, refactor que las toque, etc.).

### #27 — Semántica engañosa de la columna comisión del subtotal del día (`SeccionPlanillas`, tab Detalle) · 💤
El `thead` no tiene columna "Comisión"; el slot de "Pago" del `tfoot` muestra el valor `comisión + propinas` sin label explícito (solo el eyebrow mono al lado indica `XX% + prop` o `$N/c + prop`). El usuario pidió explícitamente mantener la semántica actual durante el rediseño. Vale revisitar como mejora UX en pase de QA o cuando aparezca un pedido — opciones evaluadas: (a) fila aparte debajo del subtotal con "Comisión del día" + "A pagar al barbero", (b) sumar columna "Comisión" al `thead` con valor por corte.

### #28 — Acoplamiento sutil entre tabs en `SeccionPlanillas` · 💤
`infoComisionActiva` se deriva de `resumenData` pero se consume en el tab Detalle (para calcular la comisión por día). El `Promise.all` que carga ambos endpoints en paralelo lo garantiza hoy. Si en el futuro se separan los fetches (ej. lazy load por tab) o se mueve el cálculo de comisión al backend, este acoplamiento se rompe silenciosamente — el render del Detalle se quedaría sin comisión hasta que cargue el Resumen. Anotar para no perderlo si se refactoriza la carga.

### #42 — `BloqueFeriados` con `overflow` propio · 💤
`max-height:260` + `overflowY:auto` en la lista: divergencia **consciente** de la convención "las secciones no tienen overflow propio". Justificada porque la lista de feriados es de largo variable y vive dentro del bloque sin scroll de `TabNegocio` (D16). Si en el futuro se decide que el panel de Gestión scrollee normalmente, revisar si este scroll interno sigue teniendo sentido.

### #45 — Bloque del barbero en un día que el local cerró después no se valida (`TabBarberos`) · 💤
Si el local cambia su horario de atención y **cierra** un día donde un barbero ya tenía un bloque cargado, ese bloque se sigue mostrando editable (sin "Agregar bloque", porque el día figura cerrado), pero `validarHorario` no lo marca como inválido: no hay rango del local contra el cual validarlo (`horarioLocal[dia]` es `undefined`). Decisión consciente al resolver #40 (2026-06-01): dejarlo fuera de alcance por ser un caso de borde poco frecuente, para no ensuciar el scope. Si se quiere endurecer, marcar como inválido todo bloque que caiga en un día cerrado del local (con `horarioLocal != null`).

### #43 — Nombre del negocio + URL de reservas sin self-service (`TabNegocio`) · 💤
El chat de `TabNegocio` removió el formulario de esos dos campos (decisión del usuario: se editan directo en la DB porque cambian muy poco). El endpoint `GET/PUT /admin/negocio` sigue existiendo y `App.jsx`/`PanelAdmin` siguen leyendo el nombre/logo. **Nota de producto**: si en algún momento el producto se vende a terceros (dueños que quieran renombrar su negocio o cambiar la plataforma de turnos sin tocar la DB), reponer un formulario mínimo. Hoy no es necesario.

---

# Apéndice — Deudas resueltas

Historia. No borrar. Formato compacto: # — título — cómo/cuándo se cerró.

- **#1** — `App.css` restos del scaffolding de Vite — **✅** Fase 1 (borrado, nadie lo importaba).
- **#2** — `stylesEstado` hardcodeaba verde `#1a7a4a` + DM Sans en `App.jsx` — **✅** Fase 3 (eliminado).
- **#3** — `index.html` con `lang="en"` y Raleway — **✅** Fase 1 (`lang="es"` + Geist).
- **#7** — `PantallaCargando`/`PantallaError` ad-hoc en `App.jsx` — **✅** Fase 3 (migradas a `Skeleton`/`EmptyState`).
- **#10** — Doble fetch de `getNegocio` (App.jsx + PanelAdmin) — **✅** Fase 3 (`nombreNegocio` pasado por prop desde `App.jsx`).
- **#13** — `Field` divergente entre fronts — **✅** vía D9 (la divergencia de API no se considera deuda).
- **#15** — Excepción "Skeleton no spinner" del admin — **✅** vía D6 (formalizada en el primitivo `LoadingState`).
- **#16** — `BadgeVariacion` candidato a primitivo — **✅** chat de Balances (promovido a `ui/BadgeVariacion.jsx`).
- **#17** — `EmptyState` no acepta `tone` — **✅** 2026-06-01, branch `fix/deudas-frontend`. Prop `tone` (`muted`/`danger`/`success`/`warning`, default neutro idéntico al anterior); tinte `*Soft` del wrapper del glyph (tratamiento B). Propagado `tone="danger"` a los 13 callsites de error.
- **#20** — `DataTable` postergado — **✅** chat A de Gestión (construido `ui/DataTable.jsx`: sort + paginación + `onRowClick` + `col.grow`).
- **#40** — Editor de horario no acota al rango del local — **✅** 2026-06-01, branch `fix/deudas-frontend`. Validador client-side `validarHorario` (vacío / `inicio≥fin` / fuera de rango del local / solapamiento) con `invalid` + mensaje inline + Guardar deshabilitado; `min`/`max` soft en el picker. Bug de comparación `HH:MM:SS` vs `HH:MM` corregido normalizando a `HH:MM` (`aHoraCorta`). Abrió la deuda backend #44.
- **#39** — `humanizarDiasEnMensaje` acoplado al wording backend — **✅** 2026-06-01, branch `fix/deudas-frontend` (opción b). Solapamiento validado client-side dentro de `validarHorario`; eliminada `humanizarDiasEnMensaje`. El editor ya no depende del wording del backend.
- **#36** — Carga de usuario operativo no distingue error de vacío — **✅** 2026-06-01, branch `fix/deudas-frontend` (opción a). Estado `errorCarga` + carga reutilizable `cargarUsuario`; la fila "Usuario" pasa a 4 estados (cargando / error con Reintentar inline / usuario / sin configurar). Cerró el bug secundario del lápiz habilitado en error (abría el modal con `usuarioActual=''`). Quitado el guard `cancelado` (innecesario en React 19).
- **#35** — Cambio de credenciales operativas sin re-autenticación — **✅** 2026-06-01, branch `fix/deudas-frontend`. Re-auth con PIN admin (en usuario y password), **enforzado server-side**: `actualizarCredencialesOperativas` recibe `pin_admin`, `bcrypt.compare` contra `tenant.pin_admin` → 401 antes del UPDATE (calco de `cambiarPinAdmin`). Frontend: campo "PIN de administrador" en ambos modales, 401 al Toast danger. La deuda de mayor prioridad del registro.
- **#22** — Inconsistencia del botón eliminar entre Caja y Ventas/Gastos — **✅** chat de Gastos (promovido `BotonIconoFila`).
- **#23** (parcial) — Sub-componentes locales a primitivos — **✅** chat de Gastos: `BotonIconoFila`, shell de modal (`Modal`), `SelectFormaPago` (`Select`), `DetalleVentaConfirm`/`DetalleMovimientoConfirm` (`DetalleRecurso`). *(Queda abierto solo `CampoFijo` — ver #23 en Etapa 6.)*
- **#26** — `ChipBarbero` candidato a primitivo — **✅** chat de Turnero (promovido a `ui/ChipFiltro.jsx` con prop `size`).
- **#29** — Bug latente `labelMes` no definida en `SeccionBalances` (caso vacío) — **✅** rediseño de Balances (reemplazado por `mesALabel`).
- **#30** — Primitivo `Toast` pendiente — **✅** chat A de Gestión (construido `ui/Toast.jsx`, parte auto-dismiss; migrados `BannerError` de Turnero y `mensajeExito` de Seguridad).
- **#37** — `InputTiempo` local en `TabBarberos` candidato a primitivo — **✅** chat de `TabNegocio` (promovido a `ui/InputTiempo.jsx`, genérico `time`/`datetime-local`/`date`).
- **#38** — `Modal` primitivo sin scroll interno — **✅** 2026-05-29, chat deudas Etapa 1 (commiteado). Reestructurado en 3 zonas: header/footer fijos (`flexShrink:0`) y body scrolleable (`flex:1` + `minHeight:0` + `overflowY:auto`); card con `maxHeight:calc(100vh - 32px)` + `overflow:hidden`. Paddings repartidos para que los modales cortos queden pixel-equivalentes. Verificado visualmente en los 11 callers.
- **#25** — `Modal` id estático `om-modal-title` en `aria-labelledby` — **✅** 2026-05-29, chat deudas Etapa 1 (commiteado). Reemplazado por `useId()` (id único y estable por instancia). Sin referencias colgadas al id viejo.
- **#24** — `ConfirmDialog` no reusa `Modal` — **✅** 2026-05-29, chat deudas Etapa 1 (commiteado). `ConfirmDialog` reescrito como wrapper delgado sobre `Modal` (`message`→`subtitle`, `children`→body, botones→`footer`, `onCancel`→`onClose`). API pública intacta (6 callers sin tocar); hereda scroll interno (#38) y `useId` (#25). De paso, `Modal` ahora no renderiza el body cuando no hay `children` (evita padding muerto en confirms solo-mensaje). Verificado en los 6 callers.

---

*Documento creado: 2026-05-29 — extraído de la sección "## 3. Deudas técnicas" de `docs/plan_redisenio_frontend_gestion.md` para llevar registro y plan de resolución dedicados.*
