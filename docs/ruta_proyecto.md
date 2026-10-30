# Ruta del proyecto - Sistema de Gestion de Barberia

Mapa de rutas del repositorio, regenerado desde `git ls-files` el 2026-09-29 y actualizado por última vez el 2026-10-29 (`frontend/src/utils/descansos.js`). Antes, el 2026-10-19 (`frontend-barbero/`: `components/agenda/`, `utils/seleccionSlots.js`, `hooks/useHover.js` y `utils/colorMonto.js`) y el 2026-10-08 (árbol de `frontend-turnero/` regenerado: rediseño del turnero).

Este documento lista las carpetas y archivos del proyecto para ubicar rapido backend, frontends, documentacion, pantallas, servicios y rutas HTTP. Para mantenerlo, regenerar los arboles desde `git ls-files` en vez de parchearlos a mano.

## Exclusiones

Solo se listan archivos versionados. No aparecen rutas generadas o locales: `node_modules/`, `dist/`, `build/`, archivos `.env`, `.claude/` y `backend/scripts/` (scripts one-off, gitignored; no confundir con `backend/src/scripts/`).

## Vista general

```txt
sistema-gestion-barberia/
|-- backend/            API Node.js + Express
|-- frontend/           Panel de gestion: modo operativo + admin (React + Vite)
|-- frontend-barbero/   App del barbero (React + Vite, base /barbero/)
|-- frontend-turnero/   Turnero publico del cliente (React + Vite, base /turnos/)
|-- frontend-landing/   Landing de marketing (React + Vite, barbermanager.app)
|-- docs/               Documentacion tecnica
|-- .gitignore
|-- CLAUDE.md
`-- README.md
```

## Documentacion

```txt
docs/
|-- auditoria_2026-07.md
|-- convenciones_tecnicas.md
|-- decisiones_acceso_barberos.md
|-- decisiones_descansos.md
|-- decisiones_horario_atencion.md
|-- decisiones_landing_ia.md
|-- decisiones_login_operativo.md
|-- decisiones_mail_entregabilidad.md
|-- decisiones_mail_recordatorio.md
|-- decisiones_movimientos_extra.md
|-- decisiones_redisenio_panel_gestion.md
|-- decisiones_turnero.md
|-- decisiones_turnero_ux.md
|-- deudas_tecnicas_frontend.md
|-- estado_actual.md
|-- onboarding.md
|-- performance_frontends.md
|-- plan_app_barbero.md
|-- postmortem_golive_turnero.md
|-- ruta_proyecto.md
|-- sistema_de_disenio.md
`-- SQL_Schema.md
```

## Backend

```txt
backend/
|-- .env.example
|-- .gitignore
|-- package-lock.json
|-- package.json
`-- src/
    |-- index.js
    |-- config/
    |   |-- db.js
    |   |-- jwt.js
    |   |-- supabase-ca.crt
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
    |   |-- socios.js
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
    |   |-- plataformaAuthMiddleware.js
    |   |-- rateLimitMiddleware.js
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
    |   |-- adminSocios.js
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
    |   |-- backfillCacheControl.js
    |   |-- crearTenant.js
    |   |-- generarHashOperativo.js
    |   |-- hashearPinAdmin.js
    |   |-- probarGoogleCalendar.js
    |   |-- probarMailer.js
    |   |-- probarRecordatorioMail.js
    |   `-- probarRecordatorios.js
    |-- services/
    |   |-- barberosService.js
    |   |-- categoriasService.js
    |   |-- cortesService.js
    |   |-- disponibilidadService.js
    |   |-- feriadosService.js
    |   |-- googleCalendar.js
    |   |-- horarioAtencionService.js
    |   |-- horariosService.js
    |   |-- planillaService.js
    |   |-- recordatoriosService.js
    |   |-- sociosService.js
    |   |-- storageService.js
    |   |-- suspensionesService.js
    |   |-- turnosService.js
    |   `-- mail/
    |       |-- mailer.js
    |       |-- mailProvider.js
    |       `-- resendProvider.js
    `-- utils/
        |-- constantes.js
        |-- credencialesOperativas.js
        |-- movimientos.js
        |-- pin.js
        |-- sanitizarLogs.js
        |-- stock.js
        |-- suscripcion.js
        |-- validarFecha.js
        |-- validarNumero.js
        |-- validarPago.js
        |-- validarTexto.js
        `-- validarUuid.js
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
|-- adminSocios.js            socios (duenos) del negocio
`-- adminOperativo.js         credenciales operativas
```

Los roles que exige cada ruta estan en `estado_actual.md` -> Estado funcional -> Sistema.

## Frontend de gestion

```txt
frontend/
|-- .gitignore
|-- eslint.config.js
|-- index.html
|-- package-lock.json
|-- package.json
|-- vercel.json
|-- vite.config.js
|-- public/
|   |-- favicon.png
|   |-- manifest.json
|   `-- mercadopago.png
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
    |       |-- BarraProporcional.jsx
    |       |-- BotonExportarExcel.jsx
    |       |-- BotonIconoFila.jsx
    |       |-- Button.jsx
    |       |-- Card.jsx
    |       |-- ChipFiltro.jsx
    |       |-- ConfirmDialog.jsx
    |       |-- DataTable.jsx
    |       |-- DesgloseMontos.jsx
    |       |-- DetalleRecurso.jsx
    |       |-- EmptyState.jsx
    |       |-- ErrorBoundary.jsx
    |       |-- Field.jsx
    |       |-- FondoLocal.jsx
    |       |-- IconoAlerta.jsx
    |       |-- index.js
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
    |       `-- TopBar.jsx
    |-- screens/
    |   |-- MainScreen.jsx
    |   |-- PantallaLoginAdmin.jsx
    |   |-- PantallaLoginOperativo.jsx
    |   |-- admin/
    |   |   |-- PanelAdmin.jsx
    |   |   `-- sections/
    |   |       |-- SeccionBalances.jsx
    |   |       |-- SeccionCaja.jsx
    |   |       |-- SeccionGastos.jsx
    |   |       |-- SeccionGestion.jsx
    |   |       |-- SeccionInicio.jsx
    |   |       |-- SeccionPlanillas.jsx
    |   |       |-- SeccionTurnero.jsx
    |   |       |-- SeccionVentas.jsx
    |   |       `-- gestion/
    |   |           |-- BloqueFeriados.jsx
    |   |           |-- BloqueHorarioAtencion.jsx
    |   |           |-- BloqueImagenes.jsx
    |   |           |-- TabBarberos.jsx
    |   |           |-- TabNegocio.jsx
    |   |           |-- TabProductos.jsx
    |   |           |-- TabSeguridad.jsx
    |   |           |-- TabServicios.jsx
    |   |           `-- TabTurnero.jsx
    |   `-- flows/
    |       |-- FlujoCorte.jsx
    |       |-- FlujoGasto.jsx
    |       |-- FlujoVenta.jsx
    |       |-- wizard.jsx
    |       `-- wizardStyles.js
    |-- services/
    |   `-- api.js
    |-- theme/
    |   `-- tokens.js
    `-- utils/
        |-- cargarChunk.js
        |-- colorMonto.js
        |-- descansos.js
        |-- fecha.js
        |-- formato.js
        `-- movimientos.js
```

## Frontend barbero

```txt
frontend-barbero/
|-- .gitignore
|-- eslint.config.js
|-- index.html
|-- package-lock.json
|-- package.json
|-- vercel.json
|-- vite.config.js
|-- public/
|   |-- favicon.png
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
    |   |-- agenda/
    |   |   |-- BloquesTimeline.jsx
    |   |   |-- datosAgenda.js
    |   |   |-- DetalleDescansoModal.jsx
    |   |   |-- DetalleTurnoModal.jsx
    |   |   |-- geometria.js
    |   |   |-- ModalDetalle.jsx
    |   |   |-- NavegadorDia.jsx
    |   |   `-- Timeline.jsx
    |   `-- ui/
    |       |-- AvatarIniciales.jsx
    |       |-- BottomNav.jsx
    |       |-- Button.jsx
    |       |-- Card.jsx
    |       |-- ConfirmDialog.jsx
    |       |-- EmptyState.jsx
    |       |-- Field.jsx
    |       |-- index.js
    |       |-- KPI.jsx
    |       |-- PageContainer.jsx
    |       |-- ScreenHeader.jsx
    |       |-- SearchInput.jsx
    |       |-- Skeleton.jsx
    |       |-- StatusPill.jsx
    |       |-- StickyFooter.jsx
    |       |-- SummaryRow.jsx
    |       |-- TopBar.jsx
    |       `-- TurnoListItem.jsx
    |-- hooks/
    |   `-- useHover.js
    |-- services/
    |   `-- api.js
    |-- theme/
    |   `-- tokens.js
    `-- utils/
        |-- colorMonto.js
        |-- fecha.js
        |-- formato.js
        `-- seleccionSlots.js
```

## Frontend turnero

```txt
frontend-turnero/
|-- .gitignore
|-- eslint.config.js
|-- index.html
|-- package-lock.json
|-- package.json
|-- vercel.json
|-- vite.config.js
|-- public/
|   `-- favicon.png
`-- src/
    |-- App.jsx
    |-- index.css
    |-- main.jsx
    |-- components/
    |   `-- ui/
    |       |-- AgregarAlCalendario.jsx
    |       |-- AvatarIniciales.jsx
    |       |-- Button.jsx
    |       |-- Card.jsx
    |       |-- ConfirmDialog.jsx
    |       |-- EmptyState.jsx
    |       |-- Field.jsx
    |       |-- IconoAlerta.jsx
    |       |-- IconoPin.jsx
    |       |-- index.js
    |       |-- PageContainer.jsx
    |       |-- Progress.jsx
    |       |-- ResumenTurno.jsx
    |       |-- ScreenHeader.jsx
    |       |-- SelectorDiaHorario.jsx
    |       |-- Skeleton.jsx
    |       |-- SlotChip.jsx
    |       |-- StatusPill.jsx
    |       |-- StickyFooter.jsx
    |       |-- SummaryRow.jsx
    |       `-- TopBar.jsx
    |-- hooks/
    |   |-- useDisponibilidad.js
    |   |-- useEleccionConPausa.js
    |   |-- useListaRemota.js
    |   `-- useNavegacion.js
    |-- screens/
    |   |-- ConfirmarTurno.jsx
    |   |-- GestionTurno.jsx
    |   |-- Landing.jsx
    |   |-- SeleccionCuando.jsx
    |   |-- SeleccionServicio.jsx
    |   `-- TurnoConfirmado.jsx
    |-- services/
    |   `-- api.js
    |-- theme/
    |   `-- tokens.js
    `-- utils/
        |-- calendario.js
        |-- fecha.js
        |-- formato.js
        |-- mapa.js
        |-- movimiento.js
        |-- rutas.js
        `-- telefono.js
```

## Frontend landing

```txt
frontend-landing/
|-- .gitignore
|-- eslint.config.js
|-- index.html
|-- package-lock.json
|-- package.json
|-- vite.config.js
|-- public/
|   |-- favicon.png
|   |-- logo.png
|   |-- og-image.png          vista previa al compartir el link (1200×630)
|   |-- robots.txt
|   |-- sitemap.xml
|   |-- screenshots/
|   |   `-- seccionPlanillas.jpg
|   `-- videos/
|       |-- barbero.jpg
|       |-- barbero.mp4
|       |-- corte.jpg
|       |-- corte.mp4
|       |-- turnero.jpg
|       `-- turnero.mp4
|-- scripts/
|   |-- og-image.html         plantilla de la og-image (no se publica; se captura con Edge headless)
|   `-- prerender.js          SSG: inyecta el HTML, el JSON-LD y genera dist/llms.txt
`-- src/
    |-- App.jsx
    |-- entry-server.jsx      entrada del build SSR: render() + datos de SEO
    |-- index.css
    |-- main.jsx
    |-- components/
    |   |-- landing/
    |   |   |-- Container.jsx
    |   |   |-- CTAGroup.jsx
    |   |   |-- Eyebrow.jsx
    |   |   |-- FaqItem.jsx
    |   |   |-- FeatureCard.jsx
    |   |   |-- FeatureList.jsx
    |   |   |-- FlowDiagram.jsx
    |   |   |-- FreeMonthBadge.jsx
    |   |   |-- LandingFooter.jsx
    |   |   |-- LandingNav.jsx
    |   |   |-- MetricCard.jsx
    |   |   |-- MobileCtaBar.jsx
    |   |   |-- NotaAlPie.jsx
    |   |   |-- PainCard.jsx
    |   |   |-- Reveal.jsx
    |   |   |-- ScreenshotFrame.jsx
    |   |   |-- Section.jsx
    |   |   |-- SplitFeature.jsx
    |   |   |-- TestimonialCard.jsx
    |   |   `-- VideoEmbed.jsx
    |   |-- sections/
    |   |   |-- AppBarberos.jsx
    |   |   |-- ComoFunciona.jsx
    |   |   |-- Comparacion.jsx
    |   |   |-- CtaFinal.jsx
    |   |   |-- FAQ.jsx
    |   |   |-- Hero.jsx
    |   |   |-- Plan.jsx
    |   |   |-- Problema.jsx
    |   |   |-- SistemaGestion.jsx
    |   |   |-- Testimonios.jsx
    |   |   `-- Turnero.jsx
    |   `-- ui/
    |       |-- Button.jsx
    |       `-- Card.jsx
    |-- config/
    |   `-- landing.js        marca, contacto, precio, flags, capturas, videos
    |-- content/              datos puros que comparten la UI, el JSON-LD y el llms.txt
    |   |-- alternativas.js   bloque "¿Y frente a otras apps de turnos?"
    |   |-- faq.js
    |   `-- plan.js           qué incluye la suscripción
    |-- seo/                  solo los usa el build SSR (no llegan al cliente)
    |   |-- datosEstructurados.js
    |   |-- llmsTxt.js
    |   `-- sitio.js          URL canónica y meta description
    |-- theme/
    |   `-- tokens.js
    `-- utils/
        |-- contacto.js
        `-- formato.js
```

## Notas rapidas

- Backend: `backend/src/index.js`
- Rutas HTTP: `backend/src/routes/`
- Controllers: `backend/src/controllers/`
- Servicios reutilizables: `backend/src/services/`
- Cron de recordatorios: `backend/src/jobs/recordatorios.js`
- Panel principal: `frontend/src/App.jsx`
- Panel admin: `frontend/src/screens/admin/PanelAdmin.jsx`
- Turnero publico: `frontend-turnero/src/App.jsx`
- App barbero: `frontend-barbero/src/App.jsx`
- Landing: `frontend-landing/src/App.jsx`

---

Fin del documento.
