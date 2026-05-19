# Sistema de diseño

Este documento describe cómo construimos UI en este proyecto. Está pensado
para que **cualquier chat** (existente o nuevo) que vaya a escribir frontend
arranque alineado con el resto del producto.

Este documento es complementario a:
- **`CLAUDE-DESIGN.md`** (raíz) — filosofía visual y referencias de inspiración.
- **`docs/convenciones_tecnicas.md`** — convenciones de código generales.

Si lo de acá choca con `CLAUDE-DESIGN.md`, gana `CLAUDE-DESIGN.md`. Este doc
captura el **cómo lo implementamos**, no el **qué buscamos**.

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

## 2. Tema visual fijado: **Luz**

Inspirado en Stripe / Clerk. Neutral claro + acento indigo.

### Colores
- Neutros: `zinc` (`bg`, `surface`, `surfaceAlt`, `ink`, `inkSoft`, `muted`, `mutedSoft`, `hairline`, `hairlineSoft`).
- Acento: `indigo-600` (`accent`). **Un solo acento. No agregar otros chromaticos**.
- Estados: `success` (emerald-700), `danger` (red-700), `warning` (amber-700). Discretos.

### Tipografía
- **Geist** (body) + **Geist Mono** (eyebrows / micro labels en mayúsculas).
- 4 tamaños recurrentes capados:
  - `sizeTitle` (24) — h1 de pantalla.
  - `sizeHeading` (18) — h2/h3, títulos de card.
  - `sizeBody` (14) — texto base.
  - `sizeMicro` (11) — eyebrows, helper text en mono uppercase.
- 3 pesos: regular (400), medium (500), heading (600). Nada de 700+.

### Spacing
Escala fija: **4, 8, 12, 16, 24, 32**. No usar paddings arbitrarios.

### Radii
- `radiusSm` (6) — skeletons, pills.
- `radius` (10) — botones, inputs, cards normales.
- `radiusLg` (14) — cards "destacadas" (resumen, panel inline grande).

### Sombras
Mínimas. `shadowSm` para botones primarios, `shadowMd` para cards flotantes
(ej. modales). **Sin glow, sin gradientes, sin glassmorphism.**

---

## 3. Convenciones de implementación

Decisiones de cómo escribimos los componentes. Si vas a contribuir, seguilas.

### 3.1 Inline styles + theme como módulo JS

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

### 3.2 Hover con useState (no `:hover`)

Cada componente con feedback de hover lleva un `useState` local:

```jsx
const [hover, setHover] = useState(false);
// onMouseEnter / onMouseLeave + estilos condicionales
```

**Por qué**: consistencia con el resto del sistema, no requiere CSS.
**Cuidado**: en listas con 50+ items hover-able, el re-render por hover
puede notarse. Si pasa, refactorizar ese caso puntual a `:hover` via
`<style>` scoped. **Por ahora no es un problema medible.**

### 3.3 Click handlers: `onClick`, NO `onPointerDown`

`onPointerDown` parece más rápido pero:
- Dispara al apretar (no al soltar) → no se puede cancelar deslizando afuera.
- Rompe accesibilidad por teclado (Enter/Space).
- No es el comportamiento esperado de un botón.

**Siempre `onClick`.**

### 3.4 Cards clickables → accesibles con teclado

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

### 3.5 Errores y empty states

**Nunca** mostrar `<p>Cargando...</p>`, `<p>Error</p>`, ni `alert()`/`confirm()`
nativos del navegador. En su lugar:
- Loading → `Skeleton` con la silueta del contenido real (sin layout shift).
- Empty / error → `EmptyState` con icon + title + body.
- Confirmación destructiva → `ConfirmDialog`.

### 3.6 Layout responsive

**Mobile-first.** Todos los layouts arrancan asumiendo ~390 px de ancho.
Cuando el ancho permita, se centra en columna con `PageContainer`
(max-width 480 para el turnero; más para gestión/barbero — definir por front).

**No solo apilar elementos** al achicar: repensar layouts cuando haga
falta (ej. una `DataTable` ancha en desktop pasa a ser una lista de cards
en mobile).

### 3.7 Comentarios obligatorios

Cada función, componente y helper lleva JSDoc explicando **qué hace, qué
recibe, qué devuelve**. Está en `CLAUDE.md` global pero lo repito porque
es importante en UI también — un primitivo mal documentado se va a usar mal.

---

## 4. Inventario de primitivas

### 4.1 Universales (cualquier front del proyecto)

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

### 4.2 Específicas del wizard de reserva (NO usar en otros fronts)

| Componente | Por qué es exclusivo |
|---|---|
| `Progress` | Stepper "01/06" — hace sentido en wizards lineales, no en dashboards. |
| `MiniCalendario` | Calendario 7× para elegir UNA fecha de N próximos días. Para gestión/dashboard, hace falta otro picker (con navegación de mes, multi-selección, etc). |
| `SlotChip` | Chip de horario. Si el contexto cambia, repensar. |

---

## 5. Reglas para extender el sistema

### 5.1 Antes de crear un componente nuevo

**Preguntate**:
1. ¿Ya existe algo parecido en `/components/ui/`? → reusar.
2. ¿Lo voy a usar en una sola pantalla? → mantenerlo **local** a esa pantalla (no centralizar prematuramente).
3. ¿Aparece un segundo caso de uso? → **ahora sí**, mover a `/components/ui/`.

Tres líneas similares es mejor que una abstracción prematura. Pero al tercer
uso similar, abstraer es mandatorio.

### 5.2 Agregar un primitivo nuevo

1. Crearlo en `/components/ui/NombreComponente.jsx`.
2. JSDoc de la función y sus props.
3. Importar `theme` desde `'../../theme/tokens.js'`. Nunca hardcodear colores/sizes.
4. Estilos inline. Hover con `useState` si aplica.
5. Exportar en `/components/ui/index.js` (barrel).

### 5.3 Necesito cambiar un token (color, tamaño, etc.)

**Mover el cambio a `theme/tokens.js`.** Nunca hardcodear el valor nuevo en
un componente. Si lo necesitás solo para un caso, agregá un token nuevo
en lugar de "magic numbers".

### 5.4 Necesito una variante de un primitivo que ya existe

Ejemplo: ya hay `Button` con `variant: primary | secondary | ghost | danger`,
y querés "warning". **Agregá la variante al primitivo**, no crees `WarningButton`.

### 5.5 Necesito un componente que no existe en ningún front (ej. `DataTable`)

1. Lo construís en el front que lo necesita primero, en `/components/ui/` de
   ese front (no en turnero).
2. Si después otro front lo necesita, copialo (o evalúa monorepo, ver §6).

---

## 6. ¿Qué se comparte entre fronts?

Hoy cada front tiene su propio `/src/components/ui/`. **Hasta nuevo aviso,
la estrategia es duplicar**:

**Lo que se copia de `frontend-turnero` a cualquier front nuevo**:
- `theme/tokens.js` *(idéntico)*.
- `utils/formato.js`, `utils/fecha.js` *(idénticos)*.
- `index.css` *(idéntico)*.
- Los 13 primitivos universales (sección 4.1).

**Lo que NO se copia**:
- `Progress`, `MiniCalendario`, `SlotChip` (wizard-only).
- Cualquier componente específico de turnero (Landing, etc.).

Si en algún momento el dolor de mantener los duplicados es alto, evaluar
mover todo a un paquete compartido (`packages/ui/`) con npm/pnpm
workspaces. Hoy es **premature abstraction**.

---

## 7. Cosas que NO hacemos

- ❌ `alert()`, `confirm()`, `prompt()` nativos. Usar `ConfirmDialog`.
- ❌ CSS classes globales. Excepción: `index.css` para reset / fonts / keyframes.
- ❌ Múltiples colores de acento. Solo `theme.accent` (indigo).
- ❌ Sombras pesadas, glow, gradientes.
- ❌ Glassmorphism, blurs decorativos.
- ❌ Animaciones decorativas. Solo animaciones funcionales (om-fade al cambiar pantalla, om-pop en success).
- ❌ `<p>Cargando...</p>` o `<p>Error</p>`. Usar `Skeleton` / `EmptyState`.
- ❌ `onPointerDown` en botones.
- ❌ Tamaños/colores hardcodeados. Todo desde `theme`.

---

## 8. Deudas técnicas conocidas

Pendientes detectados durante el rediseño del turnero. **Si tomás alguno,
actualizá este doc.**

1. `App.jsx` del turnero — loading/error states pelados (`<p>Cargando...</p>`).
2. `esDomingo` hardcodeado en `utils/fecha.js` — cada tenant debería definir qué días abre.
3. Falta endpoint `/disponibilidad/dias` — para no mostrar fechas con 0 slots.
4. Cortes de turno (13:00 y 20:00) hardcodeados en `SeleccionHorario.jsx` — debería ser por tenant.
5. Validación de teléfono solo AR (10 dígitos) hardcodeada en `DatosCliente.jsx`.
6. Catálogos (`servicios`, `barberos`) sin `ORDER BY` explícito en backend.
7. `MiniCalendario` muestra "2 semanas" hardcodeado en el header — si en otro lugar lo usamos para más/menos días, el sublabel queda errado.

---

*Última actualización: 2026-05-19 — rediseño completo del turnero (Fase 1 + Fase 2).*
