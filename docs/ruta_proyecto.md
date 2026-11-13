# Ruta del proyecto - Sistema de Gestion de Barberia

Mapa de rutas del repositorio, regenerado desde `git ls-files` el 2026-09-29 y comparado de nuevo contra `git ls-files` el 2026-11-11 (resguardo de la base, fases 1 y 2: `backend/.env.lectura.example`, en `backend/src/scripts/` `conexionLectura.js` y `consultar.js`, y `.github/workflows/backup-db.yml` con `.github/scripts/backup-db.sh`; antes, ese mismo día, formulario de alta de clientes: `frontend-alta/` completo, en `backend/src/` `controllers/alta.js`, `routes/alta.js`, `utils/subdominio.js` y `utils/validarSolicitudAlta.js`, la skill `.claude/skills/alta-cliente/` y `docs/decisiones_alta_clientes.md` y `plan_alta_clientes.md`). Antes, el 2026-11-06 (monitoreo de producción: `backend/src/instrument.js`, `backend/src/config/sentry.js`, `.claude/settings.json`, las skills `.claude/skills/salud-prod/` y `arreglo-prod/`, y `docs/decisiones_monitoreo_prod.md`). Antes, el 2026-11-04 (se sumaron `frontend/src/utils/pantalla.js` y `frontend-landing/src/components/ui/IconoWhatsApp.jsx`, que faltaban). Antes, el 2026-11-03 (en `frontend-turnero/src/`: `components/ui/estilos.js`, `hooks/useHover.js` y `utils/errores.js`; y `frontend/src/hooks/usePantallaAngosta.js`). Antes, el 2026-11-02 (en `frontend/src/`: `components/ui/GrupoOpciones.jsx`, `ToastProvider.jsx`, `tonosFormaPago.js`, `estilos.js`, `utils/errores.js` y `utils/toast.js`). Antes, el 2026-10-30 (`controllers/agenda.js`, `controllers/descansos.js`, `routes/agenda.js`, `routes/descansos.js`, `services/descansosService.js`, `services/sqlTurnoEnriquecido.js` y `utils/errores422.js`, todos en `backend/src/`). Antes, el 2026-10-29 (`frontend/src/utils/descansos.js`) y el 2026-10-19 (`frontend-barbero/`: `components/agenda/`, `utils/seleccionSlots.js`, `hooks/useHover.js` y `utils/colorMonto.js`) y el 2026-10-08 (árbol de `frontend-turnero/` regenerado: rediseño del turnero).

Este documento lista las carpetas y archivos del proyecto para ubicar rapido backend, frontends, documentacion, pantallas, servicios y rutas HTTP. Para mantenerlo, regenerar los arboles desde `git ls-files` en vez de parchearlos a mano.

## Exclusiones

Solo se listan archivos versionados. No aparecen rutas generadas o locales: `node_modules/`, `dist/`, `build/`, archivos `.env`, lo local de `.claude/` (`launch.json`, `settings.local.json`) y `backend/scripts/` (scripts one-off, gitignored; no confundir con `backend/src/scripts/`).

## Vista general

```txt
sistema-gestion-barberia/
|-- backend/            API Node.js + Express
|-- frontend/           Panel de gestion: modo operativo + admin (React + Vite)
|-- frontend-barbero/   App del barbero (React + Vite, base /barbero/)
|-- frontend-turnero/   Turnero publico del cliente (React + Vite, base /turnos/)
|-- frontend-landing/   Landing de marketing (React + Vite, barbermanager.app)
|-- frontend-alta/      Formulario de alta de clientes (React + Vite, alta.barbermanager.app)
|-- docs/               Documentacion tecnica
|-- .claude/            Config compartida de Claude Code: settings.json (permisos allow/deny) y skills/ (salud-prod, arreglo-prod, alta-cliente)
|-- .github/            Backup diario de la base: workflows/backup-db.yml y scripts/backup-db.sh (GitHub Actions)
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
|-- decisiones_alta_clientes.md
|-- decisiones_descansos.md
|-- decisiones_horario_atencion.md
|-- decisiones_landing_ia.md
|-- decisiones_login_operativo.md
|-- decisiones_mail_entregabilidad.md
|-- decisiones_mail_recordatorio.md
|-- decisiones_monitoreo_prod.md
|-- decisiones_movimientos_extra.md
|-- decisiones_redisenio_panel_gestion.md
|-- decisiones_turnero.md
|-- decisiones_turnero_ux.md
|-- deudas_tecnicas_frontend.md
|-- estado_actual.md
|-- onboarding.md
|-- performance_frontends.md
|-- plan_alta_clientes.md
|-- plan_app_barbero.md
|-- plan_monitoreo_prod.md
|-- postmortem_golive_turnero.md
|-- ruta_proyecto.md
|-- sistema_de_disenio.md
`-- SQL_Schema.md
```

## Backend

```txt
backend/
|-- .env.example
|-- .env.lectura.example
|-- .gitignore
|-- package-lock.json
|-- package.json
`-- src/
    |-- index.js
    |-- instrument.js        inicializa Sentry; se carga antes que todo (--import en el web, primer import en los jobs)
    |-- config/
    |   |-- db.js
    |   |-- jwt.js
    |   |-- monitorCron.js   ping de latido de los jobs de cron a healthchecks.io (conMonitorCron)
    |   |-- sentry.js        helper central de Sentry (el resto del backend no importa @sentry/node)
    |   |-- supabase-ca.crt
    |   `-- supabase.js
    |-- controllers/
    |   |-- adminOperativo.js
    |   |-- agenda.js
    |   |-- alta.js              formulario de alta: solicitud, autoguardado, subdominio y envío
    |   |-- authBarbero.js
    |   |-- authOperativo.js
    |   |-- authPanel.js
    |   |-- balances.js
    |   |-- barberos.js
    |   |-- caja.js
    |   |-- categorias.js
    |   |-- clientes.js
    |   |-- cortes.js
    |   |-- descansos.js
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
    |   |-- agenda.js
    |   |-- alta.js
    |   |-- authBarbero.js
    |   |-- authOperativo.js
    |   |-- authPanel.js
    |   |-- balances.js
    |   |-- barberos.js
    |   |-- caja.js
    |   |-- categorias.js
    |   |-- clientes.js
    |   |-- cortes.js
    |   |-- descansos.js
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
    |   |-- conexionLectura.js
    |   |-- consultar.js
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
    |   |-- descansosService.js
    |   |-- disponibilidadService.js
    |   |-- feriadosService.js
    |   |-- googleCalendar.js
    |   |-- horarioAtencionService.js
    |   |-- horariosService.js
    |   |-- movimientosService.js
    |   |-- planillaService.js
    |   |-- recordatoriosService.js
    |   |-- sociosService.js
    |   |-- sqlTurnoEnriquecido.js
    |   |-- storageService.js
    |   |-- suspensionesService.js
    |   |-- turnosService.js
    |   `-- mail/
    |       |-- mailer.js
    |       |-- mailProvider.js
    |       `-- resendProvider.js
    `-- utils/
        |-- comision.js          fórmula de la comisión de un corte (única fuente)
        |-- constantes.js
        |-- credencialesOperativas.js
        |-- errores422.js
        |-- movimientos.js
        |-- pin.js
        |-- sanitizarLogs.js
        |-- scopingRol.js
        |-- stock.js
        |-- subdominio.js        formato, reservados, ocupado y sugerencia del subdominio (alta)
        |-- suscripcion.js
        |-- validarFecha.js
        |-- validarNumero.js
        |-- validarPago.js
        |-- validarSolicitudAlta.js  reglas del formulario de alta (§5.4 del plan)
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
|-- descansos.js              descansos admin/barbero
|-- agenda.js                 agenda del dia admin/barbero
|-- alta.js                   formulario de alta (sin tenant: el token del link)
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
|   |-- fonts/
|   |   |-- geist-latin.woff2        Geist (variable), la declara src/index.css
|   |   `-- geist-mono-latin.woff2   Geist Mono (variable)
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
    |       |-- estilos.js           estiloEtiquetaCampo (rótulo de Field y GrupoOpciones)
    |       |-- Field.jsx
    |       |-- FondoLocal.jsx
    |       |-- GrupoOpciones.jsx
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
    |       |-- ToastProvider.jsx    avisos flotantes (se monta en main.jsx)
    |       |-- ToggleEstado.jsx
    |       |-- tonosFormaPago.js    colores de cada forma de pago
    |       |-- TogglePill.jsx
    |       `-- TopBar.jsx
    |-- hooks/
    |   `-- usePantallaAngosta.js    ventana de menos de 1024 px (iPad vertical, Split View)
    |-- screens/
    |   |-- MainScreen.jsx
    |   |-- PantallaLoginPanel.jsx      login por PIN del panel (admin o barbero)
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
        |-- comision.js          suma la comisión de los cortes y arma el texto del %
        |-- descansos.js
        |-- errores.js           mensaje de error para el usuario (servidor o genérico)
        |-- fecha.js
        |-- formato.js
        |-- movimientos.js
        |-- pantalla.js          alto visible de la pantalla (100dvh con respaldo)
        `-- toast.js             API imperativa del toast (toast.show)
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
        |-- comision.js          suma la comisión de los cortes y arma el texto del %
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
    |       |-- estilos.js           estiloEyebrow y MARGEN_SCROLL_CAMPO
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
    |   |-- useHover.js          hover solo con mouse (copia del de frontend-barbero)
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
        |-- errores.js           textos de error de la API (sin conexión, 429)
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
    |       |-- Card.jsx
    |       `-- IconoWhatsApp.jsx
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

## Frontend alta

Formulario de alta de clientes (`alta.barbermanager.app/<token>`, puerto 5177). Decisiones en `docs/decisiones_alta_clientes.md`.

```txt
frontend-alta/
|-- .env.example
|-- .gitignore
|-- eslint.config.js
|-- index.html            noindex, etiquetas og: y twitter: (vista previa en WhatsApp)
|-- package-lock.json
|-- package.json
|-- vercel.json           rewrite de SPA y X-Robots-Tag: noindex
|-- vite.config.js
|-- public/
|   |-- apple-touch-icon.png
|   |-- favicon.png
|   |-- og-image.png
|   |-- robots.txt        bloquea todo (cada link es privado)
|   `-- fonts/
|       |-- geist-latin.woff2
|       `-- geist-mono-latin.woff2
`-- src/
    |-- App.jsx           estado del link: cargando, formulario, Listo, ya enviada, vencido, error
    |-- index.css         copia de Luz + clases al- de movimiento
    |-- main.jsx
    |-- components/
    |   |-- BotonPaso.jsx
    |   |-- CampoAgregarNombre.jsx
    |   |-- CampoPrecio.jsx
    |   |-- CampoTelefono.jsx
    |   |-- FilaPersona.jsx
    |   |-- ParDeHoras.jsx
    |   |-- SelectorComision.jsx
    |   |-- SelectorConBarra.jsx
    |   |-- SelectorDias.jsx
    |   |-- SelectorHora.jsx
    |   |-- SemanaEnBarras.jsx
    |   |-- TarjetaBarberia.jsx   la tarjeta "Tu barbería" que crece con cada respuesta
    |   |-- TarjetaItem.jsx
    |   |-- formulario/
    |   |   |-- AvisoSinGuardar.jsx
    |   |   |-- EncabezadoFormulario.jsx
    |   |   |-- IndicadorCapitulos.jsx
    |   |   `-- IndicadorGuardado.jsx
    |   |-- tarjeta/
    |   |   |-- BloquesTarjeta.jsx
    |   |   `-- PartesTarjeta.jsx
    |   `-- ui/
    |       |-- AvatarIniciales.jsx
    |       |-- BotonOpcion.jsx
    |       |-- Button.jsx
    |       |-- Casilla.jsx
    |       |-- EmptyState.jsx
    |       |-- Field.jsx
    |       |-- IconoWhatsApp.jsx
    |       |-- PageContainer.jsx
    |       |-- Select.jsx
    |       |-- Skeleton.jsx
    |       |-- StickyFooter.jsx
    |       |-- TextoError.jsx
    |       |-- estilos.js
    |       `-- index.js
    |-- config/
    |   |-- contacto.js       WhatsApp de Facundo (link vencido)
    |   `-- pantallas.js      las 15 pantallas y los 4 capítulos
    |-- hooks/
    |   |-- useEleccionConPausa.js
    |   |-- useErroresDePantalla.js
    |   |-- useErroresVisibles.js
    |   |-- useEstadoSubdominio.js
    |   |-- useFocoPendiente.js
    |   |-- useHover.js
    |   |-- useLibTelefono.js
    |   |-- useNavegacion.js  pantallas en el historial del navegador
    |   `-- useSolicitud.js   carga, autoguardado y envío
    |-- screens/
    |   |-- EstadosDelLink.jsx
    |   |-- Formulario.jsx
    |   |-- PantallaListo.jsx
    |   `-- pantallas/        una por pantalla (Bienvenida a Contacto)
    |       |-- PantallaBarberos.jsx
    |       |-- PantallaBienvenida.jsx
    |       |-- PantallaContactoDuenio.jsx
    |       |-- PantallaContactoLocal.jsx
    |       |-- PantallaDias.jsx
    |       |-- PantallaDireccion.jsx
    |       |-- PantallaDuenios.jsx
    |       |-- PantallaHorario.jsx
    |       |-- PantallaHorariosEquipo.jsx
    |       |-- PantallaLargoTurno.jsx
    |       |-- PantallaNombre.jsx
    |       |-- PantallaProductos.jsx
    |       `-- PantallaServicios.jsx
    |-- services/
    |   `-- api.js            /api/alta, sin tenant (el token sale del path)
    |-- theme/
    |   `-- tokens.js
    `-- utils/
        |-- autoguardado.js   motor del guardado (debounce, un PUT en vuelo, pausa para el envío)
        |-- barra.js
        |-- contacto.js
        |-- datosSolicitud.js la forma de datos (plan §5.6)
        |-- direccion.js
        |-- equipo.js
        |-- errores.js
        |-- erroresServidor.js
        |-- horarioEquipo.js
        |-- horarioLocal.js
        |-- horas.js
        |-- libTelefono.js    carga diferida de libphonenumber-js
        |-- mapa.js
        |-- movimiento.js
        |-- precio.js
        |-- resumen.js
        |-- semana.js
        |-- servicios.js
        |-- subdominio.js     copia de backend/src/utils/subdominio.js
        |-- teclado.js
        |-- telefono.js
        `-- validaciones.js   copia de backend/src/utils/validarSolicitudAlta.js
```

## Notas rapidas

- Backend: `backend/src/index.js`
- Rutas HTTP: `backend/src/routes/`
- Controllers: `backend/src/controllers/`
- Servicios reutilizables: `backend/src/services/`
- Cron de recordatorios: `backend/src/jobs/recordatorios.js`
- Sentry: `backend/src/instrument.js` + `backend/src/config/sentry.js`
- Aviso si un cron no corre: `backend/src/config/monitorCron.js` (healthchecks.io)
- Skills de producción (diagnóstico y arreglo desde el celular): `.claude/skills/salud-prod/`, `.claude/skills/arreglo-prod/`
- Panel principal: `frontend/src/App.jsx`
- Panel admin: `frontend/src/screens/admin/PanelAdmin.jsx`
- Turnero publico: `frontend-turnero/src/App.jsx`
- App barbero: `frontend-barbero/src/App.jsx`
- Landing: `frontend-landing/src/App.jsx`
- Formulario de alta: `frontend-alta/src/App.jsx`
- Skill de alta de clientes (revisa la solicitud, arma la query y el mensaje): `.claude/skills/alta-cliente/`
- Consultar la base con el rol de solo lectura: `backend/src/scripts/consultar.js` (conexión en `conexionLectura.js`, credenciales en `backend/.env.lectura`)

---

Fin del documento.
