# Performance de los frontends — diagnóstico y plan

> **Estado:** Diagnóstico **cerrado** (turnero, gestión y backend del bootstrap), midiendo antes de optimizar. Plan priorizado en **§7**; puntos de entrada para ejecutarlo en frío en **§8**. **Primera data de prod (2026-06-10, §5-bis):** el proceso de Railway no duerme y la conexión DB fría no mostró spike → el cuello "backend ~2 s" era artefacto de medir local; #1/#2 probablemente marginales en prod (a confirmar con un 200 post-merge). **#1 implementado.** Recomendación actualizada: empezar por **#3**. **#3 hecho y medido (2026-06-10):** lazy-load de xlsx → bundle inicial de gestión **233.44 → 137.07 kB gzip (−41%)**; xlsx (143 kB gzip) se carga recién al exportar. **#4 hecho y medido (2026-06-10):** lazy-load de browser-image-compression → **137.07 → 114.63 kB gzip**; chunk de 21 kB diferido a la subida. **Acumulado #3+#4: 233.44 → 114.63 kB gzip (−51%).** **#7 hecho y medido (2026-06-10):** code-split de `src/screens` (8 secciones + shell de `PanelAdmin`) con `React.lazy`+`Suspense`+`ErrorBoundary` nuevo → bundle inicial **114.63 → 77.93 kB gzip (−32%)**; el login/operativo deja de bajar código de admin. **#8 hecho y medido (2026-06-10):** `manualChunks` aísla `react-vendor` (60.29 kB gzip) → `index.js` queda en **17.78 kB gzip** (solo mi código); no baja la 1ª carga (total ~78 kB igual) pero el re-download post-deploy de un returning user cae de ~78 → ~18 kB. **Acumulado #3+#4+#7: 233.44 → 77.93 kB gzip (−67%).** **#6 hecho y verificado en preview (2026-06-10):** fix del flash gris→imagen (UX/perf percibida, no bundle) — `FondoLocal` con preload (`new Image()`) + fade-in del fondo en todas las superficies y "telón"/gate solo en MainScreen; login operativo migrado a `FondoLocal` (blur 10); `PantallaCargando` sobre el fondo ambiental (sin flash blanco login→main); precargas en `App.jsx` + Mercado Pago; y favicon→logo del tenant. Detalle en §3, §7 #6 y §8 #6. **#5 hecho y verificado en prod (2026-06-10):** Cache-Control de imágenes nuevas a **1 año** (`cacheControl:'31536000'` en `subirImagen`) → header servido `public, max-age=31536000` (sin `immutable`: Supabase no lo agrega solo, se descartó por marginal). Backfill (`scripts/backfillCacheControl.js`, `download`+`update`) corrido en demo (OK 2/2); tendrá trabajo real post-merge cuando kingsai migre a `tenant_imagen`. Lección de medición: `curl -I`/HEAD devuelve `no-cache` en Storage → medir el header con **GET** (`curl -s -o NUL -D -`). Detalle en §7 #5 y §8 #5. **#2 código hecho (2026-06-10):** `getTenant` del turnero pasó de 3 queries en serie a `tenant` (para el 404) + `Promise.all([horario, feriados])` → 2 RTTs en vez de 3; impacto a validar post-merge (§7 #2 + §8 #2). **Deudas detectadas de §7 cerradas (2026-06-10):** (a) handler-path de xlsx → helper `cargarChunk` (import diferido + log + mensaje) + `<Toast>` local en los 6 handlers de export; (b) `manifest.json` neutralizado (sin ícono 404, branding BarberManager, `theme_color` indigo). Detalle en §7 "Deuda detectada".
> **Iniciado:** 2026-06-09. **Branch:** `feature/turnero`.

Prioridad: **turnero primero** (público, mobile, primera visita de un cliente) → gestión después (interno, escritorio/iPad).

---

## 1. Modelo mental — tiempo percibido por el cliente

El tiempo que el cliente "siente" se descompone en 5 factores:

1. **Viaje de red** ida/vuelta [+ DNS+TCP+TLS la primera vez, y por cada origen nuevo].
2. **Servidor pensando** (incluye la query + cold start del backend).
3. **Descargar el payload** (JS + imágenes + fuentes).
4. **Renderizar** = parse/execute del JS + React arma el DOM + layout/paint. **CPU del dispositivo.**
5. **Profundidad de la cadena de requests** en serie (HTML→JS→ejecución→API→imágenes son saltos encadenados).

Correcciones clave validadas en esta sesión:

- **(1) y (2) vienen fundidos en el TTFB.** Desde el browser no se pueden separar "red" de "servidor pensando"; el TTFB es la suma. Para aislar el servidor hace falta otra señal (server-side timing, o comparar warm vs cold).
- **El cache HTTP/CDN ahorra (1)+(2)+(3) de un recurso en visitas repetidas, pero NO ahorra (4).** Un JS servido desde disk cache igual hay que parsearlo y ejecutarlo en cada carga. → Para la CPU del celular, la única cura es **mandar menos JS** (code-splitting), no cachear.
- **Estos frontends son CSR puro (Vite SPA).** El HTML llega casi vacío; nada útil se ve hasta que el bundle bajó **y** se ejecutó. Por eso el peso del bundle pega doble en mobile: (3) descarga + (4) ejecución, y la ejecución en un celular medio es ~3–4× más lenta que en una notebook.

Qué ataca cada optimización:
- **Cache-Control / CDN** → (1)(2) en visitas repetidas.
- **Optimizar imágenes** (formato/tamaño) → (3-imágenes).
- **Code-splitting / lazy-load** → (3-JS) y (4).
- **Paralelizar / aplanar requests** → (5).

Regla de negocio innegociable: **nunca cachear disponibilidad/slots** (cambian con cada reserva → riesgo de doble booking). Cachear solo lo **público y estable**: imágenes, nombre/horario/ubicación del negocio.

---

## 2. Metodología de medición

### Cómo medimos (para que los números signifiquen algo)
- **Nunca medir sobre `npm run dev`**: el dev server sirve cada módulo por separado (cientos de requests inexistentes en prod), sin minificar, sin gzip, con overhead de HMR. Miente.
- **Medir siempre sobre un build de producción servido con `vite preview`**: `npm run build` → `npm run preview`. Sirve el `dist/` real (chunks comprimidos), que es lo que recibe el cliente.
- En el **Network tab**: `☑ Disable cache` (simula primera visita) + **throttling Fast 4G / Slow 4G** (sin throttling, localhost sirve todo en ~5 ms y la cascada miente). Recargar con Ctrl+Shift+R.
- Emular un **celular** (no iPad): es el cliente real, y el User-Agent puede cambiar el formato de fuente servido (woff2 vs ttf).

### Qué es REAL y qué NO en la medición local (turnero)
El `.env` del turnero apunta a `VITE_API_URL=http://10.10.10.16:3001` (backend local en la LAN, para probar desde el celular; desde la compu se entra por `localhost`). El backend local pega a una **Supabase remota en `us-west-2`**.

| Factor | ¿La medición local lo mide bien? |
|---|---|
| (1) viaje de red a la API | ❌ No — apunta a LAN, latencia ~0. Railway por 4G es otra cosa. |
| (2) cold start del backend | ❌ No — un backend local no "duerme". Solo se ve contra el deploy real (Railway). |
| (2) warmup de conexión a la DB / query | ✅ Sí — el backend local pega a la Supabase **real** (us-west-2). |
| (3) descarga del bundle JS | ✅ Sí — el build de prod sirve el bundle real comprimido. |
| (3) descarga de imágenes | ✅ Sí — salen directo de Supabase Storage (ver §4). |
| (4) parse/execute del JS | ✅ Sí — es CPU del browser, independiente del backend. (Sin medir aún → Medición B). |
| (5) forma de la cadena en serie | ✅ Sí la forma; los *tiempos* de la parte API local no son los de prod. |

**Traducción:** la medición local es oro para 3-JS, 4 y la forma de 5. **No sirve para cold start de Railway ni latencia de red real** (pendiente para cuando el turnero esté deployado).

---

## 3. Mediciones — tamaño de bundle (`vite build`)

### Turnero (medido 2026-06-09)
```
dist/index.html                 0.50 kB │ gzip:   0.31 kB
dist/assets/index-…​.css         1.35 kB │ gzip:   0.64 kB
dist/assets/index-…​.js        402.70 kB │ gzip: 110.72 kB   ← UN solo chunk
```
- 158 módulos, **un único chunk JS** (sin code-splitting). Vite no tiró warning de tamaño (avisa a los 500 kB raw).
- **110.72 kB gzip = lo que viaja (factor 3-JS).** **402.70 kB raw = lo que se parsea/ejecuta (factor 4).**
- El lazy-load actual es de **datos** (los `fetch` salen a medida que avanza el wizard), NO de **código**: el código de todos los pasos se baja y ejecuta de entrada.

### Gestión (`frontend/`, medido 2026-06-09)
```
dist/index.html                 0.81 kB │ gzip:   0.43 kB
dist/assets/index-…​.css         1.71 kB │ gzip:   0.76 kB
dist/assets/index-…​.js        761.39 kB │ gzip: 233.44 kB   ← UN solo chunk
1818 módulos transformados
```
- **Vite tira warning** (>500 kB) y sugiere literalmente `import()` dinámico + `manualChunks`.
- **1818 módulos** (~11× el turnero). App grande, todo en un chunk.
- **`xlsx` confirmado en `dependencies`.** Al ser chunk único, se baja y ejecuta **siempre en el arranque**, aunque exportar a Excel sea acción rara → candidato #1 a `import()` dinámico.
- A diferencia del turnero: gestión es **interna, escritorio/iPad, usuario que repite y se loguea**. El primer-paint-mobile no es crítico; el problema esperado **sí es el bundle** (monolito), donde code-splitting/lazy-load **sí mueven la aguja**.

#### Treemap de gestión (`vite-bundle-visualizer`, 2026-06-09)
> ⚠️ Los kB del treemap son **pre-minificación** (suman ~1659 kB raw vs 761 kB del bundle final minificado; ~0.46×). Sirven para **proporciones/ranking**, no como absolutos. El absoluto real es 761 kB / 233 kB gzip. El gzip por paquete es aproximado (gzip es contextual).

| raw kB | gzip~ | módulos | Paquete | Veredicto |
|---|---|---|---|---|
| **557.8** | 140.5 | 1 | **xlsx** | 🎯 El más pesado, ~34% del raw. Usado solo en "Exportar a Excel". → **lazy-load `import()`** |
| 548.1 | 95.8 | 9 | react-dom | Framework, no se quita. → **manualChunks vendor** (cachear entre deploys) |
| 361.1 | 80.0 | 25 | `src/screens` (mi código) | El **monolito**: 25 pantallas juntas, todas al arranque. → **`React.lazy()` por sección** |
| 55.3 | 20.0 | 1 | browser-image-compression | Solo se usa al subir imagen. → **lazy-load `import()`** |
| 46.4 | 18.8 | 30 | `src/components` (mi código) | Compartidos, OK |
| 28.5 | 17.7 | 60 | lucide-react (íconos) | Tree-shakeable; 60 íconos importados. Menor, revisar imports |
| 19.8 / 11.2 | 5.5 / 2.8 | 10 / 4 | react / scheduler | Framework, va al vendor chunk |

**Reparto:** Vendor (node_modules) **74%** / Mi código **26%**. Dentro de mi código, `src/screens` (el monolito de pantallas) es lo que domina.

#### Conclusión de gestión (eje bundle)
El problema **sí estaba en el bundle** (al revés que el turnero). Orden de impacto:
1. 🔴 **Lazy-load de `xlsx`** (`import()` dinámico en el handler de exportar) — el slice más gordo (~34% raw), por una acción rara. Quick win, máximo retorno por línea cambiada.
2. 🟠 **Lazy-load de `browser-image-compression`** — mismo patrón (solo al subir imagen), ~55 kB raw.
3. 🟠 **Code-split de `src/screens`** con `React.lazy()` + `Suspense` — partir el monolito de 25 pantallas para que cada sección baje on-demand. Bonus: la **pantalla de login no necesita el código del panel entero**.
4. 🟢 **`manualChunks` para el vendor** (react-dom/react/scheduler ~580 kB raw) — no baja la 1ª carga, pero hace que un cambio de tu código **no obligue a re-descargar React** (cachea el vendor entre deploys).

### Hallazgo de UX/perf percibida en gestión: flash gris→imagen
**Reportado por el usuario:** en la primera carga el fondo (foto del local) aparece **gris y después se renderiza la imagen**. Prefiere que el front "entre" ya con la imagen.

**Mecanismo confirmado leyendo el código:**
- El fondo se pinta en `frontend/src/components/ui/FondoLocal.jsx` con un **`background-image` de CSS** (capa blur + velo), NO un `<img>`. El gris es `theme.surfaceAlt`, que el contenedor usa como fallback **mientras `imagenLocal` es `null`** (`background: imagenLocal ? 'transparent' : theme.surfaceAlt`).
- `imagenLocal` se setea en `frontend/src/App.jsx` (`cargarDatosTenant`, líneas ~146-170) recién cuando resuelve `Promise.all([getNegocio(), getImagenesNegocio()])` → **el MISMO bootstrap que el turnero, contra el MISMO backend lento** (§4.1). La URL de la foto sale de `getImagenesNegocio()` (tipo='local'), de Supabase Storage.
- El fondo lo comparten MainScreen, los 3 flujos (Corte/Venta/Gasto) y la pantalla de login operativo.

**El flash tiene DOS componentes:**
1. **Período gris** = tiempo hasta que `getImagenesNegocio()` responde (la URL llega). Está **gateado por el backend lento** → es otro síntoma del cuello #1. Mejorar el backend acorta el gris en todos lados.
2. **El "snap"** = una vez seteada la URL, el `background-image` aparece de golpe (sin transición) cuando el archivo termina de bajar de Supabase. No hay fade ni placeholder.

**Nota:** la foto se cachea tras la 1ª descarga, así que el flash se nota sobre todo en la **primera** pantalla que la usa (login o main); las siguientes ya la tienen en cache.

**Medición confirmatoria (waterfall gestión, 2026-06-09, iPad, Fast 4G, backend TIBIO):**
- Initiators confirman el código: `312ba5f2.webp` (foto local, 107 kB) initiator **"Other"** = CSS `background-image`; `b25ae809.webp` (logo, 66 kB) initiator **`index.js:8`** = `<img>`.
- Cadena: JS (234 kB, 447 ms) → ejecuta+monta (~800 ms) → `imagenes` (291 ms) → CSS bg-image → baja `.webp` (364 ms) → pinta. **Gris ~600–800 ms en esta corrida.**
- ⚠️ **Backend tibio** (negocio 295 ms / imagenes 291 ms; venía caliente de la sesión). En la 1ª carga real del día (frío + Railway cold start) el tramo API se infla a ~2 s → **gris ~2.5–3 s**. Este waterfall es el *piso*.
- **Conexión:** el bundle (234 kB, 447 ms) **gatea el arranque de la cadena** (la API dispara recién a ~800 ms) → achicar el bundle (lazy-load xlsx) **también acorta el gris**.
- Resumen: 21 requests, 446 kB transferred, DOMContentLoaded 695 ms, Load 708 ms, Finish 2.12 s. Fuentes: 1 woff2 (29.3 kB).

**Posible deuda detectada (no perf):** request `logo_kingsai_graffiti.jpeg` → status 200 pero **Type `text/html`** (1.1 kB) = un `.jpeg` que devuelve HTML (probable `index.html` como fallback de 404). Huele a **referencia muerta a un logo viejo hardcodeado**. Request desperdiciada + code smell. A revisar aparte.

**✅ Confirmado y parcialmente resuelto (2026-06-10):** la referencia muerta estaba en **dos** lados, ambos a `/logo_kingsai_graffiti.jpeg` (archivo inexistente en `frontend/public/`): el favicon de `index.html` y el ícono de `manifest.json`. **Favicon resuelto** — `index.html` ahora apunta a `/vite.svg` (placeholder que existe → sin 404) y `App.jsx` lo reemplaza por el logo real del tenant apenas lo conoce (reusa el cache del logo de la UI, sin pedido extra). **Sigue abierto en `manifest.json`** → ver "Deuda detectada" en §7.

**Opciones de fix (para la fase de optimización, no ahora):**
- **(A) Gatear el reveal hasta `onload`** — alineado con la preferencia del usuario. Precargar con `new Image()` apenas se conoce la URL y mostrar la pantalla (o hacer fade-in) recién cuando cargó; el `background-image` pinta instantáneo desde cache. **Con timeout de fallback** para que una imagen lenta no bloquee la entrada para siempre. Trade-off: retrasa ver los botones (Time-to-Interactive) — aceptable en pantalla ambiental de uso diario.
- **(B) Fade-in del fondo** (transición de opacidad) — suaviza el snap pero no elimina el gris.
- **(C) Placeholder/LQIP** (versión mini borrosa instantánea) — más complejo.
- Archivos: `App.jsx` (carga la URL), `FondoLocal.jsx` (render). Recomendación preliminar: **(A) + (B)**.

**✅ Resuelto y verificado en preview (2026-06-10):** se implementó **(A) + (B)** con un refinamiento — **(B) fade en todas las superficies de `FondoLocal`** (mata el snap) y **(A) telón/gate solo en MainScreen** (gatear flujos/éxito/login sería no-op —la foto ya está cacheada al llegar— y solo agregaría riesgo de parpadeo sobre sus animaciones de entrada). Además: login operativo migrado a `FondoLocal` (antes tenía fondo propio nítido sin blur), `PantallaCargando` ambiental (sin flash blanco login→main), precargas tempranas (`App.jsx` + Mercado Pago) y favicon→logo del tenant. **Detalle completo y archivos en §7 "Detalle de implementación — #6".**

---

## 4. Mediciones — cascada de red del turnero (Fast 4G, disable cache)

Condiciones: build de prod + `vite preview` (localhost:4173), emulador iPad 1366×1024, **Fast 4G**, disable cache, backend local corriendo (→ Supabase remota us-west-2).

**Barra resumen:** `18 requests | 474 kB transferred | 951 kB resources | DOMContentLoaded: 586 ms | Load: 596 ms | Finish: 13.33 s`

### 4.1 — El cuello de botella: la API del arranque (factor 2 + 5) 🔴

| Request | Time | Cuándo | Timing |
|---|---|---|---|
| `tenant` (fetch) | **2.17 s** | bootstrap (Promise.all) | **verde "Waiting for server response"** ✅ confirmado |
| `imagenes` (fetch) | **1.68 s** | bootstrap (Promise.all) | (igual perfil) |
| `servicios` (fetch) | **262 ms** | al avanzar el wizard | rápido (DB ya caliente) |

**Inferencia rigurosa:** las 3 pegan al mismo backend con el mismo throttling. Si la lentitud fuera red/throttle, `servicios` también tardaría ~2 s. Tarda 262 ms → **la diferencia de ~1.9 s es del lado del servidor**, y solo en las primeras consultas.

Confirmado con el Timing del `tenant`: los 2 s son **verde "Waiting for server response"** (no gris "Stalled/Queueing") → es **servidor pensando**, no congestión del caño del browser.

**Causa probable:** warmup de la conexión / primeras queries a la **Supabase remota (us-west-2)** vía Session Pooler (free tier), desde Argentina. Cada query cruza a Oregon y vuelve.

⚠️ **Proyección a prod:** esto se midió contra el backend **local**. En producción, **Railway suma su propio cold start ENCIMA** de este warmup. Este número es un **piso optimista**; el cliente real (primera visita, backend dormido) espera más.

### 4.2 — Las fuentes: Google Fonts (factor 5 + 1) 🟡
Cadena en serie de 3 niveles: `index.css` → `css2?family=Geist…` (CSS de Google) → archivos de fuente.

**⚠️ Corrección de medición (el dispositivo emulado cambia el resultado):**
- Con **iPad** (medición original) Google servía **5–6 `.ttf`** (~36–37 kB c/u, ~180 kB total), uno por peso.
- Con **iPhone** (cliente real) Google sirve **`.woff2`** y solo **2 archivos** (fuentes variables: un woff2 cubre todos los pesos de cada familia):
  ```
  fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFWNOITd.woff2       (Geist, todos los pesos)
  fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2  (Geist Mono)
  ```
- **Conclusión:** el panorama de fuentes en el cliente real es **mucho mejor** que lo que sugería el iPad (2 woff2 vs 6 ttf). El payload real es chico → **baja la prioridad** de este hallazgo.
- **Lo que sigue siendo válido:** sigue habiendo un **3er dominio** (Google → DNS+TCP+TLS extra en primera visita, factor 1) y una **cadena en serie de 3 saltos** (factor 5). Self-hostear los 2 woff2 mata ambas cosas, pero el ahorro es menor de lo pensado.
- **Pendiente:** confirmar el peso (kB) de los 2 woff2 reales para cuantificar.
- **Lección transversal:** medir en iPad cuando el cliente es un celular dio un diagnóstico falso (peor). Siempre emular el dispositivo real.

### 4.3 — Las imágenes (factor 3-img + 5) 🟡
- Formato: **WebP** ✅ (buena decisión ya tomada). `312ba5f2….webp` = **107 kB**, `b25ae809….webp` = **66 kB**.
- **Origen confirmado:** Supabase Storage, bucket **público**, servido directo (no proxeado por el backend):
  `https://mtmqdnkbustsfawxgroe.supabase.co/storage/v1/object/public/tenant-imagenes/<tenantId>/local/<uuid>.webp`
  → Supabase Storage está detrás de CDN (Cloudflare). El cacheo en el edge depende del header `Cache-Control` del objeto.
- **Serie (factor 5):** las imágenes NO arrancan hasta que responde `/api/negocio/imagenes` (1.68 s). Confirmado por el initiator chain: `turnos/` → `index.js` → `/api/negocio/imagenes` → recién ahí los `.webp`. El contenido visual aparece pasados ~2.9 s.
- **Cache-Control medido:** `public, max-age=3600` (1 hora) — es el **default de Supabase**. Para imágenes estables (logo, banner que casi nunca cambian) **es corto**: tras 1 h el browser revalida. Como la URL es content-addressed por UUID (la imagen de esa URL nunca cambia), se podría cachear con `max-age` largo (1 año) + `immutable`. **Lever confirmado con headroom.** Se setea al **subir** (opción `cacheControl` de Supabase); cambiar las existentes implica re-subir o actualizar metadata.
- **`content-length` del banner:** `106834` bytes (≈ 104 kB) — coincide con los 107 kB del waterfall.
- **Tamaño display vs natural (medido en emulador iPhone):**

  | Imagen | Render (CSS px) | Natural | Target (× DPR 3) | Veredicto |
  |---|---|---|---|---|
  | Banner (`/local/…312ba5f2.webp`) | 396.8 × 297.2 | **729 × 972** | ~1190 × 892 | ✅ **OK** — el natural (729 ancho) es **menor** que el target retina (1190). No está sobredimensionado; si acaso está algo justo. **No tocar.** |
  | Logo (`/logo/…b25ae809.webp`) | 91.2 × 91.2 | **486 × 486** | ~273 × 273 | ⚠️ **Sobredimensionado ~1.8× lineal** (486 vs 273). Redimensionar a ~300 px ahorraría ~35–40 kB. |

- **Lección del DPR:** el tamaño objetivo NO es el CSS px, es **CSS px × DPR**. iPhone DPR ~3 → banner a 397 CSS px necesita ~1190 px; logo a 91 px necesita ~273 px. No hay que sobre-achicar (se vería borroso en retina): el sweet spot es ~2–3× el CSS px.
- **El banner NO está sobredimensionado** (729 < 1190): la medición evitó "optimizar" una imagen que está bien. (Detalle de layout: el banner es portrait 3:4 metido en un box landscape 4:3 con `object-fit: cover` → se recorta ~44% del alto. Es decisión de diseño, no de performance; no se actúa.)
- **El logo SÍ:** 486 × 486 para un target de ~273 px. Ahorro real pero **modesto** (~35–40 kB). 65.5 kB para un logo de 486² es alto (es un emblema con detalle ~0.28 B/px); a ~300 px bajaría a ~25–30 kB.
- **Total imágenes primera visita:** 172 kB → ~134 kB si se achica el logo. Ahorro ~38 kB (≈ <0.5 s en 4G). **Chico frente a los 2 s de la API.**
- Nota: Supabase **free tier no tiene transformación on-the-fly** (es Pro) → redimensionar **al subir**.

### 4.4 — El bundle JS NO es el cuello (en descarga) 🟢
Timing de `index.js`: **TTFB 174 ms (verde) + Content Download 116 ms (azul) = 300 ms**.
- Azul 116 ms = bajar los 110 kB gzip por el caño 4G simulado → **chico** frente a los 2 s de la API.
- Verde 174 ms = como es localhost, es básicamente la latencia que inyecta el throttling (en prod sería red real).
- **Lo que sospechábamos (el bundle) NO es el problema en el eje red.** Falta su costo de **ejecución** (factor 4 → Medición B).

### 4.5 — Preflights CORS (factor 1 + 5) 🟢
Cada llamada cross-origin (`localhost:4173` → `10.10.10.16:3001`) dispara un **OPTIONS preflight (204)** antes del GET → un round-trip extra por endpoint. Barato en local (~6 ms); real en prod si front y API quedan en orígenes distintos. Mitigable con `Access-Control-Max-Age` o mismo origen.

### 4.6 — Medición B: ejecución del JS (factor 4) — pestaña Performance 🟢

Condiciones: `vite preview`, emulador iPhone, Fast 4G, **CPU 4× slowdown**, record + reload. Rango del trace: 0–5.74 s.

**Summary (donut) — reparto del main thread:**

| Categoría | Tiempo |
|---|---|
| **Scripting (JS — factor 4)** | **237 ms** |
| System | 580 ms |
| Painting | 322 ms |
| Rendering | 313 ms |
| Loading | 23 ms |
| **Total trace** | 5,743 ms |

**Lecturas clave:**
- **El factor 4 NO es un problema.** Scripting = **237 ms** en todo el trace, **con CPU 4× throttled**. El bundle de 402 kB raw parsea/ejecuta sin dolor en un celular de gama media. (Sin throttle ≈ 60 ms; el grueso del trabajo inicial — parse + React mount — está en los primeros ~800 ms del flame chart.)
- **El main thread está IDLE la mayor parte del tiempo.** Trabajo real ≈ 1.5 s (237+580+322+313+23); el resto (~4.3 s de 5.74 s) es **idle: el procesador esperando la red/servidor.** Prueba visual del titular: el cuello NO es la CPU, es esperar al backend.
- **Doble confirmación:** el JS del turnero está **exonerado** en los dos ejes — descarga barata (300 ms, §4.4) y ejecución barata (237 ms @ 4×). Code-splitting ayudaría marginalmente, **no es urgente** para el turnero.

**Quantificación de terceros (columna Main thread time / Transfer size):**
- **Google Fonts: 30.2 kB transfer, 0.0 ms CPU.** Cierra el tema fuentes: los 2 woff2 pesan ~30 kB y no cuestan CPU. Confirmado chico.
- localhost (1st party): 112 kB, 85.7 ms CPU.
- **AdBlock (extensión): 132.3 ms de main thread** → **ruido de medición** (el cliente real no tiene *tu* AdBlock). Para un trace limpio conviene medir en **Incógnito** (extensiones off). No invalida el diagnóstico (Scripting propio es 237 ms igual).

**Métricas Web Vitals del panel:** CLS = **0** (sin layout shift, bien). LCP/INP figuran "—" en este trace (no capturados en el rango). Insight "Render-blocking requests" presente (CSS + CSS de Google Fonts) — impacto menor por el tamaño, candidato de baja prioridad.

### 4.7 — Cuidado con la barra de resumen (CSR)
- `Load: 596 ms` es **optimista falso**: dispara con el HTML+JS inicial, pero el cliente no ve nada útil (los datos llegan después).
- `Finish: 13.33 s` es **pesimista falso**: llegó a 13 s porque se avanzó el wizard a mano (el `servicios` salió al clickear). Es "cuándo se calló la red", no lo que esperó el cliente.
- **Tiempo real percibido** ≈ cuándo resuelven tenant + imágenes + las fotos ≈ **~2.5–3 s** (peor en prod con cold start).

---

## 5. Hallazgos priorizados → factores

| # | Hallazgo | Factor(es) | ¿Real o solo-prod? | Prioridad prelim. |
|---|---|---|---|---|
| 1 | API arranque 2.17 s / 1.68 s (server-side, confirmado verde) | (2) + (5) | Real el warmup DB; **prod suma cold start Railway** | 🔴 Alta |
| 2a | Cache imágenes `max-age=3600` corto para asset estable (UUID → podría ser 1 año + immutable). Acelera **visitas repetidas/concurrencia**, no la 1ª. | (1)+(2) repetida | Real | 🟠 Media (barato + bajo riesgo) |
| 2b | Logo sobredimensionado (486 px → target 273 px), ~38 kB ahorrables. Banner OK, no tocar. | (3-img) | Real | 🟢 Baja (ahorro chico) |
| 3 | Fuentes Google: en mobile real son 2 woff2 (chico); queda 3er dominio + cadena ×3 | (5) + (1) | Real | 🟢 Baja-media |
| 4 | Bundle JS — descarga 300 ms (barato) | (3-JS) | Real | 🟢 Baja (en descarga) |
| 5 | Ejecución del bundle (402 kB raw) — **237 ms @ CPU 4×, exonerado** | (4) | Real | 🟢 Baja (medido, no duele) |
| 6 | Preflights CORS por cada API | (1) + (5) | Real (cross-origin) | 🟢 Baja |

### Conclusión del turnero (diagnóstico cerrado en el eje frontend)
La intuición inicial estaba **al revés**: se sospechaba del bundle/JS, y el JS resultó barato en los dos ejes (descarga 300 ms, ejecución 237 ms @ 4×). El monstruo real es **(1) el arranque del backend: ~2 s de query/warmup a Supabase remota + el cold start de Railway en prod.** Orden de impacto para el turnero:
1. 🔴 **Backend del bootstrap** (tenant + imagenes ~2 s). Lo que más mueve la aguja, lejos.
2. 🟠 **Cache-Control de imágenes** a 1 año + immutable (barato, bajo riesgo; ayuda repetidas/concurrencia).
3. 🟢 Logo achicado (~38 kB), fuentes self-host (~30 kB), code-splitting (no urgente). Todo marginal.

> **Premio de medir antes de optimizar:** evitamos tocar el banner (estaba bien), evitamos priorizar fuentes (en mobile real son 2 woff2 de 30 kB), y evitamos partir el bundle a ciegas (ejecuta en 237 ms). El esfuerzo va al backend, que ni estaba en la lista original.

---

## 5-bis. Diagnóstico del backend del bootstrap (cuello #1 de AMBOS fronts) 🔴

El frontend resultó sano (turnero) o con grasa acotada (gestión), pero el verdadero monstruo es **el tiempo del backend en el arranque** (~2 s frío). Diagnóstico leyendo el código (`backend/src/config/db.js`, `controllers/turnero.js`, `controllers/imagenes.js`, `controllers/gestion.js`).

### Lo que hace cada endpoint del bootstrap
- `getNegocio` (gestión) → **1 query** (`SELECT nombre_negocio, booking_url FROM tenant`).
- `getImagenes` (`/api/negocio/imagenes`, ambos fronts) → **1 query** (`SELECT … FROM tenant_imagen`).
- **`getTenant` (turnero) → ¡3 queries EN SERIE!** (`await` tras `await`): tenant → `obtenerHorarioCrudo` → `obtenerFeriados`. Las 3 son independientes pero se ejecutan secuencialmente.

### Config del pool (`db.js`)
```js
new Pool({ ssl:{...}, max: 3, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 })
```
- `max: 3` (límite del plan free de Supabase). **Sin `min`** (node-pg no tiene `min`) y **sin keepAlive**. `idleTimeoutMillis: 30000` → tras 30 s ociosas el pool **se vacía**.

### Causas raíz, ordenadas por impacto
1. 🔴 **Región: Supabase en `us-west-2` (Oregon), lejísimos del usuario/Railway (Argentina).** Cada round trip a la DB paga ~150–290 ms SOLO por distancia (~10.000 km). Es el **impuesto base de cada query** — por eso una query simple "tibia" tarda ~290 ms en vez de ~20 ms. Lo confirma el waterfall: `getNegocio` (1 query) tibio = 295 ms ≈ 1 RTT a Oregon.
2. 🔴 **Cold connection: el pool no mantiene conexiones calientes.** Tras 30 s de inactividad (`idleTimeoutMillis`) + sin `min`/keepAlive, el pool queda vacío → la siguiente request paga el **establecimiento completo de conexión** (TCP + TLS + auth de Postgres por el Session Pooler hasta Oregon) ≈ 1–1.5 s. **Ése es el grueso de los 2 s fríos.** En prod, Railway suma su **cold start del proceso Node** encima.
3. 🟠 **`getTenant`: 3 RTTs en serie.** Las 3 queries secuenciales = ~3× la latencia (~600–870 ms tibio) cuando podrían ser 1.
4. 🟢 **`max: 3` + bootstrap dispara hasta 6 queries paralelas** (gestión: negocio+imagenes+barberos+servicios+productos+categorias) → contención (3 esperan) y, en frío, las 3 primeras pagan establecimiento. Menor, pero suma.

### Desglose estimado del ~2 s frío del `getTenant`
`establecer conexión a Oregon (~1–1.5 s)` + `3 queries en serie (~0.6–0.9 s)` ≈ **~2 s**. Coincide con los 2.17 s medidos. Tibio (conexión reusada + serial): ~0.6–0.9 s.

### Fixes (preview — al plan)
- **Keep-alive del pool** (mata la causa #2): un `SELECT 1` periódico (<30 s) para que la conexión no se cierre, o subir `idleTimeoutMillis`, o `keepAlive: true`. **+ ping HTTP** al backend para que Railway no duerma (cold start del proceso). Barato, bajo riesgo, alto impacto.
- **Paralelizar `getTenant`** con `Promise.all` (las 3 queries son independientes) → de 3 RTTs a 1. Quick win, el front no cambia.
- **(Estratégico) Migrar Supabase a región cercana** (`sa-east-1` São Paulo) → baja el piso de **toda** query, no solo el bootstrap. Máximo leverage pero alto esfuerzo (en free tier = recrear el proyecto + migrar datos).

### Medición en prod (2026-06-10) — primera data real contra Railway 🔬

Primera medición contra el backend **deployado** (Railway), no el local. Método: `curl.exe` con `-w` (separa TTFB de tiempo de conexión), corrido a las **8:50, 1 h antes de que abra la barbería** → backend ocioso toda la noche = caso frío real. Se aisló **proceso vs DB** con el truco del 400: una request **sin** header `X-Tenant-Subdomain` corta en `tenantMiddleware` con 400 **sin tocar la DB** → mide solo el despertar del proceso.

| Request | http | TTFB frío | TTFB tibio | Qué mide |
|---|---|---|---|---|
| `/api/health` **sin header** | 400 | **0.78 s** | ~0.55 s | proceso (sin DB) |
| `/api/negocio` + `demo` | 404 *(tenant)* | 0.55 s | ~0.55 s | conexión DB (tenant lookup, cache miss → sí pega a DB) |
| `/api/negocio` + `kingsai` | 404 *(ruta)* | 0.57 s | ~0.57 s | ruta inexistente en main (no llega a query real) |

**Hallazgos:**
1. 🟢 **El proceso NO duerme.** Frío 0.78 s, no 3–10 s; la diferencia vs tibio está toda en el `conex` (warmup DNS/TLS de curl), no en el lado servidor. → **Railway no hace sleep de este servicio. Se descarta la Parte B del #1 (pinger externo anti-sleep): no hace falta.**
2. 🟢 **El "monstruo de ~2 s" era un artefacto de medir LOCAL.** Los 2.17 s del §4.1 se midieron contra el backend **local** (Argentina) → Supabase (Oregon): conexión fría cruzando ~10.000 km × varios handshakes. En prod el backend está en Railway (US) → Supabase us-west-2 (US) = **salto corto**. La penalidad de conexión fría es **proporcional a la distancia backend↔DB**, y el diagnóstico midió la topología equivocada. La query de tenant lookup fría en prod (`demo`, que sí pega a la DB) no mostró spike (~0.55 s, casi todo red Argentina↔Railway de *nuestro* curl).
3. ⚠️ **Caveat — todavía no hay un 200 del bootstrap real.** El backend deployado es `main`, con **otra estructura de rutas** que `feature/turnero`: el sitio en vivo pega a `/api/gestion/negocio` (main), mientras que `feature/turnero` lo refactorizó a `/api/negocio` y agregó `/api/turnero/*` (inexistentes en main). Por eso las requests a las rutas nuevas dieron **404 de ruta-no-encontrada** (no de tenant). No llegamos a medir `getNegocio` completo ni `getTenant` (3 queries) en 200.

**Consecuencia para el plan:** muy probablemente **#1 (keep-alive) y #2 (paralelizar) sean MARGINALES en prod**, no el game-changer que sugerían los números locales. El **#1 ya está implementado** (`db.js` + `index.js`: `keepAlive:true` + `iniciarKeepAlive` con `SELECT 1` cada 20 s) y se queda como higiene barata + seguro contra conexión stale; su impacto y el del #2 se **validan post-merge**.

**Para el próximo chat (post-merge):** re-correr el test contra Railway con las rutas de `feature/turnero` ya deployadas, midiendo en frío en 200: turnero `getTenant` (`/api/turnero/tenant`) + gestión `getNegocio` (`/api/negocio`). Datos confirmados por F12: subdominio **`kingsai`**, backend `https://sistemagestionbarberia-production.up.railway.app`.

> ⚠️ **Riesgo de deploy (a watchear en el merge):** front y back de gestión cambian la ruta juntos (`/api/gestion/negocio` → `/api/negocio`). Si se deployan desfasados, el panel de la barbería en vivo se rompe. Deben subir coordinados. (Cruzar con el "Checklist del merge" de `estado_actual.md`.)

---

## 6. Pendientes de medir

- [x] **Medición B — factor 4 (ejecución):** Scripting 237 ms @ CPU 4× → exonerado. (§4.6)
- [x] **Header `Cache-Control` y `Content-Length`** del `.webp` → `public, max-age=3600`; banner 104 kB. (§4.3)
- [x] **Tamaño NATURAL (intrínseco)** banner 729×972 (OK), logo 486×486 (sobredimensionado ~1.8×). (§4.3)
- [x] **Re-medir con emulador de celular** → iPhone sirve 2 woff2 (no 6 ttf). (§4.2)
- [x] **Peso de los 2 woff2** de Google Fonts: ~30.2 kB total, 0 ms CPU. (§4.6)
- [x] **Bundle analyzer** sobre gestión → treemap parseado: xlsx 34% raw, react-dom, src/screens monolito. (§3)
- [x] **Gestión:** xlsx confirmado como slice #1; monolito = `src/screens` (25 pantallas). (§3)
- [x] **Flash gris→imagen en gestión** (UX/perf percibida): **resuelto y verificado en preview (2026-06-10)** — `FondoLocal` con preload + fade (B, todas las superficies) + telón/gate solo en MainScreen (A); login operativo migrado, `PantallaCargando` ambiental, precargas + favicon. Detalle en §3, §7 #6, §8 #6.
- [ ] (Opcional) Treemap del **turnero** — su JS ya está exonerado, pero serviría para confirmar que no hay sorpresas.
- [~] **Cold start de Railway + latencia de red real:** medido parcial 2026-06-10 (§5-bis "Medición en prod"): **el proceso NO duerme** (Parte B descartada) y la conexión DB fría no mostró spike en prod. **Falta el 200 del bootstrap real** (las rutas nuevas de `feature/turnero` no están deployadas en `main`) → post-merge.
- [x] **Diagnóstico del backend:** causa raíz = región lejana + cold connection + getTenant con 3 queries en serie. (§5-bis)
- [ ] (Opcional, validación fina) **`Server-Timing` header** en los endpoints del bootstrap para medir en prod el split conexión-vs-query con números exactos.

---

## 7. Plan priorizado de optimización

Ordenado por **impacto medido / esfuerzo / riesgo**. Reglas: **nunca cachear slots/disponibilidad**; **verificar cada ahorro re-buildeando o re-midiendo** (no fiarse de números pre-minify ni de estimaciones).

### 🚀 Quick wins (empezar acá — bajo esfuerzo, bajo riesgo, alto retorno)
| # | Acción | Capa | Impacto | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| 1 | **Keep-alive del pool** (`keepAlive:true` + `SELECT 1` cada 20 s vía `iniciarKeepAlive`). ✅ **Código hecho** (`db.js`/`index.js`). ~~+ ping anti-sleep Railway~~ → **descartado: el proceso no duerme** (medido 2026-06-10, §5-bis) | Backend | 🟡 **Revisado a Bajo-medio** — la data de prod sugiere que el cold ~2 s era artefacto local; impacto real a validar post-merge | Bajo | Bajo |
| 2 | ✅ **Código hecho (2026-06-10)** — **Paralelizar `getTenant`** con `Promise.all` (tenant primero para el 404, luego `Promise.all([horario, feriados])`) | Backend | 🟠 Medio-alto estimado (~0.4–0.6 s/carga); **impacto real a validar post-merge** (§5-bis sugiere marginal en prod) | Bajo | Bajo |
| 3 | ✅ **Hecho (2026-06-10)** — **Lazy-load de `xlsx`** (`import()` dinámico en los **6 handlers** de exportar, 5 archivos) | Gestión | 🟠 **Alto, medido** — bundle inicial 233.44 → **137.07 kB gzip** (−96 kB, −41%); xlsx (143 kB gzip) diferido al click | Bajo | Bajo |
| 4 | ✅ **Hecho (2026-06-10)** — **Lazy-load de `browser-image-compression`** (mismo patrón, solo al subir imagen) | Gestión | 🟡 **Medio, medido** — bundle inicial 137.07 → **114.63 kB gzip** (−22 kB); chunk de 53 kB raw / 21 kB gzip diferido a la subida | Bajo | Bajo |

### 🛠️ Medio plazo (más esfuerzo o más riesgo, buen retorno)
| # | Acción | Capa | Impacto | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| 5 | ✅ **Hecho y verificado en prod (2026-06-10)** — **Cache-Control de imágenes** a 1 año (`cacheControl:'31536000'` en `subirImagen`) + script de backfill para las existentes. Sin `immutable` (Supabase no lo emite; descartado por marginal) | Ambos | 🟡 **Medido** — header nuevo `public, max-age=31536000` (default era `3600`); ayuda visitas repetidas / concurrencia, no la 1ª | Bajo-medio | Bajo |
| 6 | ✅ **Hecho y verificado en preview (2026-06-10)** — **Fix del flash gris→imagen**: `FondoLocal` con `new Image()` + fade (B, todas las superficies) + telón/gate (A, solo MainScreen, timeout 2500 ms); login operativo migrado a `FondoLocal` (blur 10); `PantallaCargando` ambiental; precargas (`App.jsx` + MP) + favicon→logo | Gestión (UX) | 🟡 **La UX pedida** — "entra ya con la imagen", sin snap ni flash blanco | Medio | Bajo |
| 7 | ✅ **Hecho (2026-06-10)** — **Code-split de `src/screens`** (`React.lazy`+`Suspense`+`ErrorBoundary`): 8 secciones + shell de `PanelAdmin` lazy | Gestión | 🟠 **Alto, medido** — bundle inicial 114.63 → **77.93 kB gzip (−32%)**; login/operativo baja 0 de admin | Medio | Medio (resuelto) |
| 8 | ✅ **Hecho (2026-06-10)** — **`manualChunks`** aísla `react-vendor` (react/react-dom/scheduler/react-is) | Gestión | 🟢 **Medido** — 1ª carga igual (~78 kB); `index.js` propio queda en 17.78 kB gzip → re-download post-deploy ~78 → ~18 kB | Bajo | Bajo |

### 🧊 Marginal (hacer si sobra tiempo)
| # | Acción | Capa | Impacto | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| 9 | **Logo achicado** (~486→300 px, ~38 kB) + **self-host fuentes** woff2 (~30 kB, +`preconnect`/`font-display`, mata 3er dominio y cadena ×3) | Ambos | 🟢 Bajo | Medio | Bajo |

### 🗺️ Estratégico (track aparte — alto leverage, alto esfuerzo)
| # | Acción | Capa | Impacto | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| 10 | **Migrar Supabase a región cercana** (`sa-east-1` São Paulo) | Infra | 🔴 Alto — baja el **piso de latencia de TODA query**, no solo el bootstrap | Alto (free tier = recrear proyecto + migrar datos) | Medio |

### Por dónde empezar (recomendación — actualizada 2026-06-10)
La data de prod (§5-bis "Medición en prod") **reordenó la prioridad**: el backend frío resultó **mucho menos grave en prod** de lo que sugería la medición local (el proceso no duerme; la conexión fría no mostró spike). Por eso:
- **Empezar por #3 (lazy-load de xlsx):** frontend de gestión, **medible local ya** (`npm run build` + `vite preview`), sin depender de prod/merge/subdominio. Quick win más limpio y de impacto real (~34% del bundle de gestión). → ✅ **Hecho (2026-06-10): −41% del bundle inicial gzip** (ver tabla de quick wins y §8 #3).
- **#1:** código hecho, se queda; impacto a validar post-merge (probablemente marginal).
- **#2:** bajo riesgo, viaja con el merge del turnero; impacto modesto, a validar post-merge.
- El #10 sigue siendo la palanca de fondo, decisión de infraestructura aparte.

### Detalle de implementación — #3 lazy-load de xlsx
```js
async function exportar() {
  const XLSX = await import('xlsx');  // se baja recién al hacer click
  // ...usar XLSX
}
```
`import()` carga el módulo on-demand; Rollup lo separa solo en su propio chunk → el arranque deja de cargar xlsx. **Verificar el ahorro real re-buildeando** (no fiarse del número pre-minify del treemap).

**Resultado medido (2026-06-10, `npm run build`):**

| | Antes | Después | Δ |
|---|---|---|---|
| Bundle inicial `index-*.js` (raw) | 761.39 kB | 477.25 kB | −284 kB (−37%) |
| Bundle inicial (gzip — lo que viaja) | 233.44 kB | **137.07 kB** | **−96 kB (−41%)** |
| Chunk `xlsx-*.js` (gzip) | — (dentro del bundle) | 142.94 kB **diferido** | se baja recién al click de Exportar |

- El gzip del chunk xlsx (142.94 kB) coincide con el estimado del treemap (~140.5 kB) → separó exactamente lo previsto.
- El **warning de Vite >500 kB desaparece** (el main quedó en 477 kB raw).
- La suma de los dos chunks (906 kB raw) supera el monolito original (761 kB): overhead normal del code-splitting; irrelevante porque xlsx sale del camino crítico del arranque.
- `await import('xlsx')` devuelve el mismo namespace object que `import * as XLSX` → `XLSX.utils.*` / `XLSX.writeFile` quedan idénticos; los handlers solo pasan a `async`.

### Detalle de implementación — #4 lazy-load de browser-image-compression

Mismo patrón que el #3, en **1 archivo** (`BloqueImagenes.jsx` → handler `handleArchivo`, que ya era `async`). Diferencias: es **default export** (`const { default: imageCompression } = await import(...)`, no namespace), y el `import()` va **dentro del `try/catch` existente** → una falla de carga del chunk cae en el catch y muestra el Toast de error al usuario (este archivo no arrastra la deuda transversal de "chunk load error" del #3).

**Resultado medido (2026-06-10, `npm run build`):**

| | Antes (post-#3) | Después (#4) | Acumulado #3+#4 |
|---|---|---|---|
| Bundle inicial (raw) | 477.25 kB | 423.39 kB | 761.39 → **423.39 kB** (−44%) |
| Bundle inicial (gzip) | 137.07 kB | **114.63 kB** | 233.44 → **114.63 kB** (**−51%**) |
| Chunk `browser-image-compression-*.js` (gzip) | — | 21.07 kB **diferido** | se baja recién al subir una imagen |

- El gzip del chunk (21.07 kB) coincide con el estimado del treemap (~20 kB).
- El chunk `xlsx-*.js` quedó intacto (mismo hash) → #4 no lo tocó.

### Detalle de implementación — #7 code-split de `src/screens`

Dos boundaries (Opción B), ambos con el mismo primitivo nuevo `ErrorBoundary`:
1. **Secciones** (`PanelAdmin.jsx`): los 8 `import` estáticos pasaron a `const Seccion* = lazy(() => import('./sections/...'))`. El render (`<SeccionActual/>`) se envolvió en `<ErrorBoundary key={seccionActiva}><Suspense fallback={<LoadingState/>}>…`. El `key` remonta el boundary al cambiar de sección (un error en una no "pega" a la siguiente). Fallback = `LoadingState`, idéntico al spinner que la sección usa después mientras trae datos → un solo loader continuo.
2. **Panel** (`App.jsx`): `import PanelAdmin` pasó a `lazy()`; el render se envolvió en `<ErrorBoundary><Suspense fallback={<PantallaCargando/>}>…` (spinner full-screen del boot). Así el login/operativo no baja nada del panel.

**`ErrorBoundary`** (`components/ui/ErrorBoundary.jsx`, class component — React lo exige): distingue chunk-load-error (→ `window.location.reload()` una vez, guard por timestamp en `sessionStorage`, ventana 10 s anti-loop) de un bug real (→ `EmptyState` tone danger + Reintentar, que limpia el estado y re-renderiza). Cubre el **render-path**; el `import('xlsx')` de handlers sigue siendo deuda aparte (ver "Deuda detectada").

**Resultado medido (2026-06-10, `npm run build`):**

| | Antes (post-#4) | Después (#7) | Δ |
|---|---|---|---|
| Bundle inicial `index-*.js` (raw) | 423.39 kB | 253.84 kB | −169.5 kB (−40%) |
| Bundle inicial (gzip — lo que viaja) | 114.63 kB | **77.93 kB** | **−36.7 kB (−32%)** |
| Chunks nuevos diferidos | — | `PanelAdmin` (4.01 kB gz) + 8 secciones (`SeccionGestion` 16.12 … `SeccionInicio` 2.47 kB gz) + ~18 micro-chunks compartidos (íconos + `Tabs`/`Select`/`Toast`/…) | on-demand |

- El split de los ~18 micro-chunks (componentes/íconos que comparten ≥2 secciones) es comportamiento normal de Rollup (evita duplicarlos); que estén separados **confirma** que el camino operativo no los usa.
- **Verificado en runtime** (`vite preview`): los `Seccion*-*.js` bajan al abrir cada sección, no al arrancar.
- **Acumulado #3+#4+#7: 233.44 → 77.93 kB gzip (−67%).**

### Detalle de implementación — #8 `manualChunks` react-vendor

`vite.config.js` → `build.rollupOptions.output.manualChunks(id)` devuelve `'react-vendor'` para `node_modules/{react,react-dom,scheduler,react-is}/` (barras finales para no matchear `lucide-react`).

**Resultado medido (2026-06-10, `npm run build`):**

| | Post-#7 | Post-#8 |
|---|---|---|
| `index-*.js` (gzip) — solo mi código | 77.93 kB (incluía React) | **17.78 kB** |
| `react-vendor-*.js` (gzip) | — (dentro del index) | 60.29 kB |
| Total 1ª carga (index + react-vendor) | 77.93 kB | ~78.07 kB (igual; +0.14 kB de overhead del split) |

- **No baja la 1ª carga** (esperado): React solo se mudó de archivo. La ganancia es de **cache entre deploys**: al deployar un cambio mío, solo `index.js` (17.78 kB) cambia de hash; `react-vendor` (60.29 kB) se mantiene cacheado → el returning user re-baja ~18 kB en vez de ~78 kB. `index.html` sumó un `modulepreload` (+0.08 kB) para react-vendor.

### Detalle de implementación — #6 fix del flash gris→imagen

(UX/perf percibida, no bundle.) Decisión final: **(A) gate + (B) fade**, con el refinamiento de gatear **solo MainScreen** (las demás superficies de `FondoLocal` ya tienen la foto en cache al llegar → gatearlas sería no-op + riesgo de parpadeo sobre sus animaciones de entrada). Todo centralizado en `FondoLocal`:

- **B (fade, siempre):** `new Image()` detecta el `onload` (un `background-image` de CSS no lo expone) y de paso calienta el cache; la capa foto+velo hace fade-in de opacidad al cargar → mata el snap.
- **A (telón, solo `esperarImagen`):** capa gris (`surfaceAlt`, `zIndex:10`) por encima del contenido que se desvanece al cargar la foto (detrás ya está pintada → la pantalla entra completa). **No envuelve a los hijos** → cero riesgo para el centrado/posicionamiento absoluto de MainScreen. **Timeout 2500 ms** para no bloquear nunca la entrada. Respeta `prefers-reduced-motion` (sin transición).
- **`fotosCargadas` (Set a nivel módulo):** recuerda las URLs ya bajadas en la sesión → re-entrar a MainScreen o entrar a un flujo **no** re-muestra el telón ni re-hace el fade (clave: el operativo vuelve a MainScreen decenas de veces al día).
- **Props nuevos de `FondoLocal`:** `esperarImagen` (gate, default `false` → solo MainScreen lo activa) y `blurPx` (default 4; el login operativo usa **10**, sensación de "bloqueo").
- **Precarga temprana (`App.jsx`):** `new Image()` de foto+logo apenas se conocen las URLs → cubre el camino del **device ya logueado** (que no pasa por el login): la foto baja en paralelo con el spinner de catálogos.
- **Login operativo migrado a `FondoLocal`** (blur 10): antes tenía un fondo propio **nítido sin blur** (implementación divergente). Ahora comparte el fondo (consistencia visual), mata su propio snap, y se vuelve el **punto de precarga** del camino deslogueado. El form va dentro de un overlay `overflowY:auto` (`margin:auto`) para **no recortarse con el teclado del iPad** (restaura el `overflow:auto` que tenía antes y que `FondoLocal` —`overflow:hidden`— no da).
- **`PantallaCargando` ambiental:** con foto, el spinner (blanco) vive sobre `FondoLocal` (foto ya cacheada) → la transición **login → carga → MainScreen** queda continua sobre la foto, sin el flash blanco del medio. Sin foto (boot frío sin URL aún, o el Suspense del panel admin que entra a un dashboard claro) cae al contenedor de boot claro.
- **Mercado Pago:** precarga de `/mercadopago.png` (asset estático del paso de pago de los 3 flujos) desde MainScreen —el hub del que se entran— con `new Image()`. **No** `<link rel=prefetch>` porque Safari/iPad no lo soporta de forma confiable.
- **Favicon:** `index.html` → `/vite.svg` (placeholder que existe, sin 404); `App.jsx` (`actualizarFavicon`) lo cambia al logo del tenant al conocerlo. Mata la request muerta `logo_kingsai_graffiti.jpeg` del favicon (ver Deuda detectada por el residual en `manifest.json`).
- **Verificación (preview, 2026-06-10):** MainScreen entra ya con la foto (sin gris→snap); el tramo login→carga→main queda continuo sobre la foto (sin flash blanco). Bundle intacto; `index.js` propio 17.78 → ~18.2 kB gzip (+0.4, despreciable).
- **Archivos:** `frontend/src/components/ui/FondoLocal.jsx`, `frontend/src/screens/MainScreen.jsx`, `frontend/src/App.jsx`, `frontend/src/screens/PantallaLoginOperativo.jsx`, `frontend/index.html`.

### Detalle de implementación — #5 Cache-Control de imágenes

**Cambio de código (1 línea):** `backend/src/services/storageService.js` → `subirImagen` ahora sube con `{ contentType: 'image/webp', cacheControl: '31536000' }` (1 año en segundos). Seguro porque la URL es content-addressed por UUID (`construirPath` genera un UUID nuevo en cada subida, incluso al reemplazar un slot) → la imagen de esa ruta nunca cambia. Default de Supabase = '3600' (1 h).

**`immutable` — descartado tras verificar:** el header servido quedó `public, max-age=31536000`, **sin `immutable`** (Supabase no lo agrega solo; el SDK toma `cacheControl` como número de segundos y sirve `public, max-age=<n>`). Se decidió no perseguirlo: el `max-age` de 1 año ya es el grueso del beneficio; `immutable` solo ahorra una revalidación 304 en reload suave (F5), marginal para el cliente del turnero, y forzarlo exigiría un valor no-numérico hacky (`'31536000, immutable'`) de comportamiento incierto en Supabase. Micro-follow-up opcional.

**Backfill (`backend/src/scripts/backfillCacheControl.js`, nuevo):** el cambio solo aplica a subidas **nuevas**; las existentes siguen en `3600`. Supabase free tier no expone cambiar solo el header sin re-subir el contenido → el script lee `SELECT storage_path FROM tenant_imagen` y por cada objeto hace `download` → `update(path, buffer, { contentType:'image/webp', cacheControl:'31536000' })` (misma ruta/UUID → misma URL pública → no toca la DB; el re-upload purga el CDN). Best-effort por imagen + resumen; idempotente. **Auto-acotado:** solo procesa lo que hay en `tenant_imagen` (hoy = solo demo; post-merge cubrirá kingsai cuando migre, sin filtro de `tenant_id`). Uso: `cd backend && node src/scripts/backfillCacheControl.js`.

**Verificación (prod, 2026-06-10, demo `aaaaaaaa-…-002`):**
- Subida nueva (local + logo) vía admin de demo → GET del header = `public, max-age=31536000`. ✅ Confirma el cambio de código.
- Backfill corrido: `OK: 2 | Fallidas: 0 | Total: 2`; re-check post-backfill sigue `max-age=31536000` → valida el camino `download`+`update` end-to-end (código distinto al de `subirImagen`).
- ⚠️ **No se pudo mostrar el contraste `3600`→`31536000`** en demo: sus únicas 2 imágenes (local+logo) ya se habían reemplazado con el código nuevo (ya en 1 año) y no hay imágenes de corte. El default `3600` de las viejas está documentado en el §4.3 (medición previa). El backfill tendrá trabajo real **post-merge** (kingsai).

**Lección de medición — `curl -I` (HEAD) miente sobre Storage:** Supabase Storage devuelve `Cache-Control: no-cache` en **todo** request HEAD, enmascarando el header real (dio `no-cache` igual en viejas y nuevas). El header real solo se ve con **GET**. Comando correcto: `curl.exe -s -o NUL -D - "<url>" | Select-String cache-control` (descarta el body, vuelca los headers). Mismo tipo de trampa que medir en iPad (§4.2): la herramienta de medición cambió el resultado.

### Deuda detectada (no-perf, a confirmar)
- **Manejo de error de carga de chunk lazy (transversal).** Bajar un chunk lazy puede fallar: caída de red a mitad de sesión, o (lo más común) un hash de archivo viejo en el HTML cacheado tras un redeploy. Hay **dos caminos distintos** y se tratan distinto:
  - **Render-path (`React.lazy` de secciones + panel, #7):** un componente lazy que no baja tira el error en el render → lo agarra un **error boundary**. ✅ **Resuelto (2026-06-10):** primitivo nuevo `frontend/src/components/ui/ErrorBoundary.jsx` que distingue chunk-load-error (→ `window.location.reload()` **una sola vez**, guardado por timestamp en `sessionStorage` para no loopear si el chunk de verdad no existe; un redeploy posterior, fuera de la ventana, sí puede re-auto-sanar) de un bug real (→ `EmptyState` tone danger + "Reintentar"). Se envuelve el `<Suspense>` de las secciones (scope = área de contenido, el sidebar sobrevive) y el de `PanelAdmin` en `App.jsx`.
  - **Handler-path (`await import('xlsx')` dentro de un `onClick`, #3):** un error boundary de render NO lo agarra — la promesa rechaza fuera del ciclo de render de React → *unhandled rejection* y el botón "no hace nada" en silencio. ✅ **Resuelto (2026-06-10):** helper compartido `frontend/src/utils/cargarChunk.js` — `cargarChunk(importFn, etiqueta)` envuelve el `import()` dinámico, loguea `[cargarChunk]` y re-lanza un `Error` con `.message` apto para el usuario. Los **6 handlers** de xlsx (Ventas, Gastos, Balances, Caja→`TabMovimientos`, Planillas→`exportarDetalle`+`exportarResumen`) envuelven **solo el import** en try/catch (el armado del Excel queda afuera, para que un bug de armado no se disfrace de error de carga) y surfacean el mensaje con un `<Toast tone="danger">` local (estado `errorExport`). **El Toast NO se pudo centralizar** (el primitivo es render-state, no flotante global — lo renderiza cada componente desde su estado); sí se centralizó el import + log + mensaje. **Sin retry** (decisión): el caso más común —hash viejo post-redeploy— 404ea permanente hasta una recarga completa, que reintentar la misma URL no cura; por eso el mensaje guía a recargar en vez de auto-recargar (auto-recargar volaría ediciones sin guardar). El `import()` de browser-image-compression (#4) ya estaba cubierto por su try/catch + Toast. **Verificado (preview, F12):** bloqueando el request del chunk `xlsx-*.js`, Exportar muestra el Toast de error en vez del silencio. Build verde, code-split de xlsx intacto (142.94 kB gzip diferido); `cargarChunk` quedó como micro-chunk compartido (0.75 kB gzip) sin tocar el bundle inicial (`index.js` 18.21 kB gzip).
- **`logo_kingsai_graffiti.jpeg`** devuelve `text/html` (request muerta, §3). Estaba referenciado en **dos** lados, ambos a un archivo inexistente en `public/`: `index.html` (favicon, **resuelto en #6**) y `frontend/public/manifest.json` (ícono). ✅ **Manifest resuelto (2026-06-10):** `frontend/public/manifest.json` neutralizado — (1) se **quitó el array `icons`** (mata el 404; no hay un ícono PWA neutro en `public/` y embarcar `vite.svg` —logo de Vite— sería peor que no tener ícono; micro-follow-up: agregar un PNG 192/512 maskable cuando haya un mark de BarberManager diseñado); (2) **branding genérico del producto** (`name`/`short_name` = "BarberManager", `description` neutra) en vez del "Kingsai" hardcodeado; (3) **`theme_color` → indigo `#4F46E5`** (`theme.accent`) en vez del verde `#1a7a4a` (acento viejo). Un manifest estático no puede ser por-tenant sin generación server-side → neutralizar era lo realista. **Verificado (preview, F12):** Application→Manifest sin error de ícono ni branding Kingsai; Network sin el 404 del `.jpeg`.
- **Aplanar la cadena (factor 5):** ¿se puede arrancar `imagenes`/`servicios` antes, o devolver más en una sola respuesta del bootstrap?

---

## 8. Puntos de entrada para ejecutar (archivos exactos — para chats nuevos en frío)

> Cada ítem del §7 con su(s) archivo(s) y función(es). Las líneas son aproximadas (pueden correrse) — ubicar por nombre de función. **Recordar:** branch `feature/turnero`; medir sobre build de prod + `vite preview` (no `dev`); verificar cada ahorro re-buildeando/re-midiendo.

**#1 — Keep-alive del pool + anti-sleep Railway** — ✅ **Código hecho (2026-06-10)**: `db.js` con `keepAlive:true` + `iniciarKeepAlive(20000)` (`SELECT 1`, `.unref()`, tolerante a fallos), llamado desde `index.js`. **Parte B (anti-sleep) descartada**: el proceso no duerme (§5-bis). Falta deployar + validar impacto post-merge.
- Pool: `backend/src/config/db.js` (`new Pool({ max:3, idleTimeoutMillis:30000, ... })`, sin `min`, sin keepAlive).
- ⚠️ **Gotcha:** `idleTimeoutMillis:30000` cierra la conexión a los 30 s. Un ping de keep-alive debe correr a **intervalo < idleTimeout** (ej. cada 20–25 s) para servir, **o** subir `idleTimeoutMillis`. Un ping cada 5 min NO mantiene la conexión con el timeout actual.
- Dónde colgar el ping: `backend/src/index.js` (al levantar el server), p.ej. `setInterval(() => query('SELECT 1'), ...)`. Evaluar también `keepAlive:true` en el Pool (TCP, complementario).
- Anti-sleep Railway: pinger externo (UptimeRobot/cron-job.org) a un endpoint de salud, o la infra de cron existente. Confirmar primero si el plan de Railway realmente duerme.

**#2 — Paralelizar `getTenant`** — ✅ **Código hecho (2026-06-10).**
- `backend/src/controllers/turnero.js` → `getTenant`: el `tenant` sigue primero y solo (para el 404); `obtenerHorarioCrudo` + `obtenerFeriados` (independientes, solo dependen de `tenant_id`) pasaron a `Promise.all` → 2 RTTs a la DB en vez de 3 en serie. El front no cambia (misma respuesta JSON). Las queries en paralelo son seguras con el pooler (el bootstrap de gestión ya dispara hasta 6 concurrentes, §5-bis). Impacto a validar post-merge en prod (§5-bis: probablemente marginal).

**#3 — Lazy-load `xlsx`** — ✅ **Hecho (2026-06-10).** (¡son **5 archivos**, no 1!)
- `frontend/src/screens/admin/sections/`: `SeccionVentas.jsx`, `SeccionGastos.jsx`, `SeccionBalances.jsx`, `SeccionCaja.jsx` (handler dentro de `TabMovimientos`), `SeccionPlanillas.jsx` (**2 handlers**: `exportarDetalle` + `exportarResumen` → 6 handlers en total). Se sacó el `import * as XLSX from 'xlsx'` top-level de cada uno y se puso `const XLSX = await import('xlsx')` dentro del handler (vuelto `async`). En Planillas, la línea va **después** del early-return para no bajar el chunk en un export vacío. Rollup dedupea los 6 → 1 solo chunk xlsx compartido. Resultado medido en el §7 ("Resultado medido"). Verificado con `xlsx` greppeado en todo `frontend/src`: 0 imports top-level restantes.
- **Manejo de error de carga (residual cerrado 2026-06-10):** los 6 handlers ahora hacen `await cargarChunk(() => import('xlsx'), 'xlsx')` (helper `frontend/src/utils/cargarChunk.js`) dentro de try/catch + `<Toast>` local (estado `errorExport`). Ver §7 "Deuda detectada" para el detalle y la verificación.
- Interacción con #7: el code-split de secciones difiere xlsx hasta **abrir** la sección; #3 lo difiere hasta el **click** de exportar. #3 sigue valiendo aunque se haga #7, y es más fácil.

**#4 — Lazy-load `browser-image-compression`** — ✅ **Hecho (2026-06-10).** (1 archivo)
- `frontend/src/screens/admin/sections/gestion/BloqueImagenes.jsx`: se sacó `import imageCompression from 'browser-image-compression'` (L11) y se puso `const { default: imageCompression } = await import('browser-image-compression')` dentro del handler `handleArchivo` (ya `async`), en el `try` y después del early-return. Es **default export** (por eso se desestructura `default`). El `try/catch` con `Toast` ya existente cubre la falla de carga del chunk. Resultado medido en el §7 ("Detalle de implementación — #4").

**#5 — Cache-Control de imágenes** — ✅ **Hecho y verificado en prod (2026-06-10).**
- `backend/src/services/storageService.js` → `subirImagen`: el `.upload(...)` pasó a `{ contentType:'image/webp', cacheControl:'31536000' }` (1 año en segundos). Default de Supabase era '3600'. Header servido verificado por GET: `public, max-age=31536000` (sin `immutable` — ver §7 "Detalle … #5").
- **Backfill:** `backend/src/scripts/backfillCacheControl.js` (nuevo). Lee `SELECT storage_path FROM tenant_imagen` y por cada objeto `download` → `update(path, buffer, { cacheControl:'31536000' })`. Idempotente, best-effort, auto-acotado a lo que haya en `tenant_imagen`. Corrida en demo: OK 2/2. Uso: `cd backend && node src/scripts/backfillCacheControl.js`. Tendrá trabajo real post-merge (kingsai migrando a `tenant_imagen`).
- ⚠️ Medir headers de Storage con **GET** (`curl -s -o NUL -D -`), no con `-I`/HEAD (devuelve `no-cache` siempre). Detalle y verificación en §7 ("Detalle de implementación — #5").

**#6 — Fix flash gris→imagen** — ✅ **Hecho y verificado en preview (2026-06-10).** (UI → `docs/sistema_de_disenio.md` leído)
- `frontend/src/components/ui/FondoLocal.jsx`: preload con `new Image()` + fade-in del fondo (B) + telón/gate (A, prop `esperarImagen`) + prop `blurPx`; `Set` `fotosCargadas`; `prefers-reduced-motion`; timeout 2500 ms.
- `frontend/src/screens/MainScreen.jsx`: `esperarImagen` (gate solo acá) + precarga de `/mercadopago.png` (`new Image()`).
- `frontend/src/App.jsx`: precarga de foto+logo (`new Image()`); `PantallaCargando` sobre `FondoLocal` cuando hay foto; favicon dinámico al logo del tenant (`actualizarFavicon`).
- `frontend/src/screens/PantallaLoginOperativo.jsx`: migrado a `FondoLocal` (blur 10) + overlay `overflowY:auto` (anti-recorte por teclado del iPad).
- `frontend/index.html`: favicon → `/vite.svg` (placeholder, sin 404).
- `frontend/public/manifest.json`: neutralizado (sin `icons` → sin 404; branding BarberManager; `theme_color` indigo). Cierra el residual de `logo_kingsai_graffiti.jpeg`. Ver §7 "Deuda detectada".
- Detalle completo en §7 "Detalle de implementación — #6".

**#7 — Code-split `src/screens`** — ✅ **Hecho (2026-06-10).** Opción B (2 boundaries).
- `frontend/src/screens/admin/PanelAdmin.jsx`: los 8 `import` de sección pasaron a `lazy(() => import('./sections/...'))`; render envuelto en `<ErrorBoundary key={seccionActiva}><Suspense fallback={<LoadingState/>}>`.
- `frontend/src/App.jsx`: `import PanelAdmin` pasó a `lazy()`; render envuelto en `<ErrorBoundary><Suspense fallback={<PantallaCargando/>}>`.
- Nuevo primitivo `frontend/src/components/ui/ErrorBoundary.jsx` (+ barrel) — maneja chunk-load-error con auto-reload guardado. Detalle y medición en §7 ("Detalle de implementación — #7").

**#8 — `manualChunks`** — ✅ **Hecho (2026-06-10).**
- `frontend/vite.config.js` → `build.rollupOptions.output.manualChunks(id)` devuelve `'react-vendor'` para `node_modules/{react,react-dom,scheduler,react-is}/`. Medición en §7 ("Detalle de implementación — #8").

---

*— Documento vivo. Última actualización: 2026-06-10 —*
