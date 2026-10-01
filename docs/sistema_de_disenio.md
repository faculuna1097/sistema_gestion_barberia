# Sistema de diseño

Este documento describe cómo construimos UI en este proyecto. Está pensado
para que **cualquier chat** (existente o nuevo) que vaya a escribir frontend
arranque alineado con el resto del producto.

Complementario a **`docs/convenciones_tecnicas.md`** (convenciones de código
generales, no específicas de UI).

---

## 0. Norte del producto

SaaS de gestión para barberías. Las decisiones de UI se ordenan por estas
prioridades, en este orden:

1. Claridad y velocidad de uso.
2. Sensación profesional y premium.
3. UI limpia, moderna y simple.
4. Evitar complejidad visual innecesaria.
5. Consistencia total entre pantallas.

**Debe sentirse**: profesional, rápido, confiable, moderno, orientado a
negocios reales.

**NO debe sentirse**: template genérico, dashboard crypto/web3, gaming,
demasiado corporativo, sobrecargado visualmente, infantil, excesivamente
colorido.

Inspiraciones de referencia: **Stripe** y **Clerk** (luz, neutros, un único
acento). Linear / Vercel / Notion / Raycast / Supabase son inspiraciones
secundarias — sirven como vibe check, no como guía de implementación.

Ante una duda de diseño que el resto del doc no resuelve, **volvé a estas
prioridades**.

---

## 1. Fuente de verdad

La implementación de referencia vive en **`frontend-turnero/src/`**:

| Carpeta | Contenido |
|---|---|
| `theme/tokens.js` | Tokens (colores, tipo, spacing, radii). Una sola fuente. |
| `utils/formato.js` | `fmtPesos`. |
| `utils/fecha.js` | `fmtFechaCorta`, `fmtFechaLarga`, `fmtHora`, `fmtFechaHora`, `generarProximosDias`, `esHoy`, `diaSemana`, etc. |
| `components/ui/` | Primitivos React reutilizables (ver inventario abajo). |
| `index.css` | Reset + carga de Geist + `@keyframes`. |

**Cualquier chat que toque UI debería leer estos archivos antes de escribir
código nuevo.** No re-inventar.

---

## 2. Cosas que NO hacemos

Lista corta de prohibiciones explícitas. Alinea rápido a cualquier chat nuevo.

- ❌ `alert()`, `confirm()`, `prompt()` nativos. Usar `ConfirmDialog`.
- ❌ CSS classes globales. Excepción: `index.css` para reset / fonts / keyframes. La landing suma unas pocas clases `om-` porque se pre-renderiza (ver §4.1).
- ❌ Múltiples colores de acento. Solo `theme.accent` (indigo).
- ❌ Indigo en un monto. El color de la plata sigue §3.1.1.
- ❌ Sombras pesadas, glow, gradientes.
- ❌ Glassmorphism, blurs decorativos.
- ❌ Animaciones decorativas. Solo animaciones funcionales (`om-fade` al cambiar pantalla, `om-pop` en success).
- ❌ `<p>Cargando...</p>` o `<p>Error</p>`. Usar `Skeleton` / `EmptyState`.
- ❌ `onPointerDown` en botones. Siempre `onClick`.
- ❌ Tamaños/colores hardcodeados. Todo desde `theme`.
- ❌ Centralizar primitivos prematuramente (ver §7.1).
- ❌ Crear un componente nuevo sin chequear primero si existe algo parecido.

---

## 3. Tema visual fijado: **Luz**

Inspirado en Stripe / Clerk. Neutral claro + acento indigo.

### 3.1 Colores
- Neutros: `zinc` (`bg`, `surface`, `surfaceAlt`, `ink`, `inkSoft`, `muted`, `mutedSoft`, `hairline`, `hairlineSoft`).
- Acento: `indigo-600` (`accent`). **Un solo acento. No agregar otros chromaticos**.
- Estados: `success` (green-700), `danger` (red-700), `warning` (amber-700). Discretos.

#### 3.1.1 Color en montos

Decidido el 2026-10-01. El color de un monto dice qué le pasa a la plata, no
decora. Casi todo lo que muestra el panel es ingreso: si todo lo que entra
fuera verde, el verde dejaría de avisar algo.

| Rol del monto | Color | Ejemplos |
|---|---|---|
| **Resultado**: el número final de una cuenta | `success` si es positivo, `danger` si es negativo, `ink` si da cero (`colorResultado`, en `utils/colorMonto.js`) | Ganancia del mes, "Queda en el negocio", neto por medio de pago en Caja |
| **Salida junto a entradas**: en una cuenta o en una lista mixta | `danger` | Comisiones y egresos en Balances, gastos y retiros en Caja, renglones `−` de `DesgloseMontos` |
| **Salidas solas**: una lista donde todo son salidas | filas en `ink`, el total en `danger` | Sección Gastos, "Egresos por categoría", flujo de Gasto |
| **Todo lo demás** | `ink` | Ingresos brutos y netos, totales de ventas, precios, subtotales, aportes, Planillas |

- **Indigo nunca pinta un monto.** Un texto en el color de la marca se lee como
  algo clickeable. Un número importante se destaca con tamaño y peso; el indigo
  queda para interacción, selección y estructura (la línea de 2px de las filas
  TOTAL).
- **Un monto negativo va en `danger`**, aunque sea un paso intermedio de la
  cuenta (ej. la ganancia como primer renglón de la cuenta de capital).
  `fmtPesos` lo muestra como `-$ 130.000`. El color de un resultado se decide
  sobre el monto redondeado a pesos, igual que lo muestra `fmtPesos`: un
  resultado de `$ 0` va en `ink`.
- **El color nunca va solo:** signo, operador (`+ − =`) o una columna con su
  nombre. Cerca de 1 de cada 12 hombres tiene algún grado de daltonismo
  rojo-verde.
- **Depende de quién mira.** La comisión es una salida para el dueño y lo que
  cobra el barbero. Donde miran los dos (Planillas, que también se abre en modo
  barbero) va en `ink`: es una liquidación.
- **En una lista de un solo tipo, el título ya dice qué es:** un rojo por fila
  no agrega información. Caja sí pinta cada gasto en rojo porque mezcla entradas
  y salidas.
- **Las barras de montos** (`BarraProporcional`, `DesgloseMontos`) llevan el
  color de su monto; las neutras, `mutedSoft`.
- **Variación %** (`BadgeVariacion`): verde es buena noticia. Hoy solo mide cosas
  donde subir es bueno (facturación, ganancia); si algún día mide gastos, hay
  que invertirla.
- **Fuera de esta regla:** las pills de tipo de movimiento y de forma de pago
  (son categorías), los contadores por estado (ej. "Reservados" en indigo, el
  color de ese estado en la agenda) y la fecha de "hoy" resaltada.
- **Dónde está aplicada:** en el panel de gestión. El turnero ya cumple (sus
  precios van en `ink`); falta `frontend-barbero` (ver Pendientes en
  `estado_actual.md`).

### 3.2 Tipografía
- **Geist** (body) + **Geist Mono** (eyebrows / micro labels en mayúsculas).
- 4 tamaños recurrentes capados:
  - `sizeTitle` (24) — h1 de pantalla.
  - `sizeHeading` (18) — h2/h3, títulos de card.
  - `sizeBody` (14) — texto base.
  - `sizeMicro` (11) — eyebrows, helper text en mono uppercase.
- 3 pesos: regular (400), medium (500), heading (600). Nada de 700+.

### 3.3 Spacing
Escala fija: **4, 8, 12, 16, 24, 32**. No usar paddings arbitrarios.

### 3.4 Radii
- `radiusSm` (6) — skeletons, pills.
- `radius` (10) — botones, inputs, cards normales.
- `radiusLg` (14) — cards "destacadas" (resumen, panel inline grande).

### 3.5 Sombras
Mínimas. `shadowSm` para botones primarios, `shadowMd` para cards flotantes
(ej. modales). **Sin glow, sin gradientes, sin glassmorphism.**

### 3.6 Densidad por superficie

El producto tiene tres superficies con públicos y objetivos distintos.
La densidad visual debe acompañar.

| Superficie | Público | Densidad | Padding card | Spacing entre bloques |
|---|---|---|---|---|
| **Turnero** (cliente final) | Visitante esporádico, mobile-first | **Aireada** | 16–24 | 24–32 |
| **Panel barbero** (uso diario) | Empleado, mobile + desktop | **Intermedia** | 12–16 | 16–24 |
| **Panel gestión** (admin) | Dueño, desktop, sesiones largas | **Compacta** | 8–12 | 12–16 |

Reglas que cambian según densidad:
- **Tipografía**: el turnero puede usar `sizeHeading` (18) generosamente; gestión prioriza `sizeBody` (14) incluso en títulos de card. **No bajar nunca de 14 en texto leíble**.
- **Tablas**: gestión usa tablas densas (filas de 36–40 px); barbero / turnero priorizan cards.
- **Whitespace**: aireado en turnero, justo en gestión. Pero **nunca sacrificar legibilidad** por compactar.

Si una pantalla nueva no encaja claramente en una superficie, default = **intermedia**.

### 3.7 Iconografía

**Librería elegida: Lucide** (`lucide-react`). Decidida durante el rediseño de
`frontend-barbero` — primer front que necesitó íconos de forma sistemática
(bottom nav, estados de turno, acciones). Trazo fino coherente con el vibe
Stripe/Clerk y tree-shakeable por import directo (`import { Calendar } from 'lucide-react'`).

Reglas para íconos:
- Cuando otro front necesite íconos, **usar Lucide también** — no mezclar librerías.
- Tamaños fijos: **16, 20, 24** (acompañan tipografía).
- Color = `currentColor` o un token de `theme`. Nunca hardcodear el color.
- `strokeWidth` típico **1.5–1.75**; `2` para íconos que deben pesar (acción primaria).
- **Nunca decorativos**. Si un ícono no aporta información o reduce cognición, sacarlo.

---

## 4. Convenciones de implementación

Decisiones de cómo escribimos los componentes. Si vas a contribuir, seguilas.

### 4.1 Inline styles + theme como módulo JS

**Ningún componente usa CSS classes globales.** Cada componente importa el
tema y aplica estilos inline:

```jsx
import { theme } from '../../theme/tokens.js';

function Botoncito({ children }) {
  return (
    <button style={{
      background: theme.accent,
      color: theme.accentInk,
      padding: '12px 16px',
      borderRadius: theme.radius,
    }}>{children}</button>
  );
}
```

**Por qué**:
- El estilo vive al lado del JSX → menos saltos entre archivos.
- Cero magia de cascada CSS, fácil de leer para quien no es CSS-pro.
- Theme como objeto JS permite refactors con búsqueda directa.
- No necesitamos Tailwind, CSS Modules, styled-components, ni nada extra.

**Excepción**: `index.css` define el reset, la carga de Geist, los
`@keyframes` (que no se pueden expresar inline) y la scrollbar.

**Excepción de la landing (2026-10-01)**: la landing se pre-renderiza en el
build. El HTML se genera sin conocer el ancho de pantalla ni si hay JS, y React
hidrata encima. Todo lo que dependa del viewport o de que el JS esté activo no se
puede decidir en el render: saldría un layout y saltaría a otro al hidratar. Se
resuelve con CSS, en un bloque comentado de su `index.css` con prefijo `om-`:
- `om-solo-desktop` / `om-solo-mobile`: visibilidad por viewport, con
  `display: contents` en el wrapper;
- `om-fila` / `om-fila-invertida`: columna en mobile, fila en desktop;
- `om-reveal` / `om-reveal-visible`: animación de entrada, solo bajo la clase
  `js` de `<html>`;
- `om-faq` / `om-faq-chevron`: el `<details>` de la FAQ.

El corte es 768 px. En la landing no se usa `useIsDesktop`: el layout responsive
va por CSS o por flex-wrap inline. El resto de los estilos sigue inline. Detalle
en [`decisiones_landing_ia.md`](./decisiones_landing_ia.md).

**Caveat conocido**: esta decisión escala bien para mobile/turnero, pero
no está validada para tablas densas del panel de gestión. Ver §9.8.

### 4.2 Hover con useState (no `:hover`)

Cada componente con feedback de hover lleva un `useState` local:

```jsx
const [hover, setHover] = useState(false);
// onMouseEnter / onMouseLeave + estilos condicionales
```

**Por qué**: consistencia con el resto del sistema, no requiere CSS.
**Cuidado**: en listas con 50+ items hover-able, el re-render por hover
puede notarse. Si pasa, refactorizar ese caso puntual a `:hover` via
`<style>` scoped. **Por ahora no es un problema medible**, pero ver §9.8.

### 4.3 Click handlers: `onClick`, NO `onPointerDown`

`onPointerDown` parece más rápido pero:
- Dispara al apretar (no al soltar) → no se puede cancelar deslizando afuera.
- Rompe accesibilidad por teclado (Enter/Space).
- No es el comportamiento esperado de un botón.

**Siempre `onClick`.**

### 4.4 Cards clickables → accesibles con teclado

Si una `<div>` o `<Card>` es clickable, debe ser navegable con `Enter` y
`Space`. El primitivo `Card` ya lo hace. Si construís otro contenedor
clickable, replicá el patrón:

```jsx
<div
  role="button"
  tabIndex={0}
  onClick={onClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
  }}
>
```

**Filas de tabla clickeables** (ej. abrir un detalle): el `<tr>` lleva el
`onClick` (mouse y toque, en cualquier parte de la fila) y `cursor: pointer`,
**sin** `role="button"`, que le rompe la semántica de tabla a los lectores de
pantalla. Para el teclado, la última celda lleva un `BotonIconoFila` con
`ChevronRight` y `ariaLabel` (Enter/Espacio y foco visible vienen con el
`<button>`), que además es la pista visual en el iPad, donde no hay hover. Su
`onClick` hace `e.stopPropagation()` para que el click no le llegue también al
`<tr>`. Ejemplos: `TablaHistorico` en `SeccionBalances` y `TablaResumen` en
`SeccionPlanillas`.

### 4.5 Errores y empty states

**Nunca** mostrar `<p>Cargando...</p>`, `<p>Error</p>`, ni `alert()`/`confirm()`
nativos del navegador. En su lugar:
- Loading → `Skeleton` con la silueta del contenido real (sin layout shift).
- Empty / error → `EmptyState` con icon + title + body.
- Confirmación destructiva → `ConfirmDialog`.

**Excepción por superficie — panel de gestión (admin)**: las secciones del
admin usan `LoadingState` (spinner Lucide `Loader2` centrado) en lugar de
`Skeleton`. Razón: los layouts son muy heterogéneos (KPIs, tablas densas,
formularios) y mantener un Skeleton fiel pantalla por pantalla agrega ruido
sin beneficio. El turnero y el barbero (vistas más uniformes mobile-first)
siguen usando `Skeleton` como regla. Decisión formalizada en el plan de
rediseño del front gestión (D6).

### 4.6 Layout responsive

**Mobile-first.** Todos los layouts arrancan asumiendo ~390 px de ancho.
Cuando el ancho permita, se centra en columna con `PageContainer`
(max-width 480 para el turnero; más para gestión/barbero — definir por front).

**No solo apilar elementos** al achicar: repensar layouts cuando haga
falta (ej. una `DataTable` ancha en desktop pasa a ser una lista de cards
en mobile).

### 4.7 Comentarios obligatorios

Cada función, componente y helper lleva JSDoc explicando **qué hace, qué
recibe, qué devuelve**. Está en `CLAUDE.md` global pero lo repito porque
es importante en UI también — un primitivo mal documentado se va a usar mal.

### 4.8 Toasts / feedback efímero

El primitivo `Toast` (`components/ui/Toast.jsx`) es hoy **inline y
render-state**: NO es flotante global. El caller mantiene un `useState` con el
mensaje (`{ tone, texto }` o un string), monta `<Toast>` donde su layout lo
necesita, y le pasa `onDismiss` para limpiarlo. Se usa en `BloqueImagenes`
(feedback de subida/borrado) y en los **6 handlers de "Exportar a Excel"**
(error de carga del chunk lazy de `xlsx`, vía el helper `utils/cargarChunk.js`
→ estado `errorExport` + `<Toast tone="danger">`).

**Consecuencia de diseño:** como el Toast lo renderiza cada componente desde su
estado, un helper **no puede mostrar un Toast por sí solo**. Por eso
`cargarChunk` centraliza el import + log + mensaje, pero el `<Toast>` se cablea
en cada call-site.

**Dirección futura (target):** unificar **todos** los toasts —confirmación y
error— a un patrón **flotante, centrado en pantalla y con auto-dismiss**, en
vez del inline actual. Esto convierte al Toast en un **servicio global**
(provider/portal + dispatcher imperativo `toast.show()`), y recién ahí se puede
centralizar el feedback de error en helpers como `cargarChunk`. Es un cambio de
arquitectura del primitivo + migración de todos los call-sites → **deuda #16 de
§9**.

---

## 5. Accesibilidad

El producto se vende como "profesional y premium". Eso obliga a un piso de
accesibilidad. **No es opcional ni se trata de "agregarlo después"**.

### 5.1 Focus visible

Todo elemento navegable por teclado (botón, input, card clickable, link)
debe mostrar un anillo de foco visible cuando recibe foco por teclado.

Patrón estándar (aplicar como `:focus-visible` via `index.css` o estilo
inline condicional con `useState` + `onFocus/onBlur`):

```css
outline: 2px solid var(--accent);  /* o theme.accent vía JS */
outline-offset: 2px;
```

**Nunca** `outline: none` sin un reemplazo equivalente. Si el componente
ya tiene un border que cambia de color en foco, eso cuenta como reemplazo.

### 5.2 Campos de formulario

El primitivo `Field` debe garantizar:
- `<label htmlFor={id}>` asociado al input.
- `aria-invalid="true"` cuando hay error.
- `aria-describedby={helperId}` apuntando al texto de helper / error.
- El mensaje de error debe ser **texto**, no solo cambio de color del border.

Si construís un input que no usa `Field`, replicá estas tres reglas.

### 5.3 Contraste

Objetivo mínimo: **WCAG AA** (4.5:1 para texto normal, 3:1 para texto ≥18 px
o ≥14 px bold).

Combinaciones a chequear con cuidado (deuda activa — ver §9):
- `mutedSoft` sobre `surfaceAlt`.
- `inkSoft` sobre `bg`.
- Texto blanco sobre `accent` (indigo-600).

Cuando agregues una combinación nueva de texto/fondo, verificá contraste
antes de mergear. Herramienta: WebAIM Contrast Checker.

### 5.4 Tamaño mínimo de touch target

**44×44 px** mínimo en cualquier elemento tocable en mobile (turnero
especialmente). Chips, botones, items de lista — todos deben cumplirlo.
Si el ícono es chico, el padding del contenedor compensa.

### 5.5 Atributos semánticos

- Botones que parecen botones → `<button>`, no `<div onClick>`.
- Links que navegan → `<a href>`, no `<button>` con `navigate()`.
- Listas → `<ul>` / `<ol>` con `<li>`.
- Headings con jerarquía (h1 > h2 > h3) sin saltarse niveles.

### 5.6 Idioma del documento

`<html lang="es">` en `index.html`. Lectores de pantalla lo necesitan para
elegir la voz correcta.

---

## 6. Inventario de primitivas

### 6.1 Universales (cualquier front del proyecto)

Estos primitivos son agnósticos del producto y van bien en cualquier
pantalla.

| Componente | Para qué |
|---|---|
| `Button` | 4 variantes: `primary`, `secondary`, `ghost`, `danger`. |
| `Card` | Contenedor con border, hover, selected, accesible con teclado. |
| `Field` | Input + label + helper + error invalid. |
| `TopBar` | Header con "← Volver" + slot derecho opcional. |
| `ScreenHeader` | Eyebrow + title + subtitle. |
| `StickyFooter` | Footer anclado abajo con border-top, safe-area iOS. |
| `EmptyState` | Glyph + title + body + acción opcional. |
| `Skeleton` | Bloque con shimmer. |
| `StatusPill` | Pill chiquito con dot + label de estado. |
| `PageContainer` | Wrapper raíz, max-width responsive, fondo lateral. |
| `ConfirmDialog` | Modal de confirmación (ESC + click fuera + loading state). |
| `AvatarIniciales` | Círculo con iniciales y tono determinístico por nombre. |
| `SummaryRow` | Fila label/value con border-bottom sutil. |

Propios del panel de gestión (`frontend/src/components/ui/`, no están en el
turnero): `LoadingState` (spinner Lucide `Loader2`, excepción de §4.5) y `Toast`
(§4.8), entre otros primitivos de tablas y formularios del admin.

**Gráficos, sin librería.** El proyecto no tiene librería de gráficos: las
barras se hacen con divs de ancho proporcional y los tokens del tema.
`BarraProporcional` es la barra (partible en tramos de color, decorativa:
el número va siempre como texto al lado) y `DesgloseMontos` la cuenta renglón
por renglón (`+`, `−`, `=`, con barra y monto) de los modales de detalle de
Balances y Planillas. Los colores de los montos y de sus barras siguen §3.1.1
(el tono `resultado` de `DesgloseMontos` elige verde, rojo o negro según el
signo). Si algún día hace falta un gráfico de verdad (ejes,
series temporales), se evalúa una librería cargada solo al usarla, como `xlsx`.

### 6.2 Específicas del wizard de reserva (NO usar en otros fronts)

| Componente | Por qué es exclusivo |
|---|---|
| `Progress` | Stepper "01/06" — hace sentido en wizards lineales, no en dashboards. |
| `MiniCalendario` | Calendario 7× para elegir UNA fecha de N próximos días. Para gestión/dashboard, hace falta otro picker (con navegación de mes, multi-selección, etc). |
| `SlotChip` | Chip de horario. Si el contexto cambia, repensar. |

### 6.3 Propias de `frontend-barbero` (todavía no compartidas)

Construidas en `frontend-barbero` durante su rediseño. Viven en su propio
`components/ui/` y **aún no se promovieron** a la fuente de verdad del turnero
(§7.5: un componente se comparte recién cuando un segundo front lo necesita).

| Componente | Para qué |
|---|---|
| `BottomNav` | Barra de navegación inferior fija, mobile. |
| `KPI` | Tarjeta de métrica (label + valor grande + tono semántico). |
| `TurnoListItem` | Card de turno: hora/cliente/servicio + acciones según estado. |
| `SearchInput` | Input de búsqueda con lupa + botón limpiar. |

---

## 7. Reglas para extender el sistema

### 7.1 Antes de crear un componente nuevo

**Preguntate**:
1. ¿Ya existe algo parecido en `/components/ui/`? → reusar.
2. ¿Lo voy a usar en una sola pantalla? → mantenerlo **local** a esa pantalla (no centralizar prematuramente).
3. ¿Aparece un segundo caso de uso? → **ahora sí**, mover a `/components/ui/`.

Tres líneas similares es mejor que una abstracción prematura. Pero al tercer
uso similar, abstraer es mandatorio.

### 7.2 Agregar un primitivo nuevo

1. Crearlo en `/components/ui/NombreComponente.jsx`.
2. JSDoc de la función y sus props.
3. Importar `theme` desde `'../../theme/tokens.js'`. Nunca hardcodear colores/sizes.
4. Estilos inline. Hover con `useState` si aplica.
5. Cumplir §5 (focus visible, aria, contraste, touch target).
6. Exportar en `/components/ui/index.js` (barrel).

### 7.3 Necesito cambiar un token (color, tamaño, etc.)

**Mover el cambio a `theme/tokens.js`.** Nunca hardcodear el valor nuevo en
un componente. Si lo necesitás solo para un caso, agregá un token nuevo
en lugar de "magic numbers".

### 7.4 Necesito una variante de un primitivo que ya existe

Ejemplo: ya hay `Button` con `variant: primary | secondary | ghost | danger`,
y querés "warning". **Agregá la variante al primitivo**, no crees `WarningButton`.

### 7.5 Necesito un componente que no existe en ningún front (ej. `DataTable`)

1. Lo construís en el front que lo necesita primero, en `/components/ui/` de
   ese front (no en turnero).
2. Si después otro front lo necesita, ver §8 (estrategia de duplicado).

---

## 8. ¿Qué se comparte entre fronts?

Hoy cada front tiene su propio `/src/components/ui/`. **Hasta nuevo aviso,
la estrategia es duplicar**:

**Lo que se copia de `frontend-turnero` a cualquier front nuevo**:
- `theme/tokens.js` *(idéntico)*.
- `utils/formato.js`, `utils/fecha.js` *(idénticos)*.
- `index.css` *(idéntico; la landing suma sus clases `om-`, ver §4.1)*.
- Los 13 primitivos universales (sección 6.1).

**Lo que NO se copia**:
- `Progress`, `MiniCalendario`, `SlotChip` (wizard-only).
- Cualquier componente específico de turnero (Landing, etc.).

Si en algún momento el dolor de mantener los duplicados es alto, evaluar
mover todo a un paquete compartido (`packages/ui/`) con npm/pnpm
workspaces. Hoy es **premature abstraction**.

### Política de divergencia entre fronts

Lo que se mantiene **consistente** entre fronts son los **estilos
estéticos** (tokens, look & feel, identidad visual del sistema). Las
**APIs** (props, contenido, estructura interna) de un primitivo **pueden
divergir** legítimamente cuando un front necesita capacidades que el
otro no — esto **no es deuda técnica**.

Ejemplos válidos de divergencia:
- `Field` del admin acepta props HTML adicionales (`disabled`,
  `autoComplete`, etc.) que el del turnero no necesita.
- `ConfirmDialog` del admin acepta `children` para mostrar detalle
  estructurado del recurso a eliminar; el del turnero no lo necesita
  (sus confirmaciones son más simples).
- Un `EmptyState` puede ganar una prop `tone` en un front sin que el
  otro la implemente.

Si más adelante el otro front necesita la misma capacidad, se readapta
el componente con la API que tenga sentido allá — sin obligación de
reflejar 1:1 lo del primer front. La consistencia que importa es
**visual**, no estructural.

**Cuándo sí es deuda real**: cuando los **estilos** divergen (un mismo
primitivo se ve distinto entre fronts sin razón). Eso sí hay que
reconciliarlo.

---

## 9. Deudas técnicas conocidas

Pendientes detectados durante el rediseño del turnero. **Si tomás alguno,
actualizá este doc.**

1. ~~`App.jsx` del turnero — loading/error states pelados (`<p>Cargando...</p>`).~~ — **Resuelto**: la carga usa `Skeleton` y el error `EmptyState`.
2. ~~`esDomingo` hardcodeado~~ — **Resuelto**: `MiniCalendario` grisa los días que el negocio no atiende y los feriados, leyendo `horario_atencion` + `feriados` de `GET /api/turnero/tenant`.
3. ~~**Falta endpoint de disponibilidad por día (precisión por barbero).**~~ — **Resuelto**: el endpoint `GET /api/turnero/dias-disponibles` (`calcularDiasConDisponibilidad` en `disponibilidadService.js`) calcula, dado `barbero_id` + `servicio_id` + un rango de fechas, qué días tienen ≥1 slot reservable, con un set fijo de queries independiente del tamaño del rango. `MiniCalendario` ahora recibe `diasDisponibles` y grisa cualquier día que no esté en esa lista; se eliminó la lógica client-side de días cerrados/feriados (el backend pasó a ser la fuente única de qué día es reservable). Lo consumen `SeleccionFecha` y la reprogramación de `GestionTurno`.
4. Cortes de turno (13:00 y 20:00) hardcodeados en `SeleccionHorario.jsx` — debería ser por tenant.
5. ~~Validación de teléfono solo AR (10 dígitos) hardcodeada en `DatosCliente.jsx`.~~ — **Resuelto**: reemplazada por `libphonenumber-js`. `DatosCliente` ahora tiene un selector de país (Argentina default + limítrofes + EE.UU.), formatea el número a medida que se escribe (`AsYouType`), valida por país (`isValidPhoneNumber`) y guarda el teléfono en formato E.164 (`parsePhoneNumber`). El backend no valida formato de teléfono, así que el cambio de formato guardado es seguro. El campo compuesto `[select país | input]` vive en el componente local `CampoTelefono` (no extiende el primitivo universal `Field`).
6. ~~Catálogos (`servicios`, `barberos`) sin `ORDER BY` explícito en backend.~~ — **Resuelto**: servicios ordenan por precio y barberos por nombre (`controllers/turnero.js`, `barberos.js`, `servicios.js`).
7. ~~`MiniCalendario` "2 semanas" hardcodeado~~ — **Resuelto**: el sublabel se deriva de `dias.length` como "N días".
8. **Inline styles + `useState` para hover** (§4.1, §4.2) — validado solo para mobile/turnero. **Antes de arrancar el front de gestión**, revisar: las tablas densas con muchas filas hover-ables pueden hacer ruidoso el re-render. Considerar híbrido: tokens en JS + `:hover` puntual via `<style>` scoped donde la performance importe.
9. **Contraste WCAG no verificado** — `mutedSoft` sobre `surfaceAlt`, `inkSoft` sobre `bg`, blanco sobre `accent`. Auditar con WebAIM antes de release público. Medido en la landing (2026-10-01):
   - `mutedSoft` sobre blanco da ≈2.6:1. Por eso las notas al pie (`NotaAlPie`) pasaron a `muted` a 14 px: 4.8:1 sobre blanco y 4.6:1 sobre `bg`.
   - `muted` sobre `surfaceAlt` queda en ≈4.4:1, apenas debajo de AA. Le pasa a la nota de "números de ejemplo", que está en una sección `tone="alt"`.
10. ~~**Iconografía sin librería elegida**~~ — **Resuelto**: se eligió Lucide (`lucide-react`). Ver §3.7.
11. ~~**`<html lang="es">`** — verificar que esté en `index.html` de cada front.~~ — **Resuelto**: presente en los cuatro fronts (verificado 2026-09-29).
12. **Focus visible global** — auditar que todos los primitivos tengan estilo de `:focus-visible`. Hoy `Card` y `Button` sí; el resto, sin verificar.
13. **Regla ESLint `react-hooks/set-state-in-effect` desactivada en `frontend-barbero/eslint.config.js`.** Llegó por el scaffolding de Vite (`eslint-plugin-react-hooks` v7); los otros fronts usan versiones más viejas sin ella. En este código son falsos positivos sobre el patrón de fetching del proyecto (`setCargando(true)` al montar, cuando `cargando` ya es `true`). Si se actualiza react-hooks en los demás fronts, tomar una **postura unificada**: desactivarla en todos, o refactorizar el patrón de fetch a "sin setState síncrono en el efecto". **Actualización 2026-09-29:** eso ya pasó — los cuatro fronts tienen `eslint-plugin-react-hooks` v7 y la regla está activa en todos salvo barbero. La postura unificada sigue pendiente; el estado actual de lint de cada front (qué errores y dónde) está en `estado_actual.md` → Deudas vivas del frontend del panel.
14. ~~**Rango horario del timeline hardcodeado**~~ — **Resuelto**: `Agenda.jsx` de `frontend-barbero` ya no usa `7:00`–`22:00` fijo. El rango se deriva por día con `calcularRangoHoras(horarioAtencion, fecha, turnos)`: trae `horario_atencion` del local (`getTenant()`, fetch best-effort una sola vez al montar) y muestra desde `apertura - 1h` hasta `cierre + 1h` del día visible (`floor`/`ceil` para líneas de hora prolijas con horarios no enteros como `10:30`). El rango se expande para que cualquier turno fuera de esa franja siga visible (clamp al min/max entre horario y turnos). Día cerrado: deriva de los turnos del día (±1h) o, sin turnos, cae al default `7`–`22` — mismo camino al que cae si `getTenant()` falla (red de seguridad). `HORA_INICIO`/`HORA_FIN`/`ALTO_TOTAL` pasaron de constantes de módulo a valores derivados por render que bajan por props a `Timeline`/`BloqueTurno`. (Emparenta con la deuda 4, aún abierta en el turnero.)
15. **`getMisClientes` sin paginación** — la pantalla Clientes de `frontend-barbero` trae todos los clientes históricos del barbero y filtra en cliente. Con 500+ clientes, el render de cards con hover-state (ver deuda 8) puede sentirse lento. Mitigación: paginar el endpoint o virtualizar la lista.
16. **Toast inline → flotante global.** El primitivo `Toast` es hoy inline / render-state (cada caller mantiene el estado y lo monta en su layout; ver §4.8). El **target** es un Toast **flotante, centrado y con auto-dismiss** servido por un provider global con API imperativa (`toast.show()`). Migrar implica: (1) crear el provider/portal + dispatcher; (2) migrar **todos** los call-sites inline actuales (`BloqueImagenes`, los 6 handlers de export de xlsx vía `errorExport`, y cualquier otro feedback efímero); (3) recién ahí poder centralizar el feedback de error de `cargarChunk`. Hasta entonces, el patrón vigente es el inline (§4.8).

---

*Última actualización: 2026-10-01 — §3.1.1 nueva (color en montos: verde solo en resultados, rojo en salidas, ningún monto en indigo); §2 suma la prohibición; §3.1 corrige `success` a green-700 (es #15803D); §6.1 remite a §3.1.1.*

*2026-09-30 — §4.4 suma el patrón de fila de tabla clickeable; §6.1 suma los gráficos sin librería (`BarraProporcional`, `DesgloseMontos`).*

*2026-09-29 — auditoría de la documentación: §1 sin `esDomingo`; §6.1 con los 13 universales (`LoadingState`/`Toast` como propios del panel); deudas #1, #6 y #11 de §9 resueltas; #13 remite a `estado_actual.md` para el estado de lint.*

*2026-09-29 — deuda #13 de §9: la regla `set-state-in-effect` ya está activa también en el front de gestión (lint falla en `main`); postura unificada pendiente.*

*2026-06-10 — §4.8 nueva (Toasts / feedback efímero): documenta el patrón inline render-state vigente y la dirección futura a Toast flotante global; deuda #16 de §9 abierta para la migración.*

*2026-06-05 — deuda #14 de §9 (rango horario del timeline hardcodeado) resuelta: `Agenda.jsx` de `frontend-barbero` deriva el rango por día del `horario_atencion` del local.*

*2026-06-04 — deuda #5 de §9 (teléfono AR hardcodeado) resuelta con `libphonenumber-js` en el turnero (`DatosCliente` / `CampoTelefono`).*

*2026-05-26 — §4.5 amplía con excepción para el panel de gestión (admin usa `LoadingState` en vez de `Skeleton`). Inventario §6.1 suma `LoadingState`. Decisión documentada en detalle en el plan de rediseño del front gestión (D6).*
