# Plan: tanda de mejoras operativas (`feature/mejoras-operativas`)

> **Para el chat orquestador.** Este documento es autocontenido: lo escribió un chat de planificación que no va a
> orquestar. Todas las decisiones están cerradas con el usuario (2026-11-05); no hace falta volver a discutirlas.
> Las líneas y archivos citados en §3 son del 2026-11-05: confirmalos al escribir cada prompt, porque las fases
> anteriores los mueven. Aprobar el plan no es arrancar: el orquestador confirma con el usuario antes de cada fase.
>
> **Estado (2026-11-05):** fase 0 hecha (branch `feature/mejoras-operativas` desde `main`, con el merge de
> `feature/descansos-agenda` ya desplegado, y este doc commiteado). **En espera:** el usuario decidió ejecutar antes
> el plan de monitoreo (`feature/monitoreo-prod`). Al retomar: rebasar este branch sobre el `main` que ya tenga el
> monitoreo, reconfirmar los hechos de §3 y seguir con la fase 1.

## 1. Contexto

El rediseño del turnero, los descansos en la Agenda y las deudas técnicas (`feature/turnero-ux` →
`feature/descansos-agenda`) están mergeados a `main` y en producción desde el 2026-11-05 (merge `a1b5ed7`). Sobre
eso, el usuario quiere sumar 7 features para la app del barbero, el iPad y el panel (más una chica, F8: aviso de
barberos sin horario), en este branch, hijo de `main`.

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
  filas): todo cambio tiene que ser compatible con el backend en producción hasta el deploy. Toda tabla nueva con
  `ENABLE ROW LEVEL SECURITY`. Cuidado con los triggers `web_deploy_*` de kingsai (`SQL_Schema.md`).
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

## 3. Hechos verificados del código (2026-11-05)

- **Alta de turno (barbero):** `frontend-barbero/src/components/CrearTurno.jsx`, wizard de 4 pasos (servicio →
  fecha con `<input type=date>` → horario → datos, nombre obligatorio). `POST /api/admin/turnos` →
  `crearTurnoAdmin` (`backend/src/controllers/turnos.js:77`) → `upsertCliente` (`services/turnosService.js:48`; sin
  email inserta un cliente nuevo siempre) → `insertarTurno`. `turno.cliente_id` es `NOT NULL`.
- **`JOIN cliente`** en `controllers/turnero.js`, `services/planillaService.js`, `services/sqlTurnoEnriquecido.js`
  y `services/turnosService.js`. Búsqueda de clientes: `GET /api/admin/clientes` (`controllers/clientes.js`, ya
  scopea por barbero con rol barbero); front: `buscarClientes` en `frontend-barbero/src/services/api.js`.
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
- Backend: el listado de barberos de Gestión (`controllers/gestion.js`, el `SELECT` de la línea ~69) suma
  `tiene_horario` (`EXISTS` sobre `barbero_horario`). Sin cambios de DB.
- `TabBarberos.jsx`: cartel de alerta arriba de la tabla si hay barberos **activos** sin horario ("Lucas y Tomi no
  tienen horario cargado: no se les pueden reservar turnos"), y una marca "Sin horario" en su fila. Desaparece
  sola al cargarles el horario. Va en la fase 1, junto con F7 (mismo archivo).

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

### F5 — Login de la app del barbero (estética)
- El ejecutor revisa el login actual, arma **2 direcciones** con capturas (modo celular) dentro del sistema
  "Luz", el usuario elige en ese chat, y recién ahí implementa. Sin cambios de backend ni del flujo de PIN.

### F1 — Turno rápido y cliente "Sin datos"
- **DB:** `turno.cliente_id` nullable (NULL = cliente sin datos). Compatible con el backend viejo (siempre lo completa).
- **Backend:** `POST /api/admin/turnos` acepta `sin_cliente: true` (sin nombre ni contacto) → turno sin cliente.
  Los 4 `JOIN cliente` pasan a `LEFT JOIN`; mails y Calendar toleran cliente nulo. Endpoint nuevo para **asignar
  un cliente** a un turno (existente por id, o crear uno nuevo con nombre/teléfono/email); con rol barbero, solo
  turnos propios y clientes propios (los de sus turnos).
- **App del barbero:**
  - Paso del cliente: botón destacado "Sin datos" que confirma sin nombre.
  - Wizard: días en chips (hoy, mañana, …) en lugar del input nativo; fecha y horario en un mismo paso.
  - **Atajo en la Agenda:** con slots elegidos, el footer ofrece "Reservar turno" además de "Marcar descanso" →
    hoja con servicio + cliente (buscar / nuevo / "Sin datos") que arranca en el primer slot elegido.
  - Detalle del turno: "Asignar cliente" si no tiene (buscar entre sus clientes o crear).
  - **Refresco de la Agenda:** recarga silenciosa cada 30 s con la app visible y al volver al primer plano
    (`visibilitychange`), sin perder la selección ni el modal abierto.
  - Todo turno sin cliente se muestra como "Sin datos".
- **Panel:** detalle del turno en Gestión → Turnero con "Asignar cliente" (todos los clientes del local).
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

## 5. Fases

| # | Fase | Quién | Requisito previo (usuario) |
|---|---|---|---|
| 0 | ✅ **Hecha (2026-11-05).** Branch `feature/mejoras-operativas` desde `main` + este plan a `docs/plan_mejoras_operativas.md` (commit) | Chat de planificación | — |
| 1 | F7 comisión con barra + F8 aviso de barberos sin horario (backend + `TabBarberos`) | Ejecutor | SQL de % no múltiplos de 5 |
| 2 | F6a DB + backend: columnas del dueño y `telefono_local`, tabla de tokens, endpoints y mails de recuperación, Gestión → Negocio (backend), `crearTenant.js` | Ejecutor | SQL de columnas + datos de los 3 tenants + tabla de tokens |
| 3 | F6b fronts: ver contraseña, "¿Olvidaste…?" en los dos logins, pantallas de recuperación, Gestión → Negocio; `telefono_local` en el turnero | Ejecutor | — |
| 4 | F5 login de la app del barbero (diseño con el usuario → implementación) | Ejecutor | — |
| 5 | F1a backend: cliente nullable, `LEFT JOIN`, alta sin cliente, asignar cliente | Ejecutor | SQL `cliente_id` nullable |
| 6 | F1b fronts: wizard, atajo en la Agenda, refresco de la Agenda, asignar cliente (app y panel), "Sin datos" en el iPad | Ejecutor | — |
| 7 | F3 backend (endpoint, `no_asistio_por`, `cierreDiario.js`) + avisos en el iPad y el Inicio | Ejecutor | SQL `no_asistio_por` |
| 8 | F4 socios | Ejecutor | — |
| 9 | F2a traspasos: backend | Ejecutor | SQL `turno_traspaso` |
| 10 | F2b traspasos: app del barbero | Ejecutor | — |
| 11 | Cierre: `decisiones_mejoras_operativas.md`, `estado_actual.md` (estado, pendientes resueltos, pasos de deploy y post-deploy: drop de `telefono`, cron nuevo, conteo de históricos), `SQL_Schema.md`, `onboarding.md`, `ruta_proyecto.md`, `plan_app_barbero.md`, mapa del `CLAUDE.md`; resumen | Orquestador | — |

Después: merge de este branch a `main` + deploy siguiendo `estado_actual.md` (el monitoreo ya está en `main` desde
antes de esta tanda).

## 6. Orden de deploy (para el cierre)

Los cambios de DB de cada fase se aplican antes de que su ejecutor verifique (el backend local usa la misma DB) y
son compatibles con el backend en producción: columnas nuevas nullables o con default, `cliente_id` nullable,
tablas nuevas. `NOT NULL` de `email_duenio`/`telefono_duenio` solo después de completar los 3 tenants (el backend
viejo no inserta tenants). Post-deploy: drop de `tenant.telefono` y alta del cron de cierre diario.

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
