---
name: alta-cliente
description: Alta de una barbería nueva a partir de una solicitud del formulario de alta (alta.barbermanager.app). Usala cuando el usuario pegue el mail "Nueva solicitud de alta", pase el id de una solicitud o diga "dale de alta", "armame la query de alta", "revisá esta solicitud". También cuando avise que ya corrió la query ("ya lo di de alta", "listo, la corrí") o pida "el mensaje para el cliente": verifica el alta y arma el mensaje de WhatsApp con los links, las credenciales y cómo instalar las apps en el celular. Lee y verifica la solicitud, propone las credenciales y devuelve la query lista para pegar en el SQL Editor de Supabase. Nunca escribe en la DB.
---

# alta-cliente — de la solicitud al cliente andando

El cliente completa el formulario de alta y a Facundo le llega un mail con la
referencia, el nombre del negocio y el **id de la solicitud** (sin más datos del
cliente, a propósito). Con ese id, esta skill:

1. **Revisa** la solicitud: que esté enviada, que siga pasando las reglas del
   backend y qué conviene confirmar con el cliente.
2. **Arma la query** de alta con las credenciales que decide Facundo.
3. **Verifica** el alta después de que Facundo corre la query, y **arma el
   mensaje de WhatsApp** para el cliente.

Contexto de diseño: `docs/plan_alta_clientes.md` (o `docs/decisiones_alta_clientes.md`
cuando la feature se archive) y `docs/onboarding.md`.

## Reglas (no negociables)

1. **Nunca se escribe en la DB desde acá.** Los tres scripts de esta carpeta se
   conectan con el rol de **solo lectura** y solo hacen `SELECT` y un `PREPARE` +
   `DEALLOCATE` (valida la query sin ejecutarla). La query de alta
   la corre **Facundo** en el SQL Editor de Supabase. No la corras vos, ni con
   un script, ni "para probar". Tampoco el `UPDATE` de una baja ni ningún otro.
2. **Una sola DB.** No hay staging: la DB de los scripts es la de producción.
   Por eso la regla 1.
3. **No completes la plantilla a mano.** La query sale siempre de
   `armarQuery.mjs`, que valida los parámetros, escapa las comillas y la
   comprueba con `PREPARE`. Si el script marca un problema, se resuelve el
   problema; no se lo esquiva.
4. **Privacidad.** Los datos del cliente (nombres, teléfonos, mails) se le
   muestran a Facundo en el chat, que es para lo que existen. No los copies a
   archivos del repo, commits, issues ni a ningún otro lado. Las credenciales,
   igual: solo en el chat y en el mensaje que Facundo decide mandar.
5. **Sin inventar.** Si un script falla (sin `.env.lectura`, sin red, la DB no
   responde), decilo con el error tal cual y qué falta. No sigas con
   suposiciones.
6. **Corre en la PC, con el rol de solo lectura.** Los scripts se conectan con
   `backend/src/scripts/conexionLectura.js`: usuario y contraseña del rol
   `resguardo_lectura` desde `backend/.env.lectura`, y host, puerto y base desde
   `backend/.env`. En una sesión en la nube no hay ninguno de los dos: decilo y
   frená.
   - **Si falta `backend/.env.lectura`** (o no es del rol de lectura), el script
     corta con un error que lo dice y **no se conecta**. No lo crees vos ni
     cambies el script para que use el `.env` de dueño: decile a Facundo que lo
     cree a partir de `backend/.env.lectura.example` (ver `README.md`) y frená.

## Scripts (desde la raíz del repo)

| Script | Para qué |
|---|---|
| `node .claude/skills/alta-cliente/leerSolicitud.mjs <id>` | Lee la solicitud y devuelve un JSON con `solicitud` (estado, vigencia), `errores` (las reglas del backend, `validarSolicitudAlta`), `alertas` y `datos`. |
| `node .claude/skills/alta-cliente/armarQuery.mjs --solicitud <id> --pin-admin <pin> --pines <p1,p2,…> --usuario <u> --password <p> [--hasta AAAA-MM-DD]` | Valida las credenciales, arma la query desde `plantilla_alta.sql` y la comprueba con `PREPARE` (sin ejecutarla). Imprime `QUERY OK` y la query, o `PROBLEMAS:` y la lista. |
| `node .claude/skills/alta-cliente/verificarAlta.mjs --solicitud <id> [--pin-admin <pin> --pines <p1,p2,…> --password <p>]` | Después del alta: estado de la solicitud, el tenant, cuántas filas cargó en cada tabla, y si los PINs y la contraseña entran (mismo `bcrypt.compare` que los logins). |

## Paso 1 — Revisar la solicitud

1. Sacá el **id** (un uuid) de lo que pegó Facundo: el mail trae una línea
   "Solicitud: <id>". Si no hay ningún uuid, pedíselo.
2. Corré `leerSolicitud.mjs <id>`.
3. Según el resultado:
   - `error` → decilo y frená.
   - `estado` = `borrador` → el cliente todavía no la envió. Frená.
   - `estado` = `cargada` → ya se dio de alta. Ofrecé ir al paso 4.
   - `errores` no vacío → no debería pasar (se validó al enviar), salvo que la
     fila se haya tocado a mano o haya cambiado una regla. Listalos con su
     `campo` y frená: hay que corregirlo antes del alta.
4. Mostrá un **resumen corto para leer en el celular**:
   - **Local:** nombre, link (`<subdominio>.barbermanager.app`), dirección.
   - **Horario:** los días agrupados ("Lun a vie 10:00 a 20:00 · Sáb 10:00 a
     16:00") y la pausa si hay. Turnos cada X min.
   - **Equipo:** cada barbero con su comisión, si es dueño, su mail y su horario
     ("igual al local" o sus días). Los dueños que no cortan.
   - **Servicios y productos:** nombre, precio y duración (`cantidad_slots` ×
     largo del turno, en minutos); productos con stock.
   - **Contacto:** WhatsApp y teléfono del local, link de reseñas, y el
     contacto del dueño (nombre, celular, mail).
5. Mostrá las **alertas** del script tal cual, como "para confirmar con el
   cliente". No son errores: Facundo decide si sigue.

## Paso 2 — Credenciales

El sistema todavía **no tiene recuperación de PIN ni de contraseña**: se
priorizan credenciales **simples, fáciles de recordar**. Proponé y que Facundo
confirme o cambie:

- **PIN de cada barbero:** 4 dígitos repetidos, en el orden del formulario:
  `1111`, `2222`, `3333`… (hasta `9999`; con más de 9 barberos, pedile a
  Facundo).
- **PIN de admin:** da acceso a la caja y la configuración, así que no sigue
  el patrón de los barberos (cualquiera del local lo adivinaría). Proponé las
  **últimas 4 cifras del celular del dueño** (`contacto.celular`): lo recuerda
  él y no es obvio para el resto. Si coincide con el PIN de un barbero, pedile
  otro a Facundo.
- **Usuario operativo** (el login del iPad del local): el subdominio.
- **Contraseña operativa:** el subdominio sin guiones más el año actual (ej.
  `kings2026`). Tiene que tener 8 caracteres o más.
- **Suscripción:** hasta el último día del mes actual (lo que hace el script
  si no se pasa `--hasta`). Preguntá si va otra fecha (D9: la decide Facundo).

Reglas que controla `armarQuery.mjs`: PINs de 4 dígitos, **todos distintos**
entre sí (admin y barberos: los logins buscan el PIN entre todos), uno por
barbero, usuario de 3+ caracteres y contraseña de 8+.

## Paso 3 — La query

1. Corré `armarQuery.mjs` con los valores confirmados.
2. Si sale `PROBLEMAS:`, mostralos y volvé al paso 2.
3. Si sale `QUERY OK`, pasale la query **entera** a Facundo en un bloque
   ` ```sql `, con estas instrucciones:
   - Supabase → SQL Editor → pegar → Run. Es una sola sentencia: entra todo o
     no entra nada.
   - El resultado es **una fila**: `tenant_id` y cuántas filas cargó en cada
     tabla (`dias_local`, `barberos`, `bloques_barberos`, `socios`,
     `servicios`, `productos`, `categorias` = 9, `solicitud_cargada` = 1).
   - Si `tenant_id` sale vacío y todo en 0, la solicitud no estaba en
     `enviada`: no se cargó nada.
   - Que te avise cuando la haya corrido (o te pegue la fila).

Qué hace la query (por si pregunta): crea el tenant (con `configuracion`
`whatsapp` y `resena_url`; el WhatsApp argentino sin el 9 se carga **con** el
9; y `booking_url` con su turnero, `https://<subdominio>.barbermanager.app/turnos`,
que es el botón "Reservar" del panel), el horario del local, los barberos (PIN hasheado con `crypt`, comisión,
mail), los horarios de los barberos ("igual al local" se parte por la pausa del
mediodía; los horarios propios van tal cual), los socios (barberos dueños
vinculados a su barbero, más los dueños que no cortan), servicios, productos,
las 9 categorías de gasto, y pasa la solicitud a `cargada`. **No** activa el
recordatorio por mail (es opt-in: `onboarding.md`).

## Paso 4 — Verificar el alta

Cuando Facundo avisa que la corrió:

1. Corré `verificarAlta.mjs --solicitud <id> --pin-admin … --pines … --password …`
   con las mismas credenciales.
2. Tiene que dar: `solicitud` = `cargada`, `tenant.activo` = true,
   `tenant.booking_url` = su turnero,
   `barberos` = `barberos_pedidos`, `categorias_gasto` = 9, y todas las
   `verificaciones` en true (cada PIN de barbero con el nombre que le
   corresponde). Si algo no cierra, decilo y no armes el mensaje.
3. Pasale a Facundo el **checklist en el navegador** (el subdominio nuevo no
   necesita invalidar el caché):
   - `https://<subdominio>.barbermanager.app`: entra el usuario y la contraseña
     operativos.
   - El candado (abajo a la derecha) con el PIN de admin: entra a la gestión.
   - `https://<subdominio>.barbermanager.app/barbero/`: un barbero entra con su
     PIN.
   - `https://<subdominio>.barbermanager.app/turnos`: se ven turnos disponibles.

## Paso 5 — Mensaje de WhatsApp para el cliente

Con la verificación en verde, armá el mensaje en **un bloque de texto** para
copiar, con el formato de WhatsApp (`*negrita*`). Completá los `{…}` con los
datos reales; la lista de PINs, un renglón por barbero. Sacá el párrafo de
Calendar si ningún barbero tiene mail, y el de reseñas si cargó el link.

```text
¡Hola {nombre del contacto}! Ya está lista *{nombre del negocio}* en BarberManager.

*Turnero (para tus clientes)*
https://{subdominio}.barbermanager.app/turnos
Para la bio de Instagram usá este, así sabés cuántos turnos llegan de ahí:
https://{subdominio}.barbermanager.app/turnos?origen=instagram

*Sistema del local (iPad o compu)*
https://{subdominio}.barbermanager.app
Usuario: {usuario}
Contraseña: {contraseña}
Para entrar a la gestión (caja, reportes, configuración), tocá el candado abajo a la derecha y poné tu PIN: *{PIN admin}*

*App del barbero (en el celular de cada uno)*
https://{subdominio}.barbermanager.app/barbero/
Cada barbero elige su nombre y pone su PIN:
• {barbero 1}: {PIN}
• {barbero 2}: {PIN}

*Para tenerlo como una app más*
Hacelo con el sistema en el iPad y con la app del barbero en cada celular:
• iPhone o iPad (Safari): abrí el link, tocá Compartir (el cuadrado con la flecha) → "Agregar a inicio" → "Agregar".
• Android (Chrome): abrí el link, tocá los tres puntitos ⋮ → "Agregar a la pantalla principal" (o "Instalar app").
Queda un ícono en la pantalla y se abre directo, sin buscar el link.

Los barberos que tienen mail van a recibir una invitación de Google Calendar por cada turno, de turnos.barbermanager@gmail.com. Que las acepten, así los turnos les aparecen en el calendario.

Desde la gestión podés subir el logo y fotos del local (Gestión → Negocio): se ven en el turnero. Y si querés cambiar un PIN, también se hace desde ahí.

Cualquier duda, escribime.
```

Antes del mensaje, recordale a Facundo en una línea que **lleva las
credenciales en texto**: que lo mande solo al dueño, y que los PINs de los
barberos se los pase el dueño a cada uno (o Facundo por separado).

## Si algo sale mal

- **La query falló en Supabase:** no quedó nada a medias (es una sola
  sentencia). Pedile el error tal cual. Causas probables: el subdominio ya
  existe (otro lo tomó entre el envío y el alta), o un dato que cambió en la
  fila. Volvé al paso 1.
- **Hay que deshacer un alta:** la baja de un tenant es `activo = false`
  (`onboarding.md` → "Baja de un tenant"), nunca un `DELETE`. La corre Facundo.
