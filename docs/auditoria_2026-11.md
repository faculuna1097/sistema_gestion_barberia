# Auditoría de seguridad y calidad — 2026-11

> **Estado (2026-11-17): consolidada.** Las 8 zonas revisadas y los 61 hallazgos con destino decidido por el
> usuario. Sigue abierta la fase 10 (segunda pasada antes del merge de mejoras operativas).
>
> Auditoría de **solo lectura**: no se modifica código, ni la base, ni configuración. Los arreglos se deciden
> al final, hallazgo por hallazgo, y van aparte. El plan (decisiones, zonas, filtro de hallazgos y fases) está
> en [`plan_auditoria_2026-11.md`](./plan_auditoria_2026-11.md).

Se audita el branch `feature/mejoras-operativas`, que contiene todo `main` más las fases hechas de mejoras
operativas. Commit base al crear este documento: `e80815c`. Si el branch avanza durante la auditoría, cada
zona anota el commit que auditó.

La auditoría anterior es la de julio ([`auditoria_2026-07.md`](./auditoria_2026-07.md)).

---

## Resumen ejecutivo

**Veredicto general.** La base sigue sólida en lo que más importa para un sistema con varios locales: ninguna
query deja leer ni escribir datos de otro local, RLS está activado en todas las tablas, no hay inyección de SQL
(ni siquiera en la plantilla de alta, que lee los datos con operadores `jsonb`), los mails escapan todo valor
dinámico, no hay secretos en el repo ni en su historial, y la plata da lo mismo en Planillas, MiPlanilla,
Balances y los Excel. Lo que encontró esta auditoría se concentra en cuatro lugares:

1. **Credenciales y acceso:** las credenciales iniciales predecibles de la skill de alta (Z7-01, el único
   crítico), el PIN de admin de 4 dígitos adivinable desde internet (Z1-03), y la recuperación por mail nueva,
   que manda mails sin tope y no avisa cuando cambia el mail del dueño (Z1-01, Z1-02).
2. **Endpoints públicos que gastan la cuota de mail compartida** (plan gratuito de Resend): reprogramar sin
   límite (Z3-01), pedir el link de recuperación (Z1-01) y el texto libre del nombre del cliente (Z3-03).
3. **La sesión de Claude en la nube como superficie nueva:** un anónimo puede escribir texto en los logs que
   esa sesión lee, y la sesión tiene un token que lee los secretos de Railway (Z7-02).
4. **Latencia:** casi cada pedido paga un viaje extra por el preflight de CORS (Z8-01) y la primera carga de
   cada pantalla abre conexiones nuevas (Z8-02). Railway cuesta $ 1,47 por mes: el consumo no es un problema.

**Conteo:** 61 hallazgos: 1 crítico, 5 altos, 16 medios y 39 bajos. 53 están en producción, 7 solo en el
branch y 1 solo en desarrollo.

**Familias** (hallazgos de zonas distintas que conviene decidir y arreglar juntos; no hubo duplicados
exactos para unir):

| Familia | Hallazgos |
|---|---|
| Cuota de mail compartida | Z3-01, Z1-01, Z3-03 (y la deuda diferida 4 de julio) |
| Borrar un corte con turno | Z4-09, Z5-04 (decidir antes de F3) |
| Input que da 500 y avisa a Sentry | Z3-02, Z1-04, Z7-06 |
| Logs con datos de afuera | Z7-02, Z7-05, Z7-07 |
| Acceso al panel y a las credenciales | Z7-01, Z7-10, Z1-03, Z1-07, Z7-03 |
| El Inicio del panel | Z4-03, Z4-06, Z8-03 |
| Disponibilidad del turnero | Z8-06 (con el piso de `duracion_slot_minutos` y el límite propio de sus GET) |
| Lo que trajo F1 | Z2-01, Z2-04, Z5-09 |
| `booking_url` y cabeceras del panel | Z3-06, Z7-08 |

### Todos los hallazgos

Alcance: **P** en producción, **B** solo en el branch, **D** solo en desarrollo. Tamaño del arreglo: chico,
medio, grande, o "datos" (lo corre el usuario). Destino: se completa con las decisiones de la fase 9.

| Id | Hallazgo | Sev. | Alc. | Tamaño | Destino |
|---|---|---|---|---|---|
| Z7-01 | Credenciales iniciales predecibles en la skill de alta; `monte-sinai` nació con ellas | Crítico | P | chico | Aceptado por el usuario (2026-11-17); la skill sale de `main` en el `fix/` de la prioridad 4 |
| Z1-01 | Pedir el link de recuperación no tiene límite por IP | Alto | B | chico | Mejoras operativas, antes del merge |
| Z1-03 | El PIN de admin de 4 dígitos se adivina desde internet en días | Alto | P | medio | `fix/` de `trust proxy`, prioridad 5; el PIN de 6 dígitos, aceptado en 4 por el usuario |
| Z3-01 | Reprogramar sin límite: mails sin tope a cualquier dirección | Alto | P | chico | Mejoras operativas (2026-11-18, decisión del usuario): límite y "horario igual" juntos, sobre la versión de F9 de `reprogramarTurno`; lo orquesta el chat de la auditoría |
| Z7-02 | Texto de un anónimo en los logs que lee la sesión de Claude en la nube | Alto | P | chico a medio | `fix/` desde `main`, prioridad 4 (puntos 1 y 2); el punto 3, con la fase 4 del resguardo |
| Z8-01 | Casi cada pedido paga un preflight de CORS | Alto | P | chico | **Resuelto** (2026-11-18): PR #10, `fix/cors-preflight-cache`; verificado en producción (`access-control-max-age: 7200`) |
| Z1-02 | Cambiar el mail del dueño no avisa a nadie | Medio | B | chico | Mejoras operativas, antes del merge |
| Z2-01 | El barbero elige un cliente del buscador y recibe "Cliente no encontrado" | Medio | B | chico | Mejoras operativas, antes del merge |
| Z3-02 | Un byte nulo en un texto público da 500 y avisa a Sentry | Medio | P | chico | Tanda de deudas, bloque A |
| Z4-01 | 12 cortes duplicados por doble toque en kingsaistudio | Medio | P | datos | Aceptado por el usuario (2026-11-17): los pagos a los barberos ya están hechos |
| Z4-03 | El "facturado" del Inicio no coincide con los ingresos de Balances | Medio | P | chico | Tanda de deudas, bloque D |
| Z4-04 | El iPad cobra con los precios que cargó al abrirse | Medio | P | chico | Tanda de deudas, bloque D |
| Z4-05 | Un corte mal cargado no se puede corregir sin cambiarle la fecha | Medio | P | medio | Tanda de deudas, bloque D |
| Z5-01 | Cambiar el horario de un barbero no avisa de los turnos que quedan afuera | Medio | P | medio | Tanda de deudas, bloque E |
| Z5-02 | Feriado y horario del local cancelan turnos sin mail y no dicen cuáles | Medio | P | medio | Tanda de deudas, bloque E |
| Z7-03 | La credencial de solo lectura vale como admin y hace pedidos HTTP desde la base | Medio | P | datos | Datos: SQL que corre el usuario, con la fase 5 del resguardo |
| Z7-04 | `body-parser` con un aviso alto de caída con cuerpos comprimidos | Medio | P | chico | `fix/` desde `main`, prioridad 4 (junto con Z7-02) |
| Z8-02 | El keep-alive mantiene caliente una sola de las 3 conexiones | Medio | P | chico | `fix/` desde `main`, prioridad 2 |
| Z8-03 | El Inicio del panel hace 11 queries con tandas en serie | Medio | P | medio | Tanda de deudas, bloque D |
| Z8-04 | La Agenda del barbero son 10 queries y se recarga cada 30 s | Medio | P y B | medio | El refresco cada 30 s: mejoras operativas; las 10 queries: tanda de deudas, bloque E |
| Z8-05 | Reservar, reprogramar y cancelar esperan a Calendar y al mail | Medio | P | medio | Tanda de deudas, bloque F |
| Z8-06 | El cálculo de días con lugar usa luxon en el bucle y frena el backend | Medio | P | medio | Tanda de deudas, bloque F (antes de que un local con varios barberos use el turnero propio) |
| Z1-04 | Un PIN que no es texto o un `barbero_id` mal formado dan 500 | Bajo | P | chico | Tanda de deudas, bloque A |
| Z1-05 | El mail del dueño a medio tapar se le da a cualquiera | Bajo | B | chico | Mejoras operativas, antes del merge |
| Z1-06 | La sesión del barbero se guarda 30 días sin preguntar | Bajo | B | chico | Aceptado por el usuario (2026-11-17): la sesión queda siempre guardada |
| Z1-07 | La confirmación con el PIN de admin no tiene tope de intentos | Bajo | P | chico | Tanda de deudas, bloque B |
| Z1-08 | El bloqueo por suscripción se chequea solo al entrar | Bajo | P | medio | Aceptado por el usuario (2026-11-17): el vencimiento no frena la operación y el día 11 ya se bloquea el panel |
| Z2-02 | `X-Tenant-Subdomain: constructor` pasa con tenant indefinido | Bajo | P | chico | Tanda de deudas, bloque A |
| Z2-03 | `anon` y `authenticated` con todos los permisos sobre las tablas | Bajo | P | datos | Datos: SQL que corre el usuario |
| Z2-04 | `turno.cliente_id` llega del cliente y su FK no es compuesto | Bajo | B | chico | Tanda de deudas, bloque B |
| Z3-03 | El nombre del cliente viaja libre al mail | Bajo | P | chico | Tanda de deudas, bloque C |
| Z3-04 | La solicitud de alta guarda campos sin validar | Bajo | P | chico | Tanda de deudas, bloque C |
| Z3-05 | El link del alta sigue mostrando los datos después de cargada | Bajo | P | chico | Tanda de deudas, bloque C |
| Z3-06 | `booking_url` acepta `javascript:` y el iPad lo abre | Bajo | P | chico | Mejoras operativas, antes del merge |
| Z4-02 | 12 cortes de kingsaistudio con el total sin la propina | Bajo | P | datos | Aceptado por el usuario (2026-11-17): datos viejos, se dejan como están |
| Z4-06 | Rótulos del Inicio corridos de 21 a 24 hs | Bajo | P | chico | Tanda de deudas, bloque D |
| Z4-07 | La propina toma la forma de pago del corte | Bajo | P | medio | Aceptado por ahora (2026-11-17); anotado como feature futura |
| Z4-08 | El stock solo se puede sumar | Bajo | P | chico | Tanda de deudas, bloque D |
| Z4-09 | Borrar un corte con turno da 500 si otro turno tomó el horario | Bajo | P | chico | Mejoras operativas, antes de F3 (junto con Z5-04) |
| Z4-10 | El Excel de Caja ignora "Solo Barberos" | Bajo | P | chico | Tanda de deudas, bloque D |
| Z5-03 | Una ausencia con inicio pasado cancela turnos ya atendidos y manda mail | Bajo | P | chico | Tanda de deudas, bloque C |
| Z5-04 | Borrar un corte devuelve el turno a "reservado" sin mirar nada | Bajo | P | chico a medio | Mejoras operativas, antes de F3 |
| Z5-05 | Un turno cobrado antes de hora libera su horario | Bajo | P | chico | Tanda de deudas, bloque E |
| Z5-06 | Reprogramar después del recordatorio deja sin recordatorio | Bajo | P | chico | Tanda de deudas, bloque C |
| Z5-07 | El horario del local deja pasar un turno que cruza la medianoche | Bajo | P | chico | Tanda de deudas, bloque C |
| Z5-08 | El iPad no muestra un turno "no asistió" | Bajo | P | chico | Tanda de deudas, bloque E |
| Z5-09 | Asignar un cliente a un turno "Sin datos" no se puede corregir | Bajo | B | chico a medio | Mejoras operativas, antes del merge |
| Z6-01 | El backend deja que un barbero cobre sus propios turnos | Bajo | P | chico | Tanda de deudas, bloque B |
| Z6-02 | "Sin barberos cargados" cuando lo que falló fue la carga | Bajo | P | chico | Tanda de deudas, bloque G |
| Z6-03 | La app del barbero muestra "Load failed" sin señal | Bajo | P | chico | Tanda de deudas, bloque G |
| Z6-04 | MiPlanilla puede mostrar los números de otra semana | Bajo | P | chico | Tanda de deudas, bloque G |
| Z7-05 | Datos de clientes en los logs de Railway | Bajo | P | chico | Tanda de deudas, bloque A |
| Z7-06 | Rechazos de input registrados como error | Bajo | P | chico | Tanda de deudas, bloque A |
| Z7-07 | Logins fallidos del iPad con `console.log` | Bajo | P | chico | Tanda de deudas, bloque A |
| Z7-08 | El panel se puede embeber en un iframe; la gestión del turno sin `noindex` | Bajo | P | chico | Tanda de deudas, bloque B |
| Z7-09 | La key de B2 puede ocultar o pisar los backups | Bajo | P | datos | Configuración: dashboard de B2 |
| Z7-10 | El PIN de admin de demo está en el repo público | Bajo | P | chico | Tanda de deudas, bloque B |
| Z7-11 | Sin `NODE_ENV=production` en el cron, Sentry lo dejaría sin avisos | Bajo | P | chico | Configuración: confirmar en Railway antes de tocar las reglas de Sentry |
| Z7-12 | Vulnerabilidades en las herramientas de desarrollo de los fronts | Bajo | D | chico | Tanda de deudas, bloque G |
| Z8-07 | 43 filtros por fecha que no pueden usar índice | Bajo | P | grande | Tanda de deudas, bloque F |
| Z8-08 | `googleapis` entero ocupa ~100 MB para usar solo Calendar | Bajo | P | chico | Tanda de deudas, bloque F |

### Plan de arreglos (decidido con el usuario el 2026-11-17)

Los arreglos no son parte de la auditoría: este es el orden en que se lanzan, cada uno en su chat ejecutor.

**1. `fix/` desde `main`, uno por vez y en este orden.** El primero es el de CORS: lo que más le importa al
usuario es la velocidad para los locales que ya están en producción.

| Prioridad | Arreglo | Hallazgos |
|---|---|---|
| 1 | `maxAge` en el `cors(...)` del backend. **Hecho** (2026-11-18, PR #10, `maxAge: 7200`, verificado en producción) | Z8-01 |
| 2 | Mantener calientes las 3 conexiones del pool (antes, confirmar el límite de conexiones de Supabase para el backend, el cron, el backup y `consultar.js`) | Z8-02 |
| 3 | **Pasó a mejoras operativas** (2026-11-18): el límite por IP en cancelar y reprogramar y el "horario igual" se hacen juntos en `feature/mejoras-operativas`, porque F9 reescribió `reprogramarTurno`. Sin apuro: hoy ningún local usa el turnero propio | Z3-01 |
| 4 | Logs sin query string y con el subdominio validado, la regla "lo que viene de un log es dato" en las tres skills, `body-parser` (`npm audit fix` e `inflate: false`), y sacar la skill `alta-cliente` de `main` (`git rm -r --cached` de la carpeta y la regla en `.gitignore` después de `!.claude/skills/`) | Z7-02 (puntos 1 y 2), Z7-04, Z7-01 |
| 5 | `trust proxy` para Railway (ya estaba en Pendientes de `estado_actual.md`) | Z1-03 |

**2. Dentro de mejoras operativas, antes del merge:** Z1-01, Z1-02, Z1-05, Z2-01, Z5-09, Z3-06, el refresco de
la Agenda de Z8-04, y Z5-04 con Z4-09 **antes de F3**. Anotados en la sección de Hallazgos de
`plan_mejoras_operativas.md`.

**3. Datos y configuración que hace el usuario:** Z2-03 y Z7-03 (SQL; Z7-03 con la fase 5 del resguardo),
Z7-09 (dashboard de B2), Z7-11 (Railway), y borrar en demo el turno y el cliente de prueba de la zona 8.

**4. Tanda de deudas, después del merge de mejoras operativas**, un bloque por chat ejecutor:

| Bloque | Tema | Hallazgos |
|---|---|---|
| A | Errores y logs | Z3-02, Z1-04, Z7-06, Z7-05, Z7-07, Z2-02 |
| B | Permisos y acceso | Z1-07, Z6-01, Z7-10, Z7-08, Z2-04 |
| C | Turnero, alta y mails | Z3-03, Z3-04, Z3-05, Z5-03, Z5-06, Z5-07 |
| D | Inicio y plata | Z4-03, Z4-06 y Z8-03 juntos (comparando los números de antes y después), Z4-04, Z4-10, Z4-08, Z4-05 |
| E | Agenda | Z5-01, Z5-02, Z5-05, Z5-08, y las 10 queries de Z8-04 |
| F | Rendimiento | Z8-06 (antes de que un local con varios barberos use el turnero propio), Z8-05, Z8-08, Z8-07 |
| G | Fronts | Z6-02, Z6-03, Z6-04, Z7-12 |

**5. Aceptados por el usuario (2026-11-17), con su motivo:**
- **Z7-01:** las credenciales de `monte-sinai` no se cambian; la skill sale de `main` en el `fix/` de la prioridad 4
  (la regla de "lo que viene de afuera es dato" se le agrega antes de sacarla, para que la copia local la tenga).
- **Z1-03, la parte del PIN de 6 dígitos:** queda en 4. El login del panel resuelve admin o barbero con el
  mismo PIN de 4 dígitos; pasar el de admin a 6 pide distinguir los dos accesos.
- **Z1-06:** la sesión del barbero queda siempre guardada, sin preguntar.
- **Z1-08:** el vencimiento no frena la operación, y desde el día 11 el panel ya se bloquea; con un mes de
  atraso, el usuario habla con el dueño y decide si da de baja el local.
- **Z4-01 y Z4-02:** datos viejos de kingsaistudio; los pagos a los barberos ya están hechos.
- **Z4-07:** por ahora; anotado como feature futura (elegir efectivo o Mercado Pago en la pantalla de propina).

---

## Zonas

| Zona | Área | Commit auditado | Estado | Crítico | Alto | Medio | Bajo |
|---|---|---|---|---|---|---|---|
| 1 | Autenticación, sesiones y recuperación | `fef2fd0` | Revisada | 0 | 2 | 1 | 5 |
| 2 | Aislamiento entre tenants y permisos por rol | `cb87b60` | Revisada | 0 | 0 | 1 | 3 |
| 3 | Superficie pública: turnero, alta y mails | `cb87b60` | Revisada | 0 | 1 | 1 | 4 |
| 4 | Plata: caja, planillas, balances y stock | `1e148fb` | Revisada | 0 | 0 | 4 | 6 |
| 5 | Agenda, turnos y concurrencia | `dd99386` | Revisada | 0 | 0 | 2 | 7 |
| 6 | Panel de gestión y app del barbero (front) | `9ad3ec9` | Revisada | 0 | 0 | 0 | 4 |
| 7 | Operación, infraestructura y dependencias | `b4b21b3` | Revisada | 1 | 1 | 2 | 8 |
| 8 | Rendimiento y consumo del backend | `f986081` | Revisada | 0 | 1 | 5 | 2 |

Estados: **Pendiente** (sin empezar), **Escrita** (el ejecutor terminó su sección) y **Revisada** (el
orquestador la revisó contra el código y la commiteó).

## Formato y severidades

Cada hallazgo se identifica como `Z<zona>-<nn>` (ej. `Z3-02`) y lleva título, severidad, dónde, alcance ("en
producción" o "solo en el branch"), qué pasa, evidencia, arreglo propuesto con su tamaño y novedad. El detalle
del formato y la guía de severidad (crítico, alto, medio, bajo) están en el plan, §4. La zona 8 cambia "Qué
pasa" por "Costo" y lee la severidad según cuánto pesa (plan, §5 → Zona 8).

Cada zona cierra con "Verificado correcto" (lo que se revisó y está bien, una línea por punto) y "Para otra
zona" (lo que se encontró de paso y le toca a otra).

---

## Zona 1. Autenticación, sesiones y recuperación

**Commit auditado:** `fef2fd0` (`feature/mejoras-operativas`), 2026-11-16. Solo lectura: código, docs y la DB
con el rol `resguardo_lectura`. No se escribió nada en demo ni se hicieron pedidos a producción. Lo único que
se ejecutó fuera de la lectura fue una prueba local de la librería `bcrypt` (sin base ni servidor), para
confirmar Z1-04.

**Resumen:** 8 hallazgos (0 críticos, 2 altos, 1 medio, 5 bajos). Z1-01 (alto) y Z1-02 (medio) están solo en
el branch (son de la recuperación por mail, F6): conviene arreglarlos antes del merge. Z1-03 (alto) está en
producción.

**Revisión del orquestador (2026-11-16):** Z1-01 se confirmó leyendo el camino completo (`index.js`,
`limiterLogin`, `solicitarRecuperacion`, `emitirToken`). De los demás se revisaron contra el código Z1-02,
Z1-03 y Z1-07. No se sacó ninguno; Z1-03 subió de medio a alto. Lo que cerró julio
sigue cerrado (detalle en "Verificado correcto").

**Cruce con Z2-02 y Z3-06** (pedido por el orquestador):

- **Z2-02** (`X-Tenant-Subdomain: constructor`) no cambia nada en esta zona. Con `tenant_id` indefinido, los
  tres logins responden su 401 genérico (la query por `id = NULL` no trae filas), `solicitar` responde 404,
  `validar` y `usar` no encuentran el token, y `verificarToken` responde 403. `invalidar('constructor')` no
  borra nada. Los intentos sí cuentan en el límite de logins, como cualquier fallo.
- **Z3-06** (`booking_url` con `javascript:`) sí cambia algo: es un sink de XSS en el origen del panel, y la
  decisión de julio (7.3) de dejar el token operativo en `localStorage` valía "mientras no haya sinks". Desde
  F5 pesa más, por dos motivos. Uno: en ese mismo origen ahora también se guarda la sesión del barbero por
  30 días (`barbero_sesion`), porque el panel, el turnero y la app del barbero se sirven desde el mismo host
  (`frontend/vercel.json`, rewrites de `/turnos` y `/barbero`) y comparten `localStorage`. Dos: el script se
  abre con `window.open` sin `noopener`, así que puede tocar la página del panel que lo abrió y leer el PIN
  de admin cuando alguien lo tipee en el iPad; con el PIN, desde F6, se cambia el mail de recuperación
  (Z1-02). No sube la severidad de Z3-06 (lo sigue pudiendo escribir solo un admin), pero es un motivo más
  para arreglarlo antes del merge. Sin confirmar: que Safari del iPad ejecute un `javascript:` pasado a
  `window.open` (no se probó).

### Hallazgos

#### Z1-01 [ALTO] Pedir el link de recuperación no tiene límite por IP: mails al dueño cada 2 minutos y la cuota de Resend agotada para todos

- **Dónde:** `backend/src/index.js:234-237` (`/api/auth/recuperar` con `limiterLogin`),
  `backend/src/middlewares/rateLimitMiddleware.js:79-85` (`skipSuccessfulRequests: true`),
  `backend/src/controllers/authRecuperar.js:74-122` (`solicitarRecuperacion`) y
  `backend/src/services/recuperacionService.js:104-128` (`emitirToken`, freno de 2 minutos). Ruta:
  `POST /api/auth/recuperar/solicitar`. Pantallas: "¿Olvidaste tu contraseña?" y "¿Olvidaste tu PIN?".
- **Alcance:** solo en el branch (`authRecuperar.js` y `recuperacionService.js` no existen en `main`).
- **Qué pasa:** `limiterLogin` cuenta solo las respuestas fallidas, y `solicitar` responde siempre 200. O sea
  que ese endpoint, en la práctica, no tiene límite por IP (el comentario de `index.js:235-236` lo dice: el
  único freno es el de 2 minutos por local y por tipo). Un anónimo, con un script y sabiendo solo el
  subdominio (que es público), puede:
  1. **Llenarle la casilla al dueño:** un mail cada 2 minutos por tipo, dos tipos: 60 mails por hora por
     local, sin fin, desde el dominio autenticado y con el nombre del local.
  2. **Agotar la cuota de Resend de todos los locales:** con los 3 locales activos que hoy tienen mail
     cargado son 180 mails por hora. El plan gratuito tiene un tope diario compartido (Z3-01): se agota en
     menos de una hora, y ese día no salen confirmaciones, recordatorios ni links de recuperación de ningún
     local. Cada mail que falla es un `console.error` que va a Sentry. Con un solo local alcanza: tarda algo
     menos de dos horas.
  3. **Acortar el link del dueño:** cada link nuevo anula los anteriores sin usar. Si el atacante pide uno
     apenas termina el freno, el link que el dueño acaba de recibir deja de servir a los 2 minutos (le llega
     otro, pero tiene que usar siempre el último).
- **Evidencia:** leído. Camino: `index.js:106` (`limiterGlobal`, 300 por minuto) → `index.js:237`
  (`limiterLogin`) → `solicitarRecuperacion` → `emitirToken` → `enviarRecuperacion` (`mailer.js:585`). En
  `express-rate-limit` 8.6.0, con `skipSuccessfulRequests` el contador se descuenta cuando la respuesta
  termina con status menor a 400 (`requestWasSuccessful`). Consultado en la DB: 4 tenants activos, 3 con
  `email_duenio`. Sin confirmar: el número exacto del tope diario de Resend.
- **Arreglo propuesto** (chico):
  1. Un limiter propio para `solicitar`, que cuente todos los pedidos (por ejemplo, 5 por hora por IP).
  2. Un tope por local que no dependa de la IP: en `emitirToken`, además del freno de 2 minutos, no emitir
     si ya hay N links de ese tenant en las últimas 24 horas (por ejemplo, 6 entre los dos tipos). Es una
     condición más en la misma sentencia y usa el índice que ya existe.
  3. Subir el freno entre mails de 2 a 10 minutos.

  Recomendado: 1 y 2 antes del merge. El 2 es el que importa mientras siga abierta la deuda de `trust proxy`
  (el cupo por IP se comparte y se puede repartir). El punto 3 de "Qué pasa" queda cubierto con el 2.
- **Novedad:** nuevo. Misma familia que Z3-01 (mails sin tope desde un endpoint público), más lento: Z3-01
  agota la cuota en un minuto y este en una hora.

#### Z1-02 [MEDIO] Cambiar el mail del dueño no avisa a nadie: quien tuvo el PIN una vez se queda con la recuperación

- **Dónde:** `backend/src/controllers/gestion.js:518-555` (`editarContactoNegocio`,
  `PUT /api/admin/negocio/contacto`). Pantalla: Gestión → Negocio → Contacto.
- **Alcance:** solo en el branch (el endpoint y la recuperación son de F6).
- **Qué pasa:** el cambio está bien protegido (solo rol admin y pide el PIN de admin otra vez), pero es
  silencioso. Alguien que supo el PIN de admin alguna vez (un encargado, un ex socio, un barbero que lo vio
  tipear en el iPad) pone su propio mail como mail del dueño. Nadie recibe un aviso. Desde ese momento puede
  pedir "¿Olvidaste tu PIN?" o "¿Olvidaste tu contraseña?" cuando quiera y elegir credenciales nuevas, aunque
  el dueño ya haya cambiado el PIN. Antes de F6, cambiar el PIN alcanzaba para dejar afuera a un intruso;
  ahora no, y el dueño solo se entera si abre Gestión → Negocio y mira el mail. Además:
  - Los links ya emitidos siguen sirviendo hasta 1 hora después de cambiar el mail (y también después de
    cambiar el PIN desde Gestión → Seguridad): nada los anula.
  - Cambiar el PIN o la contraseña del iPad tampoco avisa al mail del dueño.
- **Evidencia:** leído. `index.js:303` (`verificarToken`, `requiereRol('admin')`) →
  `editarContactoNegocio` → `verificarPinAdmin` → `UPDATE tenant SET email_duenio …`. No hay envío de mail ni
  escritura sobre `token_recuperacion` en ese camino, ni en `cambiarPinAdmin` (`gestion.js:610`) ni en
  `actualizarCredencialesOperativas`.
- **Arreglo propuesto** (chico; medio con el aviso de credenciales):
  1. Al cambiar `email_duenio`, mandar un aviso al mail **anterior** ("El mail de recuperación de {local}
     cambió. Si no fuiste vos, escribinos"), con el mailer que ya existe.
  2. En el mismo cambio, anular los links pendientes del tenant (`vence_en = now()`).
  3. Opcional: avisar también al mail del dueño cuando cambia el PIN de admin o la contraseña del iPad, y
     anular los links pendientes de ese tipo.

  Recomendado: 1 y 2 antes del merge; 3 en la tanda de deudas.
- **Novedad:** nuevo.

#### Z1-03 [ALTO] El PIN de admin (4 dígitos) se puede adivinar desde internet en días: el único freno es por IP

- **Severidad (revisada por el orquestador):** sube de medio a alto. El resultado es que un anónimo toma la
  cuenta de admin de un local, y el único freno (el cupo por IP) hoy no se cumple por la deuda de
  `trust proxy`. No llega a crítico porque necesita días de intentos sostenidos y no pasa en silencio: cada
  corte del límite de logins manda un aviso a Sentry y a Discord (`crearHandler429`), así que un ataque así
  se ve desde el primer día.
- **Dónde:** `backend/src/controllers/authPanel.js:34-119` (`POST /api/auth/panel/login`) y
  `backend/src/middlewares/rateLimitMiddleware.js:79-85`. Vale igual para `POST /api/auth/barbero/login`.
- **Alcance:** en producción (los logins y el limiter no cambiaron respecto de `main`).
- **Qué pasa:** el login del panel es público y pide solo el PIN. El freno es de 10 fallos cada 15 minutos
  por IP: 960 intentos por día. Con 10.000 combinaciones, una sola IP encuentra el PIN de admin en 10 días
  como mucho (5 en promedio), y como cada intento se compara contra el admin y contra todos los barberos
  activos, el PIN de algún barbero cae antes (en el local más grande, 5 PIN en juego: uno cada 2 días). Con
  varias IP el tiempo se divide. No hay ningún contador por local ni bloqueo progresivo: el local no se
  entera, y el aviso de Sentry por el límite de logins llega al celular de Facundo, no al dueño.

  La auditoría de julio (1.2) dio esto por resuelto con esa misma cuenta ("~10 días por IP"). Dos cosas lo
  empeoraron desde entonces: la deuda de `trust proxy` (el cupo por IP hoy no se atribuye bien y se puede
  repartir entre nodos de Railway), y F6, que le da más valor al PIN: con él se cambia el mail de
  recuperación y la cuenta queda tomada aunque después cambien el PIN (Z1-02).
- **Evidencia:** leído (`index.js:233` → `limiterLogin` → `loginPanel`: una comparación `bcrypt` contra el
  admin y una por barbero activo). Consultado en la DB: los 4 tenants activos tienen entre 2 y 4 barberos
  activos. No se probó contra producción.
- **Arreglo propuesto** (medio). Opciones:
  1. **PIN de admin más largo** (6 dígitos): un millón de combinaciones, casi 3 años por IP con el límite
     actual. No agrega forma de bloquearle el login a un local. Toca el login unificado (hoy asume 4 dígitos
     para todos), la validación, las dos pantallas de PIN y hay que pedirle a cada dueño que lo cambie.
  2. **Contador de fallos por local**, con espera creciente y aviso al mail del dueño. Frena también el
     ataque repartido entre IP, pero le deja a un anónimo una forma de trabarle el login por PIN a un local
     (el iPad sigue andando: su sesión ya está abierta).
  3. Arreglar `trust proxy` (ya anotado en Pendientes) y dejar el resto como está.

  Recomendado: 3 ya, porque hoy el límite por IP ni siquiera se cumple, y 1 para el PIN de admin. El de los
  barberos puede seguir en 4 dígitos: ve y toca solo lo suyo.
- **Novedad:** agrava el hallazgo 1.2 de julio (cerrado) y la deuda de `trust proxy` de `estado_actual.md` →
  Pendientes.

#### Z1-04 [BAJO] Un PIN o una contraseña que no es texto, o un `barbero_id` mal formado, dan 500 y un aviso de Sentry

- **Dónde:** `backend/src/controllers/authPanel.js:38` y `:58`, `authBarbero.js:28`, `:33-38` y `:47`,
  `authOperativo.js:31` y `:61`. Rutas: los tres `POST /api/auth/*/login`.
- **Alcance:** en producción (los tres archivos son iguales en `main`).
- **Qué pasa:** los logins chequean que el dato venga (`!pin`), no que sea texto. Un anónimo manda
  `{"pin": 1234}` (número, sin comillas): `bcrypt.compare` tira "data and hash must be strings", el `catch`
  hace `console.error`, responde 500 y Sentry avisa por Discord. Lo mismo con `password` numérica en el login
  del iPad. En el login del barbero, además, `barbero_id` va a la query sin pasar por `esUUID`: cualquier
  texto que no sea un UUID da el error `22P02` de Postgres y otro 500 (la convención de §2 pide validarlo
  antes). Está acotado por el límite de logins (un 500 cuenta como fallo: 10 cada 15 minutos por IP), pero
  son alertas falsas al celular, y cada una le gasta cupo de login a quien comparta esa IP.
- **Evidencia:** leído, y probado en local solo con la librería (`bcrypt` 6.0.0: `compare` con un número, un
  objeto, un array o `true` rechaza la promesa; con un hash mal formado devuelve `false`). El `22P02` del
  `barbero_id` no se reprodujo: es el caso que describe `convenciones_tecnicas.md` §2.
- **Arreglo propuesto** (chico): en los tres logins, 400 si `pin`, `usuario` o `password` no son `string`, y
  en `loginBarbero`, el 401 genérico si `barbero_id` no pasa `esUUID`. Lo mismo, de paso, en `crearBarbero`,
  `editarBarbero` y `cambiarPinAdmin` (`gestion.js:99`, `:165` y `:616`): el `/^\d{4}$/.test(pin)` acepta el
  número 1234 y después `bcrypt` tira. Esos tres son solo de admin.
- **Novedad:** nuevo.
- **Amplía Z3-02** (el byte nulo): en esta zona, el único campo de un login o de la recuperación que llega
  crudo a Postgres es ese `barbero_id` (cualquier texto que no sea UUID, con o sin `\u0000`, da 500). El PIN,
  el usuario y la contraseña del iPad no llegan a la base (van a `bcrypt` o a un `===`; un PIN con `\u0000`
  devuelve `false`, probado). En la recuperación, `token` y `tipo` se validan antes de la query, y `nueva`
  se guarda ya hasheada. El middleware global que propone Z3-02 cubre el caso del `barbero_id` con nulo,
  pero no el del UUID mal formado ni el del tipo.

#### Z1-05 [BAJO] El mail del dueño, a medio tapar, se le entrega a cualquiera que lo pida

- **Dónde:** `backend/src/services/recuperacionService.js:58-64` (`enmascararEmail`) y
  `backend/src/controllers/authRecuperar.js:93-117`. Ruta: `POST /api/auth/recuperar/solicitar`.
- **Alcance:** solo en el branch.
- **Qué pasa:** la respuesta trae las dos primeras letras del mail del dueño y el dominio entero
  (`fa•••@gmail.com`), sin pedir nada a cambio: alcanza con el subdominio. Con un mail de Gmail es poco. Con
  un dominio propio (`juan@mibarberia.com`) es casi el mail completo. Sirve para apuntarle un phishing al
  dueño: el atacante sabe a qué proveedor escribirle y puede disparar un mail real de recuperación justo
  antes de mandar el suyo. Además, `{ enviado: false }` le dice a cualquiera qué locales no tienen mail
  cargado. Que un local exista no es dato nuevo (el turnero ya lo confirma).
- **Evidencia:** leído, y consultado en la DB: hoy 0 de los 3 mails cargados son de dominio propio y ninguno
  tiene un usuario de 4 letras o menos.
- **Arreglo propuesto** (chico): tapar también el dominio (`fa•••@g•••.com`). El dueño reconoce su mail
  igual. La respuesta sin mail (`enviado: false`) puede quedar: la pantalla la necesita para decirle a quién
  escribirle.
- **Novedad:** nuevo. Responde la nota de las zonas 2 y 3.

#### Z1-06 [BAJO] La app del barbero deja la sesión guardada 30 días sin preguntar, también en un dispositivo compartido

- **Dónde:** `frontend-barbero/src/utils/sesion.js:79-88` (`guardarSesion`) y `frontend-barbero/src/App.jsx:152`
  (`onLogin`) y `:165` (`cerrarSesion`). Pantalla: login de la app del barbero.
- **Alcance:** solo en el branch (`sesion.js` no existe en `main`: ahí la sesión vive en memoria).
- **Qué pasa:** después del PIN la sesión queda en `localStorage` por 30 días, siempre. Un barbero que entra
  a `/barbero` desde el iPad del local, la compu del mostrador o el celular de un compañero deja su sesión
  abierta ahí, salvo que se acuerde de tocar "Cerrar sesión": el que agarre ese dispositivo ve su agenda (con
  nombre, mail y teléfono de sus clientes) y su planilla, y puede cancelarle turnos o marcarle descansos.
  Para el panel el proyecto ya decidió lo contrario por este mismo motivo ("el token del panel sigue en
  memoria: el iPad es compartido"). Aparte, "Cerrar sesión" borra el token del dispositivo pero no lo
  revoca: ante un celular perdido, lo único que corta la sesión es que el dueño le cambie el PIN o lo
  desactive, y eso no está dicho en ninguna pantalla.
- **Evidencia:** leído (`Login` → `onLogin` → `guardarSesion`; `leerSesion` al cargar el módulo; el 401 y
  "Cerrar sesión" llaman a `borrarSesion`). La revocación del lado del servidor sí funciona (ver "Verificado
  correcto").
- **Arreglo propuesto** (chico): una casilla "Mantener la sesión en este celular" en el login (marcada por
  defecto si se quiere conservar la comodidad), y una línea en `onboarding.md` o en Gestión → Barberos:
  "si un barbero pierde el celular, cambiale el PIN". Como la app todavía no tiene usuarios, se puede decidir
  sin cuidar costumbres.
- **Novedad:** nuevo. Es un caso que no cubre la deuda ya anotada del token en `localStorage` (esa habla de
  XSS, no del dispositivo compartido).

#### Z1-07 [BAJO] La confirmación con el PIN de admin no tiene tope de intentos

- **Dónde:** `backend/src/utils/pin.js:41-46` (`verificarPinAdmin`), usado en `gestion.js:530` (contacto),
  `gestion.js:622` (cambio de PIN) y `adminOperativo.js:105` (credenciales del iPad). Rutas:
  `PUT /api/admin/negocio/contacto`, `/api/admin/negocio/pin-admin` y `/api/admin/operativo/credenciales`.
- **Alcance:** en producción para el cambio de PIN y las credenciales del iPad (en `main` responden 401 en
  vez de 403, con la misma falta de límite); solo en el branch para el contacto.
- **Qué pasa:** esos tres endpoints piden el PIN otra vez para que una sesión de admin abierta no alcance
  para cambiar credenciales. Pero un PIN incorrecto responde 403 todas las veces que haga falta: el único
  freno es el global de 300 pedidos por minuto, y con eso los 10.000 PIN se prueban en media hora. Quien
  tenga una sesión de admin pero no el PIN (el panel quedó abierto en una compu y copia el token desde las
  herramientas del navegador, o un script inyectado por Z3-06) saca el PIN, y con el PIN se queda con la
  cuenta (Z1-02). Desde el iPad, a mano, no es practicable.
- **Evidencia:** leído (`index.js:303` y `:305` montan los routers solo con `verificarToken` y
  `requiereRol('admin')`).
- **Arreglo propuesto** (chico): un limiter para esos tres `PUT` que cuente los 403 (por ejemplo, 5 fallos
  cada 15 minutos por IP), o cerrar la sesión de admin al tercer PIN de confirmación incorrecto.
  Recomendado: el limiter.
- **Novedad:** nuevo.

#### Z1-08 [BAJO] El bloqueo por suscripción vencida se chequea solo al entrar

- **Dónde:** `backend/src/controllers/authPanel.js:60-66` (el único uso de `evaluarSuscripcion`) y
  `backend/src/middlewares/authMiddleware.js` (no la mira).
- **Alcance:** en producción.
- **Qué pasa:** el 402 sale únicamente en el login del admin. Un token de admin ya emitido sigue sirviendo
  en toda la API hasta que vence (30 días) o hasta que se recarga la página. Un dueño que entra el día 10
  (con el aviso amarillo) y no cierra esa pestaña sigue usando el panel completo pasado el día 11, hasta un
  mes. No expone datos de nadie: es un límite comercial que se puede esquivar sin querer. El chequeo no
  filtra nada antes del PIN (el 402 sale solo después de que el PIN de admin coincidió) y no bloquea al
  barbero ni al iPad, como está decidido.
- **Evidencia:** leído (`grep` de `evaluarSuscripcion`: un solo uso).
- **Arreglo propuesto** (medio): guardar `suscripcion_vigente_hasta` en la entrada del caché del tenant y
  evaluarla en `verificarToken` para el rol admin (402, que el front ya sabe mostrar en el login; habría que
  manejarlo en `apiFetch`). Ojo con el caché: renovar la suscripción por SQL pediría invalidarlo, igual que
  una baja. Alternativa más simple: aceptarlo y anotarlo en "Lógica de suscripción".
  Recomendado: aceptarlo y anotarlo, salvo que aparezca un caso real.
- **Novedad:** nuevo (el doc dice "bloqueo total del panel" sin esta salvedad).

### Verificado correcto

**Lo que cerró julio y sigue cerrado**

- **1.1, revocación por `tv`:** los tres logins firman con `tv`; `verificarToken` lo compara en los tres
  roles (admin y operativo contra el caché del tenant, barbero con su query, que además corta si quedó
  inactivo). `editarBarbero` sube `token_version` al cambiar el PIN y al desactivar; `cambiarPinAdmin` y el
  cambio de contraseña del iPad suben la suya en el mismo `UPDATE`.
- **1.1, 401 contra 500:** la firma y el vencimiento dan 401 sin tocar la DB; una falla de la consulta de
  revocación da 500 y no cierra la sesión. `tenantMiddleware` también responde 500 ante una falla de la DB.
- **1.2, `limiterLogin`:** montado en los cuatro routers de `/api/auth` (`index.js:230-237`), con un contador
  compartido. Lo que no cubre es `solicitar` (Z1-01).
- **1.3 y 1.4, JWT:** `config/jwt.js` es el único que lee `JWT_SECRET`, fija HS256 al firmar y al verificar,
  y en producción no arranca sin el secreto. Ningún otro archivo llama a `jsonwebtoken`.
- **Mensajes genéricos:** cada login responde lo mismo en todos sus caminos de fallo ("PIN incorrecto",
  "Usuario o PIN incorrecto", "Credenciales inválidas"), también con tenant inactivo o sin credenciales.
- **7.1, el 401 en los fronts:** `apiFetch` del panel y de la app del barbero limpian el token y vuelven al
  login; la app del barbero además borra la sesión guardada.
- **Aislamiento del token:** `verificarToken` cruza el tenant del token con el del subdominio (403).

**Recuperación por mail (F6)**

- **Token:** 32 bytes de `crypto.randomBytes` en base64url. En la DB se guarda solo el SHA-256
  (`token_hash`, `UNIQUE`). Consultado: 2 filas, las dos usadas, 0 vigentes, todas con hash de 64 caracteres;
  la tabla tiene RLS y ninguna policy.
- **Vencimiento y un solo uso:** vence a la hora (default de la columna, con el reloj de la base). `usarToken`
  marca el token y cambia la credencial en una sola sentencia, con `usado_en IS NULL AND vence_en > now()` en
  el `WHERE`: dos pedidos a la vez con el mismo link no pasan los dos. `validar` no lo consume, así que el
  lector de links de un cliente de mail no lo gasta. Un link nuevo anula los anteriores del mismo tipo.
- **Atado al tenant:** las tres queries filtran por `tenant_id` además del hash; un link de un local no sirve
  en el subdominio de otro, y responde lo mismo que uno vencido o usado.
- **Sesiones:** usar el link sube `admin_token_version` u `operativo_token_version` en la misma sentencia y
  después invalida el caché: las sesiones de ese rol quedan cerradas en el pedido siguiente.
- **A qué mail va:** a `tenant.email_duenio`, leído en el momento. No hay ningún dato del pedido que elija el
  destino. Sin mail cargado no se genera nada.
- **Quién cambia ese mail y el celular:** solo el rol admin (`requiereRol('admin')` en `/api/admin/negocio`),
  y además con el PIN de admin en el body. Un barbero o el token del iPad reciben 403. El `GET` público
  (`/api/negocio`) no los devuelve: el de admin es otro handler. Lo que falta es el aviso (Z1-02).
- **El link:** el host se arma con el header de subdominio, que ya tuvo que coincidir exacto con un tenant
  activo; en producción no hay `TENANT_ID` de respaldo. No se puede apuntar a otro dominio.
- **El fragmento `#recuperar=`:** el navegador no lo manda al servidor, así que no queda en los logs de
  Vercel. `App.jsx:57-66` lo lee al cargar el módulo y lo saca de la URL con `replaceState`. El panel no
  carga scripts de terceros ni tiene Sentry en el front. Al backend viaja en el body, y el log de acceso tapa
  `token` y `nueva`; los logs del controller llevan solo el tenant y el tipo; a Sentry no va el body. Los
  `console.error` del front escriben el mensaje y el status, no el token.
- **Inyección en el mail:** el asunto es fijo; el nombre del local, el usuario del iPad y el link pasan por
  el escape del HTML (lo revisó la zona 3); el envío es un JSON a Resend, sin cabeceras armadas a mano.
- **Unicidad en la recuperación del PIN:** el PIN nuevo se compara contra todos los barberos (activos e
  inactivos) y un choque da 409 sin gastar el link. Poder repetir el PIN anterior del admin es una decisión.
- **Fuerza bruta del token:** 256 bits; `validar` y `usar` con un token que no sirve dan 400, que sí cuenta
  en `limiterLogin`.

**PIN, login unificado y suscripción**

- **Unicidad de PIN:** la validan todos los caminos que escriben un PIN: `crearBarbero`, `editarBarbero`,
  `cambiarPinAdmin`, la recuperación y el alta (`armarQuery.mjs:127-129` rechaza PIN repetidos entre el admin
  y los barberos). El login resuelve primero el admin, y ante más de un barbero con el mismo PIN responde 401
  sin elegir. No se puede comprobar en la DB si hoy hay PIN repetidos sin probar PIN contra los hashes, y eso
  no se hizo.
- **Hashes:** los 5 `pin_admin` y las contraseñas del iPad son bcrypt de costo 10. De 22 barberos, 20
  también; los otros 2 son barberos inactivos de demo con un texto de 1 carácter en `pin`, que `bcrypt`
  rechaza siempre (probado: devuelve `false`, no tira).
- **Tiempos de respuesta:** un PIN que no es de nadie recorre siempre al admin y a todos los barberos; el
  login del iPad compara la contraseña aunque el usuario no coincida. No se distingue "usuario existe" por
  tiempo. En el login del barbero, un `barbero_id` inexistente responde más rápido, pero la lista de
  barberos ya es pública.
- **Suscripción:** el 402 sale recién después de que el PIN de admin coincidió; con un PIN incorrecto no se
  sabe nada del estado del local. La salvedad está en Z1-08.

**Sesión del barbero (F5)**

- La sesión guardada es el mismo JWT de 30 días: cambiarle el PIN o desactivarlo la corta en el pedido
  siguiente (401, y la app borra lo guardado). `leerSesion` descarta una sesión vencida o mal formada.
- "El último barbero" es solo su id, que ya es público (`/api/turnero/barberos`).
- Cada subdominio es un origen distinto: lo guardado para un local no se lee desde otro.

**Caché del tenant**

- Los tres caminos que cambian una versión de token invalidan la entrada: `cambiarPinAdmin`, el cambio de
  contraseña del iPad y `usarRecuperacion`. Cambiar solo el usuario del iPad o el contacto del dueño no toca
  ninguna versión, así que no hace falta. La clave del caché es el header tal como llega, y solo un valor
  exacto resuelve a cada tenant, así que `invalidar` borra la entrada correcta.
- Lo que sigue igual y ya está anotado: el caché es por proceso (el hallazgo del 2026-11-13 en
  `plan_mejoras_operativas.md`) y una baja a mano pide reiniciar el servicio.

### Sin revisar

- No se reprodujo nada en demo: los ocho hallazgos se cerraron leyendo.
- El tope diario exacto de la cuenta de Resend (cambia en cuánto tarda Z1-01, no si pasa).
- Si Safari del iPad ejecuta un `javascript:` en `window.open` (es de Z3-06).
- De los fronts se leyó la lógica (tokens, almacenamiento, logs, manejo de 401 y 402), no el render completo
  de `PantallaRecuperacion`, `SolicitudRecuperacion`, `BloqueContacto` ni `TabSeguridad`.

### Para otra zona

- **Zona 6:** el panel, el turnero y la app del barbero comparten origen y `localStorage` (rewrites de
  `frontend/vercel.json`): un sink de XSS en cualquiera de los tres expone `token_operativo` y
  `barbero_sesion`. Sumarlo al criterio de la zona.
- **Zona 7:** el log de acceso escribe el `usuario` del login del iPad y el `barbero_id` de cada intento
  (`sanitizarObjeto` tapa solo las claves de su lista). Y `loginOperativo` registra los fallos con
  `console.log`, no con `console.warn` como pide la convención §1 para los eventos de seguridad
  (`authOperativo.js:46`, `:55` y `:64`).
- **Zona 8:** `POST /api/auth/recuperar/solicitar` hace dos queries por pedido y hoy solo lo frena el límite
  global (se arregla con Z1-01). Cada intento fallido del login del panel cuesta una comparación `bcrypt` por
  barbero activo más la del admin.
- **Docs (para el cierre de mejoras operativas):** `estado_actual.md` → "Caché del middleware" no nombra a la
  recuperación entre los caminos que invalidan; el comentario de cabecera de `authBarbero.js:9-11` dice que
  los PIN se repiten y que la lista sale de `GET /api/barberos`, y las dos cosas dejaron de ser ciertas; y
  el de `rateLimitMiddleware.js:70` habla de 3 endpoints de login (son 4 routers).

---

## Zona 2. Aislamiento entre tenants y permisos por rol

Commit auditado: `cb87b60`. Hecha en dos tandas (código primero; base y fronts después). Lo poco que quedó
sin mirar está en "Sin revisar", al final de la sección.

**Revisión del orquestador (2026-11-16):** los cuatro hallazgos se confirmaron contra el código y la base
(`clientes.js`, `tenantMiddleware.js`, `authMiddleware.js`, `turnosService.js`, `pg_constraint`, `relacl` y
`pg_default_acl`). No se sacó ninguno. Z2-01 se reescribió después con una decisión del usuario: el buscador de
clientes queda abierto a todo el local, y el hallazgo pasa a ser el bug de F1.

### Hallazgos

#### Z2-01 — El barbero elige un cliente del buscador y recibe "Cliente no encontrado" (medio)

- **Decisión del usuario (2026-11-16):** el buscador de clientes **no** filtra por barbero. Hay clientes que no
  se cortan siempre con el mismo, así que cualquier barbero tiene que poder encontrar a cualquier cliente del
  local. Que un barbero vea nombre, mail y teléfono de los clientes del local queda **aceptado por diseño**. El
  hallazgo original del ejecutor ("un barbero puede leer toda la base de clientes") se reescribió con esa
  decisión: lo que queda es el bug de F1.
- **Dónde:** `backend/src/services/turnosService.js:604-632` (`sqlClienteDelBarbero`, `clienteUsable`) y
  `:726-752` (`asignarClienteATurno`). Rutas: `POST /api/admin/turnos` con `cliente_id` y
  `PATCH /api/admin/turnos/:id/cliente`, con rol barbero. Pantallas: alta de turno y "Asignar cliente" en la app
  del barbero, y "Asignar cliente" del panel en modo barbero.
- **Alcance:** solo en el branch (el `cliente_id` en el body y la asignación son de F1).
- **Qué pasa:** el buscador (`GET /api/admin/clientes`, `controllers/clientes.js:58-81`) devuelve los clientes
  de todo el local, pero el alta del turno y la asignación solo aceptan, con rol barbero, un cliente que ya
  tuvo un turno reservado o completado con ese barbero. Un barbero busca a un cliente habitual del local que
  nunca se atendió con él, lo encuentra, lo elige, y el servidor responde "Cliente no encontrado". Para ese
  cliente no tiene salida desde la app: si lo carga a mano sin mail, crea un duplicado.
- **Evidencia:** leído (ruta → `verificarToken` → `requiereRol('admin', 'barbero')` → `getClientes`, que filtra
  solo por `tenant_id`; y `crearTurnoAdmin` / `asignarCliente` → `clienteUsable` → `sqlClienteDelBarbero`). En el
  front: `SelectorCliente.jsx:52` muestra lo que devuelve `useBusquedaClientes` y `utils/clienteTurno.js:18`
  manda el `cliente_id` elegido; el panel en modo barbero hace lo mismo (`turnero/AsignarCliente.jsx:94`).
- **Arreglo propuesto (chico):** sacar el filtro de "cliente suyo" de `clienteUsable` y de
  `asignarClienteATurno`: con rol barbero alcanza con que el cliente sea del local, igual que con admin. El
  scoping del **turno** (un barbero solo toca sus turnos) no cambia. `sqlClienteDelBarbero` queda sin uso y se
  borra; `getMisClientes` sigue igual (es el listado de "mis clientes", no el buscador). Va dentro de mejoras
  operativas, antes del merge.
- **Novedad:** nuevo, y corrige tres docs que hay que actualizar con el arreglo: `plan_mejoras_operativas.md`
  dice que el buscador "ya scopea por barbero con rol barbero" (§3, línea 80) y define para el barbero
  "clientes propios (los de sus turnos)" (F1, líneas 191 y 197); y `estado_actual.md` → Deudas da por resuelta
  la escalada barbero↔barbero en `/api/admin/clientes` con el commit `ca2fc96`, que solo cambió los roles de
  `index.js`. Ahí corresponde anotar que el buscador abierto es una decisión, no una deuda.

#### Z2-02 — El caché de tenants deja pasar subdominios como `constructor` con `tenant_id` indefinido (bajo)

- **Dónde:** `backend/src/middlewares/tenantMiddleware.js:23` y `:37-38` (`tenantCache = {}`), todas las rutas
  que pasan por `tenantMiddleware`.
- **Alcance:** en producción (mismas líneas en `main`).
- **Qué pasa:** el caché es un objeto común. Un anónimo que manda `X-Tenant-Subdomain: constructor` (o
  `__proto__`, `toString`) hace que `tenantCache[subdominio]` devuelva una propiedad heredada, que es "truthy":
  el middleware no consulta la DB, no responde 404 y sigue con `req.tenant_id = undefined`. Hoy no se llega a
  datos de nadie: todas las queries leídas comparan `tenant_id = $1` (con `NULL` no devuelven filas) y
  `verificarToken` responde 403 porque el token trae otro tenant. El riesgo es que se rompe la garantía "después
  del middleware hay un tenant válido": una query futura con filtro opcional de tenant quedaría abierta.
- **Evidencia:** leído; no reproducido (no hizo falta levantar nada).
- **Arreglo propuesto (chico):** `const tenantCache = new Map()` (o `Object.create(null)`), y validar el formato
  del header con `motivoFormatoSubdominio` antes de buscar.
- **Novedad:** nuevo.

#### Z2-03 — `anon` y `authenticated` tienen todos los permisos sobre las 20 tablas: lo único que las cierra es acordarse del RLS (bajo)

- **Dónde:** la base (`pg_class.relacl` y `pg_default_acl` del schema `public`). No hay código del repo.
- **Alcance:** en producción.
- **Qué pasa:** las 20 tablas tienen RLS activado y sin policies, así que hoy por la Data API no se lee ni se
  escribe nada. Pero `anon` y `authenticated` conservan `SELECT, INSERT, UPDATE, DELETE, TRUNCATE` sobre todas,
  y los permisos por defecto de `postgres` y `supabase_admin` se los dan a cada tabla nueva. Una tabla creada
  desde el SQL editor sin el `ENABLE ROW LEVEL SECURITY` (ya pasó: 13 tablas estuvieron así hasta el
  2026-09-30) queda abierta para quien tenga la anon key. Y la Data API **se usa**: la web de Kingsai lee las
  vistas `web_*` con el rol `anon` (`SQL_Schema.md`), así que no se puede apagar, como propone `estado_actual.md`.
- **Sin confirmar:** si la anon key llega al navegador de la web de Kingsai o se usa solo al construir el sitio
  (ese sitio no está en este repo). `estado_actual.md` → RLS dice que "no está publicada en ningún front":
  conviene revisarlo ahí. Tampoco se puede ver desde la base qué schemas expone la Data API (está en el
  dashboard de Supabase).
- **Evidencia:** consultado en la DB (`aclexplode(relacl)`, `pg_default_acl`, `relrowsecurity`, `pg_policy`).
- **Arreglo propuesto (chico, un SQL que corre el usuario):** `REVOKE ALL` sobre las 20 tablas a `anon` y
  `authenticated` (dejando el `SELECT` de `anon` en las 3 vistas, que es lo único que necesitan), y
  `ALTER DEFAULT PRIVILEGES` para que las tablas nuevas nazcan sin esos permisos. El backend no se ve afectado:
  entra como `postgres`. Así una tabla sin RLS deja de ser un agujero, y `TRUNCATE` deja de depender de que la
  API no lo exponga.
- **Novedad:** corrige y completa "RLS activado en todas las tablas" de `estado_actual.md` (la mejora opcional
  de apagar la Data API no es posible mientras la web de Kingsai la use).

#### Z2-04 — `turno.cliente_id` ahora llega del cliente y su FK no es compuesto (bajo)

- **Dónde:** FK `turno_cliente_id_fkey` (`FOREIGN KEY (cliente_id) REFERENCES cliente(id)`); `POST
  /api/admin/turnos` con `cliente_id` y `PATCH /api/admin/turnos/:id/cliente` (`controllers/turnos.js:191` y
  `:368`).
- **Alcance:** solo en el branch (el `cliente_id` en el body es de F1).
- **Qué pasa:** hoy nada: `clienteUsable` y el `UPDATE ... FROM cliente` de `asignarClienteATurno` validan el
  tenant. Pero la deuda diferida 3 de julio dejó este FK simple porque "`cliente_id` nunca es
  client-controlled", y eso dejó de ser cierto. Si un camino futuro se olvida la validación, la base acepta un
  turno con un cliente de otro local y el `LEFT JOIN cliente` mostraría su nombre, mail y teléfono.
- **Evidencia:** consultado en la DB (`pg_constraint`) y leído. Conteo actual de turnos con cliente de otro
  tenant: 0.
- **Arreglo propuesto (chico, schema):** `UNIQUE (tenant_id, id)` en `cliente` y FK compuesto
  `(tenant_id, cliente_id)` en `turno` (MATCH SIMPLE, así los turnos "Sin datos" no se rompen). Los otros FK
  simples con id del cliente (`barbero_horario.barbero_id`, `barbero_suspension.barbero_id`,
  `venta.producto_id`) están en la misma situación desde antes, validados por la app; si se toca el schema,
  conviene hacerlos todos juntos.
- **Novedad:** agrava la deuda diferida 3 de `auditoria_2026-07.md` (cambió su rationale).

### Verificado correcto

- **En la base (consultado el 2026-11-16):** las 20 tablas de `public` tienen RLS activado, sin policies y sin
  forzar, todas de `postgres`. Las 3 vistas `web_*` filtran al tenant de Kingsai y exponen solo nombre, precio
  y horarios. `web_deploy_kingsai()` no la puede ejecutar `anon`. `resguardo_lectura` tiene solo `SELECT` en
  `public` (con `BYPASSRLS`, que necesita para leer) y no entra a `vault`, `auth` ni `storage`.
- **FKs compuestos `(tenant_id, X)` que existen:** `turno` → barbero y servicio; `corte` → barbero, servicio y
  turno; `gasto` → categoría; `socio` → barbero; `movimiento_extra` → socio. Las tablas nuevas (`socio`,
  `movimiento_extra`) los tienen; `token_recuperacion` solo referencia al tenant.
- **Filas cruzadas entre tenants:** 0 en `barbero_horario`, `barbero_suspension`, `venta`, `turno`→`cliente` y
  `socio`. `cierre_caja` está vacía. Hay 3 cortes cuyo turno es de otro barbero del mismo local: son de demo,
  de junio, anteriores al cobro en una sola sentencia; hoy `registrarCorte` no lo permite.
- **Leídos completos en la segunda tanda:** `controllers/turnero.js` (lo público devuelve del tenant solo
  nombre, teléfono del local, WhatsApp, reseñas, dirección, horario y feriados; la gestión por token filtra
  además por tenant), `caja.eliminarMovimiento`, `recordatoriosService` y el job.

- **Montaje de rutas (`index.js`) contra la tabla de roles de `estado_actual.md`:** coinciden, incluidas las
  rutas nuevas (`descansos`, `agenda`, `socios`, `auth/recuperar`) y los roles por método de `ventas`, `gastos`
  y `horario-atencion`. No hay ruta de datos sin `verificarToken` salvo las públicas documentadas.
- **Rol operativo:** no entra a ningún `/api/admin/*`, ni a caja, inicio ni balances (`requiereRol`).
- **`verificarToken`:** cruza el tenant del token contra el del subdominio y revoca por `tv` en los tres roles.
- **Scoping del barbero** (`utils/scopingRol.js`): fuerza el `barbero_id` del token en `turnos.js` (listar,
  crear, no asistió, completar, asignar cliente, cancelar), `agenda.js`, `descansos.js`, `suspensiones.js`
  (liberar: solo propias y no las del admin), `planilla.js` (los tres endpoints; los totales son solo los
  suyos) y `clientes.getMisClientes`. `horarios.js` responde 403 ante el horario de otro.
- **F1:** `clienteUsable`, `asignarClienteATurno` (una sola sentencia con tenant y barbero en el `WHERE`) y
  `borrarClienteSinTurnos` filtran por tenant; un cliente de otro local o un turno ajeno responde 404. El
  filtro de "cliente suyo" es el bug de Z2-01.
- **Filtro por `tenant_id`, query por query, en:** `turnosService`, `cortesService`, `suspensionesService`,
  `descansosService`, `planillaService`, `horariosService`, `barberosService`, `sociosService`,
  `categoriasService`, `movimientosService`, `sqlTurnoEnriquecido` (todos sus usos pasan tenant o un id propio).
- **Filtro por `tenant_id`, por esqueleto de las queries** (sin leer la lógica completa): `caja`, `gastos`,
  `ventas`, `balances`, `inicio`, `feriados` + `feriadosService`, `imagenes`, `gestion`, `turnero`,
  `turneroConfig`, `adminOperativo`, los cuatro `auth*`, `recuperacionService`, `horarioAtencionService`,
  `disponibilidadService`, `utils/stock.js`, `utils/pin.js`.
- **Ids del cliente validados contra el tenant por la app:** `barbero_id` (`barberoActivoEnTenant` /
  `barberoEnTenant`), `servicio_id` (`calcularDuracionServicio`), `socio_id`, `categoria_id`, `producto_id`
  (ventas), `turno_id` (en la misma sentencia de `registrarCorte`, con tenant y barbero), `cliente_id`.
- **`/api/alta`:** solo toca `solicitud_alta`; lo único de tenants es si un subdominio existe, y exige un link
  vigente. **`/api/plataforma`:** solo invalida el caché, con clave; sin la variable responde 503.
- **Residuales de defensa en profundidad (ya aceptados en julio, 2.2):** `enriquecerTurno` y el `UPDATE` de
  `google_event_id` por id sin tenant; se suman, del mismo tipo, `ventas.js:77` (cleanup por id) y
  `recordatoriosService.reclamarTurno`. Los ids salen siempre de una query propia.

### Sin revisar

- La lógica completa de `gestion.js`, `balances.js`, `inicio.js` y `disponibilidadService.js`: se revisó que
  cada query filtre por tenant, no el resto (son solo admin, o le tocan a las zonas 4 y 5).
- Si el panel en modo barbero pide o dibuja datos de admin (zona 6): el backend los niega con 403.
- La configuración de la Data API en el dashboard de Supabase (no se ve desde la base).

### Para otra zona

- **Zona 1:** `POST /api/auth/recuperar/solicitar` es público y devuelve `email` del dueño (ver si el
  enmascarado alcanza).
- **Zona 3:** el `motivo` de una suspensión no tiene tope de largo y viaja al mail de cancelación
  (`suspensiones.js:61`).
- **Zona 7:** sin `PLATFORM_ADMIN_KEY`, cada pedido anónimo a `/api/plataforma/cache/invalidate` hace un
  `console.error` (`plataformaAuthMiddleware.js:43`), que llega a Sentry y a Discord. CORS acepta
  `http://localhost:5173` también en producción (`index.js:87`).
- **Zona 7:** `resguardo_lectura` puede ejecutar `net.http_get` y `net.http_post` (pg_net), y su solo lectura
  por defecto (`default_transaction_read_only`) la puede cambiar la propia sesión: quien tenga esa credencial
  puede hacer pedidos HTTP salientes desde la base. Además lee `tenant` (hashes de PIN y de la contraseña del
  iPad) y `token_recuperacion`, que terminan en el backup.
- **Zona 5:** borrar un corte desde Caja devuelve su turno a 'reservado' aunque ya haya pasado
  (`caja.js:312`).

---

## Zona 3. Superficie pública: turnero, alta y mails

**Commit auditado:** `cb87b60` (`feature/mejoras-operativas`), 2026-11-16. Solo lectura: código, docs y la DB
con el rol `resguardo_lectura`. No se reprodujo nada contra demo ni contra producción.

**Resumen:** 6 hallazgos (0 críticos, 1 alto, 1 medio, 4 bajos). Los seis están en producción. La pregunta
central de la zona, si un texto del formulario de alta puede romper o inyectar la query de la skill, tiene
respuesta: **no** (ver "Verificado correcto").

**Revisión del orquestador (2026-11-16):** Z3-01 se confirmó leyendo el camino completo (`routes/turnero.js`,
`reprogramarTurno`, `enviarReprogramacion`, los limiters y lo mismo en `main`). De los demás se revisaron
contra el código Z3-02, Z3-05 y Z3-06. No se sacó ninguno ni cambió ninguna severidad. La nota de la zona 2
sobre el `motivo` de una suspensión no pasa a hallazgo: lo escribe el propio local (admin o barbero), va
escapado al mail de sus clientes y solo le falta un tope de largo.

### Hallazgos

#### Z3-01 [ALTO] Reprogramar no tiene límite propio: con un solo turno se mandan mails sin tope a cualquier dirección

- **Dónde:** `backend/src/routes/turnero.js:36` (`POST /api/turnero/turnos/:token/reprogramar`, sin limiter) y
  `backend/src/controllers/turnero.js:559-681` (`reprogramarTurno`; el mail sale en la línea 673 y Calendar en
  la 670). Pantalla: gestión del turno (`/turnos/gestionar/<token>`).
- **Alcance:** en producción (`git show main:backend/src/routes/turnero.js` tiene la misma ruta sin limiter y
  `main` ya manda `enviarReprogramacion`).
- **Qué pasa:** un anónimo reserva un turno con el mail de otra persona (el mail no se verifica) y recibe el
  `token_gestion` en la respuesta del `POST /turnos` (`turnero.js:397`): no necesita leer el mail. Con ese token
  llama a `/reprogramar` en bucle. Cada llamada que pasa manda un mail "Turno reprogramado" a esa dirección,
  desde el dominio autenticado y con el nombre del local como remitente, y actualiza el evento de Google
  Calendar del barbero. Nada lo frena salvo el backstop global (300 pedidos por minuto por IP):
  - El horario nuevo puede ser **el mismo que ya tiene**: el `UPDATE` (línea 627) no compara, el `EXCLUDE` no
    choca con la propia fila y el mail sale igual. Tampoco hay tope de reprogramaciones por turno.
  - La reserva sí está limitada (3 por minuto, 10 por hora), pero alcanza con una sola.

  Resultado: es el email bombing que la auditoría de julio cerró en la reserva (3.1), abierto por el costado.
  Daña la reputación del dominio de envío, consume la cuota de Resend (si se agota, dejan de salir las
  confirmaciones y recordatorios de **todos** los locales, y cada mail fallido es un `console.error` que va a
  Sentry) y le llena el calendario de avisos al barbero.
- **Evidencia:** leído. Camino: `index.js:106` (`limiterGlobal`) → `index.js:238` → `routes/turnero.js:36` →
  `reprogramarTurno` (valida que el horario nuevo sea futuro, dentro de 15 días, en horario de atención y sin
  feriado; después `UPDATE`, Calendar y mail) → `mailer.js:393` (`enviarReprogramacion`). Sin confirmar: el plan
  y la cuota de Resend de la cuenta.
- **Arreglo propuesto** (chico; medio si se suma el contador):
  1. No hacer nada si el horario no cambió: responder 200 sin `UPDATE`, sin Calendar y sin mail.
  2. Limiter por IP en `/cancelar` y `/reprogramar`, como el de la reserva.
  3. Tope por turno (por ejemplo, 5 reprogramaciones): una columna contador en `turno`, sumada en el mismo
     `UPDATE` y con el tope en su `WHERE`.

  Recomendado: 1 y 2 ya, en un `fix/` desde `main`; 3 después. El limiter por IP solo no alcanza mientras siga
  abierta la deuda de `trust proxy` (el cupo se comparte y un atacante lo reparte entre nodos): el tope por
  turno es el que no depende de la IP.
- **Cuota de Resend (confirmado por el usuario, 2026-11-16):** la cuenta está en el plan gratuito, con un tope
  diario de envíos compartido por todos los locales. Por este camino el tope se agota en menos de un minuto.
  Ojo al medir el arreglo: el límite de la reserva (10 por hora por IP) también deja pasar más mails por día
  que ese tope, así que los puntos 1 y 2 llevan reprogramar al mismo nivel que la reserva, no más abajo. Eso
  es la deuda diferida 4 de julio (anti-abuso del turnero), que con el plan gratuito pesa más de lo que se
  anotó.
- **Novedad:** nuevo. Corrige el "Verificado correcto" de la fase 3 de julio ("reprogramar y cancelar exigen
  el token, así que no son abusables masivamente"): el token se le entrega a quien reserva.

#### Z3-02 [MEDIO] Un byte nulo en cualquier texto público da 500, y cada 500 es un aviso de Sentry al celular

- **Dónde:** ningún validador rechaza el carácter `\u0000`. Llega a Postgres desde:
  - `GET /api/turnero/turnos/:token` y sus `/cancelar` y `/reprogramar` (`controllers/turnero.js:432`, `481`,
    `586`): el token de la ruta va directo al `WHERE token_gestion = $1`.
  - `POST /api/turnero/turnos`: `nombre`, `telefono` y `email` (`utils/validarTexto.js:101-137` solo mira tipo,
    largo y la regex del mail, que acepta `\u0000`) → `upsertCliente` (`services/turnosService.js:52`).
  - `PUT /api/alta/:token` y `POST /api/alta/:token/enviar` (`controllers/alta.js:121` y `196`): `datos` se
    guarda como `jsonb`.
- **Alcance:** en producción (turnero y alta están en `main`).
- **Qué pasa:** Postgres no admite ese carácter en un `text` ni en un `jsonb`. La query falla, el `catch` del
  controller hace `console.error` y responde 500, y `captureConsoleIntegration` lo manda a Sentry, que avisa
  por Discord. Un anónimo puede disparar alertas falsas al celular cuando quiera. La ruta por token solo tiene
  el backstop global (300 por minuto); el alta, 120 por minuto con un link válido. Si el volumen pasa, también
  salta la regla "Pico de errores" y se gasta la cuota mensual de Sentry (5.000 eventos), que deja al
  monitoreo ciego hasta el mes siguiente. El mismo patrón vale para cualquier otro endpoint público que pase
  un texto a la DB (los logins son de la zona 1).
- **Evidencia:** leído y consultado en la DB. Con el rol de solo lectura, un parámetro `text` con `\u0000` da
  `22021 invalid byte sequence for encoding "UTF8": 0x00`, y un `jsonb` con `\u0000` da `22P05 unsupported
  Unicode escape sequence`. `query()` solo reintenta errores de conexión. **Sin confirmar:** que el proxy de
  Railway deje pasar `%00` en la ruta (el caso del body en JSON no depende de eso), y cuánto frenan una
  ráfaga el filtro de eventos repetidos del SDK de Sentry y su protección de picos.
- **Arreglo propuesto** (chico): un middleware global, después de `express.json`, que responda 400 si la ruta,
  el query o el body traen `\u0000` (recorriendo el body una vez). Alternativa: tratar `22021` y `22P05` como
  400 con `console.warn` en un helper de errores; es menos prolijo porque hay que acordarse en cada `catch`.
  Recomendado: el middleware.
- **Novedad:** nuevo. Mismo tipo de problema que el body mal formado que ya se arregló en `index.js:124`
  (un error del cliente que terminaba en Discord).

#### Z3-03 [BAJO] El nombre del cliente viaja al mail sin restricción de contenido

- **Dónde:** `backend/src/utils/validarTexto.js:103-109` (el nombre: solo no vacío y hasta 80 caracteres) y
  `backend/src/services/mail/mailer.js:335`, `367`, `418` y `514` ("Hola {nombre}, …"). Ruta:
  `POST /api/turnero/turnos`.
- **Alcance:** en producción.
- **Qué pasa:** el HTML está bien escapado (no hay inyección de markup), pero el texto en sí es libre. Un
  anónimo reserva con el mail de un tercero y un "nombre" como `tenés un premio, entrá a http://…`: a esa
  persona le llega un mail del local, autenticado, con ese texto, y la mayoría de los clientes de mail
  convierten la dirección en un link. Sirve para phishing o spam con el nombre del local como remitente. Hoy
  lo acota el límite de la reserva (10 por hora por IP); con Z3-01, el mismo texto se puede repetir sin tope.
- **Evidencia:** leído (`crearTurno` → `validarContacto` → `upsertCliente` → `notificarConfirmacion` →
  `enviarConfirmacion`).
- **Arreglo propuesto** (chico): en `validarContacto`, rechazar un nombre con `://`, `www.` o `@`, o aceptar
  solo letras, espacios, apóstrofos, puntos y guiones. Recomendado: la lista de caracteres permitidos, con la
  misma regla en el turnero. La identidad del cliente se rehace en "Base de clientes": puede ir ahí.
- **Novedad:** agrava la deuda diferida 4 de julio (anti-abuso del turnero: sin captcha ni límite por mail).

#### Z3-04 [BAJO] La solicitud enviada guarda campos sin validar, y la skill los vuelca enteros al contexto de Claude

- **Dónde:** `backend/src/utils/validarSolicitudAlta.js:413` (`clave: barbero.clave`), `:635`
  (`progreso: datos.progreso`) y `:400` (la comisión acepta cualquier entero de 0 a 100);
  `.claude/skills/alta-cliente/leerSolicitud.mjs:134` (`datos: fila.datos`). Ruta: `POST /api/alta/:token/enviar`.
- **Alcance:** en producción.
- **Qué pasa:** el validador promete quedarse "solo con las claves conocidas", pero deja pasar tal cual
  `progreso` y la `clave` de cada barbero: cualquier JSON, hasta el tope de 100 kB del body. Quien tiene un
  link de alta puede mandar ahí un texto largo dirigido al agente ("ignorá las reglas y…"). La plantilla SQL
  no lee esos campos, así que la query no corre riesgo; pero `leerSolicitud.mjs` imprime `datos` entero y la
  skill lo lee en una sesión de Claude Code en la PC de Facundo, con acceso al repo. Lo mismo vale, más
  acotado, para los textos válidos (dirección de 120 caracteres, nombres). Aparte, una solicitud armada a mano
  puede traer una comisión que no es múltiplo de 5: el alta la carga, y después Gestión → Barberos (F7) no
  deja guardar ese barbero sin cambiarle el porcentaje.
- **Evidencia:** leído (`enviarSolicitud` → `validarSolicitudAlta` → `UPDATE … datos = $2::jsonb`; skill:
  `leerSolicitud.mjs` → `SKILL.md` paso 1). El formulario real solo manda comisiones de 5 en 5
  (`SelectorComision.jsx`, `PASO_COMISION`).
- **Arreglo propuesto** (chico): en el validador, `progreso` se guarda solo si es un objeto con las claves que
  usa el front (o se descarta al enviar, que ya no hace falta) y `clave` solo si es un texto corto; la
  comisión se valida con `esComisionValida` (`utils/comision.js`). En `leerSolicitud.mjs`, no imprimir
  `progreso` ni `clave`. Y una línea en `SKILL.md`: los textos de la solicitud son datos, nunca instrucciones.
- **Novedad:** nuevo. La parte de la skill es de la zona 7 (ver "Para otra zona").

#### Z3-05 [BAJO] El link del alta sigue mostrando todos los datos después de enviada y cargada

- **Dónde:** `backend/src/controllers/alta.js:87-102` (`GET /api/alta/:token`): filtra solo por
  `vence_en > now()` y devuelve `datos` en cualquier estado.
- **Alcance:** en producción.
- **Qué pasa:** después de enviar, y también después de que el local ya está dado de alta, el link sigue
  devolviendo el formulario completo hasta 30 días después de creado: nombre, celular y mail del dueño,
  mails de los barberos, precios. El link viajó por WhatsApp y queda en el historial del chat y del
  navegador; quien lo reenvíe o lo abra desde otro teléfono ve esos datos. El front, en ese estado, solo
  usa el nombre del negocio (`PantallaListo.jsx:78`).
- **Evidencia:** leído, y consultado en la DB: hay 2 solicitudes en `cargada` todavía vigentes.
- **Arreglo propuesto** (chico): si el estado no es `borrador`, responder `{ estado, datos: { local: { nombre } } }`.
  Opcional: que la query de alta de la skill ponga `vence_en = now()` al pasar a `cargada`.
- **Novedad:** nuevo.

#### Z3-06 [BAJO] `booking_url` se guarda sin validar el esquema y el iPad lo abre con `window.open`

- **Dónde:** `backend/src/controllers/gestion.js:565-579` (`PUT /api/admin/negocio`: solo recorta) y
  `frontend/src/screens/MainScreen.jsx:455` (`window.open(bookingUrl, "_blank")`, botón "Reservar" del modo
  operativo). El valor sale por `GET /api/negocio`, que es público.
- **Alcance:** en producción.
- **Qué pasa:** el campo acepta `javascript:…`. Lo puede escribir solo un admin (hoy por API: el formulario
  se sacó del panel, deuda #43), así que no hay escalada directa. El riesgo es de persistencia: alguien que
  supo el PIN de admin deja ahí un script, y aunque después le cambien el PIN, se ejecuta en el origen del
  panel cada vez que alguien toca "Reservar" en el iPad, donde vive el token operativo en `localStorage`. Es
  justo el caso que la decisión de julio (7.3) dejó como condición: "aceptable mientras no haya sinks de XSS".
- **Evidencia:** leído, y consultado en la DB: 0 tenants con un `booking_url` que no empiece con `https://`.
- **Arreglo propuesto** (chico): validar con `esUrlHttps` en `editarNegocio` (400 si no pasa) y, en el
  panel, no abrir nada que no empiece con `https://`. El alta ya lo arma bien (`plantilla_alta.sql:66`).
- **Novedad:** nuevo. El sink está en el panel: lo cruzo con la zona 6.

### Verificado correcto

**Formulario de alta y skill**

- **La query de alta no se puede inyectar ni romper desde el formulario.** `plantilla_alta.sql` no interpola
  ningún dato del cliente: los lee de `solicitud_alta.datos` con operadores `jsonb` (`->>`,
  `jsonb_array_elements`). A mano van solo el id (validado con `esUUID`), los PINs (`^\d{4}$`), el usuario, la
  contraseña y la fecha, que `armarQuery.mjs` escapa duplicando comillas; la DB tiene
  `standard_conforming_strings = on` (consultado), así que la barra invertida no escapa nada. Un `O'Brien` o un
  `'); DROP …` en un nombre queda como texto.
- Los casts de la plantilla (`::smallint`, `::time`, `::int`, `::numeric`) reciben solo valores que el envío ya
  normalizó, y una solicitud `enviada` no se puede volver a escribir por la API (`WHERE estado = 'borrador'` en
  los dos `UPDATE`). El único camino para cambiarla es SQL a mano, y la skill vuelve a validar antes
  (`leerSolicitud.mjs`).
- El `JOIN` por nombre de barbero de la plantilla es seguro: el envío rechaza nombres repetidos sin distinguir
  mayúsculas. Los CHECK de `tenant.email_duenio` y `telefono_duenio` aceptan lo que acepta el validador.
- Token del link: `uuid_generate_v4()` (122 bits al azar; consultado el default de la columna), vence a los
  30 días (`vence_en`), y un token mal formado, inexistente o vencido da el mismo 404 en los cuatro endpoints.
- Quien tiene el link puede leer, autoguardar y enviar **su** solicitud, y nada más: no hay ningún camino de
  `/api/alta` a datos de un tenant. La consulta de subdominio exige un token vigente (se chequea antes de
  responder) y solo dice libre u ocupado, que es información pública.
- Autoguardado: exige un objeto, reemplaza en vez de acumular, y el tamaño lo corta `express.json` (100 kB; el
  413 sale en JSON y con `console.warn`). La fila más grande hoy pesa 1,4 kB.
- Reenvío: el segundo envío da 409 y no manda mail; el estado va en el `WHERE` del `UPDATE`, así que dos
  envíos a la vez no pasan los dos. Rate limit: 120 por minuto para leer y guardar, 5 por hora para enviar.
- Mail de aviso: el nombre del negocio y la referencia pasan por `escaparHtml`; el asunto lleva solo la
  referencia, que escribe Facundo; el destino sale de una variable de entorno. Sin inyección de cabeceras: el
  envío es un JSON a la API de Resend, no SMTP.
- `/api/alta` queda fuera del log global (que escribe el body), tiene su log sin body y con el token
  enmascarado, y cierra con su propio 404.
- `frontend-alta`: sin `dangerouslySetInnerHTML` ni `innerHTML`; los únicos `href` con datos son el mapa
  (`encodeURIComponent`) y el WhatsApp de contacto, que es una constante. El token se manda con
  `encodeURIComponent`. `noindex` en el HTML y en `vercel.json`. RLS activado en `solicitud_alta` (consultado).

**Turnero**

- F9: cancelar y reprogramar exigen `estado = 'reservado' AND inicio > now()` en el `WHERE` del `UPDATE`, con
  el reloj de la base, y el 409 distingue "ya empezó" de "cambió de estado". El front deja de ofrecer las
  acciones y muestra el contacto del local.
- La gestión por token devuelve del cliente solo el nombre; ni mail ni teléfono. Todas las búsquedas filtran
  por `token_gestion AND tenant_id`. El token es `crypto.randomUUID()`.
- Reprogramación: el horario nuevo tiene que ser futuro, dentro de los 15 días, en horario de atención, sin
  feriado, sin pisar otro turno (`EXCLUDE`) ni una suspensión (`NOT EXISTS` en la misma sentencia). Lo que
  falta es la cantidad (Z3-01).
- "Cualquier barbero": el backend valida que el `barbero_id` sea del tenant y esté activo. Que el cliente
  mande otro barbero que el asignado no es un problema: elegir barbero es una función del turnero. El
  reintento del 409 es uno solo y pide de nuevo la disponibilidad.
- `origen`: `normalizarOrigen` (minúsculas, `^[a-z0-9_-]{1,30}$`), la misma regla en el front y un CHECK en la
  columna. Si no cumple, se guarda `null`.
- `/turnos/resena` no es un redirect abierto: el destino no sale de la URL sino de `tenant.resena_url`, que
  el backend entrega solo si es `https:` y el front vuelve a chequear antes del `location.replace`. El
  `?origen=` no participa del destino.
- Links con datos del dueño: mapa con `encodeURIComponent`; `tel:` solo con dígitos y `+`; `wa.me` solo con
  dígitos, y el backend entrega el WhatsApp solo si es E.164. Los links externos llevan
  `rel="noopener noreferrer"`. Ninguno puede terminar en `javascript:`. En la DB, el único tenant con WhatsApp
  cargado tiene un E.164 válido.
- Sinks de XSS: ninguno en `frontend-turnero` (sin `dangerouslySetInnerHTML`, `innerHTML` ni `eval`). El
  `link.href` del favicon y los `src` de imágenes usan la URL que arma el backend sobre Supabase Storage.
- `.ics`: `escaparTexto` cubre `\`, `;`, `,` y los tres saltos de línea, así que el nombre del servicio, del
  local o la dirección no pueden agregar líneas ni propiedades. Líneas plegadas a 75 octetos, CRLF. El link de
  Google Calendar se arma con `URLSearchParams`.
- El token de la ruta de gestión se pasa a la API sin decodificar: un `%2F..` no cambia de endpoint.
- Endpoints públicos: `GET /api/turnero/tenant` devuelve id, nombre, teléfono del local, WhatsApp, link de
  reseñas, dirección, horario y feriados; `GET /api/negocio`, nombre y `booking_url`. Ninguno trae PIN, hashes,
  versiones de token, suscripción, ni el mail o el celular del dueño (el handler de admin es otro,
  `getNegocioAdmin`). `/barberos` devuelve id y nombre; `/servicios`, id, nombre, precio y duración.
- Ids y fechas del query y del body se validan con `esUUID`, `esFechaISO` y `parsearInstante` (los tres exigen
  `string`, así que un parámetro repetido o un objeto dan 400 y no 500). `/dias-disponibles` tiene tope de 62
  días.
- El link de gestión de los mails se arma con el subdominio del header, pero ese header ya tuvo que coincidir
  exacto con un tenant activo: no se puede apuntar el link a otro dominio.

**Mails**

- Los seis mails (confirmación, cancelación, reprogramación, cancelación automática, recordatorio, aviso de
  alta) y el de recuperación pasan todos los valores dinámicos por `escaparHtml`, incluidos el título, la
  introducción con el nombre del cliente, cada fila y los `href` (entre comillas dobles, que el escape cubre).
- Asuntos: llevan solo fechas formateadas por el servidor, o textos fijos (recuperación). El único con un dato
  externo es el del aviso de alta, con la referencia que escribe Facundo.
- Remitente: el nombre del local va entre comillas con `"` y `\` escapados. Destinatario: el mail del cliente
  ya normalizado y validado con una regex que no admite espacios ni un segundo `@`.
- El link de recuperación viaja en el HTML escapado y el mail del dueño se loguea enmascarado.

**Imágenes**

- Subir y borrar son solo de admin (`requiereRol('admin')`). El body tiene que declararse `image/webp` y pesar
  hasta 1 MB; el nombre del archivo lo arma el servidor (`<tenant>/<tipo>/<uuid>.webp`), sin nada del cliente.
- No se verifica que los bytes sean un WebP real, pero no hay riesgo: se sirve desde el dominio de Supabase
  Storage, siempre con `Content-Type: image/webp`.
- El borrado filtra por `tenant_id` y valida el id. El cupo por tipo lo respalda `UNIQUE (tenant_id, tipo,
  orden)` (consultado en la DB).

### Para otra zona

- **Zona 2 (y 7):** el caché de `tenantMiddleware` es un objeto plano (`backend/src/middlewares/tenantMiddleware.js:23`
  y `:37`). Con el header `X-Tenant-Subdomain: constructor` (o `toString`, `__proto__`), `tenantCache[subdominio]`
  devuelve una propiedad heredada, el middleware lo da por resuelto y sigue con `req.tenant_id = undefined`.
  No encontré una lectura que devuelva datos así (las queries filtran por `tenant_id = NULL` y no traen nada),
  pero conviene un `Map` o `Object.create(null)`, y revisar los caminos de escritura. En producción.
- **Zona 7:** la skill `alta-cliente` lee en el contexto de Claude textos que escribe un tercero (Z3-04).
- **Zona 7:** el log de acceso global (`index.js:201-209`) escribe el body de `POST /api/turnero/turnos` con
  el nombre, el teléfono y el mail del cliente (`sanitizarObjeto` tapa solo credenciales), y
  `mailer.js:248` escribe el mail del cliente en cada envío. Esos logs los lee la sesión de diagnóstico.
- **Zona 7:** `/turnos/gestionar/<token>` no lleva `X-Robots-Tag: noindex` (`frontend/vercel.json` excluye
  todo `/turnos` para que la landing del turnero se indexe).
- **Zona 6:** el sink de Z3-06 está en el panel (`MainScreen.jsx:455`).
- **Zona 5:** el `UPDATE` de la reprogramación por link (`turnero.js:627`) cambia solo `inicio` y `fin`; no
  toca `recordatorio_enviado_en`. No miré qué hace el job con un turno reprogramado después del recordatorio.
- **Zona 8:** los `GET` de disponibilidad del turnero no tienen límite propio (solo los 300 por minuto
  globales) y cada uno son varias queries contra un pool de 3.
- **Docs:** `SQL_Schema.md` no menciona `tenant_imagen_unico UNIQUE (tenant_id, tipo, orden)`, que existe en
  la DB. Y la nota de julio en 3.3 atribuye a `helmet` que el token no salga en el `Referer`: `helmet` cubre
  las respuestas de la API, no la página (que sirve Vercel). Lo que hoy lo evita es la política por defecto
  del navegador y el `rel="noreferrer"` de los links externos.

---

## Zona 4. Plata: caja, planillas, balances y stock

Commit auditado: `1e148fb`. Todo lo que registra o calcula plata es igual en `main` y en el branch
(`git diff main...HEAD` sobre los controllers, services y utils de la zona solo muestra F7 en `gestion.js` y
`comision.js`, y cambios de texto en `FlujoCorte`, `SeccionPlanillas` y `MiPlanilla`): los diez hallazgos están
**en producción**. No se reprodujo nada en demo ni se escribió en la base; los datos salen de `consultar.js`
(2026-11-16).

**Resumen:** 0 críticos, 0 altos, 4 medios, 6 bajos. Lo central de la zona está bien: la comisión, las propinas,
los gastos y la ganancia salen de una sola fórmula en el backend y dan lo mismo en Planillas, MiPlanilla,
Balances (mensual e histórico) y los Excel. Lo que no coincide es el "facturado" del Inicio contra Balances
(Z4-03). En la base de un local real hay dos grupos de cortes viejos mal guardados (Z4-01 y Z4-02); ninguno se
puede generar hoy.

**Revisión del orquestador (2026-11-16):** sin críticos ni altos, se revisó una muestra. Contra la base: los 12
pares duplicados (Z4-01) y los 12 totales sin propina (Z4-02) de kingsaistudio. Contra el código: Z4-03
(`inicio.js` contra `balances.js`), Z4-04 (`createCorte` no compara el precio con el catálogo), Z4-06 y Z4-10.
No se sacó ninguno ni cambió ninguna severidad. Un dato que la sección no trae: la misma consulta de Z4-01
devuelve además 4 pares en demo, del 29 y 30 de octubre; son de pruebas y no cambian la conclusión.

### Hallazgos

#### Z4-01 [MEDIO] En kingsaistudio quedaron 12 cortes duplicados por doble toque, y siguen contando

- **Dónde:** tabla `corte` (datos). El camino que los generó ya no existe: `frontend/src/screens/flows/FlujoCorte.jsx`
  antes del rediseño del 2026-05-29 (`6d89c04`).
- **Alcance:** en producción (datos de kingsaistudio).
- **Qué pasa:** hay 12 pares de cortes iguales (mismo barbero, servicio, monto y forma de pago, los dos sin turno)
  cargados con entre 0 y 0,65 segundos de diferencia: 2 en abril, 9 en mayo y 1 en junio (el último, el 05/06).
  Nadie carga dos cortes en medio segundo: son dobles toques en "Confirmar". El segundo corte de cada par sigue
  en la base, así que esos 12 cobros están contados dos veces en Caja, Planillas y Balances de esos meses. En 6
  de los 12 el barbero tenía 100 % (no cambia la ganancia del local, sí los ingresos brutos); en los otros 6, la
  planilla de esa semana le sumó al barbero una comisión de más. Son 2 barberos.
- **Por qué no es alto:** la causa está cerrada. Desde el 05/06 no hay ningún par a menos de 6 segundos en los
  2.154 cortes posteriores (los pares de 6 a 60 segundos que sí hay, 228, son el ritmo normal de cargar varios
  cortes seguidos: cada uno pasa por los 6 pasos y los 2,5 s de la pantalla de éxito). En ventas y gastos no hay
  ningún par a menos de 10 segundos, en ningún tenant.
- **Evidencia:** consultado en la DB (self-join de `corte` por tenant, barbero, servicio, `monto_total` y
  `forma_pago`, con la diferencia de `timestamp`). El front de hoy: `disabled={enviando}` en los tres flujos
  (`FlujoCorte.jsx:385`, `FlujoVenta.jsx:253`, `FlujoGasto.jsx:235`) y la pantalla de éxito reemplaza al botón.
- **Arreglo propuesto** (chico, de datos, lo decide el dueño): listarle los 12 pares con día, hora, barbero y
  monto, y que confirme cuáles borrar desde Caja (o por SQL, uno de cada par). La consulta que los encuentra:
  cortes del mismo tenant, barbero, servicio, `monto_total` y `forma_pago` con menos de 3 segundos entre sí. De
  fondo, la deuda de la idempotency key sigue igual (ver Novedad).
- **Novedad:** nuevo como dato. Corrige el alcance de la deuda diferida 2 de julio ("idempotency keys para
  `turno`, `venta` y `gasto`"): el corte sin turno tampoco tiene clave y no figura en esa lista, y es el único
  de los tres que ya dejó duplicados reales.

#### Z4-02 [BAJO] 12 cortes de kingsaistudio tienen el total guardado sin la propina

- **Dónde:** tabla `corte`, columna `monto_total` (datos). Lo leen `backend/src/controllers/caja.js:53` y
  `backend/src/controllers/inicio.js:20`, `:41`, `:60`, `:103` y `:123`.
- **Alcance:** en producción (datos de kingsaistudio; 4 casos iguales en demo).
- **Qué pasa:** 12 cortes del 25/03 al 04/04 de 2026 (los primeros días de uso) tienen `monto_total = precio`,
  con una propina cargada aparte: la diferencia es, en los 12, exactamente la propina. Desde el 07/04 todos los
  cortes con propina cierran. Caja de esos días muestra esos cortes sin la propina (y el neto por forma de pago
  queda corto por ese monto). Planillas y Balances no se ven afectados: leen `precio` y `propina` por separado.
- **Evidencia:** consultado en la DB (`monto_total <> precio + propina`: 12 en kingsaistudio, 4 en demo, 0 en
  los otros tenants). Hoy `registrarCorte` calcula `monto_total = precio + propina` (`cortesService.js:79`).
- **Arreglo propuesto** (chico, un SQL que corre el usuario):
  `UPDATE corte SET monto_total = precio + COALESCE(propina, 0) WHERE monto_total <> precio + COALESCE(propina, 0);`
  (16 filas). Opcional y más grande: un `CHECK (monto_total = precio + propina)` después del arreglo, o dejar
  de guardar el total y calcularlo.
- **Novedad:** nuevo.

#### Z4-03 [MEDIO] El "facturado" del Inicio no es el "ingreso" de Balances: suma las propinas y no los otros ingresos

- **Dónde:** `backend/src/controllers/inicio.js:20`, `:60` y `:103` (`SUM(monto_total)` de cortes, más ventas)
  contra `backend/src/controllers/balances.js:140` y `:271-273` (`SUM(c.precio)` + productos + otros ingresos).
  Pantallas: Inicio → "facturado hoy" y "facturado este mes" (`SeccionInicio.jsx:192` y `:236`); Balances →
  "Ingresos del negocio" y la fila "Total" de "Ingresos por barbero" (`SeccionBalances.jsx:724` y `:930`).
- **Alcance:** en producción.
- **Qué pasa:** las dos pantallas responden "cuánto entró este mes" con reglas distintas.
  - El Inicio suma `corte.monto_total`, que incluye la **propina**. Balances la deja afuera a propósito ("van al
    barbero, no se incluyen en el balance", `SeccionBalances.jsx:753`).
  - El Inicio **no** suma los "otros ingresos" (`movimiento_extra`); Balances sí.

  Ejemplo con demo: en octubre el Inicio daría $ 104.201 y Balances, en "Sin comisiones", $ 98.201 (la
  diferencia son los $ 6.000 de propinas). En septiembre, $ 34.500 contra $ 488.001: $ 3.000 de propinas de más
  y $ 456.501 de otros ingresos de menos. En kingsaistudio hay 348 cortes con propina: la diferencia aparece
  todos los meses. El comparativo "vs mes anterior" del Inicio arrastra lo mismo.
- **Evidencia:** leído (las dos queries lado a lado) y consultado en la DB (las dos sumas sobre demo, mes por mes).
- **Arreglo propuesto** (chico): que `inicio.js` use la misma regla que Balances: `SUM(precio)` en vez de
  `SUM(monto_total)`, más los movimientos con `afectaResultado` (`utils/movimientos.js`). Alternativa: dejar el
  número y cambiar el rótulo a "cobrado" (lo que pasó por la caja, propinas incluidas), que es lo que hoy mide.
  Recomendada la primera: "facturado" y "ingresos" tienen que ser el mismo número.
- **Novedad:** nuevo.

#### Z4-04 [MEDIO] El iPad cobra con la lista de precios que cargó al abrirse, y el backend guarda el precio que manda el iPad

- **Dónde:** `frontend/src/App.jsx:300-321` y `:405` (`precargarDatos` corre al iniciar sesión en el iPad, al
  cerrar el panel en ese iPad y al volver de una venta; `FlujoCorte` vuelve con `volverAlInicio`, sin recargar);
  `frontend/src/screens/flows/FlujoCorte.jsx:144` (`precio: servicioSeleccionado.precio`) y `FlujoVenta.jsx:106`;
  `backend/src/controllers/cortes.js:45` y `ventas.js:24` (validan el rango, no contra el catálogo).
  Rutas: `POST /api/cortes`, `POST /api/ventas`.
- **Alcance:** en producción.
- **Qué pasa:** el dueño cambia el precio de un servicio desde su celular o su compu (Gestión → Servicios). El
  iPad del local, que queda abierto días enteros con la sesión guardada, sigue mostrando y registrando el precio
  viejo hasta que alguien lo recarga o entra y sale del panel en ese mismo iPad. Cada corte de ese período queda
  con el precio viejo: Caja, la planilla del barbero (su comisión se calcula sobre ese precio) y Balances quedan
  por debajo de lo que se cobró de verdad, sin ningún aviso. El turnero ya le muestra al cliente el precio nuevo.
  Con los productos pasa lo mismo hasta la primera venta (que recarga el catálogo al volver), y un barbero o un
  servicio nuevo no aparece en el iPad hasta recargar.
- **Evidencia:** leído (`App.jsx` → `FlujoCorte` → `registrarCorte` → `createCorte` → `cortesService.registrarCorte`,
  que inserta `$4::numeric` tal como llega). En demo, 9 cortes de los últimos 30 días tienen un precio distinto
  al actual de su servicio (son pruebas; no distingue este caso de un cambio de precio posterior).
- **Arreglo propuesto:**
  1. (chico, recomendado) recargar los catálogos al entrar a cada flujo, o al volver a la pantalla principal y
     cuando la pestaña vuelve al primer plano (`visibilitychange`).
  2. (medio, como red) que `POST /api/cortes` y `POST /api/ventas` con rol operativo comparen el precio recibido
     con el del catálogo y respondan 409 "El precio cambió, actualizá la pantalla" si difieren. El completar del
     panel (`POST /api/admin/turnos/:id/completar`) deja editar el precio a propósito y no cambia.
- **Novedad:** nuevo.

#### Z4-05 [MEDIO] Un corte mal cargado no se puede corregir sin cambiarle la fecha

- **Dónde:** no existe `PUT /api/cortes/:id`; `backend/src/controllers/caja.js:287-340` (borrar) y
  `backend/src/services/cortesService.js:98-103` (el `INSERT` no recibe fecha: `timestamp` es `now()`).
  Pantalla: Caja → Movimientos del día.
- **Alcance:** en producción.
- **Qué pasa:** ventas y gastos se editan; un corte, no. Si el dueño ve el lunes que un corte del sábado quedó
  con la forma de pago, el servicio o la propina mal, lo único que puede hacer es borrarlo en Caja y cargarlo
  de nuevo, y el corte nuevo entra con la fecha y la hora de ese momento. La plata pasa del sábado al lunes: la
  Caja del sábado queda sin ese cobro, y la planilla del barbero lo cuenta en otra semana (y en otro mes si
  cruza el fin de mes). Si el corte venía de un turno, el turno vuelve a "reservado" y completarlo desde el
  Turnero del panel también lo registra con la hora de hoy.
- **Evidencia:** leído (rutas de `cortes.js`, `eliminarMovimiento`, `registrarCorte`, `completarTurnoConCorte`).
- **Arreglo propuesto** (medio): `PUT /api/cortes/:id` solo admin, para forma de pago, propina, precio y
  servicio, sin tocar `timestamp`, `barbero_id`, `turno_id` ni `comision_porcentaje`, y recalculando
  `monto_total`; con su modal en Caja, como el de ventas. Alternativa más chica: que el alta acepte una fecha
  pasada, como `crearMovimientoExtra` (`caja.js:227-230`). Recomendada la edición: no pasa por el borrado ni
  toca el turno.
- **Novedad:** nuevo. La deuda anotada es solo la de movimientos extra ("sin edición", `estado_actual.md`).

#### Z4-06 [BAJO] De 21 a 24 hs, el comparativo del Inicio rotula mal el día y, el último día del mes, el mes anterior

- **Dónde:** `backend/src/controllers/inicio.js:147-159` (`ahora.getDate()`, `ahora.getFullYear()`,
  `ahora.getMonth()`: hora del servidor, no argentina). Pantalla: Inicio → "Estadísticas del mes"
  (`SeccionInicio.jsx:222` y `:257`).
- **Alcance:** en producción.
- **Qué pasa:** las queries usan hora argentina, pero el día y el mes anterior del rótulo salen del reloj del
  servidor (UTC). Desde las 21:00 el dueño ve "Noviembre — del 1 al 17" siendo 16, al lado de la tarjeta del
  día que dice 16. El último día del mes a esa hora es peor: "Noviembre — del 1 al 1" y "vs Noviembre al día
  1", cuando los números son de todo noviembre contra octubre. Los montos están bien; lo que confunde es el
  rótulo, justo a la hora en que se cierra la caja.
- **Evidencia:** leído, y simulado el cálculo de las etiquetas con `TZ=UTC node` (solo JS, sin base): a las
  21:30 del 30/11 da `mes_anterior: noviembre`, `dia_corte: 1`. Supone que el contenedor de Railway corre en
  UTC (no hay `TZ` en el código ni en las variables documentadas): **sin confirmar** en Railway.
- **Arreglo propuesto** (chico): sacar día y meses con luxon en `TZ` (`DateTime.now().setZone(TZ)`), como pide
  `convenciones_tecnicas.md` §4.
- **Novedad:** nuevo.

#### Z4-07 [BAJO] La propina siempre toma la forma de pago del corte

- **Dónde:** `corte.forma_pago` es una sola por corte (`SQL_Schema.md`); `FlujoCorte.jsx` pasos 4 y 5;
  `caja.js:53` (el movimiento de Caja es `monto_total`, con esa forma de pago).
- **Alcance:** en producción.
- **Qué pasa:** no hay pagos mixtos en ningún camino: cada corte, venta, gasto y movimiento extra tiene una
  sola forma de pago, así que no hay partes que sumar ni que puedan descuadrar. El costo es el caso más común
  de propina: el cliente paga el corte por Mercado Pago y deja la propina en efectivo. Se registra todo como
  Mercado Pago, y "Mercado Pago neto" de Caja queda por encima de lo que entró a la cuenta. Tampoco se puede
  registrar un corte pagado mitad y mitad.
- **Evidencia:** leído (schema, `createCorte`, `registrarCorte`, `getMovimientosDia`, `calcularNeto` en
  `SeccionCaja.jsx:540`).
- **Arreglo propuesto** (medio, decisión de producto): una `forma_pago_propina` opcional en `corte` (por
  defecto, la del corte), un paso más en el iPad solo si hay propina, y que Caja parta el movimiento en dos.
  Si no se hace, anotarlo como límite conocido.
- **Novedad:** nuevo.

#### Z4-08 [BAJO] El stock solo se puede sumar: un error de carga no tiene arreglo desde el panel

- **Dónde:** `backend/src/controllers/gestion.js:27-34` y `:410-420` (`agregar_stock` entero >= 0);
  `frontend/src/screens/admin/sections/gestion/TabProductos.jsx` ("Unidades a agregar").
- **Alcance:** en producción.
- **Qué pasa:** si el dueño carga 100 unidades en vez de 10, o se rompe o se regala un producto, no hay forma
  de bajar el stock: Gestión solo suma, y lo único que resta es una venta (que además mete plata que no
  existió en Caja y Balances). El stock queda mal hasta que alguien lo corrija por SQL, y la alerta de stock
  bajo del Inicio deja de servir para ese producto.
- **Evidencia:** leído (`editarProducto`, `errorStockProducto`, `TabProductos`).
- **Arreglo propuesto** (chico): aceptar un ajuste negativo en `agregar_stock` solo al editar, con el tope en
  el `WHERE` (`stock_actual + $5 >= 0`), y en el front un "Corregir stock" separado de "Unidades a agregar".
- **Novedad:** nuevo.

#### Z4-09 [BAJO] Borrar un corte con turno da 500 si el horario de ese turno ya lo tiene otro turno reservado

- **Dónde:** `backend/src/controllers/caja.js:311-315` (`UPDATE turno SET estado = 'reservado'`, sin atrapar
  `23P01`). Ruta: `DELETE /api/caja/movimientos/corte/:id`.
- **Alcance:** en producción.
- **Qué pasa:** el `EXCLUDE` de `turno` solo mira los `reservado`, y la disponibilidad también
  (`disponibilidadService.js:242`): cuando un turno se cobra antes de su hora (el cliente llegó temprano), su
  horario vuelve a ofrecerse. Si otro cliente lo reserva y después el dueño quiere borrar ese corte, devolver
  el turno a "reservado" choca con el `EXCLUDE`, el borrado responde 500 "Error al eliminar corte" (con aviso
  de Sentry) y el corte no se puede borrar mientras el otro turno siga reservado.
- **Evidencia:** leído; **sin reproducir** (habría que escribir en demo y la severidad no lo justifica).
- **Arreglo propuesto** (chico): atrapar `23P01` en ese `UPDATE` y borrar el corte igual, dejando el turno
  como está (completado sin corte) o pasándolo a cancelado; lo decide la zona 5 junto con su nota sobre este
  mismo `UPDATE`.
- **Novedad:** nuevo; complementa la nota de la zona 2 sobre `caja.js:312`.

#### Z4-10 [BAJO] El Excel de Caja ignora el filtro "Solo Barberos"

- **Dónde:** `frontend/src/screens/admin/sections/SeccionCaja.jsx:582` (`movimientos.map`, no
  `movimientosFiltrados`) contra `:535-545` (la tabla y los dos netos sí usan el filtro).
- **Alcance:** en producción.
- **Qué pasa:** con "Solo Barberos" activo, la pantalla saca los cortes de comisión 100 % y recalcula los
  netos; el Excel que se baja en ese momento trae todos los movimientos. Quien suma la columna "Monto" del
  Excel no llega al número que tenía en pantalla.
- **Evidencia:** leído.
- **Arreglo propuesto** (chico): exportar `movimientosFiltrados`, o agregar al nombre del archivo que es la
  vista completa. F4 (socios) va a tocar ese filtro: conviene arreglarlo ahí.
- **Novedad:** nuevo.

### Verificado correcto

**El mismo número en cada pantalla**

| Número | Pantallas comparadas | Dónde se calcula | ¿Coincide? |
|---|---|---|---|
| Comisión de un corte | Planillas (Detalle), MiPlanilla, Excel del Detalle | `comisionCorteSql` (backend); los fronts solo suman `c.comision` | Sí |
| Comisión de la semana y "A pagar" | Planillas (Resumen y modal), MiPlanilla, Excel del Resumen | `resumenSemanal` (`comision_servicios`, `comision`) | Sí |
| Comisiones del mes | Balances mensual, histórico y sus Excel | `comisionCorteSql` en las dos queries | Sí |
| Comisión semanal contra mensual | Planillas contra Balances | Misma expresión, redondeo por corte | Sí (los cortes de una semana partida entre dos meses caen en el mes de su fecha) |
| Monto de servicios | Planillas, MiPlanilla, Balances | `SUM(c.precio)` | Sí |
| Propinas | Planillas, MiPlanilla, nota de Balances | `SUM(c.propina)` | Sí |
| Ingresos del mes | Inicio contra Balances | `SUM(monto_total)` contra `SUM(precio)` + otros ingresos | **No** (Z4-03) |
| Total de cortes del día | Caja contra Inicio ("facturado hoy") | `monto_total` en los dos | Sí (los dos con propina) |
| Ventas | Caja, Inicio, Ventas, Balances | `cantidad * precio_unitario` | Sí |
| Gastos | Caja, Gastos, Balances (egresos) | `gasto.monto` | Sí |
| Ganancia del mes | Balances mensual, histórico, modal del mes y Excel | `balance_neto` del backend; "Sin comisiones" = brutos − egresos en el front y en `balanceSinComisiones` | Sí |
| Queda en el negocio | Balances mensual, modal del mes, Excel | `quedaEnElNegocio` (front, una sola función) | Sí (el Excel va siempre con comisiones; está comentado en el código) |
| Netos de Caja | Pantalla contra Excel de Caja | `calcularNeto` contra filas del Excel | Sí sin filtro; **no** con "Solo Barberos" (Z4-10) |

- **Límites de día, semana y mes:** todas las queries cortan en hora argentina (`DATE(timestamp AT TIME ZONE)`,
  `TO_CHAR(… 'YYYY-MM')`, `DATE_TRUNC` sobre el instante ya convertido). Un corte a las 23:50 o a las 00:10, y
  el último día del mes, caen en el mismo día y mes en Caja, Inicio, Planillas y Balances. La semana empieza el
  lunes en las tres pantallas que la usan (`semanaDesde` con luxon, `DATE_TRUNC('week')` en el Inicio,
  `lunesDeEstaSemana` en MiPlanilla): un corte del domingo es de la semana que termina. Confirmado que la sesión
  de la base está en UTC y que `DATE_TRUNC('week', <date>)` compara bien contra la fecha argentina. Lo único
  fuera de hora argentina son las etiquetas de Z4-06.
- **Redondeo:** la comisión se redondea a centavos por corte y los totales son sumas de esos valores, en todas
  las pantallas; ningún front recalcula un porcentaje. `fmtPesos` muestra pesos enteros: con precios en pesos
  enteros y comisiones de 5 en 5 casi nunca hay centavos (en producción, 0 cortes con comisión con centavos).
- **Comisión guardada contra el % actual:** todas las pantallas usan `corte.comision_porcentaje`
  (`porcentajeComisionSql`). El % actual del barbero (`comision_valor`) solo se usa para el texto de un barbero
  sin cortes en el período. `registrarCorte` copia el % en el mismo `INSERT`.
- **F7:** `esComisionValida` (entero, 0 a 100, múltiplo de 5) está en los dos caminos que escriben el % desde
  la app: `crearBarbero` y `editarBarbero` (`gestion.js:102` y `:156`). El tercer camino es el alta por SQL
  (plantilla de la skill y `crearTenant.js`), que cubre Z3-04. En la base: 0 barberos y 0 cortes con un % que
  no sea múltiplo de 5 o esté fuera de 0 a 100, en todos los tenants.
- **Un % que no es múltiplo de 5 (nota de Z3-04):** Planillas, Balances y Caja lo manejan bien. La fórmula no
  depende del múltiplo, `textoPorcentajeComision` muestra decimales y "Solo Barberos" compara `< 100`. El único
  efecto es el ya anotado: Gestión → Barberos no deja guardar a ese barbero sin cambiarle el %.
- **Montos:** `esMontoValido`, `sumaMontosValida`, `esCantidadValida` y `esFormaPagoValida` están en todas las
  altas y ediciones (corte, completar turno, venta, gasto); el movimiento extra exige monto > 0. Lo cerrado en
  julio (6.1 y 6.3) sigue cerrado. En la base: 0 montos negativos, 0 ventas con cantidad <= 0, 0 gastos sin
  categoría.
- **Editar y eliminar:**
  - Venta: la edición aplica el delta neto de stock y la baja lo devuelve, las dos por `utils/stock.js`, con la
    fila escrita al final y compensación si falla. `deleteVenta` y Caja comparten `eliminarVenta`.
  - Gasto de "Productos para venta": no toca el stock en ningún camino (es solo un recordatorio en el iPad),
    así que editarlo o borrarlo no puede aplicar nada dos veces.
  - Movimiento extra: el borrado filtra por tipo y tenant; no hay edición (deuda anotada).
  - Corte: al borrarlo desaparece de todas las queries (ninguna pantalla guarda totales) y su turno vuelve a
    "reservado". No se puede cobrar dos veces: `corte_turno_unico`, más el 409 de `registrarCorte` ante un
    turno ya completado.
- **Aportes y retiros:** no entran en el Inicio, ni en Planillas, ni en la ganancia de Balances
  (`afectaResultado` en `utils/movimientos.js`, una sola fuente). En Caja suman o restan al neto por forma de
  pago, que es lo correcto (es plata que entró o salió de la caja). Un socio inactivo no se puede elegir en un
  alta (`socioActivoEnTenant`), y sus movimientos siguen saliendo en Caja y en Balances (los `JOIN` no filtran
  por `activo`). Lo mismo con los cortes de un barbero dado de baja.
- **Doble envío:** en los tres flujos del iPad, en el alta de movimientos extra, en editar y eliminar de
  Ventas, Gastos y Caja, y en completar un turno desde el panel, el botón queda deshabilitado mientras
  responde el servidor. Ningún `fetch` del panel reintenta solo (`apiFetch`, `apiFetchOperativo`,
  `fetchConDiagnostico`). El cobro de un turno, además, lo protege el backend. Los datos lo confirman (Z4-01).
- **Stock:** lo mueven solo `utils/stock.js` (ventas) y `crearProducto` / `editarProducto` (sumas, sin
  reintento y con el tope en el `WHERE`). En la base: 0 productos con stock negativo o nulo.
- **Datos en la base (todos los tenants):** 0 cortes con `turno_id` de un turno no completado; 17 turnos
  completados sin corte, todos de demo y el último del 20/10 (anteriores a "un turno se completa solo con su
  corte"); 0 movimientos extra de socios inactivos; los 3 cortes con turno de otro barbero que ya contó la zona
  2 (demo); 1 corte de demo con un servicio distinto al de su turno (anterior a la sincronización).
- **Hoy no se puede generar** un corte con turno de otro barbero ni con el total mal: el `UPDATE` del turno
  filtra por `barbero_id` y el total se calcula en `registrarCorte`.

**Sin revisar:** el render completo de `SeccionGastos`, `SeccionVentas`, `TabProductos` y `MiPlanilla` (se
leyeron las cuentas, los handlers y los Excel, no cada componente); el modal de completar de `SeccionTurnero`
(solo que el botón se deshabilita); `descansosSemanal` (no es plata; zona 5); y la zona horaria real del
contenedor de Railway (Z4-06).

### Para otra zona

- **Zona 5:** borrar el corte de un turno que se había completado desde "no asistió" lo deja en "reservado",
  no en "no asistió" (`caja.js:312`). Y Z4-09: ese mismo `UPDATE` puede chocar con el `EXCLUDE`.
- **Zona 5:** el iPad deja cobrar un turno antes de su hora, y desde ese momento el turnero vuelve a ofrecer
  ese horario (la disponibilidad solo cuenta los `reservado`, `disponibilidadService.js:242`).
- **Zona 6:** inyección de fórmulas en Excel: el de Caja exporta `Detalle` con la descripción de un gasto o
  de un otro ingreso (texto libre, el gasto lo escribe cualquiera en el iPad) y el de Planillas, el nombre del
  cliente del turnero (`SeccionCaja.jsx:586`, `SeccionPlanillas.jsx` → `exportarExcel`).
- **Zona 6:** `createGasto` y `updateGasto` aceptan una descripción de solo espacios (`gastos.js:23`); el iPad
  lo evita con `trim()`, el modal de edición del panel no se revisó.
- **Zona 8:** `getResumenDia` hace 6 queries y `getComparativoMes` 4, en tandas de a dos, cada vez que se abre
  el Inicio; y los filtros por mes con `TO_CHAR(timestamp AT TIME ZONE …) = $2` (Balances, Ventas, Gastos) no
  pueden usar un índice sobre `timestamp`.
- **Docs:** el encabezado de `backend/src/utils/comision.js:10-12` todavía habla de la columna nullable (ya
  anotado como opcional en `estado_actual.md`). La deuda diferida 2 de julio debería nombrar también al corte
  sin turno (Z4-01).

---

## Zona 5. Agenda, turnos y concurrencia

**Commit auditado:** `dd99386` (`feature/mejoras-operativas`), 2026-11-16/17. Solo lectura: código, docs y la
DB con el rol `resguardo_lectura`. No se reprodujo nada en demo: ningún hallazgo es alto ni crítico.

**Resumen:** 9 hallazgos (0 críticos, 0 altos, 2 medios, 7 bajos). Ocho están en producción y uno solo en el
branch (Z5-09). Dato que pesa en todas las severidades: **hoy ningún local real tiene turnos**. En la base hay
158 turnos de demo y 1 de kingsaistudio (cancelado, de septiembre); luxuribarberclub y monte-sinai, ninguno, y
ningún local real tiene ausencias, descansos ni feriados cargados. Nada de lo que sigue le pasó a un cliente:
es lo que va a pasar cuando un local empiece a usar el turnero propio.

**Revisión del orquestador (2026-11-17):** sin críticos ni altos, se revisó una muestra contra el código: Z5-01
(`horarios.js` y `horariosService.js` no consultan turnos), Z5-02 (el 409 del feriado devuelve solo la cantidad
y el mail sale solo con `cliente_email`), Z5-03 (`buscarTurnosAfectados` y el CTE de `crearSuspension` no
filtran `inicio > now()`) y Z5-06 (`reclamarTurno` y el `UPDATE` de la reprogramación). Contra la base, el
conteo de turnos por local. No se sacó ninguno ni cambió ninguna severidad.

### Hallazgos

#### Z5-01 [MEDIO] Cambiar el horario de un barbero no dice nada de los turnos reservados que quedan afuera

- **Dónde:** `backend/src/controllers/horarios.js:51-124` (`putHorarios`) y
  `backend/src/services/horariosService.js:79-101` (`reemplazarHorarios`). Ruta: `PUT /api/admin/horarios/:barbero_id`
  (admin, o el barbero sobre el suyo). Pantallas: Gestión → Barberos → Horarios del panel
  (`TabBarberos.jsx:308`) y Gestión de la app del barbero.
- **Alcance:** en producción (los dos archivos son iguales en `main`).
- **Qué pasa:** el dueño le saca los sábados a un barbero, o le corta la tarde, y guarda. El horario se
  reemplaza y listo: no se mira si ese barbero tiene turnos reservados en lo que dejó de trabajar. Esos turnos
  siguen `reservado`, el cliente tiene su mail de confirmación y va a recibir el recordatorio, y el sábado
  llega al local y su barbero no está. Nadie recibió un aviso al guardar. Las otras tres formas de cerrar
  agenda sí lo resuelven: la ausencia lista los turnos y pide confirmar, y el feriado y el horario del local
  cancelan con confirmación. El turno no desaparece (la Agenda del barbero y el Turnero del panel lo siguen
  mostrando, porque se dibujan desde los turnos y no desde la grilla), pero hay que ir a buscarlo día por día.
- **Evidencia:** leído (ruta → `putHorarios`, que valida forma, solapamiento y horario del local →
  `reemplazarHorarios`; en los fronts, el guardado no consulta turnos). En la DB hay 1 turno reservado futuro
  fuera del horario de su barbero, en demo.
- **Arreglo propuesto** (medio): al guardar, contar los turnos reservados futuros del barbero que quedan fuera
  de los bloques nuevos. Dos opciones:
  1. **Avisar y dejar decidir (recomendada):** 409 `requiere_confirmacion` con la lista (día, hora, cliente),
     como la ausencia. Al confirmar, el horario se guarda y los turnos **quedan** (no se cancelan): el dueño ya
     sabe cuáles son y decide si los atiende igual o los cancela uno por uno. Es lo más chico y no manda mails
     que nadie pidió.
  2. Cascada completa como la del horario del local (cancelar con mail). Más grande, y cancelar clientes por
     un cambio de horario del barbero es una decisión que conviene que el dueño tome turno por turno.
- **Novedad:** nuevo. `decisiones_horario_atencion.md` cubre la cascada del horario del local, no la del
  barbero. Pariente de la deuda "la reserva no valida el bloque horario del barbero", pero es otro camino: acá
  el turno era válido cuando se reservó.

#### Z5-02 [MEDIO] El feriado y el cambio de horario del local cancelan turnos de clientes sin mail y solo informan la cantidad

- **Dónde:** `backend/src/controllers/feriados.js:81-88` y `horarioAtencion.js:90-102` (el 409 devuelve solo
  `delta.turnos_cancelados`), `services/feriadosService.js:110` y `horarioAtencionService.js:256`
  (`if (t.cliente_email)`: sin mail, no hay aviso). Pantallas: Gestión → Negocio → Feriados
  (`BloqueFeriados.jsx:358`) y Horario de atención (`BloqueHorarioAtencion.jsx:317`).
- **Alcance:** en producción. F1 (solo en el branch) lo agranda: los turnos "Sin datos" nunca tienen mail.
- **Qué pasa:** el dueño carga un feriado para el viernes. El diálogo dice "se cancelan 6 turnos" y, al
  confirmar, "6 turnos cancelados". De esos 6, los que cargó un barbero sin mail del cliente (lo habitual
  cuando el turno se anota por WhatsApp o en el local) y los "Sin datos" se cancelan igual, pero a esos
  clientes no les llega nada, y el dueño no sabe cuáles son ni cuántos: la pantalla no los nombra en ningún
  momento. El viernes vienen y el local está cerrado. Para encontrarlos hay que abrir el Turnero del panel día
  por día y mirar los cancelados. El barbero tampoco se entera si no tiene mail cargado (sin mail no hay evento
  de Calendar; hoy ningún barbero de un local real lo tiene).
- **Evidencia:** leído (los dos controllers, las dos cascadas y los dos diálogos). La ausencia sí devuelve la
  lista con el nombre (`suspensionesService.js:114-119`), pero tampoco dice quién se queda sin aviso.
- **Arreglo propuesto** (medio): que el 409 y la respuesta final de las tres cascadas traigan la lista de
  turnos (día, hora, barbero, cliente, teléfono) con un campo `avisado` (tenía mail o no), y que el diálogo
  separe "a estos les llega un mail" de "a estos avisales vos", con el teléfono a mano. Sin cambios de schema.
- **Novedad:** nuevo; F1 lo agrava.

#### Z5-03 [BAJO] Una ausencia que empieza en el pasado cancela turnos que ya pasaron y le manda al cliente "tuvimos que cancelar este turno"

- **Dónde:** `backend/src/controllers/suspensiones.js:72-79` (solo valida `hasta > desde`) y
  `services/suspensionesService.js:94-107` y `:183-203` (los turnos afectados son todos los `reservado` que
  pisan el rango, sin `inicio > now()`). Ruta: `POST /api/admin/suspensiones`. Pantallas: Gestión → Barberos →
  Ausencias (los dos `datetime-local` de `TabBarberos.jsx:679-689` no tienen mínimo) y Gestión de la app del
  barbero.
- **Alcance:** en producción.
- **Qué pasa:** a las 11:00 un barbero se va enfermo y el dueño carga la ausencia "hoy de 9:00 a 20:00" (el
  día entero, que es lo natural). Los turnos de 9:00 a 11:00 que el barbero atendió pero que no se cobraron
  sobre el turno (se cobraron como cliente sin turno, o todavía no se cobraron) siguen `reservado`, así que
  entran en la lista, se cancelan y cada cliente recibe un mail diciendo que el barbero suspendió su agenda y
  su turno se canceló, después de haberse cortado. Además el turno queda `cancelado` y ya no se puede cobrar
  sobre él. El diálogo muestra la lista con día y hora, así que un dueño atento lo ve; pero es la única cascada
  que toca turnos pasados: la del feriado y la del horario filtran `inicio > now()`, y desde F9 ni el cliente
  ni el barbero pueden cancelar un turno que ya empezó.
- **Evidencia:** leído (controller → `crearSuspension` → `buscarTurnosAfectados` y el CTE `canceladas`).
- **Arreglo propuesto** (chico): sumar `AND t.inicio > now()` en `buscarTurnosAfectados` y en los dos lugares
  del CTE. La ausencia se puede seguir cargando con inicio pasado (sirve para el registro y para el % de la
  jornada); lo que cambia es que no cancela lo que ya empezó.
- **Novedad:** nuevo. Es la regla de F9 que faltó llevar a este camino.

#### Z5-04 [BAJO] Borrar un corte devuelve su turno a "reservado" sin mirar la hora, de dónde venía ni si el horario sigue libre

Junta las notas de las zonas 2 y 4 sobre `caja.js:312`. El 500 del choque con el `EXCLUDE` ya está reportado
como **Z4-09** y no se repite: acá va el resto y la propuesta para los cuatro casos.

- **Dónde:** `backend/src/controllers/caja.js:309-322`. Ruta: `DELETE /api/caja/movimientos/corte/:id` (admin).
  Pantalla: Caja → Movimientos del día.
- **Alcance:** en producción.
- **Qué pasa:** al borrar un corte con turno, el turno pasa de `completado` a `reservado` y nada más. Tres
  consecuencias que el dueño no ve venir. Corregido por la zona 6: el diálogo de Caja sí avisa que el turno
  vuelve a "Reservado" (`SeccionCaja.jsx:629-642`); lo que no dice es de qué turno se trata (hora y cliente) ni
  que, si es de un día anterior, queda pendiente en el pasado:
  1. **Turno de un día anterior:** queda un `reservado` en el pasado. Tiene salida (se puede volver a
     completar desde el Turnero del panel, o marcar "no asistió"), pero no desde el iPad, que lista solo los
     de hoy, y nadie avisa que quedó pendiente. Con el cierre nocturno de F3, esa misma noche pasaría a "no
     asistió" con `no_asistio_por = 'sistema'`: un cliente que vino y pagó quedaría con una falta.
  2. **Turno que el admin había completado desde "no asistió":** vuelve a `reservado`, no a "no asistió". No
     hay dónde leer el estado anterior. Es el mismo caso 1 con otro origen.
  3. **Turno de hoy que todavía no terminó:** vuelve a `reservado`, reaparece en el iPad y vuelve a ocupar su
     horario. Es lo correcto, salvo que el horario ya lo haya tomado otro (Z4-09).
- **Evidencia:** leído (`eliminarMovimiento`; `listarTurnosOperativos` filtra `reservado` y la fecha de hoy;
  `cambiarEstado` y `completarTurnoConCorte` aceptan un reservado pasado sin límite de antigüedad).
- **Qué debería pasar, por caso** (arreglo chico a medio, todo en `eliminarMovimiento` y el diálogo de Caja):

  | Caso | Hoy | Propuesta |
  |---|---|---|
  | El turno no terminó y su horario sigue libre | → `reservado` | Igual. Es correcto. |
  | El turno ya terminó (hoy o un día anterior) | → `reservado` en el pasado | Igual, **pero avisando**: es el único estado desde el que se puede volver a cobrar un turno de otro día. El diálogo de borrado dice "Este corte es del turno de las 15:00 de Juan: el turno vuelve a quedar pendiente de cobro", y F3 lo muestra en "turnos sin cobrar". |
  | Venía de "no asistió" | → `reservado` | Igual que el anterior. No vale la pena guardar el estado previo: si de verdad faltó, se vuelve a marcar (y el cierre de F3 lo hace solo). |
  | Otro turno ya tomó ese horario (Z4-09) | 500, el corte no se puede borrar | Atrapar `23P01`, borrar el corte igual y dejar el turno `cancelado` (`cancelado_por = 'admin'`, sin mail), devolviendo un aviso para que Caja diga "el horario de ese turno ya lo tiene otro cliente: quedó cancelado". No puede volver a `reservado` (lo impide el `EXCLUDE`) y `completado` sin corte es justo la inconsistencia que cuenta la zona 4. |

  Lo que más reduce todo esto es **Z4-05** (editar un corte en vez de borrarlo y recargarlo): la mayoría de los
  borrados de un corte con turno son para corregir la forma de pago o el monto.
- **Novedad:** nuevo; completa Z4-09 y las notas de las zonas 2 y 4. Conviene decidirlo antes de F3 (fase 7 de
  mejoras operativas), porque el cierre nocturno convierte el caso 1 en una falta mal puesta.

#### Z5-05 [BAJO] Un turno cobrado antes de su hora deja de ocupar su horario: el turnero lo vuelve a ofrecer

Es la pregunta que dejó la zona 4. Respuesta: **en el caso común es lo esperado; hay dos caminos donde no**.

- **Dónde:** `backend/src/services/disponibilidadService.js:237-246` (la disponibilidad y la grilla cuentan
  solo `estado = 'reservado'`), el `EXCLUDE` (también solo `reservado`), `services/turnosService.js:451-513`
  (`completarTurnoConCorte` no mira la fecha ni la hora del turno) y `frontend/.../SeccionTurnero.jsx:1250`
  ("Completar" en cualquier turno reservado, también de un día futuro).
- **Alcance:** en producción.
- **Qué pasa:**
  - **Esperado:** el cliente del turno de las 15:00 llega a las 14:20, el barbero está libre, lo corta y lo
    cobra a las 14:50. El turno pasa a completado y las 15:00 quedan libres de verdad. Que el turnero las
    ofrezca (por cinco minutos, hasta la antelación mínima) es correcto.
  - **No esperado, 1:** en el iPad, el selector "Turnos de hoy" lista todos los reservados del barbero. Si al
    cobrar al cliente de las 15:00 se elige por error el turno de las 17:00, el de las 17:00 queda completado y
    su horario libre: el turnero lo ofrece el resto de la tarde, otro cliente lo reserva y a las 17:00 llegan
    dos. Corregirlo es borrar el corte, y ahí aparece Z4-09.
  - **No esperado, 2:** desde el Turnero del panel se puede completar un turno de mañana o de la semana que
    viene (un clic de más mirando otro día). Queda un corte con fecha de hoy y el horario libre para el turnero.
  - En la Agenda del barbero el turno completado se sigue dibujando encima de su horario, así que el barbero
    no puede marcar un descanso ahí, pero el turnero sí lo reserva: es el único punto donde la Agenda y la
    disponibilidad muestran cosas distintas.
- **Evidencia:** leído. En la DB hay 2 pares de turnos superpuestos del mismo barbero entre `reservado` y
  `completado`, los dos en demo.
- **Arreglo propuesto** (chico):
  1. `completarTurnoConCorte` rechaza (409) un turno de un día posterior a hoy, y el panel no ofrece
     "Completar" en esos días.
  2. En el iPad, el selector marca cuál es el turno más cercano a la hora actual, o pide confirmar si el
     elegido empieza dentro de más de una hora ("Este turno es a las 17:00, ¿es el que estás cobrando?").

  No se propone que la disponibilidad cuente los completados: rompería el caso esperado.
- **Novedad:** nuevo.

#### Z5-06 [BAJO] Un turno reprogramado después de su recordatorio no vuelve a recibir recordatorio

Responde la nota de la zona 3.

- **Dónde:** `backend/src/controllers/turnero.js:627` (el `UPDATE` cambia `inicio` y `fin`; no toca
  `recordatorio_enviado_en`) y `services/recordatoriosService.js:71-74` (el lote toma solo los turnos con esa
  columna en `NULL`). Pantalla: gestión del turno, "Reprogramar".
- **Alcance:** en producción (hoy solo demo tiene el recordatorio activo).
- **Qué pasa:** el lote de las 20:30 le manda al cliente el recordatorio de su turno de mañana. El cliente
  entra por ese mismo mail y lo pasa al viernes. El turno queda marcado como ya avisado, así que el jueves a la
  noche el lote lo saltea y el cliente no recibe recordatorio del horario nuevo. Es justo el cliente que más lo
  necesita: el que cambió el turno. **No** recibe un recordatorio del horario viejo: el mail se arma con los
  datos del turno en el momento del envío. Sí recibe el mail de reprogramación.
- **Evidencia:** leído (`reprogramarTurno`, `obtenerTurnosDelLote`, `reclamarTurno`). En la DB: 0 turnos con
  recordatorio de un día que no sea la víspera (no pasó todavía).
- **Arreglo propuesto** (chico): `recordatorio_enviado_en = NULL` en el `UPDATE` de la reprogramación. No puede
  duplicar: el lote corre una vez por día y solo mira los turnos de mañana, así que un turno movido dentro del
  mismo día después del lote no vuelve a entrar. De paso, sumar `AND estado = 'reservado'` al `WHERE` de
  `reclamarTurno`: hoy, un turno cancelado entre la lectura del lote y su claim (segundos) recibe igual el
  recordatorio.
- **Novedad:** nuevo. `decisiones_mail_recordatorio.md` acepta las reservas hechas después del lote; este caso
  no está.

#### Z5-07 [BAJO] La validación del horario del local deja pasar un turno que cruza la medianoche

- **Dónde:** `backend/src/services/horarioAtencionService.js:81-95` y `:107-116` (`validarRangoEnHorario`
  compara `'HH:MM'` de inicio y de fin como texto). La usan `POST /api/turnero/turnos`,
  `/turnos/:token/reprogramar` y `POST /api/admin/turnos`.
- **Alcance:** en producción.
- **Qué pasa:** con un local que abre de 10:00 a 19:00, un turno de 23:40 a 00:10 pasa la validación: `23:40`
  no es menor que `10:00`, y `00:10` no es mayor que `19:00`. Por las pantallas no se llega (la disponibilidad
  nunca ofrece ese horario), pero un pedido armado a mano contra el endpoint público sí: aparecen turnos a
  medianoche en la Agenda del barbero, con su evento de Calendar y su mail. No bloquea horarios reales. La
  misma comparación está en `calcularDelta` (`:202-204`), así que la cascada del horario tampoco los ve.
- **Evidencia:** leído. En la DB: 1 turno reservado fuera del horario del local, en demo y ya pasado.
- **Arreglo propuesto** (chico): rechazar si `finDT` no es del mismo día que `inicioDT` (hora argentina), antes
  de comparar las horas.
- **Novedad:** corrige la deuda "no validan que `inicio` caiga en un slot real" de `estado_actual.md`, que
  afirma que el horario del local sí se valida: se valida, salvo este borde. El resto de esa deuda (bloque del
  barbero y grilla) sigue igual y no se repite.

#### Z5-08 [BAJO] El iPad no muestra un turno marcado "no asistió", aunque el backend está preparado para cobrarlo

- **Dónde:** `backend/src/services/turnosService.js:337-351` (`listarTurnosOperativos` filtra
  `estado = 'reservado'`) contra `controllers/cortes.js:18-19` y `:82` (`createCorte` acepta `no_asistio` del
  día: "elegirlo dice que el cliente vino"). Pantallas: `FlujoCorte` del iPad y "No asistió" de la app del
  barbero (`DetalleTurnoModal.jsx:74-80`, disponible desde el minuto en que empieza el turno).
- **Alcance:** en producción.
- **Qué pasa:** el turno es a las 10:00. A las 10:03 el barbero lo marca "no asistió"; a las 10:08 llega el
  cliente y lo atiende igual. Al cobrar, el turno ya no está en el selector del iPad: el cobro entra como
  cliente sin turno, el turno queda con la falta, y la planilla cuenta un corte "sin turno" de más. La única
  corrección es que el dueño lo complete desde el Turnero del panel ese mismo día. La rama del backend que lo
  resolvía desde el iPad no se puede alcanzar.
- **Evidencia:** leído (`FlujoCorte.jsx:103` → `getTurnosDelDia` → `GET /api/turnos` → `listarTurnosOperativos`).
- **Arreglo propuesto** (chico): que `listarTurnosOperativos` devuelva también los `no_asistio` del día, con
  su estado, y el selector los muestre al final con la etiqueta "No asistió". El resto ya está hecho.
- **Novedad:** nuevo.

#### Z5-09 [BAJO] Asignar un cliente a un turno "Sin datos" es de una sola vez: un error no se puede corregir

- **Dónde:** `backend/src/services/turnosService.js:691-693` y `:760` (`cliente_id IS NULL` como condición).
  Ruta: `PATCH /api/admin/turnos/:id/cliente`. Pantallas: "Asignar cliente" en la app del barbero y en el
  Turnero del panel.
- **Alcance:** solo en el branch (F1).
- **Qué pasa:** el barbero busca "Juan", toca al Juan equivocado y confirma. El turno queda con ese cliente y
  ni él ni el dueño lo pueden cambiar: un segundo intento responde 409 "El turno ya tiene un cliente asignado",
  y el botón desaparece. Si el turno está reservado, la salida es cancelarlo y cargarlo de nuevo; si ya está
  completado, no hay ninguna, y la planilla y la futura ficha del cliente quedan con el corte a nombre de otro.
  La regla de no pisar está bien para la carrera entre dos pantallas, que es para lo que se escribió.
- **Evidencia:** leído (`verificarTurnoAsignable`, `asignarClienteATurno`, y los dos fronts: el botón sale solo
  con `!turno.cliente_id`).
- **Arreglo propuesto** (chico a medio): permitirle al admin reemplazar el cliente de un turno (un
  `reemplazar: true` que saca el `cliente_id IS NULL` del `WHERE`, solo con rol admin), con "Cambiar" en el
  detalle del turno del panel. El barbero sigue sin poder pisar.
- **Novedad:** nuevo.

### Verificado correcto

**Estados del turno y transiciones** (todas las que existen en el código, por camino). El CHECK de la base
admite `reservado`, `cancelado`, `completado` y `no_asistio`; no hay ningún `UPDATE turno SET estado` fuera de
esta tabla.

| De → a | Camino | Condiciones (dónde se controlan) |
|---|---|---|
| (nuevo) → `reservado` | Turnero público, `POST /api/turnero/turnos` | Futuro (+5 min), dentro de 15 días, horario del local, sin feriado; sin otro turno (`EXCLUDE`) ni ausencia o descanso (`NOT EXISTS` en el `INSERT`) |
| (nuevo) → `reservado` | App del barbero (wizard y atajo de la Agenda), `POST /api/admin/turnos` | Igual, sin el tope de 15 días; con cliente nuevo, existente o "Sin datos" |
| `reservado` → `reservado` (otro horario) | Cliente, link del mail, `/reprogramar` | El turno no empezó (`inicio > now()` en el `WHERE`); el horario nuevo cumple lo mismo que una reserva. No hay reprogramación desde el backoffice |
| `reservado` → `cancelado` | Cliente, link del mail, `/cancelar` | No empezó (en el `WHERE`). `cancelado_por = 'cliente'` |
| `reservado` → `cancelado` | App del barbero y panel, `DELETE /api/admin/turnos/:id` | No empezó (en el `WHERE`); el barbero, solo los suyos |
| `reservado` → `cancelado` | Ausencia, `POST /api/admin/suspensiones` con confirmación | Todo `reservado` que pise el rango, **también los pasados** (Z5-03). `cancelado_por = 'suspension'` |
| `reservado` → `cancelado` | Feriado y cambio de horario del local, con confirmación | `inicio > now()`; `cancelado_por = 'admin'` |
| `reservado` → `completado` | iPad, `POST /api/cortes` con `turno_id` | Turno del barbero elegido; el iPad lista los de hoy. Sin control de hora (Z5-05) |
| `reservado` → `completado` | Panel, `POST /api/admin/turnos/:id/completar` | Admin (el backend también acepta al barbero sobre los suyos; ninguna pantalla suya lo ofrece). Cualquier día (Z5-05) |
| `reservado` → `no_asistio` | App del barbero y panel, `PATCH .../estado` | Ya empezó (lectura previa; el `WHERE` repite `estado = 'reservado'`). Sin límite hacia atrás |
| `no_asistio` → `completado` | Panel (solo admin) e iPad | Solo el mismo día del turno, en la misma sentencia. El iPad no llega a ofrecerlo (Z5-08) |
| `completado` → `reservado` | Caja, borrar el corte (admin) | Ninguna (Z5-04, Z4-09) |
| `cancelado` → (nada) | — | Terminal. Si el iPad cobra un turno cancelado, el corte entra sin turno y el turno no se revive |
| Sin cambio de estado | Asignar cliente (`reservado` o `completado`), job de recordatorios (`recordatorio_enviado_en`), Calendar (`google_event_id`) | — |

- **"Un turno se completa solo con su corte":** se respeta en todos los caminos. `PATCH .../estado` rechaza
  `completado` (400); los dos únicos caminos a `completado` pasan por `registrarCorte`, que marca el turno e
  inserta el corte en una sola sentencia. En la DB: 0 cortes con turno no completado; 17 completados sin corte,
  todos de demo y anteriores al 2026-10-20 (hoy no se pueden generar).
- **Estados sin salida:** ninguno que no sea por diseño. Un `reservado` pasado se puede completar desde el panel
  o marcar "no asistió"; `cancelado` y, pasado su día, `no_asistio` son terminales a propósito. En la DB: 24
  reservados con el fin pasado, todos de demo (18 de más de 30 días); es la deuda ya anotada que resuelve F3.
- **Turno pasado:** cancelar y reprogramar exigen `inicio > now()` con el reloj de la base y en el `WHERE`, en
  los tres caminos (cliente, barbero, admin). "No asistió" exige lo contrario. Los fronts ofrecen cada acción
  con la misma regla (`DetalleTurnoModal`, `Dashboard` del barbero, `SeccionTurnero`).
- **Turno sin cliente (F1):** no queda ningún `JOIN cliente` que no sea `LEFT JOIN` (`sqlTurnoEnriquecido`,
  `listarTurnos`, `listarTurnosOperativos`, `getTurnoPorToken`, `planillaService`). El único `JOIN turno` desde
  `cliente` es `getMisClientes`, donde corresponde. Todos los mails cortan si no hay email
  (`debeSaltarseEnvio`), y las cascadas y el recordatorio lo chequean antes de armar el mail. Calendar nombra
  el evento "Sin datos" y lo actualiza al asignar el cliente. Asignar dos veces da 409 sin pisar (una sola
  sentencia con `cliente_id IS NULL`); a un turno cancelado o "no asistió", 409. Las listas de turnos afectados
  de una ausencia muestran "Sin datos" (`textoCliente`) en los dos fronts.
- **Cascadas sin transacción:** la ausencia inserta y cancela en una sola sentencia (o todo o nada), y avisa
  después solo por los ids que canceló. El feriado y el horario del local cancelan turno por turno con
  `estado = 'reservado'` en el `WHERE`, y graban el feriado o el horario nuevo **al final**: si algo falla a
  mitad de camino, los turnos ya cancelados quedaron avisados, el feriado o el horario no se guardó, y repetir
  la acción recalcula y termina el resto. Un fallo de mail o de Calendar no corta la cascada. Lo que no hacen
  bien es informar (Z5-02).
- **Descansos:** `crearDescanso` valida contra la misma grilla que usa el turnero (alineado, dentro de un
  bloque, futuro, libre) y repite la ocupación en el `INSERT`. Liberar pone todas las reglas en el `WHERE`
  (dos pedidos no liberan dos veces; el barbero no libera lo del admin). El rango efectivo tiene una sola
  definición (`finEfectivoSql`, `suspensionSolapaSql`) y la usan la disponibilidad, la grilla, las reservas, la
  reprogramación y los listados; `unirDescansos` hace el mismo cálculo en JS. La Agenda del barbero y la del
  panel reciben los mismos bloques ya unidos del backend. En la DB: 0 turnos reservados sobre una ausencia o un
  descanso vigente, y 0 ausencias o descansos vigentes superpuestos entre sí.
- **Disponibilidad:** el último slot del día entra solo si el servicio termina antes del fin del bloque; un
  servicio más largo que el hueco no se ofrece; cada bloque ancla en su `hora_inicio`, así que con slots de 50
  minutos lo que sobra al final queda sin ofrecer (y la Agenda lo dibuja en gris). No hay cruce de medianoche
  posible en la grilla: los bloques son `time` con `hora_fin > hora_inicio`. "Hoy" y "ahora" salen de luxon en
  hora argentina, con la antelación de 5 minutos; un día pasado devuelve vacío; feriado o día cerrado, vacío.
  "Cualquier barbero" usa el mismo cálculo por barbero. Días y horarios salen de la misma función, así que la
  tira de días no puede ofrecer un día sin horarios. En la DB: 0 bloques de barbero fuera del horario del
  local y 0 turnos reservados en un feriado.
- **Fechas:** todos los instantes del cliente pasan por `parsearInstante` y llegan al SQL con offset
  (`toISO()`); ninguno llega crudo. Las comparaciones con "ahora" que deciden algo se hacen en la base
  (`now()`) o con luxon en `TZ`. Las fechas `DATE` convertidas con `toISOString()` (feriados) dan el día
  correcto mientras el proceso corra en UTC o en una zona al oeste (Railway y las máquinas de desarrollo); los
  fronts no usan `toISOString()` para sacar "hoy" (`getFechaHoy`, `fechaLocalISO`).
- **Concurrencia entre dos personas:** dos reservas del mismo horario, el `EXCLUDE`. Cliente que cancela y
  barbero que cobra a la vez: gana el primero y el otro recibe su 409 (o, en el iPad, el corte entra sin
  turno). Dos cobros del mismo turno: 409 y `corte_turno_unico`. Barbero que marca "no asistió" y admin que
  completa: el `WHERE` de cada uno. Dos asignaciones de cliente: `cliente_id IS NULL`. No encontré ninguna
  carrera fuera de las ya aceptadas (reserva contra ausencia o descanso en el mismo instante).
- **Recordatorios:** el claim es un solo `UPDATE ... WHERE recordatorio_enviado_en IS NULL` antes de enviar: dos
  corridas no mandan dos mails. Opt-in estricto (`activo === true`); hoy solo demo lo tiene. Un turno cancelado
  no entra al lote. Un turno sin mail se saltea antes del claim.
- **Calendar:** todas las llamadas atrapan su error y devuelven `null` o `false`: una falla de Google no rompe
  la reserva, la cancelación ni la reprogramación. Cancelar por cualquiera de los cinco caminos borra el
  evento; reprogramar lo actualiza. Sin mail del barbero no se crea evento. Un evento solo puede quedar
  huérfano si Google falla justo al cancelar (aceptado en `decisiones_turnero.md`, queda un `console.error`).
  Al evento van el nombre, el teléfono y el mail del cliente, que el barbero ya ve en su app.

**Sin revisar:** el render completo de `SeccionTurnero` (se leyeron el detalle del turno, las acciones y qué
pide), `CrearTurno.jsx` y `HojaReservar.jsx` (solo qué mandan), `Gestion.jsx` de la app del barbero (solo el
flujo de la ausencia) y `descansosSemanal` de Planillas. No se ejecutó nada: `unirDescansos` y el algoritmo de
slots se revisaron leyendo, sin casos de prueba.

### Para otra zona

- **Zona 8:** `duracion_slot_minutos` acepta de 1 a 240 (`turneroConfig.js:42`). Con un valor muy chico, cada
  consulta pública de disponibilidad arma cientos de slots por barbero y por día, y `/dias-disponibles` lo
  repite por 15 días. Además, cambiarlo no avisa que mueve la grilla de todos los barberos y la duración de
  todos los servicios.
- **Zona 8:** las cascadas del feriado y del horario del local hacen, turno por turno y en serie, un `UPDATE`,
  una llamada a Calendar y un mail, dentro del mismo request: con decenas de turnos son decenas de segundos.
- **Zona 7:** el lote de recordatorios escribe en el log el nombre y el mail del cliente
  (`recordatoriosService.js:154` y `:161`).
- **Zona 6:** en el Turnero del panel, "Completar" aparece en turnos de días futuros (Z5-05), y el borrado de
  un corte en Caja no dice que el corte tiene un turno (Z5-04).
- **Docs:** `SQL_Schema.md` no nombra `tenant_feriado_fecha_unica UNIQUE (tenant_id, fecha)` ni
  `turno_rango_valido CHECK (fin > inicio)`, que existen en la DB. El comentario de `caja.js:305-306` dice que
  el registro "solo completa turnos reservado": también completa `no_asistio`.

---

## Zona 6. Panel de gestión y app del barbero (front)

**Commit auditado:** `9ad3ec9` (`feature/mejoras-operativas`), 2026-11-17. Solo lectura: código de los tres fronts
y del backend donde hizo falta, y la DB con el rol `resguardo_lectura` (solo conteos). No se levantó nada ni se
abrió ningún front: todo lo que depende de cómo se ve queda **sin confirmar en pantalla**.

**Resumen:** 4 hallazgos (0 críticos, 0 altos, 0 medios, 4 bajos), los cuatro en producción. Las dos preguntas
de la zona tienen respuesta corta:

- **¿El front expone tokens o datos?** No encontré ningún sink nuevo: el único sigue siendo el de Z3-06 (ver
  "Cruce con Z3-06"). Los tokens viven donde se decidió, no viajan en URLs ni en la consola, y el modo barbero
  del panel no pide nada de admin. Lo único que el front oculta y el backend permite es completar un turno con
  rol barbero (Z6-01).
- **¿Qué fallas ve un usuario?** Ninguna grave. Una carga que falla en silencio y deja un mensaje falso
  (Z6-02), textos técnicos en inglés en la app del barbero sin señal (Z6-03) y una carrera al cambiar de
  semana en MiPlanilla (Z6-04).

**Revisión del orquestador (2026-11-17):** Z6-01 se confirmó leyendo el camino completo (`routes/turnos.js:22`,
`index.js:291`, `completarTurno` con `barberoSegunRol`, y D1 de `decisiones_acceso_barberos.md`), también en
`main`. De los demás se revisaron Z6-03 (`Dashboard.jsx:144`) y Z6-04 (`MiPlanilla.jsx`, `cargar` sin descartar
respuestas viejas). No se sacó ninguno ni cambió ninguna severidad. De paso se corrigió una frase de Z5-04 con
la nota de esta zona.

**Inyección de fórmulas en los Excel: no pasa.** SheetJS 0.20.3 escribe todo `string` como celda de texto, no
como fórmula (ver "Verificado correcto"), y en la base hay 0 textos que empiecen con `=`, `+`, `-` o `@`.

**Cruce con Z3-06** (el sink de `booking_url`), lado del front:

- `frontend/src/App.jsx:255` toma `booking_url` de `GET /api/negocio` (público) tal cual llega, y
  `frontend/src/screens/MainScreen.jsx:455` lo abre con `window.open(bookingUrl, "_blank")`: sin chequear el
  esquema y sin `noopener`. React 19 bloquea `javascript:` en un `href`, pero no en `window.open`: el front no
  agrega ninguna defensa.
- Sigue siendo el **único** sink de los tres fronts (barrido abajo). Los otros `window.open` y
  `location.href` son constantes (Spotify, YouTube).
- **Safari del iPad:** no lo pude confirmar con documentación en esta sesión. Según el estándar HTML, una
  ventana nueva abierta por `window.open` nace en `about:blank` con el origen de quien la abrió, y una
  navegación `javascript:` corre si el origen coincide; o sea que el script correría con el origen del panel y
  con `window.opener` apuntando al panel. Queda **sin confirmar** en WebKit y sin probar.
- El criterio de la zona 1 se mantiene: en ese origen están `token_operativo` y, si un barbero entró a
  `/barbero` desde el iPad, `barbero_sesion`. La severidad de Z3-06 no cambia; el arreglo del front que propone
  Z3-06 (abrir solo `https://`) sigue siendo el que corresponde, y conviene sumar `noopener,noreferrer`.

### Hallazgos

#### Z6-01 [BAJO] El backend deja que un barbero cobre sus propios turnos, con el precio que él elija; ninguna pantalla se lo ofrece

- **Dónde:** `backend/src/routes/turnos.js:22` (`POST /api/admin/turnos/:id/completar`, montado con
  `requiereRol('admin', 'barbero')` en `index.js:291`) y `backend/src/controllers/turnos.js` (`completarTurno`,
  "barbero solo completa los suyos"). En el front: `SeccionTurnero.jsx:1247` y `:1290` (`!readonly`: el modo
  barbero no muestra "Completar"), y la app del barbero no tiene esa acción.
- **Alcance:** en producción (la ruta y el scoping son iguales en `main`).
- **Qué pasa:** la decisión D1 de `decisiones_acceso_barberos.md` dice que el barbero no completa turnos
  ("completar = registrar corte" va por el iPad), y el front lo respeta. El backend no: con su propio token (el
  de la app, que queda guardado 30 días en su celular), un barbero puede mandar el pedido a mano y cobrar un
  turno suyo con el `precio`, el `servicio_id`, la `propina` y la forma de pago que quiera (el backend valida
  el rango, no el catálogo; Z4-04). Ejemplo: cobra en efectivo un corte de $ 15.000 y lo registra a $ 0. En
  Caja el turno figura cobrado, en su planilla queda un corte "con turno", y el aviso de "turnos sin cobrar"
  que trae F3 no lo va a mostrar. No registrarlo ya era posible; lo que agrega este camino es que el control
  queda tapado. Necesita saber armar un pedido HTTP: por eso es bajo.
- **Severidad (revisada por el orquestador):** queda en bajo, aunque por la guía una escalada que toca plata
  sería alto. Lo que este camino agrega es poco: el mismo barbero ya puede sacar un turno suyo de "sin cobrar"
  desde su app, sin saber nada técnico, marcándolo "no asistió" (permitido a propósito). La diferencia es que
  acá el turno queda "cobrado" en vez de "faltó". El arreglo es igual de chico y conviene hacerlo: deja el
  backend alineado con D1.
- **Evidencia:** leído (ruta → `verificarToken` → `requiereRol('admin', 'barbero')` → `completarTurno` →
  `barberoSegunRol`). Lo mismo ya lo anotó la zona 5 en su tabla de transiciones, sin abrirlo como hallazgo.
- **Arreglo propuesto** (chico): que `completarTurno` responda 403 con rol barbero (o un `requiereRol('admin')`
  propio en esa línea del router). Ninguna pantalla se rompe. No marcar "no asistió" ni cancelar: esas sí las
  usa la app del barbero.
- **Novedad:** nuevo (permiso que solo existía en el front).

#### Z6-02 [BAJO] Si falla la carga de barberos, el Turnero del panel dice "Sin barberos cargados" y "Reintentar" no lo arregla

- **Dónde:** `frontend/src/screens/admin/sections/SeccionTurnero.jsx:1503-1514` (el `catch` solo loguea) y
  `:1813-1819` (el `EmptyState`). Pantalla: Turnero del panel, con rol admin. Mismo patrón en
  `SeccionCaja.jsx:493-507` (socios).
- **Alcance:** en producción (las dos cargas están en `main`).
- **Qué pasa:** el dueño abre Turnero con mala señal o justo cuando el backend responde un 500. Los turnos
  cargan, pero `GET /barberos` falla: `barberos` queda vacío y la pantalla dice "Sin barberos cargados. No hay
  barberos activos para mostrar la agenda. Cargá al menos uno desde Gestión." No hay botón de reintentar
  (`error` es `null`, porque los turnos sí cargaron), y cambiar de día no lo arregla: el efecto de los barberos
  depende solo de `modoBarbero`. La única salida es ir a otra sección y volver. El dueño lee que no tiene
  barberos cuando tiene.
  En Caja, si falla `GET /admin/socios`, el modal "Registrar movimiento" con "Retiro" o "Aporte" muestra
  "Dueño" sin opciones y "Guardar" queda deshabilitado, sin decir por qué.
- **Evidencia:** leído. Sin confirmar en pantalla.
- **Arreglo propuesto** (chico): en Turnero, guardar el error de los barberos y mostrar el `EmptyState` de
  error con "Reintentar" (que vuelva a pedir barberos y turnos); en Caja, un aviso dentro del modal ("No se
  pudieron cargar los dueños") cuando el tipo elegido necesita socio y la lista vino vacía por error.
- **Novedad:** nuevo.

#### Z6-03 [BAJO] La app del barbero muestra el texto técnico del error ("Load failed") en varias acciones

- **Dónde:** `frontend-barbero/src/components/Dashboard.jsx:144` (`Error: ${err.message}`), `CrearTurno.jsx:160`
  (`setErrorConfirm(err.message)`), `Gestion.jsx:288` (`Error al guardar: ${err.message}`) y `:665` (`No se
  pudo liberar: ${err.message}`). Pantallas: Inicio (cancelar / no asistió), alta de turno, Gestión → Horarios
  y Ausencias.
- **Alcance:** en producción (Dashboard y Gestión son iguales en `main`; CrearTurno cambió en F1 y mantiene el
  patrón).
- **Qué pasa:** estas acciones usan `apiFetch`, que es un `fetch` sin diagnóstico. Sin señal, `fetch` tira un
  `TypeError` cuyo texto es "Load failed" en Safari y "Failed to fetch" en Chrome, y la pantalla muestra eso:
  "Error: Load failed" arriba de la lista de turnos, o "Error al guardar: Load failed". Con un 5xx que no trae
  `error`, se ve el genérico de `api.js` (en castellano). Es el mismo problema que `utils/errores.js` ya
  resolvió en el panel, y la app del barbero tiene la misma `mensajeDeError`: la usan `HojaReservar` y
  `HojaAsignarCliente`, pero no estas cuatro.
- **Evidencia:** leído (`api.js:308-332`, `:356-363`, `:418-426` y `:260-269` arman el `Error`; los cuatro
  `catch` lo muestran crudo). Sin confirmar en pantalla.
- **Arreglo propuesto** (chico): pasar los cuatro a `mensajeDeError(err, '<genérico en castellano>')`, que ya
  existe. Como la app todavía no tiene usuarios, conviene hacerlo antes de que empiecen.
- **Novedad:** nuevo.

#### Z6-04 [BAJO] MiPlanilla: tocar dos veces seguidas la flecha de semana puede dejar en pantalla los números de otra semana

- **Dónde:** `frontend-barbero/src/components/MiPlanilla.jsx:123-155` (`cargar`, sin descartar respuestas
  viejas) y `:178-179` (las flechas siguen activas mientras carga: el esqueleto reemplaza solo el contenido).
  Pantalla: Planilla de la app del barbero.
- **Alcance:** en producción.
- **Qué pasa:** el barbero quiere ver lo que cobró hace dos semanas y toca "anterior" dos veces rápido. Salen
  los pedidos de la semana −1 y de la −2. Con señal de celular el orden de llegada no está garantizado: si la −1
  llega última, el título dice la semana −2 y los números (cortes, comisión, "a cobrar") son de la −1. Además,
  la que llega primero apaga el esqueleto antes de tiempo. La Agenda y el alta de turno del barbero, y todas las
  secciones del panel, ya descartan la respuesta vieja (`refPedido` o `cancelado`); esta pantalla no.
- **Evidencia:** leído. Sin confirmar en pantalla (depende del orden de llegada).
- **Arreglo propuesto** (chico): el mismo `refPedido` que usa `Agenda.jsx:180` (o el `cancelado` del efecto,
  como el panel).
- **Novedad:** nuevo.

### Verificado correcto

**Barrido de sinks** (grep, además de la lectura): `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`,
`insertAdjacentHTML`, `eval(`, `new Function`, `document.write`, `srcdoc` y `createContextualFragment` en
`frontend/src`, `frontend-barbero/src`, `frontend-landing/src` y los tres `index.html`: **0 resultados**.
`window.open`, `location.href/assign/replace` y `.href =`: 6 usos; solo `booking_url` lleva un dato (Z3-06).

- `href` con datos: `tel:${...}` y `mailto:${...}` del cliente en la app del barbero (`DetalleTurnoModal.jsx:51`
  y `:57`, `Clientes.jsx:233` y `:236`). El esquema es fijo, así que un teléfono o un mail no pueden convertirse
  en `javascript:`.
- `src` con datos: el logo, la foto del local y las imágenes de Gestión salen de la URL que arma el backend
  sobre Supabase Storage; lo mismo el favicon (`link.href` en los dos `App.jsx`).
- Los nombres de clientes, servicios y barberos, los motivos y las notas se dibujan siempre como texto (React
  los escapa). Ni el panel ni la app del barbero cargan scripts de terceros: sus `index.html` traen solo el
  módulo propio y la fuente.

**Tokens**

| Token | Dónde vive | Cómo viaja | 401 |
|---|---|---|---|
| Admin y barbero del panel | Memoria del módulo (`api.js`, `authToken`) | Header `Authorization` de `apiFetch` | `apiFetch` lo limpia y `App.jsx` vuelve al login con el aviso de sesión cerrada |
| Operativo (iPad) | Memoria + `localStorage.token_operativo` | `apiFetchOperativo` | Lo limpia y vuelve al login del iPad |
| Barbero (app) | Memoria + `localStorage.barbero_sesion` (`{ token, barbero: { id, nombre } }`) y `barbero_ultimo_id` | `apiFetch` de la app | Borra la sesión guardada y vuelve al login |

- Coincide con lo decidido (julio 7.3 y F5). Ningún token va en una URL: los query params llevan fechas, ids y
  la búsqueda (con `encodeURIComponent`). Los `console.*` escriben el path, el status y `err.message`, nunca un
  token, un PIN ni el body.
- `fetch` directos: los del panel (`/negocio`, `/negocio/imagenes`, los tres logins y `/auth/recuperar/*`) y los
  de la app del barbero (`/turnero/*`, `/negocio/imagenes`) son públicos y no llevan token; los de
  `utils/errores.js` son el diagnóstico contra `/health`. Todo lo que lleva token pasa por un wrapper que
  maneja el 401.
- **402:** solo lo emite el login del admin (Z1-08) y `loginPanel` lo convierte en la pantalla bloqueada.
- **Cerrar sesión:** el panel limpia el token, el rol y el barbero, y desmonta `PanelAdmin` (las secciones
  pierden su estado); el iPad borra `token_operativo`; la app del barbero borra `barbero_sesion` y el token del
  módulo. Los catálogos del iPad que quedan en memoria son del mismo local (un subdominio es un origen).
- **Recuperación:** el `#recuperar=` se lee al cargar el módulo y se saca de la URL con `replaceState` antes
  del primer render (`App.jsx:57-69`). El token viaja en el body y no se loguea.
- `localStorage` no guarda datos de clientes. Lo único personal es el nombre del barbero, en su propio
  dispositivo. Un subdominio no lee lo de otro.

**Modo barbero del panel: qué pide cada sección**

| Sección | Admin | Barbero |
|---|---|---|
| Inicio, Caja, Balances, Ventas, Gastos, Gestión | Sus endpoints (todos solo admin en el backend) | No se dibujan ni se piden (`SECCIONES_BARBERO`) |
| Planillas | `/admin/planilla`, `/resumen`, `/descansos` | Los mismos, el backend los limita a los suyos; sin chips de barbero |
| Turnero | `/barberos`, `/admin/servicios`, `/admin/horario-atencion`, `/admin/turnos`, `/admin/descansos`, `/admin/suspensiones` | No pide `/barberos` ni `/admin/servicios` (usa `[barberoSesion]`); lo demás, limitado a lo suyo; detalle de solo lectura salvo "Asignar" (F1, a propósito) |

Con rol barbero el panel no hace ningún pedido que el backend niegue, así que no hay 403 que mostrar. Lo único
oculto en el front y abierto en el backend es completar (Z6-01); marcar "no asistió", cancelar, cambiar su
horario, ausencias y descansos los ofrece la app del barbero, a propósito.

**Excel: inyección de fórmulas**

- Los 7 Excel del panel (Caja, Planillas Detalle y Resumen con la hoja de Descansos, Gastos, Ventas, Balances
  mensual e histórico) usan `XLSX.utils.json_to_sheet`. En SheetJS 0.20.3, `sheet_add_json` marca todo valor
  `string` como celda de texto (`t = 's'`, `xlsx.mjs:27719`) y el escritor solo emite una fórmula si la celda
  trae `cell.f` (`xlsx.mjs:16159`). Un `=HYPERLINK(...)` en la descripción de un gasto o en el nombre de un
  cliente se abre en Excel como texto, no se evalúa.
- En la base (consultado): 0 nombres de cliente, 0 descripciones de gasto, 0 de movimientos extra y 0 nombres
  de servicios o productos que empiecen con `=`, `+`, `-` o `@`.
- **La descripción de solo espacios** (nota de la zona 4): el iPad no la deja avanzar (`descripcion.trim()`),
  y el modal de edición del panel manda el texto recortado, así que un texto vacío vuelve 400 y el modal
  muestra el mensaje del servidor. Solo se llega por API con el token del iPad. En la base: 0 gastos con
  descripción vacía o nula.

**Validaciones espejo (front contra backend)**

- `contactoNegocio`: mismo regex de mail, mismo E.164, mismo tope de 254 y de 30 caracteres; el front normaliza
  el celular argentino antes y marca todos los campos a la vez.
- Credenciales: usuario de 3 o más, contraseña de 8 o más y PIN de 4 dígitos en los dos lados.
- Comisión: múltiplo de 5 entre 0 y 100 en `utils/comision.js` de los dos lados.
- Montos: `fmtPesos` igual en los cuatro fronts (ya anotado). Dos diferencias chicas, sin hallazgo: el modal de
  edición de un gasto no tiene `maxLength` (un texto largo vuelve con el 400 del servidor, que se muestra), y el
  de una venta exige precio mayor que 0 aunque el backend acepta 0 (solo molesta con un producto cargado a
  $ 0).

**Fallas que ve el usuario**

- **"Cargando" para siempre:** ninguna pantalla. Todas las cargas apagan el estado en un `finally` y tienen su
  estado de error con "Reintentar" (panel) o el aviso de la app del barbero.
- **Respuestas fuera de orden:** Turnero, Caja, Planillas, Gastos, Ventas, Balances, Inicio y los bloques de
  Gestión descartan la respuesta vieja (`cancelado` o `vivoRef`); la Agenda, el alta de turno y la búsqueda de
  clientes del barbero, con `refPedido`. La excepción es MiPlanilla (Z6-04).
- **Doble toque:** el PIN del panel no acepta un quinto dígito mientras valida; los logins, la recuperación,
  los tres flujos del iPad, Caja (alta y borrado), Gastos y Ventas (editar y borrar), completar y cancelar en el
  Turnero, Asignar cliente, Gestión (barberos, servicios, productos, contacto, seguridad, feriados, horario,
  imágenes) y las acciones de la app del barbero deshabilitan el botón mientras responde el servidor.
- **Formularios que pierden lo cargado:** los modales con error del servidor (contacto, seguridad, barberos,
  servicios, productos, asignar cliente, movimiento extra) muestran el error adentro y conservan lo escrito.
  En contacto y seguridad, un PIN de confirmación incorrecto borra solo el PIN.
- **Listas viejas después de una acción:** completar, cancelar, "no asistió" y asignar cliente en el Turnero,
  y editar o borrar en Caja, Gastos y Ventas, dibujan el cambio con la respuesta del servidor. Liberar una
  ausencia la dibuja y recarga por detrás.

**Pendientes que dejaron otras zonas**

- **"Completar" en días futuros (Z5-05):** confirmado del lado del front. `SeccionTurnero.jsx:1247` lo muestra
  en todo turno `reservado`, sin mirar la fecha, y el `SelectorDia` tiene `permitirFuturo`. El arreglo ya está
  en Z5-05 (punto 1).
- **El borrado de un corte con turno en Caja (Z5-04):** el diálogo **sí** avisa que hay un turno:
  `SeccionCaja.jsx:629-645` muestra "El turno asociado volverá a estado Reservado" cuando el corte trae
  `turno_id` (lo devuelve `caja.js:55`). Lo que no dice es de qué turno se trata (hora, cliente) ni que, si es
  de un día anterior, queda un reservado en el pasado. Z5-04 dice "Caja no le dice que el corte tenía un
  turno": hay que corregir esa frase; la propuesta de Z5-04 (un texto con la hora y el cliente) sigue en pie.
- **Render de recuperación, `BloqueContacto` y `TabSeguridad` (zona 1):** leídos. La validación del front es
  la del backend; los errores van al campo (`campo` del 400 o `pin_admin_incorrecto`); un link vencido o usado
  pasa a su pantalla final sin perder nada; sin red se distingue de "servidor caído"; los botones se
  deshabilitan mientras responde. Un 403 de PIN incorrecto ya no cierra la sesión (F6).

**Landing (pasada corta):** sin sinks (barrido de arriba). Los `href` salen de `config/landing.js`
(`linkWhatsApp`, `linkEmail`) o son anclas internas; los externos llevan `rel="noopener noreferrer"`; el video
usa `youtube-nocookie` con un id fijo. Lo de `null` en `linkWhatsApp()` y `linkEmail()` ya está anotado.

**Sin revisar:** el render completo de `TabBarberos` (se leyeron el guardado, las ausencias y la carga),
`BloqueFeriados`, `BloqueImagenes`, `BloqueHorarioAtencion` y `TabTurnero` (sus `catch` y botones, no el
resto), y de la app del barbero `Agenda`, `CrearTurno`, `Gestion` y `Login` (sus cargas, guardas y `catch`). No
corrí `eslint`. Nada se confirmó en pantalla.

### Para otra zona

- **Zona 2:** Z6-01 es un permiso abierto en el backend (`POST /api/admin/turnos/:id/completar` con rol
  barbero) que solo el front cerraba.
- **Zona 5 (corrección de Z5-04):** el diálogo de borrado de Caja sí dice que el turno vuelve a "Reservado"
  (`SeccionCaja.jsx:629-645`); le falta la hora, el cliente y el caso del turno pasado.
- **Docs:** tres comentarios del panel dicen que con rol barbero el buscador devuelve "solo los suyos"
  (`frontend/src/services/api.js:613-614`, `hooks/useBusquedaClientes.js:17` y la cabecera de
  `turnero/AsignarCliente.jsx`). Con la decisión de Z2-01 deja de ser cierto: actualizarlos con ese arreglo.

---

## Zona 7. Operación, infraestructura y dependencias

**Commit auditado:** `b4b21b3` (`feature/mejoras-operativas`), 2026-11-17. Solo lectura: código, historial de git,
docs, la DB con el rol `resguardo_lectura` (catálogo, más un conteo por tenant autorizado por el usuario para
Z7-01), `npm audit` sin `fix` y las cabeceras reales de los fronts con `curl` (GET, solo cabeceras). No se hizo
ningún request a la API de producción. Para Z7-04 se probó la librería `body-parser` aislada, en memoria, sin
servidor, sin red y sin DB.

**Resumen:** 12 hallazgos (1 crítico, 1 alto, 2 medios, 8 bajos). Los doce están en producción. El crítico (Z7-01)
se le avisó al usuario en el chat apenas apareció. Ningún secreto en el repo ni en su historial.

**Revisión del orquestador (2026-11-17):** Z7-01 y Z7-02 se confirmaron contra el código y la base. Z7-01: el
repo es público (`gh repo view`), la skill con el paso 2 está en `main`, y en la base `monte-sinai` está activo,
en uso (cortes hasta el 12/11) y con el usuario del iPad igual al subdominio. Z7-02: `enmascararTokensEnRuta`
no saca el query string, la lista `deny` compara solo el texto del comando, y las dos skills afirman un cartel
de permiso que la decisión 13 de `plan_monitoreo_prod.md` dice que en la nube no existe. Z7-03 coincide con lo
que la zona 2 vio en el catálogo. No se sacó ninguno ni cambió ninguna severidad. Sobre la decisión del usuario
en Z7-01, ver la nota del orquestador dentro del hallazgo.

### Hallazgos

#### Z7-01 [CRÍTICO] La skill de alta, publicada en el repo, fija credenciales iniciales predecibles, y un local real nació con ellas

- **Dónde:** `.claude/skills/alta-cliente/SKILL.md:86-108` (paso 2, "Credenciales"). El repo es público en GitHub.
  Lo que alimenta el patrón es público: el subdominio (la URL del local) y el WhatsApp del local, que devuelve
  `GET /api/turnero/tenant` (`controllers/turnero.js:56-84`) y muestra la landing del turnero.
- **Alcance:** en producción (la skill está en `main` desde `383f184`, 2026-11-11, con el mismo paso 2).
- **Qué pasa:** la skill le indica a Claude que proponga, para cada local nuevo:
  - PIN de los barberos: `1111`, `2222`, `3333`… en el orden del formulario;
  - usuario del iPad: el subdominio;
  - contraseña del iPad: el subdominio sin guiones más el año (con un ejemplo);
  - PIN de admin: las últimas 4 cifras del celular del dueño.

  Cualquiera que lea el repo puede entrar desde internet al iPad de un local nuevo (subdominio y subdominio más
  el año), a la app del barbero con `1111` y, si el WhatsApp público del local es el celular del dueño, al panel
  de admin con sus últimas 4 cifras: caja, configuración y el mail del dueño (con eso se queda también con la
  recuperación, Z1-02). El limiter de login no ayuda: el atacante necesita uno o dos intentos, no miles.
- **Evidencia:** leído, y consultado en la DB (solo comparaciones, sin hashes; autorizado por el usuario):
  `monte-sinai` (activo) vino de una solicitud `cargada`, tiene el usuario del iPad igual al subdominio y su
  WhatsApp público termina con las mismas 4 cifras que el celular del dueño. `pepe-barber` (de prueba, dado de
  baja) igual. `kingsaistudio` y `luxuribarberclub` tienen el usuario del iPad igual al subdominio, pero se
  dieron de alta a mano, antes de la skill: su contraseña no sigue este patrón (que se sepa).
  **Sin confirmar:** si las credenciales cargadas en `monte-sinai` fueron las que propuso la skill (Facundo
  podía cambiarlas) y si después se cambiaron. Confirmarlo es comparar los hashes contra el patrón, y no se
  hizo.
- **Arreglo propuesto:**
  1. (chico) Que la skill proponga credenciales al azar (PINs distintos sin patrón, contraseña generada) y
     sacar el patrón y el ejemplo del texto.
  2. (chico, lo hace el dueño o Facundo) En `monte-sinai`, cambiar el PIN de admin y la contraseña del iPad
     desde Gestión → Seguridad, y los PIN de los barberos.

  **Decisión del usuario (2026-11-17):** sacar la skill de `main` y dejarla ignorada en `.gitignore`, sin rotar
  las credenciales. Para tener en cuenta al hacerlo: el archivo sigue en el historial público del repo (desde
  `383f184`), así que sacarlo de `main` lo saca de la vista pero no lo borra; reescribir el historial no es
  posible con el ruleset de `main` y no llega a clones ni forks. Y las credenciales de `monte-sinai` quedan como
  están. En el `.gitignore` de la raíz, la regla va **después** de `!.claude/skills/`
  (`.claude/skills/alta-cliente/`), más un `git rm -r --cached` de la carpeta.
- **Nota del orquestador (2026-11-17):** sacar la skill de `main` no
  cierra el riesgo: el patrón sigue en el historial público, y las credenciales de `monte-sinai` son las que
  importan. Recomendado: (1) cambiar ya las credenciales de `monte-sinai` (PIN de admin, contraseña del iPad y
  PINs de los barberos) desde Gestión → Seguridad y Barberos, que no requiere código; (2) que la skill genere
  credenciales al azar, se quede o no en el repo. Además, este mismo documento describe el patrón y vive en el
  repo público: no pushearlo hasta que (1) esté hecho.
- **Decisión confirmada por el usuario (2026-11-17), después de la nota del orquestador:** las credenciales de
  `monte-sinai` no se cambian. Queda en pie lo de la skill (sacarla de `main` e ignorarla). El riesgo de
  `monte-sinai` queda aceptado por el usuario; en la fase 9 este hallazgo entra con ese destino. Sigue abierta
  la pregunta de cuándo publicar este documento (ver la nota anterior).
- **Novedad:** nuevo.

#### Z7-02 [ALTO] Un anónimo escribe texto en las líneas del log que lee la sesión de Claude en la nube, y esa sesión tiene un token de Railway que lee los secretos

- **Dónde:**
  - Texto del atacante en líneas de `stderr` (lo que lee `salud-prod`, paso 5, `--filter "@level:error"`):
    `index.js:132` (`[index] body rechazado`, con la URL **y su query string**: un POST con JSON roto a cualquier
    ruta, sin límite propio); `rateLimitMiddleware.js:54` (la ruta con query string, al pasar un límite);
    `tenantMiddleware.js:170` (el header `X-Tenant-Subdomain`, hasta 63 caracteres, y la skill pide reportarlo:
    `salud-prod/SKILL.md:142-144`). También el `path` de los 5xx del borde (paso 4) y, por Z1-04, el mensaje de
    Postgres con el `barbero_id` del atacante, que llega como título de un issue de Sentry al aviso de Discord
    que se pega en `arreglo-prod`.
  - Qué puede hacer la sesión: `RAILWAY_TOKEN` de proyecto, que puede deployar y leer y cambiar variables
    (`decisiones_monitoreo_prod.md`, "Garantías"); `git push` a cualquier branch que no sea `main` y `gh api`
    contra un repo público; en la nube no hay cartel de permiso para ningún comando (`plan_monitoreo_prod.md`,
    decisión 13). La lista `deny` (`.claude/settings.json:9-60`) compara el texto del comando: no frena
    `npx @railway/cli variables`, la CLI llamada por su ruta completa, un `curl` o un `node -e` contra la API
    de Railway con el token del entorno, ni el `push` de un branch.
- **Alcance:** en producción.
- **Qué pasa:** el repo es público y las skills dicen exactamente qué líneas se leen. Un anónimo manda
  `POST /api/x?<instrucciones de varios kB>` con un JSON roto: queda una línea `[index] body rechazado` con ese
  texto. La próxima vez que Facundo pregunta "¿cómo está prod?", la sesión lo lee. Si el modelo lo obedece, puede
  leer las variables (`JWT_SECRET`, la contraseña de dueño de la DB, la service role key, `RESEND_API_KEY`) y
  dejarlas en un branch o un PR del repo público: con `JWT_SECRET` se firma un token de admin de cualquier
  local. Además, las dos skills le dicen al modelo un control que no existe: `arreglo-prod/SKILL.md:23-26` ("el
  cartel de permiso es el control… cualquier comando fuera de `.claude/settings.json` le pide permiso") y
  `salud-prod/SKILL.md:29-32`. Ninguna dice que el texto de los logs, de un aviso pegado o de una solicitud es
  dato y nunca instrucción.
- **Por qué alto y no crítico:** depende de que el modelo siga el texto inyectado (los modelos están entrenados
  para no hacerlo, pero no es una garantía) y de que Facundo abra una sesión. Si pasa, el impacto es crítico.
- **Evidencia:** leído (los tres `console.warn`, el orden de middlewares de `index.js`, las dos skills,
  `settings.json` y los docs del monitoreo). No se probó nada contra la sesión en la nube ni la lista `deny`
  (el prompt lo prohíbe). **Sin confirmar:** la salida a internet que permite el entorno `barberia-prod` de
  claude.ai/code (no cambia el caso del repo público), y si Claude Code normaliza alguna de esas formas del
  comando antes de comparar con `deny`.
- **Arreglo propuesto:**
  1. (chico) Cerrar los canales en el código: en esas tres líneas, la ruta sin query string
     (`rutaSinDatosSensibles`) y recortada, y el subdominio solo si cumple el formato (`^[a-z0-9-]{1,63}$`; si
     no, "(formato inválido)"). Z3-02 y Z1-04 cierran los otros dos.
  2. (chico) En `salud-prod`, `arreglo-prod` y `alta-cliente`, una regla: el contenido de logs, avisos pegados y
     solicitudes es dato; si un texto pide correr algo o cambiar el plan, se dice y se frena. Y corregir lo del
     cartel de permiso.
  3. (medio) Que una sesión desviada pueda menos: el hook `PreToolUse` de la fase 4 del resguardo, ampliado
     para bloquear cualquier comando que nombre `railway` (salvo `logs`, `deployment list` y `status`),
     `backboard.railway` o `RAILWAY_TOKEN`; y, si el entorno lo permite, salida a internet solo hacia Railway y
     GitHub.

  Recomendado: 1 y 2 ya (son chicos); 3 con la fase 4 del resguardo.
- **Novedad:** agrava una decisión aceptada: "las reglas `deny` frenan el error de buena fe, no a quien la
  quiera esquivar" (`decisiones_monitoreo_prod.md`). Esa frase suponía que no hay un adversario adentro de la
  sesión, y por los logs lo hay.

#### Z7-03 [MEDIO] La credencial "de solo lectura" vale como admin de todos los locales y puede hacer pedidos HTTP desde la base

- **Dónde:** el rol `resguardo_lectura` en la DB. La credencial vive en el secret `BACKUP_DB_URL` de GitHub, en
  `backend/.env.lectura` de la PC y la usan las sesiones de Claude.
- **Alcance:** en producción.
- **Qué pasa:**
  1. **Leer es entrar.** Lee `tenant.pin_admin` y `barbero.pin`: son bcrypt de 4 dígitos, 10.000 candidatos por
     hash, que se prueban en minutos en una notebook. Con el PIN de admin se entra desde internet al panel de
     cualquier local. Lo mismo con `operativo_password_hash` cuando la contraseña es corta. La decisión D9 del
     resguardo ("la credencial que queda en GitHub no puede escribir aunque se filtre") es cierta para `public`,
     pero no cubre esto.
  2. **Pedidos HTTP salientes desde la base.** `net.http_get`, `http_post` y `http_delete` (pg_net) se pueden
     ejecutar, y `net.http_request_queue` y `net._http_response` tienen todos los permisos, todo concedido a
     `PUBLIC`. El solo lectura es un default del rol (`rolconfig`), que la propia sesión cambia con un `SET`.
     Con eso: pedidos desde los servidores de Supabase (sacar datos sin que pasen por la máquina del atacante),
     borrar los pedidos pendientes de los triggers `web_deploy_*` de la web de Kingsai, o leerlos mientras
     esperan (la fila lleva la URL del hook de deploy, que sale de Vault).
- **Evidencia:** consultado en la DB, solo catálogo, sin ejecutar ninguna función de pg_net ni cambiar el modo
  de la sesión. `rolbypassrls = true`, `rolinherit = false`, sin membresías, `CONNECTION LIMIT 3`,
  `rolconfig = {default_transaction_read_only=on, statement_timeout=30s}`. `USAGE` en `public`, `extensions` y
  `net` (en `net`, por `PUBLIC`, `anon` y `authenticated`); sin `USAGE` en `auth`, `storage`, `vault`, `realtime`
  ni `graphql`. `SELECT` en las 23 relaciones de `public`, ninguna escritura. En `public` solo ejecuta las
  funciones de `btree_gist` (`timerange`, `timemultirange`); las 6 propias, no. `token_recuperacion` guarda
  solo el hash (no es un riesgo).
- **Arreglo propuesto** (medio; SQL que corre el usuario):
  1. `REVOKE` de `PUBLIC` sobre las funciones `net.http_*` y las tablas de `net`, dejándoselo a `postgres`, que
     es el dueño de `web_deploy_kingsai()` (`SECURITY DEFINER`). Probarlo antes en el proyecto de la
     restauración (fase 3), porque toca una extensión de Supabase.
  2. Separar los usos: el `pg_dump` necesita leer todo y se queda con este rol, que vive solo en GitHub; las
     consultas de Claude pasan a otro rol sin `SELECT` sobre las columnas de PIN y contraseña.

  Recomendado: 1 con la fase 5 del resguardo; 2 cuando se toque la fase 5.
- **Novedad:** confirma y amplía la nota de la zona 2. Corrige la premisa de D9 de `plan_resguardo_db.md`, y
  la del "dos capas: aunque alguien apague el modo solo lectura, no tiene permisos" (§2), que no vale para `net`.

#### Z7-04 [MEDIO] `body-parser` 2.2.2, de runtime en el backend, tiene un aviso alto de caída con cuerpos comprimidos, y la API los acepta en todas las rutas

- **Dónde:** `backend/package-lock.json` (`express@5.2.1` → `body-parser@2.2.2`); `index.js:107`
  (`express.json()` global, con `inflate` activado por defecto).
- **Alcance:** en producción (mismo lock en `main`).
- **Qué pasa:** `npm audit` marca GHSA-27r3-jxmh-p828, alto, "Denial of Service via trailing bytes after a
  compressed request body", CWE-248 (excepción no atrapada). El código usa la parte afectada: cualquier anónimo
  puede mandar un JSON con `Content-Encoding: gzip`, `deflate` o `br` a cualquier ruta, antes del tenant y del
  token. Si el aviso es una caída del proceso, un pedido tumba la API de todos los locales (Railway la
  reinicia; repetido, es una caída sostenida).
- **Evidencia:** `npm audit` y leído (`body-parser/lib/read.js`). Prueba aislada en memoria (sin servidor, red
  ni DB), 9 variantes: gzip, deflate y brotli con bytes de más, juntos y en un segundo pedazo demorado. Con gzip
  da un 400, y con deflate y brotli ignora lo que sobra; ninguna tiró una excepción. **Sin confirmar** el
  escenario exacto del aviso (no se consultó el texto completo).
- **Arreglo propuesto** (chico): `npm audit fix` sin `--force` en `backend` (la versión corregida entra en el
  rango de `express@5`), y además `express.json({ inflate: false })`: ningún front manda el cuerpo comprimido,
  así que se cierra la superficie entera. Recomendado: las dos.
- **Novedad:** nuevo (en julio, el backend quedó con 0 vulnerabilidades).

#### Z7-05 [BAJO] Datos de clientes en los logs de Railway, que también lee la sesión de diagnóstico

- **Dónde:**
  - `index.js:201-209`, el log de acceso: escribe el body de cada pedido, y `sanitizarObjeto` tapa solo
    credenciales (`utils/sanitizarLogs.js:12-15`). Así quedan el nombre, el teléfono y el mail del cliente en
    `POST /api/turnero/turnos` y `POST /api/admin/turnos`, el `usuario` del iPad en su login y el `barbero_id`
    en el login del barbero.
  - `mailer.js:248`: el mail del cliente en cada envío (confirmación, cancelación, reprogramación,
    recordatorio, cancelación automática). La recuperación ya lo enmascara.
  - `recordatoriosService.js:154`: el nombre del cliente cuando no tiene mail (es un `warn`, así que lo lee
    `salud-prod`). La línea 161 es solo del modo de prueba.
- **Alcance:** en producción (las mismas líneas en `main`).
- **Qué pasa:** cada reserva deja los datos personales del cliente en los logs. Los ve quien entra a Railway y,
  por las líneas de `stderr`, entran al contexto de la sesión de Claude: `salud-prod` pide "contarlos, no
  copiarlos", pero los lee igual. Nada de esto sirve para diagnosticar: alcanza con el id del turno o del
  cliente.
- **Evidencia:** leído; las tres líneas existen igual en `main`.
- **Arreglo propuesto** (chico): sumar a `KEYS_SENSIBLES` `nombre`, `email`, `telefono` y `usuario` (o, mejor,
  pasar a una lista blanca de claves que sí se escriben); en el mailer, `destinoLog` enmascarado por defecto,
  como en la recuperación; en el recordatorio, el id del turno en vez del nombre. Recomendado: la lista blanca.
- **Novedad:** nuevo. Junta las notas de las zonas 1, 3 y 5.

#### Z7-06 [BAJO] Rechazos de input que se registran como error: uno avisa al celular y otros ensucian el diagnóstico

- **Dónde:** `plataformaAuthMiddleware.js:43`, y el manejo de errores del body en `index.js:124-134`.
- **Alcance:** en producción.
- **Qué pasa:**
  1. `PLATFORM_ADMIN_KEY` no está seteada a propósito (`estado_actual.md` → Deploy, y `onboarding.md`), así que
     cada `POST /api/plataforma/cache/invalidate` anónimo hace un `console.error`, que va a Sentry y a
     Discord. Es un aviso que Facundo no puede resolver sin setear la variable; si lo marca resuelto, el
     próximo pedido lo reabre ("Issue que vuelve"). Los repetidos seguidos los descarta el filtro de eventos
     duplicados del SDK (`dedupeIntegration`, activado por defecto en `@sentry/node` 11), así que no gasta
     cuota salvo que se intercale con otro error.
  2. El handler de `index.js` cubre solo JSON mal formado y body grande. Un `Content-Encoding` desconocido
     (415), un charset desconocido (415) o un gzip roto (400) siguen hasta el handler final de Express, que
     imprime el stack con `console.error` (`express/lib/application.js:615-618`). A Sentry no llega
     (`esLogDeExpress` lo descarta), pero `salud-prod` lo cuenta como un error "que escapó de un handler", y la
     respuesta sale en HTML.
- **Evidencia:** leído; el filtro de duplicados, leído en `@sentry/core/build/cjs/integrations/dedupe.js`.
- **Arreglo propuesto** (chico): en el middleware de plataforma, `console.warn` (o un solo aviso al arrancar,
  y el 503 sin log); en el handler de `index.js`, responder JSON con `console.warn` a todo error con
  `err.status` 4xx que venga del parseo del body.
- **Novedad:** nuevo. Del mismo tipo que lo que ya se arregló en `index.js:124` (body mal formado).

#### Z7-07 [BAJO] Los intentos fallidos de login del iPad se loguean con `console.log`: el diagnóstico no los ve

- **Dónde:** `controllers/authOperativo.js:46`, `:55` y `:64`.
- **Alcance:** en producción.
- **Qué pasa:** la convención (§1, punto 4) pide `console.warn` para los logins fallidos. Con `console.log` van
  por `stdout`, nivel `info`, y `salud-prod` lee solo `@level:error` (`stderr`): una fuerza bruta contra la
  contraseña del iPad no aparece en el reporte, mientras que la del PIN sí (`authPanel` y `authBarbero` usan
  `warn`). Con Z7-01, la contraseña del iPad es justo la credencial más fácil de adivinar.
- **Evidencia:** leído; mismas líneas en `main`.
- **Arreglo propuesto** (chico): `console.warn` en las tres, y sumarlas a la lista de logins fallidos de
  `salud-prod/SKILL.md` (paso 5).
- **Novedad:** nuevo (nota de la zona 1).

#### Z7-08 [BAJO] Cabeceras de los fronts: el panel se puede embeber en un iframe, y la gestión del turno no lleva `noindex` ni `Referrer-Policy`

- **Dónde:** `frontend/vercel.json` (solo `X-Robots-Tag` y el cache de `/fonts`). Los demás `vercel.json` no
  tienen cabeceras de seguridad, y la landing no tiene `vercel.json`.
- **Alcance:** en producción.
- **Qué pasa:**
  1. Ningún front manda `X-Frame-Options` ni `Content-Security-Policy: frame-ancestors`: cualquier sitio puede
     embeber el panel. Hoy el riesgo es acotado: los navegadores separan el `localStorage` de un iframe de otro
     sitio, así que el iframe no tiene el token del iPad, y lo que se tipea adentro no lo lee la página de
     afuera. Es defensa en profundidad.
  2. `/turnos/gestionar/<token>` no lleva `X-Robots-Tag: noindex` (la regla de `frontend/vercel.json` excluye
     todo `/turnos`). Si alguien publica su link, se puede indexar con el token.
  3. Esa página tampoco lleva `Referrer-Policy`. Hoy el token no sale en el `Referer` por el default de los
     navegadores (`strict-origin-when-cross-origin`) y por el `rel="noreferrer"` de los links. La nota de julio
     (3.3) se lo atribuye a `helmet`, pero `helmet` pone la cabecera en las respuestas de la API, no en la
     página que sirve Vercel.
- **Evidencia:** cabeceras reales con `curl` (abajo, en "Verificado correcto").
- **Arreglo propuesto** (chico): en `frontend/vercel.json`, `X-Frame-Options: DENY` (o
  `frame-ancestors 'none'`) para todo menos `/turnos`, y una regla para `/turnos/gestionar/(.*)` con
  `X-Robots-Tag: noindex` y `Referrer-Policy: no-referrer`. Lo mismo en `frontend-alta/vercel.json`
  (`Referrer-Policy`, porque el link también lleva un token).
- **Novedad:** corrige la nota de mitigación de 3.3 en `auditoria_2026-07.md` (el `Referer` lo cuida el
  navegador, no `helmet`). Junta las notas de las zonas 3 y 6.

#### Z7-09 [BAJO] La key de B2 "que no puede borrar" puede ocultar o pisar los backups, y las reglas de ciclo de vida los terminan borrando

- **Dónde:** la key `backup-github-subida` (`listBuckets`, `writeFiles`), en los secrets de GitHub; las reglas
  de ciclo de vida del bucket (D4, D5 y §7 de `plan_resguardo_db.md`).
- **Alcance:** en producción.
- **Qué pasa:** según la documentación de B2 (de memoria, sin consultar), `writeFiles` también permite
  `b2_hide_file` y subir otra versión con el mismo nombre, y las reglas de ciclo de vida borran las versiones
  ocultas o reemplazadas pasados los días configurados. Los nombres son predecibles
  (`diarios/AAAA-MM-DD.dump.age`). Quien tenga la key puede, sin `deleteFiles`, hacer desaparecer los backups o
  dejar basura en su lugar. La key vive solo en GitHub, así que hace falta una filtración (la cuenta de GitHub o
  una corrida del workflow comprometida).
- **Evidencia:** leído (workflow, script y plan). **Sin confirmar:** las reglas de ciclo de vida reales del
  bucket (`daysFromHidingToDeleting`) y si la key puede ocultar archivos; se ve en el dashboard de B2.
- **Arreglo propuesto** (chico, en el dashboard de B2): Object Lock con retención, por ejemplo de 30 días en
  `diarios/`. Con eso, ninguna key puede borrar ni pisar un backup antes de tiempo.
- **Novedad:** corrige la premisa de D4 ("si se filtra, nadie puede borrar") y del descarte de Object Lock en
  §7 del plan del resguardo.

#### Z7-10 [BAJO] El PIN de admin de demo está escrito en el repo público

- **Dónde:** `backend/src/scripts/hashearPinAdmin.js:9` (`PIN_PLANO` del tenant demo).
- **Alcance:** en producción (está en `main`).
- **Qué pasa:** si demo sigue con ese PIN, cualquiera entra como admin de demo. Eso no toca a los locales
  reales (otro origen y otro tenant), pero desde ahí puede crear turnos que mandan confirmaciones a cualquier
  dirección (`crearTurnoAdmin`, solo con el límite global), con la cuota de Resend que comparten todos (ver
  Z3-01), o dejar un `javascript:` en el `booking_url` de demo (Z3-06), que Facundo abre al probar.
- **Evidencia:** leído. **Sin confirmar:** si el PIN de demo sigue siendo ese (no se compararon hashes) y si
  la suscripción de demo está vigente (`estado_actual.md` dice que venció el 2026-10-30: vencida, el panel
  responde 402 y el abuso queda frenado hasta que se renueve).
- **Arreglo propuesto** (chico): borrar el script (`crearTenant.js` y la pantalla de Seguridad ya cubren lo
  mismo) y cambiar el PIN de admin de demo.
- **Novedad:** nuevo.

#### Z7-11 [BAJO] Si el cron no tiene `NODE_ENV=production`, pasar las reglas de Sentry a `production` lo deja sin avisos

- **Dónde:** `instrument.js:132` (`environment: process.env.NODE_ENV || 'development'`), el servicio cron de
  Railway, y el residual del monitoreo en `estado_actual.md` → Pendientes.
- **Alcance:** en producción.
- **Qué pasa:** el residual dice que pasar las 4 reglas de "All environments" a `production` "no cambia nada en
  la práctica". Los docs listan `NODE_ENV=production` entre las variables del servicio web, pero no del cron,
  cuyas compartidas son solo `RESEND_API_KEY`, `MAIL_FROM` y `SENTRY_DSN`. Si el cron no la tiene, sus errores
  salen con `environment: development` y, después de ese cambio, el fallo del recordatorio no avisaría.
- **Evidencia:** leído. **Sin confirmar:** las variables del servicio cron (se ven en el dashboard de Railway).
- **Arreglo propuesto** (chico): confirmar o setear `NODE_ENV=production` en el cron antes de tocar las reglas, y
  sumarlo a la lista de variables de `estado_actual.md`.
- **Novedad:** corrige la premisa del residual "Monitoreo — residuales" de `estado_actual.md`.

#### Z7-12 [BAJO] Las herramientas de desarrollo de los cinco fronts tienen vulnerabilidades altas, y el dev server está abierto a la red local

- **Dónde:** los `package-lock.json` de los cinco fronts (`vite` 7.3.6 en el panel, 8.1.5 en barbero, turnero y
  alta, y 8.0.16 en la landing, más transitivas de `eslint`/`postcss`), y `server: { host: true }` en los cinco
  `vite.config.js`.
- **Alcance:** solo en desarrollo (no van al bundle). En `main`, igual.
- **Qué pasa:** `vite` arrastra avisos altos que pegan justo en el dev server: ejecución de scripts de otro
  origen por un middleware, archivos fuera de `server.fs.allow` y `launch-editor` en Windows. Con `host: true`,
  el dev server queda abierto a cualquiera de la misma WiFi mientras Facundo lo tiene levantado.
- **Evidencia:** `npm audit` (ver "Verificado correcto": runtime 0 en los cinco).
- **Arreglo propuesto** (chico): `npm audit fix` sin `--force` en los cinco (todos tienen arreglo dentro del
  rango), y `host: true` solo cuando se prueba en el celular (por ejemplo, `npm run dev -- --host`), no fijo en
  la configuración.
- **Novedad:** reabre 5.4 de `auditoria_2026-07.md` (en julio quedaron en 0).

### Verificado correcto

**Secretos**

- Historial completo (393 commits, todas las ramas, sin `node_modules` ni locks), buscando JWT y keys de Supabase,
  `re_` de Resend, `sk_`, URLs `postgres://` con contraseña, claves privadas PEM y de age, DSN de Sentry, refresh
  tokens y client secrets de Google, keys de AWS y de B2, tokens de GitHub, webhooks de Discord, token de
  Railway y asignaciones de `JWT_SECRET`, `DB_PASSWORD`, `PLATFORM_ADMIN_KEY`, `SERVICE_ROLE_KEY`,
  `RESEND_API_KEY`, `GOOGLE_*`, `SENTRY_DSN`, `B2_*`, `BACKUP_DB_URL` y `MONITOR_CHECKIN_URL`: **ningún
  secreto**. Los aciertos fueron marcadores (`backup-db.sh`, la forma de la URL en un comentario) y
  `process.env.JWT_SECRET` (`jwt.js`). El host de Supabase con el project ref estuvo en dos docs y se sacó en
  junio: no es un secreto (sale en la URL pública de las imágenes).
- Nunca se commiteó un `.env`, `.pem`, `.key` ni credenciales; lo único borrado del historial con nombre
  sospechoso es `backend/node_modules/jsonwebtoken` (la librería). Trackeados: los tres `.env*.example`, solo
  con marcadores, y `supabase-ca.crt` (certificado público).
- `.gitignore`: ignora `.env`, `.env.local`, `.env.production` y `.env.lectura` (este, en `backend/`); los
  `.env` reales que hay en disco (backend, panel, barbero, turnero) están todos ignorados, igual que
  `.claude/settings.local.json` y `launch.json`. `.env.development` no lo ignora nadie salvo la landing (hoy no
  hay ninguno).
- La clave de age del workflow es la pública.

**Backup (`backup-db.yml` y `backup-db.sh`)**

- `permissions: contents: read`; disparadores `schedule` y `workflow_dispatch`, sin `pull_request` ni `push`;
  ninguna action de terceros (ni `checkout`): baja su script y la CA del mismo commit.
- Los secrets entran por `env:` del paso que los usa. `enmascarar_conexion` tapa usuario, contraseña, host y
  ref con `::add-mask::`; `curl -s` sin `-v` para el check-in; la respuesta de `put-object` va a `/dev/null`; sin
  `set -x` ni `upload-artifact`. Ningún paso imprime una URL ni un nombre de bucket.
- `pg_dump | age` en el mismo pipe, con `pipefail`: el dump en claro no toca el disco del runner. Se confirma el
  encabezado de age antes de subir. `PGSSLMODE=verify-full` con la CA de Supabase y `pg_dump` 17 por ruta
  completa.
- Si falla: el paso `if: failure() || cancelled()` manda el check-in `error`; si ni siquiera arrancó, Sentry
  Crons avisa por check-in perdido (margen de 90 min, duración máxima de 30). Cubre también que GitHub
  desactive el workflow a los 60 días.

**`resguardo_lectura` (consultado en el catálogo)**

- Atributos: `rolsuper`, `rolcreaterole`, `rolcreatedb` y `rolreplication` en `false`; `rolbypassrls = true`;
  `NOINHERIT`; sin membresías (ni `pg_read_server_files` ni `pg_read_all_stats`); límite de 3 conexiones.
- `public`: `SELECT` en las 23 relaciones, 0 con escritura, sin `CREATE`. Sin `USAGE` en `auth`, `storage`,
  `vault`, `realtime`, `graphql` ni `pgbouncer`. Lo que sobra (pg_net) está en Z7-03.

**Logs y Sentry**

- `beforeSend` (`instrument.js:104-126`) saca body, cookies, query string, `env` (la IP), `user` y breadcrumbs;
  deja solo tres headers (`x-tenant-subdomain`, `user-agent`, `content-type`); limpia la URL y la transacción
  (sin query string, con los tokens enmascarados) y reemplaza los objetos de `extra.arguments`. Si la limpieza
  falla, descarta el evento. `dataCollection` apaga todo de entrada, sin tracing y con `maxBreadcrumbs: 0`.
- Ningún `console.error` lleva datos de clientes en el texto. Los que no van en un `catch` son errores reales
  (`db.js:49` y `:174`, compensaciones de `caja.js:335`, `ventas.js:78`, `stock.js:44`, `storageService.js:62`),
  salvo el de plataforma (Z7-06).
- Tokens en los logs: el `token_gestion` y el del alta van enmascarados en la ruta (`enmascararTokensEnRuta`);
  el token de recuperación y la credencial nueva, en el body, tapados (`token`, `nueva`); el mail del dueño, tapado
  en el body y enmascarado en el mailer. PINs y contraseñas, tapados en el body en todos los logins.
- `/api/alta` está fuera del log de acceso. El endpoint de plataforma también, y loguea solo el subdominio.

**Proceso**

- El arranque fallido hace `console.error`, vacía Sentry y sale con 1 (`index.js:330-335`). Con Sentry cargado,
  una excepción no atrapada termina el proceso (Railway lo reinicia y avisa por el webhook), y una promesa
  rechazada sin `catch` se reporta y no lo tumba (`onUnhandledRejectionIntegration`, modo `warn`).
- Las compensaciones best-effort (`caja.js:330-336`, `ventas.js:77`, `stock.js:40-48`) tienen `await`; no hay
  promesas sueltas en caminos de escritura.
- Cron (`jobs/recordatorios.js`): `instrument.js` es el primer import; el `finally` cierra el pool, vacía Sentry
  y sale con el código que corresponde; `main` no puede rechazar.
- `/api/health` devuelve solo `{ status, timestamp }`, antes del tenant y del log de acceso. No consulta la DB
  (`testConnection` no corta el arranque si falla), así que una caída de Supabase no la ve UptimeRobot: la ve
  Sentry, por los `console.error` de cada pedido.
- `/api/plataforma/cache/invalidate`: clave por header, comparada en tiempo constante (SHA-256 +
  `timingSafeEqual`), y 503 sin la variable.

**Cabeceras y CORS**

- `helmet@8.3.0` con los defaults, primer middleware de la cadena, más `x-powered-by` apagado. Límites de body:
  100 kB para JSON y 1 MB para las imágenes, con 413 en JSON.
- CORS de producción: sin origen (curl, apps), `http://localhost:5173` y `*.barbermanager.app`; la rama de red
  local solo con `NODE_ENV !== 'production'`. Que acepte `localhost:5173` en producción no abre nada: la API no
  usa cookies (el token va por header), así que una página en ese origen solo puede leer lo que ya es público.
- Cabeceras reales (`curl`, 2026-11-17): `barbermanager.app/` 200 con HSTS; `demo.barbermanager.app/` 200 con
  `X-Robots-Tag: noindex`; `/barbero` 200 con `noindex` (`/barbero/` hace un 308 a `/barbero`); `/turnos` 200 sin
  `noindex` (correcto); `/turnos/gestionar/x` 200 sin `noindex` ni `Referrer-Policy` (Z7-08);
  `alta.barbermanager.app/` 200 con `noindex, nofollow`. Ninguna trae `X-Frame-Options`, CSP ni
  `Referrer-Policy`.
- Rewrites: `/turnos/*` y `/barbero/*` van a sus proyectos y los demás son el fallback de SPA. No exponen nada
  de más.

**Dependencias (`npm audit`, 2026-11-17; los seis tienen lock)**

- `backend`: runtime 4 (1 crítica, 2 altas, 1 moderada), todas transitivas. Solo `body-parser` pega en código
  que corre (Z7-04). `proxy-addr` (crítica, IP falsa con subredes de confianza IPv4 mapeadas): no aplica,
  `trust proxy` es un número de saltos y Express no pasa por la comparación de subredes. `ip-address` (alta, vía
  `express-rate-limit`): la usa para la máscara IPv6 de `req.ip`, que con `trust proxy` en 1 escribe el proxy de
  Railway, no el cliente. `qs` (moderada): Express 5 parsea el query con el parser simple, no hay `urlencoded` y
  `googleapis` solo serializa parámetros propios. Desarrollo: ninguna aparte.
- `frontend`: runtime 0; desarrollo 8 (7 altas, 1 moderada). `xlsx` sale del tarball de SheetJS 0.20.3 y
  `npm audit` no lo evalúa (como se anotó en julio).
- `frontend-barbero`, `frontend-turnero` y `frontend-alta`: runtime 0; desarrollo 9 cada uno (5 altas, 4
  moderadas).
- `frontend-landing`: runtime 0; desarrollo 11 (7 altas, 4 moderadas).
- Mantenimiento de las de runtime: todas publicaron en 2025-2026 salvo `browser-image-compression` (panel,
  última versión 2.0.2, de 2023). Sin riesgo real: comprime en el navegador las imágenes que elige el admin.

**Skills y lista `deny`**

- `deny` cubre las formas literales `railway <subcomando>` que escriben (con y sin argumentos) y el merge de PRs
  (`gh pr merge`, `gh api …pulls/…/merge`); el merge por GraphQL lo corta el proxy de la nube
  (`arreglo-prod/SKILL.md:17-18`) y el push a `main`, el ruleset. Las formas que no cubre están en Z7-02.
- `alta-cliente` corre solo en la PC, con el rol de solo lectura, y no escribe en la DB (`PREPARE`, no ejecuta).
  La parte de la skill de Z3-04 (no tratar los textos de la solicitud como instrucciones) entra en el punto 2
  del arreglo de Z7-02.

**Doc contra realidad (variables de entorno)**

- El código lee `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `NODE_ENV`, `PORT`,
  `TENANT_ID`, las cuatro `GOOGLE_*`, `RESEND_API_KEY`, `MAIL_FROM`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_DSN`, `ALTA_AVISO_EMAIL`, `PLATFORM_ADMIN_KEY`, `PUBLIC_BASE_URL` y
  `PANEL_BASE_URL`. Todas están en `estado_actual.md` → Deploy o en `backend/.env.example`, y no hay ninguna
  documentada que el código no use.

### Sin revisar

- La configuración de los dashboards: variables del cron de Railway (Z7-11), ciclo de vida y capacidades de la
  key de B2 (Z7-09), red del entorno `barberia-prod` de claude.ai/code (Z7-02) y si el monitor `backup-db` de
  Sentry ya tiene su aviso a Discord.
- El texto completo del aviso de `body-parser` (Z7-04) y las credenciales reales de `monte-sinai` y demo (Z7-01
  y Z7-10): no se compararon hashes.
- Las cabeceras de los dominios `*.vercel.app` de cada proyecto (no estaban en la lista permitida).

### Para otra zona

- **Z3-02 (orquestador):** el "sin confirmar" sobre cuánto frena una ráfaga Sentry tiene respuesta parcial: el
  SDK descarta un evento idéntico al anterior (`dedupeIntegration`, activado por defecto). Una ráfaga del mismo
  500 deja un evento; dos errores distintos intercalados pasan todos y sí gastan la cuota.
- **Zona 8:** el log de acceso escribe entero el body (hasta 100 kB) de cualquier `POST`, aun a rutas que no
  existen y antes del tenant: un anónimo puede inflar el volumen de logs de Railway con el límite global de 300
  por minuto. El keep-alive hace un `SELECT 1` cada 20 s, día y noche.
- **Docs:** `estado_actual.md` (tabla de Vercel y Pendientes) dice que `alta.barbermanager.app` está pendiente
  de crear, pero responde 200 con su `noindex`. `backend/.env.lectura.example` nombra
  `backend/scripts/consultar.js` y `conexionLectura.js`: están en `backend/src/scripts/`. El `.env` local del
  backend tiene `GMAIL_APP_PASSWORD`, que el código ya no usa: si la contraseña de aplicación de Gmail sigue
  activa, conviene revocarla.

---

## Zona 8. Rendimiento y consumo del backend

**Commit auditado:** `f986081` (`feature/mejoras-operativas`), 2026-11-17. Solo lectura: código, historial de git,
docs y la DB con el rol `resguardo_lectura` (catálogo, `pg_indexes`, `pg_stat_user_tables`,
`pg_stat_user_indexes`, conteos por tenant y `EXPLAIN` sin `ANALYZE`). No se hizo ningún request a producción ni
se levantó ningún servidor. Se midieron en local, aislados (sin base, sin red y sin servidor), tres cosas:
`bcrypt.compare`, una copia del cálculo de slots con datos inventados y la memoria de cargar las dependencias
del backend. Los scripts quedaron fuera del repo. Los milisegundos de CPU son de esta PC (8 núcleos, Node 24);
el vCPU de Railway puede ser más lento (ver "A medir").

**Segunda tanda de mediciones (pedida por el usuario, mismo día):** contra la base real, siempre con el rol
`resguardo_lectura` (cualquier escritura falla) y sin servidor: abrir una conexión contra hacer una query, los
handlers `GET` reales de las pantallas diarias contra el tenant demo (`req`/`res` simulados, contando queries y
conexiones), y el costo en Postgres de los filtros sin índice. Detalle en "Mediciones".

**Tercera tanda, en producción (autorizada por el usuario, mismo día):** la región del servicio web la pasó el
usuario (US West, California). Se leyeron los logs HTTP del borde de Railway (`railway logs --http`, solo
lectura, como la skill `salud-prod`): la duración real del backend en cada request de los últimos días, sin
copiar IPs, user agents ni cuerpos. Y se hicieron 6 rondas de `GET` públicos al turnero de demo, con 70 s de
espera entre rondas. Por último, con autorización del usuario, una reserva de prueba en demo (y su
cancelación) para medir Google Calendar. Con esto, "A medir" quedó vacío.

**Contexto (métricas de Railway de los últimos 30 días, las pasó el usuario):** costo total de $ 1,47, casi todo
memoria ($ 1,46, unos 146 MB en promedio); CPU $ 0,001 y red de salida $ 0,003 (0,05 GB). Hoy ni la CPU, ni la
memoria, ni la red pesan en la factura: la severidad sale de la espera que ve el usuario y de lo que crece.

**Cómo leer los costos:** casi todo el tiempo de un request se va en viajes a la base (Railway en EE. UU. →
Supabase en `us-west-2`). Este documento los cuenta en **viajes** (el tiempo de un `SELECT 1` sobre una
conexión abierta). Con un pool de 3 conexiones, un `Promise.all` de 7 queries son 3 tandas, no una. Para pasar
a milisegundos: viajes × 30 ms, lo que dura un viaje desde Railway a la base, medido en producción (ver
"Mediciones").

**Resumen:** 8 hallazgos (0 críticos, 1 alto, 5 medios, 2 bajos), nada pendiente de medir. Nada deja hoy a un local sin operar: ningún camino retiene una conexión del
pool mientras espera a Google o al mail, y el `statement_timeout` de 5 s sigue puesto. Lo que más pesa hoy, medido
en producción, es Z8-01: el 98 % de los pedidos paga antes un preflight de CORS, un viaje entero del celular a
California (~230 ms desde Argentina), y se arregla con una línea. Después, Z8-02: cada pantalla que pide en
paralelo abre conexiones nuevas cuando el backend estuvo quieto 30 s (de 150 a 270 ms más, con el viaje de
~30 ms a la base medido en producción). Lo que más va a pesar cuando un local use el turnero es Z8-06 (CPU
del cálculo de días). Todos están en producción salvo el refresco de la Agenda cada 30 s (Z8-04), que está
solo en el branch.

**Revisión del orquestador (2026-11-17):** Z8-01 se confirmó en el código: el `cors(...)` de `index.js` no
fija `maxAge`. De los demás se revisaron Z8-02 (`idleTimeoutMillis: 30000` y un solo `SELECT 1` periódico en
`config/db.js`), Z8-06 (`.plus()` de luxon dentro del bucle de slots de `disponibilidadService.js`; el CHECK de
`tenant.duracion_slot_minutos` acepta de 1 a 240) y Z8-08 (`googleapis` entero importado en
`googleCalendar.js`). No se sacó ninguno ni cambió ninguna severidad. Z8-06 queda en medio porque hoy ningún
local usa el turnero propio; sube a alto cuando un local con varios barberos llene la agenda por ahí, porque
con el límite global por IP un solo cliente alcanza a frenar el backend de todos los locales.

**Excepción a las reglas de la zona:** el ejecutor midió contra producción con autorización del usuario en su
chat (logs de Railway, pedidos públicos al turnero de demo y una reserva de prueba en demo, ya cancelada).
Quedan en demo el turno cancelado y el cliente "Prueba auditoría Z8" (1 y 1, consultado): borrarlos cuando el
usuario quiera.

### Mediciones

**Abrir una conexión** (`pg` con el mismo SSL que el backend, 5 conexiones y 40 `SELECT 1`, dos corridas): desde
esta PC un viaje dura de 235 a 306 ms (Argentina → Oregón). Abrir una conexión (TCP, SSL, login SCRAM contra el
pooler y el `SET statement_timeout` de `onConnect`) cuesta **7 a 7,7 viajes**. La proporción depende de la
cantidad de idas y vueltas del protocolo, no de la distancia, así que vale igual desde Railway.

**Pantallas diarias** (handlers reales, tenant demo, tres corridas, mediana). "Frío" es como queda el backend
después de 30 s sin uso: una conexión abierta (la del keep-alive). "Caliente", con las tres abiertas. Las
queries en frío incluyen los `SET` de las conexiones nuevas.

| Pantalla | Queries | Conexiones nuevas en frío | Viajes en caliente | Viajes en frío |
|---|---|---|---|---|
| Inicio del panel (3 pedidos a la vez) | 11 | 2 | 4,1 | 13 |
| Caja del día | 4 | 2 | 1,8 | 8,3 |
| Agenda del barbero (con `verificarToken`) | 10 | 2 | 4,0 | 8,8 |
| Landing del turnero (`/tenant`) | 3 | 1 | 2,0 | 9,6 |
| Días con lugar, "Cualquier barbero" | 8 | 2 | 5,0 | 10,7 |
| Días con lugar, un barbero | 7 | 2 | 3,2 | 11,5 |
| Horarios del día, "Cualquier barbero" | 8 | 2 | 4,1 | 9,7 |

Pasado a milisegundos de Railway, el Inicio en frío son 13 viajes: 260 ms si un viaje dura 20 ms, 910 ms si
dura 70. En caliente, 80 y 290. La agenda de demo está casi vacía, así que en los días con lugar la CPU no pesa
(el peor caso de CPU está en Z8-06).

**Filtros por fecha en Postgres** (la consulta corrida 200 veces dentro de una sola sentencia, para que el
tiempo del servidor supere al ruido de la red; tres corridas sobre los 3.311 cortes de la tabla):

| Filtro | Hoy, por query | Por fila | Con 50.000 filas | Con 100.000 | Con 300.000 |
|---|---|---|---|---|---|
| Día, `DATE(timestamp AT TIME ZONE …) = …` | ~2 ms | ~0,6 µs | ~30 ms | ~60 ms | ~175 ms |
| Mes, `TO_CHAR(… 'YYYY-MM') = …` | ~4,4 ms | ~1,3 µs | ~65 ms | ~130 ms | ~400 ms |
| Día por rango sobre la columna (usa `idx_corte_timestamp`) | ~0 ms | — | ~0 | ~0 | ~0 |

Las proyecciones son lineales: el recorrido es completo y crece igual que la tabla. Con el tenant demo
(5 % de las filas) Postgres usa el índice por `tenant_id` y lee solo sus 173 cortes; el recorrido completo lo
paga el local grande. Por eso se midió sobre la tabla entera, sin filtrar por tenant y sin leer datos de ningún
local.

**En producción.** Región del servicio web: US West, California (`us-west2`, confirmada por el campo
`edgeRegion` de los logs). Del log HTTP del borde de Railway, el tiempo del backend (`upstreamRqDuration`) del
deployment vigente (13 al 17/11, 1.415 pedidos, 1.041 de ellos del monitor a `/api/health`):

| Pedido | Cantidad | Mediana | p90 |
|---|---|---|---|
| `GET /api/barberos` (y servicios, productos, categorías: 1 query) | 23 a 25 c/u | 32-43 ms | 219-276 ms |
| `GET /api/turnos` (iPad, turnos del día) | 32 | 91 ms | 118 ms |
| `POST /api/cortes` (cobrar en el iPad) | 26 | 180 ms | 242 ms |
| `GET /api/inicio/resumen-dia` | 15 | 222 ms | 480 ms |
| `GET /api/inicio/comparativo-mes` | 15 | 254 ms | 484 ms |
| `GET /api/caja/movimientos-dia` | 4 | 216 ms | 487 ms |
| `GET /api/admin/planilla` | 19 | 88 ms | 226 ms |
| `POST /api/auth/panel/login` | 17 | 130 ms | 513 ms |
| `GET /api/turnero/tenant` (landing) | 9 | 301 ms | 380 ms |
| `GET /api/turnero/dias-disponibles` | 3 | 108 ms | 134 ms |
| `POST /api/turnero/turnos` (reserva, sin Calendar) | 1 | 428 ms | — |
| `OPTIONS` (preflight de CORS, todas las rutas) | 365 | 2 ms | 3 ms |

Cómo se lee:
- **Un viaje desde Railway a la base dura ~30 ms.** Es lo que tarda un endpoint de una sola query con la
  conexión abierta (las medianas de 32 a 43 ms). Con eso, todos los "viajes" de esta sección se pasan a
  milisegundos multiplicando por 30.
- **Abrir conexión se ve en el p90:** esos mismos endpoints de una query llegan a 219-276 ms cuando les toca una
  conexión nueva (7,5 viajes, como se midió desde acá).
- **El CPU de Railway es parecido al de esta PC:** el login del barbero por su app (1 comparación `bcrypt` y
  una query) tarda 88 ms, y el p90 del login del panel (513 ms) es el de un barbero de kingsaistudio, con 5
  comparaciones. Unos 55 a 90 ms por comparación, contra 65 acá.
- **Preflights:** 365 `OPTIONS` para unos 374 pedidos a la API (Z8-01).

Rondas en vivo contra el turnero de demo (`GET` públicos, sin login; 70 s de espera entre rondas para que el
pool vuelva a una conexión; el tiempo del backend sale de restar `/api/health`, pedido justo antes por la misma
conexión HTTP). El viaje desde esta PC hasta Railway fue de 226 a 307 ms.

| Pedido | En frío | En caliente |
|---|---|---|
| Landing (`/api/turnero/tenant`) | 204-243 ms | 52-109 ms |
| Días con lugar, "Cualquier barbero" | 186-390 ms | 67-235 ms |

**Reserva de prueba con Calendar** (autorizada por el usuario). En demo, con el único barbero activo con mail
(así pasa por Google Calendar), un horario libre del 20/11, el nombre "Prueba auditoría Z8", un teléfono
ficticio y la casilla de prueba de Resend (`delivered@resend.dev`, que simula la entrega sin mandarle nada a
nadie ni dañar la reputación del dominio). Se canceló a los 5 s con el token que devolvió la reserva (lo mismo
que hace el link del mail). Los logs muestran los pasos completos (evento creado, mail, evento borrado, mail
de cancelación) y ningún error.

| Pedido | Backend (log del borde) | Cliente, desde Argentina |
|---|---|---|
| Reserva, con Calendar | 1.021 ms | 1.342 ms |
| Reserva, sin Calendar (la del 16/11, de los logs) | 428 ms | — |
| Cancelación, con Calendar | 616 ms | 944 ms |

Quedó en demo: el turno en estado `cancelado` (origen `auditoria`) y su cliente "Prueba auditoría Z8". El evento
de Google se borró, y el barbero de demo recibió el aviso de cancelación de Calendar.

Con días con lugar las rondas se pisan: el ruido de la red desde acá (±80 ms) es del tamaño de la diferencia. La
landing, que en frío abre una sola conexión, la muestra limpia: unos 160 ms más en frío.

### Hallazgos

#### Z8-01 [ALTO] Casi cada pedido de los fronts paga antes un viaje extra al backend (el preflight de CORS), porque la API no deja que el navegador lo recuerde

- **Dónde:** `backend/src/index.js:84-100` (`cors({ origin, credentials })`, sin `maxAge`). Los cuatro fronts mandan
  `X-Tenant-Subdomain` en todos los pedidos (y `Authorization` y `Content-Type: application/json` los que
  corresponden): con esos headers el navegador no puede mandar el pedido directo y antes pregunta con un
  `OPTIONS` si el backend lo permite.
- **Alcance:** en producción.
- **Costo:** tiempo de espera del usuario en **cada** pedido de todas las pantallas: el iPad, el panel, la app del
  barbero y el turnero. El navegador guarda la respuesta del `OPTIONS` solo el tiempo que diga
  `Access-Control-Max-Age`; como el backend no lo manda, la guarda 5 segundos (el valor por defecto) y casi
  todo pedido vuelve a preguntar. En los logs del borde de Railway de los últimos 4 días hubo **365 `OPTIONS`
  contra unos 374 pedidos a la API** (sin contar el `/api/health` del monitor): el 98 %. El `OPTIONS` en sí lo
  contesta el backend en 2 ms, pero es un viaje entero celular → Railway (California) → celular antes del
  pedido real. Medido desde esta PC (Argentina), ese viaje son ~230 ms; desde el wifi de un local o un celular
  con 4G, parecido o más. Los pedidos que salen juntos (los 3 del Inicio) pagan sus preflights en paralelo:
  uno por tanda de pedidos del front. Es probablemente lo que más espera agrega hoy: más que todo el trabajo
  del backend en la mayoría de las pantallas (el Inicio tarda ~250 ms en el backend).
- **Evidencia:** consultado en los logs HTTP de Railway (`railway logs --http`, conteo por método y ruta) y leído
  (`cors` 2.8.6: `Access-Control-Max-Age` solo sale si se pasa `maxAge`). Viaje desde acá, medido contra
  `/api/health` en producción.
- **Arreglo propuesto** (chico). Opciones:
  1. **`maxAge: 7200`** en `cors(...)`: cada navegador lo recorta a su tope (Chrome 2 horas, Safari 10 minutos,
     Firefox 24 horas). Ojo: el navegador guarda el permiso **por URL**, así que una URL con otra fecha o
     barbero en el query string vuelve a preguntar la primera vez; igual saca la gran mayoría (los pedidos
     repetidos del iPad, el panel y el refresco de la Agenda). Riesgo: si se cambia la política de CORS
     (orígenes o headers permitidos), los navegadores que ya la guardaron tardan hasta ese tope en enterarse.
     Es la recomendada.
  2. Servir la API desde el mismo dominio de cada front (un rewrite de `/api` en Vercel hacia Railway): sin
     orígenes cruzados no hay preflight nunca. Riesgo y tamaño: medio; suma un salto por Vercel en cada pedido
     y cambia la configuración de los cuatro fronts. Solo si después de 1 sigue pesando.
- **Novedad:** nuevo.

#### Z8-02 [MEDIO] El keep-alive mantiene caliente una sola de las 3 conexiones: cada pantalla que pide en paralelo abre conexiones nuevas después de 30 s sin uso

- **Dónde:** `backend/src/config/db.js:61` (`idleTimeoutMillis: 30000`), `:198-209` (`iniciarKeepAlive`, un
  `SELECT 1` cada 20 s), `:45-51` (`onConnect`: un `SET statement_timeout` por conexión nueva);
  `backend/node_modules/pg-pool/index.js:157-167` (toma la conexión ociosa más reciente y, si no hay, abre una
  nueva hasta llegar a 3).
- **Alcance:** en producción.
- **Costo:** el `SELECT 1` del keep-alive toma siempre la última conexión liberada, así que esa es la única que
  sobrevive. Las otras dos se cierran a los 30 s de su último uso. Entonces, cada pantalla que larga varias
  queries a la vez después de 30 s sin tráfico (el caso normal en un local: el dueño abre el panel, el barbero
  abre la Agenda, un cliente entra al turnero) usa la conexión caliente para la primera y **abre dos conexiones
  nuevas** para las otras. Abrir una conexión son unos 6 a 8 viajes antes de la primera query: TCP, el pedido
  de SSL de Postgres, el saludo TLS, el inicio de sesión con SCRAM contra el pooler y el `SET` de `onConnect`.
  Las pantallas afectadas son las que piden en paralelo: el Inicio y la Caja del panel, la Agenda del barbero,
  y la disponibilidad y la landing del turnero. Un local normal las abre decenas de veces por día, y casi
  siempre después de un rato quieto. Con la Agenda refrescándose cada 30 s (Z8-04), el refresco cae justo
  cuando vencen las dos conexiones frías, así que puede abrirlas en casi cada vuelta.
- **Evidencia:** leído (`db.js` → `pg-pool` 3.13.0, `_pulseQueue`: `this._idle.pop()` y `newClient` mientras no
  esté lleno) y **medido** (ver "Mediciones"): abrir una conexión cuesta 7 a 7,7 viajes, y las seis pantallas
  medidas abren 1 o 2 conexiones en frío y tardan de 2 a 5 veces lo que en caliente (el Inicio, 13 viajes
  contra 4,1; la Caja, 8,3 contra 1,8). **En producción** un viaje desde Railway dura ~30 ms (ver "Mediciones",
  en producción), así que el frío le suma de 150 a 270 ms a cada pantalla. Se ve en los logs: los endpoints de
  una sola query tardan ~32 ms en mediana y 250 a 360 ms en el p90, que son las cargas que abrieron conexión; y
  la landing del turnero de demo, medida en rondas con 70 s de espera, tarda 232-243 ms en frío contra 52-74 en
  caliente. Queda en medio: el umbral que se había puesto para subirlo era un viaje de 40 ms o más.
- **Arreglo propuesto** (chico o medio, según la opción). Opciones:
  1. **Menos queries en paralelo en las pantallas calientes** (Z8-03, Z8-04): una pantalla que hace una o dos
     queries no necesita las conexiones frías. Ataca la causa y además ahorra viajes. Es la recomendada.
  2. **Que el keep-alive mantenga las 3** (tres `SELECT 1` a la vez en cada tick). Riesgo: deja las 3
     conexiones tomadas en el pooler todo el día; hay que confirmar que el cupo de conexiones del plan gratuito
     alcanza para el cron, el backup y `consultar.js`.
  3. Subir `idleTimeoutMillis`. Riesgo: el pooler corta conexiones ociosas por su cuenta (es el error del pool
     que ya llega a Sentry, `estado_actual.md` → Pendientes), así que una conexión vieja fallaría y la salvaría
     el reintento de `query()`, pagando el viaje igual.

  Recomendado: 1, y medir antes y después (A medir, 1) para decidir si además hace falta 2.
- **Novedad:** corrige el diagnóstico de `performance_frontends.md` y del comentario de `iniciarKeepAlive`
  (`db.js:180-185`): el keep-alive evita la conexión fría de la primera query, no la de las que van en
  paralelo. Se cruza con el pendiente "Validar en prod las optimizaciones de backend" de `estado_actual.md`.

#### Z8-03 [MEDIO] El Inicio del panel hace 11 queries en tres pedidos, con tres tandas en serie, cada vez que se abre

- **Dónde:** `backend/src/controllers/inicio.js:17-74` (`getResumenDia`: 6 queries en tres `Promise.all` de a
  dos, uno detrás de otro), `:100-138` (`getComparativoMes`: 4 queries en dos tandas), `:178` (`getStockBajo`:
  1); `frontend/src/screens/admin/sections/SeccionInicio.jsx:436` (los tres pedidos a la vez al montar).
  `GET /api/inicio/*`, primera pantalla del panel del dueño (`PanelAdmin.jsx:330`).
- **Alcance:** en producción.
- **Costo:** 11 queries por cada vez que el dueño entra al panel. Llegan juntas a un pool de 3: arrancan 5, entran
  3 y el resto espera. El camino más largo (`getResumenDia`) son 3 tandas en serie, más la espera por el pool:
  unos 4 o 5 viajes de punta a punta, más las dos conexiones frías de Z8-02. Las 10 queries de cortes y ventas
  filtran con `DATE(timestamp AT TIME ZONE …)` o `DATE_TRUNC`, que recorren la tabla entera (Z8-07). Pasa cada
  vez que el dueño abre el panel o vuelve al Inicio: varias veces por día por local.
- **Evidencia:** leído (front → `apiFetch` → `inicio.js`) y medido con los handlers reales contra demo: 11
  queries, 4,1 viajes en caliente y 13 en frío (ver "Mediciones"). En producción, `resumen-dia` tarda en el
  backend 209 a 307 ms de mediana y 342 a 480 ms de p90 según la semana (607 de máximo), y `comparativo-mes`, 254
  y 484: la pantalla espera al más lento. `EXPLAIN` de la query de cortes del día en
  kingsaistudio: `Seq Scan on corte`, costo 197; hoy cada una de esas queries cuesta de 2 a 4 ms en Postgres.
- **Arreglo propuesto** (medio, un archivo): `getResumenDia` en una sola query por tabla con `FILTER` (día,
  semana y mes en la misma pasada) o una sola query con dos subconsultas, y lo mismo para `getComparativoMes`.
  El Inicio queda en 3 queries, una tanda. En el mismo cambio, filtros por rango (Z8-07). Riesgo: es la misma
  query que tienen que corregir Z4-03 (el "facturado" del Inicio contra Balances) y Z4-06 (el rótulo del
  comparativo de 21 a 24 hs): conviene hacer los tres juntos, con pruebas que comparen los números de antes y
  de después en demo.
- **Novedad:** confirma la nota de la zona 4 (que contó 6 y 4 queries) y suma el costo de la espera por el pool.

#### Z8-04 [MEDIO] La Agenda del barbero son 10 queries por carga, 4 tandas en serie, y desde F1b se recarga sola cada 30 s

- **Dónde:** `backend/src/middlewares/authMiddleware.js:109-118` (la query del barbero, en cada request de ese
  rol), `backend/src/controllers/agenda.js:49` y `:53-58` (cuatro funciones en paralelo),
  `backend/src/services/disponibilidadService.js:219-270` (`cargarDatosAgenda`: 6 queries sin servicio);
  `frontend-barbero/src/components/Agenda.jsx:67` y `:235-260` (refresco cada 30 s y al volver al primer plano).
  `GET /api/admin/agenda`.
- **Alcance:** la carga de 10 queries, en producción. El refresco automático, solo en el branch (F1b,
  `35a23f5`; en `main` la Agenda no tiene `setInterval` de recarga).
- **Costo:** para un barbero, 1 query de revocación en `verificarToken` (en serie, antes de todo) y después 9 en
  paralelo: `listarTurnos`, `listarSuspensiones`, `listarBloquesDescanso` y las 6 de `calcularGrillaDelDia`
  (tenant, horario del barbero, turnos, suspensiones, horario del local y feriados). Con el pool de 3: 4 tandas
  en serie. Para el admin, la misma cuenta con `barberoActivoEnTenant` en vez de la revocación. Los turnos y las
  suspensiones del día se leen dos veces (una para la lista y otra para la grilla), y el horario del local, los
  feriados y la duración del slot, que casi no cambian, se leen en cada carga. Con el refresco, cada celular con
  la Agenda a la vista hace 120 cargas por hora: 1.200 queries por hora. Con 5 barberos mirándola, una carga
  cada 6 s en promedio, cada una ocupando las 3 conexiones durante sus tandas (y abriendo conexiones según
  Z8-02). No agota el pool, pero cada refresco compite con los cobros del iPad. Hoy la app del barbero casi no se
  usa; con el login de F5, se espera que empiece.
- **Evidencia:** leído (`Agenda.jsx` → `api.js` → `agenda.js` → servicios) y medido con `verificarToken` y
  `getAgenda` reales contra demo, como barbero: 10 queries, 4,0 viajes en caliente y 8,8 en frío. En producción
  (11 cargas entre el 6 y el 13/11, sin el refresco): 132 a 153 ms de mediana, 265 de máximo.
- **Arreglo propuesto** (medio). Por orden de efecto:
  1. Que la grilla y las listas salgan de la misma lectura: `cargarDatosAgenda` ya trae turnos y suspensiones;
     sumarle lo que les falta (todos los estados de turno, el detalle de la suspensión) y dejar de leerlos
     aparte. Bajaría a unas 6 queries. Riesgo: `listarTurnos` es la forma que comparten la Agenda y
     `GET /api/admin/turnos`; hay que cuidar que la respuesta no cambie.
  2. Refresco más espaciado (60 s) o solo al volver al primer plano y después de una acción. Riesgo: un turno
     que entra por el turnero tarda más en aparecer.
  3. Caché corto de `token_version` y `activo` por barbero, invalidado en `editarBarbero` (el mismo patrón que el
     caché del tenant). Ahorra 1 viaje en serie por request. Riesgo: un cambio hecho por SQL directo no corta la
     sesión hasta reiniciar el servicio (lo mismo que ya pasa con el caché del tenant, aceptado). No se
     recomienda si 1 y 2 alcanzan.

  Recomendado: 1 y 2.
- **Novedad:** nuevo. El comentario de `authMiddleware.js:106-108` ya preveía cachear la revocación "si algún día
  pesa"; el refresco de F1b es lo que la hace pesar.

#### Z8-05 [MEDIO] Reservar, reprogramar y cancelar esperan a Google Calendar y al mail antes de responder; las cascadas, turno por turno

- **Dónde:** `backend/src/controllers/turnero.js:331-391` (`crearTurno`), `:472-530` (`cancelarTurno`),
  `:559-673` (`reprogramarTurno`); `backend/src/controllers/turnos.js:156-234` (`crearTurnoAdmin`, panel y app del
  barbero); las cascadas en `services/feriadosService.js:90-113`, `services/horarioAtencionService.js:235-258` y
  `services/suspensionesService.js:131-138`; `services/googleCalendar.js:95`, `:126`, `:160` (las llamadas a
  Google, sin timeout propio) y `services/mail/resendProvider.js:11` (Resend, 15 s de timeout).
- **Alcance:** en producción (el mismo `await` está en `main`; el branch sumó el turno "Sin datos" en
  `crearTurnoAdmin`).
- **Costo:** el cliente que reserva espera, en serie: 4 validaciones independientes entre sí (duración del
  servicio, barbero activo, horario del local y feriado, una query cada una), el upsert del cliente, el
  `INSERT`, la lectura del turno completo (7 viajes), y después la llamada a Google Calendar (si el barbero
  tiene mail; la primera de cada hora además renueva el token de Google), el `UPDATE` del id del evento y el
  envío por Resend. Recién ahí ve "Turno confirmado". Lo mismo pasa al reprogramar y al cancelar desde el link
  del mail, y al crear un turno desde el panel o la app del barbero. Si Google se cuelga, la reserva queda
  esperando sin límite: la librería no tiene timeout configurado. Las cascadas (feriado, horario del local,
  ausencia de un barbero) hacen, por cada turno afectado y uno detrás de otro, `UPDATE`, Calendar y mail, dentro
  del mismo request: con 20 turnos son 20 veces la suma, con el dueño mirando "Procesando…". La reserva es una
  acción frecuente cuando un local usa el turnero (hoy ninguno tiene turnos propios: kingsaistudio tiene 1); las
  cascadas son raras.
- **Evidencia:** leído (`turnero.js` → `turnosService.js` → `googleCalendar.js` y `mailer.js` →
  `resendProvider.js`) y medido en producción: la única reserva del turnero en los logs que guarda Railway (demo,
  16/11, barbero sin mail, así que sin Calendar) tardó **428 ms** en el backend. Las 7 queries en serie son unos
  210 ms (7 viajes de ~30 ms); el resto, **~200 ms, es el envío por Resend**, que el cliente espera de más.
  Con Calendar, medido con una reserva de prueba en demo (autorizada por el usuario; ver "Mediciones"): la
  reserva tardó **1.021 ms** en el backend, así que **Google Calendar le suma ~590 ms** (crear el evento, guardar
  su id y, probablemente, renovar el token de Google). La cancelación desde el link tardó 616 ms, de los que
  Calendar (borrar el evento) son unos 300 y el mail unos 200. Del lado del cliente, desde Argentina, la reserva
  tardó 1,3 s. Hoy ningún barbero de un local real tiene mail cargado, así que Calendar no corre; cuando un local
  lo active, cada reserva pasa a esperar un segundo.
- **Arreglo propuesto** (medio):
  1. Responder apenas el turno queda insertado y correr Calendar y el mail después de `res.json`, con su propio
     `catch` (ya son best-effort: hoy un fallo tampoco le llega al cliente). En las cascadas, lo mismo, o las
     llamadas de cada turno en paralelo con un tope. Riesgo: si el proceso se reinicia (un deploy) entre la
     respuesta y el envío, ese mail se pierde; hoy se pierde igual si Resend falla. Las pruebas que miren el
     orden de los logs tienen que ajustarse.
  2. Las 4 validaciones en un `Promise.all` (o una sola query): 4 viajes pasan a 2 tandas, o a 1.
  3. Un timeout para las llamadas a Google (la librería lo acepta por llamada).

  Recomendado: los tres.
- **Novedad:** nuevo. Incluye la nota de la zona 5 sobre las cascadas: confirmada, con el mismo arreglo.

#### Z8-06 [MEDIO] El cálculo de días con lugar usa luxon dentro del bucle: con la agenda llena, 165 ms de CPU que frenan todo el backend; con slots de 1 a 5 minutos, segundos

- **Dónde:** `backend/src/services/disponibilidadService.js:77-115` (`computarSlotsDeUnDia`: dos `plus()` y
  comparaciones de `DateTime` por slot), `:426-446` (`calcularDias`: 15 días por barbero); `routes/turnero.js:26`
  (`GET /api/turnero/dias-disponibles`, sin límite propio). Lo usan también `/disponibilidad` y la grilla de la
  Agenda, con un solo día.
- **Alcance:** en producción.
- **Costo:** CPU del proceso, que en Node es uno solo: mientras corre el cálculo, no se atiende ningún otro
  request de ningún local. El costo depende de cuántos slots revisa antes de encontrar uno libre en cada día.
  Con días libres corta en el primero y es casi nada; con días llenos revisa todos. Medido en esta PC, con una
  copia del cálculo y la agenda llena los 15 días, de 9 a 21, con servicios de 30 minutos:

  | Caso | Hoy (luxon) | Con números |
  |---|---|---|
  | 1 barbero, slot de 30 min | 27 ms | 1 ms |
  | "Cualquier barbero" con 6 barberos, slot de 30 | 163 ms | 8 ms |
  | 6 barberos, slot de 15 | 334 ms | 11 ms |
  | 6 barberos, slot de 5 | 911 ms | 22 ms |
  | 6 barberos, slot de 1 | 4,6 s | 46 ms |

  Se dispara cada vez que un cliente elige servicio y barbero en el turnero. Un local con los sábados llenos o
  una semana cargada paga una parte de esos números en cada visita. Y como el endpoint solo tiene el límite
  global (300 por minuto por IP), con 6 barberos y la agenda llena un solo cliente automatizado puede pedir 49 s
  de CPU por minuto. El tiempo casi entero es luxon: con la lista de turnos separada por día baja poco (139 ms
  en el caso de 163); con milisegundos (números) dentro del bucle baja 20 veces.
- **Evidencia:** leído, y medido en local con una copia del algoritmo y datos inventados (sin base ni red).
  Medido en esta PC; el CPU de Railway resultó parecido (los logins de producción dan unos 55 a 90 ms por
  comparación `bcrypt`, contra 65 acá), así que los números valen. Una agenda llena 15 días seguidos es el peor
  caso.
  La parte de base, medida con el handler real contra demo: "Cualquier barbero" son 8 queries y 5 viajes en
  caliente (10,7 en frío), y no crece con los barberos ni con los días.
- **Arreglo propuesto** (medio): hacer la aritmética del bucle en milisegundos (`toMillis()` del inicio y fin de
  cada bloque, de los turnos y de las suspensiones, una vez), y crear el `DateTime` solo para los slots que se
  devuelven. Sumarle el piso de `duracion_slot_minutos` que propone la zona 5 y el límite propio para los `GET`
  de disponibilidad de la zona 3. Riesgo: es la función que decide qué horarios se ofrecen; un error de un
  minuto ofrece un horario ocupado. Hace falta una prueba que compare la versión vieja y la nueva con muchos
  casos al azar antes de cambiarla. La disponibilidad sigue sin caché (regla del proyecto).
- **Novedad:** nuevo. Confirma con números las notas de la zona 5 (`duracion_slot_minutos` desde 1) y de la zona 3
  (los `GET` de disponibilidad sin límite propio), y las agrava: el costo no son solo las queries contra el pool,
  es CPU que frena al resto de los locales.

#### Z8-07 [BAJO] Los filtros por día y por mes recorren la tabla entera de todos los locales: 43 lugares del backend

- **Dónde:** 43 filtros con `DATE(x AT TIME ZONE …)`, `TO_CHAR(x AT TIME ZONE …, 'YYYY-MM') = $n` o
  `DATE_TRUNC('month', x AT TIME ZONE …)` sobre `corte.timestamp`, `venta.timestamp`, `gasto.timestamp`,
  `movimiento_extra.timestamp` y `turno.inicio` (fuera de los scripts). Los más usados: el Inicio (Z8-03), la
  Caja del día (`caja.js:65`, `:85`, `:105`, `:131`), Planillas (`planillaService.js:79`, `:165`, `:299`),
  Balances (`balances.js:148-203`, `:362-403`), Ventas y Gastos del mes, y `listarTurnos` por fecha
  (`turnosService.js`, usado por la Agenda y el Turnero del panel).
- **Alcance:** en producción.
- **Costo:** Postgres no puede usar un índice para una condición sobre una expresión, así que cada una de esas
  queries lee la tabla completa, con las filas de todos los locales, y filtra. Hoy es barato: `corte` tiene 3.311
  filas (1,3 MB en total) y desde el último reseteo de estadísticas (2025-12-08) hubo 17.751 lecturas completas,
  de 1.595 filas en promedio. Crece con la historia de todos los locales: kingsaistudio suma unos 400 cortes por
  mes (~5.000 por año), y `turno` va a crecer igual cuando un local use el turnero. Medido: hoy un filtro por
  día cuesta ~2 ms y uno por mes con `TO_CHAR`, ~4,4 ms; con 100.000 filas (unos 10 locales como Kingsai
  durante dos años), ~60 y ~130 ms por query, en pantallas que hacen 4 (Caja) o 10 (Inicio) y en Balances,
  que hace varias por mes.
- **Evidencia:** consultado y medido en la DB (ver "Mediciones"). `EXPLAIN` de los cortes del día con el filtro
  actual: `Seq Scan on corte`, costo 197. La misma consulta con `timestamp >= … AND timestamp < …`: `Index Scan
  using idx_corte_timestamp`, costo 2,5, y ~0 ms medido.
- **Arreglo propuesto** (grande por la cantidad de lugares, mecánico): pasar los filtros a rangos sobre la columna
  (`timestamp >= (fecha::timestamp AT TIME ZONE tz) AND timestamp < ((fecha + 1)::timestamp AT TIME ZONE tz)`) y
  sumar índices `(tenant_id, timestamp)` en `corte`, `venta`, `gasto` y `movimiento_extra`, y `(tenant_id,
  inicio)` sin filtro de estado en `turno`. Riesgo: el borde de medianoche en hora argentina; los mismos filtros
  tienen el problema de rótulo de Z4-06. Conviene hacerlo con pruebas por día y por mes, empezando por el Inicio
  y la Caja, y dejar el resto para cuando las tablas crezcan.
- **Novedad:** confirma y amplía la nota de la zona 4 (los `TO_CHAR` de Balances, Ventas y Gastos).

#### Z8-08 [BAJO] `googleapis` entero ocupa unos 100 MB, dos tercios de la memoria del backend en reposo, para usar solo Calendar

- **Dónde:** `backend/src/services/googleCalendar.js:7` (`import { google } from 'googleapis'`, la librería con
  todas las APIs de Google); `backend/package.json` (`googleapis` ^171.4.0). El cron la carga sin usarla:
  `recordatoriosService.js:17` importa `construirLinkGestion` de `turnosService.js`, que importa
  `googleCalendar.js` (`turnosService.js:10`).
- **Alcance:** en producción.
- **Costo:** memoria, que es lo único que Railway cobra hoy. Medido en local cargando las mismas dependencias
  que el backend (express, pg, luxon, bcrypt): 54 MB de RSS sin `googleapis` y 162 MB con ella (108 MB más; el
  heap pasa de 9 a 65 MB). El backend en reposo usa unos 140 MB, así que esta librería es la mayor parte.
  `@sentry/node` con su `init` suma 35 MB más (157 → 193 MB), lo que coincide con el salto de 140 a 170-200 MB
  que se vio en Railway después del deploy del monitoreo.
- **Evidencia:** leído y medido en local (`process.memoryUsage()` después de cargar los módulos, dos corridas de
  cada uno, sin red). En Railway corre Node 22 (acá, 24): los números pueden variar un poco.
- **Arreglo propuesto** (chico): reemplazar `googleapis` por `@googleapis/calendar` (el paquete de una sola API,
  con la misma forma de uso: `calendar({ version: 'v3', auth })`) más `google-auth-library` para el OAuth, y
  mover `construirLinkGestion` a `utils/` para que el cron no cargue Calendar. Ahorro esperado: unos 100 MB y
  cerca de $ 0,90 por mes (no sube la severidad). Riesgo bajo: `googleCalendar.js` es el único que importa la
  librería (además del script `probarGoogleCalendar.js`), y se prueba con ese script. Hay que instalar una
  dependencia nueva: va con el arreglo, no en esta auditoría. Medir la memoria antes y después.
- **Novedad:** nuevo.

### A medir

Lo que no se puede estimar leyendo el código, con cómo medirlo (`convenciones_tecnicas.md` §10: contra el
deploy real, no contra local).

Nada pendiente: todo lo que estaba acá se midió (ver "Mediciones"). Cuánto dura un viaje desde Railway a la
base (~30 ms, región `us-west2`), el costo de abrir conexiones en producción, el envío por Resend (~200 ms), Google
Calendar (~590 ms al crear el evento, ~300 al borrarlo) y la velocidad del CPU de Railway (parecida a la de esta
PC).

Lo único que no se midió es el peor caso de CPU de Z8-06 en Railway, porque necesita una agenda llena: los
números de esta PC valen, porque el CPU de Railway resultó parecido. Ojo con el método que se había propuesto para la reserva: las horas de los logs de
la aplicación no sirven para medir, porque Railway les pone la hora en tandas (las 5 líneas de una reserva
salen con 23 µs de diferencia, aunque en el medio hubo un envío de mail).

### Verificado correcto

**Métricas y consumo**

- Las métricas de Railway: el cron no consume (entre corridas está "Completed"; la línea plana de ~420 MB del
  gráfico repite el último valor, y el costo lo confirma). Lo que se paga es la memoria del backend en reposo;
  CPU y red son centavos.
- Sentry: `tracesSampleRate: 0`, `maxBreadcrumbs: 0`, sin profiling y solo `captureConsoleIntegration` de
  errores. Sus 35 MB (Z8-08) son el SDK, no los sample rates: no hay nada que bajar ahí sin perder el monitoreo.
- Keep-alive: 4.320 `SELECT 1` por día, CPU y red despreciables (lo que no hace, en Z8-02).
- Cron de recordatorios: 1 query de tenants, 1 por tenant y, por turno, un `UPDATE` de reclamo y un envío, en
  serie. Hoy solo demo tiene el recordatorio activo: corre en segundos. Carga `googleapis` sin usarla (Z8-08).
- Log de acceso (nota de la zona 7): confirmado que escribe el body entero de cualquier `POST` que pase por
  `express.json` (hasta 100 kB). En CPU es nada (serializar 100 kB, menos de un milisegundo); el volumen y lo que
  lleva adentro son de la zona 7 (Z7-05). Las imágenes van como binario (`express.raw`, `adminImagenes.js:15`)
  y `/api/alta` se monta antes del log: ninguna de las dos pasa por él.
- Sin compresión de respuestas (no hay `compression`): las respuestas son de pocos kB y la salida es de 0,05 GB
  por mes. No hace falta.

**Lo que corre en cada request**

- `tenantMiddleware`: 0 queries después del primer pedido de cada subdominio. El caché guarda solo subdominios
  válidos (los que no resuelven no se guardan), así que no crece más que la cantidad de locales.
- `verificarToken`: admin y operativo leen la versión del token del caché del tenant (0 queries); el barbero, 1
  query por request (Z8-04). Un caché corto para el admin y el operativo no ahorra nada: ya no consultan.
- Rate limiter: el store en memoria de `express-rate-limit` usa dos mapas que rotan en cada ventana; no crece
  sin tope.

**Pool**

- Ningún camino retiene una conexión mientras espera a Google, a Resend o a bcrypt: `query()` usa `pool.query`,
  que libera la conexión al terminar cada sentencia. Las cascadas largas (Z8-05) demoran al usuario, no al pool.
- `statement_timeout` de 5 s en cada conexión (`onConnect`) y `connectionTimeoutMillis` de 5 s: ninguna query
  de las pantallas diarias se acerca. Con el uso normal de un local no hay forma de dejar al pool sin conexiones.

**Pantallas de uso diario**

- iPad, cobrar un corte: 3 viajes en serie sobre una conexión (barbero activo, duración del servicio y el
  `INSERT` con CTE que completa el turno). Una venta: 3 (stock, `INSERT`, descuento de stock). En producción,
  cobrar un corte tarda 180 ms de mediana en el backend (242 de p90), más su preflight (Z8-01). Juntar las dos
  validaciones del corte ahorraría un viaje (~30 ms): marginal. Los catálogos se cargan una vez por sesión (`App.jsx:303`)
  y la lista de turnos del día, una query al llegar al paso 2.
- Caja del panel: 4 queries en paralelo (2 tandas) por día elegido; el Excel sale de lo ya cargado, sin otro
  pedido. Socios, una vez.
- Inicio de la app del barbero (`Dashboard.jsx`): un pedido, una query.
- Turnero: la landing son 3 queries (el tenant, y horario y feriados en paralelo, `turnero.js:56-90`) más 1 de
  imágenes; servicios y barberos se piden recién al entrar al flujo; la disponibilidad es un juego fijo de 7
  queries para todo el rango, sin una query por día ni por barbero (sin N+1). Días y horarios van en serie a
  propósito (los horarios dependen del día elegido).
- Balances: el mensual, 5 queries en paralelo; el histórico, 4, acotado a 12 meses. Planillas: una query por
  endpoint, tres pedidos en paralelo. Ventas y Gastos: acotados al mes.
- Búsqueda de clientes del panel (`useBusquedaClientes.js`): espera 300 ms después de la última tecla, desde 2
  letras, y el backend responde con `LIMIT 50`. No hay un pedido por tecla.

**Lo que crece**

- No hay listados de uso diario sin tope: todo lo que se lista está acotado por día, semana, mes o 12 meses.
  `getMisClientes` (`clientes.js`) no tiene `LIMIT`, pero lo acota la cantidad real de clientes del barbero.
- Turnero con un local real: el costo en queries no crece con los barberos ni con los días (un juego fijo); lo
  que crece es la CPU (Z8-06) y los filtros sin índice (Z8-07).

**Login (nota de la zona 1)**

- `bcrypt` 6.0.0, costo 10: 65 ms por comparación en esta PC. Login del admin por el panel: 1 comparación.
  Barbero por el panel: 1 + N en serie (en kingsaistudio, con 4 barberos activos, 5 comparaciones: 330 ms; en
  paralelo serían 132 ms). Barbero por su app: 1. Un intento fallido cuesta 1 + N, igual que el login de un
  barbero. Es un costo aceptado y documentado en `authPanel.js:10-13`, y con las sesiones de 30 días el login es
  raro: no es hallazgo. Si se toca, las comparaciones en `Promise.all` lo bajan a menos de la mitad sin cambiar
  nada más.
- `POST /api/auth/recuperar/solicitar` (nota de la zona 1): 2 queries por pedido; el problema es el de Z1-01 y se
  arregla con él. No tiene un costo propio que importe.

**Índices**

- Los que existen y lo que cubren: `turno` tiene `(tenant_id, inicio)` y `(barbero_id, inicio)` parciales sobre
  `reservado` (disponibilidad, recordatorios, Agenda), el `EXCLUDE` GiST anti-solapamiento, `token_gestion` único
  (gestión desde el mail) y `cliente_id`; `corte` tiene `tenant_id`, `timestamp` (lo usan solo los filtros por
  rango) y `turno_id` único parcial; `venta`, `tenant_id` y `timestamp`; `gasto`, `producto`, `servicio`,
  `barbero` y `tenant_imagen`, `tenant_id`; `barbero_suspension`, `(barbero_id, desde, hasta)`; `cliente`,
  `(tenant_id, email)` único (upsert del turnero y búsqueda); `tenant`, `subdominio` único;
  `tenant_feriado` y `tenant_horario_atencion`, únicos por tenant y fecha o día; `token_recuperacion`, hash único y
  `(tenant_id, tipo, created_at)` (anti-spam de la recuperación).
- Sin uso desde diciembre: `servicio_tenant_id_id_key` y `categoria_gasto_tenant_id_id_key` (0 lecturas).
  Sostienen las FK compuestas `(tenant_id, id)`: no sobran.
- `movimiento_extra` no tiene índice por `tenant_id` (14 filas): entra en Z8-07 cuando crezca.
- La base entera es chica: la tabla más grande es `corte` con 1,3 MB.

### Sin revisar

- En producción lo único que escribió fue la reserva de prueba de demo (y su cancelación), autorizada por el
  usuario. No se midió un cobro en vivo (sale de los logs). Las pantallas con login (Inicio, Caja, Agenda) se midieron por sus logs HTTP, no en vivo: el
  login con el PIN no lo hace Claude.
- Los milisegundos de las queries en Postgres se midieron solo para los filtros por fecha de `corte` (ver
  "Mediciones"); el resto, por `EXPLAIN` sin `ANALYZE`, que da costos y no tiempos. Ninguna query de las
  pantallas medidas pesa frente a un viaje.
- Las escrituras (cobrar, reservar) no se midieron contra la base: el rol de solo lectura no las deja correr.
  Sus viajes salen de leer el código.
- De los fronts se miró la carga de datos de las pantallas de uso diario. No se revisaron las pestañas de
  Gestión, el formulario de alta, la landing, ni `MiPlanilla` y `Clientes` de la app del barbero más allá de
  qué piden.

### Para otra zona

- **Docs:** `performance_frontends.md` ("el proceso de Railway no duerme", keep-alive) y el comentario de
  `iniciarKeepAlive` (`db.js:180-185`) dicen que el keep-alive evita la conexión fría; vale para una de las tres
  (Z8-02). El pendiente "Validar en prod las optimizaciones de backend de performance" de `estado_actual.md`
  puede usar la medición 1 de "A medir".
- **Zona 3:** el límite propio para los `GET` de disponibilidad que anotó la zona 3 sube de prioridad con Z8-06:
  además de queries, cada pedido es CPU que frena al resto de los locales.
- **Zona 5:** con la reserva respondiendo antes de Calendar y del mail (Z8-05), un turno creado justo antes de
  un deploy puede quedar sin mail de confirmación; conviene que el arreglo de Z8-05 lo tenga en cuenta.

---

## Segunda pasada

*Pendiente: se escribe en la fase 10, antes del PR de merge de `feature/mejoras-operativas`, sobre el diff de
las fases hechas después de esta auditoría.*

---

*— Fin del documento —*
