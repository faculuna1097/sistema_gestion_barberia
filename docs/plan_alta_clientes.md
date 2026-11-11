# Plan — Formulario de alta de clientes (`frontend-alta`)

> Plan autocontenido para un chat orquestador con contexto limpio. Al arrancar la ejecución se copia a `docs/plan_alta_clientes.md`, y al cerrar se resume en `docs/decisiones_alta_clientes.md`. Hechos verificados el 2026-11-10 sobre `main` (`0626b4c`).

## 1. Contexto

Hoy, para dar de alta una barbería, Facundo le pide los datos al cliente por WhatsApp y los carga a mano: `crearTenant.js`, SQL y el panel. Queremos una web donde el cliente nuevo cargue todo solo, desde un **link privado** que Facundo le manda cuando lo contacta. Facundo lee la solicitud en Supabase y arma con Claude, en un chat, la query de alta.

**Prioridad número uno: la experiencia.** Completarlo no tiene que sentirse como trabajo, y tiene que verse profesional, con todos los datos validados. Casi siempre se abre desde WhatsApp, en el celular.

## 2. Decisiones tomadas (con su porqué)

| # | Decisión | Por qué |
|---|---|---|
| D1 | Los datos se guardan como solicitud. Facundo la lee y arma la query con Claude. Sin script de alta ni alta automática. | Facundo controla cada alta antes de crear nada, y no hay que mantener un script nuevo. |
| D2 | Link privado por cliente (token = `id` uuid de la solicitud), que vence a los 30 días. | Evita spam y solicitudes falsas sin captcha. Un uuid v4 no se puede adivinar. |
| D3 | El formulario no pide PINs ni contraseñas. Facundo las define al armar la query y las escribe en texto, y el hash lo genera Postgres en la misma query: `extensions.crypt('1234', extensions.gen_salt('bf', 10))`. | Los tres logins y `pinColisiona` comparan con `bcrypt.compare`, y contra texto plano siempre da `false` (probado). El hash `$2a$10$` de pgcrypto sí pasa `bcrypt.compare` (probado el 2026-10-30 con un `SELECT`, sin escribir). Así no se toca el login, y el cliente cambia las claves desde el panel. |
| D4 | Imágenes desde el panel, no en el formulario. | El flujo ya existe (Gestión → Negocio → Imágenes). Subir archivos complica mucho una primera versión. |
| D5 | Frontend nuevo `frontend-alta`, en `alta.barbermanager.app`. | No depende de un tenant existente. Meterlo en la landing mezclaría marketing con operación, y la landing se pre-renderiza. |
| D6 | Identidad visual **Luz** (la del panel y la landing, acento indigo). | El cliente viene de la landing y sigue en el panel. El blanco y negro es del turnero, la cara al cliente final. |
| D7 | La diversión está en la respuesta a cada toque: botones grandes, avatares que aparecen, barras que cambian, una tarjeta que crece. Sin confeti ni ilustraciones. | `sistema_de_disenio.md` §0 y §2 prohíben lo infantil, lo gamer y la animación decorativa, y Facundo lo quiere profesional. |
| D8 | Validación completa en el front (inmediata, en cada campo) y repetida en el backend al enviar (§5.4). | Facundo pidió que se vea profesional. El backend nunca confía en el front. |
| D9 | La vigencia de la suscripción no se pide: la maneja Facundo en la query. | Decisión de Facundo. |
| D10 | Branch `feature/alta-clientes`, que sale de `main` y vuelve por PR. Va antes que `feature/mejoras-operativas`. | Decisión de Facundo: hacer esto primero. Ver §4. |
| D12 | El largo del turno va de 10 a 60 minutos de a 5 (antes, 15/20/30/40/45/60), con una barra en vez de botones. | Decisión de Facundo en la fase 5. `tenant.duracion_slot_minutos` acepta de 1 a 240, y el sistema ya funciona con largos que no dividen la hora (demo usa 50). |
| D11 | La pausa del mediodía solo parte en dos el horario de los barberos con `'igual_local'`. Un horario a medida puede cubrir la pausa. El front precarga los bloques a medida ya partidos por la pausa (fase 4). | En la DB el local tiene un rango por día: la pausa no es un dato, es un atajo para armar `barbero_horario`. Hay barberos que trabajan de corrido. Decidido en la revisión de la fase 1. |

## 3. Hechos verificados del código

- **Orden de `backend/src/index.js`:** `express.json` (:105), `/api/health` (:120), endpoint de plataforma (:140), **log de acceso global (:158)** y `tenantMiddleware` (:170). El log de acceso escribe la URL y el body (solo tacha PINs y passwords) **antes** del tenant.
- **Enmascarado de secretos en rutas:** `utils/sanitizarLogs.js:39` (`RUTA_TOKEN_TURNERO`), usado por el log de acceso (`enmascararTokenTurnero`), por el rate limiter (`rateLimitMiddleware.js:54`) y por Sentry (`instrument.js:112`, `rutaSinDatosSensibles`). Sentry ya borra `event.request.data` (`instrument.js:108`).
- **Validadores reusables del backend:** `utils/validarTexto.js` (`esEmailValido`, `esTelefonoE164`, `esUrlHttps`, `MAX_NOMBRE = 80`), `utils/validarNumero.js` (`esMontoPositivo`, `esEnteroNoNegativo`, `MONTO_MAXIMO`) y `utils/validarUuid.js` (`esUUID`).
- **El turnero ya valida `whatsapp` y `resena_url`** con esos helpers (`controllers/turnero.js:79`). Si no pasan, no se muestran.
- **Categorías de gasto:** `crearTenant.js:27`, `CATEGORIAS_GASTO_BASE`, con 9 categorías. La query de alta usa la misma lista.
- **Horarios:** el local tiene **un rango por día** (`tenant_horario_atencion`, cerrado = sin fila). Un barbero puede tener **varios bloques por día** (`barbero_horario`, sin solaparse, dentro del horario del local). La disponibilidad del turnero sale de `barbero_horario`.
- **Turnos y servicios:** `tenant.duracion_slot_minutos`, entre 1 y 240 (default 30). `servicio.cantidad_slots`, entre 1 y 20. La duración de un servicio es la cantidad de slots por la duración del slot.
- **Comisión:** siempre porcentaje (`barbero.comision_valor` 0–100, `comision_tipo` solo `'porcentaje'`).
- **Socios:** `UNIQUE (tenant_id, nombre)`. Sin al menos un socio, Caja no deja cargar aportes ni retiros.
- **Triggers `web_deploy_*`** sobre `barbero`, `servicio` y `tenant_horario_atencion`: solo actúan sobre filas de Kingsai (`SQL_Schema.md` §Web de Kingsai). Un alta nueva no los dispara.
- **CORS** ya acepta `*.barbermanager.app` (`index.js`, `cors`). En Vercel, un dominio explícito pisa el wildcard, igual que `www` con la landing.
- **pgcrypto** está instalada en el esquema `extensions`.

## 4. Branches (estado al 2026-11-10)

- La carpeta está en `feature/monitoreo-prod`, sin cambios y **ya mergeada** en `main` (PR #5). Se puede borrar local y remota.
- `feature/mejoras-operativas`: 6 commits, todos de docs (el plan en `docs/plan_mejoras_operativas.md`), y 16 commits detrás de `main`. No se toca. Cuando le toque, se rebasa sobre `main`.
- **Solapamiento con mejoras-operativas (F6):** agrega `tenant.email_duenio`, `tenant.telefono_duenio` y `telefono_local` (reemplaza `telefono`), y cambia `crearTenant.js` y `onboarding.md`. El formulario ya pide esos datos. Hoy la plantilla de SQL usa el schema actual, y F6 la actualiza a las columnas nuevas (anotarlo en su plan al cerrar esta feature).
- Remota `origin/claude/mobile-login-issue-7extzq`: 2 commits que no están en `main`. No es de esta feature y no se toca. Las demás remotas viejas ya están en `main`.
- **Primer paso del orquestador:** `git switch main && git pull` → `git switch -c feature/alta-clientes`. El `pull` lo corre Facundo si hace falta.

## 5. Diseño

### 5.1 Flujo

1. Facundo crea la solicitud: `INSERT INTO solicitud_alta (referencia) VALUES ('Kings — Juan') RETURNING id;`. Manda `https://alta.barbermanager.app/<id>` por WhatsApp.
2. El cliente completa el formulario. Se guarda solo y puede seguir después, también desde otro dispositivo.
3. Al enviar, a Facundo le llega un mail.
4. Facundo arma la query con Claude a partir de `datos`, la corre en el SQL Editor y marca la solicitud como `cargada`.

### 5.2 Experiencia

**Principios.**
- Una pregunta por pantalla.
- Tocar antes que escribir.
- El camino común cuesta un toque.
- Una tarjeta "Tu barbería" crece con cada respuesta.
- Cuatro capítulos en lugar de "paso N de 13".
- Guardado automático con un indicador discreto ("Guardado").

| # | Capítulo | Pantalla | Interacción |
|---|---|---|---|
| 0 | | Bienvenida | "Armemos tu barbería. Son unos 5 minutos y se guarda solo." |
| 1 | Tu local | Nombre | Mientras escribe aparece el link sugerido (`kings.barbermanager.app`) con su estado: disponible, ocupado o inválido. Se puede editar. |
| 2 | Tu local | Dirección | Un campo. |
| 3 | Tu local | Días | 7 botones grandes que se prenden y apagan, más el atajo "Lunes a sábado". |
| 4 | Tu local | Horario | Abre y cierra con botones de +/- 30 min. La semana se dibuja como barras en vivo; tocar un día lo hace distinto. "¿Cierran al mediodía?" es opcional. |
| 5 | Tu equipo | Barberos | Nombre y Enter: aparece su avatar con iniciales. Comisión con botones (40/50/60/70) o un valor de 0 a 100. "Mismo % para todos" por defecto. Mail opcional, con aviso de Calendar. |
| 6 | Tu equipo | Dueños | Se tocan los avatares de quienes son dueños, más "un dueño que no corta". |
| 7 | Tu equipo | Horarios del equipo | "¿Todos trabajan el horario del local?" Sí: se saltea. No: los mismos botones de días por barbero. |
| 8 | Tus servicios | Largo del turno | "¿Cada cuánto das turnos?" Barra de 10 a 60 min de a 5, que arranca en 30 (D12). |
| 9 | Tus servicios | Servicios | Botones con los comunes (Corte, Barba, Corte y barba…). Al tocar pide el precio. Duración en múltiplos del turno, mostrada en minutos. "Agregar otro". |
| 10 | Tus servicios | Productos | "¿Vendés productos?" Con "Ahora no" se saltea. |
| 11 | Contacto | Del local | WhatsApp, "es el mismo número para llamadas" y link de reseñas con "lo paso después". |
| 12 | Contacto | Tuyo | Nombre (precargado si marcó dueño), celular y mail. |
| 13 | | Revisión | La tarjeta completa, con "Editar" por bloque. |
| 14 | | Listo | Tilde animada y qué pasa ahora. |

**Celular.**
- El botón "Seguir" queda siempre visible (`StickyFooter`), también con el teclado abierto.
- El "atrás" del celular vuelve un paso.
- La opción tocada queda marcada ~150 ms antes de avanzar.
- Toques de 44 px como mínimo e inputs de 16 px (evita el zoom de iOS).
- Todo respeta `prefers-reduced-motion`.
- Vista previa al pegar el link en WhatsApp (etiquetas `og:`).

### 5.3 Estados del link

Cada estado tiene una pantalla propia con `EmptyState`, nunca un texto pelado:
- Cargando (`Skeleton`).
- No existe o venció: "Pedile un link nuevo a Facundo", con botón de WhatsApp.
- Ya enviada: resumen de lo que mandó, sin edición.
- Sin conexión: "No pudimos guardar", con reintento. Mientras tanto, lo cargado queda en memoria.

### 5.4 Validaciones

Las mismas reglas en el front y en el backend. El front marca el error **al salir del campo** y **al tocar "Seguir"**, nunca mientras se escribe la primera vez. "Seguir" no se deshabilita sin explicar: al tocarlo, lleva al primer error. El error es texto debajo del campo, con `aria-invalid` y `aria-describedby` (§5.2 del sistema de diseño). Todo texto se guarda sin espacios al principio ni al final.

| Dato | Regla |
|---|---|
| Nombre del negocio | 2–60 caracteres. |
| Subdominio | 3–30, `^[a-z0-9]+(-[a-z0-9]+)*$`, fuera de los reservados (`www`, `alta`, `api`, `app`, `admin`, `send`, `mail`, `turnos`, `barbero`, `demo`) y no usado por un tenant. Se sugiere desde el nombre: sin tildes, minúsculas y guiones. |
| Dirección | 5–120. |
| Días del local | Al menos 1. |
| Horario por día | Cierre posterior a la apertura, en pasos de 30 min. La pausa del mediodía, si hay, va adentro del rango y deja al menos un bloque de 30 min de cada lado. |
| Barberos | Al menos 1. Nombre de 2 a `MAX_NOMBRE`, sin repetir (sin importar mayúsculas). Comisión entera de 0 a 100. Mail opcional (`esEmailValido`), sin repetir. |
| Dueños | Al menos 1. Nombres sin repetir. |
| Horario de cada barbero | Al menos 1 día. Cada bloque dentro del horario del local ese día y sin solaparse. |
| Largo del turno | De 10 a 60 minutos, de a 5 (D12). |
| Servicios | Al menos 1. Nombre de 2 a 40, sin repetir. Precio entero mayor a 0 y menor o igual a `MONTO_MAXIMO`, con separador de miles mientras se escribe. Slots de 1 a 20. |
| Productos | Opcionales. Nombre de 2 a 40, sin repetir. Precio como los servicios. Stock y stock mínimo enteros mayores o iguales a 0. |
| WhatsApp y teléfono | Con `libphonenumber-js` (país AR por defecto, formato al escribir). Se guardan en E.164 y el backend los valida con `esTelefonoE164`. |
| Link de reseñas | Opcional. `https://` (`esUrlHttps`). |
| Contacto del dueño | Nombre 2–`MAX_NOMBRE`, celular como el WhatsApp, mail con `esEmailValido`. Los tres obligatorios. |

**Librería nueva para este front: `libphonenumber-js`.** Es la librería de Google para validar y formatear teléfonos de cualquier país. El turnero ya la usa (`frontend-turnero/src/utils/telefono.js`).

### 5.5 Backend

**Tabla nueva.** Es aditiva y no toca nada existente. La corre Facundo en Supabase:

```sql
CREATE TABLE public.solicitud_alta (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),   -- es el token del link
  referencia text NOT NULL,                      -- de quién es, para Facundo y los logs
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado = ANY (ARRAY['borrador'::text, 'enviada'::text, 'cargada'::text])),
  vence_en timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  enviada_en timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT solicitud_alta_pkey PRIMARY KEY (id)
);
ALTER TABLE public.solicitud_alta ENABLE ROW LEVEL SECURITY;
```

**Endpoints en `/api/alta`.** Se montan en `index.js` **después del endpoint de plataforma y antes del log de acceso global**. Así no pasan por `tenantMiddleware` (todavía no hay tenant) y el body, que trae nombres, mails y teléfonos del cliente, no queda en los logs de Railway. El controller loguea sus propios eventos con `referencia`, nunca con el `id`.

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/alta/:token` | `{ estado, datos, vence_en }`. 404 si no existe o venció. |
| PUT | `/api/alta/:token` | Guarda `datos` entero, solo si sigue en `borrador` (`UPDATE ... WHERE estado = 'borrador' AND vence_en > now()`). 409 si ya se envió. Solo valida la forma (objeto y tamaño), no lo completo. |
| GET | `/api/alta/:token/subdominio/:valor` | `{ disponible, motivo }`, con motivo `formato`, `reservado` u `ocupado`. |
| POST | `/api/alta/:token/enviar` | Valida todo (§5.4), pasa a `enviada` en una sola sentencia condicional y manda el aviso. 400 con `{ errores: [{ campo, mensaje }] }`. 409 si ya estaba enviada. |

- El token se valida con `esUUID`. Si está mal formado, 404 (convenciones §2).
- **`limiterAlta`** nuevo en `rateLimitMiddleware.js`: holgado para el autoguardado (~60/min por IP) y estricto para `enviar` (5/hora).
- **Enmascarado:** se generaliza `RUTA_TOKEN_TURNERO` (`sanitizarLogs.js:39`) para cubrir también `/api/alta/<token>`, porque el rate limiter y Sentry escriben la ruta.
- **Aviso por mail**, best-effort, a la env var `ALTA_AVISO_EMAIL`, con una función nueva en `mail/mailer.js` en el estilo de las existentes. Lleva la referencia, el nombre del negocio y el `id`, y nada de PII. Si falla, la solicitud igual queda enviada.
- **Validación centralizada:** las reglas de §5.4 van en `utils/validarSolicitudAlta.js`, que reusa los helpers de §3. El controller solo la llama. El front tiene su copia de las reglas en `src/utils/validaciones.js` (los fronts no comparten código con el backend, igual que hoy).
- Tamaño máximo de `datos`: alcanza el límite de 100 kB de `express.json`.
- **Archivos nuevos:** `routes/alta.js`, `controllers/alta.js`, `utils/validarSolicitudAlta.js` y `utils/subdominio.js` (formato, reservados y sugerencia desde el nombre).
- **Archivos a tocar:** `index.js`, `rateLimitMiddleware.js`, `sanitizarLogs.js` y `mail/mailer.js`.

### 5.6 Forma de `datos`

Es un único objeto, que viaja entero en cada guardado:

```js
{
  version: 1,
  local:    { nombre, subdominio, direccion, telefono, whatsapp, resena_url,
              horario: [{ dia_semana, hora_inicio, hora_fin }], pausa: { hora_inicio, hora_fin } | null },
  turno:    { duracion_minutos },
  barberos: [{ clave, nombre, comision, email, es_duenio,
               horario: 'igual_local' | [{ dia_semana, hora_inicio, hora_fin }] }],
  duenios_sin_corte: [{ nombre }],
  servicios: [{ nombre, precio, cantidad_slots }],
  productos: [{ nombre, precio, stock, stock_minimo }],
  contacto:  { nombre, celular, email },
  progreso:  { pantalla, ... }   // para retomar donde quedó, y los datos de interfaz (ver abajo)
}
```

`clave` es un id local del front, para las listas de React y para relacionar un dueño con su barbero. Al enviar, el backend guarda solo las claves de esta forma: un dato de interfaz que haya que conservar (por ejemplo, "es el mismo número") va dentro de `progreso`.

Claves de `progreso` que usa el front (fases 3 a 5): `pantalla`, `subdominio_editado`, `direccion` (las partes), `horario_comun`, `dias_distintos`, `comision_igual`, `comision_comun`, `duenios_confirmados`, `horarios_distintos`, `turno_de_servicios`, `productos_apartados`, `telefonos` (país y número formateado), `telefono_propio` y `contacto_precargado`. Servicios y productos llevan también una `clave` local. Al enviar, el backend guarda `progreso` tal como llega y descarta la `clave` de servicios y productos. Las horas van en `'HH:MM'` y `dia_semana` de 0 a 6 (0 = domingo), igual que en la DB.

### 5.7 Frontend

`frontend-alta/`: React y Vite, estilos inline con `theme` (§4.1 del sistema de diseño), íconos Lucide, sin Tailwind ni librería de animación.

- **Se copian del panel** (§8): `theme/tokens.js`, `index.css` y los primitivos `Button`, `Field`, `AvatarIniciales`, `Skeleton`, `EmptyState` y `PageContainer`.
- **Se copian del barbero:** `StickyFooter` y `hooks/useHover.js`.
- **Se copian del turnero:** `hooks/useNavegacion.js`, `hooks/useEleccionConPausa.js` y `utils/movimiento.js` (con el acento de Luz), y la lógica de `utils/telefono.js`.
- **Nuevos:** `SelectorDias` (pantallas 3 y 7), `SemanaEnBarras`, `TarjetaBarberia`, `CampoPrecio`, `hooks/useSolicitud` (carga, guardado con debounce de ~800 ms, estado "Guardando…/Guardado") y `utils/validaciones.js`.
- `services/api.js` sin `X-Tenant-Subdomain`. El token sale del path de la URL.
- Movimiento con clases `al-` en `index.css`, igual que las `tt-` del turnero (§3.8): entrada de pantalla según la dirección, achique al tocar y aparición de avatares y barras.
- `index.html` con `lang="es"`, `noindex` y etiquetas `og:`, más `public/robots.txt` que bloquea todo y `vercel.json` con el rewrite de SPA.
- **Densidad:** la del turnero (aireada, mobile-first, `PageContainer` de 480).

### 5.8 Plantilla SQL de alta

Va en `docs/onboarding.md` como camino principal. `crearTenant.js` queda como alternativa.

- Orden: `tenant` → `tenant_horario_atencion` → `barbero` → `barbero_horario` → `socio` → `servicio` → `producto` → `categoria_gasto` (las 9 de `CATEGORIAS_GASTO_BASE`) → `UPDATE solicitud_alta SET estado = 'cargada'`.
- `pin_admin`, `barbero.pin` y `operativo_password_hash` con `extensions.crypt(..., extensions.gen_salt('bf', 10))`.
- PINs distintos entre sí (barberos y admin): lo controla Claude al armar la query.
- `configuracion` lleva `whatsapp` y `resena_url`.
- Una sola sentencia con CTEs (`WITH t AS (INSERT INTO tenant ... RETURNING id), ...`). Así es atómica sin `BEGIN`/`COMMIT`, y no hay que copiar el uuid a mano. Comprobarlo en la fase 7.
- Los textos que vienen del cliente van con las comillas escapadas (un `O'Brien` rompe la query).

## 6. Modo de trabajo

- Un orquestador con chats ejecutores, uno por fase de código. El ejecutor no commitea. El orquestador revisa el **diff real** y commitea cada fase aprobada. Push, PR y merge los hace Facundo.
- SQL que corre Facundo (tabla, alta de prueba) y docs de cierre: en el orquestador.
- Cada prompt de ejecutor lleva objetivo, sección de este doc, archivos por donde arrancar (sin cerrar la lectura), contrato exacto, qué reusar, qué no tocar, cómo se verifica y formato del reporte.
- **Pruebas de backend:** el ejecutor las corre él mismo con controllers y req/res simulados contra la DB, sobre filas de `solicitud_alta` con `referencia = 'prueba'`, y las borra al terminar.
- **Pruebas de front:** las hace el ejecutor en el browser pane, en modo celular. Backend local en 3001 contra la DB (solo toca `solicitud_alta`) y `vite preview` del front en un puerto fuera de 5173–5176, solo en 127.0.0.1. Al terminar baja los dos y borra `.claude/launch.json`.
- Las fases de UI usan el skill `impeccable`.

## 7. Fases

| # | Qué | Quién | SQL de Facundo |
|---|---|---|---|
| 0 | Branch `feature/alta-clientes` desde `main`, este plan a `docs/plan_alta_clientes.md`, fila en el mapa de `CLAUDE.md`. | Orquestador | `CREATE TABLE solicitud_alta` |
| 1 | Backend completo (§5.5) con sus pruebas. | Ejecutor | — |
| 2 | Esqueleto del front: proyecto, copias, `api.js`, `useSolicitud`, navegación con historial, capítulos, tarjeta (vacía), estados del link (§5.3), `utils/validaciones.js`. | Ejecutor | — |
| 3 | Capítulo "Tu local" (pantallas 0–4). | Ejecutor | — |
| 4 | Capítulo "Tu equipo" (pantallas 5–7). | Ejecutor | — |
| 5 | "Tus servicios", "Contacto", Revisión y Listo (pantallas 8–14), y el envío con errores del backend. | Ejecutor | — |
| 6 | Pulido: auditoría con `impeccable`, accesibilidad, reduced motion, etiquetas `og:`, `noindex`, `vercel.json`, lint en verde. | Ejecutor | — |
| 7 | Plantilla SQL (§5.8) y prueba punta a punta con una solicitud de prueba. | Orquestador | Alta de un tenant de prueba y su baja (`activo = false`) |
| 8 | Cierre: `decisiones_alta_clientes.md`, `SQL_Schema.md`, `onboarding.md`, `sistema_de_disenio.md` (superficie Alta, prefijo `al-`), `ruta_proyecto.md`, `estado_actual.md`, `README.md` (puerto) y la nota de solapamiento en `plan_mejoras_operativas.md` (§4). | Orquestador | — |

### 7.1 Pendientes que salieron de las revisiones

- **Fase 3:** el "Seguir" del nombre frena también con el resultado de la consulta del subdominio (`validaciones.js` no sabe si está ocupado).
- **Fase 4 (hecho):** la pantalla 7 no se saltea (su primera parte es la pregunta), así que `caminoHasta` no cambia. Los bloques a medida se precargan partidos por la pausa (D11).
- **Fase 6 (hecho):** el resumen de días de la tarjeta puede quedar ambiguo con días sueltos más un tramo ("Lun, mar y jue a sáb"). Foco que cae en la página al tocar "Partir la jornada" o "Trabaja de corrido" (el botón desaparece). Avatares de 24 px en la tarjeta.
- **Fase 5 (hecho):** después de un envío exitoso se muestra "Listo" sin releer la solicitud.
- **Fase 6 (hecho, 105,6 kB inicial + 45,9 kB diferido):** el bundle pesa 141 kB con gzip (506 kB sin comprimir) por `libphonenumber-js`: cargarla recién en el capítulo Contacto con `import()` dinámico.
- **Fase 8:** anotar en `estado_actual.md` que `pool.on('error')` de `backend/src/config/db.js` loguea con `console.error` el corte de una conexión ociosa del pooler, y eso llega a Sentry (y a Discord). Es global, no de esta feature.
- **Fase 6 (hecho, commit 2c3c842):** handler de errores después de `express.json` en `backend/src/index.js` que responda 400/413 en JSON y loguee con `console.warn`. Hoy Express imprime el stack con `console.error` y `captureConsoleIntegration` lo manda a Sentry (y a Discord) con cada JSON mal formado o body de más de 100 kB. Es global, va en su propio commit.

## 8. Tareas fuera del código (Facundo)

1. Correr el `CREATE TABLE` (fase 0).
2. Crear el proyecto de Vercel con root `frontend-alta` y `VITE_API_URL`.
3. Agregar `alta.barbermanager.app` a ese proyecto.
4. Setear `ALTA_AVISO_EMAIL` en Railway, en el servicio y no como shared variable.
5. Deploy: el backend antes que el front (el front viejo no existe, así que no hay riesgo de orden).

## 9. Verificación

- **Backend:**
  - Token válido, mal formado, inexistente y vencido.
  - PUT después de enviar da 409.
  - Doble envío: el segundo da 409 y no manda otro aviso.
  - Subdominio con formato inválido, reservado, ocupado (`kingsaistudio`) y libre.
  - `enviar` con cada regla de §5.4 rota devuelve el campo y el mensaje correctos.
  - Ni el token ni datos del cliente en los logs (mirar la salida de la prueba).
- **Front, en modo celular:**
  - Recorrido completo.
  - Cortar a mitad, recargar y seguir donde quedó.
  - "Atrás" del navegador.
  - Cada error de validación visible y con foco.
  - Link vencido y ya enviado.
  - Sin conexión al guardar.
  - `prefers-reduced-motion`.
  - Teclado abierto con el botón visible.
- **Punta a punta (fase 7):**
  - Con una solicitud real de prueba, correr la query.
  - Entrar con el login operativo, el PIN admin y el PIN de un barbero.
  - Ver turnos disponibles en el turnero del tenant de prueba.
  - Darlo de baja.
