# Mejoras operativas — núcleo de decisiones

> ✅ **Completado (2026-11-19) en `feature/mejoras-operativas`; sin deploy todavía** (el deploy, el post-deploy y la
> prueba del usuario, en [`estado_actual.md`](estado_actual.md) → Pendientes). Documento **archivado**: solo el
> "por qué". El plan con las fases, el contrato final de cada endpoint y los hallazgos es
> [`plan_mejoras_operativas.md`](plan_mejoras_operativas.md) (§5 tiene una fila por fase con lo que quedó). Schema en
> [`SQL_Schema.md`](SQL_Schema.md) (`turno.cliente_id` nullable, `turno.no_asistio_por`, `turno_traspaso`,
> `token_recuperacion` y las columnas del dueño en `tenant`).

## Problema que resolvió

El día a día del local tenía huecos que el sistema no cubría: para anotar un turno rápido había que inventar un
cliente; un turno al que el cliente vino y que no se cobró sobre el turno quedaba reservado para siempre; un
barbero no podía pasarle un turno a otro; los socios se cargaban por SQL; si el dueño perdía la contraseña del
iPad o el PIN de admin, solo lo resolvía Facundo desde la DB. Además, el turnero se veía como un celular en una
compu, y el cliente podía cancelar un turno que ya había pasado. La tanda suma once features (F1 a F11) y, al
final, los arreglos de la auditoría 2026-11 que tocaban este código.

## Decisiones tomadas

| Feature | Decisión | Por qué |
|---|---|---|
| F1, turno rápido | `turno.cliente_id` **nullable**: un turno sin cliente es "Sin datos" en todas las pantallas. Se le asigna un cliente después (`PATCH /api/admin/turnos/:id/cliente`), del local y con cualquier rol; el admin lo puede **cambiar** (`reemplazar: true` + `cliente_actual_id`), y eso rota el `token_gestion`. | Inventar un cliente ensuciaba la base. Nullable es compatible con el backend viejo (siempre lo completa). El buscador no filtra por barbero porque los clientes no se cortan siempre con el mismo (auditoría Z2-01). Rotar el token deja sin el link al cliente anterior. |
| F2, traspasos | Tabla `turno_traspaso` con **estado efectivo calculado al leer**: una pendiente guardada vale solo si el turno sigue reservado, futuro, de A y con el mismo inicio (`turno_inicio`), y B sigue activo y libre. **Aceptar** es una sola sentencia que bloquea la solicitud, mueve el turno a B y la marca aceptada; el `23P01` la deja vencida. Solo el rol barbero; el admin no interviene. | El mismo modelo que el "rango efectivo" de los descansos: no hace falta un proceso que venza solicitudes. **Nunca se cancela un turno de cliente por un traspaso.** `turno_inicio` evita que B acepte un horario distinto del que le ofrecieron si el cliente reprograma. |
| F2, "libre" | `barberoLibreEnRango` (`disponibilidadService`): la definición del turnero aplicada al `[inicio, fin)` real del turno, sin la grilla y sin la antelación mínima. | Manda la duración del turno aunque el servicio haya cambiado, y un turno ya existente no tiene por qué caer alineado a la grilla de B. El límite es `inicio > now()`, igual que aceptar. |
| F2, app | Las ofertas y los resultados van a un **modal de avisos** (campanita en "Hoy" y número sobre "Hoy" en la barra), con un solo hook en `App` que refresca cada 60 s. A recibe aviso de todos los resultados, no solo de las aceptaciones. | El usuario quiere juntar todos los avisos en un lugar. Sin el aviso, un turno aceptado desaparece de la Agenda de A sin explicación. |
| F3, aviso | `GET /api/turnos/sin-cobrar` (operativo y admin): reservados cuyo fin pasó hace al menos `duracion_slot_minutos` + 10 min. En el iPad y el Inicio, un aviso que se puede ocultar durante esa misma duración y que **desde 20 min antes del cierre del local** pasa a modo alerta (ámbar) y ya no se oculta. | Un turno se completa solo con su corte (`decisiones_descansos.md`): el que no se cobró sobre el turno quedaba reservado para siempre. El margen da tiempo a cobrar el que recién terminó. Ámbar y no rojo porque en el iPad el rojo es el egreso. |
| F3, cierre | `jobs/cierreDiario.js` (03:00 AR): pasa a `no_asistio` con `no_asistio_por = 'sistema'` los reservados de días anteriores, una sentencia por tenant, idempotente, con el monitor de healthchecks. **El admin puede completar después un "no asistió" del sistema en cualquier día** (S-A-01); los que marcó una persona, solo el mismo día. | Sin el cierre, el aviso arrastraría los turnos viejos para siempre. La excepción del sistema existe porque el cron le quitaba al dueño una salida que antes tenía: cargar mañana el cobro de un turno de ayer. |
| F4, socios | Pestaña Gestión → Socios (alta, nombre, vínculo con un barbero, activar y desactivar; no se borran, tienen movimientos). Desactivar desvincula; no se puede desactivar al último socio activo. "Solo Barberos" de Caja saca los cortes de los barberos **vinculados a un socio activo** (`esSocioSql`), no los del 100 %. | La comisión va aparte de ser socio: con 100 % los cortes no suman a la ganancia, con 0 % suman y el socio retira. Balances no separa las comisiones de socios. El filtro mira el vínculo de ahora (aceptado): si alguien deja de ser socio, sus cortes viejos vuelven a aparecer. |
| F5, login del barbero | "Marco del local" con grilla de avatares, el último barbero del celular primero. La sesión queda guardada en el celular 30 días (`utils/sesion.js`). | El barbero entra muchas veces por día desde su celular. Aceptado en la auditoría (Z1-06): si pierde el celular, el dueño le cambia el PIN o lo desactiva. |
| F6, recuperación | "¿Olvidaste tu contraseña?" (iPad) y "¿Olvidaste tu PIN?" (panel) mandan un link de un solo uso, que vence en 1 h, al **mail del dueño** (`tenant.email_duenio`). El token va en el fragmento (`#recuperar=`) y en la DB solo su SHA-256. Usarlo sube la versión de token del rol y cierra las otras sesiones. | Antes, solo Facundo lo resolvía desde la DB. El fragmento no llega al servidor ni a los logs; el hash hace que leer la tabla no sirva para usar los links. |
| F6, límites | `limiterRecuperacion` (5 pedidos por hora por IP, cuenta todos) y un **tope de 6 links por día por local** en la misma sentencia de `emitirToken`; ante el tope, la misma respuesta sin mail y un aviso a Sentry. El mail se muestra tapado también en el dominio. Cambiar el mail del dueño pide el PIN de admin, anula los links pendientes y le avisa al mail anterior. | Auditoría Z1-01, Z1-02 y Z1-05: el pedido del link no tenía límite real y el cambio de mail era silencioso. El tope lo puede gastar un anónimo (S-A-02, aceptado): decirlo en pantalla le confirmaría que funcionó. |
| F6, PIN incorrecto | La re-autenticación con el PIN de admin (contacto, credenciales, PIN) responde **403** con `codigo: 'pin_admin_incorrecto'`, no 401. | Con 401, `apiFetch` cerraba la sesión del panel por un PIN mal tipeado. |
| F7, comisión | Barra de 0 a 100 de a 5 en Gestión → Barberos; el backend rechaza lo que no sea múltiplo de 5. | Evita % con decimales o tipeados mal. Antes se confirmó que no había barberos con un % fuera de la regla. |
| F8, horarios | Columna "días con horario / días que abre el local" (`3/5`) y un cartel arriba de la tabla si hay barberos **activos** en `0/x`. Solo front. | Un barbero sin horario aparece en el turnero pero no se le puede reservar, y nadie se enteraba. |
| F9, turnero | El cliente cancela o reprograma desde el link solo si el turno **no empezó** (`inicio > now()` en el `WHERE` del `UPDATE`); si no, 409 con un mensaje que lo manda a hablar con el local. | Un turno al que el cliente vino y que no se cobró sigue reservado: podía cancelarlo después de cortarse. |
| F10 y F11, turnero | La pantalla de éxito se aliviana (día y hora como dato principal, "Agregar al calendario", quién atiende, la dirección y el aviso del mail). Desde 768 px, el turnero muestra el panel del local a la izquierda y cada paso en su columna. | El éxito estaba cargado y el turnero se veía como un celular en una compu o un iPad. |

## Concurrencia

Sin transacciones (Session Pooler), cada escritura nueva lleva sus reglas en la misma sentencia:

- **Aceptar un traspaso:** un CTE que bloquea la solicitud (`FOR UPDATE`, así un "retirar" a la vez espera), mueve
  el turno solo si sigue reservado, futuro, de A, con el mismo inicio y sin descansos de B, y marca la solicitud
  aceptada solo si el turno se movió. El EXCLUDE GIST de `turno` es la red ante otro turno de B en ese horario.
- **Crear un traspaso:** el índice único parcial (una pendiente por turno) frena dos pedidos a la vez.
- **Socios:** el nombre repetido, el barbero ya vinculado y el último socio activo van en el `WHERE` del `INSERT` o
  del `UPDATE`; una lectura posterior solo decide qué error devolver.
- **Recuperación:** el freno de 2 minutos y el tope diario se calculan en la misma sentencia que anula los links
  anteriores y guarda el nuevo. Dos pedidos exactamente simultáneos pueden pasar los dos (un link de más).
- **Cierre diario:** una sentencia por tenant con `estado = 'reservado'` en el `WHERE`: no pisa un turno que justo
  se cobró.

## Compatibilidad con el backend en producción

La DB es una sola. Todos los cambios de schema de la tanda se aplicaron antes del deploy y son compatibles con el
backend viejo: columnas nullables (`turno.cliente_id`, `no_asistio_por`, las del dueño), tablas nuevas
(`token_recuperacion`, `turno_traspaso`) y `telefono_local` copiado de `telefono`. Lo que solo se puede hacer
después del deploy (el `NOT NULL` de las columnas del dueño, sacar `tenant.telefono` y `comision_valor` de Caja)
está en los pasos post-deploy de `estado_actual.md`.

## Cosas que NO entran (postergado)

- **Avisar al dueño cuando cambian el PIN de admin o la contraseña del iPad** (Z1-02, punto 3): tanda de deudas,
  bloque B.
- **Notificaciones nativas** de los traspasos: la app del barbero se entera en su refresco.
- **Separar en Balances las comisiones de socios.**
- **Reestructurar la sección Gestión del panel** (hoy son 7 pestañas): idea del usuario para más adelante.
- **El vencimiento del caché del tenant** al dar de baja un local: la baja se completa reiniciando el servicio web.
