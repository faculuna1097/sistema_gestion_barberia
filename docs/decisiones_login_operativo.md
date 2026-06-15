# Plan — Login del modo operativo — núcleo de decisiones

> ✅ **Completado (2026-05-18); en producción.** Documento **archivado**: solo el "por qué".
> El estado de auth vigente (tokens, `requiereRol`, login unificado `/panel/login`, `tv`)
> vive en [`estado_actual.md`](estado_actual.md) §Sistema. Implementación:
> `controllers/authOperativo.js`, `adminOperativo.js`, `utils/sanitizarLogs.js`.

## Problema que resolvió

El "modo operativo" (iPad del local: FlujoCorte/Venta/Gasto + turnos del día) consumía
endpoints **públicos sin auth** (`/api/cortes`, `/api/ventas`, `/api/gastos`, `/api/turnos`).
Cualquiera que supiera el subdominio podía hacer POST de movimientos arbitrarios o listar
turnos del día con nombres de clientes. Aceptable como MVP con un solo tenant (Kingsai);
**bloqueante para sumar tenants** → había que autenticar el modo operativo.

## Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| Credenciales | Columnas en `tenant` (`operativo_usuario`, `operativo_password_hash`), **un usuario operativo por tenant** | Simple para el MVP. Si hace falta multiusuario (uno por empleado, con trazabilidad), se migra a una tabla `usuario_operativo` sin romper este diseño. |
| Permisos | Endpoints operativos aceptan rol **`operativo` o `admin`** | El admin es jerárquicamente superior; no tiene sentido que no pueda operar. |
| Token | JWT `{ tenant_id, rol: 'operativo' }`, **30d**, en `localStorage` (`token_operativo`) | El iPad está siempre logueado; un JWT corto forzaría re-login constante. **Sin "recordarme"**: es el iPad del local, no un dispositivo público. |
| Flujo de entrada | entrada → **login operativo** (usuario+password) → flujos + 🔒 candado → **PIN admin** → panel | Separa la operación diaria (siempre logueada) del acceso admin (PIN, esporádico). |
| Password | mínimo 8 caracteres, usuario **case-sensitive** | Sin más complejidad para el MVP. |
| Setup | manual en el onboarding (lo hace el dev); cambiable desde el panel admin | — |

## Rationale de seguridad

- **401 genérico** ante credenciales inválidas: si el tenant no tiene credenciales cargadas
  o no coinciden, mismo mensaje ("Credenciales inválidas") → no se filtra si el tenant existe
  ni si tiene modo operativo configurado.
- **Enmascarar PINs/passwords en logs ANTES de proteger endpoints** (`utils/sanitizarLogs.js`):
  el logger global logueaba el body completo de cada request → las credenciales viajarían en
  texto plano a Railway. Por eso ese paso fue primero.
- **Inventario exhaustivo de endpoints** antes de proteger: el riesgo era olvidar un endpoint
  operativo público. Quedaron **públicos a propósito** los que el turnero del cliente / app del
  barbero consumen sin auth: `GET /api/productos`, `/api/servicios`, `/api/barberos`,
  `/api/negocio`, todo `/api/turnero/*` y `/api/auth/*`.

## Qué cambió después (no estaba en este plan)

- La invalidación de tokens operativos al cambiar credenciales —que acá quedó como deuda
  aceptada (JWT self-contained)— **se resolvió** con `operativo_token_version` + claim `tv`
  (ver `estado_actual.md` §Sistema).
- El login admin migró de `/api/auth/verificar-pin` a `/api/auth/panel/login` (login unificado
  admin/barbero — ver `decisiones_acceso_barberos.md`).

## Trabajo futuro (sigue abierto)

- **Rate limiting** de logins (admin, barbero, operativo) — registrado como deuda en `estado_actual.md`.
- **Multiusuario operativo** (uno por empleado, con trazabilidad) → tabla `usuario_operativo`.

*— Fin del documento (archivado: núcleo de decisiones) —*
