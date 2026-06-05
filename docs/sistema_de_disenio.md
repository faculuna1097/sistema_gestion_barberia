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
| `utils/fecha.js` | `fmtFechaCorta`, `fmtFechaLarga`, `fmtHora`, `fmtFechaHora`, `generarProximosDias`, `esHoy`, `esDomingo`, etc. |
| `components/ui/` | Primitivos React reutilizables (ver inventario abajo). |
| `index.css` | Reset + carga de Geist + `@keyframes`. |

**Cualquier chat que toque UI debería leer estos archivos antes de escribir
código nuevo.** No re-inventar.

---

## 2. Cosas que NO hacemos

Lista corta de prohibiciones explícitas. Alinea rápido a cualquier chat nuevo.

- ❌ `alert()`, `confirm()`, `prompt()` nativos. Usar `ConfirmDialog`.
- ❌ CSS classes globales. Excepción: `index.css` para reset / fonts / keyframes.
- ❌ Múltiples colores de acento. Solo `theme.accent` (indigo).
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
- Estados: `success` (emerald-700), `danger` (red-700), `warning` (amber-700). Discretos.

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
| `LoadingState` | Spinner centrado (Lucide `Loader2`). Para uso en admin como excepción a §4.5 (ver ahí). |

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
- `index.css` *(idéntico)*.
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

1. `App.jsx` del turnero — loading/error states pelados (`<p>Cargando...</p>`). *(parcialmente atacado en `b95ae89`)*
2. ~~`esDomingo` hardcodeado~~ — **Resuelto**: `MiniCalendario` grisa los días que el negocio no atiende y los feriados, leyendo `horario_atencion` + `feriados` de `GET /api/turnero/tenant`.
3. ~~**Falta endpoint de disponibilidad por día (precisión por barbero).**~~ — **Resuelto**: el endpoint `GET /api/turnero/dias-disponibles` (`calcularDiasConDisponibilidad` en `disponibilidadService.js`) calcula, dado `barbero_id` + `servicio_id` + un rango de fechas, qué días tienen ≥1 slot reservable, con un set fijo de queries independiente del tamaño del rango. `MiniCalendario` ahora recibe `diasDisponibles` y grisa cualquier día que no esté en esa lista; se eliminó la lógica client-side de días cerrados/feriados (el backend pasó a ser la fuente única de qué día es reservable). Lo consumen `SeleccionFecha` y la reprogramación de `GestionTurno`.
4. Cortes de turno (13:00 y 20:00) hardcodeados en `SeleccionHorario.jsx` — debería ser por tenant.
5. ~~Validación de teléfono solo AR (10 dígitos) hardcodeada en `DatosCliente.jsx`.~~ — **Resuelto**: reemplazada por `libphonenumber-js`. `DatosCliente` ahora tiene un selector de país (Argentina default + limítrofes + EE.UU.), formatea el número a medida que se escribe (`AsYouType`), valida por país (`isValidPhoneNumber`) y guarda el teléfono en formato E.164 (`parsePhoneNumber`). El backend no valida formato de teléfono, así que el cambio de formato guardado es seguro. El campo compuesto `[select país | input]` vive en el componente local `CampoTelefono` (no extiende el primitivo universal `Field`).
6. Catálogos (`servicios`, `barberos`) sin `ORDER BY` explícito en backend.
7. ~~`MiniCalendario` "2 semanas" hardcodeado~~ — **Resuelto**: el sublabel se deriva de `dias.length` como "N días".
8. **Inline styles + `useState` para hover** (§4.1, §4.2) — validado solo para mobile/turnero. **Antes de arrancar el front de gestión**, revisar: las tablas densas con muchas filas hover-ables pueden hacer ruidoso el re-render. Considerar híbrido: tokens en JS + `:hover` puntual via `<style>` scoped donde la performance importe.
9. **Contraste WCAG no verificado** — `mutedSoft` sobre `surfaceAlt`, `inkSoft` sobre `bg`, blanco sobre `accent`. Auditar con WebAIM antes de release público.
10. ~~**Iconografía sin librería elegida**~~ — **Resuelto**: se eligió Lucide (`lucide-react`). Ver §3.7.
11. **`<html lang="es">`** — verificar que esté en `index.html` de cada front. (Ya OK en `frontend-barbero`.)
12. **Focus visible global** — auditar que todos los primitivos tengan estilo de `:focus-visible`. Hoy `Card` y `Button` sí; el resto, sin verificar.
13. **Regla ESLint `react-hooks/set-state-in-effect` desactivada en `frontend-barbero/eslint.config.js`.** Llegó por el scaffolding de Vite (`eslint-plugin-react-hooks` v7); los otros fronts usan versiones más viejas sin ella. En este código son falsos positivos sobre el patrón de fetching del proyecto (`setCargando(true)` al montar, cuando `cargando` ya es `true`). Si se actualiza react-hooks en los demás fronts, tomar una **postura unificada**: desactivarla en todos, o refactorizar el patrón de fetch a "sin setState síncrono en el efecto".
14. **Rango horario del timeline hardcodeado** — `Agenda.jsx` de `frontend-barbero` dibuja de `7:00` a `22:00` fijo. Debería venir del horario del local por tenant. (Emparenta con la deuda 4.)
15. **`getMisClientes` sin paginación** — la pantalla Clientes de `frontend-barbero` trae todos los clientes históricos del barbero y filtra en cliente. Con 500+ clientes, el render de cards con hover-state (ver deuda 8) puede sentirse lento. Mitigación: paginar el endpoint o virtualizar la lista.

---

*Última actualización: 2026-06-04 — deuda #5 de §9 (teléfono AR hardcodeado) resuelta con `libphonenumber-js` en el turnero (`DatosCliente` / `CampoTelefono`).*

*2026-05-26 — §4.5 amplía con excepción para el panel de gestión (admin usa `LoadingState` en vez de `Skeleton`). Inventario §6.1 suma `LoadingState`. Decisión documentada en detalle en el plan de rediseño del front gestión (D6).*
