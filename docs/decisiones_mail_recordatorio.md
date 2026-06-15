# Plan — Mail de recordatorio de turno (lote diario) — núcleo de decisiones

> ✅ **Implementado y verificado en producción (2026-06-09); en `main`.** Documento
> **archivado**: solo el "por qué". Es el 5º mail (recordatorio), programado, que se suma
> a los 4 transaccionales. Implementación: `services/recordatoriosService.js` +
> `jobs/recordatorios.js`. La activación opt-in en kingsai queda pendiente en
> [`estado_actual.md`](estado_actual.md).

## Modelo elegido (y por qué)

**Lote diario, la noche anterior.** Un job corre **una vez por día a hora fija** (20:30
ART), busca los turnos del **día siguiente** en estado `reservado` que aún no fueron
avisados, y manda un recordatorio a cada cliente con email.

Se descartó la **"ventana rodante"** (job cada 15 min, recordatorio X horas exactas antes
de cada turno): para una barbería el aviso "la noche anterior" es el patrón natural y
esperado, y el lote diario es mucho más simple de construir y operar (un solo cron, query
trivial, idempotencia casi gratis).

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Disparo (D1) | **Railway Cron** (servicio dedicado, `node src/jobs/recordatorios.js`) | Sobre `node-cron` in-process: el único tick diario es frágil (un restart del web server podría perder la ventana). Un cron dedicado garantiza que la corrida de las 20:30 se intente siempre. El claim atómico ya hace ambas seguras ante doble ejecución → la elección fue de arquitectura, no de correctitud. |
| Default (D2) | **Opt-in por tenant** (`configuracion.recordatorio.activo`, apagado por default) | Evita mails sorpresa en el tenant real; se prende a propósito. |
| Hora (D3) | **20:30 ART** la noche anterior | Constante global (`RECORDATORIO_HORA_ENVIO`); el cron corre 23:30 UTC (Argentina sin horario de verano → offset fijo −3). |
| Idempotencia | **Claim atómico**: `UPDATE turno SET recordatorio_enviado_en=now() WHERE id=$1 AND recordatorio_enviado_en IS NULL RETURNING id` | El Session Pooler/PgBouncer **no soporta transacciones** (`BEGIN/COMMIT`). El claim resuelve la idempotencia con un solo UPDATE: si devuelve fila, este runner ganó el envío. **Marcar ANTES de enviar** (no después): un envío doble es peor que perder uno ocasional. Hace el script re-ejecutable sin doble envío. |
| Contenido | Mail nuevo `enviarRecordatorio` que **espeja `enviarConfirmacion`** | Reusa `construirHtml`, helpers de fecha y el CTA de gestión. Solo cambia el copy (eyebrow "Recordatorio de turno"). |

## Detalles de diseño que conviene recordar

- **Multi-tenant sin `req`:** el job no tiene request → no hay `tenantMiddleware`. El
  service **itera los tenants activos**, lee la config de cada uno y corre la query
  scopeada a ese `tenant_id`. Los links se arman desde `tenant.subdominio` (no del header),
  por eso existe el helper puro `construirLinkGestion(subdominio, token)`;
  `armarLinkGestion(req, token)` delega en él.
- **Zona horaria:** el schedule del cron es hora local traducida a UTC; la query usa día
  local (`DATE(t.inicio AT TIME ZONE $tz) = $target::date`, con `target` calculado en luxon).
- **Reservas tardías post-lote:** si alguien reserva *después* de que corrió el lote, no
  recibe recordatorio (ya recibió la confirmación). Comportamiento aceptado, no es bug.
- **Dependía de la migración a Resend:** el cron no podía enviar hasta que el mail saliera
  por HTTP (Railway bloquea SMTP) — ver [`decisiones_mail_entregabilidad.md`](decisiones_mail_entregabilidad.md).

## Deudas relacionadas (abiertas, menores)

- **DT-2 — Tercera casi-duplicación del SELECT enriquecido:** `enriquecerTurno`, el lookup
  de `cancelarTurnoPorId` y la query del recordatorio comparten casi las mismas
  columnas/JOINs. Candidato a centralizar (fragmento o vista). No bloqueante.
- **DT-3 — Gap en `construirContextoMail`:** siempre arma `tenant.direccion` desde
  `fila.tenant_direccion`, pero la query de `cancelarTurnoPorId` no la selecciona → llega
  `undefined` (hoy no rompe porque `filaDireccion` devuelve null). Contrato frágil.

*— Fin del documento (archivado: núcleo de decisiones) —*
