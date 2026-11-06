---
name: salud-prod
description: Diagnóstico de solo lectura de la salud de producción (backend en Railway). Usala cuando el usuario pregunte "¿cómo está prod?", "¿qué pasó?", "¿anduvo todo bien hoy?", "¿se cayó algo?", "¿hubo errores?", "¿corrió el recordatorio?", o cuando llegue o pegue un aviso de Discord (uptime, crash o deploy fallido de Railway, Sentry, rate limit). Lee el health, los deployments y los logs de Railway de una ventana (24 h por defecto, u otra que pida, como "la última hora") y devuelve un reporte corto para leer en el celular.
---

# salud-prod — ¿cómo está producción?

Diagnóstico de **solo lectura** del backend en Railway. Funciona igual en la PC
(CLI logueada y linkeada) y en una sesión en la nube (sin `railway link`, con
`RAILWAY_TOKEN` de proyecto en el entorno): por eso **todos** los comandos pasan
`--service <id>` y `--environment production` explícitos, y nunca se usa
`railway link` ni `railway whoami`.

## Reglas (no negociables)

1. **Solo lectura.** Únicos comandos de Railway: `railway logs`, `railway status`
   y `railway deployment list`. **Nunca** `railway up`, `deploy`, `redeploy`,
   `deployment up`, `deployment redeploy`, `variables`, `down`, `restart`,
   `link`, `service`, `domain`, `environment`, `run`, `shell`, `ssh`, `connect`,
   `setup`, `upgrade` ni nada que cambie prod. Si el diagnóstico pide una acción
   (redeployar, cambiar una variable), **la proponés** y la hace el usuario.
2. **Privacidad.** Los logs traen nombres, teléfonos y mails de clientes (cuerpos
   de request, recordatorios) e IPs (rate limiter, log HTTP). En el reporte
   **no van**: se cuentan, no se copian. Tampoco IDs de barbero ni de cliente.
   El tenant (subdominio) sí va.
3. **Sin inventar.** Si un comando falla (token vencido, red, CLI ausente), lo
   decís con el error tal cual (sin tokens) y qué falta para seguir. No
   completes el diagnóstico con suposiciones.
4. **Comandos tal cual, de a uno.** `.claude/settings.json` permite sin
   preguntar `railway logs *`, `railway deployment list *` y el curl exacto del
   paso 2. Cualquier otra forma pide permiso (en el celular, un cartel por
   comando):
   - un `railway logs` por deployment, cada uno en su propio comando;
   - nada de bucles (`for`, `while`), `sed`, `awk`, `xargs`, `sh -c` ni
     variables antepuestas (`FOO=x railway ...`);
   - para filtrar o contar, solo `| grep`, `| wc`, `| head` o `| cut` (probado:
     `railway logs ... | wc -l` corre sin preguntar); el resto del filtrado lo
     hacés leyendo la salida;
   - nada que escriba archivos.

## Datos fijos

| Qué | Valor |
|---|---|
| Entorno | `production` (proyecto `splendid-gentleness`) |
| Servicio web | `sistema_gestion_barberia`, id `10751410-aa76-4e77-89d7-8c0d55da8612` |
| URL de la API | `https://sistemagestionbarberia-production.up.railway.app` |
| Servicio cron | `CRON Recordatorio Turno`, id `96e77904-be60-4d8c-98be-3c84808fcc38` |
| Horario del cron | `30 23 * * *` UTC = 20:30 de Argentina, todos los días |

Abajo, `WEB` y `CRON` son esos ids: escribilos literales en cada comando.

## Cómo funcionan los logs de Railway (comprobado contra prod, 2026-11-06)

- **Todo log es por deployment**, también el HTTP del borde (`--http`). Sin
  `DEPLOYMENT_ID`, `railway logs` lee solo el último deployment exitoso, y
  `--since` filtra *dentro* de ese deployment: si hubo un deploy dentro de la
  ventana, lo anterior no aparece. Por eso hay que leer **cada** deployment vivo
  en la ventana, pasándolo como argumento: `railway logs <DEPLOYMENT_ID> ...`.
- **Niveles:** Railway solo marca `info` y `error`. En Node `console.warn` y
  `console.error` salen los dos por stderr, así que `--filter "@level:error"`
  trae **los dos mezclados** (no hay `warn`). Se separan por el texto (ver paso 5).
- Un `console.error(msg, err)` deja **una línea por renglón del stack**: el
  encabezado (`[modulo] Error en ...` o `Error: ...`) y después líneas que
  empiezan con espacios + `at `. Un error = el encabezado; las `at ...` no se
  cuentan aparte.
- La salida de texto no trae hora: usá `--json` (cada línea trae `timestamp` en
  UTC, `level` y `message`; las HTTP traen `method`, `path`, `httpStatus`).
- La línea de acceso (`[index] GET /api/...`) es `info` y no trae el tenant
  (viaja en el header `X-Tenant-Subdomain`). El tenant figura en el log solo
  cuando la línea lo dice (`tenant:` o `subdominio:`). Si no figura, se dice
  "sin tenant en el log"; Sentry sí lo tiene como tag.

## Pasos

### 1. Ventana
24 h por defecto; si el usuario pide otra ("la última hora", "desde anoche",
"hoy"), usá esa. `--since` acepta `30m`, `1h`, `24h`, `2d`. Tomá la hora actual
con `date -u` y anotá el inicio de la ventana en UTC. Mostrá horas en Argentina
(UTC−3).

### 2. Health
```bash
curl -s -m 15 -i https://sistemagestionbarberia-production.up.railway.app/api/health
```
Bien = `HTTP/... 200` y cuerpo `{"status":"ok",...}`. Cualquier otra cosa
(timeout, 5xx, sin cuerpo) es caída o degradación: va primero en el reporte.

### 3. Deployments de la ventana (web y cron)
```bash
railway deployment list --service WEB --environment production --limit 20
railway deployment list --service CRON --environment production --limit 20
```
Cada fila: `id | STATUS | fecha con zona`. Vienen del más nuevo al más viejo.
Los **deployments de la ventana** son: todos los creados dentro de la ventana,
más el último no fallido creado **antes** del inicio (era el que estaba vivo al
arrancar la ventana; hoy figura `REMOVED`, es normal).
- `FAILED` / `CRASHED` dentro de la ventana → se reporta en Caídas.
- Que un deployment viejo quede `REMOVED` al llegar uno nuevo es lo normal.
- Si los 20 son todos de la ventana, pedí `--limit 50`.

### 4. Web: cortes del borde (5xx), por deployment
```bash
railway logs <DEPLOYMENT_ID> --http --status 500..599 --service WEB --environment production --since <ventana> --json
```
Incluye el 502 de cuando la app está caída (nunca llega al log de la app).
Agrupá por `httpStatus` y `path` (sin query string), con cantidad y
primera/última hora. No copies `srcIp` ni `clientUa`.

### 5. Web: errores, warns y arranques, por deployment
```bash
railway logs <DEPLOYMENT_ID> --service WEB --environment production --since <ventana> --json --filter "@level:error OR \"Starting Container\""
```
Clasificá cada línea:

- **Arranques / crash:** cada deployment web arranca **una** vez
  (`Starting Container`). Más de un arranque en el mismo deployment = el proceso
  se cayó y Railway lo reinició (política ON_FAILURE): es **crash**, va en
  Caídas con la hora y las líneas de error previas. También es crash
  `[index] ❌ Error fatal al iniciar el servidor`.
- **Ruido de npm, normal:** `npm warn config production ...` (al arrancar) y el
  bloque `npm error signal SIGTERM` / `npm error command failed` /
  `npm error path /app` / `npm error command sh -c ...` / `npm error A complete
  log ...` **justo cuando entra el deployment siguiente** (Railway apaga el
  viejo). Solo contalo. Si ese bloque aparece en el deployment vigente sin un
  deploy nuevo, o con `code 1` en vez de `signal SIGTERM`, es crash.
- **Ruido de arranque, normal** (web y cron): `[googleCalendar] credenciales NO
  cargadas` y `(node:1) DeprecationWarning: ...` con su `(Use \`node
  --trace-deprecation ...\`)`. Solo contalo. En cambio `[mailer] credenciales NO
  cargadas` (no salen mails) y `[jwt] JWT_SECRET no está definida` (no anda
  ningún login) **importan**: van en Caídas.
- **Warns** (`console.warn`: anómalo pero recuperable). Los conocidos:
  - `[rateLimit] límite '<nombre>' excedido | ip: ... | ruta: ...` → corte del
    rate limiter. Importa: contá por límite (`login`, `reserva`,
    `reserva-rafaga`, `global`) y por ruta. La IP no va.
  - Logins fallidos: `[authPanel] loginPanel — PIN no reconocido | tenant: <uuid>`,
    `... — PIN ambiguo`, `... — tenant no encontrado o inactivo`,
    `... — suscripción vencida`, `[authBarbero] loginBarbero — PIN incorrecto`
    o `— barbero no encontrado o inactivo`, `[gestion] cambiarPinAdmin — PIN
    actual incorrecto`. Importa si hay **pico** (≥ 10 en una hora, o el rate
    limiter de `login` saltó).
  - `[tenantMiddleware] tenantMiddleware — subdominio no resuelve a un tenant
    activo | subdominio: <x>` → importa: reportá **el subdominio** y la cantidad
    (si es `kingsai`, alguien entra por el subdominio viejo).
  - `[authMiddleware] verificarToken — firma inválida o token expirado`,
    `[requiereRol] Acceso denegado`, `[plataformaAuth] clave de plataforma
    inválida` → solo contar, salvo que sean cientos.
  - Conflictos de negocio (`slot ocupado`, `stock insuficiente`, `estado no
    cancelable`, `fuera del horario`, `feriado`, `error de dominio`, `cambió de
    estado antes del UPDATE`, `ya vinculado a otro corte`, `no encontrado`),
    `[db] query falló por error de conexión, reintentando` y los `saltado:` de
    `[mailer]` / `[googleCalendar]` → solo contar. Muchos `[db] ... reintentando`
    seguidos sí importan (la DB está inestable).
  - Si una línea no está en esta lista y no sabés si es warn o error, buscá el
    texto en el código (`grep -rn "<fragmento>" backend/src`): `console.warn` o
    `console.error` decide.
- **Errores** (`console.error`: algo rompió el flujo, la request dio 500). Todo
  lo demás: `[modulo] Error en <funcion>: ...`, `[modulo] <funcion> — fallo ...`,
  `Error: ...` sin prefijo (escapó de un handler) y sus líneas `at ...`.
  Agrupá por `[modulo]` + función + primer renglón del mensaje (sin datos de
  clientes), con cantidad, primera y última hora, y tenant si la línea lo trae.

### 6. Cron: corridas de la ventana, por deployment
```bash
railway logs <DEPLOYMENT_ID> --service CRON --environment production --since <ventana> --json --filter "\"lote completo\" OR @level:error OR \"Starting Container\""
```
- Cada noche hay un `Starting Container` y, unos minutos después, una línea
  `[recordatorios] job — lote completo | tenants_con_recordatorio: N | enviados: N | salteados: N | fallidos: N | ya_reclamados: N`
  (la de `[recordatorios] procesarRecordatorios — lote completo` es la misma
  corrida: contá una sola por noche, la de `job`).
- La corrida de una noche está en el deployment que estaba vivo a las 23:30 UTC
  (si se deployó después, está en el anterior).
- Por cada 23:30 UTC que caiga dentro de la ventana (con 15 min de margen),
  tiene que haber una corrida. **Una noche sin corrida es un problema** (va en
  Caídas o en Cron, bien visible).
- Problemas: `fallidos > 0`, `[recordatorios] job — fallo catastrófico del lote`,
  `fallo procesando tenant | tenant: <x>`, `error procesando turno`. Los warns
  `saltado (cliente sin email)` (traen el nombre del cliente: no lo copies),
  `claim perdido` y `envío falló` se cuentan por tenant.

## Reporte

Castellano rioplatense, corto, para leer en el celular. Horas en Argentina.
Encabezado: `Prod — <ventana> (<desde> a <hasta>)`. Secciones en este orden,
salteando las vacías salvo Caídas y Cron:

1. **Caídas** — health; 5xx del borde; deploys fallidos; crash/reinicios. Si no
   hubo: "Sin caídas (health OK, 0 5xx)".
2. **Errores** — por `[modulo] funcion`: cantidad, primera/última hora, tenant
   (o "sin tenant en el log"), y en una línea qué parece ser.
3. **Warns que importan** — rate limiter por límite; picos de logins fallidos;
   subdominios que no resuelven (con el subdominio).
4. **Cron** — por noche: corrió o no, con sus números (`enviados`, `salteados`,
   `fallidos`, `ya_reclamados`).
5. **El resto** — solo contado ("12 warns de negocio, 3 de token vencido, ruido
   de npm de 2 deploys").

Si está todo bien, alcanza con una línea: "Todo bien en las últimas 24 h:
health OK, sin 5xx ni errores, el recordatorio corrió (X enviados)."
Si proponés una acción, cerrá con "Para hacer (vos): ..." — nunca la ejecutes.

Si el usuario quiere resolver lo que encontraste, seguí con la skill `arreglo-prod`.
