---
name: arreglo-prod
description: Resolver un problema de producción (backend en Railway) desde el celular. Usala cuando el usuario diga "arreglalo", "¿cómo lo arreglamos?", "¿qué hacemos?", "¿lo podés resolver?", o cuando, después de un diagnóstico de salud-prod o de pegar un aviso de Discord (Railway, UptimeRobot, Sentry), quiera resolverlo. Entiende y clasifica el problema (código, operativo, datos), propone opciones con su riesgo y, solo con un "dale" explícito, arma el arreglo en un branch fix/ con su PR, guía al usuario en el dashboard de Railway (reiniciar, volver al deploy anterior) o le arma el SQL para Supabase. Nunca pushea a main, nunca mergea, nunca corre comandos de Railway que escriben.
---

# arreglo-prod — resolver un problema de producción

Corre casi siempre en una sesión en la nube (claude.ai/code) que el usuario
abrió desde el **celular** porque le llegó un aviso. Es la continuación de
`salud-prod`: aquella diagnostica (solo lectura), esta resuelve.

**Con quién hablás.** Programador (Java, C#, C++, SQL) sin experiencia en web
que **nunca revisó un pull request**: no va a leer el diff, aprueba lo que
charlaron. Todo en castellano rioplatense, corto (pantalla de celular), sin
jerga; si una palabra técnica hace falta, explicala en una línea.

**Qué hay en la nube y qué no.** Hay repo clonado, `git`, `gh` (solo la API
REST: `gh pr` no anda porque el proxy bloquea GraphQL), `node` y la CLI de
Railway con `RAILWAY_TOKEN`. **No hay `.env` ni acceso a la DB**, y no tiene que
haberlo: hay una sola DB y es la de producción. El arreglo se razona y se
revisa; no se prueba contra demo.

**El cartel de permiso es el control.** El modo es *Accept edits*: cualquier
comando fuera de `.claude/settings.json` le pide permiso al usuario en el
celular. No lo esquives nunca. Antes de cada comando que va a pedir permiso,
decile en una línea qué va a aprobar y qué hace.

## Reglas (no negociables)

1. **Nunca** `git push` a `main`, **nunca** force push (`--force`,
   `--force-with-lease`, `+refspec`), **nunca** mergear (ni con `git merge` +
   push, ni por la API: nada de `.../pulls/<n>/merge`), **nunca** borrar
   branches (locales ni remotos). El único push permitido es
   `git push -u origin fix/<algo>`, con el nombre escrito literal.
2. **Nunca** comandos de Railway que escriben, aunque el token lo permita:
   `up`, `deploy`, `redeploy`, `restart`, `down`, `rollback`, `deployment up`,
   `deployment redeploy`, `variables` (ni para leer: muestra secretos),
   `link`, `service`, `domain`, `environment`, `run`, `shell`, `ssh`,
   `connect`. Solo `railway logs` y `railway deployment list`. Lo operativo lo
   hace el usuario en el dashboard (paso 3b).
3. **Nunca** credenciales de la DB ni secretos (tokens, DSN, contraseñas, el
   valor de una variable) en el chat, el repo, los commits ni los PR. Si el
   usuario pega uno, no lo repitas y pedile que lo rote.
4. **Nunca datos de clientes** (nombres, teléfonos, mails), IPs, IDs de
   cliente o de barbero ni pedazos de log en commits ni PR: **el repo es
   público**. El tenant (subdominio) sí puede ir.
5. **Nunca cambiar nada sin un "dale" explícito** del usuario a la opción
   concreta que propusiste. "Ok", "veamos" o una pregunta no son un "dale". Si
   el plan cambia en el camino, se vuelve a pedir.
6. **Si algo falla** (push rechazado, comando sin permiso, `gh api` con error,
   conflicto), decilo con el error tal cual (sin tokens) y frená. No busques
   caminos alternativos para esquivarlo (otro comando, otro branch, otra
   herramienta).
7. **Un comando por llamada.** Sin `&&`, `;`, bucles ni `sh -c`: así cada
   cartel de permiso muestra una sola acción y el usuario sabe qué aprueba. Para
   los comandos de Railway, las reglas de comandos de `salud-prod` (regla 4).

## 1. Entender

1. **Diagnóstico.** Si en la conversación todavía no hay uno, seguí la skill
   `salud-prod` (si no está cargada, leé `.claude/skills/salud-prod/SKILL.md`)
   con una **ventana corta alrededor del aviso** (por ejemplo, desde 30 min
   antes de la hora del aviso hasta ahora). Si el usuario pegó el aviso,
   tomá de ahí la hora, el servicio y el mensaje de error.
2. **Código.** Leé el código involucrado: el archivo y la función del
   `[modulo] Error en <funcion>`, el stack, y lo que llama. Mirá si coincide
   con un deploy reciente: `git log origin/main --oneline -10` (después de un
   `git fetch origin main`) y el `commitHash` del deployment vivo
   (`railway deployment list ... --json | grep -E '"(id|status|createdAt|commitHash)"'`).
3. **Explicalo** en 3–5 líneas: qué se rompió, dónde (archivo y función, en
   palabras), desde cuándo, a quién le pega (tenant, qué pantalla) y por qué.
4. **Clasificalo** en una de estas, y decilo:
   - **CÓDIGO** — un bug en el backend (`backend/src`). → 3a.
   - **OPERATIVO** — el server colgado o caído sin bug claro, un deploy que
     rompió algo, una variable mal puesta. → 3b.
   - **DATOS** — el código anda pero hay filas mal en la DB (un estado
     trabado, un valor imposible). → 3c.
   - **NO SÉ** — decilo así, qué falta para saber (un log que no está, ver la
     fila en la DB, reproducirlo en la PC) y qué se puede hacer mientras.
     No inventes una causa.

## 2. Proponer

1. **¿Sigue pegándole a usuarios?** (health caído, 5xx que siguen, errores en
   los últimos minutos). Si sí **y** el problema empezó con un deploy, la
   primera opción es **volver al deploy anterior** (3b): frena el daño en un
   minuto y no depende de entender la causa. Si el problema no vino de un
   deploy, el rollback no lo arregla: decilo.
2. **Opciones**, 2 o 3 como mucho, cada una con: qué se hace, quién lo hace
   (vos / el usuario), riesgo en una línea y cómo se deshace. Cerrá con tu
   **recomendación** y por qué.
3. **¿Se arregla desde el celular?** Es **chico y claro** solo si cumple
   **todo** esto:
   - la causa se entiende sin dudas: el error, el stack y el código cierran, y
     podés señalar la línea;
   - toca **1 o 2 archivos** de `backend/src` y **~20 líneas** como mucho;
   - **no toca**: autenticación (logins, PINs, JWT, `authMiddleware`,
     `tenantMiddleware`, `requiereRol`), **plata** (caja, cortes, ventas,
     gastos, comisión, cierres, movimientos extra, stock), **turnos**
     (reservar, cancelar, reprogramar, disponibilidad, descansos), **SQL de
     escritura** (INSERT/UPDATE/DELETE), el schema, dependencias
     (`package.json`), el arranque (`index.js`, `instrument.js`, `config/`),
     el rate limiter ni CORS;
   - no cambia la forma de lo que la API responde (los fronts lo leen);
   - no es un front (los fronts van a la PC: no hay cómo verlos acá).

   Si no cumple todo, es **grande o dudoso**: la recomendación es frenar el
   daño ahora (rollback, o un arreglo de datos puntual) y arreglarlo con calma
   en la PC, donde se puede probar contra demo. Una opción intermedia desde el
   celular es un PR que **revierte** el commit que lo rompió: deshace
   exactamente lo que se deployó, sin escribir código nuevo. Mismos pasos que
   3a, con `git revert --no-edit <sha>` en vez del cambio a mano (si el commit
   es un merge, `git revert --no-edit -m 1 <sha>`).
4. **Esperá el "dale"** a una opción concreta. Sin eso, no tocás nada.

## 3a. CÓDIGO — branch, arreglo y PR

Cada comando de git o `gh` puede pedir permiso: avisá antes qué hace.

1. **Branch nuevo desde `main` actualizado** (no desde el branch que haya
   quedado clonado):
   ```bash
   git status --short
   ```
   Si hay cambios sin commitear que no son tuyos, frená y preguntá.
   ```bash
   git fetch origin main
   ```
   ```bash
   git switch --no-track -c fix/<descripcion-corta> origin/main
   ```
   `<descripcion-corta>`: minúsculas y guiones, sin datos de clientes (ej.
   `fix/cierre-caja-null`). `--no-track` evita que el branch quede atado a
   `main` de GitHub. Recién ahora se editan archivos.
2. **Cambio mínimo**: solo lo que arregla el problema, nada de "ya que estoy".
   Respetá `CLAUDE.md` y `docs/convenciones_tecnicas.md`:
   - toda función nueva o tocada, comentada (qué hace, parámetros, retorno);
   - antes de escribir un helper, buscá si ya existe en `backend/src/utils` o
     `config` y reusalo;
   - logs con `[modulo] funcion — descripción | dato: valor`;
   - `console.error` **solo** si algo rompió el flujo (entró al `catch`): todo
     `console.error` llega a Sentry como error. Lo anómalo pero recuperable
     es `console.warn`;
   - en `catch` la variable es `err`; ids con `esUUID`, montos con
     `validarNumero.js`, fechas con `validarFecha.js`; `req.tenant_id`
     siempre; nada de `BEGIN`/`COMMIT` en el código (pooler).
3. **Verificá lo que se pueda sin DB**:
   - `node --check backend/src/<archivo>.js` por cada archivo tocado;
   - si el arreglo es una función pura (sin DB ni red), probala con
     `node -e` (un `import()` del archivo y un par de casos, incluido el que
     rompía). Si importa paquetes que no están instalados, no instales nada:
     decí que no se pudo probar.
   - Releé el diff **entero**: `git diff`. Buscá datos de clientes, secretos,
     logs de debug que quedaron y cambios que no hacían falta.
4. **Commit** con el formato del repo (mirá `git log -5` en `origin/main`):
   ```bash
   git add <archivos tocados, uno por uno>
   ```
   ```bash
   git commit -m "fix: <qué se arregló, en castellano>" -m "<cuerpo: qué estaba roto, por qué, qué se cambió>" -m "Co-Authored-By: <la misma línea que usan los commits del repo, con el modelo que está corriendo>"
   ```
   Nada de `git add -A` ni `git add .`.
5. **Antes del push**, comprobá que estás en tu branch:
   ```bash
   git branch --show-current
   ```
   Tiene que decir `fix/...`. Si dice `main` u otra cosa, **frená**. Decile al
   usuario: "Ahora te va a pedir permiso para subir el branch `fix/...` a
   GitHub. Eso **no** cambia producción: solo deja el arreglo listo para que
   lo mires."
   ```bash
   git push -u origin fix/<descripcion-corta>
   ```
6. **PR contra `main`**, por la API REST (`gh pr` no anda en la nube):
   ```bash
   gh api --method POST repos/faculuna1097/sistema_gestion_barberia/pulls -f base=main -f head=fix/<descripcion-corta> -f title="fix: <qué se arregló>" -f body="<descripción>" --jq .html_url
   ```
   Si `gh api` falla, decí el error y ofrecé el botón **Create PR** de la
   sesión, pasándole el título y la descripción para que los revise.

   **Título y descripción en castellano**, con estas secciones: *Qué estaba
   roto* (en palabras, sin datos), *Qué se cambió*, *Riesgo* (bajo/medio y
   por qué), *Cómo deshacerlo* (rollback en Railway, o revertir el PR).
   **Sin datos de clientes, IPs, IDs ni pedazos de log**: el repo es público.
7. **Cómo mergear** (es el "sí, a producción" del usuario; vos nunca mergeás).
   Decíselo así:
   > Abrí la app de GitHub → el repo `sistema_gestion_barberia` → **Pull
   > requests** → el PR `fix: ...` → **Merge pull request** → **Confirm
   > merge**. Ese toque lo manda a producción: Railway deploya solo en 2–3
   > minutos. Avisame cuando lo hayas tocado.

   (Los nombres exactos de los botones de la app de GitHub, a confirmar la
   primera vez.) Si GitHub no lo deja mergear, que te diga qué muestra; no
   busques otra vía.
8. **Después del merge, confirmar el deploy:**
   ```bash
   git fetch origin main
   ```
   ```bash
   git log origin/main -1 --format=%H
   ```
   Ese es el commit del merge. Después, para el web y para el cron (ids en
   `salud-prod` → Datos fijos):
   ```bash
   railway deployment list --service <WEB> --environment production --limit 3 --json | grep -E '"(id|status|createdAt|commitHash)"'
   ```
   El deploy nuevo es el que tiene ese `commitHash`. Si está `BUILDING` o
   `DEPLOYING`, decíselo y volvé a correr el comando cuando el usuario lo pida
   o en tu próximo paso (sin `sleep` ni bucles). `SUCCESS` = listo. `FAILED` o
   `CRASHED` = salió peor → 3b (rollback) ya.
9. **Confirmar que se arregló**: `salud-prod` con la ventana **desde el
   deploy nuevo** (ej. `--since 15m`). Tiene que no estar más el error y no
   tiene que haber aparecido otro. Si el arreglo es del cron, se confirma
   recién después de su corrida (20:30 de Argentina): decilo. Si salió peor,
   guiá el rollback (3b).

## 3b. OPERATIVO — lo hace el usuario en el dashboard de Railway

No hay app oficial de Railway: es **railway.com en el navegador del celular**,
ya logueado. Vos guiás paso a paso, de a un paso por mensaje si hace falta, y
**nunca** corrés el comando equivalente. Nombres según la doc de Railway
(2026-11); lo marcado *a confirmar* se ajusta la primera vez.

- **Llegar al servicio:** railway.com → proyecto `splendid-gentleness` →
  entorno `production` → tocar el servicio (`sistema_gestion_barberia` es el
  web; `CRON Recordatorio Turno`, el cron) → pestaña **Deployments**.
- **Reiniciar** (server colgado o crasheado, sin deploy nuevo que lo
  explique): en el deployment activo, los **tres puntitos** → **Restart**.
  Reinicia el proceso con la misma imagen: no reconstruye ni cambia código. Si
  el deployment está crasheado puede aparecer un botón **Restart** directo.
- **Volver al deploy anterior (rollback)** (un deploy rompió algo): en la
  lista, el último deployment que andaba bien (anterior al roto) → **tres
  puntitos** → **Rollback** → confirmar. Railway arma un deployment nuevo con
  la imagen **y las variables** de ese deploy. Ayudalo a elegir cuál con
  `railway deployment list` (fecha y `commitHash`). Límites: en el plan Hobby
  el rollback está solo para deployments sacados hace **menos de 72 h**; si no
  aparece la opción, el que queda es **Redeploy** de ese deployment
  (reconstruye desde su código, tarda más). El web y el cron son servicios
  separados: cada uno tiene su rollback.
- **Ver una variable** (sospecha de una variable mal puesta): servicio →
  pestaña **Variables**. Que te diga **si existe y cómo se llama**, nunca el
  valor. Si hay que cambiarla, eso se hace desde la PC salvo que sea urgente;
  ojo: los cambios quedan "staged" y Railway pide **Deploy** para aplicarlos
  (*a confirmar la primera vez*).
- **Después de cualquiera:** `railway deployment list` hasta ver el
  deployment nuevo en `SUCCESS`, y `salud-prod` con la ventana desde ahí.
- **Ojo después de un rollback:** `main` **sigue teniendo el código roto**.
  El próximo merge a `main`, sea el que sea, lo vuelve a deployar. Hasta que
  esté el arreglo (o un PR que revierta el commit), no se mergea nada más.
  Decíselo siempre y dejalo en el cierre.

## 3c. DATOS — SQL para que el usuario corra en Supabase

Vos armás el SQL; el usuario lo corre en el **SQL Editor de Supabase** desde
el navegador del celular. Usá `docs/SQL_Schema.md` para tablas y columnas (no
podés mirar la DB).

- **Siempre filtrado por `tenant_id`** (el uuid del tenant afectado), además
  del filtro puntual. Nunca un `UPDATE`/`DELETE` sin `WHERE` acotado.
- **Nada de DDL** (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`, permisos) desde el
  celular: eso espera a la PC.
- Preferí corregir a borrar: en los ABM no se borra, se pone `activo = false`.
- **Paso 1 — ver qué se toca.** Un `SELECT` con exactamente el mismo `WHERE`
  que va a usar el cambio, que traiga **solo ids, estados y fechas** (no
  nombres, teléfonos ni mails) y termine con la cantidad. Pedile al usuario
  que te diga **la cantidad de filas**, no que pegue el resultado.
- **Paso 2 — el cambio, en una transacción con control.** El editor puede
  mostrar solo el resultado de la última sentencia (*a confirmar la primera
  vez*), así que el control no depende de mirar: si no da lo esperado, aborta
  solo y no se guarda nada.
  ```sql
  BEGIN;

  UPDATE <tabla>
  SET <columna> = <valor>
  WHERE tenant_id = '<uuid del tenant>'
    AND <filtro puntual, igual al del paso 1>;

  -- Control: si no quedó como se esperaba, se cancela todo.
  DO $$
  BEGIN
    IF (SELECT count(*) FROM <tabla>
        WHERE tenant_id = '<uuid del tenant>'
          AND <condición que tiene que cumplirse después>) <> <N del paso 1> THEN
      RAISE EXCEPTION 'Control falló: no se guardó nada';
    END IF;
  END $$;

  COMMIT;
  ```
  Si sale "Control falló", no se cambió nada: frená y revisá con el usuario.
- **Paso 3 — confirmar.** Otro `SELECT` (solo ids y estados) para ver que
  quedó bien.
- **Web de Kingsai:** si el cambio toca `barbero`, `servicio` o
  `tenant_horario_atencion` con filas de Kingsai
  (`a1b2c3d4-0000-0000-0000-000000000001`) y cambia algo visible (nombre,
  precio, `activo`, horarios), los triggers `web_deploy_*` **disparan un
  deploy de su web**. Avisalo antes de que lo corra (detalle al final de
  `docs/SQL_Schema.md`).

## 4. Cerrar

Un resumen de **una pantalla**:

- **Qué pasó** (en una o dos líneas).
- **Qué se hizo**: PR (link) mergeado y deployado, rollback, reinicio o SQL
  corrido.
- **En qué quedó**: el health y el error, según el último `salud-prod`.
- **Pendiente para la PC**: anotarlo en `docs/estado_actual.md` (desde el
  celular **no** se edita, salvo que sea parte del arreglo); si hubo
  rollback, que `main` sigue con el código roto; si el arreglo fue "a
  ciegas", probarlo contra demo; marcar el issue como resuelto en Sentry.
