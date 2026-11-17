# Landing recomendable por IA + analytics — núcleo de decisiones

> ✅ **Implementado el 2026-10-01** (branch `feature/landing-ia`). Documento de decisiones: el
> "por qué" y cómo mantenerlo. Implementación en `/frontend-landing`:
> - pre-render: `scripts/prerender.js` + `src/entry-server.jsx`;
> - datos compartidos: `src/content/`;
> - SEO: `src/seo/`;
> - clases `om-`: `src/index.css`;
> - imagen de vista previa: `scripts/og-image.html` → `public/og-image.png`.
>
> **Actualizado el 2026-11-17** (`feature/landing-captacion`): el mensaje, la competencia y
> las capturas cambiaron (filas "Mensaje", "Competencia" y "Capturas y demo").
>
> **En producción desde el 2026-10-01.** Comprobados el 2026-11-04 los puntos 1 y 2 de la
> checklist del final y que Vercel Analytics está activo. **Pendiente:** el resto de la
> checklist y las acciones fuera del sitio (ver `estado_actual.md` → Pendientes).

## Problema que resolvió

La landing era una SPA pura: el servidor devolvía un HTML de 1,4 KB con `<div id="root"></div>`
vacío. Los crawlers de IA (GPTBot, ClaudeBot, PerplexityBot) no ejecutan JavaScript, así que
para ellos BarberManager era solo el `<title>` y la meta description: sin precio, país, FAQ ni
funciones.

Además daban 404 `robots.txt`, `sitemap.xml`, `llms.txt` y la `og-image`, y no había forma de
saber quién visitaba la página.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Pre-render | **SSG con script propio** (patrón de Vite): `npm run build` = build del cliente + build SSR + `prerender.js`, que inyecta el HTML en `#root`. React hidrata con `hydrateRoot`. Sin dependencias nuevas. | Es una sola página: migrar a Astro o Next.js era sobredimensionado. |
| Responsive | **Por CSS**, con clases `om-` en `index.css`. Es una excepción a "sin clases globales", documentada en `sistema_de_disenio.md` §4.1. Se eliminó `useMediaQuery`. | El HTML se genera sin conocer el viewport: con JS, en desktop saldría el layout mobile y saltaría al hidratar. |
| Animación de entrada | El contenido va visible en el HTML. `Reveal` anima solo si `<html>` tiene la clase `js`, que pone un script inline del `<head>`. Si a los 3 s la app no hidrató (`window.__omHidratado`), el script saca la clase y todo se ve sin animar. El Hero no se anima. | Si el JS falla o tarda, el contenido igual se ve. El Hero pinta en el primer frame (LCP). |
| FAQ | `<details>` / `<summary>` nativo: la respuesta está siempre en el HTML. | Antes la respuesta solo existía con el acordeón abierto. Además funciona antes de hidratar y es accesible por defecto. |
| Analytics | **Vercel Web Analytics**, plan Hobby: 50k eventos/mes, ventana de **1 mes**, sin eventos de clic ni UTM. | Ya estábamos en Vercel. No usa cookies (no hace falta banner). Los clics en WhatsApp igual llegan como mensajes. |
| Mercado y precio | Solo Argentina. **$30.000/mes** (antes $40.000), barberos ilimitados, primer mes gratis, una suscripción por local. | Decisión de negocio. |
| Mensaje | Central (desde el 2026-11-17): **el turnero y la gestión integrados**. Lo que reserva el cliente llega solo a la caja y a las planillas, y todo queda organizado en un mismo lugar. Frente a una app de turnos, lo que diferencia es la gestión: caja, gastos y lo que le toca a cada barbero. Apoyos: barberos ilimitados y precio fijo en pesos, que se ve en el hero. | Los locales usan la gestión, no el turnero, y la competencia local (apps en pesos con plan gratis) no la cubre completa. Antes el mensaje era "sistema de gestión completo". Análisis en [`plan_landing_captacion.md`](./plan_landing_captacion.md). |
| Competencia | Desde el 2026-11-17 **no se afirma nada de terceros**: ni nombres, ni precios, ni funciones. El bloque "¿Y frente a una app de turnos?" habla solo de BarberManager y no tiene nota al pie. La FAQ "¿En qué se diferencia de Fresha, Booksy, AgendaPro u otras apps de turnos?" nombra apps solo en la pregunta, para buscadores e IA. | Los datos fechados eran una deuda de mantenimiento y comparaban con apps que el dueño argentino no usa. Sin afirmaciones sobre terceros no hay nada que pueda quedar viejo. Antes (2026-10-01) se afirmaba lo verificable y con fecha sobre Fresha, Booksy y Setmore. |
| Capturas y demo | Las capturas son del panel real, con datos de prueba del tenant demo, y lo dicen ("Captura del sistema con datos de prueba"). En el hero, por debajo de 768 px va un recorte de la planilla con `<picture>`, así se baja una sola imagen. El botón "Probá reservar en una barbería de ejemplo" abre el turnero de demo con `?origen=landing`. | Una captura real convence más que números de ejemplo. La planilla de escritorio achicada no se leía en el celular. El botón deja probar sin escribirle a nadie, y `turno.origen_link` cuenta cuántas reservas salen de la landing. |
| Fuente única de datos | `config/landing.js` + `src/content/` (`faq.js`, `alternativas.js`, `plan.js`) alimentan la UI, el JSON-LD y el `llms.txt`. El número del precio solo está en `PRECIO`. | Cambiar el precio o una respuesta en un lugar actualiza todo. |
| JSON-LD | Organization + SoftwareApplication (con `offers` en ARS) + FAQPage, armado en `src/seo/` e inyectado en el `<head>` por `prerender.js`. No va al bundle del cliente. Sin `aggregateRating`. | Solo sirve en el HTML estático. Sin reseñas reales no se inventan calificaciones (el Rich Results Test lo marca como advertencia). |
| `llms.txt` | Generado en el build (`dist/llms.txt`) desde las mismas fuentes. Los links de WhatsApp llevan el mensaje precargado. | Un cambio de config no deja datos viejos. Quien llega desde una IA abre WhatsApp con el mensaje listo. |
| Meta description | Escrita en `index.html` y en `src/seo/sitio.js` (`DESCRIPCION`). Si no coinciden, el build corta. | El JSON-LD y el `llms.txt` la necesitan, y así no se desincronizan. |
| `og-image` | Plantilla HTML con los tokens + la captura real de Planillas, capturada con Edge headless. La plantilla queda versionada. | Asset real y regenerable. 1200 × 630, 111 KB (WhatsApp tolera hasta ~300 KB). |
| Imágenes | Las capturas llevan `width`/`height` reales (`CAPTURAS`). La del Hero lleva `fetchpriority="high"` y los posters `loading="lazy"`. | Sin medidas, la captura empujaba el contenido al cargar (CLS). Los posters competían con la imagen principal. |

## Cómo mantenerlo

- **Cambiar el precio:** solo `PRECIO.mensual` en `config/landing.js`. Se actualizan el Plan, la
  FAQ 2, el JSON-LD y el `llms.txt`.
- **Cambiar una pregunta frecuente:** `src/content/faq.js`. La FAQPage del JSON-LD y el
  `llms.txt` salen de ahí.
- **Cambiar la meta description:** en `index.html` **y** en `src/seo/sitio.js`. Si quedan
  distintas, el build falla a propósito.
- **Cambiar una captura:**
  1. Sacarla del panel de demo a densidad 2, solo el bloque que importa y sin la barra lateral,
     en JPG de menos de 150 KB.
  2. Dejarla en `public/screenshots/` y actualizar `src`, `width` y `height` en `CAPTURAS`.

  Hoy hay tres:
  - `planillas`: el hero en escritorio.
  - `planillasMobile`: el hero en celular, un recorte de la misma planilla con hora, servicio,
    cliente y monto, porque el panel no tiene versión para celular.
  - `balance`: la sección de gestión.

  Los datos de prueba de demo (3 al 14/11/2026) y cómo borrarlos están en
  [`plan_landing_captacion.md`](./plan_landing_captacion.md) §8. Si se cambia `planillas`,
  regenerar la `og-image`.
- **Regenerar la `og-image`:** editar `scripts/og-image.html` y correr el comando de su
  comentario. El título es la versión corta del `<h1>`: el completo no entra en dos renglones.
- **Bloque frente a otras apps y FAQ de la diferencia:** no afirmar nada de terceros. No hay
  datos de la competencia que mantener.
- **Turnero de ejemplo (`DEMO.turnero`):** el botón lleva al turnero real del tenant demo, así
  que lo que ve el prospecto es lo que esté cargado ahí (nombre, logo, servicios, precios y
  horarios). Mantener la suscripción de demo vigente y los precios al día.
- **Agregar algo que dependa del ancho de pantalla:** CSS (`om-`) o flex-wrap inline, nunca
  `useIsDesktop` ni nada que lea `window` durante el render. Si el primer render del cliente
  difiere del HTML del build, la hidratación falla.
- **El año del footer** lo fija el build (`__ANIO_BUILD__`, en el `define` de `vite.config.js`).
- **Vercel:** el Build Command del proyecto no puede estar sobrescrito. Tiene que correr el
  script `build` del `package.json`; si no, no hay pre-render.

## Checklist después del deploy

1. `curl -A "GPTBot/1.0" https://barbermanager.app/` trae el texto completo (h1, precio, FAQ con
   respuestas) y el `<script type="application/ld+json">`.
2. `robots.txt`, `sitemap.xml`, `llms.txt` y `og-image.png` responden 200.
3. [Rich Results Test](https://search.google.com/test/rich-results) y
   [validator.schema.org](https://validator.schema.org) sin errores. La advertencia por falta de
   `aggregateRating` es esperada.
4. El link compartido por WhatsApp muestra la vista previa con la imagen.
5. Vercel Analytics registra visitas.
6. En el celular: las notas al pie se leen y, al tocar las anclas y volver, no queda ningún
   bloque en blanco.

## Acciones fuera del sitio (las hace el dueño)

La página es condición necesaria, no suficiente: los LLMs también pesan las menciones fuera del
sitio.

1. **Google Search Console:**
   - verificar el dominio `barbermanager.app` con un registro TXT en el DNS de Namecheap;
   - enviar `https://barbermanager.app/sitemap.xml`;
   - pedir la indexación de la home.
2. **Bing Webmaster Tools:** importar el sitio desde Search Console. La búsqueda de ChatGPT se
   apoya en buena parte en el índice de Bing.
3. **Directorios de software:** perfil gratuito de vendedor en Capterra / GetApp (Gartner
   Digital Markets) y G2. Mismo nombre, descripción y precio que la landing.
4. **Instagram:** el link de `barbermanager.app` en la bio.
5. **Reseñas reales:** cuando haya clientes conformes, pedirles una reseña en esos directorios.
   Con testimonios reales se puede prender `FLAGS.mostrarTestimonios` en la landing.

## Cosas que NO entraron

- Páginas dedicadas por competidor ("alternativa a Booksy"): evaluar si Analytics muestra
  tracción.
- `noindex` del panel en los subdominios de tenant: anotado como deuda en `estado_actual.md`.
- Mail con dominio propio: se mantiene el gmail.
