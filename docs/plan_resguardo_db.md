# Plan: resguardo de la base de datos

> **En curso (desde 2026-11-11).** Branch `chore/resguardo-db`, que sale de `main`
> **después** de que se mergee `feature/alta-clientes`.
> Este documento es autocontenido: lo lee un chat orquestador con contexto limpio y
> los chats ejecutores de cada fase. Al cerrar, el núcleo de decisiones se resume en
> `docs/decisiones_resguardo_db.md` y este plan queda archivado.

---

## 1. Contexto y objetivo

Hay **una sola base de datos** (Supabase, plan Free) y en ella viven todos los tenants:
Kingsai (cliente real) y demo (pruebas) son filas de las mismas tablas. No hay
staging: los cambios de schema van directo a producción.

El 2026-11-11 el usuario preguntó si Claude puede escribir en la base, porque hay
casos públicos de agentes de IA que borraron bases de producción. La respuesta fue
que **sí**, y además se encontró que hoy **no existe ninguna copia de la base**.

**Objetivo:** que un error, ya sea de Claude, del usuario, de un bug o de Supabase,
no pueda hacer perder los datos de los clientes, **sin quitarle a Claude libertad
ni comodidad** para escribir código y consultar información. Esto último es un
requisito explícito del usuario: ninguna medida tiene que meter ida y vuelta en el
trabajo de todos los días.

### Riesgo real que se ataca

No es que Claude "decida" borrar la base. Es una prueba contra demo con un `WHERE`
mal armado, por ejemplo sin el filtro de `tenant_id`, que pise o borre filas de
Kingsai. También es un `DROP`/`TRUNCATE` corrido sin querer con credenciales de dueño.

---

## 2. Hechos verificados (2026-11-11)

| Hecho | Dónde |
|---|---|
| El backend se conecta a Postgres con `pg` y el usuario **dueño** de la base (`postgres`), por el Session Pooler (puerto 5432), con la CA de Supabase y `max: 3` | `backend/src/config/db.js:53-63` |
| `db.js` llama a `dotenv.config()`, que **no pisa** variables ya cargadas | `backend/src/config/db.js:9` |
| Ningún archivo de `backend/src` corre DDL (`ALTER`, `CREATE`, `DROP`, `TRUNCATE`, `LOCK`) | grep sobre `backend/src` |
| El cliente de Supabase con la `SUPABASE_SERVICE_ROLE_KEY` se usa **solo para Storage** (imágenes): ninguna llamada a `.from()` ni `.rpc()` sobre tablas | `backend/src/services/storageService.js`, grep |
| RLS está activo y **sin policies** en las 19 tablas. El backend lo saltea porque entra como owner | `docs/SQL_Schema.md:17-22` |
| Las 3 vistas `web_*` las lee la web de Kingsai con el rol `anon`, por la API de Supabase | `docs/SQL_Schema.md` (final) |
| Los 9 triggers `web_deploy_*` ejecutan `web_deploy_kingsai()`, que es `SECURITY DEFINER` y usa `pg_net`. Viven **solo en la DB**, no en el repo | `docs/SQL_Schema.md:399-421` |
| Extensiones en uso: `btree_gist` (EXCLUDE de `turno`) y `uuid_generate_v4()` en los defaults | `docs/SQL_Schema.md:4-7` y `CREATE TABLE` |
| Hay **dos servicios de Railway** que usan las credenciales de la DB: el web service y el cron de recordatorios (`node src/jobs/recordatorios.js`) | `docs/decisiones_mail_recordatorio.md:24` |
| Las shared variables de Railway no se inyectan solas: hay que referenciarlas desde cada servicio | memoria `project_railway_backend_deploy` |
| El repo es **público** en GitHub y no tiene workflows (`.github/workflows` no existe) | `gh repo view` |
| `backend/.gitignore` ignora `.env`, `.env.local` y `.env.production`, no `.env.*` en general | `backend/.gitignore` |
| `psql` no está instalado en la PC; Node sí | `command -v psql` |
| La lista `deny` de `.claude/settings.json` bloquea los comandos de Railway que escriben y el merge de PRs, **nada de la base** | `.claude/settings.json` |
| Plan Free de Supabase: **no incluye backups** ("Upgrade to the Pro Plan for up to 7 days of scheduled backups") | dashboard, dato del usuario |
| Los avisos de producción llegan a un canal privado de Discord: UptimeRobot, el webhook de Railway y Sentry (plan gratis) | `docs/decisiones_monitoreo_prod.md:24-27` |
| Las verificaciones de backend las corre Claude con scripts en el scratchpad que importan los controllers, desde `backend/` para que dotenv lea el `.env`, y escriben en el tenant demo | memoria `feedback_verificacion_backend_demo` |
| La skill `alta-cliente` tiene 3 scripts que leen la base con el `query` de `src/config/db.js` (hacen `chdir` a `backend/` y usan el `.env`): `leerSolicitud.mjs` y `verificarAlta.mjs` solo hacen `SELECT`; `armarQuery.mjs` hace dos `SELECT` y un `EXPLAIN` (sin `ANALYZE`) de la query de alta, que tiene `INSERT` en 8 tablas, un `UPDATE` de `solicitud_alta` y llama a `extensions.crypt`. La skill nunca escribe: la query la corre el usuario en el SQL Editor | `.claude/skills/alta-cliente/*.mjs`, `plantilla_alta.sql` |

**Diagnóstico de la fase 0 (2026-11-11, solo lectura, con el rol `postgres`):**

| Hecho | Consecuencia |
|---|---|
| **PostgreSQL 17.6** | El workflow de la fase 2 instala el cliente 17 desde PGDG |
| Tamaño de la base: **15 MB** | El dump cifrado es chico: 30 diarios + 12 mensuales entran holgados en los 10 GB de B2 |
| `postgres`: `rolsuper = false`, `rolbypassrls = true`, `rolcreaterole = true` | Puede crear roles con `BYPASSRLS` (desde Postgres 16 hace falta tenerlo para darlo). Las fases 1 y 5 van **con `BYPASSRLS`, sin policies** |
| `public`: **19 tablas, 3 vistas, 0 secuencias** (los ids son uuid), **6 funciones** propias (1 `SECURITY DEFINER`) y **9 triggers** no internos | Base para validar la restauración de la fase 3 |
| `btree_gist` está instalada **en `public`**; `pgcrypto`, `uuid-ossp` y `pg_net` en `extensions`; `supabase_vault` en `vault` | Al restaurar (fase 3), `btree_gist` se crea `WITH SCHEMA public` (el dashboard la propone en `extensions`) y `uuid-ossp` en `extensions`. Las funciones de `btree_gist` son de la extensión, así que no viajan en el dump |
| `USAGE` en el schema `extensions`: solo `postgres`, `anon`, `authenticated`, `service_role` y `dashboard_user`. **`PUBLIC` no lo tiene** | Hace falta `GRANT USAGE ON SCHEMA extensions` a `resguardo_lectura` (fase 1, por `extensions.crypt`) y a `app_backend` (fase 5, por `uuid_generate_v4()`) |
| `resguardo_lectura` y `app_backend` **no existen** todavía | Se crean en las fases 1 y 5 |

**Verificado en la fase 1 (2026-11-11), con `resguardo_lectura` creado:**

| Hecho | Consecuencia |
|---|---|
| El Session Pooler acepta el rol propio con el usuario `resguardo_lectura.<project_ref>` (con un `postgres.` de más en el medio responde `EAUTHQUERY user not found`) | El `.env.lectura` solo cambia `DB_USER` y `DB_PASSWORD`; host, puerto y base salen del `.env` |
| `count(*)` de las 19 tablas igual con `resguardo_lectura` que con el dueño (3819 filas) | `BYPASSRLS` funciona: RLS no lo filtra |
| `INSERT`/`UPDATE`/`DELETE` fallan con `25006` (transacción de solo lectura). Con el modo apagado a mano, fallan con `42501` (sin permiso), igual que `TRUNCATE` y `CREATE TABLE` | Dos capas: aunque alguien apague el modo solo lectura, no tiene permisos |
| `EXPLAIN` de un `INSERT` da `42501`; `PREPARE` + `DEALLOCATE` del mismo `INSERT` con `extensions.crypt` pasa, y con una columna inexistente da `42703` | Confirma el cambio de `armarQuery.mjs` de `EXPLAIN` a `PREPARE` |
| `db.js` hace `SET statement_timeout = 5000` en cada conexión, que pisa los 30 s del rol | Esperado: los 30 s quedan para conexiones que no usan `db.js` |

**Por verificar en la fase 2:** cuántos monitores de Sentry Crons trae el plan gratis.

---

## 3. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Backup propio diario** con `pg_dump` desde un **GitHub Action** programado | El plan Free no trae backups. GitHub Actions es gratis e ilimitado en repos públicos, corre fuera de Railway y no suma un servicio a mantener. Railway Cron era la alternativa, pero cuesta créditos y hay que armar una imagen con `pg_dump` |
| D2 | Se copia **solo el schema `public`**: tablas, datos, triggers, vistas y funciones. **Storage queda afuera** | Decisión del usuario: las barberías tienen sus fotos guardadas y se vuelven a subir. Los triggers `web_*` solo viven en la DB, así que el dump es además su única copia |
| D3 | Destino: **Backblaze B2**, bucket privado | Tiene 10 GB gratis, una API compatible con S3 (sirve el `aws` CLI que ya viene en los runners de GitHub) y claves que **suben pero no pueden borrar** |
| D4 | La clave de B2 que usa el Action solo tiene permiso `writeFiles`, sin `deleteFiles` ni lectura | Si se filtra, nadie puede borrar ni leer los backups. Los borra B2 solo, con reglas de ciclo de vida |
| D5 | Retención: `diarios/` 30 días, `mensuales/` (el del día 1) 365 días. Corre a las **04:00 ART** (`0 7 * * *` UTC; Argentina no tiene horario de verano) | Decisión del usuario. Dos prefijos con su regla de ciclo de vida cada uno |
| D6 | **Cifrado con `age`** antes de subir. La clave pública va en el workflow y la privada la guarda el usuario en dos lugares: su Google Drive y una copia local fuera del repo | Los dumps tienen teléfonos y mails de los clientes de las barberías, datos de terceros. En el día a día no cuesta nada. El riesgo es perder la clave privada: por eso van dos copias y la prueba de restauración la usa |
| D7 | **Aviso si el backup no corre** (no solo si falla), con **Sentry Crons**. Si el plan gratis no trae un monitor libre, va **healthchecks.io** (gratis, integra Discord) | En repos públicos, GitHub desactiva solos los workflows programados tras 60 días sin actividad en el repo: el backup dejaría de correr sin fallar. UptimeRobot no sirve: el monitoreo por "heartbeat" es de los planes pagos. Sentry ya avisa a Discord y suma una herramienta menos |
| D8 | **Restauración probada** en un **segundo proyecto Free** de Supabase, con un instructivo en `docs/restaurar_db.md`. La prueba la **corre el usuario** siguiendo el instructivo, con Claude guiando | Un backup que nunca se restauró no cuenta. El día del accidente lo va a correr el usuario, así que el simulacro es suyo y sirve para corregir el instructivo |
| D9 | **Rol de solo lectura** `resguardo_lectura` para las consultas de Claude y para el `pg_dump` | La credencial que queda en GitHub no puede escribir aunque se filtre. Las consultas de Claude siguen igual de cómodas |
| D10 | **Hook `PreToolUse`** que bloquea SQL destructivo, solo en comandos que pueden llegar a la base | Ataja el error sin querer. Analizando solo esos comandos (no `grep`, `git`, `cat`) no hay falsos positivos en el trabajo normal (requisito del usuario). Bloquea, no pregunta: ese SQL lo corre el usuario en el SQL Editor |
| D11 | **Rol restringido** `app_backend` para el backend (local y Railway): lee y escribe filas, **no es dueño**, así que no puede `DROP`, `TRUNCATE` ni `ALTER` | Saca la capacidad de borrar tablas en las pruebas contra demo y en producción, por ejemplo ante una inyección de SQL. Los cambios de schema ya los corre el usuario en el SQL Editor, así que no cambia nada de su flujo |
| D12 | Se **cierran los permisos de `service_role`, `anon` y `authenticated` sobre las tablas de `public`**, salvo `SELECT` de `anon` en las 3 vistas `web_*` | Con la service role key, la API REST de Supabase puede borrar cualquier tabla y esa clave está en `backend/.env`. El backend solo la usa para Storage, que vive en otro schema |
| D13 | Al terminar D11, se **rota la contraseña de `postgres`** y las credenciales de dueño salen de `backend/.env` | Así el valor viejo que estuvo en la PC queda muerto. Las credenciales de dueño quedan solo en el dashboard de Supabase, para el usuario |
| D14 | **No** se prohíbe leer `backend/.env` | Molestaba en el trabajo diario, por ejemplo para ver los nombres de las variables, y pierde peso cuando el `.env` ya no tiene las credenciales de dueño |
| D15 | **No** se contrata el plan Pro por ahora | Decisión del usuario. Igual haría falta el backup propio, porque los backups de Pro viven dentro de Supabase. Se revisa con más clientes |

### Límites conocidos (aceptados)

- Con un backup diario se puede perder **hasta 24 h** de datos. Lo que achica esa
  ventana es PITR (recuperación a un momento exacto), que es del plan Pro y se paga aparte.
- `app_backend` puede hacer `DELETE`/`UPDATE` de filas: un bug de la app podría
  borrar datos. Lo cubre el backup (D1), no los permisos.
- El hook se puede esquivar a propósito. Frena el error de buena fe, igual que la
  lista `deny`.

---

## 4. Reglas de seguridad para todos los chats de este plan

- **Claude nunca escribe contraseñas ni claves.** Las genera el usuario y las pega él
  en el SQL Editor, en los `.env`, en GitHub, en B2 y en Railway. El SQL que arma
  Claude lleva marcadores (`<CONTRASEÑA_LECTURA>`). Para generar una contraseña, el
  usuario corre en su terminal:
  `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.
- **Nada sensible en el repo, que es público:** ni el project ref de Supabase, ni
  hosts, ni nombres de bucket ni URLs de check-in. Todo eso va en secrets de GitHub.
- El SQL sobre roles y permisos lo **corre el usuario** en el SQL Editor. Claude lo
  arma y después verifica con consultas de solo lectura.
- Los cambios en Railway los hace el usuario (la lista `deny` lo garantiza).
- Push, PRs y merge los hace el usuario. A `main` se entra siempre por PR.

---

## 5. Modo de trabajo

- **Orquestador:** arranca con contexto limpio y lee este plan. Por fase arma el
  prompt del ejecutor (o el SQL y la guía para el usuario), revisa el diff real del
  branch, hace los ajustes chicos y **commitea** cada fase aprobada.
- **Ejecutores:** un chat por fase de código, misma carpeta y mismo branch. No
  commitean. Terminan con un reporte que el usuario pega en el orquestador.
- **En el orquestador quedan:** el SQL que corre el usuario, las guías de cuentas
  externas (B2, Sentry, GitHub, Railway), la prueba de restauración y los docs finales.
- Cada prompt lleva: objetivo, sección de este plan, archivos por donde arrancar
  (lista abierta, el ejecutor lee lo que necesite), contrato, qué reusar, qué no
  tocar, cómo se verifica y formato del reporte.
- **Las fases van en orden** y cada una espera el OK del usuario. Orden: 0 → 1 → 2
  → 3 → 4 → 5 → 6. El backup (fases 1-3) va primero para que los pasos siguientes ya
  tengan una red debajo.

---

## 6. Fases

### Fase 0 — Preparación (orquestador)

1. Con `feature/alta-clientes` ya mergeada, crear `chore/resguardo-db` desde `main`
   actualizado. Este plan se escribió sin commitear en otro branch: hay que llevarlo.
2. Agregar este plan al mapa de documentos de `CLAUDE.md`.
3. Diagnóstico de solo lectura, con las credenciales actuales: versión de Postgres
   (`select version()`), tamaño (`pg_database_size`), atributos del rol actual
   (`select rolsuper, rolbypassrls, rolcreaterole from pg_roles where rolname = current_user`)
   y cantidad de tablas, vistas y secuencias de `public`. Anotar los resultados en §2.
4. Commit: plan + `CLAUDE.md`.

### Fase 1 — Rol de solo lectura (D9)

> **Hecha (2026-11-11).** Rol creado con `BYPASSRLS` (sin policies), `CONNECTION
> LIMIT 3` y `NOINHERIT`. Los scripts quedaron en `backend/src/scripts/`, junto a los
> otros CLI versionados (`backend/scripts/` sigue siendo la carpeta ignorada de
> scripts de un solo uso). `conectarLectura()` además confirma con `current_user`
> que el pool quedó con el rol de lectura y corta si no. Lo verificado, en §2.

**SQL (lo arma el orquestador, lo corre el usuario):**

- `CREATE ROLE resguardo_lectura LOGIN PASSWORD '<CONTRASEÑA_LECTURA>'`, con
  `BYPASSRLS` si el diagnóstico de la fase 0 indica que se puede.
- `ALTER ROLE resguardo_lectura SET default_transaction_read_only = on` y un
  `statement_timeout` de 30 s.
- `GRANT USAGE ON SCHEMA extensions` (para el `PREPARE` de `armarQuery.mjs`; ver
  Código). La fase 0 confirmó que `pgcrypto` vive ahí y que `PUBLIC` no lo tiene.
- `GRANT USAGE ON SCHEMA public`, `GRANT SELECT ON ALL TABLES IN SCHEMA public` y
  `GRANT SELECT ON ALL SEQUENCES IN SCHEMA public`.
- `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES`
  y `ON SEQUENCES` a `resguardo_lectura`, para que las tablas nuevas entren solas.
- **Si no se puede `BYPASSRLS`:** una policy por tabla
  `CREATE POLICY lectura_resguardo ON <tabla> FOR SELECT TO resguardo_lectura USING (true)`.
  Hay que sumar la regla al checklist de tabla nueva en el encabezado de
  `SQL_Schema.md`. Además, el `pg_dump` de la fase 2 necesita `--enable-row-security`,
  porque sin `BYPASSRLS` corta con error.

**Código (ejecutor):**

- `backend/src/scripts/consultar.js`: recibe un SQL por argumento, carga
  `backend/.env.lectura` (con prioridad sobre `.env`), **reusa el pool de
  `src/config/db.js`** (CA, SSL, reintentos), corre la consulta dentro de
  `BEGIN READ ONLY`, imprime el resultado como tabla y cierra el pool.
- `.env.lectura` agregado a `backend/.gitignore`, más un `backend/.env.lectura.example`
  con los nombres de las variables. El `.env.lectura` real lo crea el usuario.
- Agregar al `README.md` cómo se usa.
- **Skill `alta-cliente`:** sus 3 scripts (`leerSolicitud.mjs`, `verificarAlta.mjs`,
  `armarQuery.mjs`) pasan a conectarse con `resguardo_lectura`, cargando
  `backend/.env.lectura` de la misma forma que `consultar.js`. La carga del
  `.env.lectura` se **centraliza** en un solo módulo de `backend/src/scripts/` que usan
  los cuatro. Si falta el `.env.lectura`, el script corta con un mensaje claro y
  **no** cae al `.env` de dueño. Se actualiza el `SKILL.md` (hoy dice que usa
  `backend/.env`).
- **`armarQuery.mjs` y su `EXPLAIN`:** Postgres chequea los permisos de cada tabla
  aun en un `EXPLAIN` sin `ANALYZE`, así que con un rol de solo lectura el `EXPLAIN`
  de los `INSERT`/`UPDATE` da "permission denied". Se reemplaza por un
  `PREPARE` + `DEALLOCATE`, que valida sintaxis, columnas, tipos y funciones sin
  chequear permisos de escritura ni ejecutar nada. Para que resuelva
  `extensions.crypt`, `resguardo_lectura` necesita `GRANT USAGE ON SCHEMA extensions`
  (ver SQL de arriba). Se confirma en la verificación, con el rol ya creado.

**Verificación:**

- Un `SELECT count(*)` por tabla devuelve lo mismo con `resguardo_lectura` que con
  el dueño. Esto comprueba que RLS no lo filtra.
- Un `INSERT`, un `UPDATE` y un `DELETE` sobre una fila de demo con
  `resguardo_lectura` fallan con error de permiso o de transacción de solo lectura.
- Se conecta por el Session Pooler con el formato de usuario `<rol>.<project_ref>`.
- Los 3 scripts de `alta-cliente` corren con `resguardo_lectura` sobre una solicitud
  existente y devuelven lo mismo que con el dueño. `armarQuery.mjs` da `QUERY OK` con
  parámetros válidos y `PROBLEMAS` si se rompe la plantilla a propósito (por ejemplo,
  una columna inexistente), sin escribir nada.
- Sin `.env.lectura`, los 4 scripts cortan con el mensaje claro.

**Al cerrar:** una memoria nueva de Claude, "para consultar datos usar
`node src/scripts/consultar.js` (rol de solo lectura); las pruebas que escriben siguen
con el `.env`".

### Fase 2 — Backup diario (D1-D7)

**Cuentas externas (guía del orquestador, las hace el usuario):**

1. **B2:** cuenta, un bucket privado, reglas de ciclo de vida por prefijo (D5) y una
   application key restringida a ese bucket con `writeFiles` solamente. Antes de
   seguir, confirmar que con esa clave se puede subir y que **no** se puede borrar ni listar.
2. **age:** el usuario instala `age` en Windows (`winget install FiloSottile.age`),
   genera las claves con `age-keygen -o clave_backup_db.txt` y guarda el archivo en
   su Google Drive y en una carpeta local fuera del repo. La línea `public key:` va
   al workflow.
3. **Aviso:** crear un monitor de Sentry Crons con schedule `0 7 * * *` UTC, un margen
   de 60 min y alerta al canal de Discord. Si el plan gratis no lo permite, usar
   healthchecks.io con la integración de Discord (D7).
4. **Secrets de GitHub** (Settings → Secrets → Actions): la URL de conexión de
   `resguardo_lectura` por el pooler, el endpoint, el bucket, el key id y la key de
   B2, y la URL de check-in del monitor.

**Código (ejecutor): `.github/workflows/backup-db.yml`**

- Disparadores: `schedule` (`0 7 * * *`) y `workflow_dispatch`. **Ningún disparador
  de `pull_request`**, para que un fork no pueda ejecutarlo.
- **Sin actions de terceros.** Todo con `run:` y herramientas de apt o las que ya
  trae `ubuntu-latest`, así no hay riesgo de cadena de suministro. Permisos del
  token en `contents: read`.
- Pasos:
  1. Check-in `in_progress` al monitor.
  2. Instalar el cliente de Postgres de la **misma versión mayor que el servidor**,
     desde el repo oficial PGDG (la de Ubuntu puede ser más vieja y `pg_dump` se niega).
  3. Instalar `age`.
  4. `pg_dump --format=custom --schema=public`, más `--enable-row-security` si la
     fase 1 fue con policies.
  5. Cifrar con la clave pública.
  6. Subir a `diarios/AAAA-MM-DD.dump.age` y, si es día 1, también a
     `mensuales/AAAA-MM.dump.age`, con `aws s3 cp --endpoint-url`.
  7. Check-in `ok`, o `error` si algún paso falló (`if: failure()`).
- **Nada en los logs, que son públicos:** sin `-v` en `pg_dump`, sin imprimir
  variables ni tamaños con nombres. El dump sin cifrar nunca se sube como artifact.
- `timeout-minutes` acotado.

**Detalle de orden:** los workflows programados y el botón de `workflow_dispatch`
solo funcionan cuando el archivo está en `main`. Por eso, al terminar esta fase, el
orquestador le propone al usuario un **PR temprano** de lo hecho hasta acá, para que
el backup arranque ya. Después se sigue en el mismo branch, rebasado sobre `main`.

**Verificación (después del merge):**

- Correr el workflow a mano: termina en verde, el archivo aparece en
  `diarios/` y el monitor recibe el check-in `ok`.
- Forzar una falla, por ejemplo con un secret de prueba equivocado en una corrida
  manual: el monitor marca el error y llega el aviso a Discord.
- Revisar el log de la corrida: no hay datos ni secretos a la vista.
- Al día siguiente, confirmar que la corrida programada de las 04:00 apareció sola.

### Fase 3 — Restauración probada e instructivo (D8)

1. **Orquestador:** escribe `docs/restaurar_db.md` para un usuario sin experiencia en
   Postgres, con todos los pasos:
   - Instalar el cliente de Postgres y `age` en Windows.
   - Bajar el backup desde la web de B2 (con el login, sin clave de API).
   - Descifrarlo con la clave privada.
   - Restaurar con `pg_restore` en un proyecto destino. Antes, activar las
     extensiones `btree_gist` (en el schema `public`, como en producción) y
     `uuid-ossp` (en `extensions`), y crear los roles `app_backend` y
     `resguardo_lectura`, o restaurar con `--no-owner --no-privileges`.
   - Volver a crear el secreto de Vault `kingsai_deploy_hook`, que no viaja en el dump.
   - Validar conteos por tabla.
   - Qué hacer en un accidente real: restaurar el proyecto de producción o sumar
     filas sueltas desde una copia restaurada.
2. **El usuario** crea un segundo proyecto Free de Supabase y hace el simulacro
   siguiendo el instructivo, con el orquestador guiando.
3. **Verificación:** conteos por tabla iguales a producción al momento del backup;
   los triggers `web_deploy_*`, las vistas `web_*` y el EXCLUDE de `turno` están; el
   `INSERT` de un turno solapado falla con `23P01`.
4. Corregir el instructivo con lo que haya fallado. El proyecto de prueba se puede
   pausar o borrar al terminar; queda la decisión del usuario.

### Fase 4 — Hook contra SQL destructivo (D10)

**Código (ejecutor):**

- `.claude/hooks/frenar-sql-destructivo.js` (Node): lee el JSON del hook por stdin
  y toma `tool_input.command`.
- **Solo analiza** comandos que pueden llegar a la base: los que invocan `node`,
  `npx`, `psql`, `pg_dump`, `pg_restore`, `dropdb`, `supabase` o `curl` contra
  `/rest/v1`. Si el comando es `node <archivo>`, también lee ese archivo (`.js`,
  `.mjs`, `.cjs`, `.sql`), y lo mismo con el código de `node -e`.
- **Bloquea** (código de salida 2, con un mensaje que diga "esto lo corre el usuario
  en el SQL Editor"):
  - `DROP` de tabla, schema, base, vista, función, trigger, rol, policy, tipo o extensión.
  - `TRUNCATE`.
  - `ALTER TABLE ... DROP`.
  - `DELETE FROM` o `UPDATE ... SET` sin `WHERE` en la misma sentencia.
  - `pg_restore` y `dropdb` en cualquier caso.
- Se registra en `.claude/settings.json` como `PreToolUse` con matcher `Bash|PowerShell`.
  Va en el archivo commiteado para que valga también en la nube.
- **Prueba de falsos positivos, obligatoria:** `grep -n DROP docs/...`, un
  `git commit -m` que mencione `DELETE`, un script que haga `DELETE ... WHERE id = $1`
  y la corrida normal del backend **no** se bloquean.

**Verificación:** casos de prueba pasándole JSON por stdin al script, uno por regla,
más los de falsos positivos. Ninguno toca la base. Al final, un intento real desde
Claude con un `node -e` que tenga `DROP TABLE x` (que no existe) queda bloqueado
antes de ejecutarse.

### Fase 5 — Rol restringido del backend y cierre de la API (D11-D13)

**SQL (lo arma el orquestador, lo corre el usuario):**

- `CREATE ROLE app_backend LOGIN PASSWORD '<CONTRASEÑA_BACKEND>'`, `NOINHERIT`, con
  `BYPASSRLS` si se puede. Si no, una policy por tabla `FOR ALL TO app_backend USING
  (true) WITH CHECK (true)`, sumada al checklist de tabla nueva.
- `GRANT USAGE ON SCHEMA public` y `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES
  IN SCHEMA public`. **Sin `TRUNCATE`, `REFERENCES` ni `TRIGGER`.**
- `GRANT USAGE, SELECT ON ALL SEQUENCES`.
- `GRANT USAGE ON SCHEMA extensions` si `uuid_generate_v4()` vive ahí, porque los
  defaults se evalúan con los permisos de quien inserta.
- `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public` con lo mismo.
- D12: `REVOKE` de `service_role`, `anon` y `authenticated` sobre las tablas y
  secuencias de `public` (y sus default privileges), dejando `SELECT` de `anon` en
  `web_barberos`, `web_servicios` y `web_horarios`.

**Pasos:**

1. **Local primero:** el usuario cambia `DB_USER` y `DB_PASSWORD` en `backend/.env` por
   los de `app_backend`.
2. **Ejecutor:** corre contra demo, con scripts de controllers y req/res simulados,
   **cada camino que escribe**:
   - Reservar un turno, incluido el solapado, que debe dar 409.
   - Cancelar.
   - Registrar un corte con turno y sin turno.
   - Venta, gasto, cierre de caja y movimiento extra.
   - Crear y liberar un descanso.
   - Alta y edición de barbero y servicio en demo. Esto ejecuta los triggers
     `web_deploy_*`, que no deben disparar nada.
   - Guardar una `solicitud_alta`.
   - Subir y borrar una imagen, que sigue usando la service role key para Storage.
   - El job de recordatorios en modo de prueba.

   Además, confirmar que un `DROP TABLE` o un `TRUNCATE` con `app_backend` fallan por
   permiso, sobre una tabla de prueba creada por el usuario.
3. **Verificar D12:** con la service role key, un `GET /rest/v1/turno` da error de
   permiso, las vistas `web_*` siguen respondiendo con `anon` y la web de Kingsai
   sigue mostrando sus datos.
4. **Railway:** el usuario cambia `DB_USER` y `DB_PASSWORD` en los **dos servicios**
   (web y cron de recordatorios), respetando el gotcha de las shared variables.
   Después corre `salud-prod` (health, logs) y confirma que el cron de las 20:30
   ART corrió sin errores esa noche.
5. **D13:** con producción andando con `app_backend`, el usuario rota la contraseña de
   `postgres` en el dashboard y saca de `backend/.env` cualquier rastro de la de dueño.
6. Actualizar el encabezado de `SQL_Schema.md`: ahora dice "el backend entra como
   owner y RLS no le aplica". También el checklist de tabla nueva (grants y policies,
   si corresponde) y `onboarding.md`, si algo del alta cambia.

### Fase 6 — Cierre (orquestador)

- `docs/decisiones_resguardo_db.md` con el núcleo de decisiones, y este plan archivado.
- `docs/estado_actual.md`: qué quedó, qué se verifica con el tiempo (la primera
  corrida mensual y que el monitor nunca quede en silencio) y la revisión del plan
  Pro con más clientes.
- `CLAUDE.md`: actualizar el mapa de documentos.
- Memorias de Claude: actualizar `project_una_sola_db_supabase` (hay backup diario y
  roles) y la de consultas con el rol de solo lectura.
- Último PR a `main`.

---

## 7. Qué no se hace (y por qué)

- **Prohibir leer `backend/.env`** (D14).
- **Que el hook pregunte en vez de bloquear:** metería ida y vuelta, y ese SQL no lo
  corre Claude.
- **Backup de Storage** (D2).
- **Plan Pro / PITR** (D15).
- **Object Lock de B2:** la clave sin `deleteFiles` ya impide borrar desde afuera. Se
  puede sumar más adelante si hace falta.

---

*— Fin del documento —*
