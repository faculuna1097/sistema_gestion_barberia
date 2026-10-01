# Plan — Landing recomendable por IA + analytics

> **Doc de trabajo** (abierto el 2026-10-01, branch `feature/landing-ia`). Es la fuente de
> verdad del diseño mientras dura la implementación: todos los chats que ejecutan un paso leen
> este doc. Al cerrar (paso 5) se resume en `decisiones_landing_ia.md` y este se borra.
>
> **Las decisiones de §2 están cerradas.** Si al implementar algo no cierra, se frena y se
> reporta; no se redecide en el chat que ejecuta.

---

## 1. Problema

La landing (`/frontend-landing`, `barbermanager.app`) es una SPA pura: el servidor devuelve un
HTML de 1.412 bytes con `<div id="root"></div>` vacío y React arma todo en el navegador. Los
crawlers de IA (GPTBot, ClaudeBot, PerplexityBot) no ejecutan JavaScript: para ellos
BarberManager es solo el `<title>` y la `meta description`. No ven precio, país, FAQ ni
funciones.

En producción también dan 404 `robots.txt`, `sitemap.xml`, `llms.txt` y `og-image.png`
(esta última la referencia el `index.html`). Y no hay forma de saber quién visita la página.

Objetivo:
1. Que buscadores y crawlers de IA reciban todo el contenido en el HTML.
2. Que el contenido responda lo que una IA necesita para recomendar: país, precio en pesos,
   qué incluye y en qué se diferencia de Setmore, Fresha y Booksy.
3. Medir las visitas.

La página bien hecha es condición necesaria, no suficiente: los LLMs también pesan las
menciones fuera del sitio (directorios, reseñas, redes). Eso va en la guía del paso 5.

---

## 2. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Pre-renderizado con script propio** (patrón SSG de Vite): en el build se genera el HTML completo y React hidrata encima. Sin framework nuevo ni dependencias. | Es una sola página. Migrar a Astro o Next.js sería sobredimensionado. |
| D2 | **Responsive por CSS** en lo que depende del viewport: unas pocas clases en `index.css` y flex-wrap inline donde alcance. Es una excepción a "sin clases CSS globales" que aplica solo a la landing. | El HTML se genera sin conocer el dispositivo. Con `useIsDesktop` el HTML saldría con layout mobile y en desktop saltaría al hidratar, con error de hidratación. |
| D3 | **`Reveal`:** el contenido va visible en el HTML y la animación se aplica solo con JS activo. | Si el JS tarda o falla, el contenido se ve igual. El Hero pinta en el primer frame. |
| D4 | **FAQ con `<details>`/`<summary>` nativo.** | La respuesta queda siempre en el HTML (hoy solo existe con el acordeón abierto). Funciona antes de hidratar y es accesible por defecto. |
| D5 | **Vercel Web Analytics, plan Hobby,** sin eventos de clic. | El proyecto ya está en Vercel. No usa cookies, así que no hace falta banner. Los clics de WhatsApp igual llegan como mensajes. Límites: 50k eventos/mes, ventana de 1 mes, sin UTM. |
| D6 | **Mercado: solo Argentina.** Precio: **$30.000 ARS/mes** (antes $40.000), barberos ilimitados, primer mes gratis. | Decisión de negocio (2026-10-01). |
| D7 | **Mensaje central:** BarberManager es un **sistema de gestión completo** (caja, ventas, gastos, planillas, balances), no solo una agenda de turnos. Turnero online y app de barberos incluidos, a precio fijo en pesos. Puntos de apoyo: barberos ilimitados y el precio. | Setmore, Fresha y Booksy se conocen como apps de turnos. Los dolores reales de los dueños que las usan son el precio y el límite de barberos, que son el terreno del turnero. |
| D8 | **Comparación con Setmore, Fresha y Booksy: solo nuestros puntos fuertes.** Cada afirmación sobre un competidor tiene que ser verdadera y estar fechada. Si no se puede verificar, no va. | Credibilidad y seguridad legal. |
| D9 | **Una sola fuente de datos:** `config/landing.js` y `src/content/*` alimentan la UI, el JSON-LD y el `llms.txt`. | Cambiar el precio o una respuesta en un solo lugar actualiza todo. |
| D10 | **El JSON-LD lo inyecta el script de pre-render en el `<head>`.** No va al bundle del cliente. | Solo sirve en el HTML estático: en el bundle sería JS de más. |
| D11 | **`og-image` generada desde una plantilla HTML** capturada con Edge headless. La plantilla se versiona. | Usa la captura real de Planillas y se puede regenerar si cambia la marca. |

Descartado:
- Astro y Next.js.
- Google Analytics 4: cookies, banner y peso.
- Umami: no hacen falta eventos.
- FAQ con el atributo `hidden`: algunos extractores de texto descartan el contenido oculto.
- `robots.txt` con una lista de bots: equivale al comodín.
- Uruguay como mercado.
- Mail con dominio propio: se mantiene el gmail.

---

## 3. Estado actual (punto de partida para los ejecutores)

- Vite 8 + React 19, one-pager sin router. Estilos inline + tokens (`src/theme/tokens.js`).
  `index.css` solo tiene reset, la carga de Geist (Google Fonts) y keyframes.
- Deploy: proyecto Vercel propio, auto-deploy en push a `main`, sin `vercel.json`.
- Datos editables centralizados en `src/config/landing.js`: `MARCA`, `CONTACTO`, `PRECIO`,
  `FLAGS`, `CAPTURAS` y `VIDEOS`. Formato de montos: `fmtPesos` en `src/utils/formato.js`.
- Responsive con JS: `useIsDesktop` (`src/hooks/useMediaQuery.js`). Lo usan `LandingNav`,
  `MobileCtaBar`, `FlowDiagram` y `SplitFeature`.
- `Reveal` arranca en `opacity: 0` y se revela con `IntersectionObserver`.
- `FaqItem` es un acordeón con `useState`: la respuesta solo se monta si está abierto.
- `LandingFooter` calcula el año con `new Date()` en el render.
- `npm run lint` falla con 2 errores de `react-hooks/set-state-in-effect`: `Reveal.jsx:26` y
  `useMediaQuery.js:32`.

---

## 4. Contratos por paso

### Paso 1 — Vercel Web Analytics + precio (orquestador)

- `PRECIO.mensual`: `40000` → `30000` en `src/config/landing.js`. Es el único lugar donde está.
- `npm i @vercel/analytics` y `<Analytics />` (import de `@vercel/analytics/react`) en
  `src/App.jsx`.
- **Usuario, antes del deploy:** Vercel → proyecto de la landing → Analytics → Enable. Las
  rutas `/_vercel/insights/*` se habilitan en el deploy siguiente.
- **Push:** lo decide el usuario. Está demorando otros deploys: el `main` local tiene commits
  sin pushear de movimientos extra y modales. Cuando vaya a pushear `main`, se mergea antes el
  branch hasta el paso 1, así salen también el precio nuevo y el analytics. Hasta entonces no
  hay medición. Si el paso 2 llega a producción después que el 1, el usuario saca antes una
  captura del panel (la ventana es de 1 mes).

### Paso 2 — Pre-renderizado (chat aparte)

Objetivo: `dist/index.html` contiene el HTML completo de la página y React hidrata encima sin
errores de hidratación. Sin dependencias nuevas.

- `src/entry-server.jsx`: exporta `render()` →
  `renderToString(<StrictMode><App /></StrictMode>)` de `react-dom/server`.
- `scripts/prerender.js` (Node, ESM):
  - lee `dist/index.html`;
  - importa el bundle SSR;
  - inyecta el HTML dentro de `<div id="root">`;
  - escribe `dist/index.html`;
  - borra el bundle SSR temporal, que no se publica. `dist-ssr` va al `.gitignore`.
- `package.json` →
  `"build": "vite build && vite build --ssr src/entry-server.jsx --outDir dist-ssr && node scripts/prerender.js"`.
- `src/main.jsx`: `hydrateRoot` en lugar de `createRoot().render()`.
- **D2:**
  - anclas y CTA del nav, `MobileCtaBar` y dirección y flechas de `FlowDiagram`: por CSS;
  - `SplitFeature`: con flex-wrap inline si alcanza (con `reverse` en desktop y el texto
    primero en mobile);
  - `useMediaQuery.js` se elimina si queda sin uso.
- **D3:**
  - un script inline en el `<head>` agrega la clase `js` a `<html>`;
  - `index.css` oculta y anima los `Reveal` solo bajo `.js`;
  - `prefers-reduced-motion` se resuelve por CSS;
  - el Hero no se oculta.
- **D4:** `FaqItem` con `<details>`/`<summary>`. El chevron rota por CSS (`details[open]`).
- **Nada que dependa del entorno durante el render.** `window` y `document` se usan solo en
  efectos. El año del footer sale de una constante inyectada en el build (`define` de Vite), que
  comparten los dos bundles: con `new Date()`, en enero el HTML del build y el cliente no
  coincidirían.
- Lint en verde en la landing.

Verificación (el ejecutor, sin levantar servidores):
- `npm run build` y `npm run lint` limpios.
- `dist/index.html` contiene:
  - el h1 y los títulos de sección;
  - las preguntas **y respuestas** de la FAQ;
  - el precio como `$30.000`. Si sale `$30,000`, el Node del build no tiene ICU completo.
- Queda para el usuario, con `npm run preview` en desktop y mobile:
  - sin errores de hidratación en consola y sin salto de layout;
  - anclas, FAQ, videos y animaciones de entrada funcionando.

### Paso 3a — Investigación y copy (orquestador)

- Relevar Setmore, Fresha y Booksy desde fuentes oficiales: precio y moneda para Argentina,
  modelo de cobro (por barbero o por plan), límites de equipo, comisiones, qué tanto cubren la
  gestión del negocio e idioma. Cada dato con fuente y fecha.
- Borrador para que el usuario lo apruebe:
  - title y meta description mencionando Argentina;
  - bloque "para quién es";
  - FAQ ampliada: precio en pesos, barberos incluidos, cómo se cancela, soporte, país y
    diferencias con Setmore, Fresha y Booksy;
  - tabla comparativa y dónde va en la página;
  - rótulo "datos de ejemplo" en las métricas de `SistemaGestion`;
  - unificar "lo configurás en minutos" (Hero) con "te ayudamos a configurarlo";
  - "Ipad" → "iPad".
- El resultado va a §5 de este doc.

### Paso 3b — Implementar el contenido (chat aparte)

- Implementa §5.3 a §5.6. El "para quién es" quedó como FAQ 6, y la tabla comparativa como el
  bloque de 4 puntos de §5.4: con datos verificables solo daba para 2 filas.
- La FAQ y el bloque de §5.4 viven en módulos de datos (`src/content/faq.js` y
  `src/content/alternativas.js`), que lee la UI y van a leer el JSON-LD y el `llms.txt` del
  paso 4b.
- El bloque de §5.4 reusa `FeatureCard` (hoy sin uso). A 375 px, sin scroll horizontal de
  página. Sigue `sistema_de_disenio.md`.
- Verificación: build + lint + textos nuevos en `dist/index.html`.

### Paso 4a — `og-image` (orquestador)

- 1200 × 630 px, menos de 300 KB, en `public/og-image.png`.
- Contenido: captura real de Planillas + logo + "BarberManager" + una frase corta. Lo esencial
  va al centro, con unos 80 px de margen: WhatsApp a veces la recorta en cuadrado.
- La plantilla queda en `scripts/og-image.html` y se captura con Edge headless.

### Paso 4b — Rastreo y datos estructurados (chat aparte)

- `public/robots.txt`: `User-agent: *` / `Allow: /` + `Sitemap: https://barbermanager.app/sitemap.xml`.
- `public/sitemap.xml`: una URL (`https://barbermanager.app/`).
- `index.html`:
  - canonical;
  - `og:image` (+ width, height y alt);
  - `og:locale` = `es_AR`;
  - `<html lang="es-AR">`;
  - title y description aprobados en 3a.
- JSON-LD (D10): `Organization` + `SoftwareApplication` (`offers` en ARS, desde `PRECIO`) +
  `FAQPage`, que tiene que ser idéntica a la FAQ visible.
- `llms.txt` generado en el build desde las mismas fuentes (D9) → `dist/llms.txt`.
- Verificación: build; `dist/` contiene robots, sitemap y `llms.txt`; JSON-LD válido en
  validator.schema.org.

### Paso 5 — Cierre (orquestador + usuario)

- Docs:
  - `estado_actual.md`;
  - `convenciones_tecnicas.md` §10: la landing deja de ser CSR pura;
  - `sistema_de_disenio.md`: excepción CSS de la landing;
  - `ruta_proyecto.md`;
  - este doc se resume en `decisiones_landing_ia.md`, que se suma al mapa de `CLAUDE.md`.
- Merge `--no-ff` a `main` + push (usuario).
- Verificación en producción (§7).
- Guía fuera del sitio para el usuario:
  - Google Search Console (verificación DNS en Namecheap) + sitemap;
  - Bing Webmaster Tools, importando desde Search Console (la búsqueda de ChatGPT se apoya en
    Bing);
  - directorios de software;
  - bio de Instagram.

---

## 5. Contenido aprobado

Aprobado por el usuario el 2026-10-01 (paso 3a). Los textos que mencionan el precio se arman
desde `PRECIO` (`config/landing.js`), nunca con el número escrito (D9).

### 5.1 Relevamiento de la competencia (01/10/2026)

Fuentes: páginas de precios oficiales, abiertas desde Argentina.

| | Precio | Moneda | Notas |
|---|---|---|---|
| Fresha ([precios](https://www.fresha.com/es/pricing)) | Independiente 8.000 ARS/mes (1 profesional). Equipo 5.300 ARS por miembro reservable/mes. Más impuestos | ARS | Sistema completo: punto de venta, inventario, informes (incluye ingresos y gastos), comisiones y sueldos (plan Equipo). Complementos pagos (Insights, Xero, etc.). Tarifa única por cliente nuevo que llega por su marketplace |
| Booksy ([precios](https://biz.booksy.com/pricing)) | US$29,99/mes + US$20 por miembro adicional. Más impuestos | USD | Todo incluido. Boost opcional: 30% de la primera visita del cliente nuevo (tope US$100) |
| Setmore ([precios](https://www.setmore.com/pricing)) | Gratis hasta 4 usuarios. Pro: US$5/usuario/mes (anual) o US$12 (mensual) | USD | Agenda y cobros. No figuran comisiones ni gastos |

Consecuencias para el copy:
- El precio **no** se compara con números: Fresha sale más barato hasta unos 5 barberos y Setmore
  es gratis hasta 4 usuarios.
- Fresha también tiene gestión (caja, comisiones, gastos): no se afirma que falte.
- Lo verificable: (1) los tres cobran según el tamaño del equipo y BarberManager es precio fijo
  con barberos ilimitados; (2) Booksy y Setmore cobran en dólares. El resto se afirma solo sobre
  BarberManager.

### 5.2 Cabecera (paso 4b)

- **title:** BarberManager — Sistema de gestión y turnos para barberías en Argentina
- **meta description:** Turnero online, app para barberos, caja, gastos, planillas y balance del
  mes en un solo sistema, con barberos ilimitados. Hecho para barberías de Argentina. Primer mes
  gratis.

### 5.3 Hero — subtítulo

> El sistema de gestión para barberías de Argentina: turnero online, caja, barberos y números,
> todo conectado. Sin planillas sueltas ni el WhatsApp desbordado. Te ayudamos a configurarlo y
> trabajás ordenado desde el primer día.

### 5.4 Bloque "¿Y frente a otras apps de turnos?"

Va dentro de la sección Comparación, debajo de las dos columnas del antes y después.

1. **No pagás por barbero.** Fresha, Booksy y Setmore cobran según cuántos miembros tenga tu
   equipo. En BarberManager el precio es fijo: sumás todos los barberos que quieras sin pagar más.
2. **En pesos, sin sorpresas con el dólar.** Booksy y Setmore cobran en dólares. BarberManager se
   paga en pesos.
3. **Todo en el mismo precio.** Turnero online, app para barberos, caja, gastos, planillas de cada
   barbero y balance del mes. Sin complementos pagos.
4. **Te acompañamos.** Te ayudamos a dejar todo configurado y te atendemos por WhatsApp.

Nota al pie: *Datos de Fresha, Booksy y Setmore según sus páginas de precios oficiales al 1 de
octubre de 2026.*

### 5.5 FAQ (11 preguntas, en este orden)

1. **¿Qué es BarberManager?** Un sistema de gestión para barberías de Argentina. Junta el turnero
   online para tus clientes, la app de cada barbero y el panel donde cargás cortes, ventas y
   gastos y ves la caja del día, las planillas y el balance del mes.
2. **¿Cuánto cuesta?** El primer mes es gratis. Después, {precio} por mes con todo incluido, sin
   importar cuántos barberos tengas. Sin contrato: cancelás cuando quieras.
3. **¿Hay límite de barberos?** No. Cargás todos los que tengas sin pagar más. Cada uno tiene su
   agenda, sus horarios y sus días libres, y vos ves todo el local junto.
4. **¿Qué incluye el sistema de gestión?** Registro de cortes, ventas y gastos; caja del día
   separada en efectivo y Mercado Pago; planillas semanales y mensuales con lo que le toca a cada
   barbero (comisión y propinas), exportables a Excel; y el balance del mes con la ganancia, los
   aportes y los retiros.
5. **¿En qué se diferencia de Fresha, Booksy o Setmore?** Esas apps cobran según la cantidad de
   miembros del equipo, y Booksy y Setmore en dólares. BarberManager cobra un precio fijo en pesos
   con barberos ilimitados, e incluye turnero, app para barberos y la gestión del negocio.
6. **¿Para qué barberías sirve?** Para barberías de Argentina de cualquier tamaño, desde un
   barbero solo hasta equipos grandes, que hoy toman turnos por WhatsApp y llevan la caja en papel
   o en Excel.
7. **¿Sirve si tengo varias sucursales?** Cada suscripción cubre un local. Si tenés varias
   sucursales, cada una funciona con su propia suscripción.
8. **¿Cómo reservan mis clientes?** Con un link que compartís en Instagram o WhatsApp. El cliente
   elige barbero, servicio y horario, recibe la confirmación al instante y un recordatorio por
   email la noche anterior.
9. **¿Necesito instalar algo? ¿Funciona en el celular?** No instalás nada: funciona desde el
   navegador. El turnero y la app del barbero andan en el celular; el panel de gestión está pensado
   para iPad, tablet o computadora.
10. **¿Qué pasa con mis datos?** Son tuyos. Quedan guardados de forma segura, los consultás cuando
    quieras y podés exportar las planillas a Excel.
11. **¿Cómo empiezo?** Nos escribís por WhatsApp o email, damos de alta tu barbería y arrancás el
    primer mes gratis. Te ayudamos a cargar barberos, servicios y horarios.

`{precio}` = `fmtPesos(PRECIO.mensual)`.

### 5.6 Otros ajustes

- **Métricas de `SistemaGestion`:** debajo de las tarjetas, el rótulo *"Números de ejemplo:
  muestran cómo se ve, no son de una barbería real."*
- **Plan → "Qué incluye":** sumar *"Barberos ilimitados, sin costo extra"* (después de "Turnero
  online para tus clientes").

---

## 6. Pasos y estado

| # | Paso | Dónde | Estado |
|---|---|---|---|
| 0 | Branch `feature/landing-ia` + este doc | orquestador | ✅ 2026-10-01 |
| 1 | Vercel Web Analytics + precio a $30.000 | orquestador | ✅ 2026-10-01 (sin pushear) |
| 2 | Pre-renderizado | chat aparte | ✅ 2026-10-01 |
| — | Imágenes: la captura del Hero reserva su espacio, posters lazy | orquestador | ✅ 2026-10-01 |
| 3a | Investigación de competidores + copy | orquestador | ✅ 2026-10-01 |
| 3b | Implementar el contenido | chat aparte | 🔲 |
| 4a | `og-image` | orquestador | 🔲 |
| 4b | robots, sitemap, meta, JSON-LD, `llms.txt` | chat aparte | 🔲 |
| 5 | Docs, merge, verificación en producción, guía fuera del sitio | orquestador | 🔲 |

### Cómo se ejecuta

Un chat orquesta (diseño, prompts, revisión del diff) y cada paso de código se ejecuta en un
chat aparte, en esta misma carpeta y branch. Al terminar, ese chat entrega un reporte con:

1. Archivos creados y modificados.
2. Desvíos respecto del prompt y por qué.
3. Qué se verificó, con qué resultado, y qué no se pudo verificar.
4. Dudas o decisiones que quedaron abiertas.
5. Cosas vistas de paso, verificadas contra los docs.
6. Mensaje de commit propuesto.

---

## 7. Verificación de punta a punta (producción)

1. `curl -A "GPTBot/1.0" https://barbermanager.app/` devuelve el texto completo: h1, precio,
   FAQ con respuestas y JSON-LD.
2. `robots.txt`, `sitemap.xml`, `llms.txt` y `og-image.png` responden 200.
3. Rich Results Test de Google y validator.schema.org sin errores.
4. El link compartido por WhatsApp muestra la vista previa con la imagen.
5. Vercel Analytics registra visitas.
6. En desktop y mobile: sin salto de layout y sin errores en consola.

---

## 8. Deudas detectadas durante el diseño

Verificadas contra los docs el 2026-10-01.

Se resuelven en este plan:
- `og:image` faltante (ya anotada en `estado_actual.md`) → paso 4a.
- Lint de la landing (ya anotada en `estado_actual.md`) → paso 2.
- `convenciones_tecnicas.md` §10 dice que todos los fronts son CSR puro → se actualiza en el
  paso 5.

Se anotan en `estado_actual.md` en el paso 5 (fuera de alcance):
- **Subdominios de tenant sin `robots.txt` ni `noindex`** (nueva). Google puede indexar el
  login del panel (`<title>Barber Manager</title>`) una vez por tenant, y eso compite con la
  landing en las búsquedas de la marca. Evaluar un `noindex` para el panel que no alcance al
  turnero (`/turnos`), que sí conviene indexar.
