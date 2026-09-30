# Movimientos extra (aportes, retiros y otros ingresos) — núcleo de decisiones

> ✅ **Implementado el 2026-09-30** (branch `feature/movimientos-extra`). Documento de
> decisiones: el "por qué". Schema en [`SQL_Schema.md`](SQL_Schema.md) (`socio`,
> `movimiento_extra`). Implementación: backend `utils/movimientos.js`, `controllers/caja.js`,
> `controllers/balances.js`, `controllers/socios.js`, `services/sociosService.js`; front
> `SeccionCaja.jsx`, `SeccionBalances.jsx`, `utils/movimientos.js`.
> **Pendiente:** migrar los retiros históricos de Kingsai (ver `estado_actual.md` → Pendientes).

## Problema que resolvió

El sistema solo conocía cortes, ventas y gastos. No había dónde registrar plata que entra por
otro motivo (un aporte de los dueños, el alquiler de un sillón), y los retiros de los dueños se
cargaban como gasto (categoría "Otros"). Eso achicaba la ganancia del mes: un mes excelente en
el que los dueños retiraban todo se veía igual que un mes sin ganancia, y el "vs anterior" del
histórico caía cuando retiraban más.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Ganancia vs. capital | Un aporte o un retiro **no** afecta la ganancia; un "otro ingreso" sí. Balances muestra la ganancia del mes y, aparte, `Ganancia del mes + Aportes − Retiros = Queda en el negocio`. | Poner plata propia no es ganar y sacarla no es gastar: la plata pasa de un bolsillo (el negocio) a otro (el dueño). Las dos cifras responden preguntas distintas: cuánto generó el negocio y cuánto quedó. |
| Modelo | Tabla `movimiento_extra` con tres tipos fijos (`aporte_capital`, `retiro_socio`, `otro_ingreso`) y `monto > 0`. La tabla `gasto` no se tocó. | La semántica contable queda en el código, no en cómo se nombra una categoría. Ninguna consulta de gastos cambió. |
| Semántica | Un único mapa en `backend/src/utils/movimientos.js` (`sentido`, `afectaResultado`, `requiereSocio`). La API manda `sentido` resuelto en cada fila; el front no decide por nombre de tipo. | Cambiar el criterio de un tipo es tocar un solo lugar. |
| Dónde se carga | Solo desde el panel (admin), con el "+" de Caja → Movimientos del día. Sin flujo en el iPad. | Es una decisión del dueño y pasa poco. Caja ya es la vista de la plata que entra y sale, con el borrado por fila. |
| Dueños | Tabla `socio` por tenant, elegida con un selector (no texto libre). Vínculo opcional `socio.barbero_id`. Se cargan por SQL. | Totales por dueño exactos. El vínculo va en `socio` porque es opcional (un dueño puede no cortar) y así `barbero` no se toca. Comisión 100% no implica ser dueño: un barbero que alquila el sillón también la tiene. |
| Texto | "Otro ingreso" lleva descripción obligatoria; aporte y retiro no piden texto. | "Otro" no se puede enumerar de antemano; en aporte y retiro alcanza con tipo y dueño. |
| Fecha | Obligatoria en el alta y no futura. Hoy → la hora real; un día pasado → el mediodía de ese día en hora argentina. | Permite cargar un movimiento después; el mediodía evita que un borde de zona horaria lo pase de día. |
| Formas de pago | `efectivo` / `mercado_pago`. | Las del resto del sistema; así los netos de Caja cierran. |
| Alcance | Crear y eliminar; sin edición. | Son pocos movimientos; corregir es borrar y volver a cargar. |
| Integridad | CHECKs que atan el socio y la descripción al tipo; FK compuesto `(tenant_id, socio_id)`; RLS activado en las tablas nuevas. | La base rechaza por sí sola los estados inválidos y las referencias a otro tenant. |
| Nombres en pantalla | "Balance neto" pasó a "Ganancia del mes"; el bloque de capital cierra en "Queda en el negocio". | "Balance neto" sonaba a "lo que quedó al final" y se confundía con el otro número. |

## Reglas de uso (para el dueño)

- El **sueldo** de un dueño por trabajo que la comisión no cubre (administrar, por ejemplo) se
  carga como **gasto**. Retirar ganancia se carga como **retiro**.
- La plata de los **cortes propios** de un dueño (barbero con comisión 100%) ya es suya por la
  comisión: **no** se carga como retiro. Si se cargara, se descontaría dos veces en "Queda en
  el negocio".

## Detalles que conviene recordar

- **Alta:** primero se valida todo lo que viene en el body y al final la única consulta a la
  base (el socio). `monto` sale como número en todas las respuestas nuevas.
- **Histórico:** un mes que solo tiene aportes o retiros aparece con ganancia 0, y el mes
  siguiente queda sin "vs anterior" (no hay porcentaje contra cero).
- **Descripción:** los retiros migrados desde `gasto` conservan su descripción original; los
  cargados desde Caja no tienen.
- **Tenant sin socios:** el formulario no deja guardar aportes ni retiros, porque no hay dueño
  para elegir. Los socios se cargan en el alta del tenant (`onboarding.md`, Paso 2b).
- **Migración de retiros:** filas elegidas a mano entre los gastos de "Otros", con el dueño
  asignado. `INSERT … SELECT` a `movimiento_extra` con fecha y descripción originales, y
  `DELETE` de `gasto`, en una sola ejecución del SQL editor, con respaldo previo en CSV. Se
  corre con el código nuevo ya en producción: con el viejo, los retiros migrados
  desaparecerían de Caja.
- **Deploy:** las tablas antes que el código (si no, Caja y Balances dan 500); el front puede
  terminar de deployar antes que el backend, así que conviene subir en un momento de poco uso.

## Cosas que NO entran (postergado)

- Edición de movimientos extra.
- Pantalla de alta de socios.
- Columnas de aportes y retiros en el histórico en pantalla (están en el Excel).
- Flujo en el iPad para registrar retiros.
- Idempotency key en el alta (misma deuda diferida que venta y gasto; ver `auditoria_2026-07.md`).
