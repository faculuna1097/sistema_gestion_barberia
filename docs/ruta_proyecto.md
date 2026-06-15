# Ruta del proyecto - Sistema de Gestion de Barberia

Mapa de rutas del repositorio actualizado al 2026-06-10.

Este documento lista las carpetas y archivos principales del proyecto para ubicar rapido backend, frontends, documentacion, pantallas, servicios y rutas HTTP.

## Exclusiones

No se listan rutas generadas o locales:

- `node_modules/`
- `.git/`
- `dist/`
- `build/`
- `.next/`
- `coverage/`
- archivos `.env`

## Vista general

```txt
sistema-gestion-barberia/
|-- backend/            API Node.js + Express
|-- frontend/           Panel operativo/admin React + Vite
|-- frontend-barbero/   App del barbero React + Vite
|-- frontend-turnero/   Turnero publico React + Vite
|-- docs/               Documentacion tecnica y planes
|-- README.md
|-- CLAUDE.md
`-- .gitignore
```

## Documentacion

```txt
docs/
|-- SQL_Schema.md
|-- convenciones_tecnicas.md
|-- decisiones_acceso_barberos.md
|-- decisiones_horario_atencion.md
|-- decisiones_login_operativo.md
|-- decisiones_mail_entregabilidad.md
|-- decisiones_mail_recordatorio.md
|-- decisiones_redisenio_panel_gestion.md
|-- decisiones_turnero.md
|-- deudas_tecnicas_frontend.md
|-- estado_actual.md
|-- onboarding.md
|-- performance_frontends.md
|-- postmortem_golive_turnero.md
|-- ruta_proyecto.md
`-- sistema_de_disenio.md
```

## Backend

```txt
backend/
|-- package.json
|-- package-lock.json
`-- src/
    |-- index.js
    |-- config/
    |   |-- db.js
    |   `-- supabase.js
    |-- controllers/
    |   |-- adminOperativo.js
    |   |-- authBarbero.js
    |   |-- authOperativo.js
    |   |-- authPanel.js
    |   |-- balances.js
    |   |-- barberos.js
    |   |-- caja.js
    |   |-- categorias.js
    |   |-- clientes.js
    |   |-- cortes.js
    |   |-- feriados.js
    |   |-- gastos.js
    |   |-- gestion.js
    |   |-- horarioAtencion.js
    |   |-- horarios.js
    |   |-- imagenes.js
    |   |-- inicio.js
    |   |-- planilla.js
    |   |-- productos.js
    |   |-- servicios.js
    |   |-- suspensiones.js
    |   |-- turnero.js
    |   |-- turneroConfig.js
    |   |-- turnos.js
    |   |-- turnosOperativo.js
    |   `-- ventas.js
    |-- jobs/
    |   `-- recordatorios.js
    |-- middlewares/
    |   |-- authMiddleware.js
    |   |-- requiereRolMiddleware.js
    |   `-- tenantMiddleware.js
    |-- routes/
    |   |-- adminBarberos.js
    |   |-- adminFeriados.js
    |   |-- adminHorarioAtencion.js
    |   |-- adminImagenes.js
    |   |-- adminNegocio.js
    |   |-- adminOperativo.js
    |   |-- adminProductos.js
    |   |-- adminServicios.js
    |   |-- adminTurneroConfig.js
    |   |-- authBarbero.js
    |   |-- authOperativo.js
    |   |-- authPanel.js
    |   |-- balances.js
    |   |-- barberos.js
    |   |-- caja.js
    |   |-- categorias.js
    |   |-- clientes.js
    |   |-- cortes.js
    |   |-- gastos.js
    |   |-- horarios.js
    |   |-- inicio.js
    |   |-- planilla.js
    |   |-- productos.js
    |   |-- servicios.js
    |   |-- suspensiones.js
    |   |-- turnero.js
    |   |-- turnos.js
    |   |-- turnosOperativo.js
    |   `-- ventas.js
    |-- scripts/
    |   |-- crearTenant.js
    |   |-- generarHashOperativo.js
    |   |-- hashearPinAdmin.js
    |   |-- probarGoogleCalendar.js
    |   |-- probarMailer.js
    |   |-- probarRecordatorioMail.js
    |   `-- probarRecordatorios.js
    |-- services/
    |   |-- cortesService.js
    |   |-- disponibilidadService.js
    |   |-- feriadosService.js
    |   |-- googleCalendar.js
    |   |-- horarioAtencionService.js
    |   |-- horariosService.js
    |   |-- planillaService.js
    |   |-- recordatoriosService.js
    |   |-- storageService.js
    |   |-- suspensionesService.js
    |   |-- turnosService.js
    |   `-- mail/
    |       |-- mailProvider.js
    |       |-- mailer.js
    |       `-- resendProvider.js
    `-- utils/
        |-- constantes.js
        |-- pin.js
        |-- sanitizarLogs.js
        `-- suscripcion.js
```

### Rutas HTTP del backend

Los archivos de `backend/src/routes/` conectan endpoints Express con controllers. La base comun es `/api`, definida en `backend/src/index.js`.

```txt
backend/src/routes/
|-- authPanel.js              login unificado admin/barbero
|-- authBarbero.js            login barbero
|-- authOperativo.js          login operativo
|-- barberos.js               barberos para operacion
|-- servicios.js              servicios para operacion
|-- productos.js              productos para operacion
|-- categorias.js             categorias de gastos
|-- cortes.js                 cortes
|-- ventas.js                 ventas
|-- gastos.js                 gastos
|-- caja.js                   caja
|-- inicio.js                 dashboard/inicio
|-- balances.js               balances/reportes
|-- turnero.js                turnero publico
|-- turnosOperativo.js        turnos para flujo operativo
|-- turnos.js                 turnos admin/barbero
|-- horarios.js               horarios admin/barbero
|-- suspensiones.js           suspensiones admin/barbero
|-- clientes.js               clientes admin/barbero
|-- planilla.js               planilla admin/barbero
|-- adminBarberos.js          gestion admin de barberos
|-- adminServicios.js         gestion admin de servicios
|-- adminProductos.js         gestion admin de productos
|-- adminNegocio.js           datos del negocio
|-- adminTurneroConfig.js     configuracion del turnero
|-- adminHorarioAtencion.js   horario semanal del tenant
|-- adminFeriados.js          feriados del tenant
|-- adminImagenes.js          imagenes del negocio
`-- adminOperativo.js         credenciales operativas
```

## Frontend principal

```txt
frontend/
|-- README.md
|-- package.json
|-- package-lock.json
|-- vite.config.js
|-- vercel.json
|-- eslint.config.js
|-- index.html
|-- public/
|   |-- manifest.json
|   |-- mercadopago.png
|   `-- vite.svg
`-- src/
    |-- App.jsx
    |-- index.css
    |-- main.jsx
    |-- assets/
    |   `-- react.svg
    |-- components/
    |   `-- ui/
    |       |-- AvatarIniciales.jsx
    |       |-- BadgeEstado.jsx
    |       |-- BadgeFormaPago.jsx
    |       |-- BadgeVariacion.jsx
    |       |-- BotonExportarExcel.jsx
    |       |-- BotonIconoFila.jsx
    |       |-- Button.jsx
    |       |-- Card.jsx
    |       |-- ChipFiltro.jsx
    |       |-- ConfirmDialog.jsx
    |       |-- DataTable.jsx
    |       |-- DetalleRecurso.jsx
    |       |-- EmptyState.jsx
    |       |-- ErrorBoundary.jsx
    |       |-- Field.jsx
    |       |-- FondoLocal.jsx
    |       |-- IconoAlerta.jsx
    |       |-- InputTiempo.jsx
    |       |-- LoadingState.jsx
    |       |-- LogoCirculo.jsx
    |       |-- Modal.jsx
    |       |-- PageContainer.jsx
    |       |-- ScreenHeader.jsx
    |       |-- Select.jsx
    |       |-- SelectorDia.jsx
    |       |-- SelectorMes.jsx
    |       |-- SelectorPeriodo.jsx
    |       |-- SelectorSemana.jsx
    |       |-- Skeleton.jsx
    |       |-- StatusPill.jsx
    |       |-- SummaryRow.jsx
    |       |-- Tabs.jsx
    |       |-- Toast.jsx
    |       |-- ToggleEstado.jsx
    |       |-- TogglePill.jsx
    |       |-- TopBar.jsx
    |       `-- index.js
    |-- screens/
    |   |-- MainScreen.jsx
    |   |-- PantallaLoginAdmin.jsx
    |   |-- PantallaLoginOperativo.jsx
    |   |-- flows/
    |   |   |-- FlujoCorte.jsx
    |   |   |-- FlujoGasto.jsx
    |   |   |-- FlujoVenta.jsx
    |   |   `-- wizard.jsx
    |   `-- admin/
    |       |-- PanelAdmin.jsx
    |       `-- sections/
    |           |-- SeccionBalances.jsx
    |           |-- SeccionCaja.jsx
    |           |-- SeccionGastos.jsx
    |           |-- SeccionGestion.jsx
    |           |-- SeccionInicio.jsx
    |           |-- SeccionPlanillas.jsx
    |           |-- SeccionTurnero.jsx
    |           |-- SeccionVentas.jsx
    |           `-- gestion/
    |               |-- BloqueFeriados.jsx
    |               |-- BloqueHorarioAtencion.jsx
    |               |-- BloqueImagenes.jsx
    |               |-- TabBarberos.jsx
    |               |-- TabNegocio.jsx
    |               |-- TabProductos.jsx
    |               |-- TabSeguridad.jsx
    |               |-- TabServicios.jsx
    |               `-- TabTurnero.jsx
    |-- services/
    |   `-- api.js
    |-- theme/
    |   `-- tokens.js
    `-- utils/
        |-- fecha.js
        `-- formato.js
```

## Frontend barbero

```txt
frontend-barbero/
|-- README.md
|-- package.json
|-- package-lock.json
|-- vite.config.js
|-- eslint.config.js
|-- index.html
|-- public/
|   |-- favicon.svg
|   `-- icons.svg
`-- src/
    |-- App.jsx
    |-- index.css
    |-- main.jsx
    |-- components/
    |   |-- Agenda.jsx
    |   |-- Clientes.jsx
    |   |-- CrearTurno.jsx
    |   |-- Dashboard.jsx
    |   |-- Gestion.jsx
    |   |-- Login.jsx
    |   |-- Mas.jsx
    |   |-- MiPlanilla.jsx
    |   `-- ui/
    |       |-- AvatarIniciales.jsx
    |       |-- BottomNav.jsx
    |       |-- Button.jsx
    |       |-- Card.jsx
    |       |-- ConfirmDialog.jsx
    |       |-- EmptyState.jsx
    |       |-- Field.jsx
    |       |-- KPI.jsx
    |       |-- PageContainer.jsx
    |       |-- ScreenHeader.jsx
    |       |-- SearchInput.jsx
    |       |-- Skeleton.jsx
    |       |-- StatusPill.jsx
    |       |-- StickyFooter.jsx
    |       |-- SummaryRow.jsx
    |       |-- TopBar.jsx
    |       |-- TurnoListItem.jsx
    |       `-- index.js
    |-- services/
    |   `-- api.js
    |-- theme/
    |   `-- tokens.js
    `-- utils/
        |-- fecha.js
        `-- formato.js
```

## Frontend turnero

```txt
frontend-turnero/
|-- README.md
|-- package.json
|-- package-lock.json
|-- vite.config.js
|-- eslint.config.js
|-- index.html
|-- public/
|   |-- favicon.svg
|   `-- icons.svg
`-- src/
    |-- App.css
    |-- App.jsx
    |-- index.css
    |-- main.jsx
    |-- assets/
    |   |-- hero.png
    |   |-- react.svg
    |   `-- vite.svg
    |-- components/
    |   `-- ui/
    |       |-- AvatarIniciales.jsx
    |       |-- Button.jsx
    |       |-- Card.jsx
    |       |-- ConfirmDialog.jsx
    |       |-- EmptyState.jsx
    |       |-- Field.jsx
    |       |-- IconoAlerta.jsx
    |       |-- MiniCalendario.jsx
    |       |-- PageContainer.jsx
    |       |-- Progress.jsx
    |       |-- ScreenHeader.jsx
    |       |-- Skeleton.jsx
    |       |-- SlotChip.jsx
    |       |-- StatusPill.jsx
    |       |-- StickyFooter.jsx
    |       |-- SummaryRow.jsx
    |       |-- TopBar.jsx
    |       `-- index.js
    |-- screens/
    |   |-- Confirmacion.jsx
    |   |-- DatosCliente.jsx
    |   |-- GestionTurno.jsx
    |   |-- Landing.jsx
    |   |-- SeleccionBarbero.jsx
    |   |-- SeleccionFecha.jsx
    |   |-- SeleccionHorario.jsx
    |   `-- SeleccionServicio.jsx
    |-- services/
    |   `-- api.js
    |-- theme/
    |   `-- tokens.js
    `-- utils/
        |-- fecha.js
        `-- formato.js
```

## Archivos raiz

```txt
README.md
CLAUDE.md
.gitignore
```

## Notas rapidas

- Backend: `backend/src/index.js`
- Rutas HTTP: `backend/src/routes/`
- Controllers: `backend/src/controllers/`
- Servicios reutilizables: `backend/src/services/`
- Panel principal: `frontend/src/App.jsx`
- Panel admin: `frontend/src/screens/admin/PanelAdmin.jsx`
- Turnero publico: `frontend-turnero/src/App.jsx`
- App barbero: `frontend-barbero/src/App.jsx`

--- 

Fin del documento.
