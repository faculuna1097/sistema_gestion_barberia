# Plan — Movimientos extra (aportes, retiros y otros ingresos)

> **Doc de trabajo** (abierto el 2026-09-30, branch `feature/movimientos-extra`). Es la fuente de
> verdad del diseño mientras dura la implementación: todos los chats que ejecutan un paso leen
> este doc. Al cerrar (paso 7) se resume en `decisiones_movimientos_extra.md` y este se borra.
>
> **Las decisiones de §2 están cerradas.** Si al implementar algo no cierra, se frena y se
> reporta; no se redecide en el chat que ejecuta.

---

## 1. Problema

El sistema solo conoce tres movimientos de plata: `corte` y `venta` (entradas) y `gasto`
(salida). Los tres nacen en el iPad; el panel solo lista, edita y borra. No hay forma de
registrar plata que entra por otro motivo (un aporte de capital, el alquiler de un sillón).

Además, los retiros de los dueños se venían cargando como gasto (categoría "Otros"). Como
Balances calcula `balance_neto = ingresos_netos − gastos`, el Balance neto, el "vs anterior" del
histórico y "Egresos por categoría" mostraban ganancia − retiros en vez de ganancia.

Objetivo: poder registrar aportes, retiros y otros ingresos, y que Balances separe el
**resultado del negocio** de los **movimientos de capital** (plata de o para los dueños).

---

## 2. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | Un aporte o un retiro **no** afectan la ganancia; un "otro ingreso" sí. El retiro se muestra descontado un renglón más abajo: `Balance neto − Retiros + Aportes = Queda en el negocio`, con una nota en pantalla. | Poner plata propia no es ganar y sacarla no es gastar. Mezclarlo hace que un mes excelente con retiro total se vea igual que un mes malo, y contamina el "vs anterior". |
| D2 | Tabla nueva `movimiento_extra` con tres tipos fijos (`aporte_capital`, `retiro_socio`, `otro_ingreso`). `gasto` no se toca. | La semántica contable queda en el código, no en cómo alguien nombre una categoría. Ninguna consulta existente de gastos cambia. |
| D3 | Se cargan solo desde el panel (rol admin), en **Caja → Movimientos del día**. No hay flujo en el iPad. | Es una decisión del dueño y pasa poco. Caja ya es la vista de la plata que entra y sale, y tiene el borrado por fila. |
| D4 | Formas de pago: `efectivo` y `mercado_pago`. | Las del resto del sistema; así los netos de Caja cierran. |
| D5 | El dueño se elige con un **selector**. Tabla nueva `socio` por tenant, cargada por SQL (sin pantalla de alta por ahora). Se vincula con `barbero` por una columna opcional `socio.barbero_id`. | Totales por dueño sin errores de tipeo. Las opciones no pueden ir escritas en el front: el código es el mismo para todos los tenants. El vínculo va en `socio` y no en `barbero` porque es opcional (un dueño puede no cortar) y así la tabla central no se toca. Comisión 100% no implica ser dueño. |
| D6 | "Otro ingreso" lleva descripción escrita obligatoria. Aportes y retiros no piden texto. | "Otro" no se puede enumerar de antemano; en aporte y retiro alcanza con tipo y dueño. |
| D7 | MVP: crear y eliminar. Sin edición (corregir = borrar y volver a cargar). | Son pocos movimientos; evita un segundo formulario. |
| D8 | Los retiros históricos se migran de `gasto` a `movimiento_extra`, eligiendo a mano las filas de "Otros" y asignando el dueño a cada una. | No tienen categoría propia. Migrarlos corrige los balances de los meses pasados. |

Descartado: categorías de ingreso definidas por el usuario; reusar `gasto` con montos negativos;
marcar una categoría de gasto como "no es gasto"; guardar la lista de dueños en
`tenant.configuracion`.

---

## 3. Reglas de uso (para el dueño; van al doc de decisiones)

- El **sueldo** de un dueño por trabajo que la comisión no cubre (administrar, por ejemplo) se
  carga como **gasto**. Retirar ganancia se carga como **retiro**.
- La plata de los **cortes propios** de un dueño (barbero con comisión 100%) ya es suya por la
  comisión: **no** se carga como retiro. Si se cargara, se descontaría dos veces en "Queda en
  el negocio".

---

## 4. Modelo de datos

| tipo | sentido | afecta resultado | lleva | en Balances |
|---|---|---|---|---|
| `otro_ingreso` | entrada | sí | descripción | fila en Ingresos → suma al Balance neto |
| `aporte_capital` | entrada | no | socio | bloque "Aportes y retiros" |
| `retiro_socio` | salida | no | socio | bloque "Aportes y retiros" |

```sql
CREATE TABLE public.socio (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  barbero_id uuid,                                                 -- NULL: el dueño no corta
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT socio_pkey PRIMARY KEY (id),
  CONSTRAINT socio_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT socio_tenant_id_id_key UNIQUE (tenant_id, id),        -- target del FK compuesto
  CONSTRAINT socio_tenant_nombre_key UNIQUE (tenant_id, nombre),
  CONSTRAINT socio_barbero_id_key UNIQUE (barbero_id),             -- un barbero es, a lo sumo, un socio
  CONSTRAINT socio_barbero_tenant_fkey FOREIGN KEY (tenant_id, barbero_id) REFERENCES public.barbero(tenant_id, id)
);

CREATE TABLE public.movimiento_extra (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['aporte_capital'::text, 'retiro_socio'::text, 'otro_ingreso'::text])),
  socio_id uuid,                                              -- aporte/retiro: obligatorio; otro_ingreso: NULL
  descripcion text,                                           -- otro_ingreso: obligatoria
  monto numeric NOT NULL CHECK (monto > 0),                   -- el signo lo da el tipo
  forma_pago text NOT NULL CHECK (forma_pago = ANY (ARRAY['efectivo'::text, 'mercado_pago'::text])),
  timestamp timestamp with time zone NOT NULL DEFAULT now(),  -- cuándo se movió la plata
  created_at timestamp with time zone NOT NULL DEFAULT now(), -- cuándo se registró (auditoría)
  CONSTRAINT movimiento_extra_pkey PRIMARY KEY (id),
  CONSTRAINT movimiento_extra_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  -- FK compuesto (estándar de la auditoría 2.1): un movimiento no puede apuntar a un socio de otro tenant.
  CONSTRAINT movimiento_extra_socio_tenant_fkey FOREIGN KEY (tenant_id, socio_id) REFERENCES public.socio(tenant_id, id),
  CONSTRAINT movimiento_extra_socio_segun_tipo CHECK (
    (tipo = 'otro_ingreso' AND socio_id IS NULL) OR (tipo <> 'otro_ingreso' AND socio_id IS NOT NULL)
  ),
  CONSTRAINT movimiento_extra_descripcion_otro_ingreso CHECK (
    tipo <> 'otro_ingreso' OR (descripcion IS NOT NULL AND btrim(descripcion) <> '')
  )
);
```

Notas:
- `monto > 0` siempre; el signo sale del tipo, nunca del número.
- `timestamp` es cuándo se movió la plata (puede ser un día pasado); `created_at`, cuándo se
  registró. Mismo nombre de columna que corte/venta/gasto para reusar los filtros por día y por mes.
- `descripcion` queda permitida (opcional) en aporte y retiro: la API no la escribe, pero los
  retiros migrados conservan ahí su texto original.
- Sin índices extra: son decenas de filas por año por tenant.
- Los socios no se borran: se desactivan (`activo = false`), como el resto de los catálogos.
- `socio.barbero_id` no lo lee nadie en esta feature: queda para un futuro reporte de cuánto se
  llevó cada dueño (comisión de sus cortes + retiros). `socio.nombre` se guarda aparte aunque
  haya vínculo; si se renombra el barbero, el socio se renombra a mano.
- Las dos tablas nacen con RLS activado y sin policies: la API automática de Supabase queda
  cerrada y el backend entra igual, porque se conecta como dueño de las tablas. En el mismo
  paso 1 se activó también en las 13 tablas existentes que no lo tenían (ver `estado_actual.md`
  → Decisiones arquitecturales).

Estado de la base al cerrar el paso 1 (2026-09-30): las dos tablas existen en producción y sus
restricciones están probadas (9 cargas inválidas rechazadas, 2 válidas aceptadas). Socios
cargados: en demo, "Dueño Demo 1" y "Dueño Demo 2" (sin barbero); en Kingsai, "Migue" y "Tute"
(vinculados a su barbero). `movimiento_extra` está vacía.

---

## 5. Semántica central

Una sola fuente en el backend, `backend/src/utils/movimientos.js`:

```js
export const TIPOS_MOVIMIENTO_EXTRA = {
  aporte_capital: { sentido: 'entrada', afectaResultado: false, requiereSocio: true  },
  retiro_socio:   { sentido: 'salida',  afectaResultado: false, requiereSocio: true  },
  otro_ingreso:   { sentido: 'entrada', afectaResultado: true,  requiereSocio: false },
};
```

Ningún otro archivo del backend decide por nombre de tipo si algo suma, resta o afecta la
ganancia: todos consultan este mapa (o sus helpers `esTipoMovimientoExtra`,
`sentidoDeMovimiento`, `resumirMovimientosExtra`). El front recibe `sentido` ya resuelto.

Fórmulas de Balances:

```
otros_ingresos  = Σ monto de los tipos con afectaResultado
ingresos_brutos = servicios + productos + otros_ingresos
ingresos_netos  = ingresos_brutos − total_comisiones
balance_neto    = ingresos_netos − egresos            (no incluye aportes ni retiros)
aportes         = Σ aporte_capital
retiros         = Σ retiro_socio
queda en el negocio (lo calcula el front) = balance según el botón de comisiones + aportes − retiros
```

---

## 6. Contrato de la API

Todas las rutas son solo admin. `/api/caja` y `/api/balances` ya se montan con
`requiereRol('admin')` en `index.js`; `/api/admin/socios` se monta igual.

### 6.1 `GET /api/admin/socios`
200 → `[{ id, nombre }]`, solo activos, por nombre.

### 6.2 `POST /api/caja/movimientos`
Body: `{ tipo, monto, forma_pago, fecha, socio_id?, descripcion? }`. Validaciones, en este orden
(primero las que solo miran el body; la única que consulta la base va al final):

| Campo | Regla | Si falla |
|---|---|---|
| `tipo` | uno de los tres | 400 |
| `monto` | número (o string numérico) finito > 0 | 400 |
| `forma_pago` | `efectivo` o `mercado_pago` | 400 |
| `socio_id` | obligatorio si el tipo requiere socio | 400 |
| `descripcion` | obligatoria en `otro_ingreso`: texto de 1 a 200 caracteres (tras trim) | 400 |
| `fecha` | **obligatoria**; `YYYY-MM-DD` válida | 400 `fecha es requerida y debe tener formato YYYY-MM-DD` |
| `fecha` | no futura (hora argentina) | 400 `fecha no puede ser futura` |
| `socio_id` | existe, es del tenant y está activo | 404 `Socio no encontrado o inactivo` |

- `fecha` es obligatoria (decisión del usuario en el paso 2): el front la precarga con el día que
  se está viendo; si llega vacía es porque se borró a mano, y no se asume ninguna.
- En `otro_ingreso` se guarda `socio_id = NULL`; en aporte y retiro, `descripcion = NULL`
  (lo que venga en el body se ignora).
- `fecha` de hoy → `timestamp = NOW()`. Día pasado → mediodía de ese día en hora argentina:
  `($fecha::date + TIME '12:00') AT TIME ZONE $tz`.
- 201 → `{ id, tipo, socio_id, descripcion, monto, forma_pago, timestamp }`, con `monto` como número.
- Un POST sin body responde 400 (no 500): el handler usa `req.body || {}`.
- Violación del FK del socio (23503) → 404, como red de seguridad.
- El INSERT usa el reintento por defecto de `query()`, igual que `gasto` (deuda diferida #2 de
  la auditoría: fila duplicada visible y borrable).

### 6.3 `GET /api/caja/movimientos-dia?fecha=YYYY-MM-DD`
- `fecha` es opcional (sin ella devuelve hoy); si viene y es inválida → 400 (antes daba 500).
- Suma las filas de `movimiento_extra` del día. En esas filas: `tipo` es uno de los tres,
  `barbero_nombre` y `comision_valor` son `null`, y `detalle` es el nombre del socio (seguido de
  ` — descripción` si la fila tiene) o la descripción.
- **Todas** las filas (también corte, venta y gasto) traen `sentido: 'entrada' | 'salida'` y
  `monto` como número (antes era el string de pg).
- Las cuatro consultas corren en paralelo.

### 6.4 `DELETE /api/caja/movimientos/:tipo/:id`
Acepta los tres tipos nuevos. Borra por `id`, `tenant_id` y `tipo`. 404 si no borró nada.

### 6.5 `GET /api/balances/mensual?mes=YYYY-MM`
Campos nuevos (los existentes no cambian de forma):

```
otrosIngresos: { total, detalle: [{ id, fecha, descripcion, monto, forma_pago }] }
capital: {
  aportes, retiros,
  detalle:  [{ id, fecha, tipo, socio_id, socio_nombre, descripcion, monto, forma_pago }],
  porSocio: [{ socio_id, nombre, aportes, retiros }]
}
resumen: { …los de hoy, otros_ingresos, aportes, retiros }
```
`fecha` va canónica (`YYYY-MM-DD`); los montos, como número. `resumen.ingresos_brutos` pasa a
incluir otros ingresos.

### 6.6 `GET /api/balances/historico`
Cada mes suma `otros_ingresos`, `aportes` y `retiros`. `ingresos_brutos` incluye otros ingresos.
`balance_neto` y `variacion_vs_anterior` no incluyen capital. Un mes que solo tiene movimientos
extra también aparece.

---

## 7. Archivos

### Backend (`backend/src`)
| Archivo | Paso | Cambio |
|---|---|---|
| `utils/movimientos.js` (nuevo) | 2 | Mapa de §5 + `esTipoMovimientoExtra`, `sentidoDeMovimiento(tipo)` (cubre también corte, venta y gasto), `resumirMovimientosExtra(filas)`. |
| `utils/validarNumero.js` | 2 | Sumar `esMontoPositivo`. |
| `utils/validarFecha.js` (nuevo) | 2 | `esFechaISO(valor)` (formato + fecha real; rechaza el año 0000, que Postgres no tiene), `esFechaFutura(fechaISO)`, `hoyISO()`. |
| `services/sociosService.js` (nuevo) | 2 | `socioActivoEnTenant`, espejo de `barberosService.barberoActivoEnTenant`. |
| `controllers/socios.js`, `routes/adminSocios.js` (nuevos) | 2 | `getSocios`. |
| `index.js` | 2 | Montar `/api/admin/socios`. |
| `controllers/caja.js`, `routes/caja.js` | 2 | §6.2, §6.3, §6.4. |
| `controllers/balances.js` | 4 | §6.5, §6.6. |

### Frontend (`frontend/src`)
| Archivo | Paso | Cambio |
|---|---|---|
| `utils/movimientos.js` (nuevo) | 3 | Labels de los tipos de movimiento y opciones del selector. Lo usan Caja y Balances. |
| `utils/formato.js` | 3 | `OPCIONES_FORMA_PAGO` centralizada; `SeccionGastos` y `SeccionVentas` pasan a importarla. |
| `screens/admin/sections/SeccionCaja.jsx` | 3 | Pill con los tres tipos; signo por `sentido`; Excel; carga de socios; botón + modal de alta; chequeo de `res.ok` al cargar. |
| `screens/admin/sections/SeccionBalances.jsx` | 5 | Fila "Otros ingresos"; bloque "Aportes y retiros" con "Queda en el negocio" y nota; `sinMovimientos`; Excel. |

### No se toca
Inicio, Planillas, el flujo del iPad, el turnero, la app del barbero, la tabla `gasto` y sus
consultas, y el filtro "Solo Barberos" de Caja.

---

## 8. Pasos y estado

| # | Paso | Dónde | Estado |
|---|---|---|---|
| 0 | Branch `feature/movimientos-extra` | orquestador | ✅ |
| 1 | Base de datos: tablas `socio` y `movimiento_extra`, carga de socios, `SQL_Schema.md` | orquestador | ✅ 2026-09-30 |
| 2 | Backend de Caja y socios | chat aparte | ✅ 2026-09-30 |
| 3 | Frontend de Caja | chat aparte | ✅ 2026-09-30 (probado en el navegador) |
| 4 | Backend de Balances | chat aparte | ✅ 2026-09-30 |
| 5 | Frontend de Balances | chat aparte | 🔲 |
| 6 | Migración de los retiros históricos | orquestador | 🔲 |
| 7 | Documentación final | orquestador | 🔲 |

Orden de deploy: las tablas antes que el código (si no, Caja y Balances dan 500); backend antes
que frontend; la migración al final, con todo en producción.

Decisiones de UI del paso 3 (cerradas con el usuario el 2026-09-30):
- **Entrada:** un "+" en la fila de las pestañas de Caja, a la derecha, solo en "Movimientos del
  día". No es un botón de uso cotidiano. Lleva borde índigo de 2 px (pedido del usuario al ver la
  pantalla, para que resalte); el ícono es gris y pasa a negro al pasar el mouse.
- **Formulario:** modal "Registrar movimiento", coherente con los demás modales del panel;
  botones "Cancelar" y "Guardar".
- **Campos, en orden:** Tipo; Dueño (aporte y retiro) o Descripción (otro ingreso); Monto;
  Forma de pago; Fecha.
- **Opciones como botones, no listas desplegables:** Tipo ("Retiro", "Aporte de capital",
  "Otro ingreso"), Dueño y Forma de pago. Tipo y Forma de pago arrancan sin elegir. Dueño viene
  elegido solo si hay uno.
- **Fecha:** arranca en el día que se está viendo en Caja; no admite fechas futuras.
- **Guardar** queda deshabilitado hasta que todo esté elegido y sea válido. Sin carteles de
  aviso (tampoco si no hay dueños cargados).
- **Etiquetas de tipo en la tabla:** "Aporte" y "Retiro" en gris neutro; "Otro ingreso" en
  verde, como Corte. El retiro se distingue por el monto: con "−" y en rojo, como un gasto.
- **Columnas:** Detalle muestra el dueño o la descripción; Barbero muestra "—".
- **Al guardar:** se cierra el modal y la lista se recarga; si la fecha era otro día, Caja
  salta a ese día.

Decisiones de UI del paso 5 (cerradas con el usuario el 2026-09-30):
- **Otros ingresos:** una fila con el total en "Ingresos por barbero", igual que "Productos
  vendidos". Solo si hay.
- **Bloque "Aportes y retiros":** debajo de "Egresos por categoría", una fila por dueño (Dueño,
  Aportes, Retiros). Solo si el mes tiene aportes o retiros. El detalle por movimiento queda en
  Caja y en el Excel.
- **"Balance neto" pasa a llamarse "Ganancia del mes"** en la tarjeta, y "Balance" pasa a
  "Ganancia" en la columna y el Excel del histórico. Así cada número dice lo que es: "Ganancia
  del mes" (lo que generó el negocio) y "Queda en el negocio" (lo que quedó después de los
  dueños). Solo cambia el texto; el campo de la API sigue siendo `balance_neto`.
- **Cierre del bloque:** la cuenta completa, para que se vea de dónde sale el número: "Ganancia
  del mes", "+ Aportes", "− Retiros" y la fila destacada "Queda en el negocio" (misma línea
  índigo de los totales).
- **Nota al pie del bloque:** "Los aportes y retiros no son ingresos ni gastos del negocio: no
  cambian la ganancia del mes."
- **Colores:** aportes en negro, retiros en rojo; "Queda en el negocio" en índigo si es positivo
  y en rojo si es negativo, como la ganancia.
- **Tarjetas de arriba:** las tres de hoy; "Ingresos del negocio" incluye los otros ingresos.
- **Histórico en pantalla:** sin columnas nuevas; en el Excel se suman Otros ingresos, Aportes y
  Retiros. Se revisa después si hace falta una columna en pantalla.
- **Excel del mes:** fila "Otros ingresos" en la hoja de ingresos; hoja "Aportes y retiros" con
  cada movimiento (fecha, dueño, tipo, descripción, forma de pago, monto) y el cierre; hoja con
  el detalle de los otros ingresos.

Datos de prueba que quedaron en demo tras los pasos 2 y 4 (sirven para probar los pasos 3 y 5;
se pueden borrar desde Caja):
- 2026-09-30: aporte de $50.000 (Dueño Demo 1), otro ingreso de $5.000 ("Alquiler de sillón"),
  otro ingreso de $1 con una descripción de 200 caracteres, y retiro de $777 (Dueño Demo 1, con
  la descripción "Retiro migrado (test)", como quedarían los retiros migrados).
- 2026-09-29: otro ingreso de $1.500,50.
- 2026-08-31: otro ingreso de $2.000 ("Borde de mes (test paso 4)"), aporte de $3.000 por
  Mercado Pago (Dueño Demo 2) y retiro de $500 (Dueño Demo 1).
- 2026-02-15: retiro de $1.234 (Dueño Demo 2). Es un mes que solo tiene este movimiento.
- Un socio inactivo, "Socio Inactivo (test)": no debe aparecer en ningún selector.

Con esos datos, Balances de demo da: septiembre, otros ingresos 6.501,50, aportes 50.000,
retiros 777; agosto, otros ingresos 2.000, aportes 3.000, retiros 500; febrero, retiros 1.234.

A tener en cuenta en el paso 5:
- En `capital.detalle`, `descripcion` viene `null` en los aportes y retiros cargados desde Caja
  y con texto en los migrados.
- Un mes que solo tiene aportes o retiros aparece en el histórico con `balance_neto` 0, y el mes
  siguiente queda con `variacion_vs_anterior` en `null`.

### Cómo se ejecuta
Un chat orquesta (diseño, prompts, revisión del diff) y cada paso de código se ejecuta en un
chat aparte, en esta misma carpeta y branch. El chat que ejecuta puede leer los archivos que
necesite. Las verificaciones de backend las corre ese mismo chat contra el tenant demo, llamando
a los controllers con `req`/`res` simulados, sin levantar el servidor. Al terminar entrega un
reporte con:

1. Archivos creados y modificados.
2. Desvíos respecto del prompt y por qué.
3. Qué se verificó, con qué resultado, y qué no se pudo verificar.
4. Dudas o decisiones que quedaron abiertas.
5. Cosas vistas de paso, verificadas contra los docs.
6. Mensaje de commit propuesto.

---

## 9. Verificación de punta a punta (tenant demo)

1. Caja, hoy: cargar un retiro de $10.000 en efectivo (dueño A), un aporte de $50.000 por
   Mercado Pago (dueño B) y un otro ingreso de $5.000 en efectivo. El efectivo neto baja 5.000 y
   el de Mercado Pago sube 50.000.
2. Balances del mes: Ingresos +5.000; Balance neto +5.000; bloque "Aportes y retiros" con
   +50.000 (B) y −10.000 (A); "Queda en el negocio" = Balance neto + 40.000; nota visible.
3. Histórico: el mes actual coincide con el mensual; "vs anterior" solo se mueve por los 5.000.
4. Un movimiento con fecha del último día del mes anterior cae en ese mes, no en el actual.
5. Eliminar los cuatro: Caja y Balances vuelven a los valores iniciales.
6. Kingsai no ve esos movimientos ni los socios de demo.

---

## 10. Deudas detectadas durante el diseño

Verificadas contra los docs el 2026-09-30: ninguna estaba anotada. Se pasan a `estado_actual.md`
en el paso 7.

Se arreglan de paso, porque se tocan esas mismas líneas:
- `SeccionCaja` no chequea `res.ok` al cargar: un 500 se ve como "Sin movimientos" (paso 3).
- `getMovimientosDia` no validaba `fecha`: una fecha inválida daba 500 en vez de 400
  (resuelto en el paso 2).

Se anotan:
- `getCategorias` no filtra `activo`, aunque su comentario dice "activas".
- Gasto sin categoría: Gastos usa `LEFT JOIN`; Balances mensual y Caja usan `JOIN`; el histórico
  no hace join. Los totales pueden no coincidir.
- El "vs anterior" del histórico ignora el botón de comisiones.
- La comisión no queda guardada en el corte: cambiar el % de un barbero cambia los balances pasados.
- `gasto.categoria_id` no se valida contra el tenant (la auditoría cubrió barbero, servicio y producto).
- El borrado de gastos y ventas está implementado dos veces (`gastos.js`/`ventas.js` y `caja.js`).
- `REGEX_FECHA` está copiada en 5 controllers.
- El alta de un tenant no crea categorías de gasto y `onboarding.md` no las menciona (a verificar).
- `req.body` sin fallback en Express 5: 27 handlers en 15 controllers desestructuran `req.body`
  directo; un POST o PUT sin body tira `TypeError` y responde 500 en vez de 400. Arreglo de una
  línea para todos: un middleware después de `express.json()` que haga `req.body ??= {}`.
- Borrar con un `id` que no es UUID da 500 en todas las ramas de `eliminarMovimiento` (`22P02`
  solo se maneja en los services).
- Los montos salen como texto (NUMERIC de pg) en varias respuestas (`createGasto`, los listados
  de gastos y ventas); `movimientos-dia`, el alta de movimientos y Balances ya devuelven
  números. Falta una regla única.
- Comentario viejo en `index.js`: el bloque "RUTAS DEL BACKOFFICE" dice "admin + barbero", pero
  la mayoría de sus rutas son solo admin.
- `getBalanceHistorico` acepta `cantidad` negativa: `?cantidad=-5` deja la ventana en el futuro y
  responde `[]` en vez de 400 o del valor por defecto.
- El mensual redondea la comisión por barbero y después suma; el histórico suma sin redondear.
  Pueden diferir en centavos.
- Caja esconde todo mientras carga o si falla: el estado de carga y el de error reemplazan
  también el selector de día y los totales. Si un día falla, solo queda "Reintentar" y no se
  puede cambiar de día sin salir de la sección.
- Los errores sin mensaje del servidor se muestran crudos en los modales de Caja, Gastos y
  Ventas: "Failed to fetch" si no hay red, o el texto del parser si la respuesta no es JSON (un
  502 del proxy). Arreglar los tres juntos con un mensaje genérico en español.
- Una etiqueta neutra (`surfaceAlt`) sobre una fila con hover (`surfaceAlt`) pierde el fondo al
  pasar el mouse: pasa con "Aporte" y "Retiro" en Caja y con `BadgeCategoria` en Gastos.
- Tamaños escritos a mano: `fontSize: 13` en los bloques de error de Gastos y Ventas; 15 y 12 en
  `Field`. Además, `Field` no acepta `maxLength`.
- Los textos de las formas de pago viven en tres lugares (`formatPago`, `OPCIONES_FORMA_PAGO` y
  `BadgeFormaPago`), y el Excel de Gastos usa un ternario propio.
- `BotonFormaPago` de `SeccionTurnero` y `GrupoOpciones` de `SeccionCaja` son el mismo patrón
  (con su rótulo `labelEyebrow` duplicado). Al unificarlos, promover `GrupoOpciones` a `/ui`.
- Menores: `gastos.js` sin JSDoc; comentario viejo en `SeccionGastos.jsx` ("id numérico");
  encabezado de `SelectorDia.jsx` con la ruta vieja; consultas secuenciales en
  `getGastosMensual` (las de `getMovimientosDia` se paralelizan en el paso 2).
- Propias de esta feature: sin edición de movimientos; sin pantalla de alta de socios.
