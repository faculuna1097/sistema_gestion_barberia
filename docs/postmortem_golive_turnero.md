# Post-mortem — go-live del turnero (2026-06-12)

> Documento **archivado**. El go-live (`feature/turnero` → `main`, 167 commits) ya se ejecutó y
> está en producción. El runbook ejecutable cumplió su único uso; queda solo el post-mortem (lo
> que falló y por qué), que es lo que tiene valor a futuro. El SQL operativo (recordatorio opt-in,
> emails de barberos) se movió a [`onboarding.md`](onboarding.md).

El web service de Railway entró en **crash-loop** apenas se pusheó el merge. Eran **tres causas
encadenadas** (cada una tapaba a la siguiente). Servicio restaurado tras pinear Node 22.

1. **Faltaban `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el web service.** El merge trajo
   `backend/src/config/supabase.js` (cliente de Supabase **Storage** para imágenes), que se
   inicializa al cargar el módulo. El checklist pre-merge solo verificó `RESEND_API_KEY`/`MAIL_FROM`,
   no estas dos → boot crash (`supabaseUrl is required`). La conexión a la DB es por `pg` (otras
   credenciales), por eso no saltó antes.
2. **Las shared variables de Railway no se inyectan solas.** Crearlas a nivel proyecto no las
   adjunta al servicio: hay que referenciarlas (`${{shared.VAR}}`) o setearlas directo. El primer
   intento no llegó al contenedor y ni disparó un deploy nuevo (log: `injecting env (0) from .env`).
3. **Node 18 + `@supabase/supabase-js` v2 = crash por WebSocket.** `createClient()` construye
   siempre su cliente de Realtime (websockets), que exige `WebSocket` nativo (existe en **Node ≥22**,
   no en 18). Railway corría Node 18 porque `engines: ">=18"` hace que Nixpacks tome el piso del
   rango. Node 20 no sirve (WebSocket experimental detrás de flag). **Fix:** `"node": "22.x"` en
   `backend/package.json` (commit `ec1d155`).

**Lección de fondo (deuda en `estado_actual.md`):** que una credencial o incompatibilidad del
**Storage de imágenes** voltee **todo el backend** al bootear es un acoplamiento indebido. Fix
correcto: init **perezoso** del cliente de Supabase + que un fallo de Storage devuelva un 500
puntual en vez de matar el proceso. Ver `backend/src/config/supabase.js`.

*— Fin del documento —*
