# Plan de rediseño — `frontend` (panel de gestión) — núcleo de decisiones

> ✅ **Completado; en producción.** Documento **archivado**: solo las decisiones de diseño
> (D1–D16). El sistema de diseño vigente vive en [`sistema_de_disenio.md`](sistema_de_disenio.md);
> la historia de cómo se resolvió cada deuda del rediseño, en
> [`deudas_tecnicas_frontend.md`](deudas_tecnicas_frontend.md) (archivado); las deudas vivas, en
> [`estado_actual.md`](estado_actual.md).

El rediseño migró el panel `/frontend` (gestión, admin) del scaffold original (verde `#1a7a4a`
+ DM Sans + Tailwind) al sistema de diseño "Luz" (Geist + indigo + inline styles), sección por
sección, incluyendo los flujos operativos (Corte/Venta/Gasto) y `MainScreen`.

## Decisiones de diseño (D1–D16)

Las ya formalizadas en `sistema_de_disenio.md` quedan como puntero; las específicas del panel
admin se conservan acá con su rationale.

| # | Decisión | Por qué / estado |
|---|---|---|
| D1 | Sistema "Luz", densidad **compacta** (admin desktop/iPad, sesiones largas) | Formalizada en `sistema_de_disenio.md` §3.6. |
| D2 | **Inline styles + `theme` módulo JS** (igual que turnero/barbero) | `sistema_de_disenio.md` §4.1. |
| D3 | Tailwind **coexiste durante la migración, se desinstala al final** | Hecho: cero utilities quedaron. Transición controlada para no romper pantallas viejas en cada paso. |
| D4 | **Consolidar utils** del admin con los del turnero (no copiar y pisar) | El admin tenía helpers de dominio (semana ISO, desplazamientos) que el turnero no. Preservar lógica útil. |
| D5 | El front es **horizontal** (desktop/iPad), no mobile-first | Tokens y primitivos universales sirven igual; cambia el layout/shell y la densidad (§3.6). |
| D6 | Loading del admin = **spinner (`LoadingState`)**, no `Skeleton` | `sistema_de_disenio.md` §4.5. Layouts muy heterogéneos → un Skeleton fiel por pantalla es ruido sin beneficio. |
| **D7** | Fondo del área de contenido del admin = **`theme.surfaceAlt`** (no `bg`) | Cards blancas sobre `bg` (#FAFAFA) tienen contraste mínimo y se pierde la jerarquía. `surfaceAlt` (#F4F4F5) da el contraste justo manteniendo el ambiente claro tipo Stripe. (`shadowSm` en cards se descartó: imperceptible sobre #FAFAFA.) |
| **D8** | Variante del primitivo `Tabs` = **underline** (border-bottom 2px accent, sin contenedor) | Sobre `surfaceAlt`, un contenedor segmentado gris-sobre-gris queda sucio; el underline se sostiene sin contenedor y escala igual con 2 o 6 tabs. |
| D9 | **Política de divergencia entre fronts**: consistencia visual sí, APIs pueden divergir | `sistema_de_disenio.md` §8. |
| **D10** | Jerarquía de **tablas densas**: sin bandas grises; total anclado con `border-top: 2px solid accent` (línea indigo) | El gris claro se usaba para 3 cosas distintas dentro de la tabla y se confundía con el fondo → la jerarquía se perdía. La línea indigo de 2px en el total ancla la mirada en el dato más importante. Aplicado a Balances/Caja/Ventas/Gastos/Planillas. |
| **D11** | `SeccionTurnero` **sin `ScreenHeader`** | Es densa por naturaleza (agenda barbero × hora); el header comía ~80px de verticalidad sin agregar info que la agenda no autoexplique. |
| **D12** | Agenda del turnero **in-house con CSS grid + position absolute**, sin librería de calendar | `react-big-calendar`/`FullCalendar` implican ~50–150kb gz + overrides agresivos para respetar los tokens; el caso es acotado (un día, sin recurrencia ni drag&drop) y posicionar bloques en grilla es ~20 líneas. Cero dependencia que mantener. Reevaluar si aparece drag&drop/resize/vistas múltiples. |
| D13/**D15** | `SeccionGestion` **sin `ScreenHeader`** (D15 revierte el D13 inicial) | Pedido del usuario. **Pendiente abierto, no decidido:** sacar los headers del resto del admin sería un pase global. El sidebar ya indica en qué sección estás. |
| **D14** | Densidad de fila distinta: tablas de **reporte** (`hairlineSoft`, compactas) vs `DataTable` **CRUD táctil** (~46–48px, `hairline`) | El admin corre también en iPad: las tablas CRUD se tocan con el dedo (≥44px touch target + separador claro); las de reporte se escanean con mouse, donde compactar pesa más. |
| **D16** | Layout de `TabNegocio` = **un único bloque dividido** (Horario franja full-width + Feriados \| Imágenes en columnas) | El usuario no quería scrollear el tab; las 3 secciones del negocio son config relacionada → un panel se lee mejor que 3 cards sueltas. Se removió el form de nombre/URL (se editan por DB; ver deuda #43). |

## Pendiente de producto (abierto)

¿Se sacan los `ScreenHeader` de **todo** el admin? Ya se removieron de Gestión, Turnero,
Planillas, Balances y Caja (commit `a99e6f1`); **solo quedan en `SeccionVentas` y
`SeccionGastos`**. Terminar de sacarlos —o decidir conservarlos— es lo que queda. No decidido.

*— Fin del documento (archivado: núcleo de decisiones) —*
