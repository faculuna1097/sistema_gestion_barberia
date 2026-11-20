# Features del sistema — qué hace BarberManager hoy

> Inventario de lo que el sistema hace **en producción**, contado para el dueño de una barbería. Sirve de base para
> contar mejor en la landing todo lo que hace. Fecha de corte: **2026-11-19** (incluye mejoras operativas, PR #13).
>
> **Cómo mantenerlo:** cuando una feature llega a producción, se suma acá en su superficie, con el mismo formato.
> Lo que está en curso o pendiente va en la sección 7 hasta que salga. El "por qué" de cada feature no va acá: vive
> en su `decisiones_*.md`, y "Dónde vive" apunta ahí.
>
> **Formato de cada feature:** nombre, qué hace en una o dos líneas, y un renglón con **Para** (a quién le sirve) y
> **Dónde vive** (doc de decisiones o código).

---

## 1. BarberManager en un párrafo

Un solo sistema para la barbería: el **turnero online** donde los clientes reservan solos, la **app de cada
barbero** en su celular, el **iPad del local** donde se cobra cada corte, venta y gasto, y el **panel del dueño**
con la caja, las planillas, lo que le toca a cada barbero y el balance del mes. Todo está conectado: lo que reserva
el cliente aparece en la agenda del barbero, se cobra en el iPad y termina en la caja y en las planillas, sin
cargarlo dos veces. Funciona desde el navegador, sin instalar nada, con barberos ilimitados y precio fijo en pesos.

---

## 2. Turnero (el cliente del local)

En `tulocal.barbermanager.app/turnos`, sin cuenta ni contraseña.

- **La página del local.** Foto del local, servicios con precio y duración, el equipo, el horario de la semana,
  la dirección y el teléfono. Tocar un servicio o un barbero lleva directo a reservar con eso elegido. El botón de
  WhatsApp y "Dejanos tu reseña en Google" aparecen solo si el local cargó el número y el link.
  **Para:** cliente, y el dueño que comparte un solo link en Instagram o WhatsApp. **Dónde vive:**
  [`decisiones_turnero_ux.md`](decisiones_turnero_ux.md); `frontend-turnero/src/screens/Landing.jsx`.

- **Reserva en 3 pasos.** Servicio → ¿Cuándo? (barbero, día y horario) → Confirmá tu turno (resumen y datos). El
  celular completa solo nombre, mail y teléfono; el "atrás" del celular vuelve un paso sin perder lo cargado.
  **Para:** cliente. **Dónde vive:** [`decisiones_turnero_ux.md`](decisiones_turnero_ux.md).

- **"Cualquier barbero".** La primera opción: el cliente no tiene que elegir, y el sistema le asigna el barbero con
  menos turnos ese día. Si justo se ocupa el horario, prueba solo con otro barbero libre.
  **Para:** cliente (reserva más rápido) y dueño (reparte el trabajo). **Dónde vive:**
  [`decisiones_turnero_ux.md`](decisiones_turnero_ux.md) → "Cualquier barbero".

- **Solo horarios que de verdad están libres.** El turnero ofrece únicamente lo que respeta el horario del local,
  los feriados, el horario de cada barbero, sus descansos y sus ausencias. Dos clientes nunca quedan en el mismo
  horario con el mismo barbero, aunque reserven en el mismo segundo.
  **Para:** dueño y barbero (se terminan los turnos pisados). **Dónde vive:**
  [`decisiones_turnero.md`](decisiones_turnero.md) → "Algoritmo de disponibilidad"; `disponibilidadService.js`.

- **Turno confirmado.** El día y la hora bien grandes, quién atiende, "Agregar al calendario" (Calendario de Apple o
  Google según el celular) y la dirección como link al mapa.
  **Para:** cliente. **Dónde vive:** [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F10);
  `frontend-turnero/src/screens/TurnoConfirmado.jsx`.

- **El cliente maneja su turno desde el mail.** Con el link del mail ve el turno, lo agrega al calendario, lo
  cancela o lo reprograma, sin llamar al local. Una vez que el turno empezó ya no lo puede tocar: tiene que hablar
  con el local.
  **Para:** cliente, y el dueño que deja de atender mensajes para mover turnos. **Dónde vive:**
  [`decisiones_turnero_ux.md`](decisiones_turnero_ux.md), [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md)
  (F9); `frontend-turnero/src/screens/GestionTurno.jsx`.

- **Mails al cliente.** Confirmación al reservar (con el link para manejar el turno), aviso al cancelar o
  reprogramar, y aviso si el local cancela el turno (por una ausencia del barbero, un feriado o un cambio de
  horario), con el link para sacar otro.
  **Para:** cliente. **Dónde vive:** `backend/src/services/mail/mailer.js`;
  [`decisiones_mail_entregabilidad.md`](decisiones_mail_entregabilidad.md).

- **Recordatorio la noche anterior.** A las 20:30 le llega un mail a cada cliente con turno al día siguiente, con el
  link para cancelar o reprogramar si no puede ir. Se activa por local.
  **Para:** dueño (menos clientes que faltan) y cliente. **Dónde vive:**
  [`decisiones_mail_recordatorio.md`](decisiones_mail_recordatorio.md).

- **Reseñas en Google, con QR para la puerta.** Un link propio del local (`/turnos/resena`) que lleva al formulario
  de reseñas de Google. Es el mismo para la página del turnero y para un QR impreso: si Google cambia el link, se
  actualiza el dato y el cartel sigue andando.
  **Para:** dueño (más reseñas). **Dónde vive:** [`decisiones_turnero_ux.md`](decisiones_turnero_ux.md) →
  "Reseñas en Google"; [`onboarding.md`](onboarding.md) → "Cargar el WhatsApp y el link de reseñas".

- **Se ve bien en el celular, en la compu y en el iPad.** Pensado para el iPhone que abre el link desde Instagram.
  En una pantalla grande muestra el panel del local a la izquierda y la reserva al lado.
  **Para:** cliente. **Dónde vive:** [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F11).

---

## 3. App del barbero

En `tulocal.barbermanager.app/barbero`, en el celular de cada barbero.

- **Entrar con su foto y su PIN.** Elige su cara en la grilla del equipo y pone su PIN. El celular lo recuerda 30
  días: no tiene que entrar cada vez.
  **Para:** barbero. **Dónde vive:** [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F5);
  `frontend-barbero/src/components/Login.jsx`.

- **Su agenda, del día y de la semana.** Los turnos con cliente y servicio, ordenados por los horarios del local,
  con los descansos y las ausencias a la vista y en gris las horas en las que no atiende.
  **Para:** barbero ("llega y ya sabe cómo viene el día"). **Dónde vive:**
  [`decisiones_descansos.md`](decisiones_descansos.md); `frontend-barbero/src/components/Agenda.jsx`.

- **Descansos.** Si tiene un hueco libre y se va a comer, lo marca y el turnero deja de ofrecerlo. Lo puede
  liberar o terminar antes, y esos horarios vuelven a estar disponibles. Un descanso nunca cancela un turno.
  **Para:** barbero (nadie le ocupa el hueco a último momento) y dueño (lo controla en Planillas, ver 5). **Dónde
  vive:** [`decisiones_descansos.md`](decisiones_descansos.md).

- **Su horario y sus días libres.** Carga y cambia su horario semanal y sus ausencias (vacaciones, un día libre). El
  turnero se acomoda solo. Si el dueño achica el horario del local y le deja horarios afuera, la app le avisa.
  **Para:** barbero. **Dónde vive:** [`decisiones_horario_atencion.md`](decisiones_horario_atencion.md);
  `frontend-barbero/src/components/Gestion.jsx`.

- **Cargar un turno en segundos.** Para el cliente que pide turno en persona o por mensaje: busca al cliente entre
  los del local o carga uno nuevo. Y si no hay tiempo, **turno rápido "Sin datos"**: reserva el horario sin cliente
  y le asigna uno después.
  **Para:** barbero. **Dónde vive:** [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F1);
  `frontend-barbero/src/components/CrearTurno.jsx`, `agenda/HojaReservar.jsx`.

- **"No asistió" y cancelar.** Marca al cliente que no vino o cancela un turno desde la agenda. El turno se da por
  hecho solo cuando se cobra el corte, así la planilla no miente.
  **Para:** barbero y dueño. **Dónde vive:** [`decisiones_descansos.md`](decisiones_descansos.md) → "Completar un
  turno".

- **Pasarle un turno a otro barbero.** Ofrece un turno suyo a un compañero que tenga ese horario libre; el otro lo
  acepta o lo rechaza desde los avisos de la app (la campanita). El cliente no se entera ni pierde su turno.
  **Para:** barbero (si le surge algo, no cancela al cliente). **Dónde vive:**
  [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F2); `components/traspasos/`,
  `components/avisos/`.

- **Mi planilla.** Sus cortes de la semana (cuáles vinieron con turno y cuáles sin turno), lo que le toca cobrar con
  comisión y propinas, y sus descansos.
  **Para:** barbero (sabe cuánto lleva sin preguntarle al dueño). **Dónde vive:**
  [`decisiones_descansos.md`](decisiones_descansos.md) → "Feature 2"; `frontend-barbero/src/components/MiPlanilla.jsx`.

- **Sus turnos en su Google Calendar.** Si tiene el mail cargado, cada turno nuevo le aparece solo en su
  calendario, y se borra si se cancela.
  **Para:** barbero. **Dónde vive:** [`decisiones_turnero.md`](decisiones_turnero.md) → "Google Calendar".

---

## 4. iPad del local (modo operativo)

En `tulocal.barbermanager.app`, en el iPad o la compu del mostrador.

- **Siempre abierto.** Se entra una vez con el usuario y la contraseña del local, y queda abierto. Si se olvida la
  contraseña, "¿Olvidaste tu contraseña?" manda un link al mail del dueño para elegir una nueva.
  **Para:** quien cobra en el mostrador, y el dueño (no depende de nadie para recuperarla). **Dónde vive:**
  [`decisiones_login_operativo.md`](decisiones_login_operativo.md), [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F6).

- **Cobrar un corte.** Barbero, servicio, efectivo o Mercado Pago, y la propina. Se cobra sobre el turno del día
  (que queda completado) o como cliente sin turno. El botón de confirmar siempre a la vista.
  **Para:** quien cobra. **Dónde vive:** `frontend/src/screens/flows/FlujoCorte.jsx`.

- **Registrar una venta.** Productos vendidos y forma de pago; el stock se descuenta solo.
  **Para:** quien cobra y dueño. **Dónde vive:** `frontend/src/screens/flows/FlujoVenta.jsx`.

- **Registrar un gasto.** Con su categoría (insumos, limpieza, alquiler, productos para venta, etc.). Un gasto de
  productos para venta recuerda actualizar el stock.
  **Para:** dueño. **Dónde vive:** `frontend/src/screens/flows/FlujoGasto.jsx`;
  [`onboarding.md`](onboarding.md) (las 9 categorías).

- **Aviso de turnos sin cobrar.** Muestra los turnos que ya terminaron y nadie cobró. Desde 20 minutos antes del
  cierre pasa a alerta y no se puede ocultar, para que no se vaya nadie sin cobrar.
  **Para:** dueño (no se pierde plata en la planilla). **Dónde vive:**
  [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F3).

- **Del iPad al panel con el candado.** Con el PIN se pasa al panel del dueño, o a la vista de un barbero (ver 5).
  **Para:** dueño y barbero. **Dónde vive:** [`decisiones_login_operativo.md`](decisiones_login_operativo.md).

---

## 5. Panel de gestión (el dueño)

- **Entrar con el PIN.** El mismo acceso sirve para el dueño (ve todo) y para cada barbero (ve lo suyo). Si el dueño
  se olvida el PIN, "¿Olvidaste tu PIN?" le manda un link a su mail.
  **Para:** dueño. **Dónde vive:** [`decisiones_acceso_barberos.md`](decisiones_acceso_barberos.md),
  [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F6).

- **Inicio.** Las estadísticas del día y del mes, las alertas de stock y los turnos sin cobrar.
  **Para:** dueño (en un vistazo, cómo viene el negocio). **Dónde vive:** `sections/SeccionInicio.jsx`.

- **Caja del día.** Todo lo que entró y salió en el día, separado en efectivo y Mercado Pago. Desde ahí se cargan
  los aportes de los dueños, los retiros y otros ingresos (por ejemplo, el alquiler de un sillón). "Solo Barberos"
  saca de la vista los cortes de los socios.
  **Para:** dueño. **Dónde vive:** [`decisiones_movimientos_extra.md`](decisiones_movimientos_extra.md);
  `sections/SeccionCaja.jsx`.

- **Planillas semanales.** Por barbero: cortes, cuántos vinieron con turno, lo que hay que pagarle (comisión y
  propinas), y el detalle de cada día. Tocando un barbero se ve todo lo suyo: total por día, por forma de pago,
  cuánta plata entró por el turnero y el registro de sus descansos (cuántos, cuánto tiempo, qué parte de la jornada
  y con cuánta anticipación los marcó).
  **Para:** dueño (paga a cada barbero sin hacer cuentas, y controla los descansos). **Dónde vive:**
  [`decisiones_descansos.md`](decisiones_descansos.md); `sections/SeccionPlanillas.jsx`.

- **Ventas y gastos.** El listado del mes, con editar y borrar.
  **Para:** dueño. **Dónde vive:** `frontend/src/screens/admin/sections/`.

- **Balance del mes.** La ganancia del mes, lo que hizo cada barbero, y aparte los aportes y retiros, que cierran en
  "Queda en el negocio". El histórico mes a mes compara contra el mes anterior, y cada mes se abre con el detalle de
  la cuenta. Se puede ver con o sin las comisiones.
  **Para:** dueño ("¿cuánto ganó el negocio y cuánto quedó?"). **Dónde vive:**
  [`decisiones_movimientos_extra.md`](decisiones_movimientos_extra.md); `sections/SeccionBalances.jsx`.

- **Exportar a Excel.** Todo lo que muestran las secciones del panel se baja a Excel.
  **Para:** dueño y su contador. **Dónde vive:** `frontend/src/components/ui/BotonExportarExcel.jsx`.

- **La agenda de todo el local.** Los turnos del día de todos los barberos, con sus descansos y ausencias. Desde ahí
  el dueño le asigna o cambia el cliente a un turno "Sin datos", y cobra después un turno que el sistema cerró como
  "no asistió".
  **Para:** dueño. **Dónde vive:** `sections/SeccionTurnero.jsx`;
  [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F1, F3).

- **Barberos.** Alta y baja, PIN, comisión con una barra de 5 en 5, horario semanal y ausencias (si una ausencia pisa
  turnos, avisa y los cancela con mail al cliente). Un cartel avisa si hay barberos activos sin horario cargado,
  que el turnero no puede ofrecer.
  **Para:** dueño. **Dónde vive:** [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F7, F8);
  `gestion/TabBarberos.jsx`.

- **Servicios y productos.** Precio y duración de cada servicio; los productos para venta con su stock.
  **Para:** dueño. **Dónde vive:** `sections/SeccionGestion.jsx`.

- **Socios.** Alta de los dueños del local, con el vínculo al barbero si también corta. Se usan en los aportes y
  retiros, y en "Solo Barberos" de la caja.
  **Para:** locales con más de un dueño. **Dónde vive:**
  [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F4); `gestion/TabSocios.jsx`.

- **Negocio.** El horario de atención del local; los feriados (cerrar un día cancela los turnos de ese día con
  aviso al cliente, después de confirmar); el logo y la foto del local para el turnero; y el contacto del dueño y
  el teléfono del local.
  **Para:** dueño. **Dónde vive:** [`decisiones_horario_atencion.md`](decisiones_horario_atencion.md);
  `gestion/TabNegocio.jsx`, `gestion/BloqueContacto.jsx`.

- **Turnero.** La duración de los turnos del local.
  **Para:** dueño. **Dónde vive:** `gestion/TabTurnero.jsx`.

- **Seguridad.** Cambiar el PIN del dueño y el usuario y la contraseña del iPad. Al cambiarlos, se cierran las
  sesiones abiertas con los anteriores.
  **Para:** dueño. **Dónde vive:** `gestion/TabSeguridad.jsx`; [`estado_actual.md`](estado_actual.md) → "Sistema".

- **Vista del barbero en el panel.** Un barbero que entra con su PIN ve solo su planilla y su agenda, sin la plata
  del local.
  **Para:** barbero en el mostrador. **Dónde vive:** [`decisiones_acceso_barberos.md`](decisiones_acceso_barberos.md).

---

## 6. Lo que el sistema hace solo

- **Cierre diario.** A la madrugada, los turnos de días anteriores que quedaron reservados (nadie los cobró ni los
  marcó) pasan a "no asistió". La agenda y el aviso de turnos sin cobrar arrancan limpios, y el dueño todavía los
  puede cobrar después si el cliente sí vino.
  **Para:** dueño. **Dónde vive:** [`decisiones_mejoras_operativas.md`](decisiones_mejoras_operativas.md) (F3);
  `backend/src/jobs/cierreDiario.js`.

- **Recordatorios, confirmaciones y avisos por mail** (detalle en 2), **Google Calendar del barbero** (en 3) y la
  **recuperación de la contraseña del iPad y del PIN por mail** (en 4 y 5). Si alguien cambia el mail del dueño, le
  llega un aviso al mail anterior.

- **Cancelaciones en cascada con aviso.** Si el dueño achica el horario del local, carga un feriado o una ausencia
  que pisa turnos, el sistema le muestra cuántos turnos toca, y al confirmar los cancela y le avisa a cada cliente.
  **Para:** dueño y cliente. **Dónde vive:** [`decisiones_horario_atencion.md`](decisiones_horario_atencion.md).

---

## 7. Alta de un local nuevo

- **Formulario de alta.** El dueño nuevo recibe un link privado y carga su local desde el celular: el local, el
  equipo, los servicios y el contacto, una pregunta por pantalla, con una tarjeta "Tu barbería" que se arma a medida
  que contesta. Se guarda solo y se puede seguir desde otro dispositivo. Con eso, el local queda andando en el día.
  **Para:** dueño nuevo. **Dónde vive:** [`decisiones_alta_clientes.md`](decisiones_alta_clientes.md);
  [`onboarding.md`](onboarding.md).

---

## 8. Lo que todavía no hace (no prometer en la landing)

**A medias:**
- **De dónde llegan los clientes.** Cada turno guarda por qué link llegó (`?origen=instagram`), pero todavía no hay
  una pantalla que lo muestre. Entra en "Base de clientes".
- **WhatsApp y reseñas en el turnero:** aparecen solo si el local cargó el número y el link, y hoy se cargan por
  SQL, no desde el panel.

**Pendiente o idea** (en [`estado_actual.md`](estado_actual.md) → Pendientes):
- Base de clientes: ficha de cada cliente con visitas, faltas, gasto y barbero habitual; unificar clientes repetidos.
- Cierre de caja e historial de cierres.
- Registro de quién borró qué y cuándo.
- Cobrar con un QR de Mercado Pago desde el iPad.
- Mandar las planillas por WhatsApp.
- Elegir la forma de pago de la propina por separado de la del corte.
- Notificaciones en el celular (hoy los avisos de traspasos se ven al abrir la app).
- Horario especial en un feriado (hoy un feriado cierra el día entero).
- Servicios que solo hacen algunos barberos (hoy todos hacen todo).
- Editar un aporte o un retiro (hoy se borra y se vuelve a cargar).
- App del barbero instalable como app en el celular.
- Separar en Balances las comisiones de los socios.
- Varias sucursales en una sola cuenta (hoy cada local es una suscripción).

---

## 9. Ideas para contarlo en la landing

> Ideas para discutir, sin tocar la landing todavía. La landing actual está en `frontend-landing/src` (secciones en
> `components/sections/`, textos en `content/`).

### 9.1 Qué cuenta hoy la landing y qué no

| Feature | ¿En la landing hoy? |
|---|---|
| Reserva online 24 h, eligiendo barbero y servicio | Sí (sección Turnero) |
| Confirmación y recordatorio por mail | Sí (Turnero, Plan, FAQ) |
| Agenda del barbero, del día y de la semana; horarios y días libres | Sí (App para barberos) |
| Cargar un turno desde la app | Sí (App para barberos) |
| Cortes, ventas, gastos, caja en efectivo y Mercado Pago | Sí (Sistema de gestión, FAQ) |
| Lo que le toca a cada barbero, exportable a Excel | Sí (FAQ, subtítulo del hero) |
| Balance del mes con aportes y retiros | Sí (captura del Balance, FAQ) |
| Productos, servicios, barberos y configuración del turnero | Sí, como lista (Sistema de gestión) |
| "Cualquier barbero" | No |
| El cliente cancela o reprograma solo desde el mail | No |
| "Agregar al calendario" y "Cómo llegar" | No |
| Descansos del barbero y su control en Planillas | No |
| Aviso de turnos sin cobrar y cierre diario | No |
| Pasarle un turno a otro barbero | No |
| Turno rápido "Sin datos" | No |
| Cuántos cortes vinieron por el turnero ("Con turno", "Por origen") | No |
| Socios y "Queda en el negocio" | En parte (FAQ menciona aportes y retiros) |
| Feriados y ausencias que avisan solas al cliente | No |
| Reseñas en Google con QR para la puerta | No |
| Turnos en el Google Calendar del barbero | No |
| Inicio con estadísticas y alertas de stock | No |
| Stock que se descuenta solo al vender | No |
| Recuperar la contraseña o el PIN por mail, sin depender de nadie | No |
| El barbero ve su planilla en la app y en el iPad | No |
| Formulario de alta: "empezás en el día" | En parte (reaseguro del hero) |

### 9.2 Qué destacar

Siguiendo el mensaje central ([`decisiones_landing_ia.md`](decisiones_landing_ia.md) → "Mensaje": el turnero y la
gestión conectados), las que más suman son las que muestran esa conexión o que resuelven un dolor del día a día:

1. **"Que no se te escape ningún cobro":** el aviso de turnos sin cobrar, el cierre diario y "un turno se da por
   hecho solo cuando se cobra". Es la conexión turnero → caja hecha visible, y responde a "No sabés cuánto hiciste
   hoy" de la sección Problema.
2. **Descansos con control del dueño:** el barbero cuida su hueco y el dueño ve cuánto descansa cada uno y con
   cuánta anticipación lo marcó. Le habla al barbero y al dueño a la vez; ninguna app de turnos lo cuenta así.
3. **"Cuánta plata entra por el turnero":** "Con turno" en las planillas. Es el argumento para que un local que hoy
   solo usa la gestión pruebe el turnero.
4. **El cliente se arregla solo:** "Cualquier barbero", cancelar o reprogramar desde el mail, "Agregar al
   calendario". Refuerza "Vos dejás de hacer de secretaria".
5. **Cambios sin llamar a nadie:** feriados, ausencias y cambios de horario que cancelan y avisan solos.
6. **Detalles de equipo:** pasarle un turno a otro barbero y el turno rápido "Sin datos". Van bien en la lista de la
   app para barberos.
7. **Reseñas en Google con QR:** chico pero concreto, y es un pedido común de los dueños.
8. **Socios y "Queda en el negocio":** para locales con más de un dueño; cabe en la FAQ.
9. **Autonomía:** recuperar la contraseña o el PIN por mail. Cabe en la FAQ de datos o de "cómo empiezo".

### 9.3 Afirmaciones de la landing para revisar

- **"Planillas mensuales"** (lista de `SistemaGestion.jsx` y FAQ "¿Qué incluye el sistema de gestión?"): no hay una
  planilla mensual; lo del mes de cada barbero está en Balances. Cambiarlo por algo como "Balance del mes con lo que
  hizo cada barbero".
- **"Configuración del turnero"** (lista de `SistemaGestion.jsx`): hoy es solo la duración de los turnos. No está mal,
  pero suena a más.
- **Recordatorio por mail** (Turnero, Plan y FAQ): es real, pero se activa por local. Si se promete en el Plan,
  activarlo en cada alta nueva.
- **Lista de la app del barbero** (`AppBarberos.jsx`): le faltan los descansos, los traspasos y "Mi planilla", que
  hoy son lo más fuerte de la app.
