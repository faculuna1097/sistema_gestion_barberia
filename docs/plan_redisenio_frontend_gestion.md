# Plan de rediseño — `frontend` (panel de gestión)

Branch de trabajo: `feature/frontend-gestion-ui` (hija de `feature/turnero`).

Este documento es la **bitácora viva** del rediseño visual del panel de gestión.
Acá se anota:
- el plan paso a paso (checkboxes),
- las decisiones tomadas y por qué,
- las consolidaciones pendientes (cosas que quedaron a medio unificar y hay que cerrar al final),
- las deudas técnicas detectadas durante la migración.

Cuando un paso se completa, marcarlo `[x]`. Cuando aparece algo nuevo, agregarlo
a la sección que corresponda. **No borrar nada hasta que esté resuelto.**

---

## 0. Decisiones tomadas

| # | Decisión | Razón |
|---|---|---|
| D1 | Aplicar el sistema de diseño documentado en `docs/sistema_de_disenio.md`. Densidad **compacta** (admin, desktop/iPad, sesiones largas). | Es la superficie correcta para el público (dueño). |
| D2 | **Inline styles + `theme` como módulo JS** (igual que turnero/barbero), con `useState` para hover. | Consistencia entre fronts. La alternativa híbrida con `:hover` queda en deuda. |
| D3 | **Coexistencia con Tailwind** durante la migración. Se desinstala al final, cuando ya no quede ningún `className=` con utilities. | Evita romper pantallas viejas en cada paso. Transición controlada. |
| D4 | **Consolidar utils** del admin con las del turnero (no copiar y pisar). El admin tiene helpers de dominio (semana ISO, desplazamientos, etc.) que no existen en turnero. | Preservar lógica útil. |
| D5 | El frontend es **horizontal** (desktop/iPad), distinto del turnero/barbero (mobile-first). Los fundamentos de turnero (tokens, primitivos universales) sirven igual; lo que cambia es el layout/shell (Fase 3) y la densidad. | Norte ya definido en sistema de diseño §3.6. |
| D6 | **Loading del admin = spinner, no Skeleton** (excepción consciente a §4.5 del sistema de diseño). Materializada en el primitivo `LoadingState` (Lucide `Loader2` centrado). | Las secciones del admin tienen layouts muy heterogéneos (KPIs, tablas densas, formularios); mantener un Skeleton fiel pantalla por pantalla agrega ruido sin beneficio. El turnero/barbero (vistas uniformes mobile-first) siguen usando Skeleton. |
| D7 | **Fondo del área de contenido del admin = `theme.surfaceAlt`** (no `theme.bg`). Se aplica una sola vez en `PanelAdmin.jsx`; las secciones **no** override su contenedor. | Cards blancas (`theme.surface`) sobre `theme.bg` (#FAFAFA) tienen contraste mínimo y se pierde la jerarquía. `theme.surfaceAlt` (#F4F4F5) da el contraste justo manteniendo el ambiente claro tipo Stripe/Linear. Se descartó la alternativa de `shadowSm` en cards porque el token es imperceptible sobre #FAFAFA (opacity 0.06). |
| D8 | **Variante del primitivo `Tabs` = underline** (border-bottom 2px en `theme.accent` sobre el activo, tabs planos sin contenedor). No segmented pill ni pill individual. Variant prop adicional se difiere hasta que aparezca un segundo patrón visual real (§7.4). | Coincide con el norte Stripe/Clerk del sistema. Sobre `theme.surfaceAlt` (fondo del admin, D7), un contenedor segmentado gris-claro sobre gris-claro queda visualmente sucio — el underline se sostiene sin contenedor. Es el patrón más sobrio y compacto, funciona igual de bien con 2, 3 o 6 tabs. |
| D9 | **Política de divergencia entre fronts**: lo que se mantiene consistente son los **estilos estéticos** (tokens, look & feel). Las **APIs** (props, contenido, estructura interna) pueden divergir legítimamente — no es deuda. Si más adelante el otro front necesita la capacidad, se readapta. Documentada en detalle en `docs/sistema_de_disenio.md` §8. | Tratar como deuda toda divergencia de API inflaba el backlog con tareas que nunca se cierran. La consistencia que importa para que el producto se sienta unificado es **visual**, no estructural. |

---

## 1. Fases

### Fase 0 — Decisión arquitectónica ✅
- [x] Definir D2 (inline-styles) y D3 (coexistencia Tailwind).

### Fase 1 — Fundamentos ✅
- [x] Copiar `theme/tokens.js` desde `frontend-turnero` a `frontend/src/theme/tokens.js` (idéntico, con nota de que `maxWidth` no se usa en el shell admin).
- [x] Crear `frontend/src/utils/formato.js` (singular) **consolidado** — ver §2.1.
- [x] Crear `frontend/src/utils/fecha.js` (singular) **consolidado** — ver §2.1.
- [x] Reemplazar `frontend/src/index.css` por la versión de turnero (reset + Geist + keyframes), **manteniendo** el `@import "tailwindcss"` arriba mientras dure la coexistencia. Se conserva también el keyframe `spin` legacy hasta Fase 3 (lo usa el spinner ad-hoc de `App.jsx`).
- [x] Borrar `frontend/src/App.css` y todo import a él (verificado con grep: nadie lo importaba).
- [x] `frontend/index.html`: `lang="es"` y reemplazar el `<link>` de Raleway por el de Geist + Geist Mono.
- [x] Instalar `lucide-react` en `frontend/package.json` (lo necesita Fase 2).
- [x] **No tocar** los archivos viejos `utils/formatos.js` y `utils/fechas.js` todavía — quedan vigentes hasta que la Fase 4 vaya migrando los imports archivo por archivo. Eliminación final anotada en Fase 6 y deuda §3-8.

### Fase 2 — Primitivos universales ✅
- [x] Copiar a `frontend/src/components/ui/` los 13 primitivos universales de turnero (lista en sistema de diseño §6.1) **idénticos**. Se sumó también `IconoAlerta` (helper SVG que turnero exporta y usamos para el glyph del `EmptyState` de error).
- [x] Crear `frontend/src/components/ui/index.js` (barrel) con los exports.
- [x] Verificar focus visible en todos. Resultado: todos los interactivos (Button, Card, Field, TopBar, ConfirmDialog) quedan cubiertos por el `*:focus-visible` global de `index.css` (outline indigo 2px). Field además tiene ring propio en el input. **Sin deuda nueva por focus.**
- [x] **Diferido**: los ajustes de densidad compacta NO se aplican upfront. Se hacen puntualmente durante Fase 4 cuando una pantalla real lo pida. Si el ajuste sirve a 2+ pantallas, se sube al primitivo (regla §7.4 del sistema de diseño).

**Pendiente para Fase 3** (anotado también en el header de `PageContainer.jsx`): el primitivo es mobile-first con `maxWidth: 480`. No sirve tal cual para el shell admin horizontal. Decidir en Fase 3 entre:
- (a) modificar el primitivo agregando props `maxWidth`/`fluid` para que sirva a los dos fronts, o
- (b) crear un `AdminPageContainer` paralelo en `frontend/src/components/ui/` que copie el patrón pero adaptado al desktop.

### Fase 3 — Shell del admin ✅
**Alcance**: solo `App.jsx` y `PanelAdmin.jsx`. `MainScreen.jsx` queda **fuera** y se ataca en su propia fase con chat dedicado (ver Fase 5.5).

Decisiones tomadas:
- **PageContainer**: queda intacto (mobile-first). El admin tiene su propio wrapper raíz porque su layout es `flex row` (sidebar + contenido), no columna centrada con max-width. El primitivo lo usarán los logins en Fase 4.
- **Sidebar**: pasa a **claro** (coherente con el norte "Luz / Stripe/Clerk"). Reversible si en la práctica no convence.

Sub-pasos:
- [x] Refactor de `App.jsx`: `stylesEstado` eliminado. `PantallaCargando` ahora usa 3 `Skeleton` en columna centrada. `PantallaError` usa `EmptyState` + `IconoAlerta` + `Button`. Se sumó `nombreNegocio` al estado y se pasa como prop a `PanelAdmin` (resuelve deuda #10). El keyframe `spin` queda en `index.css` porque lo usan 4 secciones todavía — se borra al final de Fase 4.
- [x] Refactor de `PanelAdmin.jsx`: sidebar claro (`theme.surface` + border `theme.hairline`), tokens del theme, Geist, **iconos Lucide** (Home, DollarSign, ClipboardList, BarChart3, ShoppingBag, Receipt, Calendar, Settings, LogOut, ChevronLeft/Right, AlertTriangle, X), `onClick` en todos los botones, conservada funcionalidad de colapso (220 ↔ 64 px) y banner de aviso de pago (re-estilado con `theme.warning`/`theme.warningSoft`). Item activo: `bg theme.accentSoft` + `color theme.accent` + indicador lateral indigo de 3×18 px. Hover en navItems y botón cerrar sesión vía `useState` (8 items, costo trivial). Resuelve deuda #10 (sin fetch propio de getNegocio) y resuelve parcialmente deuda #11 (PanelAdmin); MainScreen pendiente en Fase 5.5.

### Fase 4 — Migración por sección
Orden acordado. **Los 3 flujos de `MainScreen` (Corte/Venta/Gasto) van al final.**

- [x] `PantallaLoginAdmin.jsx` y `PantallaLoginOperativo.jsx`. Cambios principales:
  - Logo en ambas pantallas viene de `getImagenesNegocio()` (filtro `tipo === 'logo'`, ordenado por `orden`). El campo `tenant.logo` legacy ya no se lee desde el front; queda anotado para limpieza al mergear feature/turnero a main (ver §3-12).
  - Login admin: `PageContainer` + `TopBar` con "Cancelar"/"Volver" + logo o `Lock` (Lucide) como fallback + título centrado + indicadores 4 puntos + numpad táctil 3×4 (`TeclaNum` local) + teclado físico. Pantalla bloqueada usa `EmptyState` + `IconoAlerta` + `Card` de contacto. `onPointerDown` → `onClick`. Animación shake migrada de inline `<style>` al keyframe `om-shake` en `index.css`.
  - Login operativo: `PageContainer` + logo o `Lock` fallback + `Field` (usuario, contraseña) + `Button`. Error inline en el subtitle con `theme.danger`.
  - Extensión del primitivo `Field`: nuevos props `disabled`, `autoComplete`, `autoCapitalize`, `autoCorrect`, `spellCheck`. Visual de disabled: fondo `surfaceAlt`, texto `muted`, opacity 0.7, cursor `not-allowed`. **Pendiente backport a turnero** (deuda §3-13).
  - Sumado `getImagenesNegocio()` a `services/api.js` (copiado del turnero). `App.jsx` ahora hace `Promise.all([getNegocio, getImagenesNegocio])` para cargar tenant + logo en paralelo.
- [x] `SeccionInicio.jsx` (validación del sistema con una sección chica). Cambios principales:
  - Layout: 3 cards apiladas verticalmente. `CardDia` + `CardMes` con altura igualada via grid `gridAutoRows: 1fr`; `CardStock` full-width abajo. Contenido centrado vertical y horizontalmente dentro de cada card y de cada `Metrica`.
  - Migración a primitivos: `ScreenHeader`, `Card`, `EmptyState`, `Button`, `IconoAlerta`. Sumado **`LoadingState`** nuevo (ver D6) — usado para el estado de carga; el error usa `EmptyState` + `IconoAlerta` + botón "Reintentar" (trigger por estado `intento` que re-ejecuta el efecto con guard de cancelación).
  - Tipografía Geist + tokens en todo. Eliminados colores hardcodeados (`#1a7a4a`, `#c0392b`, `#888`, `#eee`, etc.), fuente `DM Sans` y emojis (👤👥💵✓). Iconografía Lucide (`Users`, `DollarSign`, `Package`, `CheckCircle2`, `TrendingUp/Down`, `RefreshCw`).
  - `formatMonto` local eliminado — la sección ahora usa `fmtPesos` de `utils/formato.js`.
  - `BadgeVariacion` rediseñado (pill `successSoft`/`dangerSoft` + `TrendingUp`/`Down` + `%`). Estado "sin datos" pasa de pill gris a texto muted plano. **Queda local** a `SeccionInicio` — promoción a primitivo cuando aparezca el segundo uso (probable: Balances/Ventas).
  - Tabla de stock ad-hoc con grid 3 columnas y `tabular-nums`; el caso "stock en orden" usa `EmptyState` con `CheckCircle2`. `DataTable` se posterga a Fase 5 (regla §7.1: esperar al segundo uso real con requisitos de filtros/sort/paginación).
  - `PanelAdmin.jsx`: fondo del `<main>` pasa de `theme.bg` a `theme.surfaceAlt` (decisión D7). Las secciones no override.
  - Resuelve parcialmente la deuda #15 ("excepción spinner") al formalizar D6.
- [x] `SeccionCaja.jsx`. Cambios principales:
  - Nuevo primitivo **`Tabs`** (variante underline, Stripe/Clerk look — formaliza D8). Navegación por teclado WAI-ARIA (←/→, Home/End), soporte de ícono opcional por tab. Primer uso aquí, próximo esperado en `SeccionGestion`.
  - `ConfirmDialog` extendido con prop `children` opcional para renderizar detalle estructurado debajo del `message` (resumen del recurso a eliminar). Reemplaza el modal ad-hoc original. La divergencia con turnero no se considera deuda per D9.
  - Sub-componentes `BadgeFormaPago`, `TogglePill`, `BotonExportarExcel` rediseñados in-place con tokens + Geist + Lucide + `onClick`. **Sin** promoverlos a `/components/ui/` todavía (eso es Fase 5). `BadgeFormaPago` además resuelve un bug menor: forma desconocida ya no cae silenciosamente a "Mercado Pago", muestra el valor crudo con estilos neutros.
  - 6 callsites de `BotonExportarExcel` migrados de `onPointerDown` → `onClick` en Caja, Balances ×2, Planillas, Ventas, Gastos. `TogglePill` ya usaba `onToggle` (sin migración).
  - Imports migrados a `utils/formato.js` (singular) y `utils/fecha.js` (singular). En SeccionCaja se usa `fmtPesos` (consistente con SeccionInicio) en lugar de `formatARS`.
  - Layout: `ScreenHeader` ("Caja" / "Movimientos diarios y cierres") + `Tabs` + tab activo. Tab Movimientos: 2 cards de totales (efectivo via Lucide `Banknote`, MP via `<img>` real con fallback a `Banknote`), fila de acciones (toggle | SelectorDia | exportar), tabla densa o `EmptyState`. Tabs Cierre/Historial: `EmptyState` con glyph `Construction` y copy "Próximamente".
  - Tabla densa ad-hoc (sin `DataTable` aún, postergado a Fase 5 — ver deuda #20). Sin zebra, sin fila rosada de gasto — jerarquía por pill `TipoMovimientoPill` (local) + monto en `theme.danger` para gastos. Hover de fila vía `:hover` scoped con `<style>` inline (excepción consciente, ver deuda #21). Botón eliminar por fila: Lucide `Trash2` 16, hover a `danger` + `dangerSoft`.
  - Loading via `LoadingState` (D6). Error via `EmptyState` + `IconoAlerta` + botón "Reintentar" con trigger por estado `intento` y guard de cancelación (mismo patrón que SeccionInicio).
  - Comentario inline explicando la semántica del filtro "Solo Barberos" (saca cortes con comisión 100% porque van directo al bolsillo del barbero, no a la caja del local) — para que el próximo lector entienda sin contexto.
  - Resuelve deuda #11 para SeccionCaja (eliminado todo `onPointerDown`).
- [ ] `SeccionVentas.jsx`.
- [ ] `SeccionGastos.jsx`.
- [ ] `SeccionPlanillas.jsx`.
- [ ] `SeccionBalances.jsx`.
- [ ] `SeccionTurnero.jsx`.
- [ ] `SeccionGestion.jsx` + tabs (`TabProductos`, `TabServicios`, `TabTurnero`, `TabNegocio`, `TabSeguridad`, `TabBarberos`, `BloqueHorarioAtencion`, `BloqueFeriados`, `BloqueImagenes`).
- [ ] `FlujoCorte.jsx`, `FlujoVenta.jsx`, `FlujoGasto.jsx` (último).

### Fase 5.5 — Rediseño de MainScreen (chat dedicado)
**Pantalla operativa del local (la "home" del iPad).** Decisión del usuario: se ataca en su propio chat porque además del rediseño visual se va a sumar la imagen del local + logo, y se quiere dedicar tiempo a que quede bien.

Pendientes a resolver en ese chat:
- Migración de los 3 botones gigantes (Corte / Venta / Gasto) al sistema (probablemente como cards de acción locales a MainScreen — regla §7.1).
- Decisión final sobre los colores actuales (verde/rojo) vs el "solo indigo" del sistema. Opciones planteadas en este chat: (a) todo indigo, (b) mantener verde/rojo como excepción consciente, (c) usar `theme.success` / `theme.danger` como acentos de acción.
- Sumar foto del local + logo al diseño.
- Eliminar `onPointerDown` (§4.3) y `clamp()`/vh-vw arbitrarios.

### Fase 5 — Primitivos específicos del front gestión
A construir cuando aparezcan durante Fase 4 (regla §7.5 del sistema de diseño: cuando el primer caso real lo necesite).

- [ ] `DataTable` denso (filas 36–40 px). Primer front que la necesita.
- [ ] Evaluar consolidación de `SelectorMes` / `SelectorSemana` / `SelectorDia` / `SelectorPeriodo` en un `PeriodSelector` único.
- [ ] Migrar a primitivos: `TogglePill`, `BadgeFormaPago`, `BotonExportarExcel`.

### Fase 6 — Cleanup final
- [ ] Eliminar `frontend/src/utils/formatos.js` (plural) y `frontend/src/utils/fechas.js` (plural) — ya no debería quedar ningún import.
- [ ] Resolver consolidaciones pendientes de §2.
- [ ] Desinstalar Tailwind: quitar `@import "tailwindcss"` de `index.css`, sacar `tailwindcss`, `@tailwindcss/postcss`, `autoprefixer`, `postcss` de `package.json` (si no los usa otra cosa), `npm install` para limpiar.
- [ ] Auditoría WCAG (deuda global del sistema de diseño #9).
- [ ] Revisitar deuda #8: ¿necesitamos `:hover` scoped para las tablas densas? Medir.
- [ ] Resolver vulnerabilidades de `npm audit` (deuda §3-9): correr `npm audit fix` para las 5 con fix disponible (`vite`, `postcss`, `picomatch`, `brace-expansion`, `flatted`). Decidir aparte qué hacer con `xlsx` (sin fix oficial — evaluar migrar a `exceljs`).

---

## 2. Consolidaciones pendientes (cerrar en Fase 6)

Cosas que durante Fase 1 quedaron a "mantener ambas" para no romper, y que hay
que unificar al final con un solo nombre / una sola implementación.

### 2.1 Utils de formato / fecha — colisiones a resolver

| Función admin actual | Función turnero | Decisión propuesta | Estado |
|---|---|---|---|
| `formatARS(valor, {prefijo})` (`utils/formatos.js`) | `fmtPesos(n)` (`utils/formato.js`) | Mantener `formatARS` como canónica (es más completa). Exponer `fmtPesos` como alias delgado. Al final, decidir un único nombre y migrar imports. | Pendiente |
| `formatHora(iso)` con TZ fija `America/Argentina/Buenos_Aires` | `fmtHora(iso)` con TZ del navegador | El de admin es más correcto. Adoptar la versión con TZ fija como canónica. Turnero migra después. | Pendiente |
| `formatFechaCorta(fechaStr)` → "Domingo 15/03" | `fmtFechaCorta(fechaStr)` → "lun 19/05" | Son distintas (largo vs short narrow). Renombrar la del admin a `fmtFechaCortaLarga` o similar para que convivan sin chocar. | Pendiente |
| `formatPago(forma)` | (no existe en turnero) | Mantener en admin. | OK |
| `getFechaHoy`, `getMesActual`, `getSemanaActual` | (no existen en turnero) | Mantener en admin. | OK |
| `desplazarMes`, `desplazarSemana`, `desplazarDia` | (no existen en turnero) | Mantener en admin. | OK |
| `mesALabel`, `semanaALabel`, `fechaALabel`, `semanaAFechaLunes`, `getISOWeekNum`, `semanaALunes`, `MESES`, `DIAS`, `TZ` | (no existen) | Mantener en admin. | OK |
| (no existe en admin) | `generarProximosDias`, `fmtFechaLarga`, `fmtFechaHora`, `diaSemana`, `diaNumero`, `nombreMes`, `esHoy`, `diaDeSemana` | Sumar al `fecha.js` consolidado del admin si Fase 4 los necesita. | A demanda |

### 2.2 Tailwind → inline-styles

Al final de Fase 4 no debería quedar ningún `className=` con utilities de Tailwind
en `frontend/src/`. Si queda alguno, listarlo acá antes de desinstalar.

- [ ] Grep `className="` en `frontend/src/` previo a Fase 6 para confirmar limpieza total.

---

## 3. Deudas técnicas detectadas durante este rediseño

Numeradas para poder referenciarlas. Cuando se resuelvan, marcar `~~tachado~~` y
mover a una sección "resueltas" o dejar la nota inline.

1. `frontend/src/App.css` — restos del scaffolding de Vite (`.logo`, `.card`, `.read-the-docs`) y un `@keyframes logo-spin` decorativo. Sospecha: nadie lo importa. Verificar y borrar (Fase 1).
2. `frontend/src/App.jsx` — `stylesEstado` hardcodea verde `#1a7a4a` y `DM Sans`. Incoherente con el theme. Se va en Fase 3.
3. `frontend/index.html` — `lang="en"` (deuda global del sistema de diseño #11) y carga **Raleway** (no Geist). Se resuelve en Fase 1.
4. Deuda heredada del sistema de diseño **#8** (inline-styles + useState para hover) — este front es el que más riesgo tiene por las tablas densas (Caja, Planillas, Balances, Ventas, Gastos). Re-evaluar al terminar Fase 4 con datos reales: si se siente lento, refactor puntual a `:hover` scoped via `<style>`.
5. Deuda heredada del sistema de diseño **#12** (focus visible global) — re-auditar primitivos al final de Fase 2.
6. Deuda heredada del sistema de diseño **#9** (contraste WCAG no verificado) — auditar en Fase 6.
7. `PantallaCargando` y `PantallaError` (en `App.jsx`) son ad-hoc y duplican la responsabilidad de los primitivos `Skeleton` y `EmptyState`. Se eliminan en Fase 3.
8. Convivencia temporal de `utils/formato.js` (nuevo, singular) y `utils/formatos.js` (viejo, plural). Misma situación con `fecha.js` y `fechas.js`. **No es deuda permanente** — se cierra en Fase 6, pero hay riesgo de imports cruzados si no se controla. Mientras dure: cuando se toque un archivo, migrar sus imports al singular nuevo.
10. **Doble fetch de `getNegocio`**: `App.jsx` lo llama para `logoUrl`/`bookingUrl`/`document.title`, y `PanelAdmin.jsx` lo llama de nuevo para `nombre_negocio`. El backend devuelve todo en una sola request. Pasar `nombreNegocio` por prop desde `App.jsx` o subir un context. Atacar durante Fase 3 al refactorizar PanelAdmin.
11. **`onPointerDown` usado en `MainScreen.jsx` y `PanelAdmin.jsx`** — prohibido por sistema de diseño §4.3 (rompe accesibilidad por teclado, no se puede cancelar deslizando). Reemplazar por `onClick` en Fase 3 (PanelAdmin) y Fase 5.5 (MainScreen). **Resuelto en PanelAdmin (Fase 3) y en los dos logins (Fase 4)**; queda MainScreen para 5.5.
12. **Campo `tenant.logo` legacy** — el backend todavía expone `logo` en `GET /negocio`. El front ya no lo lee (el logo viene de `tenant_imagen` tipo='logo'). Limpieza del backend pendiente para el merge de feature/turnero a main (anotada por el usuario, posiblemente ya esté en `estado_actual.md`).
13. ~~**`Field` divergente entre fronts**~~ — **Resuelto vía D9**: la extensión de API en un front sin reflejar en el otro ya no se considera deuda. Si turnero necesita las mismas props (`disabled`, `autoComplete`, etc.), se readaptan ahí cuando aparezca el caso.
14. **`LogoCirculo` duplicado**: el helper que muestra el logo del tenant dentro de un círculo (con fallback a icono `Lock`) está implementado dos veces, una en `PantallaLoginAdmin.jsx` y otra en `PantallaLoginOperativo.jsx`. Dos usos = momento de promover a `components/ui/` per §7.1, pero hay matiz: la versión admin acepta `lockColor` para reflejar el estado del PIN. **Plan**: promover a primitivo cuando MainScreen necesite el mismo patrón en Fase 5.5 (tercer caso). Mientras tanto, mantenerlas sincronizadas si se modifica alguna. Implementación actual: `object-fit: cover` para que el logo llene el círculo (caveat: logos no-cuadrados pueden recortarse — iterar si aparece en producción).
15. ~~**Excepción a regla "Skeleton no spinner"**~~ — **Resuelto vía D6**: la excepción dejó de ser puntual de `PantallaCargando` y se formalizó como regla del admin con el primitivo `LoadingState`. Anotación en `docs/sistema_de_disenio.md` §4.5 actualizada en este mismo ciclo.
16. **`BadgeVariacion` candidato a primitivo**: implementado local en `SeccionInicio.jsx` (pill `successSoft`/`dangerSoft` + `TrendingUp`/`Down` + %). Probable que `SeccionBalances` y `SeccionVentas` lo necesiten para comparativas. Promover a `components/ui/` cuando aparezca el segundo uso (regla §7.1). Mantener sincronizado si se modifica.
17. **`EmptyState` no acepta `tone`** *(mejora opcional, no deuda contra otros fronts — D9)*: el wrapper del glyph fija `color: theme.muted`, por lo que cuando se usa con `IconoAlerta` (estado de error en `SeccionInicio`/`SeccionCaja`), el ícono se ve gris en lugar de rojo. **Plan**: agregar prop `tone` (`'muted' | 'success' | 'danger' | 'warning'`) al primitivo `EmptyState` del admin que pinte el color del wrapper del glyph. Atacar cuando una pantalla lo pida fuerte o como parte de un pase de QA de la fase.
18. **Tabla ad-hoc con `role="table"/"row"/"cell"` en `SeccionInicio`**: parche de accesibilidad mientras `DataTable` no exista. Se reemplaza naturalmente cuando se construya el primitivo en Fase 5 (esperado durante Ventas/Balances).
20. **`DataTable` postergado a Fase 5**: `SeccionCaja` resolvió su tabla densa ad-hoc (sin sort, filtros complejos ni paginación; un único filtro toggle). El primer caso real que justifique construir el primitivo se espera en `SeccionVentas` o `SeccionBalances`, donde aparecerán sort + filtros + totales por fila. Mientras tanto, las tablas se construyen ad-hoc con tokens.
21. **Hover de fila vía `:hover` scoped en `SeccionCaja`**: para la tabla densa se usó un `<style>` inline con clase única (`om-caja-fila:hover`) en vez del patrón `useState` por fila, porque éste último explota re-renders al pasar el mouse en tablas con N filas. Excepción consciente al patrón general (§4.2). Si la deuda #8 se ataca con `:hover` scoped vía `<style>` reutilizable, este caso se absorbe.
9. **Vulnerabilidades reportadas por `npm audit`** (detectadas al instalar `lucide-react` en Fase 1 — no las introdujo lucide, son preexistentes en el árbol de dependencias):
   - **Con fix disponible** (resolver con `npm audit fix`): `vite` (3 advisories, alta), `postcss` (XSS, moderada), `picomatch` (ReDoS + injection, alta), `brace-expansion` (DoS, moderada), `flatted` (prototype pollution, alta).
   - **Sin fix oficial**: `xlsx` (prototype pollution + ReDoS, alta). SheetJS no publica fix en npm. Evaluar migrar a `exceljs` o aceptar el riesgo documentado.
   - Tratamiento: resolver al final de todo (Fase 6) para no mezclar scope con el rediseño visual.

---

*Última actualización: 2026-05-26 — `SeccionCaja` cerrada. Decisiones nuevas: D8 (variante del primitivo `Tabs` = underline) y D9 (política de divergencia entre fronts: solo los estilos estéticos se mantienen consistentes, las APIs pueden divergir sin ser deuda — documentada en `docs/sistema_de_disenio.md` §8). Primitivo nuevo: `Tabs`. Primitivo extendido: `ConfirmDialog` con `children` opcional. Sub-componentes locales (`BadgeFormaPago`, `TogglePill`, `BotonExportarExcel`) rediseñados in-place; promoverlos a `/ui/` queda en Fase 5. Deudas nuevas: #20 (`DataTable` postergado), #21 (`:hover` scoped en tabla de Caja). Deudas resueltas vía D9: #13 (`Field` divergente). Deuda #17 reformulada como mejora opcional (sin parte "backport"). Próximo chat: `SeccionVentas`.*
