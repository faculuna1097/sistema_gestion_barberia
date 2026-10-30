# Inventario de deudas técnicas (temporal)

> Documento **temporal** de trabajo (2026-10-29), en `feature/descansos-agenda`. Es el inventario
> verificado y clasificado de las deudas abiertas, para resolverlas antes de mergear el branch.
> Cuando se cierren las tandas, se borra; el estado vigente vuelve a vivir en
> [`estado_actual.md`](./estado_actual.md). Cada tanda saca de las fuentes lo que cierra.

## Cómo se armó

**Fuentes:**
- `estado_actual.md`: "Deudas técnicas conocidas" y las listas de movimientos extra, turnero,
  Feature 1 y panel. La columna fuente usa `EA:línea`.
- `sistema_de_disenio.md` §9, las no tachadas (`SD:línea`).
- `auditoria_2026-07.md` → "Deudas diferidas" (`AU:línea`).
- `SQL_Schema.md` (`SQ:línea`) y `performance_frontends.md` (`PF:línea`).
- Búsqueda de `TODO`/`FIXME`/`HACK` en `backend/src` y `frontend*/src`.

**Pasos:**
1. **Lista cruda:** 113 entradas. Los renglones que agrupan deudas independientes ("Menores",
   "Turnero, carga", el a/b/c de `/api/admin/…`) se partieron en sub-ítems con letra.
2. **Verificación contra el código:** búsquedas y lectura de los archivos de cada deuda, más
   `eslint` en los cuatro fronts. No se usó navegador ni se consultó la DB; lo que necesita uno
   de los dos queda marcado en "estado verificado".
3. **Clasificación:**
   - **A:** arreglo directo.
   - **B:** necesita una decisión.
   - **C:** aceptada o postergada, con una razón que sigue en pie.
   - **D:** ya resuelta; sacarla del doc.

**Duplicados fusionados:**
- `EA:340` es un puntero a las 8 diferidas de la auditoría; no cuenta aparte.
- `EA:332` (idempotency key del turnero) va dentro de AUD-2.
- `EA:348` es la misma deuda que `SQ:15` (E22).
- `EA:325` es la misma deuda que el TODO de `crearTenant.js:69` (E01).

**Fuera del inventario** (no son deudas o son features):
- `EA:333` (upsert de cliente) y `EA:378` (E.164 sin el 9): entran en la feature "Base de clientes".
- `EA:367` (movimientos extra sin edición y sin alta de socios): son features chicas.
- `EA:370` (datos de la competencia en la landing): es mantenimiento periódico.
- `PF:45` (validar en prod las optimizaciones): es un paso de deploy, y ya figura en
  `EA:319`.

**Sumada desde Pendientes:** X01 (`fmtPesos` distinto entre fronts, `EA:311`). Es deuda, no feature.

**TODO/FIXME/HACK en el código:**
- El único real es `backend/src/scripts/crearTenant.js:69` (E01).
- `resendProvider.js:4` y `plataformaAuthMiddleware.js:7` son falsos positivos: dicen "TODO" en
  castellano.

**Riesgo:**
- **DB:** toca la DB, que es una sola y los cambios van directo a producción.
- **contrato:** cambia lo que el backend y los fronts se mandan.
- **visible:** puede haber regresión que se ve en pantalla.
- **regresión (…):** puede romper la lógica de lo que dice el paréntesis.

## Tabla

| id | deuda | fuente | estado verificado | clase | área | tam | riesgo | archivos | deps |
|---|---|---|---|---|---|---|---|---|---|
| E01 | Claves `ciudad`/`moneda` del default de `configuracion` sin uso (+ TODO del script) | EA:325, `crearTenant.js:69` | Abierta | B | estructura del backend | S | — | `scripts/crearTenant.js` | E02, M12 |
| E02 | `crearTenant.js` no crea las credenciales operativas; `generarHashOperativo.js` con constantes a mano | EA:326 | Abierta | A | estructura del backend | S | — | `scripts/crearTenant.js`, `scripts/generarHashOperativo.js`, `onboarding.md` | E01, M12 |
| E03 | `gasto.created_at` redundante con `gasto.timestamp` | EA:327 | Abierta | B | DB y schema | S | DB (si se borra) | `SQL_Schema.md` | — |
| E04 | Separar credenciales a `tenant_credenciales` (1:1) | EA:328 | Abierta. No hay ningún `SELECT *`: riesgo teórico | C | DB y schema | L | DB, regresión en auth | auth*, `tenantMiddleware.js`, `adminOperativo.js`, `gestion.js` | — |
| E05 | `getBarberos` repite la query de `listarBarberosActivos` | EA:329 | Abierta | A | estructura del backend | S | — | `controllers/barberos.js` | — |
| E06 | "Mailing migrado a Resend" figura como deuda | EA:330 | Hecha (tanda 1, 2026-10-30): sacada de `estado_actual.md`; lo que decía ya está en Deploy, Pendientes y `decisiones_mail_entregabilidad.md` | D | docs | S | — | `estado_actual.md` | — |
| E07 | Las reservas no validan el bloque del barbero ni la grilla de slots | EA:331 | Abierta | C | validaciones y errores del backend | L | contrato | `controllers/turnero.js`, `controllers/turnos.js` | AUD-1 |
| E10 | Título del evento de Calendar: pasar a solo `cliente.nombre` | EA:334 | Abierta (`googleCalendar.js:53`) | A | estructura del backend | S | — | `services/googleCalendar.js` | — |
| E11 | `actualizarCredencialesOperativas` no chequea `rowCount` | EA:335 | Abierta | A | validaciones y errores del backend | S | — | `controllers/adminOperativo.js` | — |
| E12 | Path `/turnos/gestionar/` escrito en el backend y en el turnero | EA:336 | Abierta | C | turnero | S | — | `turnosService.js`, `frontend-turnero/src/utils/rutas.js` | E15 |
| E13a | `barbero_horario` con dos escritores (edición y cascada) | EA:337 | Abierta | A | estructura del backend | M | regresión (cascada) | `horariosService.js`, `horarioAtencionService.js` | — |
| E13b | Scoping `req.rol === 'barbero' ? …` repetido | EA:337 | Cambió: 20 apariciones en 8 controllers (decía ~6) | A | estructura del backend | M | regresión (permisos) | `controllers/{agenda,clientes,descansos,horarios,planilla,suspensiones,turnos}.js` | — |
| E13c | Lectura de clientes y find-or-create del turnero separados | EA:337 | Abierta | C | estructura del backend | M | — | `controllers/clientes.js`, `turnosService.js` | Base de clientes |
| E14 | Logger estructurado | EA:338 | Abierta (309 `console.*`) | C | estructura del backend | L | — | backend entero | — |
| E15 | Subdominio, tokens, utils y primitivos copiados en cada front | EA:339 | Abierta; volvió a divergir (X01) | C | lint y tooling | L | regresión en 4 fronts | `*/src/{theme,utils,components/ui}` | X01, DS18 |
| E17 | `TZ` redeclarada | EA:341 | Abierta (`inicio.js:6`, `googleCalendar.js:9`) | A | estructura del backend | S | — | `controllers/inicio.js`, `services/googleCalendar.js` | — |
| E18 | Comentarios que citan §5-bis y §7 #1 de `performance_frontends.md` | EA:342 | Hecha (tanda 1, 2026-10-30): citan el doc sin sección (`db.js:172`, `index.js:248`) | A | estructura del backend | S | — | `config/db.js`, `index.js` | — |
| E19 | Default de `PUBLIC_BASE_URL` en 5173 (es 5175) | EA:343 | Abierta (`turnosService.js:190,215`) | A | estructura del backend | S | — | `services/turnosService.js` | — |
| E20 | SELECT enriquecido de turno casi igual en tres lugares | EA:344 | Abierta | A | estructura del backend | M | regresión (mails, recordatorio) | `turnosService.js`, `recordatoriosService.js` | — |
| E21 | Rebote de overscroll de iOS detrás del footer del turnero | EA:346 | Mitigación vigente; no verificable sin iPhone | C | turnero | L | visible | `frontend-turnero/src/index.css`, layout | — |
| E22 | Tipo de comisión `fijo` latente (CHECK y cálculos) | EA:348 = `SQL_Schema.md:15` | Abierta | B | DB y schema | M | DB | `SQL_Schema`, `planillaService.js`, `SeccionPlanillas.jsx`, `MiPlanilla.jsx` | P08, M06 |
| E23 | `activo`/`created_at` nullables (barbero, servicio, producto, categoria_gasto) | EA:350 | Según `SQL_Schema.md`; la DB no se consultó | A | DB y schema | S | DB | SQL a mano | M03 |
| M01 | `req.body` sin fallback (Express 5) → 500 en vez de 400 | EA:354 | Cambió: 18 controllers (decía 15) | A | validaciones y errores del backend | S | — | `index.js` (middleware) | — |
| M02 | `caja.eliminarMovimiento` con id no-UUID → 500 | EA:355 | Cambió: también `deleteGasto`, `updateGasto`, `deleteVenta` y `updateVenta` (ningún manejo del 22P02 en `gastos.js` ni `ventas.js`) | A | validaciones y errores del backend | S | — | `controllers/caja.js`, `controllers/gastos.js`, `controllers/ventas.js` | T02, N03 |
| M03 | `getCategorias` no filtra `activo` | EA:356 | Abierta | A | validaciones y errores del backend | S | visible (iPad) | `controllers/categorias.js` | E23 |
| M04 | Gasto sin categoría: `JOIN` en Balances y Caja, `LEFT JOIN` en Gastos | EA:357 | Abierta | A | estructura del backend | S | visible (totales) | `controllers/balances.js`, `controllers/caja.js` | — |
| M05 | `gasto.categoria_id` no se valida contra el tenant | EA:358 | Abierta (FK simple) | A | validaciones y errores del backend | S | — | `controllers/gastos.js` | M12 |
| M06 | La comisión no queda guardada en el corte | EA:359 | Abierta | B | DB y schema | L | DB, contrato | `corte`, `cortesService.js`, `balances.js`, `planillaService.js` | E22, P08 |
| M07 | Borrado de gastos y ventas implementado dos veces | EA:360 | Abierta | A | estructura del backend | M | regresión (stock) | `gastos.js`, `ventas.js`, `caja.js` | M02 |
| M08 | `REGEX_FECHA` copiada en 4 controllers | EA:361 | Abierta | A | validaciones y errores del backend | S | — | `feriados.js`, `planilla.js`, `turnos.js`, `turnosOperativo.js` | — |
| M09 | Montos como texto en respuestas viejas | EA:362 | Abierta (`createGasto`, listados) | A | estructura del backend | M | contrato | `gastos.js`, `ventas.js` + fronts que los leen | — |
| M10 | `getBalanceHistorico` acepta `cantidad` negativa | EA:363 | Abierta (`balances.js:335`) | A | validaciones y errores del backend | S | — | `controllers/balances.js` | — |
| M11 | Redondeo de comisiones distinto entre mensual e histórico | EA:364 | Abierta | A | estructura del backend | S | visible (centavos) | `controllers/balances.js` | P08 |
| M12 | Categorías de gasto cargadas a mano por tenant | EA:365 | Abierta | B | DB y schema | M | DB (FK compuesto) | `crearTenant.js`, `onboarding.md` | E02, M05 |
| M13a | `gastos.js` sin JSDoc | EA:366 | Hecha (tanda 1, 2026-10-30): JSDoc en los 4 handlers | A | estructura del backend | S | — | `controllers/gastos.js` | M07 |
| M13b | `getGastosMensual` corre sus dos consultas en serie | EA:366 | Abierta | A | estructura del backend | S | — | `controllers/gastos.js` | — |
| M13c | Comentario "RUTAS DEL BACKOFFICE (admin + barbero)" engañoso | EA:366 | Hecha (tanda 1, 2026-10-30): comentario corregido (`index.js:218`) | A | estructura del backend | S | — | `index.js` | — |
| M15 | Subdominios de tenant sin `noindex` | EA:368 | Abierta (`frontend/vercel.json`) | A | panel | S | visible (SEO del turnero si se configura mal) | `frontend/vercel.json` | — |
| M16 | Landing: `linkWhatsApp`/`linkEmail` sin manejo de `null` | EA:369 | Cambió de archivo: `utils/contacto.js` | A | landing | S | — | `frontend-landing/src/utils/contacto.js` | — |
| T01 | CORS: origin no permitido → 500 | EA:374 | Abierta (`index.js:93`) | A | validaciones y errores del backend | S | — | `index.js` | — |
| T02 | `barbero_id`/`servicio_id` no-uuid → 500 en disponibilidad | EA:375 | Abierta | A | validaciones y errores del backend | S | — | `controllers/turnero.js` | M02 |
| T03 | Sin tope de horizonte para reservar por API | EA:376 | Abierta | A | validaciones y errores del backend | S | contrato (mismo tope en front y back) | `controllers/turnero.js` | — |
| T04 | Dos formas de error: `{ error }` y `{ codigo, mensaje }` | EA:377 | Abierta. En el panel y el barbero no se encontró quién lea `mensaje` del servidor | B | validaciones y errores del backend | M | contrato | `turnero.js`, `horarios.js`, `horarioAtencion.js`, `feriados.js` + `api.js` de los fronts | — |
| T06 | Teléfono: tipear con `+` se traba en 10 dígitos | EA:379 | Probable por código; no probado en navegador | A | turnero | S | — | `ConfirmarTurno.jsx`, `utils/telefono.js` | — |
| T07a | Hero sin foto salta al cargar | EA:381 | Aceptada; la razón sigue | C | turnero | S | — | `Landing.jsx` | — |
| T07b | Skeleton de la gestión sin calendario ni botones | EA:382 | No verificado visualmente | A | turnero | S | visible | `GestionTurno.jsx` | — |
| T07c | Favicon roto si el logo no carga | EA:383 | Abierta | A | turnero | S | — | `frontend-turnero/src/App.jsx` | — |
| T08 | Datos del cliente se pierden al volver o al "Reservar otro turno" | EA:384 | Abierta | B | turnero | S | visible | `App.jsx`, `ConfirmarTurno.jsx` | — |
| T09 | Reintento del 409 suma al rate limit | EA:385 | Abierta (solo leído) | C | turnero | S | — | `ConfirmarTurno.jsx` | AUD-4b |
| T10 | Reprogramación: si falla, no recarga horarios y el aviso queda fuera de vista | EA:386 | Abierta | A | turnero | S | — | `GestionTurno.jsx` | — |
| T11 | `HorarioSemanal` no recibe los feriados | EA:387 | Abierta (`Landing.jsx:232`) | A | turnero | S | — | `Landing.jsx` | — |
| T12a | Scrollbar horizontal en la fila del equipo (desktop) | EA:388 | No verificado visualmente | A | turnero | S | visible | `Landing.jsx` | — |
| T12b | Pin centrado en una dirección de dos renglones | EA:388 | No verificado visualmente | A | turnero | S | visible | `Landing.jsx` | — |
| T12c | `fmtFechaCorta` sin uso en el turnero | EA:388 | Hecha (tanda 1, 2026-10-30): borrada; los comentarios del panel apuntan a la del barbero | A | turnero | S | — | `utils/fecha.js` | — |
| T12d | `fmtDiaAccesible` arma texto visible: nombre corto | EA:388 | Abierta | A | turnero | S | — | `utils/fecha.js` + 2 usos | — |
| F01 | `GET /admin/turnos?desde=&hasta=` pasa los instantes crudos | EA:392 | Abierta | A | validaciones y errores del backend | S | — | `controllers/turnos.js` | — |
| F02 | Liberar es `DELETE /admin/suspensiones/:id` | EA:393 | Abierta | B | estructura del backend | S | contrato | `routes`, `suspensiones.js`, los dos `api.js` | — |
| F03 | % de la jornada de descansos con el horario actual del barbero | EA:394 | Abierta | C | DB y schema | L | DB | `planillaService.js` | — |
| F04 | Descripción del gasto sin tope de largo | EA:395 | Abierta | A | validaciones y errores del backend | S | contrato (mismo tope) | `gastos.js`, `screens/flows/wizard.jsx` | — |
| P01 | #48 naming "Admin" en el login unificado | EA:401 | Abierta | A | panel | S | — | `PantallaLoginAdmin.jsx`, `App.jsx` | — |
| P02 | #27 columna de comisión del subtotal del día | EA:402 | Aceptada; la razón sigue | C | panel | S | — | `SeccionPlanillas.jsx` | — |
| P03 | #28 acoplamiento entre tabs de Planillas | EA:403 | Aceptada; sigue el `Promise.all` | C | panel | S | — | `SeccionPlanillas.jsx` | P08 |
| P04 | #42 `BloqueFeriados` con overflow propio | EA:404 | Aceptada; la razón sigue | C | panel | S | — | `BloqueFeriados.jsx:415` | — |
| P05 | #43 nombre y URL del negocio sin self-service | EA:405 | Aceptada; sigue valiendo con un tenant real | C | panel | S | — | `TabNegocio.jsx` | — |
| P06 | #45 bloque del barbero en día que el local cerró | EA:406 | Hecha (tanda 1, 2026-10-30): sacada de `estado_actual.md`. La cascada borra esos bloques y `putHorarios` responde 422 `dia_cerrado` | D | panel | S | — | `estado_actual.md` | — |
| P07 | DELETE silencioso en Ventas, Gastos y Caja | EA:407 | Abierta | A | panel | S | — | `SeccionVentas/Gastos/Caja.jsx` | DS16 |
| P08 | Fórmula de comisión en tres lugares | EA:408 | Abierta | A | panel | M | contrato | `planillaService.js`, `SeccionPlanillas.jsx`, `MiPlanilla.jsx` | E22, M06, P03 |
| P09 | `lint` del panel falla (7 errores + 1 warning) | EA:409 | Confirmada idéntica; los otros 3 fronts en verde | A | lint y tooling | S | — | `eslint.config.js`, `App.jsx`, `FondoLocal.jsx`, `PanelAdmin.jsx`, `SeccionBalances.jsx`, `wizard.jsx` | DS13 |
| P10 | `ScreenHeader` en Ventas y Gastos: ¿se saca? | EA:410 | Abierta | B | panel | S | visible | `SeccionVentas.jsx`, `SeccionGastos.jsx` | — |
| P11 | `SeccionInicio` usa `.then(r => r.json())` | EA:411 | Abierta (`:423-425`) | A | panel | S | — | `SeccionInicio.jsx` | — |
| P12 | Caja esconde selector de día y totales al cargar o fallar | EA:412 | Abierta | A | panel | S | visible | `SeccionCaja.jsx` | — |
| P13 | Errores sin mensaje del servidor se muestran crudos | EA:413 | Abierta | A | panel | S | — | `SeccionCaja/Gastos/Ventas.jsx` | — |
| P14 | Etiqueta neutra (`surfaceAlt`) pierde el fondo con el hover de la fila | EA:414 | Abierta | A | panel | S | visible | `SeccionCaja.jsx`, `SeccionGastos.jsx` | — |
| P15a | `fontSize: 13` a mano en errores de Gastos y Ventas | EA:415 | Abierta | A | panel | S | visible | `SeccionGastos.jsx:370`, `SeccionVentas.jsx:388` | — |
| P15b | `Field` en 15/12 y sin `sizeInput: 16` (zoom en el iPad) | EA:415 | Abierta | A | panel | S | visible | `components/ui/Field.jsx`, `theme/tokens.js` | — |
| P15c | `Field` no acepta `maxLength` | EA:415 | Abierta | A | panel | S | — | `components/ui/Field.jsx` | — |
| P16 | Textos de menos de 14 px en `BloqueAgenda` y `EstadoTurnoPill` | EA:416 | Abierta (13, 12, 11) | A | panel | M | visible (turnos cortos) | `SeccionTurnero.jsx` | — |
| P17a | `Modal`: overlay y sombra a mano | EA:417 | Abierta | A | panel | S | — | `Modal.jsx`, `tokens.js` | E15 |
| P17b | `Modal` sin manejo del foco | EA:417 | Abierta | A | panel | M | — | `Modal.jsx` | — |
| P18 | Formas de pago en tres lugares (+ ternario del Excel) | EA:418 | Abierta | A | panel | S | — | `utils/formato.js`, `BadgeFormaPago.jsx`, `SeccionGastos.jsx:566` | — |
| P19 | `BotonFormaPago` y `GrupoOpciones` son el mismo patrón | EA:419 | Abierta | A | panel | M | visible | `SeccionTurnero.jsx`, `SeccionCaja.jsx`, `components/ui/` | — |
| P20a | Comentario viejo en `SeccionGastos.jsx` ("id numérico") | EA:420 | Hecha (tanda 1, 2026-10-30): comentario y `String()` borrados; la comparación es directa | A | panel | S | — | `SeccionGastos.jsx` | — |
| P20b | Encabezado de `SelectorDia.jsx` con la ruta vieja | EA:420 | Hecha (tanda 1, 2026-10-30): ruta corregida | A | panel | S | — | `SelectorDia.jsx` | — |
| DS08 | Hover con `useState` en tablas densas | SD:731 | Hecha (tanda 1, 2026-10-30): tachada en §9. `DataTable` usa `<style>` local | D | docs | S | — | `sistema_de_disenio.md` | — |
| DS09 | Contraste WCAG (`muted` sobre `surfaceAlt` 4,4:1, `mutedSoft` 2,6:1) | SD:732 | Medida el 2026-10-30: `muted` 4,40:1 sobre `surfaceAlt`, `mutedSoft` 2,56:1 sobre blanco; 48 usos de `mutedSoft` | B | turnero | M | visible | `tokens.js` de los fronts + usos de `mutedSoft` | — |
| DS12 | Focus visible en todos los primitivos | SD:738 | Hecha (tanda 1, 2026-10-30): tachada en §9. Probada en el navegador: el selector de país de `CampoTelefono` casi no mostraba el foco con error, y su contenedor ahora lleva `outline` | D | docs | S | — | `sistema_de_disenio.md`, `ConfirmarTurno.jsx` | — |
| DS13 | `set-state-in-effect`: postura unificada | SD:739 | Abierta (off solo en barbero). Con la regla prendida: 13 avisos (10 en barbero, 3 en panel) | B | lint y tooling | S | — | `eslint.config.js` de los fronts | P09 |
| DS15 | `getMisClientes` sin paginación | SD:741 | Abierta | C | app del barbero | M | contrato | `controllers/clientes.js`, `Clientes.jsx` | Base de clientes |
| DS16 | Toast inline → flotante global | SD:742 | Abierta | A | panel | M | visible | `components/ui/Toast.jsx`, callers | — |
| DS17 | Estilo "eyebrow" copiado a mano en el turnero | SD:743 | Abierta | A | turnero | S | — | `frontend-turnero/src/**` | — |
| DS18 | `index.css` repite colores de `tokens.js` | SD:744 | Abierta | C | lint y tooling | M | — | `index.css` de los fronts | E15 |
| DS19 | Hover "pegado" en táctil: falta el turnero | SD:745 | Abierta (sin `useHover`) | A | turnero | S | visible | `Card`, `SlotChip`, `Button` del turnero | — |
| DS20 | `Card` con padding 14, fuera de la escala | SD:746 | Abierta; el default solo lo usan 3 `Card` (2 en `CrearTurno`, 1 en `SeleccionServicio`) | B | turnero | S | visible (3 tarjetas) | `components/ui/Card.jsx` ×3 | — |
| DS21 | Touch target de los días de `SelectorDiaHorario` < 44 px | SD:747 | No medido | A | turnero | S | visible | `SelectorDiaHorario.jsx` | — |
| DS23 | Escala del kiosko como números sueltos | SD:749 | Abierta | A | panel | S | — | `screens/flows/wizard.jsx` | — |
| AUD-1 | TOCTOU sistémico (incluye reserva vs. descanso) | AU:91 | Abierta; razón vigente (sin transacciones) | C | estructura del backend | L | DB | — | — |
| AUD-2 | Idempotency keys para turno, venta y gasto (incluye EA:332) | AU:112 + EA:332 | Abierta; razón vigente | C | estructura del backend | L | contrato | — | — |
| AUD-3 | `tenant_id` en el EXCLUDE + FK compuesto de `turno.cliente_id` | AU:120 | Abierta; razón vigente | C | DB y schema | M | DB | — | — |
| AUD-4a | Anti-abuso extra del turnero (captcha, límite por email) | AU:124 | Abierta; razón vigente (sin abuso visto) | C | turnero | M | — | — | — |
| AUD-4b | El turnero no maneja el 429 en la UI | AU:124 | Abierta | A | turnero | S | — | `frontend-turnero/src/services/api.js` | T09 |
| AUD-5 | Recorte de PII en `getTurnoPorToken` | AU:129 | Cambió: la gestión muestra email y teléfono, que no se editan ahí | B | turnero | S | contrato | `controllers/turnero.js`, `GestionTurno.jsx` | — |
| AUD-6 | `DeprecationWarning` de pg por el `SET statement_timeout` | AU:134 | Abierta (pg ^8.20) | A | estructura del backend | S | regresión (todas las queries) | `config/db.js` | — |
| AUD-7 | Monitoreo de saturación del pool | AU:138 | Abierta; razón vigente | C | estructura del backend | M | — | — | E14 |
| AUD-8 | Función almacenada para stock | AU:140 | Abierta; razón vigente | C | DB y schema | L | DB | — | AUD-1 |
| PF09 | Logo achicado + self-host de las fuentes | PF:43 | Abierta (Google Fonts en `frontend/index.html`) | A | panel | S | visible | `frontend/index.html`, `public/` | — |
| PF10 | Migrar Supabase a `sa-east-1` | PF:40 | Abierta; decisión de infra aparte | C | DB y schema | L | DB | — | — |
| X01 | `fmtPesos` distinto entre fronts | EA:311 (Pendientes) | Confirmada | A | turnero | S | visible | `utils/formato.js` de turnero y barbero | E15 |

## Conteos

**Total: 107 deudas** (113 entradas crudas menos los duplicados y lo que quedó fuera, más X01).

| Área | A | B | C | D | Total |
|---|---|---|---|---|---|
| panel | 21 | 1 | 4 | 1 | 27 |
| estructura del backend | 17 | 2 | 5 | — | 24 |
| turnero | 14 | 4 | 5 | — | 23 |
| validaciones y errores del backend | 12 | 1 | 1 | — | 14 |
| DB y schema | 1 | 4 | 5 | — | 10 |
| lint y tooling | 1 | 1 | 2 | — | 4 |
| docs | — | — | — | 3 | 3 |
| app del barbero | — | — | 1 | — | 1 |
| landing | 1 | — | — | — | 1 |
| **Total** | **67** | **13** | **23** | **4** | **107** |

- **Tamaño:** 76 S · 20 M · 11 L.
- **Riesgo:** 11 tocan la DB, 11 cambian un contrato, 23 con regresión visible y 7 con regresión
  de lógica.
- **Mal anotadas:** 4. E13b y M01 tienen la cantidad desactualizada, M16 cambió de archivo y
  AUD-5 tiene la razón desactualizada.
- **Ya resueltas o que no son deuda:** 4 (clase D).

## Decisiones tomadas (clase B)

Cerradas el 2026-10-30: se aceptaron todas las recomendaciones. Todo va antes del merge, salvo
que el merge se vuelva imprescindible. Estas deudas siguen en clase B en la tabla para que los
conteos no cambien.

| # | id | Decisión |
|---|---|---|
| 1 | E01 | Sacar `ciudad` y `moneda` del default de `crearTenant.js` y borrar el TODO. Las filas existentes no se tocan. |
| 2 | E03 | Conservar `gasto.created_at` como "cuándo se registró", igual que en `movimiento_extra`. Solo se documenta en `SQL_Schema.md`, sin DROP. |
| 3 | E22 | Cerrar `fijo`: confirmar que no haya filas, sacarlo del CHECK y borrar sus ramas de los cálculos (`planillaService`, `SeccionPlanillas`, `MiPlanilla`). Es condición de M06. |
| 4 | M06 | Agregar `corte.comision_porcentaje`, que se completa al crear el corte, con backfill del % actual. Balances y Planillas la leen del corte. Desde ahí, un cambio de % vale solo para adelante. |
| 5 | M12 | Crear las 5 categorías base desde `crearTenant.js` y sumar el FK compuesto `(tenant_id, categoria_id)`, revisando antes que no haya gastos con categoría de otro tenant. |
| 6 | T04 | Unificar en `{ error, codigo? }`. Durante una versión el 422 manda también `mensaje`, para no romper los fronts de producción. |
| 7 | T08 | Conservar los datos del cliente en memoria de la pestaña (sin localStorage), al volver y en "Reservar otro turno" desde el éxito, prellenados y editables. El botón de la gestión es una carga nueva: ahí no se conservan. |
| 8 | F02 | Crear `POST /admin/suspensiones/:id/liberar` y dejar `DELETE` como alias. El alias se saca en un deploy posterior al merge. |
| 9 | P10 | Sacar `ScreenHeader` de Ventas y Gastos, por consistencia con D15. |
| 10 | DS09 | `muted` pasa a `#6B6B74` (4,80:1 sobre `surfaceAlt`) en los cuatro fronts. Se revisan los 48 usos de `mutedSoft`: el texto que haya que leer pasa a `muted`. |
| 11 | DS13 | Apagar `set-state-in-effect` en los cuatro fronts y documentarlo en las convenciones. |
| 12 | DS20 | El default de `Card` pasa a 16. Solo cambian 3 tarjetas. |
| 13 | AUD-5 | El backend deja de devolver el email y el teléfono en `getTurnoPorToken`, y la gestión pierde esas dos filas (queda "A nombre de"). Conviene que el backend y el turnero salgan juntos. |

## Aceptadas o postergadas (clase C)

Las 23 siguen con una razón vigente: E04, E07, E12, E13c, E14, E15, E21, T07a, T09, F03, P02–P05,
DS15, DS18, AUD-1, AUD-2, AUD-3, AUD-4a, AUD-7, AUD-8 y PF10. Para tener en cuenta:
- **E15:** la razón vale, pero la divergencia que advierte volvió a pasar (X01).
- **E13c y DS15:** conviene resolverlas dentro de "Base de clientes", que reescribe esa parte.

## Tandas propuestas

**Criterio:**
- Primero lo que no tiene riesgo.
- Después el backend sin cambio de contrato, que se verifica con controllers y req/res
  simulados contra el tenant demo.
- Después los contratos, antes que los fronts que los consumen.
- Al final la DB, que va directo a producción y depende de decisiones B.

Cada tanda es un chat y un commit sobre `feature/descansos-agenda`. Las clase C no entran.

| # | Tanda | ids | Tamaño | Riesgo | Decisiones B |
|---|---|---|---|---|---|
| 1 | Limpieza y docs | E06, P06, DS08, DS12, E18, M13a, M13c, P20a, P20b, T12c | S | Nulo. DS12 pide mirar el foco de `wizard.jsx` y `ConfirmarTurno.jsx`. | — |
| 2 | Lint en verde y limpieza | DS13, P09, N01, N02, N04 | S | Nulo | 11 |
| 3 | Validaciones y errores del backend | M01, M02, N03, T02, T01, E11, F01, M10, M08, M03, M05, T03, F04 | M | Bajo. T03 y F04 piden el mismo tope en el front y en el back; M03 cambia lo que ve el iPad. | — |
| 4 | Refactors del backend | E05, E17, E19, E10, E20, E13a, E13b, M07, M13b, M04, M11, AUD-6, E02, E01 | M–L | Medio: permisos (E13b), cascada (E13a), stock (M07), mails (E20), pool (AUD-6). M04 y M11 pueden mover totales. | 1 |
| 5 | Contratos backend ↔ fronts | T04, F02, M09, AUD-5 | M | Contrato. El backend nuevo tiene que andar con los fronts viejos. | 6, 8, 13 |
| 6 | Panel | DS16 → P07, P01, P11, P12, P13, P14, P15a, P15b, P15c, P16, P17a, P17b, P18, P19, DS23, PF09, M15, P10 | L | Visible. Verificar en preview y en el iPad (P15b). | 9 |
| 7 | Turnero y landing | T06, T07b, T07c, T10, T11, T12a, T12b, T12d, DS17, DS19, DS21, AUD-4b, X01, M16, T08, DS09, DS20, N05 | M–L | Visible. Sumarla a la prueba en celulares reales del deploy. DS09 y DS20 tocan también el panel y el barbero. | 7, 10, 12 |
| 8 | DB: nullables, categorías y gasto | E23, E03, M12 | M | DB | 2, 5 |
| 9 | Comisiones | E22, M06, P08 | L | DB, contrato y visible (montos de Planillas y Balances) | 3, 4 |

**Notas:**
- **Orden fijo:** 1 → 2 → 3 → 4, porque 3 y 4 tocan los mismos controllers (`caja.js`,
  `gastos.js`). 5 va antes de 6 y 7, porque cambia los `api.js` de los fronts.
- **Paralelo posible:** 6 y 7 tocan fronts distintos, pero DS09 y DS20 los cruzan. Lo más
  simple es correrlas en serie.
- **Decisiones B:** cerradas el 2026-10-30.
- **Docs:** cada tanda saca de `estado_actual.md` y de §9 lo que cierra. Las referencias `EA:` de
  la tabla se corrieron al editar ese doc: hay que buscar cada deuda por su texto.
- **Cambios de DB:** las tandas 8 y 9 agregan columnas, constraints y backfills que se pueden
  aplicar antes del deploy, como la migración de `barbero_suspension`.
- **M06 y el deploy:** `corte.comision_porcentaje` queda nullable hasta que el backend nuevo esté
  en producción; si no, el backend viejo no puede insertar cortes. Después del deploy hay que
  repetir el backfill para los cortes cargados en el medio, y recién ahí ponerle `NOT NULL`.

## Hallazgos durante las tandas

Deudas nuevas, que no estaban en las fuentes. Se suman a las 107 de los conteos de arriba.

| id | deuda | origen | estado verificado | clase | área | tam | riesgo | archivos | tanda |
|---|---|---|---|---|---|---|---|---|---|
| N01 | Citas a `plan_turnero_v2.md`, `plan_horario_atencion.md` y `plan_recordatorio_turnos.md`, que ya no existen | Tanda 1 | Confirmada: 20 citas en 19 archivos | A | docs | S | — | `backend/src`, `frontend*/src` | 2 |
| N02 | Encabezados con la ruta vieja | Tanda 1 | Confirmada: 5 archivos | A | panel | S | — | `BadgeFormaPago`, `BotonExportarExcel`, `SelectorMes`, `SelectorSemana`, `TogglePill` | 2 |
| N03 | `if (!id)` que nunca se cumple: la ruta `/:id` ya garantiza el id | Tanda 1 | Confirmada: `deleteGasto` y `deleteVenta` | A | validaciones y errores del backend | S | — | `controllers/gastos.js`, `controllers/ventas.js` | 3 |
| N04 | §8 y E15 dicen que `utils/fecha.js` es idéntico o copiado entre fronts | Tanda 1 | Del reporte de la tanda 1; no revisada aparte | A | docs | S | — | `sistema_de_disenio.md`, `estado_actual.md` | 2 |
| N05 | Al llegar con Tab al email en `ConfirmarTurno`, el footer fijo tapa parte de la ayuda y del error | Tanda 1 | Del reporte de la tanda 1; no reproducida en la revisión | A | turnero | S | visible | `ConfirmarTurno.jsx`, `StickyFooter.jsx` | 7 |

## Lo que no se pudo verificar

Con navegador o celular:
- T06 (probable por el código).
- T07b, T12a, T12b, E21.
- DS21: el touch target no se midió.

Con la DB:
- E23: los NULLs se vieron solo en `SQL_Schema.md`.
- E22: no se confirmó que no haya filas `fijo`.
- M04: no se buscaron gastos sin categoría.

Solo leído en el código:
- T09: el comportamiento del limiter.

*— Fin del documento —*
