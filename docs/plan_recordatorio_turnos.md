# Plan — Mail de recordatorio de turno (lote diario, noche anterior)

> **Propósito de este documento.** Diseño y plan de implementación, por etapas,
> del mail automático de recordatorio de turno. Está pensado para desarrollarse
> en **varios chats**: cada etapa es autocontenida y los contratos de código
> están escritos de forma explícita para que un chat sin contexto previo pueda
> retomar sin re-investigar.
>
> **Estado:** Etapa 2 completada (commiteada). Próximo: Etapa 3 (disparador + scheduling).
> **Última actualización:** 2026-06-08.

---

## 1. Resumen ejecutivo

Hoy el sistema tiene 4 mails **transaccionales** (confirmación, cancelación,
reprogramación, cancelación automática) que se disparan desde una acción del
usuario. Queremos sumar un 5º mail que es **programado**: recordarle al cliente
que tiene un turno próximo.

**Modelo elegido: lote diario, la noche anterior.** Un job corre **una vez por
día a hora fija** (ej. 20:00 ART), busca los turnos del **día siguiente** que
estén `reservado` y todavía no fueron avisados, y le manda un recordatorio a
cada cliente con email.

Se descartó el modelo de "ventana rodante" (job cada 15 min, recordatorio exacto
X horas antes de cada turno) porque para una barbería el aviso "la noche anterior"
es el patrón natural y esperado, y el lote diario es **más simple de construir y
operar** (un solo cron, query trivial, idempotencia casi gratis).

---

## 2. Decisiones tomadas

1. **Modelo:** lote diario a hora fija, recordatorio la **noche anterior**.
2. **Disparo:** un único cron diario vía **Railway Cron** (servicio dedicado;
   ver §5.1).
3. **Idempotencia:** columna nueva `turno.recordatorio_enviado_en` + **claim
   atómico** (un solo `UPDATE`, sin transacciones — restricción del Pooler).
4. **Anticipación:** configurable por tenant vía flag `activo` en
   `tenant.configuracion`; la hora de envío y los días de anticipación son
   constantes globales por ahora (per-tenant send-hour queda como extensión
   futura, ver §6.2).
5. **Contenido:** mail nuevo `enviarRecordatorio` que **espeja
   `enviarConfirmacion`** (reusa `construirHtml`, helpers de fecha,
   `filaDireccion` con link a Maps y el CTA de gestión).
6. **Reservas tardías post-lote:** si alguien reserva *después* de que corrió el
   lote, no recibe recordatorio (ya recibió la confirmación). Comportamiento
   aceptado, no es un bug.

---

## 3. Decisiones — estado

**Resueltas:**
- **D2 — Default del feature:** **opt-in** por tenant (apagado por default; se
  prende a propósito). Evita mails sorpresa en el tenant real.
- **D3 — Hora de envío:** **20:30 ART** la noche anterior.
- **D4 — Migraciones:** se ejecutan a mano en el **SQL Editor de Supabase** (las
  corre el usuario). El chat provee el SQL.
- **Instancias Railway:** el backend corre **una sola instancia** (replicas = 1).
  Aun así el claim atómico va igual: los deploys solapan 2 instancias unos
  segundos, y una vez/día un node-cron podría perder su única ventana si coincide
  con un restart.

- **D1 — Mecanismo de disparo:** **Railway Cron** (servicio dedicado). Elegido
  sobre `node-cron` por la fragilidad del único tick diario: un cron dedicado
  garantiza que la corrida de las 20:30 se intente siempre, sin depender del
  ciclo de vida del web server. El usuario crea el servicio en Railway (Etapa 3).

- **D5 — Copy del mail (resuelta, Etapa 2):** eyebrow indigo "Recordatorio de
  turno", título = nombre del negocio, intro "te recordamos tu próximo turno"
  (sin hardcodear "mañana"), filas Servicio/Barbero/Fecha/Horario + Dirección,
  CTA "Gestionar turno". Espeja `enviarConfirmacion` salvo el copy.

**Abiertas:** (ninguna)

---

## 4. Lo que ya existe y se reusa (mapa de reuso)

- **`backend/src/services/mailer.js`**
  - `construirHtml({ eyebrow, eyebrowColor, titulo, intro, filas, cta })` — molde
    visual común. Se reusa tal cual.
  - `filaDireccion(tenant)` — fila "Dirección" con link a Maps (o `null` si el
    negocio no tiene dirección). Se reusa.
  - Helpers de fecha internos (`formatearFechaLarga`, `formatearHora`,
    `formatearFechaAsunto`) — formatean en TZ Argentina. Se reusan.
  - `construirContextoMail(fila)` — **contrato de alias** (ver §7.1). Si la query
    del recordatorio devuelve esos alias, el desempaquetado funciona sin tocar
    nada.
  - `enviarMail(...)` + `debeSaltarseEnvio(...)` — wrappers internos
    (best-effort, saltean si no hay credenciales o el cliente no tiene email).
- **`backend/src/services/turnosService.js`**
  - `enriquecerTurno(turnoId)` — referencia de los JOINs/alias (es por **un** id;
    el recordatorio necesita la versión en lote, ver §7.2).
  - `armarLinkGestion(req, token)` — **acoplado a `req`**; hay que extraer un
    helper puro (ver §7.4 y deuda DT-1).
- **`backend/src/utils/constantes.js`** — `TZ` centralizada. Sumar acá las
  constantes nuevas (§6.2).
- **`backend/src/config/db.js`** — exporta `{ query }`. Pool `max: 3`,
  **sin transacciones** (Session Pooler / PgBouncer).
- **`backend/src/scripts/`** — patrón ya existente de scripts CLI ejecutables
  (`probarMailer.js`, etc.). El disparador del job sigue este patrón.

---

## 5. Arquitectura

**Principio rector:** la lógica del trabajo vive en un **service**
(`recordatoriosService.js`); el disparador es una **cáscara fina** que lo invoca.
Así el mecanismo de disparo se puede cambiar sin reescribir la lógica.

### 5.1 Disparo (decisión D1)

| Opción | Qué es | Pros | Contras |
|---|---|---|---|
| **Railway Cron** (recomendado) | 2º servicio en el proyecto Railway, mismo repo, start command `node src/jobs/recordatorios.js`, schedule diario | El trabajo programado vive fuera del web server; **un único runner garantizado**; calza con el patrón `scripts/` | Hay que crear el servicio y replicarle env vars; **cron en UTC** → 20:30 ART = 23:30 UTC (offset estable: Argentina no tiene horario de verano) |
| **node-cron in-process** | Librería que agenda dentro del Express (`index.js`) | Cero infra nueva; reusa pool y transporter ya cargados; **acepta `timezone` directo** (`America/Argentina/Buenos_Aires`), sin calcular offset UTC | Vive/muere con el web server; en cada deploy hay solapamiento breve (mitigado por el claim) |

**Decisión (D1):** Railway Cron (servicio dedicado). El claim atómico (§7.3)
hace que ambas sean seguras ante doble ejecución, así que la elección fue de
arquitectura, no de correctitud.

### 5.2 Multi-tenant sin `req`

El job **no tiene request** → no hay `tenantMiddleware` ni `req.tenant_id`. El
service **itera los tenants activos** y, por cada uno, lee su config y corre la
query scopeada a ese `tenant_id`. Con 2 tenants es trivial y legible.

Los **links** se arman desde `tenant.subdominio` (está en la fila del tenant), no
desde el header `X-Tenant-Subdomain`. Por eso hace falta el helper puro de §7.4.

### 5.3 Zona horaria

- **El schedule del cron es hora local** (20:30 ART = 23:30 UTC). Railway: traducir a UTC.
  node-cron: pasar `timezone: TZ`.
- **La query usa día local:** "los turnos de tal día" se resuelve con el patrón
  de las convenciones — `DATE(t.inicio AT TIME ZONE $tz) = $target::date`. El
  `target` se calcula con luxon (§7.2).
- **El formato del mail** ya está resuelto en el mailer (Intl + TZ).

---

## 6. Cambios en la base de datos

### 6.1 Migración (Etapa 0)

```sql
ALTER TABLE public.turno
  ADD COLUMN recordatorio_enviado_en timestamptz;  -- nullable, default null
```

- `NULL` = recordatorio no enviado (estado natural / default).
- `timestamptz` (no boolean) para registrar **cuándo** se mandó (auditoría) y
  permitir el claim atómico.
- Actualizar `docs/SQL_Schema.md` con la columna nueva.

### 6.2 Configuración por tenant (`tenant.configuracion` jsonb)

Flag de activación **por tenant** (opt-in):

```jsonc
// tenant.configuracion
{
  "recordatorio": { "activo": true }
}
```

Constantes globales nuevas en `backend/src/utils/constantes.js`:

```js
// Hora local (ART) a la que se envía el lote. Hoy la respeta el schedule del
// cron; se documenta acá como referencia única. 20:30 ART = 23:30 UTC.
export const RECORDATORIO_HORA_ENVIO = '20:30';
// Días de anticipación: 1 = la noche anterior.
export const RECORDATORIO_DIAS_ANTES = 1;
```

> **Extensión futura (no ahora):** si algún tenant quiere otra hora de envío,
> se agrega `hora_envio` a su `configuracion.recordatorio` y el job corre más
> seguido chequeando la hora de cada tenant. Hoy: un cron global a una hora.

---

## 7. Contratos de código (para chats fríos)

### 7.1 Contrato de alias que espera `construirContextoMail(fila)`

La query del recordatorio **debe** devolver estas columnas con estos alias:

```
inicio, fin,
barbero_nombre, barbero_email,
servicio_nombre,
cliente_nombre, cliente_email, cliente_telefono,
tenant_nombre, tenant_direccion
```

(En la tabla `tenant`, el nombre es `nombre_negocio` y se aliasea a
`tenant_nombre`; la dirección es `direccion` → `tenant_direccion`.)

### 7.2 Query del lote (por tenant)

```sql
SELECT t.inicio, t.fin, t.token_gestion,
       b.nombre AS barbero_nombre, b.email AS barbero_email,
       s.nombre AS servicio_nombre,
       c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono,
       tn.nombre_negocio AS tenant_nombre, tn.direccion AS tenant_direccion,
       tn.subdominio AS tenant_subdominio,
       t.id AS turno_id
FROM turno t
JOIN barbero  b  ON b.id  = t.barbero_id
JOIN servicio s  ON s.id  = t.servicio_id
JOIN cliente  c  ON c.id  = t.cliente_id
JOIN tenant   tn ON tn.id = t.tenant_id
WHERE t.tenant_id = $1
  AND t.estado = 'reservado'
  AND t.recordatorio_enviado_en IS NULL
  AND DATE(t.inicio AT TIME ZONE $2) = $3::date   -- $2 = TZ, $3 = fecha objetivo
ORDER BY t.inicio ASC;
```

Fecha objetivo (en JS, luxon):

```js
const target = DateTime.now().setZone(TZ).plus({ days: RECORDATORIO_DIAS_ANTES }).toISODate();
```

> No hace falta filtrar `inicio > now()`: el día objetivo es futuro y
> `estado = 'reservado'` ya excluye cancelados/completados.

### 7.3 Claim atómico (idempotencia sin transacciones)

Por cada turno candidato, **antes de enviar**:

```sql
UPDATE turno SET recordatorio_enviado_en = now()
WHERE id = $1 AND recordatorio_enviado_en IS NULL
RETURNING id;
```

- Si devuelve fila → este runner ganó el envío → enviar el mail.
- Si devuelve vacío → ya fue reclamado → saltear.
- **Marcar antes de enviar** (no después): un envío doble queda peor que perder
  uno ocasional. Si el envío falla, `console.warn` y se deja marcado (sin
  reintento). El claim hace el script **re-ejecutable** sin doble envío.

### 7.4 Helper de link puro (refactor de DT-1)

Extraer en `turnosService.js` (o `utils`) una función sin `req`:

```js
// Construye el link de gestión a partir del subdominio del tenant (no del request).
export const construirLinkGestion = (subdominio, token) => {
  if (subdominio) return `https://${subdominio}.barbermanager.app/turnos/gestionar/${token}`;
  const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173';
  return `${base}/turnos/gestionar/${token}`;
};
```

`armarLinkGestion(req, token)` pasa a delegar: lee el subdominio del header y
llama a `construirLinkGestion`. El job usa `construirLinkGestion(fila.tenant_subdominio, fila.token_gestion)`.

### 7.5 Firma del mail nuevo (`mailer.js`)

```js
// Espeja enviarConfirmacion: eyebrow "Recordatorio de turno", filas
// Servicio/Barbero/Fecha/Horario + Dirección (Maps), CTA "Gestionar turno".
export const enviarRecordatorio = async (turno, barbero, servicio, cliente, linkGestion, tenant) => { /* ... */ };
```

---

## 8. Plan de implementación por etapas

Cada etapa ≈ un chat. Avanzar con confirmación entre etapas.

### Etapa 0 — Migración + config ✅ COMPLETADA (commiteada 2026-06-08)
- [x] Resolver decisiones abiertas D1–D4. (Todas cerradas; queda solo D5, que es de Etapa 2.)
- [x] `ALTER TABLE turno ADD COLUMN recordatorio_enviado_en timestamptz;` (ejecutado
      por el usuario en el **SQL Editor de Supabase**, verificado).
- [x] Setear `configuracion.recordatorio = { "activo": true }` en el tenant
      **demo** (UPDATE con merge jsonb, verificado).
- [x] Agregar `RECORDATORIO_HORA_ENVIO` y `RECORDATORIO_DIAS_ANTES` a
      `utils/constantes.js`.
- [x] Actualizar `docs/SQL_Schema.md`.
- **Done when:** la columna existe y el tenant demo tiene el flag. ✓

### Etapa 1 — Service (lógica), con dry-run ✅ COMPLETADA (commiteada 2026-06-08)
- [x] `services/recordatoriosService.js`:
  - obtener tenants activos + su config (con defaults) → `obtenerTenantsActivos` + `leerConfigRecordatorio` (opt-in en JS).
  - query del lote por tenant (§7.2) → `obtenerTurnosDelLote`.
  - claim atómico (§7.3) → `reclamarTurno`, **escrito y exportado pero todavía sin invocar**; lo cablea la Etapa 2 junto al envío.
  - orquestador `procesarRecordatorios({ dryRun })` que recorre tenants y turnos.
- [x] Refactor del helper de link (§7.4, DT-1) → `construirLinkGestion(subdominio, token)` puro; `armarLinkGestion` delega.
- [x] Modo **dry-run**: loguea a quién *se le mandaría* (y a quién se saltearía por no tener email) sin enviar ni marcar.
- [x] Script de verificación `scripts/probarRecordatorios.js` (dry-run, estilo `probarMailer.js`).
- **Done when:** el dry-run lista correctamente los turnos del día objetivo del
      tenant demo. ✓ (verificado con un turno reservado de prueba en demo).

### Etapa 2 — Mail del recordatorio ✅ COMPLETADA (commiteada 2026-06-08)
- [x] `enviarRecordatorio(...)` en `mailer.js` (§7.5), espejando confirmación
      (eyebrow indigo, título = nombre del negocio, CTA "Gestionar turno").
- [x] Conectarlo al service: loop unificado en `procesarRecordatorios` con el
      orden email→claim→envío; resumen `{ enviados, salteados, fallidos, yaReclamados }`.
- [x] Script de prueba `scripts/probarRecordatorioMail.js` (render del mail a una
      casilla de test). De paso se arreglaron dos deudas menores: `probarMailer.js`
      llamaba a los mails sin el arg `tenant` (rompía confirmación y reprogramación),
      y `mailer.js` hardcodeaba `TZ` en vez de importarlo de `utils/constantes.js`.
- **Done when:** llega un mail de prueba bien renderizado. ✓

### Etapa 3 — Disparador + scheduling
- [ ] `jobs/recordatorios.js`: entrypoint que llama a `procesarRecordatorios()`
      y **termina el proceso** limpio (cierra/agota el pool, `process.exit`).
- [ ] Configurar el cron (Railway Cron o node-cron, según D1) — **lo hace el
      usuario en Railway**; el chat le pasa el comando/schedule.
- **Done when:** una corrida programada manda los recordatorios del tenant demo.

### Etapa 4 — Activación en producción + hardening
- [ ] Prender el flag `activo` en el tenant **real** (flip opt-in).
- [ ] (Opcional) índice parcial sobre `turno` si el volumen crece.
- [ ] (Opcional) correr el lote 2 veces al día para cubrir reservas tardías.
- **Done when:** el tenant real recibe recordatorios.

---

## 9. Restricciones técnicas a recordar

- **Base de datos (Session Pooler / PgBouncer):** nunca `BEGIN`/`COMMIT` ni
  `pool.connect()`. La idempotencia se resuelve con el claim de un solo
  `UPDATE` (§7.3). Pool `max: 3`.
- **TZ centralizada:** importar `TZ` desde `utils/constantes.js`, no hardcodear.
  Aritmética de fechas con **luxon**.
- **Logs (convenciones §1):** `[recordatorios] funcion — descripción | dato: valor`.
  Loguear el resultado del lote (cuántos enviados/salteados) y los `catch`
  completos. No loguear el array de turnos, solo `.length`.
- **Mailer best-effort:** no propaga errores; saltea si falta email o credenciales.
- **El usuario ejecuta las acciones de infra:** migraciones en Supabase, config
  de Railway, push. El chat provee comandos/SQL, no los ejecuta.
- **No levantar servidores** desde el chat.

---

## 10. Verificación

- **Etapa 1:** dry-run sobre el tenant demo (sin enviar).
- **Etapa 2:** script de prueba a casilla de test (render del mail).
- **Etapa 3:** corrida real apuntando al tenant demo con un turno de prueba
  cargado para el día siguiente.
- **Etapa 4:** observar logs del cron en Railway tras la primera corrida en prod.

---

## 11. Deudas técnicas relacionadas (detectadas en el análisis)

- **DT-1 — Links acoplados a `req` ✅ RESUELTA (Etapa 1):** se extrajo
  `construirLinkGestion(subdominio, token)` (puro) en `turnosService.js`, y
  `armarLinkGestion(req, token)` pasó a delegar en él. `armarLinkTurnero` sigue
  acoplado a `req`, pero el recordatorio no lo usa (§7.4).
- **DT-2 — Tercera casi-duplicación del SELECT enriquecido:** `enriquecerTurno`,
  el lookup de `cancelarTurnoPorId` y la query del recordatorio comparten casi
  las mismas columnas/JOINs. Oportunidad de centralizar (fragmento compartido o
  vista). No bloqueante.
- **DT-3 — Gap en `construirContextoMail`:** siempre arma `tenant.direccion`
  desde `fila.tenant_direccion`, pero la query de `cancelarTurnoPorId` no la
  selecciona → llega `undefined` (hoy no rompe porque `filaDireccion` devuelve
  null). Contrato frágil; anotado.

---

*— Fin del documento —*
