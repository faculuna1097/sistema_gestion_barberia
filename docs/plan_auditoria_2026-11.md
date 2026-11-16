# Plan: auditoría de seguridad y calidad 2026-11

> **Para el chat orquestador.** Este documento es autocontenido: lo escribió un chat de planificación que no va a
> orquestar. Las decisiones de §2 están cerradas con el usuario (2026-11-16). Aprobar el plan no es arrancar: el
> orquestador confirma con el usuario antes de cada fase.
>
> **Estado (2026-11-16):** plan escrito, sin empezar.

## 1. Contexto

El usuario quiere una auditoría de seguridad, bugs, inconsistencias y posibles fallas de todo el sistema, y de
lo que hace gastar de más o vuelve lento al backend, aprovechando que tiene Fable disponible en su plan. La auditoría anterior es la de julio
([`auditoria_2026-07.md`](./auditoria_2026-07.md)): 7 fases, 27 hallazgos, 0 abiertos, mergeada en `adeb98a`
(2026-07-28).

Desde entonces se construyó mucho, y casi nada de eso pasó por una auditoría:

- Movimientos extra (aportes, retiros, otros ingresos) y socios; RLS en todas las tablas (2026-09-30).
- Landing pre-renderizada (2026-10-01).
- Rediseño del turnero: "Cualquier barbero", origen del link, reseñas, gestión del turno (en producción desde el
  2026-11-05).
- Descansos en la Agenda, liberar ausencias, cortes con/sin turno, "un turno se completa solo con su corte"
  (2026-11-05).
- Monitoreo: Sentry, skills `salud-prod` y `arreglo-prod`, lista `deny`, ruleset de `main` (2026-11-06).
- Formulario de alta: `/api/alta` fuera de la cadena de tenant, `frontend-alta`, skill `alta-cliente` (2026-11-11).
- Resguardo de la DB, fases 0-2: rol de solo lectura, backup diario por GitHub Actions a Backblaze B2 (2026-11-11).
- Mejoras operativas, **en curso** en `feature/mejoras-operativas`: F7 a F11, datos del dueño y recuperación por
  mail de la contraseña del iPad y del PIN (F6), login de la app del barbero con sesión guardada 30 días (F5),
  turno sin cliente y asignar cliente (F1). Faltan fases (la próxima es F3).

**La auditoría corre en paralelo con ese plan, sin frenarlo.** Se audita el branch `feature/mejoras-operativas`
tal como esté: contiene todo `main` (`3931843`) más las fases hechas. Al escribir este plan, HEAD es `35a23f5`
(17 commits y 114 archivos sobre `main`).

## 2. Decisiones cerradas (2026-11-16)

1. **Solo lectura.** La auditoría no modifica código, ni la DB, ni configuración. El único archivo que se escribe
   es [`auditoria_2026-11.md`](./auditoria_2026-11.md) (y este plan, para el estado).
2. **Los arreglos van después y aparte**, según lo que decida el usuario con el documento en la mano:
   - Grave y ya en producción: branch `fix/` desde `main`, con su PR.
   - Grave y solo en el branch: se corrige dentro de `plan_mejoras_operativas.md`, antes del merge.
   - El resto: una tanda de deudas al terminar mejoras operativas.
3. **Alcance: todo el sistema, con el foco en lo nuevo desde julio.** Lo viejo no se saltea: se revisa que lo que
   cerró la auditoría de julio siga cerrado (las features nuevas pudieron reabrirlo) y se repasa con ojos nuevos,
   pero la profundidad mayor va a lo que nunca se auditó.
4. **Orquestador y un ejecutor por zona, todos en Fable** (`claude-fable-5-2`).
5. **Un solo documento de hallazgos**, `docs/auditoria_2026-11.md`, con una sección por zona. Cada ejecutor
   escribe su sección; el orquestador consolida.
6. **Segunda pasada antes del PR de merge** de mejoras operativas, solo sobre el diff de las fases que se hagan
   después de esta auditoría (§7, fase 10).
7. **También se busca lo que hace gastar de más al backend o lo vuelve lento** (zona 8). Railway cobra por uso
   de CPU, de memoria y de tráfico de salida, así que el objetivo es doble: que el sistema responda más rápido y
   que el servicio consuma menos. Igual que el resto, es solo diagnóstico: las optimizaciones van después.

## 3. Modo de trabajo

- **Orquestador** (chat nuevo, Fable): lee este doc, arma el esqueleto del documento de hallazgos, escribe un
  prompt autocontenido por zona, revisa cada sección contra el código real, consolida y cierra con el usuario qué
  se hace con cada hallazgo. Commitea solo documentación (`docs:`, en castellano, con
  `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`). Push y merge: el usuario.
- **Ejecutores** (un chat por zona, Fable): en `C:\Users\facul\sistema-gestion-barberia`, mismo branch, sin
  worktrees, sin commits. Pueden leer todo lo que necesiten: el prompt da por dónde arrancar, no una lista
  cerrada. Escriben únicamente su sección `## Zona N` de `auditoria_2026-11.md`.
- **En paralelo se puede.** Los ejecutores solo leen código y cada uno toca una sección distinta del documento,
  así que el usuario puede correr dos o tres zonas a la vez. También pueden convivir con un ejecutor de mejoras
  operativas: si el branch avanza durante la auditoría, cada ejecutor anota en su sección el commit que auditó
  (`git rev-parse --short HEAD` al empezar).
- **Preguntas al usuario:** enumeradas, en texto libre, con la recomendación de senior. Nunca selectores.

### Qué pueden y qué no pueden hacer los ejecutores

- **Leer la DB:** sí, con `node backend/src/scripts/consultar.js "<SQL>"` (rol `resguardo_lectura`, solo
  lectura). Sirve para confirmar constraints, índices, RLS, permisos de roles y datos inconsistentes ya
  existentes. No volcar datos personales de clientes al documento: contar, no listar.
- **Reproducir un hallazgo:** solo si hace falta para confirmar uno **alto o crítico** que la lectura no alcanza
  a cerrar. Se hace con controllers y `req`/`res` simulados contra el tenant **demo**
  (`aaaaaaaa-0000-0000-0000-000000000002`), con mail y Calendar apagados y `SENTRY_DSN` sin setear, y se limpia
  lo que se haya creado. Antes de escribir en demo, se le avisa al usuario en ese chat.
- **Nunca:** requests de prueba contra producción (dispararían el rate limiter y los avisos de Sentry a
  Discord), levantar servidores, tocar kingsai, luxuribarberclub o monte-sinai, correr SQL que escriba, instalar
  o actualizar dependencias (`npm audit` sin `fix` sí), ni arreglar lo que encuentren.

### Filtro de hallazgos

Tres reglas, las tres del usuario:

1. **Verificado contra el código.** Cada hallazgo se confirma leyendo el camino completo (ruta → middleware →
   controller → service → query, y el front si participa) antes de escribirlo. Si quedó una duda, va marcado
   "sin confirmar" con qué faltaría mirar. Un hallazgo supuesto que resulta falso le cuesta tiempo al usuario.
2. **Riesgo real.** Entra lo que le puede pasar a un usuario real (dueño, barbero, cliente del turnero) o lo que
   un atacante puede hacer con el acceso que de verdad tendría (anónimo por internet, cliente con un link,
   barbero con su PIN, el iPad del local, otro tenant). No entran casos teóricos sin camino concreto.
3. **Verificado contra los docs.** Antes de reportar, se chequea que no esté ya anotado en
   [`estado_actual.md`](./estado_actual.md) (Pendientes y Deudas técnicas conocidas),
   [`auditoria_2026-07.md`](./auditoria_2026-07.md) (§Deudas diferidas), `sistema_de_disenio.md` §9 o la sección
   de Hallazgos de [`plan_mejoras_operativas.md`](./plan_mejoras_operativas.md). Lo ya anotado no se repite,
   salvo que el diagnóstico esté mal, la severidad haya cambiado o una feature nueva lo haya agravado: en ese
   caso se reporta eso, citando la deuda original.

### Lo que ya se sabe (no volver a reportar)

Lista corta de lo más probable de reencontrar; el detalle está en los docs del punto 3.

- `trust proxy` mal configurado para Railway: `req.ip` es la de un proxy y el rate limiter comparte cupo.
- El error del pool de la DB llega a Sentry y a Discord.
- Reserva sin validar que `inicio` caiga en un slot real ni en el bloque horario del barbero.
- Sin idempotency key en `turno`, `venta` y `gasto`.
- TOCTOU sistémico por no poder usar transacciones; reserva contra suspensión o descanso a la vez.
- Secretos mezclados en la tabla `tenant` (propuesta `tenant_credenciales`).
- Sin captcha ni límite por email en el turnero público.
- El upsert de cliente pisa nombre y teléfono; cada 409 deja un cliente sin turno; duplicados de clientes.
- Token operativo y sesión del barbero en `localStorage`, aceptados mientras no haya sinks de XSS (si aparece
  un sink, eso sí es hallazgo y sube la severidad de esta decisión).
- Eliminaciones sin log de actividad.
- Subdominio viejo `kingsai` sin redirect; alias `DELETE /api/admin/suspensiones/:id`.
- Node 22 hasta 2027-04-30.

## 4. Formato de cada hallazgo

Identificador `Z<zona>-<nn>` (ej. `Z3-02`). Cada uno lleva:

- **Título** de una línea y **severidad**: crítico, alto, medio o bajo (la misma escala que julio).
- **Dónde:** archivo y línea (`backend/src/controllers/alta.js:120`), y la ruta HTTP o la pantalla.
- **Alcance:** "en producción" o "solo en el branch". Se decide con `git diff main...HEAD -- <archivo>` o
  `git show main:<archivo>`: si el código vulnerable ya está en `main`, es producción.
- **Qué pasa:** el escenario concreto. Quién, con qué acceso, hace qué, y qué resulta.
- **Evidencia:** "leído" (con el camino recorrido), "consultado en la DB" o "reproducido en demo".
- **Arreglo propuesto** y su tamaño: chico (pocas líneas), medio (un archivo o dos), grande (schema o varias
  capas). Si hay más de una forma, las opciones con la recomendada.
- **Novedad:** nuevo, o "agrava / corrige la deuda X".

Cada sección de zona cierra con **"Verificado correcto"**: la lista de lo que se revisó y está bien, con una
línea por punto. Es lo que permite que la próxima auditoría no arranque de cero, y lo que deja ver qué se miró.

Guía de severidad:

| Severidad | Criterio |
|---|---|
| Crítico | Un anónimo o un tenant lee o altera datos de otro tenant, toma una cuenta, o deja a un local sin poder operar. |
| Alto | Escalada de permisos dentro de un tenant, pérdida o corrupción de datos de plata o de turnos, abuso que cuesta reputación o dinero (mail, cuota). |
| Medio | Requiere una condición poco frecuente o tiene impacto acotado; números inconsistentes entre pantallas; falta de un límite. |
| Bajo | Hardening, defensa en profundidad, inconsistencias menores que un usuario real puede llegar a ver. |

## 5. Zonas

Los archivos listados son por dónde arrancar. Para ver qué cambió desde julio en una zona:
`git diff --stat adeb98a..HEAD -- <rutas>`. El schema está en [`SQL_Schema.md`](./SQL_Schema.md); la tabla de
roles por ruta, en `estado_actual.md` → Estado funcional → Sistema (confirmarla contra `backend/src/index.js`:
si el doc y el código difieren, eso es un hallazgo).

### Zona 1. Autenticación, sesiones y recuperación

**Por dónde arrancar:** `controllers/` `authPanel.js`, `authBarbero.js`, `authOperativo.js`, `authRecuperar.js`,
`adminOperativo.js`, `gestion.js` (cambio de PIN, edición de barbero); `services/recuperacionService.js`;
`middlewares/` los cinco; `config/jwt.js`; `utils/pin.js`, `credencialesOperativas.js`, `suscripcion.js`,
`contactoNegocio.js`. En los fronts: `frontend/src/services/api.js`, las pantallas de login y recuperación, y
`frontend-barbero/src/utils/sesion.js` con su `services/api.js`. Docs: `decisiones_login_operativo.md`,
`decisiones_acceso_barberos.md`, y F5 y F6 en `plan_mejoras_operativas.md`.

**Qué buscar:**
- Recuperación por mail (nunca auditada): cómo se genera, guarda, vence y se consume el token; si es de un solo
  uso; si se puede enumerar qué mails existen; a qué mail se manda y quién puede cambiar ese mail; si recuperar
  revoca las sesiones vigentes (`token_version`); rate limit; qué viaja en el fragmento `#recuperar=` y si
  termina en logs o en Sentry; inyección en el mail.
- Quién puede cambiar el mail y el celular del dueño, y si eso alcanza para tomar la cuenta (un barbero, el
  token operativo del iPad).
- Login unificado por PIN: unicidad de PIN entre admin y barberos, qué pasa con PIN repetidos, tiempos de
  respuesta que distingan casos.
- Sesión del barbero guardada 30 días: revocación al desactivar o cambiar el PIN, el "último barbero" guardado,
  celular compartido o perdido.
- Que lo cerrado en julio siga cerrado: revocación por `tv`, HS256 fijo, 401 contra 500 ante falla de la DB,
  mensajes genéricos, `limiterLogin` en **todos** los logins y en los endpoints nuevos de recuperación.
- Chequeo de suscripción: que no filtre datos antes del PIN ni se pueda saltear.
- Caché del `tenantMiddleware`: invalidación en cada cambio de credencial, incluidos los caminos nuevos.

### Zona 2. Aislamiento entre tenants y permisos por rol

**Por dónde arrancar:** barrido query por query de todos los `controllers/` y `services/`, como la fase 2 de
julio. `utils/scopingRol.js`, `middlewares/requiereRolMiddleware.js`, el montaje de rutas en `index.js`.

**Qué buscar:**
- Todo `SELECT`, `INSERT`, `UPDATE` y `DELETE` filtra por `tenant_id`. Prioridad a lo escrito después de julio:
  `socios`, `movimientosService`, `descansosService`, `suspensionesService`, `agenda`, `clientes`,
  `sqlTurnoEnriquecido`, `planillaService`, y lo de F1 (turno sin cliente, asignar cliente, búsqueda de clientes).
- Ids que llegan del cliente (`barbero_id`, `servicio_id`, `cliente_id`, `socio_id`, `turno_id`, `producto_id`,
  `categoria_id`): que se valide que son del tenant, por la app o por un FK compuesto. Confirmar en la DB qué
  tablas nuevas tienen FK compuesto `(tenant_id, X)` y cuáles no.
- Rol barbero en `/api/admin/*`: que cada controller lo limite a sus propios turnos, horarios, descansos,
  clientes y planilla. Un barbero no debe ver ni tocar lo de otro, ni ver plata del local. Asignar cliente y
  buscar clientes: qué datos personales ve un barbero y de quién.
- Rol operativo (el iPad, que usa cualquiera en el local): que no llegue a nada de admin.
- Tabla de roles por ruta del doc contra el código; rutas nuevas sin `verificarToken` o sin `requiereRol`.
- `/api/alta` y `/api/plataforma`, que viven fuera de la cadena de tenant: que no se pueda llegar a datos de un
  tenant desde ahí.
- En la DB: RLS activado en todas las tablas (también las nuevas), permisos de `anon`, `authenticated` y
  `resguardo_lectura`, y si la Data API sigue expuesta.

### Zona 3. Superficie pública: turnero, alta y mails

**Por dónde arrancar:** `controllers/turnero.js`, `turneroConfig.js`, `alta.js`, `imagenes.js`; `routes/turnero.js`,
`alta.js`; `services/disponibilidadService.js`, `turnosService.js`, `storageService.js`, `mail/*`;
`utils/validarSolicitudAlta.js`, `subdominio.js`, `validarTexto.js`; `middlewares/rateLimitMiddleware.js`.
Fronts: `frontend-turnero/src` y `frontend-alta/src` completos, y `.claude/skills/alta-cliente/` (la plantilla
SQL). Docs: `decisiones_turnero_ux.md`, `decisiones_alta_clientes.md`.

**Qué buscar:**
- Formulario de alta (nunca auditado): fuerza y vencimiento del token del link, qué puede hacer quien lo tenga,
  tamaño y forma del autoguardado (JSON arbitrario guardado en la DB), consulta de subdominio como oráculo,
  reenvío de una solicitud ya enviada, rate limit, inyección en el mail de aviso, y sobre todo **cómo los datos
  de la solicitud llegan a la plantilla SQL de la skill**: si un texto del formulario puede romper o inyectar
  esa query que después corre el usuario en Supabase.
- Turnero: "Cualquier barbero" (asignación, reintento del 409, si se puede forzar un barbero), `origen` del link
  (largo, contenido), `/turnos/resena` y cualquier redirect (que no sea un redirect abierto), gestión por token
  (cancelar y reprogramar turnos vencidos, F9; qué datos devuelve), límites de la reprogramación.
- Links armados con datos que carga el dueño (WhatsApp, mapa, reseñas, teléfono, `booking_url`): esquemas
  `javascript:` o URLs externas donde no corresponde, en el turnero y en los mails.
- Sinks de XSS en los dos fronts (`dangerouslySetInnerHTML`, `innerHTML`, `href` y `src` con datos), y el
  `.ics` de "Agregar al calendario" (inyección de líneas con datos del local o del servicio).
- Mails: que todo valor dinámico pase por el escape, incluidos los mails nuevos (recuperación, aviso de alta) y
  los asuntos; inyección de cabeceras.
- Subida de imágenes: tipo real del archivo contra el `Content-Type`, tamaño, nombres de archivo, borrado.
- Endpoints públicos: qué campos de `tenant` devuelven (que no salga ningún secreto ni el mail o celular del
  dueño si no corresponde), y qué límites tienen.

### Zona 4. Plata: caja, planillas, balances y stock

**Por dónde arrancar:** `controllers/` `cortes.js`, `ventas.js`, `gastos.js`, `caja.js`, `balances.js`,
`planilla.js`, `inicio.js`, `socios.js`, `productos.js`; `services/` `cortesService.js`, `movimientosService.js`,
`planillaService.js`, `sociosService.js`; `utils/` `comision.js`, `stock.js`, `movimientos.js`, `validarNumero.js`,
`validarPago.js`. Fronts: `SeccionCaja`, `SeccionPlanillas`, `SeccionBalances`, `SeccionInicio`, `SeccionVentas`,
`SeccionGastos`, los tres flujos del iPad, `utils/comision.js` y `movimientos.js` del panel, y `MiPlanilla` del
barbero. Docs: `decisiones_movimientos_extra.md`, `decisiones_descansos.md` (cortes con/sin turno).

**Qué buscar:**
- **Que el mismo número dé lo mismo en todas las pantallas.** Ingresos, comisiones, propinas, gastos y ganancia
  del mismo período en Inicio, Caja, Planillas, Balances y el Excel: mismas reglas de qué entra, mismo redondeo,
  mismos límites de día, semana y mes en hora argentina (un corte a las 23:50, el último día del mes, el domingo).
- Comisión: `corte.comision_porcentaje` guardada contra el % actual del barbero, la comisión de 5 en 5 (F7) y
  su validación en el backend, redondeos que no sumen.
- Pagos mixtos y formas de pago: que las partes sumen el total, montos en 0, negativos, topes.
- Editar y eliminar: un corte con turno (qué pasa con el turno), una venta (stock), un movimiento extra, un
  gasto de "Productos para venta". Doble aplicación o stock que no vuelve.
- Movimientos extra y socios: "Ganancia del mes" y "Queda en el negocio", socios inactivos con movimientos.
- Doble envío: doble toque en "Confirmar" en el iPad que registre dos cortes o dos ventas (mirar el front y el
  backend juntos).
- Stock: caminos que lo mueven sin pasar por `utils/stock.js`, stock negativo.
- Con `consultar.js`: buscar datos ya inconsistentes en producción (cortes con `turno_id` de un turno no
  completado, turnos completados sin corte, montos que no cierran, stock negativo). Contar, no listar.

### Zona 5. Agenda, turnos y concurrencia

**Por dónde arrancar:** `services/` `turnosService.js`, `descansosService.js`, `suspensionesService.js`,
`horariosService.js`, `horarioAtencionService.js`, `feriadosService.js`, `disponibilidadService.js`,
`recordatoriosService.js`, `googleCalendar.js`, `sqlTurnoEnriquecido.js`; `controllers/` `turnos.js`,
`turnosOperativo.js`, `agenda.js`, `descansos.js`, `suspensiones.js`, `horarios.js`, `horarioAtencion.js`,
`feriados.js`; `jobs/recordatorios.js`; `utils/validarFecha.js`. Fronts: la Agenda y el alta de turno de
`frontend-barbero`, `SeccionTurnero` del panel, y `useDisponibilidad` del turnero. Docs: `decisiones_turnero.md`,
`decisiones_descansos.md`, `decisiones_horario_atencion.md`, `decisiones_mail_recordatorio.md`.

**Qué buscar:**
- Estados del turno: todas las transiciones posibles desde cada camino (turnero, app del barbero, panel, iPad,
  cascadas). Transiciones que no deberían existir, turnos que quedan en un estado sin salida, "un turno se
  completa solo con su corte" respetado en todos lados, cancelar o reprogramar un turno pasado.
- Turno sin cliente (F1): todo `JOIN cliente` que ahora puede no encontrar fila, mails y recordatorios de un
  turno sin cliente, asignar cliente dos veces o a un turno ya cerrado.
- Cascadas (feriado, cambio de horario de atención, cambio de horario del barbero, suspensión): qué turnos
  cancelan, si avisan, y si un fallo a mitad de camino deja la mitad cancelada (no hay transacciones).
- Descansos: unir pegados, liberar uno en curso, rango efectivo, y que la disponibilidad, la Agenda del barbero
  y la del panel muestren lo mismo.
- Disponibilidad: bordes de la grilla (último slot, cruce de medianoche, servicio más largo que el hueco,
  slots de 50 minutos), "hoy" y "ahora" en hora argentina, feriados.
- Fechas: instantes sin zona que lleguen crudos al SQL, `new Date()` comparado contra hora argentina, fechas
  `DATE` convertidas con `toISOString()` que se corran un día.
- Concurrencia real: dos barberos o el dueño y un cliente sobre el mismo turno a la vez. Reportar solo lo que
  no cubren el `EXCLUDE` ni lo ya aceptado en las deudas diferidas.
- Recordatorios: claim atómico, doble envío, turnos cancelados o reprogramados después del claim, opt-in.
- Calendar: eventos huérfanos al cancelar o reprogramar, fallas que rompan la reserva.

### Zona 6. Panel de gestión y app del barbero (front)

**Por dónde arrancar:** `frontend/src` y `frontend-barbero/src` completos, con sus `services/api.js`. La landing
(`frontend-landing`) recibe una pasada corta: es estática y sin datos de usuarios.

**Qué buscar:**
- Sinks de XSS y links armados con datos (nombres de clientes, de servicios, notas): un cliente del turnero
  escribe su nombre y eso se muestra en el panel y en la app del barbero.
- Tokens: dónde viven, que no terminen en URLs ni en logs, manejo del 401 y del 402 en todas las llamadas, que
  cerrar sesión limpie todo, que el modo barbero del panel no dibuje ni pida datos de admin.
- Permisos solo en el front: acciones que el front oculta pero el backend permite (cruzar con la zona 2; si el
  backend lo permite, el hallazgo se anota acá y se avisa en el reporte).
- Fallas que ve el usuario: pantallas que quedan en "Cargando" para siempre ante un error, errores tragados sin
  aviso, formularios que pierden lo cargado, botones sin protección de doble toque, listas que quedan viejas
  después de una acción, respuestas que llegan fuera de orden al cambiar rápido de día o de filtro.
- Inconsistencias entre los dos fronts y con el backend: la misma regla escrita distinto (validaciones espejo
  de `contactoNegocio`, `credenciales`, `comision`, formato de fechas y de plata), y validaciones del front más
  laxas o más estrictas que las del backend.
- Exportación a Excel: celdas que empiecen con `=`, `+`, `-` o `@` con datos de clientes (inyección de fórmulas).
- `localStorage`: datos que queden de un tenant al entrar a otro subdominio, datos personales guardados.

### Zona 7. Operación, infraestructura y dependencias

**Por dónde arrancar:** `backend/src/index.js` (orden de middlewares, CORS, helmet, límites de body, log de
acceso, manejo de errores), `config/db.js`, `instrument.js`, `config/sentry.js`, `utils/sanitizarLogs.js`,
`backend/src/scripts/*`, `.github/workflows/backup-db.yml`, `.github/scripts/backup-db.sh`,
`.claude/settings.json`, las tres skills, los `vercel.json` y `vite.config.js` de los cinco fronts,
`.gitignore` y los `.env*.example`. Docs: `decisiones_monitoreo_prod.md`, `plan_resguardo_db.md`, `onboarding.md`.

**Qué buscar:**
- Secretos: en el repo y en su historial (`git log -p` sobre patrones de claves), en logs, en lo que viaja a
  Sentry, en la salida de los scripts y en los logs del workflow.
- Backup: permisos del workflow, cómo recibe y usa los secretos, cifrado, qué pasa si falla (¿avisa?), acciones
  de terceros fijadas por versión o por hash, y qué privilegios tiene de verdad `resguardo_lectura` (consultarlo).
- Logs y Sentry: datos personales o tokens en el texto de un log (PIN, token de gestión, token de alta, token de
  recuperación, mails de clientes), y `console.error` usados para rechazos esperados (alertas falsas al celular).
- Cabeceras y CORS: helmet vigente, CORS de producción, cabeceras de los fronts en Vercel (`noindex` donde
  corresponde, que el panel no se pueda embeber en un iframe), rewrites que expongan algo de más.
- `npm audit` (sin `fix`) en el backend y en los cinco fronts; dependencias de runtime abandonadas.
- Skills y lista `deny`: si una sesión en la nube puede hacer algo que escribe en producción y no está
  bloqueado; instrucciones de una skill que confíen en texto que viene de afuera (un aviso de Discord pegado,
  una solicitud de alta).
- Proceso: errores no atrapados que tumben el proceso, promesas sin `await` en caminos de escritura, el cierre
  limpio del cron, el endpoint de plataforma y `/api/health`.
- Doc contra realidad: variables de entorno documentadas que el código no usa, y al revés.

### Zona 8. Rendimiento y consumo del backend

Qué hace que el backend gaste más CPU, memoria o tráfico en Railway, y qué hace que el sistema se sienta lento.

**Antes de empezar:** leer [`performance_frontends.md`](./performance_frontends.md) (diagnóstico previo: el
cuello era el backend y la distancia entre Railway y Supabase; la migración de región sigue pendiente) y
`convenciones_tecnicas.md` §10. Pedirle al usuario, con preguntas numeradas, una captura de las métricas de
Railway de los dos servicios (CPU, memoria y red de las últimas semanas) y el costo del último mes: sin eso no
se sabe qué recurso es el que pesa. Lo ya diagnosticado en ese doc no se vuelve a reportar.

**Por dónde arrancar:** `backend/src/index.js` (qué corre en cada request), `middlewares/authMiddleware.js` y
`tenantMiddleware.js`, `config/db.js` (pool de 3, keep-alive, reintento), los logins, `services/disponibilidadService.js`,
`planillaService.js`, `controllers/balances.js`, `caja.js`, `inicio.js`, `agenda.js`, `jobs/recordatorios.js`,
`instrument.js`, y los `services/api.js` de los fronts con las pantallas que cargan más datos.

**Qué buscar:**
- **Consultas a la DB:** una query por fila dentro de un bucle (N+1), varias queries seguidas que podrían ser
  una, queries repetidas dentro del mismo request, `SELECT *` o columnas que no se usan, listados sin límite ni
  paginación que crecen con el tiempo (clientes, turnos, históricos). Con el pool de 3 conexiones, cada query de
  más también le quita lugar a los otros requests.
- **Índices:** con `consultar.js`, listar los índices que existen (`pg_indexes`) y cruzarlos con los `WHERE`,
  `JOIN` y `ORDER BY` de las queries más usadas. Se puede usar `EXPLAIN` (sin `ANALYZE`) sobre un `SELECT` para
  ver el plan. Reportar el índice que falta con la query que lo necesita, y los índices que sobran.
- **CPU del proceso:** bcrypt es lo más caro que corre el backend. Revisar el costo configurado y, sobre todo,
  cuántas comparaciones hace un login (el login unificado por PIN, si prueba contra el admin y contra cada
  barbero) y si un intento fallido cuesta lo mismo que uno bueno. También: cálculos de disponibilidad que
  recorren más días o más barberos de los que hacen falta, y trabajo de luxon dentro de bucles grandes.
- **Trabajo por request:** qué consultas corren en todos los requests (la del barbero en `verificarToken`, el
  tenant) y si un caché corto las ahorraría sin romper la revocación inmediata de sesiones.
- **Pedidos de los fronts:** pantallas que piden lo mismo dos veces, que piden al montar datos que no muestran,
  que vuelven a pedir todo después de cada acción, o que consultan cada pocos segundos. Cada uno es CPU y
  tráfico en Railway. Búsquedas que disparan un request por tecla.
- **Tamaño de las respuestas:** respuestas grandes sin comprimir, campos que ningún front usa, el Excel y los
  históricos.
- **Lo que no es por request:** el keep-alive del pool, el cron de recordatorios (cuánto tarda y qué recorre),
  el volumen de logs y lo que agrega Sentry.
- **Caché:** qué respuestas públicas y estables no se cachean y podrían (datos del negocio, imágenes). La
  disponibilidad y los slots no se cachean nunca (regla del proyecto, por el riesgo de doble reserva).
- **Memoria:** estructuras en memoria que crecen sin tope (cachés, mapas del rate limiter).

**Formato:** el de §4, con dos cambios. En vez de "Qué pasa" con un atacante, va **"Costo"**: qué recurso gasta
(CPU, memoria, tráfico, conexiones del pool o tiempo de espera del usuario), en qué pantalla o acción, y cuántas
veces por día pasa en un local normal. Y la severidad se lee así: alto, si pesa en cada request o en una pantalla
de uso diario; medio, si pesa en una acción frecuente pero acotada; bajo, si es una mejora marginal. Cada
propuesta dice además qué riesgo tiene optimizarlo (un caché que muestre datos viejos, por ejemplo).

**Regla de la zona:** no se optimiza por sospecha. Una mejora cuyo efecto no se puede estimar leyendo el código
se anota como "a medir", con cómo medirla (`convenciones_tecnicas.md` §10), no como hallazgo.

## 6. Contenido de cada prompt de ejecutor

Objetivo de la zona; la sección de este doc a leer (§3, §4 y la zona de §5); lectura obligatoria (`CLAUDE.md`,
`docs/convenciones_tecnicas.md`, `docs/estado_actual.md` → Pendientes y Deudas, `docs/auditoria_2026-07.md` →
Estado final y Deudas diferidas, `docs/SQL_Schema.md`, y los `decisiones_*.md` de la zona); archivos por dónde
arrancar; qué buscar; las tres reglas del filtro; lo que pueden y no pueden hacer; el formato del hallazgo; que
escriban solo su sección del documento; y el formato del reporte.

Todo prompt dice además:
- Esto es una auditoría de solo lectura: no se arregla nada, ni siquiera lo chico. Lo chico también se anota.
- Si algo es **crítico y está en producción**, el ejecutor frena y se lo dice al usuario en ese chat en el
  momento, sin esperar a terminar la zona.
- Si encuentra algo de otra zona, lo anota al final de su sección en "Para otra zona", en una línea.
- La profundidad importa más que la cantidad: cinco hallazgos confirmados valen más que veinte supuestos.

**Reporte del ejecutor** (en el chat, corto; el detalle queda en el documento): 1. Commit auditado. 2. Cantidad
de hallazgos por severidad, con el título de los críticos y altos. 3. Qué no llegó a revisar o quedó sin
confirmar. 4. Notas para otras zonas.

## 7. Fases

| Fase | Qué | Quién |
|---|---|---|
| 0 | Esqueleto de `auditoria_2026-11.md` (encabezado, tabla de zonas, una sección vacía por zona) y commit | Orquestador |
| 1 | Zona 1: autenticación, sesiones y recuperación | Ejecutor |
| 2 | Zona 2: aislamiento entre tenants y permisos por rol | Ejecutor |
| 3 | Zona 3: superficie pública | Ejecutor |
| 4 | Zona 4: plata | Ejecutor |
| 5 | Zona 5: agenda, turnos y concurrencia | Ejecutor |
| 6 | Zona 6: panel y app del barbero | Ejecutor |
| 7 | Zona 7: operación, infraestructura y dependencias | Ejecutor |
| 8 | Zona 8: rendimiento y consumo del backend | Ejecutor |
| 9 | Consolidación y decisiones | Orquestador |
| 10 | Segunda pasada sobre lo que falte de mejoras operativas | Orquestador o un ejecutor |

**Orden sugerido:** 1, 2 y 3 primero (es donde puede haber algo grave en producción), después 4 y 5, y al final
6, 7 y 8. Se pueden correr de a dos o tres a la vez. La zona 8 es independiente de las demás: puede ir en
cualquier momento, y conviene tener a mano las métricas de Railway antes de abrirla.

**Después de cada zona**, el orquestador:
1. Lee la sección y revisa contra el código cada hallazgo crítico o alto, y una muestra de los demás. Lo que no
   se sostiene se saca; lo dudoso vuelve al ejecutor con una pregunta puntual.
2. Ajusta severidades para que la escala sea pareja entre zonas.
3. Si hay un crítico en producción, se lo plantea al usuario en el momento con la propuesta de `fix/`.
4. Commitea la sección (`docs: auditoría 2026-11, zona N`).

**Fase 9, consolidación:**
1. Unir duplicados entre zonas y resolver los "Para otra zona".
2. Escribir arriba del documento el resumen ejecutivo: veredicto general, conteo por severidad, y la tabla de
   todos los hallazgos (id, título, severidad, alcance, tamaño del arreglo).
3. Proponerle al usuario, con preguntas numeradas, el destino de cada hallazgo: `fix/` ahora desde `main`,
   dentro de mejoras operativas antes del merge, tanda de deudas posterior, aceptado con su motivo, o descartado.
4. Volcar las decisiones: columna "Destino" en la tabla; lo que va a mejoras operativas, a la sección de
   Hallazgos de `plan_mejoras_operativas.md`; lo aceptado o pospuesto, a "Deudas técnicas conocidas" de
   `estado_actual.md`.
5. Sumar `auditoria_2026-11.md` y este plan al mapa de documentos de `CLAUDE.md` y a `ruta_proyecto.md`.
6. Para los `fix/` aprobados, dejar escrito un prompt por arreglo (o por tanda) para chats ejecutores. Los
   arreglos no son parte de este plan.

**Fase 10, segunda pasada:** antes del PR de merge de `feature/mejoras-operativas`, revisar
`git diff <commit auditado>..HEAD` (las fases hechas después de la auditoría, F3 en adelante) con los mismos
criterios, y sumar lo que salga al documento en una sección "Segunda pasada". Es chica: el grueso ya quedó
revisado. Recién ahí el plan pasa a "Archivado".

## 8. Verificación del plan

La auditoría está completa cuando:
- Las 8 zonas tienen su sección, con hallazgos en el formato de §4 y su lista de "Verificado correcto".
- Todo hallazgo crítico o alto fue revisado contra el código por el orquestador.
- Cada hallazgo tiene un destino decidido por el usuario.
- `estado_actual.md` y `plan_mejoras_operativas.md` reflejan lo que quedó pendiente.
- No hay cambios de código en los commits de este plan (`git diff --stat` solo muestra `docs/` y `CLAUDE.md`).

*— Fin del documento —*
