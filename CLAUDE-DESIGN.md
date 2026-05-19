# CLAUDE-DESIGN.md

## Objetivo del producto

Este producto es un SaaS de gestión para barberías.

Prioridades:
1. Claridad y velocidad de uso
2. Sensación profesional y premium
3. UI limpia, moderna y simple
4. Evitar complejidad visual innecesaria
5. Consistencia total entre pantallas

El software debe sentirse:
- profesional
- rápido
- confiable
- moderno
- orientado a negocios reales

NO debe sentirse:
- template genérico
- dashboard crypto/web3
- gaming
- demasiado corporativo
- sobrecargado visualmente
- infantil o excesivamente colorido

---

## Regla principal

NO modificar lógica de negocio.

No romper:
- hooks
- estados
- fetches
- mutaciones
- validaciones
- formularios
- rutas
- backend integration
- nombres de props
- tipos

Modificar únicamente:
- diseño visual
- estructura visual del layout
- spacing
- jerarquía visual
- tipografía
- responsividad
- componentes visuales
- accesibilidad
- consistencia UX

Si una mejora requiere cambiar lógica, explicarla primero y NO implementarla automáticamente.

---

## Filosofía de diseño

Diseñar como un SaaS premium moderno.

Inspiraciones visuales:
- Linear
- Stripe Dashboard
- Vercel
- Notion
- Clerk
- Raycast
- Supabase

Principios:
- minimalismo funcional
- alta legibilidad
- mucho whitespace
- jerarquía clara
- densidad visual controlada
- foco en productividad
- interfaz limpia

Evitar:
- gradientes exagerados
- demasiadas sombras
- bordes excesivos
- animaciones innecesarias
- glassmorphism
- exceso de colores
- elementos gigantes

---

## Sistema visual obligatorio

### Spacing

Usar spacing consistente.

Preferir:
- 4
- 8
- 12
- 16
- 24
- 32

Evitar spacing arbitrario.

No usar paddings o margins inconsistentes.

---

### Border radius

Usar radios consistentes.

Preferir:
- rounded-lg
- rounded-xl

Evitar:
- esquinas totalmente cuadradas
- rounded-full innecesario
- mezcla inconsistente de radios

---

### Sombras

Usar sombras suaves y mínimas.

Preferir:
- shadow-sm
- shadow-md sutil

Evitar:
- sombras pesadas
- glow effects

---

### Colores

Priorizar neutros.

Paleta:
- slate
- zinc
- neutral

Color de acento:
solo uno.

El color debe comunicar confianza y profesionalismo.

Evitar múltiples colores compitiendo.

Estados:
- success
- warning
- destructive
deben ser discretos.

---

### Tipografía

Priorizar legibilidad.

Jerarquía clara:
- page title
- section title
- card title
- body
- helper text

Evitar:
- tamaños exagerados
- demasiados pesos tipográficos

Usar máximo:
3–4 tamaños recurrentes.

---

## Componentes reutilizables

Antes de crear UI nueva:

SIEMPRE verificar si el patrón ya existe.

Reutilizar componentes.

Evitar duplicación visual.

Crear componentes reutilizables para:

### Layout
- PageContainer
- SectionHeader
- DashboardGrid
- SidebarLayout

### Data display
- StatsCard
- InfoCard
- EmptyState
- DataTable
- Badge
- StatusPill

### Forms
- FormSection
- InputGroup
- SearchInput
- SelectField
- DatePicker
- ModalForm

### Feedback
- Toast
- ConfirmationModal
- LoadingState
- Skeleton
- ErrorState

---

## Tablas

Las tablas deben priorizar legibilidad.

Reglas:
- mucho padding horizontal
- headers claros
- hover states suaves
- acciones alineadas
- status visibles
- evitar ruido visual

Si la tabla es compleja:
priorizar cards en mobile.

---

## Formularios

Objetivo:
hacer formularios rápidos de completar.

Reglas:
- labels claras
- spacing amplio
- errores visibles
- ancho consistente
- grupos lógicos

Evitar:
- forms demasiado comprimidos

---

## Responsive

Diseñar mobile-first pero optimizado para desktop.

No simplemente apilar elementos.

Repensar layout cuando sea necesario.

---

## UX

Siempre preguntarse:

"¿Esto hace que el dueño de la barbería trabaje más rápido?"

Priorizar:
- menos clicks
- menos confusión
- estados claros
- información importante visible

---

## Output esperado

Cuando hagas cambios:

1. Explicá brevemente qué mejoraste
2. Mantené la lógica intacta
3. Extraé componentes reutilizables si detectás repetición
4. Mejorá consistencia global
5. No hagas cambios puramente cosméticos sin impacto UX

---

## Modo de trabajo

Antes de editar una pantalla:

1. Analizar componentes existentes
2. Detectar inconsistencias visuales
3. Detectar duplicaciones
4. Proponer sistema reusable
5. Refactorizar sin romper comportamiento

Pensar como:
Senior Product Designer + Senior Frontend Engineer.