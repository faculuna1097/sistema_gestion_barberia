# Ruta del Proyecto — Sistema de Gestión de Barbería

Mapa completo de carpetas y archivos del proyecto. Consultá esto antes de asumir rutas.
Excluye `node_modules/`, `.git/`, `dist/` y `build/`.

---

## Árbol de archivos

```
sistema-gestion-barberia/
├── CLAUDE.md                          # Instrucciones de trabajo para Claude
├── README.md                          # Overview del proyecto (stack, estructura, links)
├── .gitignore                         # Exclusiones globales de git
│
├── docs/                              # Documentación del proyecto
│   ├── ruta_proyecto.md               # Este archivo — mapa de carpetas y rutas
│   ├── estado_actual.md               # "Dónde estamos": funcional, decisiones, pendientes
│   ├── convenciones_tecnicas.md       # Estándares de código (logs, async, DB, frontend, etc.)
│   ├── SQL_Schema.md                  # DDL completo de la base de datos (referencia)
│   └── onboarding.md                  # Runbook para dar de alta un cliente nuevo
│
├── backend/                           # Servidor Node.js + Express
│   ├── package.json                   # Dependencias y scripts del backend
│   ├── package-lock.json
│   ├── .env                           # Variables de entorno (no versionado)
│   ├── .env.example                   # Template de variables de entorno
│   ├── .gitignore
│   └── src/
│       ├── index.js                   # Punto de entrada Express — registra rutas y middlewares
│       │
│       ├── config/
│       │   └── db.js                  # Pool PostgreSQL (Supabase Session Pooler) + función query()
│       │
│       ├── middlewares/
│       │   ├── authMiddleware.js              # Verifica JWT, valida tenant cruzado, inyecta rol/barbero_id
│       │   ├── requiereRolMiddleware.js       # Factory requiereRol(...roles) → 403 si el rol no autoriza
│       │   └── tenantMiddleware.js            # Resuelve tenant_id desde header X-Tenant-Subdomain (con caché)
│       │
│       ├── utils/
│       │   ├── sanitizarLogs.js               # Tacha credenciales (pin, password) antes de loguearlas
│       │   └── constantes.js                  # TZ Argentina y ANTELACION_MINIMA_MINUTOS (compartidas)
│       │
│       ├── controllers/               # Lógica de negocio (consultas a DB, respuestas HTTP)
│       │   ├── auth.js                # Login admin con PIN, genera JWT con rol='admin' (30d)
│       │   ├── authBarbero.js         # Login barbero con PIN, genera JWT con rol='barbero' (30d)
│       │   ├── authOperativo.js       # Login operativo con usuario+password, genera JWT con rol='operativo' (30d)
│       │   ├── adminOperativo.js      # GET/PUT credenciales operativas desde el panel admin
│       │   ├── barberos.js            # CRUD de barberos
│       │   ├── servicios.js           # CRUD de servicios de corte
│       │   ├── productos.js           # CRUD de productos de venta
│       │   ├── categorias.js          # CRUD de categorías de gastos
│       │   ├── cortes.js              # Registrar cortes (flujo operativo, turno_id opcional para vincular turno)
│       │   ├── ventas.js              # Registrar ventas (flujo operativo + panel admin)
│       │   ├── gastos.js              # Registrar gastos (flujo operativo + panel admin)
│       │   ├── caja.js                # Movimientos de caja del día
│       │   ├── inicio.js              # Dashboard del panel admin (resumen diario)
│       │   ├── balances.js            # Reportes de ingresos/gastos por período
│       │   ├── gestion.js             # Gestión de tenant: PIN, datos negocio, ABMs
│       │   ├── turnero.js             # Endpoints públicos del turnero del cliente (sin auth)
│       │   ├── turnosOperativo.js     # GET turnos del día del barbero para FlujoCorte (público, sin auth)
│       │   ├── turnos.js              # CRUD turnos backoffice (scope según rol admin/barbero)
│       │   ├── horarios.js            # CRUD horarios backoffice (scope según rol)
│       │   ├── suspensiones.js        # CRUD suspensiones backoffice (scope según rol)
│       │   ├── clientes.js            # Búsqueda y listado de clientes backoffice
│       │   ├── planilla.js            # Planilla semanal backoffice (scope según rol)
│       │   ├── turneroConfig.js       # Config turnero: GET/PUT duracion_slot_minutos (admin)
│       │   ├── horarioAtencion.js     # Horario semanal de atención del tenant (GET/PUT con cascada)
│       │   └── feriados.js            # Feriados puntuales del tenant (GET/POST/DELETE con cascada)
│       │
│       ├── routes/                    # Definición de rutas HTTP (conectan URL → controller)
│       │   ├── authPanel.js           # /api/auth/panel/login (login unificado admin/barbero)
│       │   ├── authBarbero.js         # /api/auth/barbero/login
│       │   ├── authOperativo.js       # /api/auth/operativo/login
│       │   ├── adminOperativo.js      # /api/admin/operativo/credenciales (GET/PUT, requiereRol admin)
│       │   ├── barberos.js            # /api/barberos/*
│       │   ├── servicios.js           # /api/servicios/*
│       │   ├── productos.js           # /api/productos/*
│       │   ├── categorias.js          # /api/categorias/*
│       │   ├── cortes.js              # /api/cortes/*
│       │   ├── ventas.js              # /api/ventas/*
│       │   ├── gastos.js              # /api/gastos/*
│       │   ├── caja.js                # /api/caja/*
│       │   ├── inicio.js              # /api/inicio/*
│       │   ├── balances.js            # /api/balances/*
│       │   ├── turnero.js             # /api/turnero/*
│       │   ├── turnosOperativo.js     # /api/turnos (público — flujo operativo)
│       │   ├── turnos.js              # /api/admin/turnos/*
│       │   ├── horarios.js            # /api/admin/horarios/*
│       │   ├── suspensiones.js        # /api/admin/suspensiones/*
│       │   ├── clientes.js            # /api/admin/clientes/*
│       │   ├── planilla.js            # /api/admin/planilla/*
│       │   ├── adminBarberos.js       # /api/admin/barberos/* (requiereRol admin)
│       │   ├── adminServicios.js      # /api/admin/servicios/* (requiereRol admin)
│       │   ├── adminProductos.js      # /api/admin/productos/* (requiereRol admin)
│       │   ├── adminNegocio.js        # /api/admin/negocio/* (requiereRol admin)
│       │   ├── adminTurneroConfig.js  # /api/admin/turnero/config (requiereRol admin)
│       │   ├── adminHorarioAtencion.js # /api/admin/horario-atencion (requiereRol admin)
│       │   ├── adminFeriados.js       # /api/admin/feriados (requiereRol admin)
│       │   └── health.js              # /api/health (health check)
│       │
│       ├── services/                  # Lógica de negocio reutilizable (integraciones externas, algoritmos)
│       │   ├── googleCalendar.js      # Crear/cancelar/actualizar evento (best-effort, googleapis)
│       │   ├── mailer.js              # Mails transaccionales del turnero (Nodemailer + SMTP Gmail)
│       │   ├── disponibilidadService.js  # Algoritmo de cálculo de slots disponibles (luxon)
│       │   ├── turnosService.js       # Helpers compartidos + operaciones backoffice de turnos
│       │   ├── horariosService.js     # CRUD de horarios de barberos
│       │   ├── suspensionesService.js # CRUD suspensiones (flujo 409 → confirmar_cancelacion → 201)
│       │   ├── planillaService.js     # Detalle y resumen semanal con scoping por barbero
│       │   ├── horarioAtencionService.js # Horario de atención del tenant: delta + cascada (luxon)
│       │   └── feriadosService.js     # Feriados del tenant: ABM + cascada de cancelación (luxon)
│       │
│       └── scripts/                   # Scripts CLI de utilidad (no son rutas HTTP)
│           ├── crearTenant.js         # Alta de nuevo cliente (ejecutar manualmente)
│           ├── hashearPinAdmin.js     # Hashear PIN de admin (utilidad de setup)
│           ├── generarHashOperativo.js # Hashear usuario+password operativos (utilidad de setup)
│           ├── probarGoogleCalendar.js # Validación end-to-end del service de Google Calendar
│           ├── probarMailer.js        # Validación end-to-end del service de mailer
│           └── testAdminEndpoints.js  # 34 tests automatizados de endpoints /api/admin/*
│
├── frontend-turnero/                  # Turnero del cliente — React + Vite
│   ├── package.json
│   ├── vite.config.js                 # base: '/turnos/'
│   ├── index.html
│   ├── eslint.config.js
│   ├── .gitignore
│   │
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   │
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                    # Router: wizard de reserva (pasos 0-6) + ruta /gestionar/:token
│       ├── App.css                    # Placeholder — estilos en chat dedicado
│       ├── index.css                  # Reset + Geist + @keyframes + scrollbar
│       │
│       ├── theme/
│       │   └── tokens.js              # Tokens del sistema "Luz" — fuente de verdad del proyecto
│       │
│       ├── utils/
│       │   ├── formato.js             # fmtPesos
│       │   └── fecha.js               # Helpers de fecha/hora
│       │
│       ├── services/
│       │   └── api.js                 # 10 funciones contra la API pública del turnero (sin auth)
│       │
│       ├── assets/
│       │   ├── hero.png
│       │   ├── react.svg
│       │   └── vite.svg
│       │
│       ├── screens/                   # Las 8 pantallas del turnero
│       │   ├── Landing.jsx            # Pantalla 1: hero + logo + contacto + horario + "Reservar"
│       │   ├── SeleccionServicio.jsx  # Pantalla 2: lista de servicios
│       │   ├── SeleccionBarbero.jsx   # Pantalla 3: lista de barberos
│       │   ├── SeleccionFecha.jsx     # Pantalla 4: calendario 7× (15 días, grisa días sin disponibilidad)
│       │   ├── SeleccionHorario.jsx   # Pantalla 5: slots disponibles del día
│       │   ├── DatosCliente.jsx       # Pantalla 6: nombre, teléfono, email
│       │   ├── Confirmacion.jsx       # Pantalla 7: resumen + confirmar + resultado
│       │   └── GestionTurno.jsx       # Pantalla 8: ver/cancelar/reprogramar turno por token
│       │
│       └── components/
│           └── ui/                    # Primitivos del sistema de diseño
│               ├── index.js           # Barrel export
│               ├── Button.jsx, Card.jsx, Field.jsx, TopBar.jsx, ScreenHeader.jsx
│               ├── StickyFooter.jsx, EmptyState.jsx, Skeleton.jsx, StatusPill.jsx
│               ├── PageContainer.jsx, ConfirmDialog.jsx, AvatarIniciales.jsx, SummaryRow.jsx  # 13 universales
│               ├── Progress.jsx, MiniCalendario.jsx, SlotChip.jsx  # específicos del wizard de reserva
│               └── IconoAlerta.jsx    # ícono compartido para el EmptyState de error
│
├── frontend-barbero/                  # App del barbero — React + Vite
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js                 # base: '/barbero/'
│   ├── index.html
│   ├── eslint.config.js
│   ├── .gitignore
│   │
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   │
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                    # Router: login → navegación por bottom nav (Hoy/Agenda/Planilla/Más)
│       ├── index.css                  # Reset + Geist + keyframes + focus-visible (copia del turnero)
│       │
│       ├── theme/
│       │   └── tokens.js              # Tokens del sistema "Luz" (copia del turnero)
│       │
│       ├── utils/
│       │   ├── formato.js             # fmtPesos (copia del turnero)
│       │   └── fecha.js               # Helpers de fecha/hora (copia del turnero)
│       │
│       ├── services/
│       │   └── api.js                 # 17 funciones: 4 públicas + 13 protegidas vía apiFetch con JWT
│       │
│       └── components/
│           ├── Login.jsx              # Selector de barbero + teclado PIN
│           ├── Dashboard.jsx          # "Hoy": próximo turno + KPIs + lista de turnos con acciones
│           ├── CrearTurno.jsx         # Wizard 4 pasos: servicio → fecha → horario → datos cliente
│           ├── Agenda.jsx             # Timeline vertical tipo calendario, navegable por día
│           ├── MiPlanilla.jsx         # Hero comisión + desglose + cortes agrupados por día
│           ├── Gestion.jsx            # Drilldown con tabs: Mis Horarios + Mis Suspensiones
│           ├── Clientes.jsx           # Drilldown: lista de clientes históricos con filtro
│           ├── Mas.jsx                # Pantalla "Más": acceso a Clientes, Gestión, Cerrar sesión
│           │
│           └── ui/                    # Primitivos del sistema de diseño (13 universales + 4 propios)
│               ├── index.js           # Barrel export
│               ├── Button.jsx, Card.jsx, Field.jsx, TopBar.jsx, ScreenHeader.jsx
│               ├── StickyFooter.jsx, EmptyState.jsx, Skeleton.jsx, StatusPill.jsx
│               ├── PageContainer.jsx, ConfirmDialog.jsx, AvatarIniciales.jsx, SummaryRow.jsx
│               └── BottomNav.jsx, KPI.jsx, TurnoListItem.jsx, SearchInput.jsx  # propios de este front
│
└── frontend/                          # Cliente React + Vite
    ├── package.json                   # Dependencias y scripts del frontend
    ├── package-lock.json
    ├── vite.config.js                 # Configuración de Vite (build, dev server)
    ├── eslint.config.js               # Configuración de ESLint
    ├── index.html                     # Punto de entrada HTML
    ├── .gitignore
    │
    ├── public/                        # Assets estáticos servidos directamente
    │   ├── manifest.json              # Manifest PWA
    │   └── mercadopago.png            # Logo de Mercado Pago
    │
    └── src/                           # Código fuente del frontend
        ├── main.jsx                   # Bootstrap de React (monta <App /> en el DOM)
        ├── App.jsx                    # Componente raíz — autenticación, precarga, routing
        ├── App.css                    # Estilos globales de App
        ├── index.css                  # Estilos globales (reset + fuentes Geist + keyframes)
        │
        ├── assets/
        │   └── react.svg              # Logo de React
        │
        ├── services/
        │   └── api.js                 # Cliente HTTP: función apiFetch(), construye URLs, inyecta headers
        │
        ├── utils/
        │   ├── fechas.js              # Helpers de fechas con timezone Buenos Aires
        │   └── formatos.js            # Helpers de formateo (moneda, números, etc.)
        │
        ├── components/                # Componentes reutilizables entre pantallas
        │   ├── BadgeFormaPago.jsx     # Badge visual: efectivo / Mercado Pago
        │   ├── BotonExportarExcel.jsx # Botón que exporta datos a .xlsx
        │   ├── SelectorDia.jsx        # Selector de día (para filtros)
        │   ├── SelectorMes.jsx        # Selector de mes (para filtros)
        │   ├── SelectorSemana.jsx     # Selector de semana (para filtros)
        │   ├── SelectorPeriodo.jsx    # Selector de período: día / semana / mes
        │   └── TogglePill.jsx         # Toggle de dos opciones estilo pill
        │
        └── screens/                   # Pantallas / vistas de la aplicación
            ├── MainScreen.jsx         # Pantalla inicial: 3 botones (Corte, Venta, Gasto) + flecha de logout operativo arriba a la izquierda
            ├── PantallaLoginAdmin.jsx # Login del panel admin con PIN
            ├── PantallaLoginOperativo.jsx # Login del modo operativo (usuario + password) — pantalla inicial si no hay token_operativo en localStorage
            │
            ├── flows/                 # Flujos operativos (modo iPad, requieren JWT operativo)
            │   ├── FlujoCorte.jsx     # Registrar corte: barbero → turnos del día → servicio → pago → propina → confirmación
            │   ├── FlujoVenta.jsx     # Registrar venta de producto
            │   └── FlujoGasto.jsx     # Registrar gasto con categoría
            │
            └── admin/                 # Panel administrativo (requiere JWT)
                ├── PanelAdmin.jsx     # Contenedor del panel: layout, navegación lateral, secciones
                └── sections/          # Secciones del panel admin
                    ├── SeccionInicio.jsx      # Dashboard: resumen del día (ingresos, cortes, etc.)
                    ├── SeccionCaja.jsx        # Movimientos de caja del día
                    ├── SeccionPlanillas.jsx   # Comisiones por barbero (período configurable)
                    ├── SeccionGastos.jsx      # Historial de gastos con filtros por período
                    ├── SeccionVentas.jsx      # Historial de ventas con filtros por período
                    ├── SeccionBalances.jsx    # Reportes de ingresos/gastos por período
                    ├── SeccionTurnero.jsx     # Vista global de turnos del día (todos los barberos)
                    ├── SeccionGestion.jsx     # Contenedor de gestión con tabs
                    └── gestion/               # Tabs dentro de SeccionGestion
                        ├── TabNegocio.jsx     # Datos del negocio (nombre, URL turnos) + bloques de horario de atención y feriados
                        ├── BloqueHorarioAtencion.jsx  # Bloque dentro de TabNegocio: edita el horario semanal del tenant
                        ├── BloqueFeriados.jsx        # Bloque dentro de TabNegocio: ABM de feriados del tenant
                        ├── TabBarberos.jsx    # ABM de barberos + filas expandibles (horarios/suspensiones)
                        ├── TabServicios.jsx   # ABM de servicios (crear, editar, inactivar)
                        ├── TabProductos.jsx   # ABM de productos (precio, stock, inactivar)
                        ├── TabTurnero.jsx     # Config turnero: duración de slots
                        └── TabSeguridad.jsx   # Cambio de PIN admin + usuario/password operativo (modales por campo)
```

---

## Endpoints del backend

| Módulo | Método | Path | Protección |
|--------|--------|------|-----------|
| **Auth panel** (login unificado admin/barbero) | `POST` | `/api/auth/panel/login` | Público |
| **Auth barbero** | `POST` | `/api/auth/barbero/login` | Público |
| **Auth operativo** | `POST` | `/api/auth/operativo/login` | Público |
| **Barberos** | `GET` | `/api/barberos` | JWT (operativo/admin) |
| **Servicios** | `GET` | `/api/servicios` | JWT (operativo/admin) |
| **Productos** | `GET` | `/api/productos` | JWT (operativo/admin) |
| **Categorías** | `GET` | `/api/categorias` | JWT (operativo/admin) |
| **Cortes** | `POST` | `/api/cortes` | JWT (operativo/admin) |
| **Turnos (operativo)** | `GET` | `/api/turnos` | JWT (operativo/admin) |
| **Ventas** | `POST` | `/api/ventas` | JWT (operativo/admin) |
| **Ventas** | `GET` | `/api/ventas/mensual` | JWT (admin) |
| **Ventas** | `PUT` | `/api/ventas/:id` | JWT (admin) |
| **Ventas** | `DELETE` | `/api/ventas/:id` | JWT (admin) |
| **Gastos** | `POST` | `/api/gastos` | JWT (operativo/admin) |
| **Gastos** | `GET` | `/api/gastos/mensual` | JWT (admin) |
| **Gastos** | `PUT` | `/api/gastos/:id` | JWT (admin) |
| **Gastos** | `DELETE` | `/api/gastos/:id` | JWT (admin) |
| **Caja** | `GET` | `/api/caja/movimientos-dia` | JWT |
| **Caja** | `DELETE` | `/api/caja/movimientos/:tipo/:id` | JWT |
| **Inicio** | `GET` | `/api/inicio/resumen-dia` | JWT |
| **Inicio** | `GET` | `/api/inicio/comparativo-mes` | JWT |
| **Inicio** | `GET` | `/api/inicio/stock-bajo` | JWT |
| **Balances** | `GET` | `/api/balances/mensual` | JWT |
| **Balances** | `GET` | `/api/balances/historico` | JWT |
| **Negocio** | `GET` | `/api/negocio` | Público |
| **Health** | `GET` | `/api/health` | Público |
| **Turnero — tenant** | `GET` | `/api/turnero/tenant` | Público |
| **Turnero — servicios** | `GET` | `/api/turnero/servicios` | Público |
| **Turnero — barberos** | `GET` | `/api/turnero/barberos` | Público |
| **Turnero — disponibilidad** | `GET` | `/api/turnero/disponibilidad` | Público |
| **Turnero — días disponibles** | `GET` | `/api/turnero/dias-disponibles` | Público |
| **Turnero — turnos** | `POST` | `/api/turnero/turnos` | Público |
| **Turnero — turnos** | `GET` | `/api/turnero/turnos/:token` | Público |
| **Turnero — turnos** | `POST` | `/api/turnero/turnos/:token/cancelar` | Público |
| **Turnero — turnos** | `POST` | `/api/turnero/turnos/:token/reprogramar` | Público |
| **Admin — turnos** | `GET` | `/api/admin/turnos` | JWT (admin/barbero) |
| **Admin — turnos** | `POST` | `/api/admin/turnos` | JWT (admin/barbero) |
| **Admin — turnos** | `PATCH` | `/api/admin/turnos/:id/estado` | JWT (admin/barbero) |
| **Admin — turnos** | `DELETE` | `/api/admin/turnos/:id` | JWT (admin/barbero) |
| **Admin — horarios** | `GET` | `/api/admin/horarios/:barbero_id` | JWT (admin/barbero) |
| **Admin — horarios** | `PUT` | `/api/admin/horarios/:barbero_id` | JWT (admin/barbero) |
| **Admin — suspensiones** | `GET` | `/api/admin/suspensiones` | JWT (admin/barbero) |
| **Admin — suspensiones** | `POST` | `/api/admin/suspensiones` | JWT (admin/barbero) |
| **Admin — suspensiones** | `DELETE` | `/api/admin/suspensiones/:id` | JWT (admin/barbero) |
| **Admin — horario atención** | `GET` | `/api/admin/horario-atencion` | JWT (admin) |
| **Admin — horario atención** | `PUT` | `/api/admin/horario-atencion` | JWT (admin) |
| **Admin — planilla** | `GET` | `/api/admin/planilla` | JWT (admin/barbero) |
| **Admin — planilla** | `GET` | `/api/admin/planilla/resumen` | JWT (admin/barbero) |
| **Admin — clientes** | `GET` | `/api/admin/clientes/mis-clientes` | JWT (admin/barbero) |
| **Admin — clientes** | `GET` | `/api/admin/clientes` | JWT (admin/barbero) |
| **Admin — barberos** | `GET / POST / PUT` | `/api/admin/barberos[/:id]` | JWT (admin) |
| **Admin — servicios** | `GET / POST / PUT` | `/api/admin/servicios[/:id]` | JWT (admin) |
| **Admin — productos** | `GET / POST / PUT` | `/api/admin/productos[/:id]` | JWT (admin) |
| **Admin — stock** | `PUT` | `/api/admin/productos/:id/agregar-stock` | JWT (admin) |
| **Admin — negocio** | `GET` | `/api/admin/negocio` | JWT (admin) |
| **Admin — negocio** | `PUT` | `/api/admin/negocio` | JWT (admin) |
| **Admin — PIN admin** | `PUT` | `/api/admin/negocio/pin-admin` | JWT (admin) |
| **Admin — turnero config** | `GET` | `/api/admin/turnero/config` | JWT (admin) |
| **Admin — turnero config** | `PUT` | `/api/admin/turnero/config` | JWT (admin) |
| **Admin — credenciales operativo** | `GET` | `/api/admin/operativo/credenciales` | JWT (admin) |
| **Admin — credenciales operativo** | `PUT` | `/api/admin/operativo/credenciales` | JWT (admin) |

---

## Screens y componentes del frontend

| Archivo | Propósito |
|---------|-----------|
| `App.jsx` | Raíz: autenticación, precarga de datos, routing entre pantallas |
| `MainScreen.jsx` | Pantalla inicial con los 3 botones de flujo operativo |
| `PantallaLoginAdmin.jsx` | Formulario de PIN para acceder al panel admin |
| `PantallaLoginOperativo.jsx` | Login del modo operativo (usuario + password). Pantalla inicial si no hay `token_operativo` en localStorage |
| `FlujoCorte.jsx` | Paso a paso para registrar un corte (6 pasos; el paso 2 permite vincularlo a un turno del día o seguir como walk-in) |
| `FlujoVenta.jsx` | Paso a paso para registrar venta de un producto |
| `FlujoGasto.jsx` | Paso a paso para registrar un gasto con categoría |
| `PanelAdmin.jsx` | Layout del panel admin con navegación lateral y carga de secciones |
| `SeccionInicio.jsx` | Dashboard con resumen del día |
| `SeccionCaja.jsx` | Movimientos de caja del día (efectivo / MP) |
| `SeccionPlanillas.jsx` | Comisiones calculadas por barbero por período |
| `SeccionGastos.jsx` | Historial de gastos con filtros |
| `SeccionVentas.jsx` | Historial de ventas con filtros |
| `SeccionBalances.jsx` | Reporte de ingresos y gastos por período |
| `SeccionTurnero.jsx` | Vista global de turnos del día con filtro por barbero |
| `SeccionGestion.jsx` | Contenedor de las 6 tabs de configuración |
| `TabNegocio.jsx` | Editar datos del negocio + bloque de horario de atención |
| `BloqueHorarioAtencion.jsx` | Bloque de TabNegocio: edita el horario semanal del tenant con flujo de confirmación de cascada |
| `BloqueFeriados.jsx` | Bloque de TabNegocio: ABM de feriados del tenant con flujo de confirmación de cascada |
| `TabBarberos.jsx` | ABM de barberos + filas expandibles con horarios y suspensiones |
| `TabTurnero.jsx` | Configuración del turnero (duración de slots) |
| `TabServicios.jsx` | ABM de servicios |
| `TabProductos.jsx` | ABM de productos |
| `TabSeguridad.jsx` | Cambio de PIN admin + usuario/password del modo operativo (cada campo abre su propio modal) |
| `BadgeFormaPago.jsx` | Badge reutilizable: efectivo vs Mercado Pago |
| `BotonExportarExcel.jsx` | Botón que exporta una tabla a .xlsx |
| `SelectorDia.jsx` | Selector de día para filtros de fecha |
| `SelectorMes.jsx` | Selector de mes para filtros de fecha |
| `SelectorSemana.jsx` | Selector de semana para filtros de fecha |
| `SelectorPeriodo.jsx` | Selector agrupado: día / semana / mes |
| `TogglePill.jsx` | Toggle visual de dos opciones |
| `api.js` | `apiFetch()`: cliente HTTP que inyecta tenant y JWT en cada request |
| `fechas.js` | Helpers para fechas en timezone `America/Argentina/Buenos_Aires` |
| `formatos.js` | Helpers para formatear moneda, números y textos |

---

## Capas del sistema

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND — React 19 + Vite                             │
│  Deploy: Vercel (sistema-gestion-barberia.vercel.app)   │
│                                                         │
│  Flujos operativos        Panel administrativo          │
│  FlujoCorte / Venta /     PanelAdmin + 8 secciones      │
│  Gasto (público)          (requiere JWT)                │
│                                                         │
│  → Todas las llamadas vía apiFetch() en api.js          │
│  → Header X-Tenant-Subdomain en cada request            │
│  → Header Authorization: Bearer <JWT> en rutas proteg. │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / JSON
┌────────────────────────▼────────────────────────────────┐
│  BACKEND — Node.js + Express 5                          │
│  Deploy: Railway (sistemagestionbarberia-production...  │
│           .up.railway.app)                              │
│                                                         │
│  tenantMiddleware  → resuelve tenant_id desde subdomain │
│  authMiddleware    → valida JWT + tenant cruzado + rol  │
│  requiereRolMiddleware → restringe rutas por rol        │
│                                                         │
│  15 módulos de rutas → 14 controllers → función query() │
└────────────────────────┬────────────────────────────────┘
                         │ SQL (pg pool, max 3 conexiones)
┌────────────────────────▼────────────────────────────────┐
│  POSTGRESQL — Supabase Session Pooler                   │
│                                                         │
│  Tablas: tenant, barbero, servicio, producto,           │
│          corte, venta, gasto, categoria_gasto,          │
│          cierre_caja                                    │
│                                                         │
│  Multi-tenant: todo filtrado por tenant_id              │
│  Soft delete: columna activo (true/false)               │
│  Timezone: America/Argentina/Buenos_Aires               │
└─────────────────────────────────────────────────────────┘
```

---

## Deploy

| Componente | Plataforma | URL |
|-----------|-----------|-----|
| Frontend | Vercel | `sistema-gestion-barberia.vercel.app` |
| Backend | Railway | `sistemagestionbarberia-production.up.railway.app` |
| Dominio | — | `barbermanager.app` + wildcard `*.barbermanager.app` |
| Base de datos | Supabase | PostgreSQL Session Pooler |

### Tenants activos
| Subdominio | Propósito |
|-----------|----------|
| `kingsai` | Producción (cliente real) |
| `demo` | Desarrollo y pruebas |

---

*— Fin del documento —*
