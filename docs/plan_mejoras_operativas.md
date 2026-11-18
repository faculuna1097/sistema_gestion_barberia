# Plan: tanda de mejoras operativas (`feature/mejoras-operativas`)

> **Para el chat orquestador.** Este documento es autocontenido: lo escribió un chat de planificación que no va a
> orquestar. Todas las decisiones están cerradas con el usuario (2026-11-05); no hace falta volver a discutirlas.
> Las líneas y archivos citados en §3 son del 2026-11-05: confirmalos al escribir cada prompt, porque las fases
> anteriores los mueven. Aprobar el plan no es arrancar: el orquestador confirma con el usuario antes de cada fase.
>
> **Estado (2026-11-18):** **en curso.** Hechas y commiteadas: 1a (F9), 1b (F11), 1c (F10), 1 (F7 + F8), 2 (F6a),
> 3 (F6b), 4 (F5), 5 (F1a), 6 (F1b) y, de la auditoría 2026-11, 6b (Z5-04 + Z4-09, `edc3919`), 6c (Z2-01, Z5-09 y el
> refresco de Z8-04, `45c0e8a`) y 6d (Z1-01, Z1-02, Z1-05 y Z3-06, `cb0573a`). Con eso están hechos los nueve arreglos de la
> auditoría que le tocaban a esta tanda. **Próximo: fase 7** (F3; el SQL de `no_asistio_por` lo arma su ejecutor y
> lo corre el usuario). Después: 8 (F4), 9 y 10 (F2), los dos pasos previos al PR (sacar la skill `alta-cliente` con su
> respaldo y la fase 10 de la auditoría: segunda pasada sobre `git diff 3138425..HEAD`) y 11 (cierre, que también
> marca los arreglos como hechos en `auditoria_2026-11.md`).
> **Rebasado sobre `main` el 2026-11-18** (`origin/main` en `fb1fc19`: landing de captación #9, CORS #10, monitor del
> cron #8, keep-alive del pool #11 y skills de producción #12), antes de la fase 7 para que F3 use `conMonitorCron`.
> El resultado se comparó contra la combinación simulada de los dos lados (`git merge-tree`): idéntico salvo los dos
> docs que chocaron (`CLAUDE.md` y `estado_actual.md`), integrados a mano en `c5e0aa0`; `backend/src/index.js`
> revisado a mano. Los hashes de los commits del branch cambiaron: los docs ya citan los nuevos. Respaldo local del
> branch de antes: `respaldo/mejoras-pre-rebase-2026-11-18` (borrarlo cuando el push esté hecho). **Falta el push**
> (lo corre el usuario): `git push --force-with-lease origin feature/mejoras-operativas`. Si `main` avanza otra vez
> antes del PR, otro rebase (chico).
> **Cómo se trabaja desde el 2026-11-13** (además de §2): el SQL de cada fase lo arma su chat ejecutor y lo corre el
> usuario; el orquestador revisa el diff, completa los docs que falten (`ruta_proyecto.md`, `SQL_Schema.md`,
> `estado_actual.md`) y commitea con el OK del usuario. Regla de §8: si una prueba local cambia versiones de token
> de demo, reiniciar el servicio web de producción al terminar.
> Historia: el 2026-11-17 la auditoría 2026-11 dejó nueve arreglos para esta tanda y el 2026-11-18 su chat hizo
> Z3-01, los logs, `body-parser` y la regla de la skill de alta (`0860534`, `4cc1895`) y devolvió la tanda (última
> entrada de §8).
> Antes, 2026-11-05: fase 0 hecha y la tanda en espera del monitoreo (`feature/monitoreo-prod`, ya en producción).

## 1. Contexto

El rediseño del turnero, los descansos en la Agenda y las deudas técnicas (`feature/turnero-ux` →
`feature/descansos-agenda`) están mergeados a `main` y en producción desde el 2026-11-05 (merge `a1b5ed7`). Sobre
eso, el usuario quiere sumar 7 features para la app del barbero, el iPad y el panel (más una chica, F8: aviso de
barberos sin horario), en este branch, hijo de `main`. Después se sumaron F9 (arreglo de la gestión del turno vencido) y dos
mejoras del turnero: F11 (apto para compu y iPad) y F10 (pantalla de éxito más liviana).

**Orden general:** primero el plan de monitoreo (`docs/plan_monitoreo_prod.md`, en `feature/monitoreo-prod`, otro
hijo de `main`) → su merge a `main` y deploy (los hace el usuario) → rebase de este branch sobre `main` → estas
features. Con el monitoreo ya en `main`, todo `console.error` llega a Sentry con el tenant como tag
(`convenciones_tecnicas.md` §1).

**Kingsai sigue reservando por Setmore** y nadie usa todavía la app del barbero ni el turnero propio. Lo que usan
los dos tenants todos los días es el iPad y el panel: los cambios a esas pantallas son los que van a notar.

## 2. Modo de trabajo

- **Orquestador** (chat nuevo): lee este doc, escribe un prompt autocontenido por fase, revisa contra el diff real
  (`git diff`, no solo el reporte), hace los ajustes chicos y los verifica, y **commitea** cada fase aprobada (un
  commit por fase, en castellano, `feat:`/`fix:`/`chore:`/`docs:`, cuerpo explicativo y
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). Push, merge y deploy: el usuario.
- **Ejecutores:** un chat por fase, en `C:\Users\facul\sistema-gestion-barberia`, mismo branch, sin worktrees, no
  commitean. Pueden leer lo que necesiten (el prompt da por dónde arrancar, no una lista cerrada).
- **Hallazgos:** el doc tiene una sección "Hallazgos" (§8). El orquestador anota ahí los posibles bugs o fallas
  que detecte al leer código y los que reporten los ejecutores, verificados contra los docs (que no estén ya
  anotados) y solo si le pueden pasar a un usuario real o son riesgo real. Con cada uno: dónde, qué pasa, y si se
  ataca en esta tanda, se pospone o se descarta (lo decide el usuario).
- **SQL de la DB:** lo corre el usuario, y el orquestador se lo da. Una sola DB (sin staging; demo y kingsai son
  filas): todo cambio tiene que ser compatible con el backend en producción hasta el deploy. Cuidado con los
  triggers `web_deploy_*` de kingsai (`SQL_Schema.md`).
- **Checklist de tabla nueva** (`turno_traspaso` en F2, la de tokens en F6), por el resguardo de la DB
  (`plan_resguardo_db.md`, en curso en `chore/resguardo-db`):
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, sin policies.
  - Se crea desde el SQL Editor, que entra como `postgres`: así los default privileges de la fase 1 del resguardo
    le dan `SELECT` solo a `resguardo_lectura`. Después de crearla, el orquestador lo confirma leyéndola con
    `node backend/src/scripts/consultar.js`.
  - Si la fase 5 del resguardo ya se hizo (rol restringido `app_backend` para el backend), confirmar también que
    `app_backend` tiene `SELECT, INSERT, UPDATE, DELETE` sobre la tabla (vienen por default privileges) y revisar
    el checklist vigente en el encabezado de `SQL_Schema.md`, que esa fase actualiza.
- **Leer datos de la DB:** `node backend/src/scripts/consultar.js "<SQL>"` (rol de solo lectura). Las pruebas que
  escriben siguen con el `.env` normal, contra el tenant demo.
- Decisiones de UI cerradas antes de cada prompt, salvo la fase 4 (el ejecutor decide el diseño con el usuario).
- Preguntas al usuario: enumeradas, en texto libre, con la recomendación de senior; nunca selectores ni botones.

**Contenido de cada prompt:** objetivo; sección de este doc; lectura obligatoria (`CLAUDE.md`,
`docs/convenciones_tecnicas.md`, y `docs/sistema_de_disenio.md` si toca UI); archivos por donde arrancar; contrato
exacto (endpoints, cuerpos, códigos, columnas); qué reusar; qué no tocar; restricciones (sin commits, merge ni
push; sin cambios de DB salvo el SQL que ya corrió el usuario; servidores solo en 127.0.0.1, puertos fuera de
5173–5176, mail y Calendar apagados, bajarlos al terminar y borrar `.claude/launch.json`); dudas de camino →
preguntas numeradas antes de avanzar; cómo se verifica; formato del reporte.

**Reporte del ejecutor:** 1. Qué se hizo. 2. Verificación (qué corrió y qué dio). 3. Lo que quedó distinto al
prompt y por qué. 4. Cosas vistas de paso (posibles bugs o fallas, con archivo y línea). 5. Archivos tocados.

**Fallas menores en el chat del ejecutor** (usuario, 2026-11-12): si el ejecutor encuentra una falla chica que
corresponde a su contexto (la pantalla o los archivos que está tocando, un arreglo de pocas líneas), se la plantea
al usuario en ese chat y la resuelven ahí. En el reporte va en el punto 3, no en el 4. Al punto 4 solo llega lo que
es de otro contexto o es grande: el orquestador no se carga con cosas menores. Todo prompt de ejecutor lo dice.

## 3. Hechos verificados del código (2026-11-05)

- **Alta de turno (barbero):** `frontend-barbero/src/components/CrearTurno.jsx`, wizard de 4 pasos (servicio →
  fecha con `<input type=date>` → horario → datos, nombre obligatorio). `POST /api/admin/turnos` →
  `crearTurnoAdmin` (`backend/src/controllers/turnos.js:77`) → `upsertCliente` (`services/turnosService.js:48`; sin
  email inserta un cliente nuevo siempre) → `insertarTurno`. `turno.cliente_id` es `NOT NULL`.
- **`JOIN cliente`** en `controllers/turnero.js`, `services/planillaService.js`, `services/sqlTurnoEnriquecido.js`
  y `services/turnosService.js`. Búsqueda de clientes: `GET /api/admin/clientes` (`controllers/clientes.js`, no
  filtra por barbero, y así queda por decisión del usuario: auditoría 2026-11, Z2-01); front: `buscarClientes` en `frontend-barbero/src/services/api.js`.
- **Agenda (barbero):** `frontend-barbero/src/components/Agenda.jsx`. Los datos se cargan solo al cambiar de día y
  después de una acción propia (`cargarAgenda`, líneas ~141/177/298); el intervalo de 30 s (línea ~186) solo mueve
  "ahora". Selección de slots: `utils/seleccionSlots.js` (`depurarSeleccion` limpia los que dejaron de valer).
  Detalle: `components/agenda/DetalleTurnoModal.jsx` (Cancelar si no empezó / No asistió si empezó).
- **Disponibilidad:** `services/disponibilidadService.js` (`calcularSlotsDisponibles`, `calcularGrillaDelDia`).
  Suspensiones y descansos: `suspensionSolapaSql`, `finEfectivoSql` (`services/suspensionesService.js`).
  Calendar: `actualizarEvento` (`services/googleCalendar.js:142`). Mails: `services/mail/mailer.js` (Resend).
- **"Dueño = 100 %"** se asume en un solo lugar: el filtro "Solo Barberos" de Caja
  (`frontend/src/screens/admin/sections/SeccionCaja.jsx:532-536`, sobre el `comision_valor` que arma
  `backend/src/controllers/caja.js:57`). `socio.barbero_id` existe (UNIQUE + FK compuesto) y nadie lo lee. Los
  socios se cargan por SQL; `GET /api/admin/socios` (`controllers/socios.js`) lista los activos.
- **Comisión:** input libre en `frontend/src/screens/admin/sections/gestion/TabBarberos.jsx:907`; backend valida
  0–100 en `controllers/gestion.js:100` y `:154`.
- **Login del iPad:** `frontend/src/screens/PantallaLoginOperativo.jsx` (usuario + contraseña, sin "ver").
  Credenciales en `tenant` (`operativo_usuario`, `operativo_password_hash`, `operativo_token_version`,
  `pin_admin`, `admin_token_version`); al rotarlas se llama `invalidar(subdominio)` de la caché del tenant
  (`adminOperativo`, `gestion.cambiarPinAdmin`). `tenant.telefono` existe: teléfono público del local (turnero).
- **Login de la app del barbero:** `frontend-barbero/src/components/Login.jsx`. iPad: `frontend/src/screens/MainScreen.jsx`.
  Inicio del panel: `frontend/src/screens/admin/sections/SeccionInicio.jsx`. Turnero del panel: `SeccionTurnero.jsx`.
- **Cron existente:** servicio Railway aparte con `node src/jobs/recordatorios.js` (diario).
- `estado_actual.md` → Pendientes tiene "Alerta en el Inicio del panel…" (la resuelve F3) y "Comisión del barbero
  con una barra de 5 en 5" (la resuelve F7): el cierre los saca de ahí.

## 4. Diseño por feature (todo decidido)

### F7 — Comisión con barra de 5 en 5
- Gestión → Barberos: el % se elige con una barra de 0 a 100, de a 5 (alta y edición), mostrando el valor.
- Backend (`gestion.js`, alta y edición): 400 si no es múltiplo de 5.
- Antes, SQL del usuario: `SELECT tenant_id, nombre, comision_valor FROM barbero WHERE comision_valor % 5 <> 0;`.
  Si hay filas, el orquestador lo consulta con el usuario antes de la fase.

### F8 — Aviso de barberos sin horario (Gestión → Barberos)
- Motivo: un barbero activo sin `barbero_horario` aparece en el "Equipo" del turnero pero no tiene horarios para
  reservar, "Cualquier barbero" no lo asigna y su Agenda queda gris (`estado_actual.md` → Pendientes, primer ítem, paso 2).
- **Solo front, sin backend ni DB** (decidido el 2026-11-06). `TabBarberos.jsx` ya precarga en el mount los
  horarios de todos los barberos (`horariosPorBarbero`, con `getAdminHorarios` en un `Promise.allSettled`) y el
  horario del local (`horarioLocal`, `{ [dia]: { inicio, fin } }`, `null` si no se pudo leer). Hoy los usa la
  columna "Horarios", que muestra un check si el barbero tiene algún bloque (`tieneHorarios`, ~línea 1138).
- **La columna "Horarios" se reemplaza** por "días con horario / días que abre el local", por ejemplo `3/5`:
  - numerador: días distintos en los que el barbero tiene al menos un bloque, contando solo los días en que el
    local abre;
  - denominador: días abiertos del local (`horarioLocal`);
  - signo de alerta solo en `0/x`; el resto, en neutro;
  - si `horarioLocal` no se pudo leer, o el horario del barbero falló al cargar, `—`;
  - ordena por el numerador;
  - se actualiza al guardar el horario desde el modal (como hoy el check).
- **Cartel de alerta** arriba de la tabla si hay barberos **activos** en `0/x` ("Lucas y Tomi no tienen horario
  cargado: no se les pueden reservar turnos"). Desaparece solo al cargarles el horario.
- La función que cuenta los días va comentada y aparte del render (pura, reusable si otra pantalla la necesita).
- Va en la fase 1, junto con F7 (mismo archivo).

### F6 — Login del iPad, datos del dueño y recuperación
- **Ver contraseña:** botón ojo en el campo de contraseña de `PantallaLoginOperativo` (accesible, ≥ 44 px).
- **Columnas del tenant:** `email_duenio` y `telefono_duenio` (`NOT NULL`, después de completarlas en los 3
  tenants con un SQL con huecos que llena el usuario, sin pasar los datos por el chat), y `telefono` →
  `telefono_local`. El código usa solo `telefono_local`. En la DB, en dos tiempos: ahora
  `ADD COLUMN telefono_local` + copia; después del deploy, recopiar lo que haya escrito el backend viejo y
  `DROP COLUMN telefono` (va a los pasos post-deploy de `estado_actual.md`).
- **Recuperación** de la contraseña del iPad **y** del PIN admin: "¿Olvidaste tu contraseña?" (login del iPad) y
  "¿Olvidaste tu PIN?" (login del panel) → mail a `email_duenio` (enmascarado en pantalla) con link de un solo
  uso que vence en 1 h → pantalla para cargar la nueva (y en el mail del iPad, el usuario operativo).
  - Tabla nueva de tokens (hash del token, tipo `operativo`/`pin_admin`, vence, usado_en), con RLS.
  - Al usarlo: sube `operativo_token_version` o `admin_token_version` (cierra las otras sesiones) e invalida la
    caché del tenant. Endpoints públicos bajo `/api/auth/…` con `limiterLogin`. Respuesta genérica sin revelar
    datos; el mail sale por el mailer existente.
- **Edición:** email y teléfono del dueño y teléfono del local en Gestión → Negocio (admin).
- `backend/src/scripts/crearTenant.js` y `docs/onboarding.md` piden los datos nuevos.
- **Cruce con el formulario de alta** (en `main` desde el 2026-11-11, anotado al rebasar el 2026-11-12; ver
  `decisiones_alta_clientes.md` → "Cruce con `feature/mejoras-operativas`"). Las altas nuevas ya no se hacen con
  `crearTenant.js` sino con la skill `alta-cliente`, que arma la query desde la solicitud:
  - La plantilla `.claude/skills/alta-cliente/plantilla_alta.sql` inserta `tenant.telefono` (desde
    `datos->'local'->>'telefono'`) y `verificarAlta.mjs` lo lee. Pasan a `telefono_local`, y la plantilla suma
    `email_duenio` y `telefono_duenio`, que el formulario ya pide (bloque `contacto` de `solicitud_alta.datos`,
    `version: 1`). Revisar también `leerSolicitud.mjs` y `SKILL.md`.
  - Va en la fase 2, con el `ADD COLUMN`: si no, la primera alta después del `DROP COLUMN telefono` falla.
  - Los tenants a completar antes del `NOT NULL` son **5**: además de kingsai, demo y luxuri, `pepe-barber`
    (prueba del formulario, dado de baja) y `monte-sinai` (cliente dado de alta con el formulario el 2026-11-11).
- **Decidido al arrancar la fase 2 (2026-11-12/13, SQL ya corrido por el usuario):**
  - Columnas `telefono_local`, `email_duenio` y `telefono_duenio`, nullables, con `CHECK` de formato de mail y de
    E.164 para el celular. `telefono_local` copiado de `telefono`. Los datos del dueño de `pepe-barber` y
    `monte-sinai` salieron del bloque `contacto` de su `solicitud_alta`; de kingsai, solo el mail. Faltan: el
    celular de kingsai, y mail y celular de luxuri y demo (los carga el usuario con un `UPDATE` con huecos).
  - **El `NOT NULL` va después del deploy**, no antes: la query de alta de la skill (la de `main`) inserta
    tenants sin esas columnas. Paso post-deploy: completar lo vacío y recién ahí el `NOT NULL`, junto con
    recopiar `telefono` → `telefono_local` y el `DROP COLUMN telefono`.
  - Tabla `token_recuperacion` (`tenant_id`, `tipo` `operativo`/`pin_admin`, `token_hash` único con el SHA-256
    del token, `vence_en` con default de 1 h, `usado_en`, `created_at`), con RLS y lectura de `resguardo_lectura`
    verificada.
  - Un tenant con `activo = false` ya no entra a nada (`tenantMiddleware`), y la recuperación queda cubierta por
    lo mismo. La demora de la baja por el caché del middleware queda fuera de esta tanda: la baja se completa
    reiniciando el servicio web en Railway (decisión del usuario, 2026-11-13; no se hace el vencimiento del caché).
- **Decidido en la fase 3 (2026-11-13):**
  - Cambiar el contacto del dueño pide el PIN de admin (cambiar ese mail equivale a cambiar las credenciales).
  - Un PIN de admin de confirmación incorrecto responde **403** con `codigo: 'pin_admin_incorrecto'` y `campo`
    (`verificarPinAdmin` en `utils/pin.js`), en contacto, credenciales operativas y PIN: con 401, `apiFetch`
    cerraba la sesión del panel.
  - El 400 de link inválido lleva `codigo: 'token_invalido'`.
  - La recuperación del PIN no compara contra el PIN actual del admin (`pinColisiona` con `incluirAdmin:
    false`): se puede volver a elegir el mismo, como con la contraseña.

### F5 — Login de la app del barbero (estética)
- El ejecutor revisa el login actual, arma **2 direcciones** con capturas (modo celular) dentro del sistema
  "Luz", el usuario elige en ese chat, y recién ahí implementa. Sin cambios de backend ni del flujo de PIN.

### F1 — Turno rápido y cliente "Sin datos"
- **DB:** `turno.cliente_id` nullable (NULL = cliente sin datos). Compatible con el backend viejo (siempre lo completa).
- **Backend:** `POST /api/admin/turnos` acepta `sin_cliente: true` (sin nombre ni contacto) → turno sin cliente.
  Los 4 `JOIN cliente` pasan a `LEFT JOIN`; mails y Calendar toleran cliente nulo. Endpoint nuevo para **asignar
  un cliente** a un turno (existente por id, o crear uno nuevo con nombre/teléfono/email); con rol barbero, solo
  turnos propios. El cliente puede ser cualquiera del local, con cualquier rol (auditoría Z2-01, decisión del
  usuario: hay clientes que no se cortan siempre con el mismo barbero; arreglado en la fase 6c, que sacó el
  filtro de "cliente suyo" del alta y de la asignación). El admin puede **cambiar** el cliente de un turno que ya
  tiene uno (`reemplazar: true` + `cliente_actual_id`, auditoría Z5-09, fase 6c); el barbero no.
- **App del barbero:**
  - Paso del cliente: botón destacado "Sin datos" que confirma sin nombre.
  - Wizard: días en chips (hoy, mañana, …) en lugar del input nativo; fecha y horario en un mismo paso.
  - **Atajo en la Agenda:** con slots elegidos, el footer ofrece "Reservar turno" además de "Marcar descanso" →
    hoja con servicio + cliente (buscar / nuevo / "Sin datos") que arranca en el primer slot elegido.
  - Detalle del turno: "Asignar cliente" si no tiene (buscar entre los clientes del local o crear; ver Z2-01 en §8).
  - **Refresco de la Agenda:** recarga silenciosa cada 60 s (antes 30 s; auditoría Z8-04, fase 6c) con la app
    visible y al volver al primer plano (`visibilitychange`), sin perder la selección ni el modal abierto.
  - Todo turno sin cliente se muestra como "Sin datos".
- **Panel:** detalle del turno en Gestión → Turnero con "Asignar cliente" (todos los clientes del local) y, solo
  el admin, "Cambiar" en un turno que ya tiene cliente.
- **iPad:** el selector de turno al cobrar muestra "Sin datos" cuando corresponde.

### F3 — Turnos sin cobrar: aviso y cierre diario
- **Aviso** (endpoint para operativo y admin): turnos `reservado` cuyo fin pasó hace al menos
  **`duracion_slot_minutos` + 10 min** (por tenant). Devuelve la lista (barbero, día, horario, cliente o "Sin
  datos"), la insistencia (`duracion_slot_minutos`) y el instante de cierre del local de hoy
  (`tenant_horario_atencion`; null si hoy no abre).
- **iPad (`MainScreen`) e Inicio del panel:** aviso con la cantidad ("3 turnos sin cobrar"); al tocarlo, overlay a
  pantalla completa con barbero, día y horario de cada uno, cerrable con X en la esquina; indica que se marcan en
  Gestión → Turnero. Cerrarlo lo oculta durante `duracion_slot_minutos` o hasta volver a la pantalla principal;
  mientras queden, vuelve. **Desde 20 min antes del cierre del local** cambia a color de alerta, avisa que a la
  noche se cierran solos como "no asistió" y **ya no se puede cerrar** (queda fijo mientras haya pendientes; el
  overlay con el detalle sí se abre y se cierra). Se refresca cada 5 min y al volver a la pantalla.
- **Cierre diario automático:** `backend/src/jobs/cierreDiario.js`, servicio cron nuevo en Railway (lo configura el
  usuario con instrucciones), 03:00 AR (06:00 UTC). Pasa a `no_asistio` los `reservado` que terminaron antes de
  las 00:00 AR del día, en todos los tenants activos; idempotente; loguea cuántos por tenant. **La primera corrida
  cierra también los históricos:** antes del deploy, SQL para contarlos. **Sentry:** sigue el patrón para jobs de
  cron de `convenciones_tecnicas.md` §1 que deja el monitoreo (como `jobs/recordatorios.js`): import de
  `../instrument.js` primero, tag de tenant por iteración, `vaciarEventos` antes del `process.exit`, y `SENTRY_DSN`
  referenciada en el servicio cron nuevo (shared variable).
- **DB:** `turno.no_asistio_por` (`barbero`/`admin`/`sistema`, nullable). El backend nuevo lo completa al marcar
  "no asistió" (barbero o admin) y el cron con `sistema`.

### F4 — Socios
- Pestaña "Socios" en Gestión: alta, editar nombre, desactivar, vincular a un barbero (opcional, único).
- Caja "Solo Barberos": el backend devuelve `es_socio` por corte (barbero vinculado a un socio activo) y el filtro
  saca esos cortes en lugar de los del 100 %.
- Lista de barberos: marca "Socio" en los vinculados.
- La comisión queda separada de ser socio (con 100 % sus cortes no suman a la ganancia; con 0 % suman y el socio
  retira con retiros). Balances no separa las comisiones de socios. Sin cambios de DB.

### F2 — Traspaso de turnos entre barberos
- **DB:** tabla `turno_traspaso` (id, tenant_id, turno_id, de_barbero_id, a_barbero_id, estado
  `pendiente`/`aceptado`/`rechazado`/`retirado`/`vencido`, created_at, respondido_en, motivo_vencimiento), FK
  compuestos con tenant_id, índice único parcial (una `pendiente` por turno), RLS.
- **Reglas:** solo turnos reservados y futuros del barbero A. Candidatos = barberos activos (≠ A) con
  `[inicio, fin)` libre: dentro de su horario, sin turno y sin descanso ni ausencia (reusar la lógica de
  disponibilidad, no duplicarla). A elige uno; A puede retirarla. Sin mail al cliente; el admin no interviene.
- **Nunca se cancela un turno de cliente por un traspaso.** Estado efectivo calculado al leer (como el "rango
  efectivo" de los descansos): pendiente solo si el turno sigue reservado y futuro, es de A y B sigue libre; si no,
  se muestra vencida (B: "Ya no disponible: se ocupó tu horario"; A: "Vencida: B ya no tiene ese horario libre",
  para pedírsela a otro).
- **Aceptar:** una sola sentencia (CTE) que cambia `turno.barbero_id` a B si sigue reservado, futuro y de A, con el
  `NOT EXISTS` de suspensiones/descansos, y marca la solicitud `aceptado`. El EXCLUDE GIST da 409 si B se ocupó →
  se marca `vencido` y se muestra el mensaje. Después, best-effort: `actualizarEvento` de Calendar al barbero B.
- **App del barbero:** en el detalle del turno, "Traspasar" → lista de candidatos → enviar. El turno de A muestra
  "Traspaso pendiente a B" (con "Retirar") o el resultado. B ve las solicitudes al abrir la app y en el refresco
  de 30 s (contador visible + lista con Aceptar / Rechazar). Sin notificaciones nativas.

### F9 — Arreglo: el cliente puede cancelar o reprogramar un turno que ya pasó (agregado el 2026-11-06)
- **Bug (encontrado por el usuario, verificado en el código el 2026-11-06):** desde el link del mail
  (`/turnos/gestionar/<token>`), el cliente puede cancelar un turno aunque ya haya pasado su hora. Lo mismo pasa con
  reprogramar.
  - `cancelarTurno` (`backend/src/controllers/turnero.js:463`) solo exige `estado = 'reservado'` (lectura en la
    línea ~474 y `WHERE` del `UPDATE` en la ~487).
  - `reprogramarTurno` (~línea 531) también: valida que el horario **nuevo** sea futuro, pero no que el turno actual
    no haya empezado (estado en la ~563, `UPDATE` en la ~590).
  - El front (`frontend-turnero/src/screens/GestionTurno.jsx:155`, `esReservado`) muestra las dos acciones solo
    según el estado.
  - Como un turno se completa recién al registrar su corte, uno al que el cliente vino y que todavía no se cobró
    sigue `reservado`. El cliente puede cancelarlo después de cortarse, o "reprogramar" una falta a otro día.
- **Regla:** el cliente cancela o reprograma solo si el turno **todavía no empezó** (`inicio > now()`). Es la misma
  regla que ya usa la app del barbero para "Cancelar" (`DetalleTurnoModal.jsx`).
- **Backend:**
  - En los dos, la condición va **en el `WHERE` del `UPDATE`** (`AND inicio > now()`), no solo en la lectura
    previa. Así es atómico, como el estado.
  - Un turno que ya empezó responde **409** con un mensaje para el cliente: "Este turno ya pasó, así que no se puede
    cancelar ni reprogramar. Si necesitás algo, comunicate con el local."
  - La lectura que decide qué contestar cuando el `UPDATE` no actualiza ninguna fila distingue "ya empezó" de
    "cambió de estado".
  - Reusar o centralizar el chequeo en `turnosService.js` (ya existe `inicioPosteriorAhora`) en vez de repetirlo.
- **Turnero (`GestionTurno`):**
  - Si el turno ya empezó, no ofrece Cancelar ni Reprogramar. Muestra el texto de arriba, con los datos de contacto
    del local que ya muestra la landing (teléfono / WhatsApp si están cargados).
  - Si el 409 llega igual (por ejemplo, con la pantalla abierta desde antes), muestra el mensaje del servidor.
- **No cambia:** el estado del turno, el resto de las reglas del turnero ni los mails.
- **Verificación:** contra demo, con controllers + req/res simulados:
  - cancelar y reprogramar un turno reservado futuro → OK;
  - con un turno reservado que ya empezó → 409 sin cambios en la fila;
  - con uno cancelado o completado → el 409 de siempre.

  En el front, `vite preview` del turnero con un turno pasado y uno futuro.
- **Va primero** (fase 1a): es un arreglo de producción chico, independiente del resto, y el turnero ya está
  publicado.

### F11 — Turnero apto para compu y iPad (agregado el 2026-11-11)
- **Problema:** el turnero es mobile-first y en pantallas grandes se ve como un celular: todo vive en una columna
  de 480 px (`theme.maxWidth` en `frontend-turnero/src/theme/tokens.js:79`, que usa `PageContainer.jsx`), sin
  ningún `@media` de layout.
- **Alcance:** todas las pantallas del turnero: `Landing`, `SeleccionServicio`, `SeleccionCuando`,
  `ConfirmarTurno`, `TurnoConfirmado` y `GestionTurno` (`frontend-turnero/src/screens/`), y los primitivos que
  haga falta. En celular no cambia nada.
- **Diseño en el chat de la fase,** como F5: el ejecutor revisa cómo se ve hoy en compu (~1280 px) e iPad
  (~1024 y ~768 px), propone **2 direcciones** con capturas, el usuario elige y recién ahí implementa. Ejemplos de
  lo que puede plantear: landing con la foto y la información en dos columnas; en el flujo, el paso a la izquierda
  y el resumen del turno fijo a la derecha; grilla de días y horarios más ancha. Respeta la identidad propia del
  turnero (`sistema_de_disenio.md` §3.8).
- **Técnica:** responsive por CSS (breakpoints en `index.css` del turnero, como la landing de marketing,
  `decisiones_landing_ia.md`) o con un hook de ancho como `usePantallaAngosta` del panel; el ejecutor lo decide
  según `sistema_de_disenio.md` y lo justifica. Sin cambios de backend.
- **Verificación:** `vite preview` del turnero contra demo en 375, 768, 1024 y 1280 px, con capturas de cada
  pantalla; en celular, igual que antes.
- **Va antes de F10:** F10 rediseña una de estas pantallas y conviene hacerla ya sobre el layout nuevo.

### F10 — Pantalla de éxito del turnero más liviana (agregado el 2026-11-11)
- **Problema (usuario):** la pantalla que aparece al reservar (`frontend-turnero/src/screens/TurnoConfirmado.jsx`)
  está muy cargada. Hoy tiene, entre otros, "Agregar al calendario", "Cómo llegar", la gestión del turno y
  "Reservar otro turno" (`estado_actual.md` → Turnero del cliente).
- **Diseño en el chat de la fase** (cambiado el 2026-11-12: antes el usuario iba a dar los detalles al
  orquestador). Como F11: el ejecutor revisa la pantalla, propone direcciones con capturas, el usuario decide en
  ese chat y recién ahí se implementa. Se diseña para celular y para el layout de compu e iPad de F11 (panel del
  local a la izquierda desde 768 px).
- **No cambia:** el backend, el mail de confirmación ni la pantalla de gestión del turno (`GestionTurno`).
- **Verificación:** `vite preview` del turnero contra demo, reservando un turno (o simulando el resultado), en
  celular y compu, con capturas.

## 5. Fases

| # | Fase | Quién | Requisito previo (usuario) |
|---|---|---|---|
| 0 | ✅ **Hecha (2026-11-05).** Branch `feature/mejoras-operativas` desde `main` + este plan a `docs/plan_mejoras_operativas.md` (commit) | Chat de planificación | — |
| 1a | ✅ **Hecha (2026-11-12, commiteada).** F9 arreglo: no cancelar ni reprogramar desde el link un turno que ya empezó (backend + `GestionTurno` del turnero). Con los dos hallazgos de la gestión (carga con mala señal y subtítulo) | Ejecutor | — |
| 1b | ✅ **Hecha (2026-11-12, commiteada).** F11 turnero apto para compu y iPad. Dirección elegida: desde 768 px, panel fijo del local a la izquierda (`MarcoLocal` + `HeroLocal`) y cada pantalla en su columna de 480 a la derecha; en celular, igual que antes. `TurnoConfirmado`, solo el marco (su contenido es F10). Detalle en `sistema_de_disenio.md` §3.8 y §4.6 | Ejecutor | — |
| 1c | ✅ **Hecha (2026-11-12, commiteada).** F10 pantalla de éxito del turnero más liviana. El contenido lo definió el usuario: el día y la hora como dato principal, "Agregar al calendario" sin la otra opción, quién atiende con el servicio, la dirección como link al mapa y el aviso del mail (con el link para cambiar o cancelar). Salen "Ver o cambiar mi turno" y "Reservar otro turno" | Ejecutor | — |
| 1 | ✅ **Hecha (2026-11-12, commiteada).** F7 comisión con barra (backend + `TabBarberos`) + F8 días con horario y aviso (solo `TabBarberos`). Requisito: 0 barberos con % no múltiplo de 5 (consultado con el rol de solo lectura). Distinto al diseño, decidido con el usuario: la alerta de `0/x` va solo en barberos activos, como el cartel | Ejecutor | SQL de % no múltiplos de 5 |
| 2 | ✅ **Hecha (2026-11-13, commiteada).** F6a DB + backend: columnas del dueño y `telefono_local`, tabla `token_recuperacion`, `/api/auth/recuperar/{solicitar,validar,usar}` y el mail de recuperación, `GET`/`PUT /api/admin/negocio[/contacto]`, `crearTenant.js` (con `--dry-run`) y la skill `alta-cliente`. Distinto al prompt, decidido con el usuario: si el mail no sale, `solicitar` responde igual (el error va a Sentry); el PIN que choca da 409 sin consumir el token; el mail del dueño se guarda en minúsculas | Ejecutor | SQL de columnas + datos de los 5 tenants + tabla de tokens |
| 3 | ✅ **Hecha (2026-11-13, commiteada).** F6b fronts: ojo en `Field` (`revelable`), "¿Olvidaste…?" en los dos logins (`SolicitudRecuperacion`, con paso intermedio), `PantallaRecuperacion` (el `#recuperar=` se lee antes que todo en `App.jsx` y se saca de la URL), Gestión → Negocio → Contacto (`BloqueContacto`, pide el PIN de admin) y Gestión → Seguridad rediseñada. El turnero no cambió (sigue la clave `telefono`). Distinto al prompt, decidido con el usuario: PIN de admin incorrecto → 403 (antes 401, que cerraba la sesión) también en credenciales y PIN; la recuperación deja volver a elegir el mismo PIN; celular argentino por defecto; aviso de sesión cerrada en el login del panel | Ejecutor | — |
| 4 | ✅ **Hecha (2026-11-13, commiteada).** F5 login de la app del barbero. Dirección elegida: "Marco del local" (`FondoLocal` + `MarcoAcceso`, copias adaptadas de las del panel), selector en grilla de avatares con el último barbero del celular primero, teclado de PIN con "¿Olvidaste tu PIN? Pedile uno nuevo al dueño". Distinto al prompt, decidido con el usuario: la sesión del barbero queda guardada en el celular (`utils/sesion.js`, 30 días como el token; 401 o "Cerrar sesión" la borran), sin tocar el backend. Arreglado de paso: salían dos POST de login por PIN | Ejecutor | — |
| 5 | ✅ **Hecha (2026-11-13, commiteada).** F1a backend. SQL corrido por el usuario: `turno.cliente_id` nullable. `POST /api/admin/turnos` con `sin_cliente: true` (400 si además trae nombre o contacto); `LEFT JOIN cliente` en `getTurnoPorToken`, `sqlTurnoEnriquecido`, `listarTurnos` y `listarTurnosOperativos` (`planillaService` ya lo era); Calendar nombra "Sin datos" (`NOMBRE_SIN_CLIENTE`), la API devuelve el cliente en `null`. Nuevo `PATCH /api/admin/turnos/:id/cliente` con `{ cliente_id }` o `{ nombre, telefono?, email? }` → 200 `{ id, cliente_id, cliente_nombre, cliente_email, cliente_telefono }`; 400 (ninguno, los dos o contacto inválido); 404 turno o cliente (inexistente, de otro local o, con rol barbero, ajeno); 409 `codigo: 'turno_con_cliente'`; 409 si el estado no es `reservado` ni `completado`. Una sola sentencia, no pisa un cliente ya asignado; sin mail; Calendar best-effort | Ejecutor | SQL `cliente_id` nullable |
| 6 | ✅ **Hecha (2026-11-16, commiteada).** F1b fronts. App del barbero: `textoCliente` ("Sin datos" en toda la app), wizard de 3 pasos (servicio · día en chips de 14 días con los que no tienen lugar en gris + "Otra fecha" y horario · cliente con "Sin datos" destacado), atajo "Reservar turno" en la Agenda (`HojaReservar`), "Asignar cliente" en el detalle (`HojaAsignarCliente`) y refresco cada 30 s y al volver al primer plano; centralizado en `components/cliente/`, `HojaInferior`, `AvisoError`, `useBusquedaClientes` y `utils/clienteTurno.js`. Panel: "Sin datos" en Turnero, Planillas y Gestión → Barberos, y "Asignar" en el detalle del turno (`turnero/AsignarCliente.jsx`, también en modo barbero). iPad: "Sin datos" en el selector y el resumen de `FlujoCorte`. Distinto al prompt, decidido con el usuario: `POST /api/admin/turnos` acepta `{ cliente_id }` (antes, elegir un cliente del buscador creaba otro igual; con rol barbero, uno suyo o 404) y borra el cliente sin mail recién creado si el alta falla (`borrarClienteSinTurnos`) | Ejecutor | — |
| 6b | ✅ **Hecha (2026-11-18, commiteada).** Auditoría Z5-04 + Z4-09: borrar en Caja un corte con turno. La lógica pasó a `eliminarCorte` (`services/movimientosService.js`): el turno vuelve a `reservado`; si su horario ya es de otro (`23P01`), queda `cancelado` (`cancelado_por = 'admin'`, sin mail, y se borra su evento de Calendar recién con el corte borrado), con compensación si el borrado falla. El `DELETE` de un corte responde `{ ok, turno: { id, estado } \| null, aviso? }`. La lista de Caja suma `turno_inicio`, `turno_estado` y `turno_cliente_nombre`; el diálogo muestra la fila "Turno" y que queda pendiente de cobro (y, si es de un día anterior, que no aparece en el iPad y que esa noche pasa a "no asistió"); el `aviso` sale como toast | Ejecutor | — |
| 6c | ✅ **Hecha (2026-11-18, commiteada).** Arreglos de F1 (auditoría). Z2-01: el cliente del alta y de la asignación alcanza con que sea del local, con cualquier rol (se borró `sqlClienteDelBarbero`); el barbero sigue tocando solo sus turnos. Z5-09: el admin cambia el cliente con `PATCH /api/admin/turnos/:id/cliente` + `{ reemplazar: true, cliente_actual_id }` (403 con otro rol; 409 `cliente_cambio` si el turno ya no tiene ese cliente; una sola sentencia que además rota `token_gestion` si el cliente cambia, para que el link del anterior deje de servir; el cliente anterior no se borra; un turno con cliente no vuelve a "Sin datos"), con "Cambiar" en el detalle del panel. Z8-04: la Agenda se refresca cada 60 s | Ejecutor | — |
| 6d | ✅ **Hecha (2026-11-18, commiteada).** Arreglos de F6 (auditoría). Z1-01: `limiterRecuperacion` (5 por hora por IP, cuenta todos los pedidos) solo en `POST /api/auth/recuperar/solicitar`, y tope por local en la misma sentencia de `emitirToken` (`MAX_LINKS_POR_DIA = 6` en 24 h, los dos tipos; usa el índice `token_recuperacion_tenant_tipo` con las tres columnas, sin DDL), que ahora devuelve `'creado' \| 'frenado' \| 'tope'` (con los dos frenos a la vez, `'frenado'`); ante el tope, la misma respuesta sin mail, `console.warn` y `reportarAviso` (fingerprint `['recuperacion', 'tope-diario']`). Z1-02: `editarContactoNegocio` lee el mail anterior, guarda y, si el mail cambió, anula los links pendientes del tenant en una sola sentencia; si había mail anterior, le manda `enviarAvisoCambioEmail` (mail nuevo enmascarado y contacto del soporte, `SOPORTE` en `utils/constantes.js`); la respuesta no cambia. Z1-05: `enmascararEmail` tapa también el dominio (`fa•••@g•••.com`). Z3-06: `editarNegocio` responde 400 `{ error, campo: 'booking_url' }` si no es texto o no pasa `esUrlHttps` (vacío o solo espacios → `null`) y, decidido con el usuario de paso, 400 `{ error, campo: 'nombre_negocio' }` si el nombre no es texto o es solo espacios (antes, un número daba 500); el panel muestra "Reservar" solo con un link https (`utils/url.js`) y los dos `window.open` van con `noopener,noreferrer` | Ejecutor | — |
| 7 | F3 backend (endpoint, `no_asistio_por`, `cierreDiario.js`) + avisos en el iPad y el Inicio | Ejecutor | SQL `no_asistio_por` |
| 8 | F4 socios | Ejecutor | — |
| 9 | F2a traspasos: backend | Ejecutor | SQL `turno_traspaso` |
| 10 | F2b traspasos: app del barbero | Ejecutor | — |
| 11 | Cierre: `decisiones_mejoras_operativas.md`, `estado_actual.md` (estado, pendientes resueltos, pasos de deploy y post-deploy: los de F6 de §6, cron nuevo, conteo de históricos), `SQL_Schema.md`, `onboarding.md`, `decisiones_alta_clientes.md` D13 (ya hay recuperación de PIN), `ruta_proyecto.md`, `plan_app_barbero.md`, mapa del `CLAUDE.md`; que el aviso del tope diario de recuperación entre en la regla "Rate limiter sigue" de Sentry (§8, fase 6d); resumen | Orquestador | — |

Después: merge de este branch a `main` + deploy siguiendo `estado_actual.md` (el monitoreo ya está en `main` desde
antes de esta tanda).

## 6. Orden de deploy (para el cierre)

Los cambios de DB de cada fase se aplican antes de que su ejecutor verifique (el backend local usa la misma DB) y
son compatibles con el backend en producción: columnas nuevas nullables o con default, `cliente_id` nullable,
tablas nuevas. Post-deploy: lo de abajo y el alta del cron de cierre diario.

**Post-deploy de F6** (pasa a `estado_actual.md` en el cierre), en este orden:
1. Completar el contacto del dueño que falta (al 2026-11-13: el celular de kingsai, y mail y celular de luxuri y
   demo; más cualquier tenant dado de alta desde `main` mientras tanto), con un `UPDATE` con huecos que llena el
   usuario.
2. `UPDATE tenant SET telefono_local = telefono WHERE telefono_local IS NULL AND telefono IS NOT NULL` (cubre un
   alta hecha con la plantilla de `main`, que escribe solo `telefono`).
3. `ALTER TABLE tenant ALTER COLUMN email_duenio SET NOT NULL, ALTER COLUMN telefono_duenio SET NOT NULL`.
4. Sacar `telefono` del `INSERT` de `plantilla_alta.sql` y de `crearTenant.js` (hasta acá escriben las dos
   columnas para que el backend de `main` siga mostrando el teléfono de un alta nueva) y la nota de transición
   del `SKILL.md` ("Mientras mejoras-operativas no esté en producción…"). Commit por PR.
5. Recién con eso en `main`: `ALTER TABLE tenant DROP COLUMN telefono`, y actualizar `SQL_Schema.md`.

## 7. Verificación

- **Backend:** el ejecutor corre sus pruebas contra el tenant demo con controllers + req/res simulados (sin Bruno):
  casos felices, 400/404/409/422 del contrato, scoping por rol (barbero no ve ni toca lo ajeno), concurrencia de
  la aceptación del traspaso (horario ocupado → 409 y `vencido`), cron idempotente (dos corridas = mismo
  resultado), tokens de recuperación (vencido, usado, inválido).
- **Fronts:** `vite preview` en 127.0.0.1 contra demo (ver memoria "Probar un front contra demo" y "Probar la app
  del barbero en local"), modo celular para la app del barbero, tamaño iPad para el operativo; capturas en el reporte.
- **Orquestador:** revisa contra `git diff` antes de cada commit.

## 8. Hallazgos

_(Los completa el orquestador durante la tanda.)_

- **(2026-11-06, usuario) El cliente puede cancelar o reprogramar desde el link del mail un turno que ya pasó.**
  `backend/src/controllers/turnero.js` (`cancelarTurno`, `reprogramarTurno`) y
  `frontend-turnero/src/screens/GestionTurno.jsx`. **Se ataca en esta tanda:** F9, fase 1a.
- **(2026-11-12, ejecutor de la fase 1a) Con mala señal, la gestión del turno dice que el link está vencido.**
  `getTurnoPorToken` (`frontend-turnero/src/services/api.js`, ~línea 172) tira el mismo error sin `status` ante
  cualquier falla (sin red, 500, 429), y `GestionTurno` muestra siempre "No encontramos tu turno. El link puede
  estar vencido o ser inválido.", con "Ir al inicio" como única salida. Un cliente que abre el link del mail con
  mala señal cree que su turno no existe y puede reservar otro. **Resuelto con la fase 1a** (decisión del
  usuario): `getTurnoPorToken` pasa a `fetchConDiagnostico` y a un error con `status` y `codigo`
  (`errorDeLectura`, compartido con `getTenant`); un 404 sin código muestra el texto de siempre, y cualquier otra
  falla, la causa (`mensajeDeCargaDelLocal`) con "Reintentar". Solo pasa si el local cargó y el turno no: sin red
  desde el principio, ya falla antes la carga del local, que tenía su "Reintentar".
- **(2026-11-12, ejecutor de la fase 1a) El subtítulo de la gestión ofrece acciones que no hay.** `GestionTurno`
  muestra "Revisá los datos, reprogramá o cancelá tu reserva." también en un turno cancelado, completado o (desde
  F9) ya empezado. **Resuelto con la fase 1a** (decisión del usuario): con las acciones a la vista, el texto de
  hoy; si no, "Revisá los datos de tu reserva."
- **(2026-11-13, ejecutor de la fase 2) El contacto del dueño iba a quedar público.** `getNegocio` atiende también
  el `GET /api/negocio` público (el nombre antes del login); sumarle el mail y el celular los exponía. **Resuelto
  en la fase 2:** handler aparte `getNegocioAdmin` para `GET /api/admin/negocio`.
- **(2026-11-13, ejecutor de la fase 2) El token y la credencial nueva iban a quedar en los logs de Railway.** El
  log de acceso global escribe el body y solo tapaba PINs y `password`. **Resuelto en la fase 2:** `token`,
  `nueva`, `email_duenio` y `telefono_duenio` en `KEYS_SENSIBLES` (`utils/sanitizarLogs.js`), y el mail de
  recuperación se loguea enmascarado (`destinoLog` en `enviarMail`).
- **(2026-11-13, orquestador al revisar la fase 2) Un alta hecha desde este branch antes del deploy quedaba sin
  teléfono en el turnero.** La plantilla de la skill y `crearTenant.js` escribían solo `telefono_local`, y el
  backend de `main` (producción) lee `telefono`. Como la skill corre desde la carpeta del usuario, que está en
  este branch, la próxima alta caía en esto. **Resuelto en la fase 2:** escriben las dos columnas hasta el
  post-deploy (§6, paso 4). Por lo mismo, el `SKILL.md` lleva una nota: hasta el deploy, sin la línea del
  "¿Olvidaste…?" en el mensaje al cliente.
- **(2026-11-13, usuario vía el ejecutor de la fase 2) No hay aviso si el cron de recordatorios no corre.** Los
  mails fallidos y un fallo del lote ya llegan a Sentry; falta el aviso de que Railway no lanzó el job o se
  colgó. Propuesta: Sentry Crons (check-in al empezar y al terminar, con un helper reusable en
  `config/sentry.js` que después usa el cierre diario de F3), o un heartbeat de UptimeRobot si el plan gratis
  de Sentry no incluye monitores de cron. **Fuera de esta tanda** (decisión del usuario): chat ejecutor aparte,
  branch propio desde `main` (`chore/monitor-cron`), después del commit de la fase 2.
- **(2026-11-13, ejecutor de la fase 3) Después de cambiar el PIN desde Gestión → Seguridad, el panel se entera
  de que la sesión se cerró recién en la acción siguiente.** El cambio sube `admin_token_version` y el token
  propio queda revocado; la próxima llamada da 401 y lleva al login con "Tu sesión se cerró…". **Aceptado**: el
  aviso ya explica qué pasó. Si molesta, el modal podría cerrar la sesión al confirmar.
- **(2026-11-13, orquestador al revisar la fase 3) Sin verificar en pantalla:** los modales de Gestión →
  Seguridad, los anchos nuevos de Seguridad y Turnero y el aviso de sesión cerrada (hacía falta la contraseña
  del iPad de demo). Los endpoints sí se probaron por API. Va a la prueba del usuario antes del merge.
- **(2026-11-13, usuario + diagnóstico con `salud-prod`) Las pruebas de este branch dejaron a demo sin poder
  entrar en producción.** Síntoma: en `demo.barbermanager.app` el login (panel o iPad) da 200 y el pedido
  siguiente da 401, y vuelve a la pantalla de login. Causa: la caché de `tenantMiddleware` guarda por subdominio
  `admin_token_version` y `operativo_token_version`, y solo se renueva al reiniciar el proceso o con
  `invalidar()` *en el mismo proceso*. Las pruebas de F6 (links de recuperación, ~13:16 ARG) y las
  restauraciones posteriores cambiaron esas versiones de demo en la DB compartida desde backends locales, así
  que el backend de producción (sin reinicios desde el 2026-11-11 20:19 ARG) siguió con las versiones viejas, y
  `authMiddleware` rechaza todo token nuevo con 401 **sin loguear nada** (no aparece "firma inválida"). Lo que
  se vio en los logs: a las 17:59 ARG, tres logins admin con 200 seguidos de 401 en `/api/inicio/*`; a las 18:02
  el admin ya entraba (alguien volvió `admin_token_version` al valor de la caché, 5, sin pasar por prod); a las
  18:05 el iPad seguía con 200 en el login y 401 después (`operativo_token_version` = 7 en la DB, otro valor en
  la caché). Los demás locales no se vieron afectados (sus versiones no cambiaron). **Arreglo:** reiniciar el
  servicio web en Railway (la caché se rearma desde la DB); sin código ni SQL. El proceso se renovó con el deploy
  de un PR a las 19:53 ARG del 2026-11-13 (arrancó limpio, una sola vez). **Pendiente:** confirmar en los logs
  que demo entra al panel y al iPad (login 200 y pedidos siguientes 200). **Regla para lo que queda de la tanda:** si una prueba local
  cambia las versiones de token de demo (cambio de PIN o contraseña, link de recuperación, restauración a mano),
  reiniciar el servicio web de prod al terminar. **Para decidir:** loguear un `console.warn` en el 401 por
  versión de token de `authMiddleware` (hoy es invisible en los logs y costó encontrarlo).
- **(2026-11-16, orquestador al revisar la fase 6) Sin ver en pantalla:** "Sin datos" en Planillas del panel y en
  la lista de Gestión → Barberos (hacía falta cobrar un turno "Sin datos" en demo); revisado en el código. Va a
  la prueba del usuario antes del merge. Quedaron en demo, por pedido del usuario, turnos de prueba de Alejo
  (13/11, 17/11 y 4/12) y clientes "Prueba F6…": borrarlos cuando ya no sirvan.
- **(2026-11-17, auditoría 2026-11) Nueve hallazgos de la auditoría se arreglan dentro de esta tanda, antes del
  merge.** Detalle de cada uno (dónde, qué pasa y arreglo propuesto) en [`auditoria_2026-11.md`](./auditoria_2026-11.md);
  destinos decididos con el usuario el 2026-11-17. El orquestador los reparte en las fases que quedan o en una
  fase propia antes del cierre:
  - **Z1-01 (alto), F6:** `POST /api/auth/recuperar/solicitar` no tiene límite por IP (`limiterLogin` cuenta solo
    los fallos y `solicitar` responde siempre 200). Limiter propio que cuente todos los pedidos, y tope de links
    por local por día en la misma sentencia de `emitirToken`.
  - **Z1-02, F6:** cambiar el mail del dueño no avisa a nadie. Aviso al mail anterior y anular los links
    pendientes del tenant en el mismo cambio.
  - **Z1-05, F6:** el mail enmascarado deja ver el dominio entero. Taparlo también (`fa•••@g•••.com`).
  - **Z2-01, F1:** el barbero elige un cliente del buscador y recibe "Cliente no encontrado". **Decisión del
    usuario:** el buscador no filtra por barbero (hay clientes que no se cortan siempre con el mismo). Sacar el
    filtro de "cliente suyo" de `clienteUsable` y `asignarClienteATurno` y borrar `sqlClienteDelBarbero`; el
    barbero sigue tocando solo sus turnos. Con el arreglo, corregir F1 en este plan (§4, "clientes propios") y
    los comentarios del panel que dicen que el buscador devuelve "solo los suyos".
  - **Z5-09, F1:** asignar un cliente a un turno "Sin datos" no se puede corregir. Que el admin pueda cambiar el
    cliente asignado.
  - **Z3-06 (en producción, pero pesa más desde F5):** `booking_url` acepta `javascript:` y el iPad lo abre con
    `window.open`. Validar `https://` en `editarNegocio` y abrirlo solo si es `https://`, con `noopener`.
  - **Z8-04, solo el refresco de F1b:** la Agenda del barbero recarga sus 10 queries cada 30 s. Pasar a 60 s, o
    solo al volver a la app. Las 10 queries van a la tanda de deudas.
  - **Z5-04 y Z4-09, antes de F3 (fase 7):** borrar un corte con turno lo devuelve a "reservado" sin mirar
    nada, y da 500 si otro turno tomó el horario. Con el cierre nocturno de F3, un turno de un día anterior
    al que se le borró el corte pasaría a "no asistió" aunque el cliente vino y pagó. Arreglo: el diálogo de
    Caja dice de qué turno se trata (hora y cliente) y que queda pendiente de cobro; ante el `23P01`, el corte
    se borra igual y el turno queda cancelado (`cancelado_por = 'admin'`, sin mail), con un aviso en Caja.
- **(2026-11-18, auditoría 2026-11) Z3-01 (alto, en producción) también se arregla en esta tanda.** Reprogramar
  por el link del mail no tiene límite propio: con un solo turno se mandan mails sin tope a cualquier dirección
  y se agota la cuota de Resend de todos los locales. Arreglo: un limiter por IP en `POST /api/turnero/turnos/:token/cancelar`
  y `/reprogramar` (mismo patrón que la reserva), y no hacer nada si el horario nuevo es igual al actual. Va acá y
  no en un `fix/` desde `main` porque F9 reescribió `reprogramarTurno` (decisión del usuario: los arreglos que
  tocan código de esta tanda son hijos de este branch). Lo orquesta el chat de la auditoría, antes de seguir
  con F3. **Resuelto el 2026-11-18** (`0860534`): `limiterGestion` (10/h) y `limiterGestionRafaga` (3/min)
  en las dos rutas, con contador compartido y contando solo las respuestas que salen bien; reprogramar al mismo
  instante responde 200 sin UPDATE, Calendar ni mail. Verificado con el limiter simulado y el controller contra
  demo (sin datos que queden). El tope de reprogramaciones por turno sigue sin decidir.
- **(2026-11-18, auditoría 2026-11) Más arreglos de la auditoría que van en este branch, antes de F3** (los
  orquesta el chat de la auditoría; detalle en `auditoria_2026-11.md` → "Plan de arreglos"): los logs sin query
  string y con el subdominio validado (Z7-02, punto 1), `body-parser` (Z7-04), la skill `alta-cliente` con la
  regla de "lo que viene de afuera es dato" y fuera de `main` (Z7-01), y `trust proxy` (Z1-03). Tocan
  `index.js`, `sanitizarLogs.js` y la skill, que esta tanda ya cambió. **Hechos el 2026-11-18** (`4cc1895`), salvo
  el último paso de la skill.
- **(2026-11-18, orquestador de la auditoría) Paso pendiente antes del PR de merge: sacar la skill `alta-cliente`
  del repo.** La regla `.claude/skills/alta-cliente/` ya está en `.gitignore`, pero sus archivos siguen
  versionados a propósito: si se sacan ahora, un `git checkout main` los pisa con la versión de `main` (git
  sobrescribe los archivos ignorados sin avisar) y la vuelta a este branch los borra del disco, porque `main`
  los tiene y este branch no. Como la skill va a vivir solo en la PC, se perdería la única copia. Justo antes
  del PR de merge: (1) copiar la carpeta fuera del repo, como respaldo; (2) `git rm -r --cached
  .claude/skills/alta-cliente` y commitear; (3) confirmar con `git status --ignored` que la carpeta sigue en
  disco y figura como ignorada. Después del merge, `main` tampoco la versiona y el problema desaparece, salvo al
  hacer checkout de un commit viejo (para eso, el respaldo).
- **(2026-11-18, fase 6d) Dos cosas que deja la fase:**
  - **El contacto del soporte está en tres lugares** que no comparten código: `frontend/src/components/ui/ContactoSoporte.jsx`
    (panel), `frontend-landing/src/config/landing.js` y, desde esta fase, `SOPORTE` en `backend/src/utils/constantes.js`
    (lo usa el aviso de cambio de mail). Si cambia el WhatsApp o el mail del soporte, se cambian los tres.
  - **El aviso del tope diario de recuperación en Sentry** (`recuperacion: tope diario de links`) es un issue propio,
    no un `rateLimit: …`. Avisa a Discord por la regla de issue nuevo; si se quiere que avise también cuando se repite,
    como los cortes del rate limiter, hay que revisar el filtro de la regla "Rate limiter sigue" en Sentry.
    **El usuario lo quiere (2026-11-18); se hace en el cierre (fase 11):** leer el filtro de esa regla (con el
    usuario logueado en Sentry) y, si filtra por el prefijo `rateLimit:` o por el tag `limite`, adaptar el aviso en
    `solicitarRecuperacion` para que lo cumpla; si no, sumarle el issue a la regla en Sentry, con el OK del usuario.
- **(2026-11-17, auditoría 2026-11) Aceptados por el usuario, que tocan esta tanda:** Z1-06 (la sesión del
  barbero queda siempre guardada, sin casilla) y Z1-03 en su parte de producto (el PIN de admin sigue en 4
  dígitos, porque el login del panel resuelve admin o barbero con el mismo PIN).
- **(2026-11-18, orquestador de la auditoría) Traspaso: lo que queda de la auditoría en esta tanda.** El usuario
  decidió pausar los arreglos de la auditoría, completar este plan, mergear y después retomar `trust proxy` y la
  tanda de deudas desde `main`. Lo que este orquestador toma, en orden:
  1. **Antes de F3 (fase 7):** Z5-04 con Z4-09 (borrar un corte con turno; ver la entrada del 2026-11-17).
  2. **En cualquier fase antes del merge:** Z1-01 (alto), Z1-02, Z1-05, Z2-01, Z5-09, Z3-06 y el refresco de la
     Agenda de Z8-04 (misma entrada). Se pueden juntar en una fase propia o repartir en las que quedan.
  3. **Justo antes del PR de merge:** sacar la skill `alta-cliente` del repo (la entrada anterior dice cómo, con
     el respaldo) y la **fase 10 de la auditoría** (`plan_auditoria_2026-11.md` §7): una segunda pasada con los
     mismos criterios sobre `git diff 3138425..HEAD`, que suma lo que salga a la sección "Segunda pasada" de
     `auditoria_2026-11.md`. La puede hacer este orquestador o un ejecutor.
  4. **Al rebasar sobre `main`:** entran el CORS (#10), el keep-alive del pool y las skills de producción, que
     tocan `backend/src/index.js`, `backend/src/config/db.js`, `docs/performance_frontends.md` y las dos
     `SKILL.md`. Este branch también tocó `index.js` (logs y `body-parser`): revisar ese archivo a mano.
  5. **Al cerrar la tanda (fase 11):** marcar en `auditoria_2026-11.md` → "Plan de arreglos" cada uno de estos
     arreglos como hecho, con su commit, y en la tabla de hallazgos su destino como resuelto.
