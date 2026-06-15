# Performance de los frontends — diagnóstico y trabajo de fondo

> **Diagnóstico cerrado; optimizaciones del bundle hechas y medidas (2026-06-10).** Documento de
> referencia. La **metodología de medición** (cómo medir sin que los números mientan) está en
> [`convenciones_tecnicas.md`](convenciones_tecnicas.md) §10. Las validaciones de backend
> pendientes están en [`estado_actual.md`](estado_actual.md).

## El hallazgo principal (contraintuitivo)

La sospecha inicial era el bundle/JS. **Estaba al revés:**

- **Turnero:** el JS está **exonerado** en los dos ejes — descarga 300 ms y ejecución 237 ms (CPU
  4× throttled) sobre build de prod. El cuello parecía el arranque del backend (~2 s frío), **pero
  ese ~2 s era artefacto de medir local** (backend en Argentina → Supabase en Oregon, conexión
  fría cruzando ~10.000 km). En prod (Railway US → Supabase us-west-2 US) el salto es corto y no
  mostró spike; además **el proceso de Railway no duerme**.
- **Gestión:** acá el bundle **sí** era el problema (monolito de 233 kB gzip, un solo chunk con
  `xlsx` adentro). Resuelto → **233 → 78 kB gzip (−67%)**.

> **Premio de medir antes de optimizar:** no se tocó el banner (bien dimensionado), no se
> priorizaron las fuentes (en celular real son 2 woff2 de 30 kB), y no se partió el bundle del
> turnero a ciegas (ejecuta en 237 ms). El esfuerzo fue al bundle de gestión.

## Optimizaciones hechas (gestión, 2026-06-10)

- **Lazy-load de `xlsx`** (import dinámico en los 6 handlers de export) → −41% del bundle inicial.
- **Lazy-load de `browser-image-compression`** (solo al subir imagen) → acumulado −51%.
- **Code-split de `src/screens`** (`React.lazy` + `Suspense` + `ErrorBoundary` por sección y panel)
  → acumulado **−67%** (233 → 78 kB gzip); el login/operativo deja de bajar el código del panel.
- **`manualChunks` react-vendor**: no baja la 1ª carga, pero el re-download post-deploy de un
  returning user cae de ~78 → ~18 kB.
- **Cache-Control de imágenes a 1 año** (`subirImagen` + script de backfill); antes el default de
  Supabase era 1 h.
- **Fix del flash gris→imagen** (`FondoLocal` con preload + fade + gate solo en MainScreen).

(El detalle de implementación de cada uno vive en el código y en los commits del 2026-06-10.)

## Trabajo de fondo pendiente

- **#10 (estratégico) — Migrar Supabase a una región cercana (`sa-east-1`, São Paulo).** Baja el
  **piso de latencia de TODA query**, no solo el bootstrap. Es la palanca de fondo. Alto esfuerzo
  en free tier (recrear el proyecto + migrar datos) → decisión de infraestructura aparte.
- **#9 (marginal) — Logo achicado** (~486→300 px, ~38 kB) + **self-host de las 2 fuentes woff2**
  (~30 kB; mata el 3er dominio + la cadena en serie de Google Fonts). Bajo impacto.
- **Validar en prod** el impacto real de las optimizaciones de backend ya implementadas (keep-alive
  del pool, `getTenant` paralelizado) — registrado en `estado_actual.md`.

*— Fin del documento —*
