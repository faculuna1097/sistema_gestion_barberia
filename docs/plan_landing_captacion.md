# Plan: la landing como herramienta de venta (`feature/landing-captacion`)

> **Para el chat orquestador.** Documento autocontenido, escrito por un chat de análisis y estrategia que no va a
> orquestar. Las decisiones de §3 están cerradas con el usuario (2026-11-17), salvo las que §3.2 marca como
> "a confirmar". Los archivos y líneas de §4 son del 2026-11-17: confirmalos al escribir cada prompt. Aprobar el
> plan no es arrancar: el orquestador confirma con el usuario antes de cada fase.
>
> **Estado (2026-11-17):** fases 0, 1 y 2 hechas y commiteadas (las capturas van en el commit de la fase 2).
> Sigue la fase 3. Branch desde `main` (`bccc2d3`),
> independiente de `feature/mejoras-operativas`: no comparten archivos.

## 1. Contexto

BarberManager tiene tres locales en producción. El análisis del 2026-11-16 (landing, código, competencia y datos
de uso) dejó esto:

- **La landing convierte, pero casi nadie llega.** En sus primeros ~30 días de Vercel Analytics: 44 visitantes,
  50 páginas vistas y 3 mensajes de WhatsApp, de los que salieron 2 altas (Luxuri y Monte Sinaí). Kingsai es
  amigo del usuario y no llegó por la landing.
- **Lo que se usa es la gestión, no el turnero.** Al 2026-11-16 (consulta de solo lectura): Kingsai, 3.124 cortes
  en 169 días y 1 turno en toda su historia (sigue reservando por Setmore); Luxuri, 7 cortes entre el 20 y el
  27/10 y nada desde entonces; Monte Sinaí, 5 cortes el 12/11 y nada después. Ningún local usa el turnero.
- **La competencia real no es la que nombra la landing.** El dueño argentino que compara encuentra apps locales
  en pesos (AgendaPro, Turnito, Gendu, ReservaSimple, Cortik), con autoservicio y casi todas con plan gratis, de
  $ 9.000 a $ 25.000 por mes. En ninguna apareció la gestión completa: gastos y balance del mes no figuraban, y
  caja y comisiones solo en AgendaPro y en el plan más caro de Cortik (relevado el 2026-11-16 en sus sitios).
  Lo que diferencia a BarberManager es la gestión, no el precio fijo en pesos.
- **Problemas observados en la landing**, en celular, que es por donde llega el dueño:
  - El titular es genérico.
  - La captura del hero, la planilla de escritorio achicada a 334 × 151 px, no se lee.
  - El precio aparece en la pantalla 11 de 15.
  - La comparación es con apps que el dueño no usa (Booksy no tiene precios argentinos y Setmore está en inglés).
  - El bloque de métricas del sistema de gestión usa números inventados, con una aclaración que resta confianza.
  - Hay tres links de email que compiten con WhatsApp.

Este plan cambia la landing para que venda la gestión, se lea en el celular y deje probar el producto sin
escribirle a nadie. Respeta lo que la landing ya es a propósito: simple, liviana, pre-renderizada y con capturas
y videos reales del producto (`docs/decisiones_landing_ia.md`).

## 2. Modo de trabajo

- **Orquestador** (chat nuevo): lee este doc, escribe un prompt autocontenido por fase, revisa contra el diff real
  (`git diff`, no solo el reporte), hace los ajustes chicos y los verifica, y **commitea** cada fase aprobada (un
  commit por fase, en castellano, con `feat:`, `fix:` o `docs:`, cuerpo explicativo y
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). Push, merge y deploy los hace el usuario. A `main`
  se entra siempre por PR.
- **Ejecutores:** un chat por fase, en `C:\Users\facul\sistema-gestion-barberia`, mismo branch, sin worktrees, sin
  commits. Pueden leer lo que necesiten: el prompt da por dónde arrancar, no una lista cerrada.
- **Lectura obligatoria en cada prompt:** `CLAUDE.md`, `docs/convenciones_tecnicas.md`,
  `docs/sistema_de_disenio.md` (§4.1 explica por qué la landing usa clases `om-`) y `docs/decisiones_landing_ia.md`
  (pre-render, hidratación, fuentes únicas de datos).
- **Pruebas en el navegador las hace el ejecutor:** `npm run build` y `vite preview` en `127.0.0.1`, en un puerto
  fuera de 5173–5176. Revisa a 375 px y a escritorio, y con el JS apagado (el contenido tiene que verse igual). Al
  terminar baja el servidor y borra `.claude/launch.json`.
- **Fallas menores:** si el ejecutor encuentra una falla chica de su contexto (la sección o el archivo que está
  tocando, un arreglo de pocas líneas), se la plantea al usuario en ese chat y la resuelven ahí. En el reporte va en
  el punto 3. Al punto 4 solo llega lo que es de otro contexto o es grande.
- **Preguntas al usuario:** enumeradas, en texto libre, con la recomendación de senior. Nunca selectores ni botones.
- **Reporte del ejecutor:** 1. Qué se hizo. 2. Verificación (qué corrió y qué dio). 3. Lo que quedó distinto al
  prompt y por qué. 4. Cosas vistas de paso (con archivo y línea). 5. Archivos tocados.

## 3. Decisiones

### 3.1 Cerradas con el usuario

| # | Decisión | Por qué |
|---|---|---|
| 1 | El mensaje central pasa a ser **el turnero y la gestión integrados y sincronizados**: lo que reserva el cliente llega solo a la caja y a las planillas. Frente a las apps de turnos, lo que diferencia es la gestión: la caja, los gastos y lo que le toca a cada barbero. | El titular lo pidió así el usuario (2026-11-17). La gestión es lo que usan los locales y lo que la competencia local no cubre completo. |
| 2 | **T1 — titular nuevo**, que pone en primer plano el turnero y el sistema de gestión, conectados. Opciones en §3.2. | El actual lo podría decir cualquier sistema, y no dice que son dos cosas en una. |
| 3 | **T2 — el precio en el hero**: uno de los reaseguros pasa a ser "Después, $ 30.000/mes, barberos ilimitados", armado desde `PRECIO` (nunca el número escrito). Reemplaza a "Te ayudamos a configurarlo", que ya está en el subtítulo. Si `PRECIO.mensual` es `null`, ese reaseguro no se muestra. | Hoy el precio aparece en la pantalla 11 de 15 en celular. |
| 4 | **T3 — comparación centrada en la gestión, sin afirmar nada de otras apps.** El bloque "¿Y frente a otras apps de turnos?" deja de nombrar competidores y de dar datos de ellos, y se queda sin nota al pie con fecha. La FAQ 5 sigue nombrando apps en la pregunta (para que un buscador o una IA la asocie), pero la respuesta habla solo de BarberManager. Textos en §5. | Los datos con fecha eran una deuda de mantenimiento (`estado_actual.md`) y comparaban con apps que el dueño no usa. Sin afirmaciones sobre terceros no hay nada que pueda quedar viejo. |
| 5 | **T4 — una pregunta nueva en la FAQ**: cómo se paga cuando termina el mes gratis. Se descartaron "¿el cliente necesita cuenta para reservar?" (decisión del usuario) y "¿alcanza con un celular?" (ya la responde la FAQ "¿Necesito instalar algo? ¿Funciona en el celular?"). | Es la duda que queda abierta justo antes de decidir. |
| 6 | **T5 descartado**: el texto sigue en primera persona del plural ("te ayudamos"). | El usuario considera que personalizar el software lo hace menos profesional. |
| 7 | **Sin promesa de migración** desde Excel o Setmore. | Los datos para empezar se cargan en `frontend-alta`. |
| 8 | **T6 — un solo canal en el cuerpo**: se sacan los botones de email del Plan y del cierre (`CtaFinal`); el email queda solo en el footer. | Tres CTA de email compiten con WhatsApp, que es por donde llegaron todos. |
| 9 | **D2 — captura legible en celular**: en el hero, por debajo de 768 px se muestra un recorte vertical de la planilla con el detalle de un solo barbero; en escritorio sigue la captura completa. Se baja una sola imagen según el ancho (`<picture>`), sin JS. | La planilla es lo que diferencia al producto; hoy en celular no se lee. |
| 10 | **D3 — "Probá reservar"**: en la sección Turnero, un botón secundario abre el turnero real del tenant demo, con `?origen=landing`. | Deja probar el producto sin escribirle a nadie, y el `origen_link` cuenta cuántas reservas salen de la landing. |
| 11 | **D4 — balance real en vez de métricas de ejemplo**: el bloque "Y a fin de mes, tus números claros." muestra una captura real del balance (del tenant demo) en lugar de las tres `MetricCard` con números inventados. | Una captura del producto real, aunque tenga datos de prueba, convence más que números de ejemplo. |
| 12 | **Las capturas las saca el usuario** (fase 0), desde el tenant demo. | Lo pidió el usuario. |
| 13 | **Fuera de esta tanda:** D1 (testimonios: cuando haya más clientes); D5 ("Hecho con BarberManager" al pie del turnero: hoy ningún local usa el turnero, lo vería nadie); D6 (alta sin pasar por WhatsApp: el usuario prefiere que le escriban y mandar él el link de `frontend-alta`). | Decisiones del usuario. |

### 3.2 Titular, subtítulo y reaseguros (cerrado el 2026-11-17)

**Cerrado con el usuario:**
- **Titular:** opción A.
- **Subtítulo:** cambia, aunque el plan decía que quedaba. El de antes repetía "turnero online" y "conectado"
  justo debajo de A, y el usuario quería poner el peso en tener todo organizado en un mismo lugar. Texto suyo:
  "Turnos, caja, gastos y lo que le toca a cada barbero (comisiones), todo gestionado y organizado en un mismo
  lugar y no repartido entre el cuaderno, el Excel y el WhatsApp. Lo que reserva tu cliente llega solo a la
  caja. Hecho para barberías de Argentina, y te ayudamos a configurarlo."
- **Primer reaseguro:** "Sin instalar nada: empezás en el día". El usuario quería decir que el alta es rápida.
  Va en el reaseguro y no en el subtítulo, que ya es largo. Vale mientras el alta, del WhatsApp a
  `frontend-alta` y la skill `alta-cliente`, se resuelva en el día.

Lo que sigue es el análisis original.

Lo único abierto era el **titular (T1)**. El usuario pidió (2026-11-17) que haga énfasis en que el sistema trae un
turnero y todo un sistema de gestión, integrados y sincronizados. Opciones:

- A. "Turnero online y gestión de tu barbería, conectados en un solo sistema."
- B. "Tus turnos, tu caja y tus barberos, sincronizados en un solo sistema."
- C. "Del turno a la caja, todo tu negocio en un solo sistema."
- D. "Turnero y sistema de gestión: lo que reserva tu cliente llega solo a tu caja."

Recomendación del chat de análisis: **A**.
- Nombra las dos cosas, turnero y gestión, en los primeros segundos.
- "Conectados" dice que están integradas sin usar palabras técnicas como "sincronizado".
- C repite el título de la sección "Cómo funciona" ("de la reserva al cierre de caja").
- D es la más concreta, pero es larga para un `<h1>` en celular.

Ya confirmado por el usuario (2026-11-17):
- La respuesta de la FAQ nueva (T4) queda como está en §5.
- Los valores del turnero demo los cambia el usuario (§6, fase 0).
- Qué capturas sacar se decide en la fase 0, con el orquestador.

## 4. Hechos verificados del código (2026-11-17)

Todo en `frontend-landing/src/`.

- **Hero** (`components/sections/Hero.jsx`):
  - Titular en el `<h1>` (línea 60).
  - `REASEGUROS` es un array de strings fijo (línea 16).
  - La captura sale de `CAPTURAS.planillas` en un `ScreenshotFrame` con `priority` (líneas 115-122).
  - El Hero no usa `<Reveal>`, porque pinta en el primer frame (LCP).
- **`ScreenshotFrame`** (`components/landing/ScreenshotFrame.jsx`):
  - Recibe `image`, `width`, `height` y `priority`, y renderiza un `<img>` con `width`/`height` reales para que la
    imagen no empuje el contenido al cargar.
  - No soporta una imagen distinta por ancho.
- **Config** (`config/landing.js`):
  - `CAPTURAS` es `{ src, width, height }` por captura; hoy tiene solo `planillas` (1902 × 862).
  - `PRECIO.mensual` vale 30000.
  - No hay ninguna URL del tenant demo.
- **Corte celular/escritorio:** 768 px, en `index.css` (clases `om-solo-mobile`, `om-solo-desktop` y `om-fila`). Lo
  que depende del ancho va por CSS, nunca leyendo `window` en el render: si no, falla la hidratación.
- **Comparación** (`components/sections/Comparacion.jsx`):
  - El bloque de alternativas lee `content/alternativas.js`.
  - Los íconos van por posición en `ICONOS_ALTERNATIVAS` (4).
  - La nota al pie se renderiza siempre con `<NotaAlPie>{ALTERNATIVAS.nota}</NotaAlPie>`.
- **FAQ** (`content/faq.js`): `FAQS` es un array de `{ pregunta, respuesta }`. La FAQ 5 es "¿En qué se diferencia de
  Fresha, Booksy o Setmore?". El precio se arma con `respuestaPrecio()`.
- **Lo que se recalcula solo en el build:** `content/faq.js`, `content/alternativas.js` y `content/plan.js` alimentan
  la UI, el JSON-LD (`seo/datosEstructurados.js`) y el `llms.txt` (`seo/llmsTxt.js`). El `llms.txt` imprime
  `ALTERNATIVAS`, incluida la nota: revisar cómo queda si la nota pasa a `null`.
- **Emails:**
  - `linkEmail()` se usa en `components/landing/CTAGroup.jsx` (botón secundario, usado por el Plan),
    `components/sections/CtaFinal.jsx` (línea 140) y `components/landing/LandingFooter.jsx` (línea 161).
  - `CTAGroup` solo lo usa `Plan.jsx`.
- **Sistema de gestión** (`components/sections/SistemaGestion.jsx`):
  - `METRICAS` (líneas 47-51) son datos inventados que se renderizan con `MetricCard`, con la nota "Números de
    ejemplo…".
  - `MetricCard` solo se usa ahí: si sale, se borra el componente.
- **Turnero** (`components/sections/Turnero.jsx`):
  - Usa `SplitFeature`, que ya tiene la prop `cta` ("CTA opcional bajo el texto").
  - El comentario del archivo dice "Sin CTA inline: interrumpía el demo". Ese comentario hablaba del CTA de
    contacto; el de D3 es otra cosa y el comentario se actualiza.
- **Turnero demo** (`https://demo.barbermanager.app/turnos`, visto el 2026-11-17 en celular):
  - Nombre "Barberia Demo", sin tilde.
  - Logo de Kingsai Studio y foto de portada de un local.
  - Servicios de $ 6.500 a $ 9.000, todos de 50 min.
  - Equipo Alejo, Facundo y Miguel.
  - Dirección de un golf club en Pilar y el teléfono del usuario.
- **El turno guarda `origen_link`** (`SQL_Schema.md`, tabla `turno`): lo graba el turnero público desde `?origen=`,
  con el formato `^[a-z0-9_-]{1,30}$`. `landing` es válido.
- **Suscripción de demo:** vence el 2026-11-30. Desde el 2026-12-11 el panel de demo queda bloqueado (402); el
  modo operativo no se bloquea (`estado_actual.md` → "Lógica de suscripción").
- **Google Calendar en demo:** el barbero "facundo" de demo tiene cargado el email del usuario, así que una reserva
  con él crea un evento en su calendario (`estado_actual.md` → "Setup de dev local…").

## 5. Diseño por cambio

### T1 — Titular

Cambiar el texto del `<h1>` de `Hero.jsx` por la opción elegida en §3.2 y el subtítulo por el de §3.2. La meta
description (`index.html` + `seo/sitio.js`) no cambia.

### T2 — Precio en el hero

`REASEGUROS` se arma con el precio de `PRECIO` y `fmtPesos`: "Sin instalar nada: empezás en el día" · "Después, $ 30.000/mes,
barberos ilimitados" · "Cancelás cuando quieras". Si `PRECIO.mensual` es `null`, el del medio no va. Revisar a
375 px que no quede un renglón huérfano feo; si queda, el ejecutor propone la variante al usuario en su chat.

### T3 — Comparación y FAQ 5

`content/alternativas.js`:

- **titulo:** "¿Y frente a una app de turnos?"
- **puntos:**
  1. **Además de la agenda, la plata.** Una app de turnos te ordena la agenda. BarberManager además arma la caja
     del día, registra los gastos y calcula lo que le toca a cada barbero.
  2. **Barberos ilimitados.** El precio es el mismo con un barbero o con diez: no pagás por cada uno que sumás.
  3. **Todo en una sola suscripción, en pesos.** Turnero, app para barberos, caja, planillas y balance del mes,
     sin complementos pagos ni comisiones por reserva.
  4. **Te acompañamos.** Te ayudamos a dejar todo configurado y te atendemos por WhatsApp. (Queda igual que hoy.)
- **nota:** `null`. La nota al pie se renderiza solo si hay nota, en la UI y en el `llms.txt`.
- Revisar que los 4 íconos de `ICONOS_ALTERNATIVAS` sigan teniendo sentido con los textos nuevos.

FAQ 5 en `content/faq.js`:

- **pregunta:** "¿En qué se diferencia de Fresha, Booksy, AgendaPro u otras apps de turnos?"
- **respuesta:** "BarberManager está hecho para barberías de Argentina: además del turnero, incluye la caja del
  día en efectivo y Mercado Pago, los gastos, lo que le toca a cada barbero y el balance del mes. Se paga un precio
  fijo en pesos, con barberos ilimitados."

### T4 — FAQ nueva

Va después de "¿Cuánto cuesta?".

- **pregunta:** "¿Cómo se paga cuando termina el mes gratis?"
- **respuesta (confirmada por el usuario):** "Por Mercado Pago, una vez por mes. Para el mes gratis no te pedimos
  tarjeta: si no seguís, no pagás nada."

### T6 — Un solo canal

- **`Plan.jsx`:** queda solo el botón de WhatsApp. Si `CTAGroup` pierde su razón de ser (un solo botón), el
  ejecutor decide entre simplificarlo o reemplazarlo por `Button`. El criterio: no dejar un componente que se
  llama "grupo" con un solo elemento.
- **`CtaFinal.jsx`:** se saca el `BotonCta` de email.
- **Footer:** queda igual.
- **`linkEmail`, `CONTACTO.asuntoEmail` y `CONTACTO.cuerpoEmail`** se siguen usando desde el footer: no se borran.

### D2 — Captura del hero en celular

- `CAPTURAS.planillasMobile = { src, width, height }` (archivo de la fase 0).
- `ScreenshotFrame` suma una prop opcional para la versión celular (por ejemplo `imageMobile`, con su `src`,
  `width` y `height`) y, si viene, renderiza:

  ```html
  <picture>
    <source media="(max-width: 767px)" srcset="…" width="…" height="…">
    <img …>
  </picture>
  ```

  El `<img>` es el de escritorio.
- Así el navegador baja una sola imagen. Con dos `<img>` y clases `om-`, el celular bajaría las dos.
- Los atributos `width`/`height` en `<source>` reservan el alto justo de cada versión. El ejecutor verifica en
  Chrome que no haya salto de contenido (CLS) a 375 px. Si el soporte no alcanza, la alternativa es un
  `aspect-ratio` por media query en `index.css` (clase `om-`).
- `fetchpriority="high"` sigue en el `<img>`.
- Pie de la captura: sigue "Planilla semanal — sin cuaderno ni Excel".

### D3 — "Probá reservar"

- **Config:** `DEMO = { turnero: 'https://demo.barbermanager.app/turnos?origen=landing' }` en `config/landing.js`.
- **`Turnero.jsx`:** pasa a `SplitFeature` un `cta` con un `Button` secundario, externo (pestaña nueva), con el
  texto "Probá reservar en una barbería de ejemplo".
- **Comentario del archivo:** se actualiza para explicar que el CTA de contacto sigue afuera y que este es una
  prueba del producto.
- **`llms.txt`:** el ejecutor evalúa si suma una línea con el link al turnero de ejemplo. Recomendación: sí, es
  útil para una IA que recomiende.

### D4 — Balance real

- `SistemaGestion.jsx`: se borran `METRICAS` y la grilla de `MetricCard`.
- En su lugar va un `ScreenshotFrame` con `CAPTURAS.balance`, sin `priority`, con `loading="lazy"`. Si
  `ScreenshotFrame` no lo soporta, se suma la prop.
- Se mantienen el título "Y a fin de mes, tus números claros." y su bajada.
- **Nota al pie:** "Captura del sistema con datos de prueba." Es honesta: los números son del tenant demo.
- Se borra `components/landing/MetricCard.jsx` si queda sin uso.

## 6. Fases

| Fase | Quién | Qué | Depende de |
|---|---|---|---|
| 0 | Usuario (con el orquestador) | Preparar demo y sacar capturas | — |
| 1 | Ejecutor | Textos: T1, T2, T3, T4, T6 | §3.2 confirmada |
| 2 | Ejecutor | D2, D3, D4 | Fase 0 y fase 1 |
| 3 | Orquestador | Docs, PR y verificación en producción | Fase 2 |

### Fase 0 — Demo y capturas (usuario)

1. **Renovar la suscripción de demo** (el orquestador le da el SQL). Sin esto, desde el 11/12 el panel de demo queda
   bloqueado, y ahí se sacan las capturas y se hacen las demos en persona:
   `UPDATE tenant SET suscripcion_vigente_hasta = '2027-12-31' WHERE subdominio = 'demo';`
2. **Dejar el turnero demo presentable** antes de enlazarlo (D3). Los valores los cambia el usuario; el orquestador
   le ayuda si algo necesita SQL. Lo acordado:
   - Nombre visible: "Barbería de ejemplo" o similar, con tilde.
   - Logo: sacar el de Kingsai Studio (es la marca de otro local).
   - Foto de portada: si es de Kingsai, pedirle permiso o cambiarla.
   - Dirección: sacarla o dejar una genérica, no un golf club en Pilar.
   - Precios: actualizarlos a valores de 2026 (el usuario dijo que un corte va de $ 15.000 a $ 25.000). Las
     duraciones de 50 min quedan, porque las pruebas de la app del barbero dependen de ellas.
   - Teléfono: puede quedar el del usuario. Quien toque WhatsApp desde el turnero de ejemplo le escribe a él, y eso
     es un contacto.
   - Recomendación sobre Google Calendar: aceptar que las reservas con "facundo" lleguen al calendario del usuario.
     Es la señal de que un prospecto probó el producto. Si molesta, se le saca el email a ese barbero de demo.
3. **Sacar las capturas** desde el panel de demo (cuáles exactamente se cierra en esta fase con el usuario), en JPG, de menos de 150 KB cada una, en
   `frontend-landing/public/screenshots/`:
   - `planillasMobile`: recorte vertical de la planilla con el detalle de un solo barbero, legible a 375 px de
     ancho. Que mida al menos 750 px de ancho (pantallas de densidad 2×) y tenga una proporción de 4:5 a 1:1.
   - `balance`: la pantalla de Balances del mes.
   - (Opcional, recomendado) Volver a sacar `seccionPlanillas.jpg` de escritorio: hoy muestra los totales en
     indigo, que ya no es el color del sistema (`estado_actual.md` → "Color de montos"). Si se cambia, el ejecutor
     de la fase 2 regenera `og-image.png` con el comando del comentario de `scripts/og-image.html`.
   - El orquestador anota las medidas reales de cada archivo para el prompt de la fase 2.

### Fase 1 — Textos (ejecutor)

- **Qué:** T1, T2, T3, T4 y T6 según §5.
- **Verificación:**
  - `npm run build` sin errores (el build corta si la meta description no coincide).
  - En el HTML de `dist/index.html`: el `<h1>` nuevo, el precio en el hero, la FAQ nueva con su respuesta en el
    JSON-LD (FAQPage) y el bloque de alternativas sin nota.
  - En `dist/llms.txt`: sin la nota de la competencia y sin datos de Fresha, Booksy ni Setmore.
  - En el navegador a 375 px y en escritorio: sin email en el Plan ni en el cierre; el footer conserva el suyo.

### Fase 2 — Capturas y "Probá reservar" (ejecutor)

- **Qué:** D2, D3 y D4 según §5, más la `og-image` si en la fase 0 se volvió a sacar la planilla.
- **Verificación:**
  - A 375 px el hero muestra la captura vertical. En la pestaña Network se baja solo esa imagen, no la de
    escritorio, y no hay salto de contenido.
  - En escritorio se ve la captura completa.
  - Con el JS apagado se ven igual.
  - El botón abre `demo.barbermanager.app/turnos?origen=landing` en otra pestaña.
  - El bloque del balance muestra la captura, con su nota.
  - `MetricCard` no queda referenciado.
  - Lighthouse en celular (como en `convenciones_tecnicas.md` §10): el LCP y el CLS no empeoran respecto de la
    landing en producción.
- **Restricción:** el ejecutor **no reserva turnos de prueba** en el turnero de demo de producción para verificar
  D3: alcanza con que el link abra bien. La reserva con `origen=landing` la prueba el usuario una vez desplegado.

### Fase 3 — Cierre (orquestador)

1. Actualizar `docs/decisiones_landing_ia.md`:
   - Fila "Competencia": ya no se afirma nada de terceros.
   - Fila "Mensaje": la gestión como mensaje central.
   - Sección "Cómo mantenerlo": sacar el paso de revisar precios de la competencia; sumar las capturas nuevas.
2. Actualizar `docs/estado_actual.md`:
   - Cerrar la deuda "Landing: datos de la competencia con fecha".
   - Cerrar el pendiente de la captura de Planillas y la `og-image`, si se hizo.
   - Anotar cómo medir (§7).
3. Pasarle al usuario los comandos de push y PR. A `main` se entra por PR.
4. Después del deploy, checklist de `decisiones_landing_ia.md` puntos 1 y 2. El usuario hace una reserva de prueba
   desde el botón y se confirma con `consultar.js` que quedó con `origen_link = 'landing'`.

## 7. Qué medir después del deploy

| Dato | Con qué |
|---|---|
| Visitantes y de dónde vienen | Vercel Analytics (plan Hobby: ventana de 1 mes; anotarlo a mano cada semana) |
| Mensajes de WhatsApp desde la landing | Los que llegan con el mensaje precargado; contarlos a mano |
| Reservas de prueba desde la landing | `node backend/src/scripts/consultar.js "SELECT count(*) FROM turno t JOIN tenant x ON x.id = t.tenant_id WHERE x.subdominio = 'demo' AND t.origen_link = 'landing'"` |
| Uso real en la primera semana de cada alta | Cortes y turnos por tenant con `consultar.js` (la consulta del 2026-11-16 está en el resumen del chat de análisis) |

Con 44 visitantes por mes no hay muestra para comparar el antes y el después de un cambio de texto. Lo que importa
es si suben los mensajes y las altas que de verdad usan el sistema.

## 8. Hallazgos

Anotado por el orquestador el 2026-11-17:

- **Capturas de la fase 0.** Las sacó el orquestador del panel de demo, a densidad 2. Medidas para la fase 2:
  - `seccionPlanillas.jpg`: 1829 × 1188, 140 KB.
  - `planillasMobile.jpg`: 1020 × 1007, 87 KB.
  - `balance.jpg`: 1861 × 1187, 128 KB.

  El panel no tiene versión para celular. Por eso la de celular es un recorte de la tabla de escritorio con 4
  columnas (hora, servicio, cliente y monto), que en el celular se lee a ~10–11 px. El balance va en una sola
  imagen: en el celular se leen los tres números grandes y la tabla queda como ilustración.
- **Datos de prueba de demo.** Hay cortes, turnos, ventas y gastos del 3 al 14/11/2026, cargados con SQL. Las
  marcas para borrarlos: clientes `seed-landing-N@ejemplo.invalid`, turnos con `token_gestion` `seed-landing-…`, y
  cortes, ventas y gastos con la hora en minutos exactos (segundos en 0).
- **`docs/decisiones_landing_ia.md:58`** habla de "la FAQ 5". Con la FAQ nueva, esa pregunta es la 6. Se
  corrige en la fase 3.
- **FAQ "¿Cómo empiezo?"** (`content/faq.js`) dice "Nos escribís por WhatsApp o email". Es coherente con el
  email del footer; queda como está salvo que el usuario quiera empujar solo a WhatsApp.
- **CLS de 0,058 en el hero, desde la fase 1** (medido por el ejecutor de la fase 2 con Lighthouse en celular;
  producción da 0). Geist entra por `@import` en `index.css:10` con `display=swap`, y el `<h1>` nuevo corta en
  otros renglones con la fuente del sistema que con Geist, así que empuja el subtítulo al llegar la fuente. Está
  debajo de 0,1 (el límite "bueno"). Arreglos posibles, a medir: `<link>` + `preconnect` en `index.html`, o una
  fuente de reemplazo con `size-adjust`. El LCP mejoró de 3,5 s a 1,6 s.
- **Portada del video del turnero en celular** (la caja gris): no es un bug. Es el fondo del marco mientras baja
  la portada, que tiene `loading="lazy"` (`VideoEmbed.jsx:76`); solo se ve si se salta directo a la sección.
- **`estado_actual.md:311`** dice que el teléfono se carga "desde Gestión → Negocio", pero esa pestaña no tiene
  ese campo: el teléfono y la dirección del tenant se cambian solo por SQL. Se corrige en la fase 3.

Ya conocidos, que no son de esta tanda pero tocan la landing:

- **Portada del video del turnero en celular:** el 2026-11-16 se vio como una caja gris con el botón de play. Puede
  ser la carga diferida (`loading="lazy"`) en el recorrido automático. El ejecutor de la fase 2 lo mira de paso, a
  375 px.
- **`linkWhatsApp()` con `CONTACTO.whatsapp` en `null`** arma `wa.me/null` (deuda anotada en `estado_actual.md`).
