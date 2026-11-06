# Landing recomendable por IA + analytics — núcleo de decisiones

> ✅ **Implementado el 2026-10-01** (branch `feature/landing-ia`). Documento de decisiones: el
> "por qué" y cómo mantenerlo. Implementación en `/frontend-landing`:
> - pre-render: `scripts/prerender.js` + `src/entry-server.jsx`;
> - datos compartidos: `src/content/`;
> - SEO: `src/seo/`;
> - clases `om-`: `src/index.css`;
> - imagen de vista previa: `scripts/og-image.html` → `public/og-image.png`.
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
| Mensaje | Central: BarberManager es un **sistema de gestión completo**, no solo turnos. Apoyos: barberos ilimitados y precio fijo en pesos. | Los dolores de los dueños con otras apps eran el precio y el límite de barberos. |
| Competencia | Contra Fresha, Booksy y Setmore **solo se afirma lo verificable y con fecha**. Los precios **no** se comparan con números. | Fresha sale más barato hasta unos 5 barberos, Setmore es gratis hasta 4 usuarios y Fresha también tiene gestión (caja, comisiones, gastos). Lo verificable: los tres cobran según el tamaño del equipo, y Booksy y Setmore cobran en dólares. |
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
- **Cambiar una captura:** actualizar `src`, `width` y `height` en `CAPTURAS`.
- **Regenerar la `og-image`:** editar `scripts/og-image.html` y correr el comando de su
  comentario.
- **Datos de la competencia:**
  1. Revisar cada tanto las páginas de precios de Fresha, Booksy y Setmore (desde Argentina:
     Fresha muestra precios en pesos).
  2. Si cambia algo que el texto afirma, corregir `src/content/alternativas.js` y la FAQ 5.
  3. Actualizar la fecha de la nota al pie.

  Relevamiento original (01/10/2026):
  - **Fresha:** 8.000 ARS/mes (1 profesional) o 5.300 ARS por miembro/mes, más impuestos.
  - **Booksy:** US$29,99 + US$20 por miembro adicional, más impuestos.
  - **Setmore:** gratis hasta 4 usuarios; Pro a US$5 por usuario/mes (anual) o US$12 (mensual).
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
