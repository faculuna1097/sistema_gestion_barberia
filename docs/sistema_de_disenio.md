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

La implementación de referencia vive en **`frontend/src/`** (el panel de
gestión) desde el 2026-10-08. Antes era el turnero, pero el turnero pasó a
tener identidad propia (§3.8) y ya no sirve de molde para los demás fronts.

| Carpeta | Contenido |
|---|---|
| `theme/tokens.js` | Tokens de "Luz" (colores, tipo, spacing, radii). Una sola fuente. |
| `utils/formato.js` | `fmtPesos` y otros formatos. |
| `utils/fecha.js` | Formatos y cálculos de fechas. |
| `components/ui/` | Primitivos React reutilizables (ver inventario abajo). |
| `index.css` | Reset + carga de Geist + `@keyframes`. |

**Cualquier chat que toque UI debería leer estos archivos antes de escribir
código nuevo.** No re-inventar. Para una tarea en el turnero, la referencia
son los mismos archivos de `frontend-turnero/src/` más §3.8.

---

## 2. Cosas que NO hacemos

Lista corta de prohibiciones explícitas. Alinea rápido a cualquier chat nuevo.

- ❌ `alert()`, `confirm()`, `prompt()` nativos. Usar `ConfirmDialog`.
- ❌ CSS classes globales. Excepción: `index.css` para reset / fonts / keyframes. La landing suma unas pocas clases `om-` porque se pre-renderiza, el turnero unas `tt-` de movimiento y el formulario de alta unas `al-` (ver §4.1).
- ❌ Múltiples colores de acento. Un solo `theme.accent` por front: indigo en el panel, el barbero y la landing; casi negro en el turnero (§3.8).
- ❌ Indigo en un monto. El color de la plata sigue §3.1.1.
- ❌ Sombras pesadas, glow, gradientes. Única excepción: el degradado del hero del turnero, que oscurece la foto para que se lea el texto (§3.8).
- ❌ Glassmorphism, blurs decorativos.
- ❌ Animaciones decorativas. Solo animaciones funcionales (cambio de pantalla, la tilde del éxito, el skeleton; en el turnero, las de §3.8). Todas respetan `prefers-reduced-motion`.
- ❌ `<p>Cargando...</p>` o `<p>Error</p>`. Usar `Skeleton` / `EmptyState`.
- ❌ `onPointerDown` en botones. Siempre `onClick`.
- ❌ Tamaños/colores hardcodeados. Todo desde `theme`.
- ❌ Centralizar primitivos prematuramente (ver §7.1).
- ❌ Crear un componente nuevo sin chequear primero si existe algo parecido.

---

## 3. Tema visual fijado: **Luz**

Inspirado en Stripe / Clerk. Neutral claro + acento indigo. Lo usan el panel
de gestión, la app del barbero y la landing. El turnero parte de Luz con
identidad propia en blanco y negro: ver §3.8.

### 3.1 Colores
- Neutros: `zinc` (`bg`, `surface`, `surfaceAlt`, `ink`, `inkSoft`, `muted`, `mutedSoft`, `hairline`, `hairlineSoft`).
- `muted` (`#6B6B74`, desde el 2026-11-03) es el texto secundario: es un poco más oscuro que zinc-500 para llegar a AA (§5.3). `mutedSoft` (`#A1A1AA`) no es para texto que se lee: queda para lo deshabilitado, los bordes en hover y lo decorativo.
- `neutralSoft` (zinc-200, en el panel desde el 2026-11-02): fondo de las pills y etiquetas neutras (ej. "Aporte" y "Retiro" en Caja, la categoría en Gastos), con texto `inkSoft`. No usan `surfaceAlt` porque ese es el hover de las filas de una tabla, y la etiqueta perdía el fondo al pasar el mouse.
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
- **Dónde está aplicada:** en el panel de gestión y en `frontend-barbero` (desde
  el 2026-10-19). El turnero ya cumple (sus precios van en `ink`).
  - **La app del barbero** mira la plata desde el barbero: en `MiPlanilla`, lo
    que cobra en la semana es su resultado (`colorResultado`, copia idéntica de
    `utils/colorMonto.js` del panel). La comisión de cada día es un subtotal y
    va en `ink`, igual que el generado y las propinas (la propina de cada corte,
    en `muted`, como texto secundario).
  - El contador "Pendientes" del Inicio es un contador de estado y queda fuera
    de la regla.

### 3.2 Tipografía
- **Geist** (body) + **Geist Mono** (eyebrows / micro labels en mayúsculas).
- 4 tamaños recurrentes capados:
  - `sizeTitle` (24) — h1 de pantalla.
  - `sizeHeading` (18) — h2/h3, títulos de card.
  - `sizeBody` (14) — texto base.
  - `sizeMicro` (11) — eyebrows, helper text en mono uppercase.
- `sizeInput` (16) es funcional, no de jerarquía: el texto de los inputs. Con menos de 16 px, Safari hace zoom al enfocar un campo en el iPad o el iPhone. Está en los cuatro fronts (en el panel, desde el 2026-11-02).
- 3 pesos: regular (400), medium (500), heading (600). Nada de 700+.

### 3.3 Spacing
Escala fija: **4, 8, 12, 16, 24, 32**. No usar paddings arbitrarios.

### 3.4 Radii
- `radiusSm` (6) — skeletons, pills.
- `radius` (10) — botones, inputs, cards normales.
- `radiusLg` (14) — cards "destacadas" (resumen, panel inline grande).

### 3.5 Sombras
Mínimas. `shadowSm` para botones primarios, `shadowMd` para cards flotantes
(ej. los toasts). **Sin glow, sin gradientes, sin glassmorphism.**

En el panel, `Modal` usa `shadowLg` (`0 20px 40px rgba(0,0,0,0.15)`): la card
flota sobre el `overlay` (`rgba(9, 9, 11, 0.5)`, ink al 50 %), y con
`shadowMd` no se despega del fondo oscuro. Los dos tokens son del panel
(2026-11-02): ningún otro front tiene modales. La landing tiene un `shadowLg`
propio con otro valor (§8).

`shadowScroll` (`0 -8px 8px -8px rgba(0,0,0,0.12)`, desde el 2026-10-29) es una
sombra hacia arriba que avisa "hay más contenido abajo" en una zona con scroll
interno. Es funcional, no decorativa: en el iPad la barra de scroll se esconde
sola, y un degradado de desvanecido iría contra §2. Va junto a una línea
`hairline` en el borde de lo que queda fijo debajo, y solo mientras queda algo
por ver (se apaga al llegar al final). Hoy la usa `TarjetaResumen` (§6.4). Está
en el panel, el barbero y la landing; el turnero no la tiene (§3.8).

### 3.6 Densidad por superficie

El producto tiene varias superficies con públicos y objetivos distintos.
La densidad visual debe acompañar.

| Superficie | Público | Densidad | Padding card | Spacing entre bloques |
|---|---|---|---|---|
| **Turnero** (cliente final) | Visitante esporádico, mobile-first | **Aireada** | 16–24 | 24–32 |
| **Alta** (formulario de alta, §3.9) | Dueño de una barbería nueva, una sola vez, desde el celular | **Aireada** (la del turnero) | 16–24 | 24–32 |
| **Panel barbero** (uso diario) | Empleado, mobile + desktop | **Intermedia** | 12–16 | 16–24 |
| **Panel gestión** (admin) | Dueño, desktop, sesiones largas | **Compacta** | 8–12 | 12–16 |
| **Kiosko** (modo operativo, iPad del mostrador) | Barbero o recepción, de pie y a distancia, al cobrar | **Grande** | 16–28 | 16–24 |

**Kiosko (escala propia, decidida el 2026-10-29).** Los flujos de Corte, Venta y
Gasto (`wizard.jsx`, §6.4) se leen de pie, a un brazo del iPad, y se tocan
rápido entre cliente y cliente. Por eso usan una escala más grande que la de
§3.2, que es una excepción escrita y no un descuido: 19 en las opciones y el
textarea, 18 en los valores del resumen y el botón grande, 13 en las etiquetas
mono del resumen, 15 en el subtítulo, 22 / 32 en la etiqueta y el monto del
total, 40 / 56 en el campo de monto y 48 en el monto del éxito. Desde el
2026-11-02 está escrita con nombre en `TAM_KIOSKO` (`screens/flows/wizardStyles.js`),
local a los flujos (§7.1): si otra superficie la necesita, se promueve a `tokens.js`.

Reglas que cambian según densidad:
- **Tipografía**: el turnero puede usar `sizeHeading` (18) generosamente; gestión prioriza `sizeBody` (14) incluso en títulos de card. **No bajar nunca de 14 en texto leíble**.
  - **Excepciones en `sizeMicro` (11), decididas el 2026-10-19:** los eyebrows y micro-labels en mono y mayúsculas (incluido `StatusPill` y, en el panel, `EstadoTurnoPill` y la hora de los bloques de la Agenda), las pills o chips de categoría (ej. forma de pago y "Sin turno" en `MiPlanilla`) y las etiquetas de la barra de navegación (`BottomNav`). Son rótulos de una o dos palabras que se reconocen de un vistazo, no texto que se lee, y las pestañas van con su ícono. A 14, las pills de cada corte pasarían a dos renglones más seguido.
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
- **Logos de marcas (excepción, desde el 2026-11-03):** Lucide no los trae. Van como SVG inline en el `components/ui/` del front, con el glifo oficial en monocromo (`currentColor`), nunca en el color de la marca: así no suman un segundo acento (§2). Hoy: `IconoWhatsApp` en la landing, en todo lo que abre un chat de WhatsApp (los CTA del hero, el nav, la barra fija del celular, Precio, el cierre y el footer).

### 3.8 Turnero: identidad propia

Decidido el 2026-10-05 en el rediseño del turnero (núcleo de decisiones en
[`decisiones_turnero_ux.md`](./decisiones_turnero_ux.md)). El turnero lo usa
el **cliente final** de la barbería, no la barbería: no tiene por qué verse como
el panel. Casi todos entran desde el link de Instagram, en iPhone.

**Qué cambia respecto de Luz** (`frontend-turnero/src/theme/tokens.js`):
- Fondo blanco (`bg: #FFFFFF`).
- Acento casi negro: `accent` zinc-900 (`#18181B`), `accentHover` zinc-800
  (`#27272A`; sobre negro, un filtro de brillo no se nota) y `accentSoft` neutro
  (`#F4F4F5`). El anillo de foco de `index.css` usa el mismo negro.
- Tokens del hero de la landing: `heroScrim` (el degradado), `heroInkSoft` y
  `heroSuccess` (el punto "abierto" sobre fondo oscuro).

**Qué se mantiene**: Geist, la escala de tamaños, pesos, spacing y radios, los
estados (`success`, `danger`, `warning`) y todas las reglas de §2, §4 y §5. Sin
tema por barbería: la identidad es del turnero, no de cada tenant.

**El degradado del hero** es la única excepción a "sin gradientes": oscurece
solo la franja del texto sobre la foto del local para que el texto pase AA
aunque la foto sea blanca (peor caso medido: título 7:1, estado 6,8:1).

**Movimiento** (clases `tt-` de `index.css`, documentadas ahí):
- `tt-pantalla`: entrada de cada pantalla, ~240 ms ease-out. La dirección sale
  de la navegación: adelante entra desde la derecha, atrás desde la izquierda.
- `tt-presionable`: se achica apenas al tocar (`:active`).
- `tt-aparecer`: fundido del contenido que reemplaza a un skeleton.
- `tt-escalonado`: listas que aparecen escalonadas (20 ms por ítem, tope 200 ms).
- La opción tocada queda marcada ~150 ms antes de avanzar
  (`useEleccionConPausa`, `utils/movimiento.js`).
- La tilde del éxito entra sin rebote (`om-pop`).
- Con `prefers-reduced-motion: reduce`, todo queda en un fundido corto o nada:
  sin pausa al elegir, la tilde ya dibujada y el skeleton quieto.
- Las entradas usan fill-mode `backwards`, no `both`: si retuvieran el
  `transform`, el contenedor pasaría a ser bloque contenedor de los
  `position: fixed` y el overlay de `ConfirmDialog` quedaría atado a la columna.

**Íconos**: el turnero no usa Lucide (§3.7). Sus pocos íconos son SVG inline
con el mismo trazo (1.5–1.75, `currentColor`); los que se repiten viven en
`components/ui/` (`IconoAlerta`, `IconoPin`).

**Lo que no se copia**: `tokens.js` e `index.css` del turnero divergen a
propósito del resto. Un front nuevo copia los del panel (§8), nunca los del
turnero, y un cambio en Luz no se replica en el turnero sin decidirlo.

### 3.9 Formulario de alta: Luz con el movimiento del turnero

Decidido el 2026-11-10 (núcleo de decisiones en
[`decisiones_alta_clientes.md`](./decisiones_alta_clientes.md)). `frontend-alta` lo
completa **una sola vez** el dueño de una barbería nueva, casi siempre desde el link de
WhatsApp en el celular. Viene de la landing y sigue en el panel: por eso es **Luz** (acento
indigo, tokens e `index.css` copiados del panel, §8), no el blanco y negro del turnero.

**Qué toma del turnero**: la densidad aireada y mobile-first (`PageContainer` de 480), una
pregunta por pantalla, el "atrás" del celular que vuelve un paso, y el mismo tipo de
movimiento, con su propio prefijo.

**Tono**: que completarlo no se sienta como trabajo, sin volverse infantil (§0). La respuesta
está en cada toque: botones grandes, avatares que aparecen, barras que cambian y una tarjeta
"Tu barbería" que crece. Sin confeti, ilustraciones ni rebotes.

**Movimiento** (clases `al-` de `index.css`, documentadas ahí):
- `al-pantalla`: entrada del contenido de cada pantalla, 240 ms. La dirección sale del
  atributo `data-al-direccion` ("adelante" desde la derecha, "atras" desde la izquierda; la
  primera carga, fundido). El encabezado, la tarjeta y el "Seguir" quedan quietos.
- `al-presionable`: se achica apenas al tocar (`:active`, no con `aria-disabled`).
- `al-aparecer`: fundido del contenido que reemplaza a un skeleton.
- `al-crecer`: un bloque que aparece y empuja lo de abajo de a poco (alto con
  `grid-template-rows` de 0fr a 1fr, más un fundido). Es la única animación de layout, porque
  lo que tiene que verse es que algo creció: renglones nuevos de la tarjeta, el link debajo del
  nombre, el detalle de un día.
- `al-rango`: el riel y la perilla del `<input type="range">` nativo (comisión y largo del
  turno), que no se pueden estilar inline.
- La opción tocada queda marcada ~150 ms antes de avanzar (`useEleccionConPausa`), y la
  tilde del "Listo" se dibuja con `om-stroke`.
- Con `prefers-reduced-motion: reduce`: ninguna animación de entrada (a diferencia del
  turnero, ni el fundido), el toque no achica, sin pausa al elegir y la tilde ya dibujada.
- Las entradas usan fill-mode `backwards` por la misma razón que en el turnero (§3.8).

**Lo que no se copia**: como el turnero, `frontend-alta` tiene sus propias copias de los
primitivos (§6.5). Un cambio en Luz no se replica acá sin decidirlo.

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

**Excepción del turnero (2026-10-08)**: los keyframes del movimiento y los
pseudo-estados (`:active`) no se pueden escribir inline. Van en un bloque
comentado de su `index.css` con prefijo `tt-` (`tt-pantalla`, `tt-presionable`,
`tt-aparecer`, `tt-escalonado`; ver §3.8). El formulario de alta hace lo mismo con el prefijo
`al-` (§3.9). Las animaciones que se aplican con
`animation` inline (`om-pop`, `om-stroke`, `om-shimmer`, `om-dialog-in`) no se
pueden pisar con una regla: para "reducir movimiento" se redefinen sus
keyframes dentro del `@media`.

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

**En `frontend-barbero` (desde el 2026-10-19), el hook `useHover`**
(`src/hooks/useHover.js`) reemplaza ese `useState`: en una pantalla táctil iOS
dispara `mouseenter` al tocar y el hover quedaba "pegado" (§9 #19).

```jsx
const [hover, eventosHover] = useHover();
<button {...eventosHover} style={{ background: hover ? theme.surfaceAlt : 'transparent' }}>
```

- Sin mouse (`(hover: hover)` da `false`, constante `PUEDE_HOVER` del mismo
  archivo), `eventosHover` viene vacío y el hover no se prende nunca.
- Si el elemento necesita su propio `onMouseLeave` (ej. `TeclaPin`, que
  también apaga el "apretado"), va después del spread y llama a
  `eventosHover.onMouseLeave?.()`.
- Un componente nuevo del barbero o del turnero con hover usa el hook. El
  panel sigue con el `useState` (es de escritorio).
- **En el turnero (desde el 2026-11-03)** está la misma copia
  (`frontend-turnero/src/hooks/useHover.js`), en `Card`, `SlotChip`, `Button` y
  las filas de servicio y de barbero de la landing. La fila del equipo de la
  landing usa `PUEDE_HOVER` para el layout: con mouse pasa a otro renglón, en
  táctil scrollea de costado.

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

**Panel de gestión: pantalla angosta (desde el 2026-11-03).** El panel se usa
en escritorio y en el iPad. Con el iPad en vertical (744 a 834 px) o en Split
View, el sidebar abierto (220 px) dejaba ~484 px para el contenido, y las tablas
dejaban Editar, Eliminar y Exportar fuera de la vista. El corte es la ventana de
**menos de 1024 px** (`usePantallaAngosta`, en `frontend/src/hooks/`), que mira
el ancho y no la orientación: un iPad horizontal con Split View también es
angosto. En web no se puede obligar la orientación (Safari en iOS no deja
bloquearla).
- **Sidebar:** en lo angosto queda cerrado en un riel de íconos de 64 px. Al
  abrirlo va **encima** del contenido (no lo empuja), con el fondo `overlay` y
  `shadowLg`, y se cierra al elegir una sección, al tocar el fondo o con Escape.
  En pantalla ancha, colapsar y expandir siguen como siempre.
- **Tablas:** con el riel, el contenido tiene 616–706 px. Si una tabla igual no
  entra, sus datos secundarios pasan a un segundo renglón dentro de la celda, en
  `muted`, en vez de esconder columnas. Ej.: Ventas pone "2 × $ 500" bajo el
  producto. Las acciones de una fila quedan siempre a la vista.
- **Pestañas:** `Tabs` acepta `mostrarIconos={false}`; Gestión lo usa en lo
  angosto (sus 6 pestañas con ícono miden 650 px).
- Desde 1024 px (el iPad horizontal) el panel se ve como en escritorio.

### 4.7 Comentarios obligatorios

Cada función, componente y helper lleva JSDoc explicando **qué hace, qué
recibe, qué devuelve**. Está en `CLAUDE.md` global pero lo repito porque
es importante en UI también — un primitivo mal documentado se va a usar mal.

### 4.8 Toasts / feedback efímero

Desde el 2026-11-02 (deuda #16), el feedback efímero del panel es un **toast
flotante**: centrado arriba (a 16 px del borde), por encima de los modales y
con auto-dismiss. Se muestra con la API imperativa de `utils/toast.js`, sin
estado propio ni nada que montar:

```js
import { toast } from '../../../utils/toast';

toast.exito('Horario actualizado correctamente.');
toast.error('No se pudo eliminar el gasto. Intentá de nuevo.');
toast.show({ tone: 'warning', texto: '…' });
```

- **`ToastProvider`** (`components/ui/`) dibuja los avisos. Se monta una sola
  vez, en `main.jsx`, y se registra como despachador de `toast.show()`.
- **Duración:** 4 s el éxito y la info, 6 s el error y el aviso, que además
  llevan una X para cerrarlos antes.
- **Pila:** tres a la vista como máximo (si llega un cuarto, se va el más
  viejo). Un aviso igual a uno que ya se ve no se duplica: reinicia su tiempo.
- **Accesibilidad:** el contenedor es una región `aria-live="polite"` que
  existe siempre, y el toast no toma el foco (no saca al usuario de un modal).
- Como es un servicio, un helper puede avisar solo: `cargarChunk` muestra el
  error del exportador y devuelve `null`, y el caller solo hace
  `if (!XLSX) return;`.

**`Toast` sigue siendo la card visual** (ícono, texto, X opcional). Se monta
inline solo para un mensaje que tiene que quedarse junto a lo que lo causó:
- un error de carga con "Reintentar" (Feriados, Horario, Imágenes, y los de
  horarios y ausencias en Barberos);
- un error dentro de un modal que sigue abierto (el alta de feriados y los
  modales de Seguridad), pegado al campo que hay que corregir;
- una nota fija de la pantalla (el día cerrado con turnos del Turnero).

El texto de un error que viene de la API se elige con `mensajeDeError`
(`utils/errores.js`): el `error` del servidor si vino; si no (sin red, una
respuesta que no es JSON), un mensaje genérico en español. Nunca se muestra
`err.message` crudo ("Failed to fetch").

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

El `Field` del turnero las cumple desde el 2026-10-08 (con `useId`), y
`CampoTelefono` (local de `ConfirmarTurno`) también. En el panel y el barbero,
sin verificar.

### 5.3 Contraste

Objetivo mínimo: **WCAG AA** (4.5:1 para texto normal, 3:1 para texto ≥18 px
o ≥14 px bold).

**Grises de texto (medido el 2026-11-03, en pantalla, en los cuatro fronts):**

| Texto | `surface` (#FFF) | `bg` (#FAFAFA) | `surfaceAlt` (#F4F4F5) |
|---|---|---|---|
| `muted` (`#6B6B74`) | 5,28:1 | 5,05:1 | 4,80:1 |
| `mutedSoft` (`#A1A1AA`) | 2,56:1 | 2,46:1 | 2,33:1 |

- **El texto que se lee va en `muted` o más oscuro.** Incluye el "—" de una
  celda vacía o en cero (es el valor de la celda), los eyebrows y las notas.
  Sobre `hairline` / `neutralSoft` (zinc-200) `muted` da 4,16:1: ahí las pills
  usan `inkSoft`.
- **`mutedSoft` queda solo para lo que no hace falta leer:** controles
  deshabilitados (flechas de paginación y de período, el "Hoy" del navegador de
  días de la Agenda, los días sin lugar del turnero), bordes en hover, barras
  neutras con el número al lado, chevrons y flechas decorativas (`aria-hidden`),
  el borde de la `MarcaEleccion` del turnero y el punto de "cerrado" del hero,
  que acompaña al texto.
- **Un ícono necesario sin texto al lado** (WCAG pide 3:1) va en `muted`: el
  "+" de subir imagen de Gestión → Negocio da 4,80:1 sobre `surfaceAlt`
  (con `mutedSoft` daba 2,33:1; cambiado el 2026-11-03).
- Pendiente de medir: `inkSoft` sobre `bg` y el texto blanco sobre `accent`.

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

### 5.6 Foco en los modales

`Modal` del panel (y `ConfirmDialog`, que lo usa) maneja el foco desde el
2026-11-02: al abrirse lo lleva a la card, Tab y Shift+Tab giran adentro
mientras está abierto, y al cerrarse vuelve al elemento que lo abrió. Escape lo
cierra salvo en `loading`. Con un modal sobre otro, solo el de arriba encierra
el foco. Un modal nuevo usa `Modal` y no reimplementa nada de esto.

### 5.7 Idioma del documento

`<html lang="es">` en `index.html`. Lectores de pantalla lo necesitan para
elegir la voz correcta.

---

## 6. Inventario de primitivas

### 6.1 Universales (cualquier front del proyecto)

Estos primitivos son agnósticos del producto y van bien en cualquier
pantalla.

| Componente | Para qué |
|---|---|
| `Button` | 4 variantes: `primary`, `secondary`, `ghost`, `danger`. En el turnero acepta `href` (+ `externo`) y se dibuja como `<a>`, y `form` para un submit fuera del `<form>`. |
| `Card` | Contenedor con border, hover, selected, accesible con teclado. En el turnero, padding por defecto de 16 (desde el 2026-11-03; antes 14, fuera de la escala de §3.3). |
| `Field` | Input + label + helper + error invalid. En el turnero acepta `name`, `autoComplete`, `inputMode` y `ref`. |
| `TopBar` | Header con "← Volver" + slot derecho opcional. |
| `ScreenHeader` | Eyebrow + title + subtitle. El panel ya no lo usa (D15, desde 2026-11-02 en ninguna sección): queda en su `components/ui/` para copiarlo a un front nuevo. |
| `StickyFooter` | Footer anclado abajo con border-top, safe-area iOS. No está en el panel: si un front nuevo lo necesita, se copia del barbero. En el turnero (desde el 2026-11-03), mientras está montado su alto es el `scroll-padding-bottom` del documento: lo que se enfoca con Tab o el "siguiente" del teclado queda por encima del footer. `Field` y `CampoTelefono` suman `MARGEN_SCROLL_CAMPO` al input para que también se vea la ayuda o el error. |
| `EmptyState` | Glyph + title + body + acción opcional. |
| `Skeleton` | Bloque con shimmer. |
| `StatusPill` | Pill chiquito con dot + label de estado. |
| `PageContainer` | Wrapper raíz, max-width responsive, fondo lateral. |
| `ConfirmDialog` | Modal de confirmación (ESC + click fuera + loading state). |
| `AvatarIniciales` | Círculo con iniciales y tono determinístico por nombre (en el turnero, un tono neutro único). |
| `SummaryRow` | Fila label/value con border-bottom sutil. |

Propios del panel de gestión (`frontend/src/components/ui/`, no están en el
turnero): `LoadingState` (spinner Lucide `Loader2`, excepción de §4.5), `Toast`
y `ToastProvider` (§4.8), entre otros primitivos de tablas y formularios del
admin. Entre ellos:
- `GrupoOpciones`: campo de opción única con un botón por opción (Caja y el
  modal de completar turno). Para las formas de pago recibe
  `OPCIONES_FORMA_PAGO_TONO` (`tonosFormaPago.js`).
- `estilos.js` → `estiloEtiquetaCampo`: el rótulo mono de `Field` y
  `GrupoOpciones` (y de cualquier rótulo suelto de un formulario).
- Las formas de pago tienen una sola fuente: los nombres en `utils/formato.js`
  (`OPCIONES_FORMA_PAGO`, `formatPago`) y los colores en `tonosFormaPago.js`.
- `Field` acepta `maxLength`; su input va en `sizeInput` y la ayuda y el error
  en `sizeBody`.

**Gráficos, sin librería.** El proyecto no tiene librería de gráficos: las
barras se hacen con divs de ancho proporcional y los tokens del tema.
`BarraProporcional` es la barra (partible en tramos de color, decorativa:
el número va siempre como texto al lado) y `DesgloseMontos` la cuenta renglón
por renglón (`+`, `−`, `=`, con barra y monto) de los modales de detalle de
Balances y Planillas. Los colores de los montos y de sus barras siguen §3.1.1
(el tono `resultado` de `DesgloseMontos` elige verde, rojo o negro según el
signo). Si algún día hace falta un gráfico de verdad (ejes,
series temporales), se evalúa una librería cargada solo al usarla, como `xlsx`.

### 6.2 Específicas del flujo de reserva (NO usar en otros fronts)

| Componente | Por qué es exclusivo |
|---|---|
| `Progress` | Barra fina de 3 tramos (`role="progressbar"`, "Paso N de 3: X"). Tiene sentido en un flujo lineal corto, no en dashboards. |
| `SelectorDiaHorario` | Grilla semanal de los próximos días (lunes a domingo, sin scroll) + los horarios del día elegido en una sola grilla. Solo dibuja: los datos los trae el hook `useDisponibilidad`. Lo usan "¿Cuándo?" y la reprogramación. Para gestión hace falta otro picker (navegación de mes, multi-selección). Reemplazó a `MiniCalendario` el 2026-10-08. |
| `SlotChip` | Chip de horario, de alto fijo (`ALTO_SLOT`, 48) para que el skeleton no salte. |
| `ResumenTurno` | Tarjeta del turno (día y hora, servicio, quién atiende, dirección). La comparten la confirmación y el éxito. |
| `AgregarAlCalendario` | Botón "Agregar al calendario": `.ics` en iPhone/iPad/Mac y Google Calendar en el resto, con la otra opción como link. Lo usan el éxito y la gestión del turno. |

Hooks del flujo (`frontend-turnero/src/hooks/`): `useNavegacion` (pila de
pantallas integrada al historial, así el "atrás" del celular vuelve un paso),
`useListaRemota` (servicios y barberos, cargados una vez en `App`),
`useDisponibilidad` (días y horarios, descarta respuestas viejas) y
`useEleccionConPausa` (la pausa de ~150 ms al elegir).

### 6.3 Propias de `frontend-barbero` (todavía no compartidas)

Construidas en `frontend-barbero` durante su rediseño. Viven en su propio
`components/ui/` y **aún no se promovieron** a la fuente de verdad (§7.5: un
componente se comparte recién cuando un segundo front lo necesita).

| Componente | Para qué |
|---|---|
| `BottomNav` | Barra de navegación inferior fija, mobile. |
| `KPI` | Tarjeta de métrica (label + valor grande + tono semántico). |
| `TurnoListItem` | Card de turno: hora/cliente/servicio + acciones según estado. |
| `SearchInput` | Input de búsqueda con lupa + botón limpiar. |

### 6.5 Propias de `frontend-alta`

Copias de los primitivos del panel (§6.1) más estas piezas propias. Viven en
`frontend-alta/src/components/` y **no se promovieron** (§7.5).

| Componente | Para qué |
|---|---|
| `ui/BotonOpcion` | Opción única grande (radio que pasa a tilde). Preguntas de sí/no y elecciones de una pantalla. |
| `ui/Casilla` | Sí/no con forma de botón: un checkbox nativo invisible con la caja dibujada, toque de 44 px. |
| `ui/Select` | Copia del `Select` del panel con label asociada, error accesible y opción vacía "sin elegir". |
| `ui/TextoError` | El texto de error de un control que no es `Field` (`aria-describedby`). |
| `SelectorDias` | Los 7 días que se prenden y apagan. Local y horario de cada barbero. |
| `SelectorHora` / `BotonPaso` / `ParDeHoras` | Horas con [−] y [+] de a 30 min, sin teclado. |
| `SelectorConBarra` | Barra de a pasos con [−] y [+] (comisión, largo del turno). Usa `al-rango`. |
| `SemanaEnBarras` | La semana dibujada en vivo, con la pausa como corte y varios bloques por día. |
| `CampoPrecio` | Precio entero con separador de miles mientras se escribe. |
| `CampoTelefono` | País más número con `libphonenumber-js` (carga diferida), guarda E.164. |
| `TarjetaBarberia` | La tarjeta "Tu barbería": crece en el formulario y se ve completa en la Revisión y en "Ya enviada". |

### 6.4 Wizard del modo operativo (iPad del local)

Piezas de la superficie kiosko (los flujos de Corte, Venta y Gasto del iPad del
mostrador). Viven en `frontend/src/screens/flows/wizard.jsx`, no en
`components/ui/`: son del flujo, con el mismo criterio que §6.2. Los estilos de
layout que componen los flujos (`wizardStyles`) están al lado, en `wizardStyles.js`.

| Componente | Para qué |
|---|---|
| `PanelWizard` | Marco de un paso: `FondoLocal` + panel claro casi a pantalla completa, barra de progreso y header (volver · título · "Paso X de Y"). Con `pie`, el modo de los pasos de confirmación (abajo). |
| `BotonOpcion` | Card táctil de selección (barbero, turno, servicio, forma de pago). |
| `CampoTexto` / `CampoMonto` | Textarea e input de monto grande, con el lenguaje visual de `Field`. |
| `TarjetaResumen` | Card gris del resumen: filas con scroll interno y total fijo abajo. |
| `FilaResumen` / `FilaTotal` | Fila label/valor del resumen y fila de total (monto en el color de §3.1.1). |
| `PantallaExito` / `AvisoExito` | Confirmación con la tilde y el monto, y un aviso en tono warning debajo. |

**Paso de confirmación (desde el 2026-10-29).** El botón de confirmar tiene que
verse siempre, sin scrollear, aunque el resumen sea largo (una venta con muchos
productos) y aunque la barra de Safari le quite alto a la pantalla:

```jsx
<PanelWizard paso={4} total={4} titulo="Confirmá el gasto" maxAncho={560}
  pie={
    <>
      {error && <p style={wizardStyles.errorTexto}>{error}</p>}
      <Button variant="primary" onClick={confirmar} style={wizardStyles.btnGrande}>Confirmar gasto</Button>
    </>
  }
>
  <TarjetaResumen total={<FilaTotal label="Monto" value={fmtPesos(monto)} color={theme.danger} />}>
    <FilaResumen label="Categoría" value={categoria} />
    <FilaResumen label="Pago" value={<BadgeFormaPago forma={formaPago} />} ultima />
  </TarjetaResumen>
</PanelWizard>
```

- **Con `pie`, el panel no scrollea.** El contenido se achica al espacio libre
  (`minHeight: 0` en cada nivel) y el pie, con el error y el botón, queda fijo
  debajo. Sin `pie` (pasos con grillas o campos), el cuerpo scrollea entero.
- **El resumen scrollea adentro de su tarjeta.** Las filas tienen scroll propio;
  el total queda fijo al pie de la tarjeta, a la vista junto al botón.
- **Indicador de "hay más abajo":** mientras quedan filas por ver, el borde de
  arriba del total muestra una línea `hairline` y `theme.shadowScroll` (§3.5).
  Se re-mide al scrollear y con un `ResizeObserver` (rotación del iPad, el error
  que aparece en el pie).
- **Alto de la pantalla:** el panel y `FondoLocal` miden `ALTO_VISIBLE`
  (`utils/pantalla.js`): `100dvh` si el navegador lo soporta, si no `100vh`. En
  Safari, `100vh` incluye el alto de la barra y el borde de abajo quedaba tapado.
- Un paso de confirmación nuevo usa este patrón. No se arma un resumen a mano
  con su propio scroll.

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
   ese front.
2. Si después otro front lo necesita, ver §8 (estrategia de duplicado).

---

## 8. ¿Qué se comparte entre fronts?

Hoy cada front tiene su propio `/src/components/ui/`. **Hasta nuevo aviso,
la estrategia es duplicar**:

**Lo que se copia de `frontend/` (el panel) a cualquier front nuevo**:
- `theme/tokens.js`, sin los tokens propios del panel (abajo).
- `index.css`: el reset, el foco, la scrollbar y los `@keyframes` base. Las fuentes
  salen de Google Fonts o de `public/fonts`, según el front (abajo).
- Los primitivos universales (sección 6.1). `StickyFooter`, del barbero.

**Qué hay en cada front** (comparado archivo por archivo el 2026-11-02). Ni
`tokens.js` ni `index.css` son idénticos entre fronts:

| | `tokens.js` | `index.css` |
|---|---|---|
| **Panel** | La base de Luz más `neutralSoft`, `overlay` y `shadowLg` (`0 20px 40px rgba(0,0,0,0.15)`), solo de este front. | Geist y Geist Mono desde `public/fonts` (desde 2026-11-02). `om-fade` sube 4 px. Suma `om-shake` y `.om-fila-hover` (el hover de las tablas de reporte) y `spin`. |
| **Barbero** | La base de Luz: lo mismo que el panel, sin `neutralSoft`, `overlay` ni `shadowLg`. | Google Fonts. `om-fade` es solo opacidad (con `transform`, los modales se descentraban dentro de `PageContainer`). Su giro se llama `om-spin`. Sin `om-shake` ni `.om-fila-hover`. |
| **Landing** | La base sin `neutralSoft`, `overlay` ni `maxWidth`. Suma `sizeDisplay`, `sizeSection`, `sizeSubheading`, `maxWidthWide`, `maxWidthText`, `sectionGapMin` y `sectionGapMax`. Tiene su propio `shadowLg` (`0 12px 32px rgba(0,0,0,0.10)`, para las capturas que flotan): mismo nombre que el del panel, otro valor. | Google Fonts, `scroll-behavior: smooth`, `om-reveal` y las clases `om-` de §4.1. Sin `om-stroke`, `om-overlay-in` ni `om-dialog-in`. |
| **Turnero** | Diverge a propósito (§3.8): `bg`, `accent`, `accentHover`, `accentSoft` y los del hero. No tiene `shadowScroll`. | Diverge a propósito (§3.8): `overscroll-behavior`, los colores de su tema y el movimiento `tt-`. |
| **Alta** | La base de Luz, sin `neutralSoft`, `overlay` ni `shadowLg` (copia del panel, 2026-11-10). | Geist desde `public/fonts`. `om-shimmer`, `om-pop` y `om-stroke`, con su versión para "reducir movimiento", y el movimiento `al-` (§3.9). |

Todos comparten la escala de tamaños, pesos, spacing (`spacing`), radios,
los estados y los neutros de texto (`muted` `#6B6B74` desde el 2026-11-03, §5.3).

**Lo que NO se copia**:
- Nada del turnero: sus tokens e `index.css` divergen a propósito (§3.8).
- `Progress`, `SelectorDiaHorario`, `SlotChip`, `ResumenTurno`,
  `AgregarAlCalendario` (solo del flujo de reserva).
- Cualquier componente específico de una pantalla (Landing, etc.).

**`utils/fecha.js` y `utils/formato.js` no son copias**, aunque se llamen igual
en varios fronts:
- `fecha.js`: el panel tiene su propio juego de funciones, con la zona fija en
  `TZ`, y no comparte ninguna con el turnero ni con el barbero. Esos dos trabajan
  en la zona del navegador y comparten cinco funciones: `fechaLocalISO`,
  `fechaDeISO`, `fmtHora` y `fmtFechaHora` son iguales, y `fmtFechaLarga` difiere
  (`day: '2-digit'` en el barbero, `'numeric'` en el turnero). La landing no
  tiene `fecha.js`.
- `formato.js`: `fmtPesos` está en los cuatro y es la misma (desde el
  2026-11-03): redondea a pesos y pone el signo y un espacio (`$ 8.000`,
  `-$ 130.000`). La fuente es la del panel. `capitalizar` está en el barbero y el
  turnero. El resto de las funciones es propio del panel.

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
- `Field` del admin acepta props HTML adicionales (`disabled`, etc.) que
  el del turnero no necesita, y el del turnero acepta `ref` e `inputMode`.
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
reconciliarlo. El turnero es la excepción decidida: su acento y su fondo
difieren a propósito (§3.8).

---

## 9. Deudas técnicas conocidas

Pendientes detectados durante el rediseño del turnero. **Si tomás alguno,
actualizá este doc.**

1. ~~`App.jsx` del turnero — loading/error states pelados (`<p>Cargando...</p>`).~~ — **Resuelto**: la carga usa `Skeleton` y el error `EmptyState`.
2. ~~`esDomingo` hardcodeado~~ — **Resuelto**: `MiniCalendario` grisa los días que el negocio no atiende y los feriados, leyendo `horario_atencion` + `feriados` de `GET /api/turnero/tenant`.
3. ~~**Falta endpoint de disponibilidad por día (precisión por barbero).**~~ — **Resuelto**: el endpoint `GET /api/turnero/dias-disponibles` (`calcularDiasConDisponibilidad` en `disponibilidadService.js`) calcula, dado `barbero_id` + `servicio_id` + un rango de fechas, qué días tienen ≥1 slot reservable, con un set fijo de queries independiente del tamaño del rango. `MiniCalendario` ahora recibe `diasDisponibles` y grisa cualquier día que no esté en esa lista; se eliminó la lógica client-side de días cerrados/feriados (el backend pasó a ser la fuente única de qué día es reservable). Lo consumen `SeleccionFecha` y la reprogramación de `GestionTurno`.
4. ~~Cortes de turno (13:00 y 20:00) hardcodeados en `SeleccionHorario.jsx` — debería ser por tenant.~~ — **Sin objeto** (2026-10-08): "¿Cuándo?" muestra los horarios en una sola grilla, sin agrupar por mañana, tarde y noche.
5. ~~Validación de teléfono solo AR (10 dígitos) hardcodeada en `DatosCliente.jsx`.~~ — **Resuelto**: reemplazada por `libphonenumber-js`. `DatosCliente` ahora tiene un selector de país (Argentina default + limítrofes + EE.UU.), formatea el número a medida que se escribe (`AsYouType`), valida por país (`isValidPhoneNumber`) y guarda el teléfono en formato E.164 (`parsePhoneNumber`). El backend no valida formato de teléfono, así que el cambio de formato guardado es seguro. El campo compuesto `[select país | input]` vive en el componente local `CampoTelefono` (no extiende el primitivo universal `Field`).
6. ~~Catálogos (`servicios`, `barberos`) sin `ORDER BY` explícito en backend.~~ — **Resuelto**: servicios ordenan por precio y barberos por nombre (`controllers/turnero.js`, `barberos.js`, `servicios.js`).
7. ~~`MiniCalendario` "2 semanas" hardcodeado~~ — **Resuelto**: el sublabel se deriva de `dias.length` como "N días".
8. ~~**Inline styles + `useState` para hover** (§4.1, §4.2) — validado solo para mobile/turnero. **Antes de arrancar el front de gestión**, revisar: las tablas densas con muchas filas hover-ables pueden hacer ruidoso el re-render. Considerar híbrido: tokens en JS + `:hover` puntual via `<style>` scoped donde la performance importe.~~ — **Resuelto**: `DataTable` (panel) hace el hover de las filas con `<style>` local, con una clase única por instancia.
9. **Contraste WCAG: falta medir `inkSoft` sobre `bg` y el texto blanco sobre `accent`.** Auditar con WebAIM antes de release público. Los grises se resolvieron el 2026-11-03: `muted` pasó a `#6B6B74` en los cuatro fronts (4,80:1 sobre `surfaceAlt`, medido en pantalla), y el `mutedSoft` que era texto para leer pasó a `muted` (15 usos en el panel y 7 en la landing; ninguno en el barbero ni el turnero). Qué quedó en `mutedSoft` y por qué, en §5.3.
10. ~~**Iconografía sin librería elegida**~~ — **Resuelto**: se eligió Lucide (`lucide-react`). Ver §3.7.
11. ~~**`<html lang="es">`** — verificar que esté en `index.html` de cada front.~~ — **Resuelto**: presente en los cuatro fronts (verificado 2026-09-29).
12. ~~**Focus visible global** — auditar que todos los primitivos tengan estilo de `:focus-visible`. Hoy `Card` y `Button` sí; el resto, sin verificar.~~ — **Resuelto**: hay una regla `*:focus-visible` global en los cuatro fronts, y los campos que anulan el `outline` tienen anillo propio (`InputTiempo`, `Select`, `SearchInput`, `CampoTexto`, `CampoMonto`). `CampoTelefono` lleva además el `outline` en su contenedor, porque con error el borde no cambia.
13. ~~**Regla ESLint `react-hooks/set-state-in-effect` desactivada solo en `frontend-barbero/eslint.config.js`.** Faltaba una postura unificada: desactivarla en todos, o refactorizar el patrón de fetch a "sin setState síncrono en el efecto".~~ — **Resuelto**: está apagada en los cuatro fronts, con el motivo en `convenciones_tecnicas.md` §8.
14. ~~**Rango horario del timeline hardcodeado**~~ — **Resuelto**: `Agenda.jsx` de `frontend-barbero` ya no usa `7:00`–`22:00` fijo. El rango se deriva por día con `calcularRangoHoras(horarioAtencion, fecha, turnos)`: trae `horario_atencion` del local (`getTenant()`, fetch best-effort una sola vez al montar) y muestra desde `apertura - 1h` hasta `cierre + 1h` del día visible (`floor`/`ceil` para líneas de hora prolijas con horarios no enteros como `10:30`). El rango se expande para que cualquier turno fuera de esa franja siga visible (clamp al min/max entre horario y turnos). Día cerrado: deriva de los turnos del día (±1h) o, sin turnos, cae al default `7`–`22` — mismo camino al que cae si `getTenant()` falla (red de seguridad). `HORA_INICIO`/`HORA_FIN`/`ALTO_TOTAL` pasaron de constantes de módulo a valores derivados por render que bajan por props a `Timeline`/`BloqueTurno`. (Emparenta con la deuda 4, aún abierta en el turnero.)
15. **`getMisClientes` sin paginación** — la pantalla Clientes de `frontend-barbero` trae todos los clientes históricos del barbero y filtra en cliente. Con 500+ clientes, el render de cards con hover-state (ver deuda 8) puede sentirse lento. Mitigación: paginar el endpoint o virtualizar la lista.
16. ~~**Toast inline → flotante global.**~~ — **Resuelto (2026-11-02)**: toast flotante servido por `ToastProvider` con `toast.show()` (§4.8); `cargarChunk` avisa solo. Texto original: El primitivo `Toast` es hoy inline / render-state (cada caller mantiene el estado y lo monta en su layout; ver §4.8). El **target** es un Toast **flotante, centrado y con auto-dismiss** servido por un provider global con API imperativa (`toast.show()`). Migrar implica: (1) crear el provider/portal + dispatcher; (2) migrar **todos** los call-sites inline actuales (`BloqueImagenes`, los 6 handlers de export de xlsx vía `errorExport`, y cualquier otro feedback efímero); (3) recién ahí poder centralizar el feedback de error de `cargarChunk`. Hasta entonces, el patrón vigente es el inline (§4.8).
17. ~~**Estilo de etiqueta "eyebrow" copiado a mano** (mono, 11 px, mayúsculas, `muted`) en unos diez lugares del turnero (`ScreenHeader`, `Field`, `CampoTelefono`, `SelectorDiaHorario`, `SeleccionCuando`, `GestionTurno`…). Candidato a un estilo compartido (ej. un primitivo `Eyebrow`). Visto en el rediseño del turnero (2026-10-08).~~ — **Resuelto (2026-11-03)**: `estiloEyebrow` en `frontend-turnero/src/components/ui/estilos.js` (mismo criterio que el `estiloEtiquetaCampo` del panel), en los diez lugares. `StatusPill` queda aparte: es una pill, con sus colores.
18. **`index.css` repite a mano colores de `tokens.js`** (fondo, anillo de foco, scrollbar) porque el CSS no puede importar el JS; está comentado en cada lugar. Para una sola fuente: exponer los tokens como variables CSS. Visto en el turnero; como `index.css` se copia entre fronts (§8), seguramente pasa en todos.
19. ~~**Hover con `useState` en pantallas táctiles** (§4.2): iOS dispara `mouseenter` al tocar y el estado queda "pegado" hasta tocar otra cosa (borde gris en `Card`/`SlotChip`, `accentHover` en el primario). Casi no se nota porque la pantalla cambia, pero sí donde no se navega (chips de la reprogramación del turnero). Emparenta con #8: un `:hover` real dentro de `@media (hover: hover)` lo resolvería. **(2026-10-19) Resuelto en `frontend-barbero`** con el hook `useHover` (§4.2), en todos sus hover. **Falta el turnero** (`Card`, `SlotChip`, `Button` y los chips de la reprogramación): copiar el hook a su `src/hooks/` y usarlo igual.~~ — **Resuelto en el turnero (2026-11-03)**: `useHover` en `Card`, `SlotChip`, `Button` y las filas de la landing (§4.2).
20. ~~**`Card` tiene `padding` por defecto 14**, fuera de la escala 4/8/12/16/24/32 (§3.3).~~ — **Resuelto en el turnero (2026-11-03)**: el default pasó a 16. En el turnero solo lo usa la card de cada servicio en "Elegí un servicio" (de 72,6 a 76,6 px de alto). El `Card` del panel y el del barbero siguen en 14, pero todos sus usos pasan el padding a mano.
21. ~~**Touch target de los días de `SelectorDiaHorario`**: ~46 px de ancho en 375 px, pero ~41 px dentro de la tarjeta de la reprogramación y ~37 px en pantallas de 320 px, debajo de los 44 de §5.4 (el alto es 48). Al `MiniCalendario` le pasaba lo mismo.~~ — **Resuelto desde 375 px (2026-11-03)**: el botón de cada día ocupa la columna entera, con el espacio entre días adentro, y la caja visible no cambió (medida al píxel). En 375 px: 49,6 en "¿Cuándo?" y 44,8 en la reprogramación. En 320 px queda en 41,7: llegar a 44 ahí exige cambiar el diseño.
22. ~~**Textos de 12 px en `frontend-barbero`**~~ — **Resuelto (2026-10-19)**: pasaron a 14 (`sizeBody`), con el valor de `SummaryRow` (13) y la ayuda y el error de `Field` (12). `StatusPill` pasó de 10 a 11 (`sizeMicro`). Quedan en 11, a propósito, las pills de categoría y las etiquetas de la `BottomNav` (excepciones de §3.6). Texto original: (`theme.sizeMicro + 1`), debajo del mínimo de 14 de §3.6: Clientes, CrearTurno, Dashboard, Gestión (tab Horarios, `FilaDia`), Más, MiPlanilla, `KPI` y `TurnoListItem`; `StatusPill` usa 10. Los 12 de `Field` y los 13 de `SummaryRow` ya están en `estado_actual.md` ("Tamaños escritos a mano"). La Agenda y las filas de Gestión → Suspensiones pasaron a 14 el 2026-10-19. Ojo al subirlos: en un bloque de alto fijo, 14 px con el interlineado global (1,5 → 21 px por renglón) puede no entrar; el bloque de turno de la Agenda usa un interlineado de 18 px (`INTERLINEADO_TURNO`). Visto en el paso 5a de la app del barbero.
23. ~~**La escala del kiosko está escrita como números sueltos**~~ — **Resuelto (2026-11-02)**: `TAM_KIOSKO` en `wizardStyles.js` (§3.6), con los mismos valores. Texto original: en `frontend/src/screens/flows/wizard.jsx` (19, 18, 13, 15, 22, 32, 40, 56, 48; ver §3.6). Los tamaños son intencionales; lo que falta es nombrarlos: una escala local al archivo (ej. `TAM_KIOSKO = { opcion: 19, valorResumen: 18, … }`), no en `tokens.js`, porque hoy la usa un solo archivo (§7.1). Si otro front o superficie la necesita, se promueve. Visto el 2026-10-29 al documentar §6.4.

---

*Última actualización: 2026-11-03 — §3.7 suma la excepción de los logos de marcas (`IconoWhatsApp` en la landing).*

*2026-11-03 — tanda 7b de deudas: `muted` pasa a `#6B6B74` en los cuatro fronts (§3.1, §5.3 con la tabla de contraste y qué queda en `mutedSoft`, §8); `fmtPesos` igual en los cuatro (§8); deuda #9 resuelta para los grises.*

*2026-11-03 — tanda 7a de deudas (turnero): §4.2 suma `useHover` en el turnero; §6.1, el padding de `Card` y el `scroll-padding-bottom` de `StickyFooter`; deudas #17, #19, #20 y #21 resueltas.*

*2026-11-03 — tanda 6c de deudas: §4.6 suma la pantalla angosta del panel (`usePantallaAngosta`, sidebar encima del contenido, segundo renglón en las tablas, `Tabs` con `mostrarIconos`).*

*2026-11-02 — tanda 6b de deudas: §8 corregido (qué hay de verdad en `tokens.js` e `index.css` de cada front, que no son idénticos); §3.5 aclara el `shadowLg` de la landing; §6.1, `ScreenHeader` ya no se usa en el panel.*

*2026-11-02 — tanda 6a de deudas: §4.8 reescrita (toast flotante con `toast.show()`); §3.1 suma `neutralSoft`, §3.2 `sizeInput` en el panel, §3.5 `shadowLg` y `overlay`; §3.6 la escala del kiosko con nombre (`TAM_KIOSKO`) y las pills de la Agenda en `sizeMicro`; §5.6 nueva (foco en los modales); §6.1 suma `GrupoOpciones`, `estiloEtiquetaCampo` y la fuente única de formas de pago; deudas #16 y #23 resueltas.*

*2026-10-30 — deuda #13 de §9 resuelta: `set-state-in-effect` apagada en los cuatro fronts; §6.4 suma `wizardStyles.js`; §8 corrige lo de `utils/fecha.js` y `utils/formato.js`, que no son copias entre fronts.*

*2026-10-30 — deudas #8 y #12 de §9 resueltas: `DataTable` hace el hover de las filas con `<style>` local, y el foco visible quedó auditado (`CampoTelefono` suma el `outline` en su contenedor).*

*2026-10-29 — cierre de la Feature 1 de la app del barbero: §3.5 suma `shadowScroll`; §3.6 suma la superficie kiosko y su escala; §6.4 nueva (wizard del modo operativo y el patrón del paso de confirmación); deuda #23 nueva.*

*2026-10-19 — paso 5b de la app del barbero: §3.1.1 aplicada en `frontend-barbero`; §3.6 suma las excepciones en `sizeMicro`; §4.2 suma el hook `useHover`; deuda #22 resuelta y #19 resuelta en el barbero (falta el turnero).*

*2026-10-19 — paso 5a de la app del barbero: deuda #22 nueva (textos de 12 px que quedan en `frontend-barbero`); #19 anota `PUEDE_HOVER` de la Agenda.*

*2026-10-08 — rediseño del turnero: la fuente de verdad pasa a `frontend/src/` (§1); §3.8 nueva (identidad propia del turnero: acento casi negro, hero, movimiento `tt-`); §2, §4.1, §5.2, §6.1, §6.2 y §8 actualizados; deuda #4 sin objeto; deudas #17–#21 nuevas.*

*2026-10-01 — §3.1.1 nueva (color en montos: verde solo en resultados, rojo en salidas, ningún monto en indigo); §2 suma la prohibición; §3.1 corrige `success` a green-700 (es #15803D); §6.1 remite a §3.1.1.*

*2026-09-30 — §4.4 suma el patrón de fila de tabla clickeable; §6.1 suma los gráficos sin librería (`BarraProporcional`, `DesgloseMontos`).*

*2026-09-29 — auditoría de la documentación: §1 sin `esDomingo`; §6.1 con los 13 universales (`LoadingState`/`Toast` como propios del panel); deudas #1, #6 y #11 de §9 resueltas; #13 remite a `estado_actual.md` para el estado de lint.*

*2026-09-29 — deuda #13 de §9: la regla `set-state-in-effect` ya está activa también en el front de gestión (lint falla en `main`); postura unificada pendiente.*

*2026-06-10 — §4.8 nueva (Toasts / feedback efímero): documenta el patrón inline render-state vigente y la dirección futura a Toast flotante global; deuda #16 de §9 abierta para la migración.*

*2026-06-05 — deuda #14 de §9 (rango horario del timeline hardcodeado) resuelta: `Agenda.jsx` de `frontend-barbero` deriva el rango por día del `horario_atencion` del local.*

*2026-06-04 — deuda #5 de §9 (teléfono AR hardcodeado) resuelta con `libphonenumber-js` en el turnero (`DatosCliente` / `CampoTelefono`).*

*2026-05-26 — §4.5 amplía con excepción para el panel de gestión (admin usa `LoadingState` en vez de `Skeleton`). Inventario §6.1 suma `LoadingState`. Decisión documentada en detalle en el plan de rediseño del front gestión (D6).*
