# Plan: monitoreo de la salud de producción (avisos al celular + diagnóstico con Claude)

> **Para el chat orquestador.** Este documento es autocontenido: lo escribió un chat de planificación que no va a orquestar. Todas las decisiones (1–12) están cerradas con el usuario; no hace falta volver a discutirlas. Lo que dice "a verificar" son datos técnicos que se confirman al implementar, no decisiones abiertas. Aprobar este plan no es arrancar: el orquestador confirma con el usuario antes de cada fase.
>
> **Estado (2026-11-05): planificado, sin arrancar.** El branch `feature/monitoreo-prod` sale de `main`, con el merge de `feature/descansos-agenda` (que trae el fix del health, `0c0bc13`) ya desplegado (`a1b5ed7`). Antes de este plan va la tanda de mejoras operativas, en `feature/mejoras-operativas`, otro hijo de `main` (`docs/plan_mejoras_operativas.md`). Al retomar: rebasar este branch sobre el `main` que ya tenga esas mejoras, y confirmar que los datos de §3 sigan vigentes, porque las líneas y conteos pueden haber cambiado con ellas.

---

## 1. Contexto

**Problema.** Hoy, para saber si producción anda bien, el usuario tiene que entrar al dashboard de Railway desde la PC. No se entera de una caída, de un error o de un abuso hasta que un cliente se queja.

**Objetivo.**
1. **Enterarse sin preguntar**: aviso al celular (Discord) cuando el backend se cae, crashea, falla un deploy, aparece un error de la app o hay tráfico inusual, **sabiendo qué tenant** tiene el problema.
2. **Sin gastar tokens en rutinas**: ninguna alerta usa Claude. Nada de cron con LLM ni reporte diario.
3. **Diagnóstico a pedido**: cuando llega un aviso, abrir desde el celular una sesión de Claude en la nube que lea los logs de prod y responda "¿qué pasó?".

**De dónde viene.** El commit anterior (integración a mano de la rama `claude/mobile-login-issue-7extzq`, mensaje "fix: hacer diagnosticable el rechazo por tenant (health, logs y mensajes de falla)") dejó la base:
- `GET /api/health` responde antes de `tenantMiddleware` y antes del log de acceso (sin header de subdominio ni JWT, sin ensuciar logs). Es lo que va a consultar el monitor de uptime.
- `tenantMiddleware` loguea con `console.warn` el subdominio que no resuelve a un tenant activo, y los errores de tenant traen `codigo` (`tenant_no_identificado` 400, `tenant_no_encontrado` 404).
- El log de acceso va antes de `tenantMiddleware`: los rechazos por tenant dejan línea en Railway.
- Los fronts usan `/api/health` para distinguir "servidor caído" de "sin red" (`diagnosticarSinRespuesta` en el `utils/errores.js` de cada front).
- Ese commit es `0c0bc13`; la fase 0 (abajo) ya está hecha.

---

## 2. Decisiones cerradas (con su porqué)

| # | Decisión | Por qué |
|---|---|---|
| 1 | Sesión de diagnóstico **en la nube** (claude.ai/code, desde la app del celular), no Remote Control de la PC | Tiene que andar con la PC apagada. El riesgo del token se acota con un token de proyecto limitado al entorno de producción + allowlist (decisión 4) |
| 2 | Avisos **por evento**; ninguna capa de alerta usa Claude; **sin reporte diario** | El usuario no quiere depender de preguntar ni gastar tokens en rutinas. Un LLM no es buena alarma (costo y demora) |
| 3 | **Monitor de uptime externo** (UptimeRobot o Better Stack, plan gratis) contra `/api/health` cada 5 min | Es lo único que avisa una caída total sin que nadie pregunte; determinístico y gratis |
| 4 | **Allowlist de solo lectura** en `.claude/settings.json` del proyecto (commiteado) | Una regla escrita en la skill depende de que el modelo la respete; la allowlist la hace cumplir el sistema. Solo agrega permisos: no cambia el trabajo local |
| 5 | Alcance: **solo backend en Railway** (no Vercel ni Supabase aparte) | Los fronts son estáticos; si Supabase falla, aparece en los `console.error` del backend |
| 5b | Node: no hay riesgo inmediato | `backend/package.json` fija `"engines": { "node": "22.x" }`, así que Railway no salta solo de versión mayor (Node 26 pasa a LTS fines de octubre 2026 y no afecta). **Node 22 tiene EOL el 2027-04-30** → anotar como pendiente en `estado_actual.md` migrar a 24/26 antes. Requisito a mantener: Node ≥22 por el WebSocket nativo que pide `@supabase/supabase-js` |
| 6 | Diagnóstico con ventana por defecto de **24 h**, a pedido otra ("¿qué pasó en la última hora?") | La pregunta típica desde el celular es "¿anduvo todo bien hoy?" |
| 7 | **Sentry** (`@sentry/node`, plan gratis) para los errores de la app | Estándar de la industria: agrupa repeticiones (un error repetido 200 veces = un aviso), stack traces, reglas de alerta. La alternativa casera (webhook por cada `console.error`) obliga a programar agrupación y throttling a mano |
| 7b | **El tenant va en cada evento; los datos personales no** | El usuario quiere saber qué local tiene el problema. Van como tags: `tenant` (subdominio), `tenant_id`, `rol`. No van: nombres/teléfonos/mails de clientes, IPs, body de los requests (PINs, passwords), header `Authorization` (JWT), cookies, query string |
| 8 | Canal de avisos: **Discord** (server privado del usuario, app en el celular) | Push inmediato; Railway formatea sus webhooks para Discord sin middleware. Si el plan gratis de Sentry o del monitor no trae integración con Discord, ese servicio avisa por mail (a verificar al configurarlo) |
| 9 | Railway está en plan **Hobby ($5/mes)** | No hay monitores de CPU/RAM/egress (son de Pro). Sí hay webhooks de proyecto (crash y deploy fallido) |
| 10 | **Tráfico inusual = cortes del rate limiter.** Aviso la primera vez y, si sigue, máximo uno por hora por tipo de límite | El rate limiter es la definición que el sistema ya tiene de tráfico anormal (300 req/min por IP, 10 logins fallidos/15 min). Hoy prácticamente no deberían saltar. Si avisa de más, se sube el umbral en Sentry sin tocar código |
| 10b | Alertas de errores: **issue nuevo**, **issue que vuelve tras resuelto** y **pico de un issue conocido (> 50 veces en 1 h)** | Avisa lo nuevo y lo que se dispara, sin un aviso por cada repetición |
| 12 | **Captura automática de todo `console.error`** (`captureConsoleIntegration({ levels: ['error'] })`), sin tocar los `catch`. El tenant se agrega una sola vez en los middlewares | Ver §3: no hay handler de errores ni `next(err)`; la alternativa (helper `reportarError` en cada `catch`) toca ~90 líneas en 51 archivos y cada `catch` nuevo tiene que acordarse. Con la captura automática, la convención existente (`console.error` = algo rompió el flujo) pasa a ser el contrato |

**Límite conocido del plan gratis de Sentry:** 5.000 errores/mes. Si un bug genera miles, Sentry deja de registrar hasta el mes siguiente (no cobra). Los logs de Railway siguen teniendo todo.

**Aviso de privacidad para la sesión de Claude:** el contenido de los logs de Railway pasa al contexto de la sesión. El log de acceso enmascara credenciales (`utils/sanitizarLogs.js`), pero aparecen IDs de tenant, subdominios e IPs (en los warns del rate limiter).

---

## 3. Hechos verificados del código y del entorno (2026-11-05)

### Manejo de errores del backend
- **No hay handler de errores de Express ni ningún `next(err)`** (grep sin resultados de `next(err`, `(err, req, res, next)`, `uncaughtException`, `unhandledRejection`, `process.on(`).
- Patrón de cada controller: `try { ... } catch (err) { console.error('[modulo] Error en nombreFuncion:', err); return res.status(500).json({ error: ... }); }`. Hay 79 `status(500)` en 31 archivos y 124 `console.error` en 51 archivos (incluye scripts locales de `backend/src/scripts/`, que corren sin `SENTRY_DSN` y no mandan nada).
- Casi todos pasan el objeto `err` (con stack). Solo `err.message`: `config/db.js:49` y `services/storageService.js:62` (llegan a Sentry como mensaje, sin stack; aceptable).
- `console.error` fuera de requests: `jobs/recordatorios.js` (2), `config/db.js` (4, pool y keep-alive), `services/mail/mailer.js`, `services/googleCalendar.js` (3), `services/storageService.js`, `services/recordatoriosService.js`, `services/suspensionesService.js`, `services/turnosService.js`, `utils/stock.js`.
- Ningún `console.error` de producción imprime nombres, teléfonos ni mails (grep revisado). Los errores de `pg` traen el valor en `err.detail`, no en `err.message`.
- Convención (`docs/convenciones_tecnicas.md` §1): `console.error` = algo rompió el flujo (entró al `catch`); `console.warn` = anómalo recuperable (conflicto de negocio, login fallido, tenant no encontrado). Prefijo `[modulo]`.

### Middlewares y arranque
- `backend/src/index.js`, orden actual: `helmet` → `cors` → `limiterGlobal` → `express.json` → `req.body ??= {}` → `GET /api/health` → `POST /api/plataforma/cache/invalidate` → log de acceso → `tenantMiddleware` → rutas (logins con `limiterLogin`, turnero, `/api/negocio`, operativas, admin). Al final, `startServer()` (testConnection, keep-alive, listen).
- `tenantMiddleware.js` setea `req.tenant_id` (línea ~171; en dev, el fallback `TENANT_ID` en la línea ~148). Tiene el subdominio a mano.
- `authMiddleware.js` setea `req.tenant_id` y `req.rol` (líneas 58–59).
- `rateLimitMiddleware.js`: `crearHandler429(nombre)` (línea ~44) hace `console.warn('[rateLimit] límite '<nombre>' excedido | ip: ... | ruta: ...')`. Límites: `login` (línea 65), `reserva` (83), `reserva-rafaga` (97), `global` (113). `limiterGlobal` corre **antes** de `tenantMiddleware` (sin tenant); `limiterLogin` y los de reserva, después.
- `backend/package.json`: `"type": "module"` (ESM), `"start": "node src/index.js"`, `"engines": { "node": "22.x" }`. Railway (Nixpacks) arranca con `npm start`.

### Railway
- CLI instalada en la PC: v5.49.3 (hay v5.71.0). **Login vencido**: el usuario tiene que correr `railway login`.
- Comandos útiles, sin streaming:
  - `railway logs --since 24h --filter "@level:error"`: logs de la app. En Node, `console.warn` y `console.error` salen por stderr y Railway los marca como error, así que el filtro trae los dos.
  - `railway logs --http --status 500..599 --since 24h`: logs del borde de Railway; incluyen el 502 de cuando la app está caída, que nunca llega al log de la app.
  - `--json` para salida estructurada; `--lines N` para las últimas N; `--service`/`--environment` para elegir.
- **No hay token de solo lectura.** El token de proyecto (`RAILWAY_TOKEN`) puede leer logs, pero también redeployar y tocar variables. Según el foro de Railway, el token de proyecto sirve para `railway logs`; los comandos `whoami`/`link` piden token de cuenta (`RAILWAY_API_TOKEN`). A verificar en la fase 4.
- Webhooks de proyecto: Settings → Webhooks, eventos de deploy fallido y crash; Railway detecta URLs de Discord y formatea el payload solo. El botón "Test Webhook" puede fallar por CORS: probar con un deploy real. Docs: https://docs.railway.com/guides/alerts-crashes-failed-deploys

### Claude Code en la nube
- Entornos de claude.ai/code: variables de entorno en formato `.env` (visibles para quien edite el entorno), script de arranque (bash, cacheado) para instalar herramientas, y nivel de acceso de red configurable (hay que permitir los dominios de Railway; a verificar cuáles, probablemente `backboard.railway.com` y `railway.com`). Las variables exportadas dentro del script de arranque no llegan a la sesión: van en el campo de variables. Docs: https://code.claude.com/docs/en/cloud-environments

---

## 4. Diseño

### 4.1 Avisos (sin tokens)

1. **Caída** — monitor de uptime contra `https://<dominio de la API en Railway>/api/health` cada 5 min → Discord (o mail/app del monitor si el plan gratis no trae Discord). Lo da de alta el usuario.
2. **Crash y deploy fallido** — webhook de proyecto de Railway → Discord. Lo configura el usuario; sin código.
3. **Errores de la app** — Sentry en el backend:
   - **`backend/src/instrument.js`** (nuevo, se carga antes que todo): `Sentry.init` solo si existe `SENTRY_DSN` (en local queda apagado, como mail y Calendar), dentro de `try/catch` para que una falla de Sentry nunca tumbe el arranque.
     - `environment`: `process.env.NODE_ENV || 'development'`.
     - `sendDefaultPii: false`.
     - `beforeSend`: borra `event.request.data` (body), `cookies`, `query_string` y el header `authorization`.
     - `tracesSampleRate: 0` (sin performance: más liviano y dentro del plan gratis).
     - `integrations`: `captureConsoleIntegration({ levels: ['error'] })`. **A verificar:** que cuando uno de los argumentos es un `Error`, el evento salga como excepción con stack (no solo como mensaje de texto). Si no, en el init se ajusta (por ejemplo, un `beforeSend` o un wrapper de `console.error` dentro de `instrument.js`), sin tocar los controllers.
     - Captura automática de excepciones no atrapadas y promesas rechazadas (integraciones por defecto del SDK).
   - **`backend/package.json`**: `"start": "node --import ./src/instrument.js src/index.js"`. En ESM, Sentry necesita cargarse antes que el resto para separar el contexto de cada request (isolation scope). Mismo cambio en `dev` si existe.
   - **`backend/src/config/sentry.js`** (nuevo, helper central; ningún otro archivo importa `@sentry/node` directo):
     - `etiquetarRequest(tags)`: pone tags en el scope del request actual (no-op sin DSN).
     - `reportarAviso(mensaje, { tags, fingerprint })`: `captureMessage` con nivel warning (no-op sin DSN).
     - Comentado según `CLAUDE.md` (qué hace, parámetros, retorno).
   - **`tenantMiddleware.js`**: al resolver el tenant, `etiquetarRequest({ tenant: subdominio, tenant_id })`.
   - **`authMiddleware.js`**: `etiquetarRequest({ rol })`.
   - **`index.js`**: `Sentry.setupExpressErrorHandler(app)` (vía el helper) al final de las rutas, para lo que escape de un controller (Express 5 pasa al handler los errores de handlers async).
   - **`jobs/recordatorios.js`**: el job recorre tenants fuera de un request; poner el tag `tenant` por tenant dentro del loop (por ejemplo con un scope por iteración, a través del helper) para que sus errores también digan de qué local son.
   - **Alertas de Sentry** (las configura el usuario en la fase 3): issue nuevo, issue que vuelve tras resuelto, pico (> 50 eventos en 1 h). Acción: Discord (o mail).
4. **Tráfico inusual** — en `crearHandler429` de `rateLimitMiddleware.js`, además del `console.warn` existente, `reportarAviso('rateLimit: <nombre>', { tags: { limite, ruta }, fingerprint: ['rateLimit', nombre] })` (más `tenant` cuando ya está resuelto, que pasa solo por el scope). Un issue por tipo de límite. Alerta: la primera vez y, si sigue, máximo una por hora (intervalo de acción de la regla de Sentry). La IP queda solo en el log de Railway, no en Sentry.

### 4.2 Diagnóstico a pedido (Claude en la nube)

5. **Skill `.claude/skills/salud-prod/SKILL.md`** (nueva, commiteada, sin secretos):
   - Pasos: `curl -s https://<api>/api/health`; `railway logs --since <ventana> --filter "@level:error"`; `railway logs --http --status 500..599 --since <ventana>`. Ventana por defecto 24 h.
   - Reporte triado, en castellano rioplatense y corto (se lee en el celular):
     1. Caídas (5xx del borde, crash del deploy).
     2. `console.error` agrupados por `[modulo]` y por tenant, con la cantidad y el primero/último.
     3. Warns que importan: rate limit (por límite), picos de logins fallidos, `tenant no encontrado` con su subdominio (ahí se ve si alguien entra por el subdominio viejo `kingsai`, pendiente en `estado_actual.md`).
     4. El resto, solo contado.
   - **Solo lectura:** nunca `railway up`, `redeploy`, `variables`, `down`, ni nada que cambie prod. Si algo pide acción, la propone y la hace el usuario.
6. **Allowlist en `.claude/settings.json`** (proyecto, commiteado): `Bash(railway logs:*)`, `Bash(railway status:*)` y el `curl` al health. Revisar el formato vigente de permisos de Claude Code al implementarlo, y que no pise un `.claude/settings.json` existente (hoy solo existe `.claude/launch.json`, que está en `.gitignore`; confirmar que `settings.json` no lo esté).
7. **Entorno de claude.ai/code** (lo configura el usuario, con instrucciones del orquestador): variable `RAILWAY_TOKEN` (token de proyecto, entorno production), script de arranque `npm i -g @railway/cli`, acceso de red a los dominios de Railway, repo de GitHub del proyecto.

---

## 5. Archivos

- `backend/package.json` (+ `package-lock.json`): dependencia `@sentry/node`; scripts `start` (y `dev`) con `--import ./src/instrument.js`.
- `backend/src/instrument.js` (nuevo), `backend/src/config/sentry.js` (nuevo).
- `backend/src/index.js`, `backend/src/middlewares/tenantMiddleware.js`, `backend/src/middlewares/authMiddleware.js`, `backend/src/middlewares/rateLimitMiddleware.js`, `backend/src/jobs/recordatorios.js`.
- `.claude/skills/salud-prod/SKILL.md` (nuevo), `.claude/settings.json` (nuevo o editado).
- Docs: `docs/plan_monitoreo_prod.md` (este documento), `docs/convenciones_tecnicas.md` §1, `docs/estado_actual.md`, `docs/ruta_proyecto.md`, `docs/decisiones_monitoreo_prod.md` (cierre), mapa de documentos del `CLAUDE.md`.
- **Sin cambios en la DB ni en los fronts.**

---

## 6. Modo de trabajo

**Un chat orquestador** con contexto limpio, que arranca leyendo este documento. Define las fases, escribe un prompt autocontenido por fase, revisa, aprueba y commitea. **Cada fase de código corre en un chat ejecutor nuevo**, en la misma carpeta (`C:\Users\facul\sistema-gestion-barberia`) y el mismo branch, sin worktrees.

### Ciclo de una fase
1. El orquestador confirma con el usuario que arranca la fase y que se cumplieron los requisitos previos (tabla §7).
2. Escribe el prompt de la fase y se lo pasa al usuario, que lo corre en un chat nuevo.
3. El ejecutor implementa, se verifica a sí mismo y termina con el reporte. **No commitea.**
4. El usuario pega el reporte en el orquestador.
5. El orquestador revisa **contra el diff real del branch** (`git diff`), no solo contra el reporte. Ajustes chicos: los hace y los verifica él. Ajustes grandes: vuelven al ejecutor con un prompt de corrección.
6. Fase aprobada → **el orquestador commitea** (un commit por fase, mensaje en castellano con el formato del repo: `feat:`/`fix:`/`chore:`/`docs:`, cuerpo explicativo y `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` al final). **Push, merge y deploy los hace el usuario**; el orquestador le pasa los comandos.
7. El usuario confirma antes de que el orquestador escriba el prompt siguiente.

### Contenido de cada prompt de fase
- Objetivo de la fase y sección de `docs/plan_monitoreo_prod.md` a leer.
- Lectura obligatoria: `CLAUDE.md` y `docs/convenciones_tecnicas.md` (§1 logs).
- Archivos por donde arrancar, **sin limitar la lectura** (el ejecutor lee lo que necesite).
- Contrato exacto (funciones, firmas, tags, comandos), qué reusar, qué **no** tocar.
- Restricciones: nada de cambios en la DB; no hacer merge, push ni commits; trabajar en la carpeta, sin worktrees; servidores locales solo en 127.0.0.1, en puertos fuera de 5173–5176, con mail y Calendar apagados, y al terminar bajar todo y confirmar que los puertos quedaron libres; ningún secreto (DSN, tokens) en el chat ni en el repo.
- Si tiene una duda de camino, consulta antes de avanzar, con preguntas numeradas y su recomendación de senior.
- Cómo se verifica (el ejecutor corre sus propias pruebas; en backend, contra el tenant demo, con controllers y req/res simulados o con el backend local, sin Bruno).
- Formato del reporte (abajo).

### Formato del reporte del ejecutor
1. **Qué se hizo.**
2. **Verificación** (qué corrió y qué dio).
3. **Lo que no se resolvió o quedó distinto** al prompt, y por qué.
4. **Cosas vistas de paso** (solo lo que le pueda pasar a un usuario real o sea riesgo real de seguridad, datos o plata; verificar antes contra los docs que no esté ya anotado).
5. **Lista de archivos tocados.**

### Convenciones del usuario que el orquestador respeta
- Preguntas de decisión **enumeradas en texto libre**, con la recomendación de senior; nunca interfaces de selección ni botones.
- Paso a paso: no avanzar sin confirmación. Los sub-pasos internos de un paso aprobado no necesitan confirmación.
- Comentar todas las funciones; centralizar helpers (`/utils`, `/config`).
- Avisar antes de implementar algo que genere deuda técnica.
- Una sola DB de Supabase (no hay staging; demo y Kingsai son filas). Este plan no toca la DB.
- Lo que se hace en Railway, Sentry, Discord, el monitor y claude.ai lo hace el usuario: el orquestador da instrucciones paso a paso.
- El resumen del chat va recién después del último commit.
- **El orquestador commitea** cada fase aprobada (ya está en la memoria `feedback_flujo_orquestador.md`). Push, merge y deploy siguen siendo del usuario.

---

## 7. Fases

| # | Fase | Quién | Requisito previo (lo hace el usuario) |
|---|---|---|---|
| 0 | ✅ **Hecha (2026-11-05).** Branch `feature/monitoreo-prod` creado desde `feature/descansos-agenda` (rebasado sobre `main` después del merge) y este plan volcado a `docs/plan_monitoreo_prod.md` (commiteado) | Chat de planificación | — |
| 1 | **Sentry en el backend** (§4.1, puntos 3 y 4): `instrument.js`, `config/sentry.js`, scripts de arranque, tags de tenant y rol, aviso del 429, tenant en el job de recordatorios, handler de errores de Express | Chat ejecutor | Crear cuenta en Sentry y un **proyecto de prueba** (no el de prod); dejar su DSN en `backend/.env` local como `SENTRY_DSN`, sin pasarlo por el chat |
| 2 | **Skill `salud-prod` + allowlist** (§4.2, puntos 5 y 6) | Chat ejecutor | `railway login` en la PC (y `railway link` al proyecto si hace falta) |
| 3 | **Configuración externa**, guiada paso a paso: server y canal de Discord con webhook; webhook de proyecto en Railway; monitor de uptime; proyecto de prod en Sentry con las alertas de §2 (10 y 10b); `SENTRY_DSN` de prod en las variables del servicio en Railway (directo en el servicio, no como shared variable sin referenciar). Deploy y prueba de cada aviso | Orquestador + usuario | Push y deploy de las fases 1 y 2 |
| 4 | **Entorno de claude.ai/code** (§4.2, punto 7) y prueba "¿cómo está prod?" desde el celular | Orquestador + usuario | — |
| 5 | **Docs de cierre**: `convenciones_tecnicas.md` §1 (todo `console.error` llega a Sentry: no usarlo para cosas que no rompen el flujo; el 429 también avisa), `estado_actual.md` (monitoreo hecho y dónde vive; pendiente "migrar Node 22 → 24/26 antes del 2027-04-30"), `ruta_proyecto.md`, `decisiones_monitoreo_prod.md`, mapa del `CLAUDE.md`; commit final y resumen | Orquestador | — |

---

## 8. Verificación

- **Fase 1 (local, contra demo, con el DSN del proyecto de prueba):**
  - Error forzado en un controller con el tenant demo → aparece en Sentry como excepción con stack, tags `tenant: demo`, `tenant_id` y `rol`; sin body, sin `Authorization`, sin IP.
  - 429 del limiter de login (por ejemplo, 11 logins operativos fallidos con curl) → issue de warning `rateLimit: login`, agrupado.
  - Error en el job de recordatorios (simulado) → evento con su tenant.
  - Sin `SENTRY_DSN`: el backend arranca igual y no manda nada. `node --check` OK en los archivos tocados.
  - El comando de arranque nuevo funciona con `npm start`.
- **Fase 2:** correr la skill contra prod; el reporte coincide con el dashboard de Railway en la misma ventana. La allowlist deja correr `railway logs` sin pedir permiso y no habilita otros comandos de Railway.
- **Fase 3:** el deploy dispara el webhook de Railway a Discord; una alerta de prueba del monitor llega a Discord; un error real (o de prueba) en prod llega desde Sentry con el tenant.
- **Fase 4:** desde el celular, en la sesión en la nube, "¿cómo está prod?" devuelve el reporte de la skill.
