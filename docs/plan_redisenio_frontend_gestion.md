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

### Fase 2 — Primitivos universales
- [ ] Copiar a `frontend/src/components/ui/` los 13 primitivos universales de turnero (lista en sistema de diseño §6.1).
- [ ] Crear `frontend/src/components/ui/index.js` (barrel) con los exports.
- [ ] Ajustar **defaults a densidad compacta** donde aplique (padding card 8–12, spacing 12–16).
- [ ] Verificar focus visible en todos (deuda global §3, item del sistema de diseño #12).

### Fase 3 — Shell del admin
- [ ] Refactor de `App.jsx` (eliminar `stylesEstado` hardcodeado con verde `#1a7a4a` y DM Sans).
- [ ] `PantallaCargando` → `Skeleton`. `PantallaError` → `EmptyState`.
- [ ] `MainScreen.jsx` y `PanelAdmin.jsx` con el shell nuevo (`PageContainer` adaptado a desktop, `TopBar`, navegación entre secciones).

### Fase 4 — Migración por sección
Orden acordado. **Los 3 flujos de `MainScreen` (Corte/Venta/Gasto) van al final.**

- [ ] `PantallaLoginAdmin.jsx` y `PantallaLoginOperativo.jsx`.
- [ ] `SeccionInicio.jsx` (validación del sistema con una sección chica).
- [ ] `SeccionCaja.jsx`.
- [ ] `SeccionVentas.jsx`.
- [ ] `SeccionGastos.jsx`.
- [ ] `SeccionPlanillas.jsx`.
- [ ] `SeccionBalances.jsx`.
- [ ] `SeccionTurnero.jsx`.
- [ ] `SeccionGestion.jsx` + tabs (`TabProductos`, `TabServicios`, `TabTurnero`, `TabNegocio`, `TabSeguridad`, `TabBarberos`, `BloqueHorarioAtencion`, `BloqueFeriados`, `BloqueImagenes`).
- [ ] `FlujoCorte.jsx`, `FlujoVenta.jsx`, `FlujoGasto.jsx` (último).

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
9. **Vulnerabilidades reportadas por `npm audit`** (detectadas al instalar `lucide-react` en Fase 1 — no las introdujo lucide, son preexistentes en el árbol de dependencias):
   - **Con fix disponible** (resolver con `npm audit fix`): `vite` (3 advisories, alta), `postcss` (XSS, moderada), `picomatch` (ReDoS + injection, alta), `brace-expansion` (DoS, moderada), `flatted` (prototype pollution, alta).
   - **Sin fix oficial**: `xlsx` (prototype pollution + ReDoS, alta). SheetJS no publica fix en npm. Evaluar migrar a `exceljs` o aceptar el riesgo documentado.
   - Tratamiento: resolver al final de todo (Fase 6) para no mezclar scope con el rediseño visual.

---

*Última actualización: 2026-05-26 — Fase 1 cerrada (fundamentos: tokens, utils consolidadas, index.css con Tailwind en coexistencia, Geist, lucide-react instalado). Anotada deuda §3-9 (vulns npm audit).*
