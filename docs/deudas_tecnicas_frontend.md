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
| 17 | `EmptyState` no acepta `tone` | 2 | `ui/EmptyState.jsx` | Media | 🔲 |
| 41 | Wrapper "label + `InputTiempo`" duplicado | 2 | `ui/InputTiempo.jsx`, `TabBarberos`, `BloqueFeriados` | Baja | 🔲 |
| 40 | Editor de horario no acota al rango del local | 3 | `TabBarberos` | Media | 🔲 |
| 39 | `humanizarDiasEnMensaje` acoplado al wording backend | 3 | `TabBarberos` | Baja | 🔲 |
| 35 | Cambio de credenciales operativas sin re-auth | 4 | `TabSeguridad` | Alta | 🔲 |
| 36 | Carga de usuario operativo no distingue error de vacío | 4 | `TabSeguridad` | Media | 🔲 |
| 33 | `Number()` sin validar NaN en precio/stock | 5 | `TabServicios`, `TabProductos` | Baja | 🔲 |
| 18 | Tabla ad-hoc con `role=table` en `SeccionInicio` | 6 | `SeccionInicio` | Media | 🔲 |
| 4 / 21 | Hover de fila: `useState` vs `:hover` scoped | 6 | Caja, Ventas, Gastos, Planillas, Balances | Media | 🔲 |
| 23 | `CampoFijo` local candidato a primitivo (resto resuelto) | 6 | `SeccionVentas` | Baja | 🔲 |
| 12 | `tenant.logo` legacy expuesto en `GET /negocio` | 7 (backend) | backend | Media | 🔲 |
| 31 | `getNegocio()` no expone `horario_atencion` | 7 (backend) | backend, `SeccionTurnero` | Media | 🔲 |
| 32 | `/admin/turnos` no devuelve `forma_pago` | 7 (backend) | backend, `SeccionTurnero` | Media | 🔲 |
| 34 | `agregar-stock` no transaccional con PUT producto | 7 (backend) | backend, `TabProductos` | Media | 🔲 |
| 11 | `onPointerDown` en `MainScreen` | 8 (Fase 5.5) | `MainScreen` | Media | 🔲 |
| 14 | `LogoCirculo` duplicado en los dos logins | 8 (Fase 5.5) | `PantallaLoginAdmin`, `PantallaLoginOperativo` | Baja | 🔲 |
| 5 | Re-auditar focus visible en primitivos | 8 (Fase 6) | `ui/*` | Baja | 🔲 |
| 6 | Contraste WCAG no verificado | 8 (Fase 6) | global | Media | 🔲 |
| 8 | Convivencia `formato.js`/`formatos.js` + `fecha.js`/`fechas.js` | 8 (Fase 6) | `utils/*` | Media | ✅ |
| 9 | Vulnerabilidades de `npm audit` | 8 (Fase 6) | `package.json` | Alta | ✅ |
| 27 | Semántica engañosa columna comisión (Planillas) | — | `SeccionPlanillas` | Baja | 💤 |
| 28 | Acoplamiento sutil entre tabs (Planillas) | — | `SeccionPlanillas` | Baja | 💤 |
| 42 | `BloqueFeriados` con overflow propio | — | `BloqueFeriados` | Baja | 💤 |
| 43 | Nombre/URL del negocio sin self-service | — | `TabNegocio` | Baja | 💤 |

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

### #17 — `EmptyState` no acepta `tone` · Media · 🔲
*(mejora opcional, no deuda contra otros fronts — D9)*: el wrapper del glyph fija `color: theme.muted`, por lo que cuando se usa con `IconoAlerta` (estado de error en `SeccionInicio`/`SeccionCaja`), el ícono se ve gris en lugar de rojo. **Plan**: agregar prop `tone` (`'muted' | 'success' | 'danger' | 'warning'`) al primitivo `EmptyState` del admin que pinte el color del wrapper del glyph. Atacar cuando una pantalla lo pida fuerte o como parte de un pase de QA de la fase.

### #41 — Wrapper "label + `InputTiempo`" duplicado — candidato a primitivo (`CampoTiempo`) · Baja · 🔲
Existe como sub-componente local en `TabBarberos` (eyebrow mono + `InputTiempo` full, para el form de ausencias) y, tras el chat de `TabNegocio`, también inline en el modal de alta de `BloqueFeriados` (label "Fecha" + `InputTiempo type="date"`). 2 usos del mismo patrón. Si aparece un 3er uso (§7.1), promover un `CampoTiempo` a `components/ui/` — o, alternativa más limpia, sumar una prop `label` opcional al propio `InputTiempo` para que se autoetiquete como `Field`. Bajo riesgo; sin promover por ahora.

---

## Etapa 3 — `TabBarberos`
Ambas viven en `TabBarberos`. Aprovechar que la Etapa 2 ya dejó abierto el archivo (#41).

### #40 — Sin verdad-cliente del rango horario del local en el editor de horarios del barbero · Media · 🔲
Se bloquea el **día** cerrado del local (card atenuada, sin "Agregar bloque"), pero en un día abierto el editor deja cargar **cualquier** rango horario (ej. 08:00–22:00 aunque el local atienda 10:00–19:00). El backend lo rechaza (y el mensaje se humaniza, ver #39), pero la UI no lo previene. **Mejora**: acotar el `InputTiempo` al rango del local de ese día (min/max) o avisar inline antes de guardar. Requiere tener el rango del local cargado (ya lo tenemos: `horarioLocal[dia] = {inicio, fin}`).

### #39 — `humanizarDiasEnMensaje` acoplado al wording del backend · Baja · 🔲
El mensaje de solapamiento del backend se traduce client-side con un regex sobre `"día N"` → nombre del día. Si el backend cambia el wording (idioma, formato), el regex deja de matchear y el mensaje se muestra crudo (no rompe, solo degrada). Alternativa robusta: validar el solapamiento en el cliente **antes** del PUT y construir el mensaje localmente (duplica la lógica de validación que ya vive en el backend). Bajo riesgo — se aceptó la fragilidad a cambio de no duplicar reglas.

---

## Etapa 4 — `TabSeguridad`
Ambas viven en `TabSeguridad`. #35 es la de mayor prioridad de todo el registro (seguridad).

### #35 — Cambio de credenciales operativas sin re-autenticación · Alta · 🔲
Cambiar usuario o contraseña del modo operativo no pide la contraseña actual (a diferencia del PIN admin, que sí pide el PIN actual). El flujo asume sesión admin ya autenticada (protegida por PIN admin), pero alguien con acceso físico al panel abierto podría cambiar credenciales operativas sin reto. Evaluar pedir contraseña actual / re-validar PIN admin antes de estos cambios. Deuda de seguridad, no visual.

### #36 — Carga del usuario operativo sin reintento · Media · 🔲
Si `getCredencialesOperativas()` falla, `usuarioOperativo` queda `null` y la fila muestra el pill "Sin configurar" — semánticamente erróneo (no es que no esté configurado, es que no se pudo cargar). Distinguir el estado de error del estado "vacío real" (ej. flag `errorCarga` que muestre un Toast/Reintentar en lugar del pill).

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

### #4 / #21 — Hover de fila: `useState` vs `:hover` scoped · Media · 🔲
**#4** (heredada del sistema de diseño #8): inline-styles + `useState` para hover — este front es el que más riesgo tiene por las tablas densas (Caja, Planillas, Balances, Ventas, Gastos). Re-evaluar al terminar Fase 4 con datos reales: si se siente lento, refactor puntual a `:hover` scoped via `<style>`.
**#21**: para las tablas densas se usó un `<style>` inline con clase única (`om-caja-fila:hover`, `om-ventas-fila:hover`, etc.) en vez del patrón `useState` por fila, porque éste último explota re-renders al pasar el mouse en tablas con N filas. Excepción consciente al patrón general (§4.2). Si la deuda #4 se ataca con `:hover` scoped vía `<style>` **reutilizable**, este caso se absorbe.

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

### #6 — Contraste WCAG no verificado · Media · 🔲
Deuda heredada del sistema de diseño #9. Auditar contraste de toda la paleta/tipografía contra WCAG AA en Fase 6.

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
- **#20** — `DataTable` postergado — **✅** chat A de Gestión (construido `ui/DataTable.jsx`: sort + paginación + `onRowClick` + `col.grow`).
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
