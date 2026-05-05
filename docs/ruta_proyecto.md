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
│       │   ├── authMiddleware.js      # Verifica JWT Bearer token para rutas protegidas
│       │   └── tenantMiddleware.js    # Resuelve tenant_id desde header X-Tenant-Subdomain (con caché)
│       │
│       ├── controllers/               # Lógica de negocio (consultas a DB, respuestas HTTP)
│       │   ├── auth.js                # Login con PIN, generación de JWT
│       │   ├── barberos.js            # CRUD de barberos
│       │   ├── servicios.js           # CRUD de servicios de corte
│       │   ├── productos.js           # CRUD de productos de venta
│       │   ├── categorias.js          # CRUD de categorías de gastos
│       │   ├── cortes.js              # Registrar cortes (flujo operativo)
│       │   ├── ventas.js              # Registrar ventas (flujo operativo + panel admin)
│       │   ├── gastos.js              # Registrar gastos (flujo operativo + panel admin)
│       │   ├── planillas.js           # Reporte de comisiones por barbero
│       │   ├── caja.js                # Movimientos de caja del día
│       │   ├── inicio.js              # Dashboard del panel admin (resumen diario)
│       │   ├── balances.js            # Reportes de ingresos/gastos por período
│       │   └── gestion.js             # Gestión de tenant: PIN, datos negocio, ABMs
│       │
│       ├── routes/                    # Definición de rutas HTTP (conectan URL → controller)
│       │   ├── auth.js                # /api/auth/*
│       │   ├── barberos.js            # /api/barberos/*
│       │   ├── servicios.js           # /api/servicios/*
│       │   ├── productos.js           # /api/productos/*
│       │   ├── categorias.js          # /api/categorias/*
│       │   ├── cortes.js              # /api/cortes/*
│       │   ├── ventas.js              # /api/ventas/*
│       │   ├── gastos.js              # /api/gastos/*
│       │   ├── planillas.js           # /api/planillas/*
│       │   ├── caja.js                # /api/caja/*
│       │   ├── inicio.js              # /api/inicio/*
│       │   ├── balances.js            # /api/balances/*
│       │   ├── gestion.js             # /api/gestion/*
│       │   └── health.js              # /api/health (health check)
│       │
│       └── scripts/                   # Scripts CLI de utilidad (no son rutas HTTP)
│           ├── crearTenant.js         # Alta de nuevo cliente (ejecutar manualmente)
│           └── hashearPinAdmin.js     # Hashear PIN de admin (utilidad de setup)
│
└── frontend/                          # Cliente React + Vite
    ├── package.json                   # Dependencias y scripts del frontend
    ├── package-lock.json
    ├── vite.config.js                 # Configuración de Vite (build, dev server)
    ├── tailwind.config.js             # Configuración de Tailwind CSS
    ├── postcss.config.js              # PostCSS (requerido por Tailwind)
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
        ├── index.css                  # Estilos globales (Tailwind base + custom)
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
            ├── MainScreen.jsx         # Pantalla inicial: 3 botones (Corte, Venta, Gasto)
            ├── PantallaLoginAdmin.jsx # Login del panel admin con PIN
            │
            ├── flows/                 # Flujos operativos (modo iPad, sin autenticación)
            │   ├── FlujoCorte.jsx     # Registrar corte: barbero → servicio → propina → pago
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
                    ├── SeccionGestion.jsx     # Contenedor de gestión con tabs
                    └── gestion/               # Tabs dentro de SeccionGestion
                        ├── TabNegocio.jsx     # Datos del negocio (nombre, logo, suscripción)
                        ├── TabBarberos.jsx    # ABM de barberos (crear, editar, comisión)
                        ├── TabServicios.jsx   # ABM de servicios (crear, editar, inactivar)
                        ├── TabProductos.jsx   # ABM de productos (precio, stock, inactivar)
                        └── TabPinAdmin.jsx    # Cambio de PIN del panel admin
```

---

## Endpoints del backend

| Módulo | Método | Path | Protección |
|--------|--------|------|-----------|
| **Auth** | `POST` | `/api/auth/login` | Público |
| **Barberos** | `GET` | `/api/barberos` | Público |
| **Barberos** | `POST` | `/api/barberos` | Público |
| **Servicios** | `GET` | `/api/servicios` | Público |
| **Servicios** | `POST` | `/api/servicios` | Público |
| **Productos** | `GET` | `/api/productos` | Público |
| **Productos** | `POST` | `/api/productos` | Público |
| **Categorías** | `GET` | `/api/categorias` | Público |
| **Cortes** | `POST` | `/api/cortes` | Público |
| **Ventas** | `POST` | `/api/ventas` | Público |
| **Ventas** | `GET` | `/api/ventas/mensual` | JWT |
| **Ventas** | `DELETE` | `/api/ventas/:id` | JWT |
| **Gastos** | `POST` | `/api/gastos` | Público |
| **Gastos** | `GET` | `/api/gastos/mensual` | JWT |
| **Gastos** | `DELETE` | `/api/gastos/:id` | JWT |
| **Planillas** | `GET` | `/api/planillas/mensual` | JWT |
| **Planillas** | `GET` | `/api/planillas/historial` | JWT |
| **Caja** | `GET` | `/api/caja/dia` | JWT |
| **Caja** | `GET` | `/api/caja/historial` | JWT |
| **Inicio** | `GET` | `/api/inicio/dashboard` | JWT |
| **Balances** | `GET` | `/api/balances/periodo` | JWT |
| **Gestión** | `GET` | `/api/gestion/negocio` | Público |
| **Gestión** | `PATCH/PUT/DELETE` | `/api/gestion/*` | JWT |
| **Health** | `GET` | `/api/health` | Público |

---

## Screens y componentes del frontend

| Archivo | Propósito |
|---------|-----------|
| `App.jsx` | Raíz: autenticación, precarga de datos, routing entre pantallas |
| `MainScreen.jsx` | Pantalla inicial con los 3 botones de flujo operativo |
| `PantallaLoginAdmin.jsx` | Formulario de PIN para acceder al panel admin |
| `FlujoCorte.jsx` | Paso a paso para registrar un corte (barbero → servicio → propina → pago) |
| `FlujoVenta.jsx` | Paso a paso para registrar venta de un producto |
| `FlujoGasto.jsx` | Paso a paso para registrar un gasto con categoría |
| `PanelAdmin.jsx` | Layout del panel admin con navegación lateral y carga de secciones |
| `SeccionInicio.jsx` | Dashboard con resumen del día |
| `SeccionCaja.jsx` | Movimientos de caja del día (efectivo / MP) |
| `SeccionPlanillas.jsx` | Comisiones calculadas por barbero por período |
| `SeccionGastos.jsx` | Historial de gastos con filtros |
| `SeccionVentas.jsx` | Historial de ventas con filtros |
| `SeccionBalances.jsx` | Reporte de ingresos y gastos por período |
| `SeccionGestion.jsx` | Contenedor de las 5 tabs de configuración |
| `TabNegocio.jsx` | Editar datos del negocio |
| `TabBarberos.jsx` | ABM de barberos |
| `TabServicios.jsx` | ABM de servicios |
| `TabProductos.jsx` | ABM de productos |
| `TabPinAdmin.jsx` | Cambio de PIN admin |
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
│  FlujoCorte / Venta /     PanelAdmin + 7 secciones      │
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
│  tenantMiddleware → resuelve tenant_id desde subdomain  │
│  authMiddleware   → verifica JWT en rutas protegidas    │
│                                                         │
│  14 módulos de rutas → 13 controllers → función query() │
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
