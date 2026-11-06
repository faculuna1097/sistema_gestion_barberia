# Monitoreo de producción — núcleo de decisiones

> ✅ **Completado (2026-11-06); en producción.** Documento **archivado**: solo el "por qué".
> El plan completo, con las fases y lo verificado en cada una, es [`plan_monitoreo_prod.md`](plan_monitoreo_prod.md).
> Cómo está armado hoy: [`estado_actual.md`](estado_actual.md) → "Monitoreo de producción".
> Cómo se escribe código con esto: [`convenciones_tecnicas.md`](convenciones_tecnicas.md) §1 → "Backend — Sentry".
> Implementación: `backend/src/instrument.js`, `backend/src/config/sentry.js`, los middlewares de tenant, auth y rate limit,
> `jobs/recordatorios.js`, `.claude/settings.json` y `.claude/skills/{salud-prod,arreglo-prod}/`.

## Problema que resolvió

Para saber si producción andaba bien había que entrar al dashboard de Railway desde la PC. Una caída, un error o un
abuso se descubrían cuando se quejaba un cliente. Y para arreglar algo había que estar en la computadora.

Quedaron tres capas:
1. **Enterarse sin preguntar:** avisos al celular por Discord, sin usar Claude ni gastar tokens.
2. **Diagnosticar a pedido:** "¿cómo está prod?" desde el celular, con Claude en la nube leyendo los logs.
3. **Resolver desde el celular:** "arreglalo", con Claude analizando el error contra el código; nada llega a producción sin un toque del usuario.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Avisos | **Por evento**, a un canal privado de Discord. Ninguno usa Claude. Sin reporte diario | Un LLM no es buena alarma (cuesta y demora); el usuario no quiere depender de preguntar |
| Caída total | **UptimeRobot** gratis contra `/api/health` cada 5 min | Es lo único que avisa si el backend no responde. Permite uso comercial en el plan gratis (Better Stack lo limita a proyectos personales y no trae Discord) |
| Crash y deploy fallido | **Webhook de proyecto de Railway**, solo eventos `failed` y `crashed` | Sin código. Con todos los eventos de deploy sería un mensaje por etapa y por servicio |
| Errores de la app | **Sentry** (`@sentry/node` 11, plan gratis) | Agrupa repeticiones, trae el stack y tiene reglas de alerta. Hacerlo a mano obligaba a programar agrupación y throttling |
| Qué llega a Sentry | **Todo `console.error`**, automático (`captureConsoleIntegration`), sin tocar los `catch` | No había handler de errores ni `next(err)`: la alternativa era tocar ~90 `catch` en 51 archivos. La convención existente (`console.error` = se rompió el flujo) pasó a ser el contrato, y los dos rechazos esperados que usaban `console.error` (token vencido, 403 por rol) pasaron a `console.warn` |
| Tenant y privacidad | El tenant y el rol van como **tags**, puestos una vez en los middlewares. **No** van body, cookies, query string, headers fuera de una lista blanca, IPs ni el `token_gestion` | El usuario quiere saber qué local tiene el problema; los datos personales no hacen falta para eso. En la v11 de Sentry, `sendDefaultPii` ya no existe y por defecto se recolecta todo: se apaga en `dataCollection` y `beforeSend` limpia cada evento como segunda red |
| Tráfico inusual | Los **cortes del rate limiter** avisan a Sentry, un issue por tipo de límite, como mucho un aviso por hora | El rate limiter ya es la definición del sistema de tráfico anormal |
| Reglas de Sentry | Issue nuevo, issue que vuelve tras resuelto, pico (> 50 en 1 h) y rate limiter que sigue | Avisa lo nuevo y lo que se dispara, no cada repetición |
| Carga de Sentry | Web: `node --import ./src/instrument.js` en el `start` (Railway corre `npm start`). Jobs: `instrument.js` como primer import y `vaciarEventos` antes del `process.exit` | En ESM, Sentry tiene que cargarse antes que Express para separar el contexto de cada request. Un job que termina con `process.exit` pierde los eventos si no vacía la cola |
| Diagnóstico | Skill **`salud-prod`**, de solo lectura, en una sesión de **claude.ai/code** desde el celular | Tiene que andar con la PC apagada. Railway guarda los logs **por deployment** y `--since` no cruza un deploy: la skill lee cada deployment vivo en la ventana |
| Modelo | **Sonnet** | En la prueba, Haiku se salteó el deployment vivo al inicio de la ventana (no vio 8 errores) e inventó un dato. Sonnet llegó al mismo resultado que Opus |
| Resolver | Skill **`arreglo-prod`**. Código: la sesión arma el arreglo en un branch `fix/…` y abre el PR; el usuario toca **Merge** en la app de GitHub. Operativo: el usuario reinicia o vuelve al deploy anterior en railway.com. Datos: la sesión arma el SQL y el usuario lo corre en Supabase | El usuario no quiere depender de la PC y nunca revisó un PR: aprueba lo que charló con Claude, y el Merge es su "sí, a producción". El rollback de Railway deshace cualquier deploy |
| Límite de arreglar desde el celular | Solo arreglos **chicos y claros** (criterio concreto en la skill). Lo grande o dudoso: rollback y PC | En la nube no hay acceso a la DB, y no tiene que haberlo (es la de producción): el arreglo se razona pero no se prueba contra demo |
| Garantías | **Ruleset `proteger-main`** en GitHub (exige PR, sin excepciones) y lista **`deny`** en `.claude/settings.json` con los comandos de Railway que escriben y el merge de PRs | Se comprobó que en la nube el modo Accept edits **no** pide permiso para ningún comando, así que una regla escrita en la skill no alcanzaba. El token de Railway de la nube puede deployar y tocar variables: no hay uno de solo lectura. Las reglas `deny` frenan el error de buena fe, no a quien quiera esquivarlas |
| Flujo a `main` | **Siempre por PR**, también desde la PC | La excepción del ruleset para el dueño del repo no lo cubrió (su `git push origin main` fue rechazado), y una excepción que figura pero no se aplica confunde. Se sacó |
| Alcance | Solo el backend en Railway | Los fronts son estáticos en Vercel; si Supabase falla, aparece en los `console.error` del backend |

## Lo que apareció en el camino

- **Bug del rate limiter** (pendiente en `estado_actual.md`): `trust proxy` en 1 toma como IP del cliente la de un proxy interno de Railway. Apareció al probar el aviso del 429.
- **`token_gestion` en los logs:** el log de acceso y el del 429 escribían la URL completa del turnero. Se enmascara (`enmascararTokenTurnero`), porque la sesión de Claude en la nube lee esos logs.
- **Start command:** los docs decían `node src/index.js`, pero Railway corre `npm start`. Se corrigió con el primer arreglo hecho desde el celular (PR #4).
- **Límite del plan gratis de Sentry:** 5.000 errores por mes. Si un bug genera miles, Sentry deja de registrar hasta el mes siguiente (no cobra); los logs de Railway siguen teniendo todo.
