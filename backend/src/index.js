// /backend/src/index.js
// Punto de entrada del servidor Express.
// Responsabilidad: arrancar el servidor y registrar las rutas principales.
// No contiene lógica de negocio — eso vive en /routes y /controllers.

import express from 'express';
import cors from 'cors';
import { testConnection } from './config/db.js';
import { verificarToken } from './middlewares/authMiddleware.js';
import { tenantMiddleware } from './middlewares/tenantMiddleware.js';
import { sanitizarObjeto } from './utils/sanitizarLogs.js';

// --- Importación de rutas ---
import barberoRoutes    from './routes/barberos.js';
import servicioRoutes   from './routes/servicios.js';
import productoRoutes   from './routes/productos.js';
import corteRoutes      from './routes/cortes.js';
import ventaRoutes      from './routes/ventas.js';
import gastoRoutes      from './routes/gastos.js';
import categoriaRoutes  from './routes/categorias.js';
import cajaRouter       from './routes/caja.js';
import balancesRouter   from './routes/balances.js';
import inicioRoutes     from './routes/inicio.js';
import authPanelRoutes  from './routes/authPanel.js';
import authBarberoRoutes from './routes/authBarbero.js';
import authOperativoRoutes from './routes/authOperativo.js';
import turneroRoutes    from './routes/turnero.js';
import turnosOperativoRoutes from './routes/turnosOperativo.js';
import turnosAdminRoutes   from './routes/turnos.js';
import horariosAdminRoutes     from './routes/horarios.js';
import suspensionesAdminRoutes  from './routes/suspensiones.js';
import clientesAdminRoutes     from './routes/clientes.js';
import planillaAdminRoutes     from './routes/planilla.js';
import adminBarberosRoutes    from './routes/adminBarberos.js';
import adminServiciosRoutes   from './routes/adminServicios.js';
import adminProductosRoutes   from './routes/adminProductos.js';
import adminNegocioRoutes     from './routes/adminNegocio.js';
import adminTurneroConfigRoutes from './routes/adminTurneroConfig.js';
import adminOperativoRoutes from './routes/adminOperativo.js';
import adminHorarioAtencionRoutes from './routes/adminHorarioAtencion.js';
import adminFeriadosRoutes from './routes/adminFeriados.js';
import adminImagenesRoutes from './routes/adminImagenes.js';
import { requiereRol } from './middlewares/requiereRolMiddleware.js';
import { getNegocio } from './controllers/gestion.js';
import { getImagenes } from './controllers/imagenes.js';

console.log('[index] Iniciando Barbershop Manager API...');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middlewares globales ---
const esDesarrollo = process.env.NODE_ENV !== 'production';
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin === 'http://localhost:5173') return callback(null, true);
    if (origin.endsWith('.barbermanager.app')) return callback(null, true);
    // En desarrollo aceptamos cualquier origen de red local (localhost o
    // IP privada) para poder probar los frontends desde otros dispositivos
    // de la red, como un celular. En producción esta rama no aplica.
    if (esDesarrollo && /^http:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS bloqueado para origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

// tenantMiddleware — corre en TODAS las rutas antes que cualquier controller.
// Resuelve el tenant desde el header X-Tenant-Subdomain (producción)
// o desde TENANT_ID en .env (desarrollo local).
app.use(tenantMiddleware);

// Middleware de logging global — loguea cada request que llega al servidor.
// El body se sanitiza antes de loguear para no filtrar credenciales (PINs,
// passwords) a los logs de Railway. Ver /utils/sanitizarLogs.js.
app.use((req, res, next) => {
  const bodyLog = req.body && Object.keys(req.body).length
    ? `— body: ${JSON.stringify(sanitizarObjeto(req.body))}`
    : '';
  console.log(`[index] ${req.method} ${req.url}`, bodyLog);
  next();
});

// --- Ruta de salud (health check) ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS PÚBLICAS — accesibles sin token
//
// Criterio de qué queda público:
//   1. Logins (no puede haber token antes de loguearse).
//   2. Datos del negocio (nombre) y sus imágenes (logo, foto del local) para
//      la pantalla de login del modo gestión y del barbero.
//   3. Turnero del cliente: público por diseño (cliente anónimo reservando).
//      Este namespace es el ÚNICO que sirve listados públicos del tenant
//      (barberos, servicios, disponibilidad). La app del barbero consume
//      /api/turnero/barberos en su selector pre-PIN.
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth/operativo', authOperativoRoutes);
app.use('/api/auth/barbero',   authBarberoRoutes);
// Login unificado del panel (resuelve rol admin/barbero según el PIN).
app.use('/api/auth/panel',     authPanelRoutes);
app.use('/api/turnero',    turneroRoutes);
// GET /api/negocio — datos públicos del negocio (nombre, booking_url).
// Lo consume App.jsx antes del login para el nombre; el logo viene de /negocio/imagenes.
app.get('/api/negocio',    getNegocio);
// GET /api/negocio/imagenes — imágenes públicas del tenant (local, cortes, logo).
// Mismo handler que la versión admin (solo lee, usa req.tenant_id); acá sin
// token para que frontend-turnero y frontend-barbero las consuman.
app.get('/api/negocio/imagenes', getImagenes);

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS OPERATIVAS — accesibles con JWT operativo o admin
//
// Estas son las rutas que el iPad del local consume después del login
// operativo. El admin también puede llamarlas desde el panel (es
// jerárquicamente superior). Mover acá rutas que antes eran públicas cierra
// el agujero histórico de que /api/cortes y /api/turnos exponían datos
// (nombres de clientes, movimientos del día) sin autenticación.
//
// Catálogos de lectura (barberos, servicios, productos, categorías): viven
// acá desde que se privatizaron — el panel de gestión los precarga después
// del login operativo y SeccionTurnero (admin) los reusa. Lectura simple,
// sin info sensible, pero ya no necesitan ser anónimos porque ningún flujo
// pre-login los consume (la app del barbero usa /api/turnero/barberos).
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/cortes',    verificarToken, requiereRol('operativo', 'admin'), corteRoutes);
// GET /api/turnos — turnos del día de un barbero para el flujo operativo (iPad).
// Lo consume FlujoCorte para ofrecer registrar un corte vinculado a un turno.
app.use('/api/turnos',    verificarToken, requiereRol('operativo', 'admin'), turnosOperativoRoutes);
app.use('/api/barberos',   verificarToken, requiereRol('operativo', 'admin'), barberoRoutes);
app.use('/api/servicios',  verificarToken, requiereRol('operativo', 'admin'), servicioRoutes);
app.use('/api/productos',  verificarToken, requiereRol('operativo', 'admin'), productoRoutes);
app.use('/api/categorias', verificarToken, requiereRol('operativo', 'admin'), categoriaRoutes);
// /api/ventas y /api/gastos son rutas MIXTAS por rol:
//   - POST  → operativo o admin (crear desde iPad o panel)
//   - GET /mensual, DELETE, PUT → admin (consulta y gestión de pasado)
// La distinción fina por rol se aplica dentro del router (routes/ventas.js,
// routes/gastos.js). Acá solo se exige token válido.
app.use('/api/ventas',    verificarToken, ventaRoutes);
app.use('/api/gastos',    verificarToken, gastoRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS PROTEGIDAS — solo accesibles desde el panel admin con JWT válido
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/caja',      verificarToken, cajaRouter);
app.use('/api/inicio',    verificarToken, inicioRoutes);
app.use('/api/balances',  verificarToken, balancesRouter);
// ─────────────────────────────────────────────────────────────────────────────
// RUTAS DEL BACKOFFICE — /api/admin/* (admin + barbero autenticados)
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/admin/turnos',    verificarToken, turnosAdminRoutes);
app.use('/api/admin/horarios',      verificarToken, horariosAdminRoutes);
app.use('/api/admin/suspensiones',  verificarToken, suspensionesAdminRoutes);
app.use('/api/admin/clientes',      verificarToken, clientesAdminRoutes);
app.use('/api/admin/planilla',      verificarToken, planillaAdminRoutes);
app.use('/api/admin/barberos',     verificarToken, requiereRol('admin'), adminBarberosRoutes);
app.use('/api/admin/servicios',    verificarToken, requiereRol('admin'), adminServiciosRoutes);
app.use('/api/admin/productos',    verificarToken, requiereRol('admin'), adminProductosRoutes);
app.use('/api/admin/negocio',      verificarToken, requiereRol('admin'), adminNegocioRoutes);
app.use('/api/admin/turnero/config', verificarToken, requiereRol('admin'), adminTurneroConfigRoutes);
app.use('/api/admin/operativo',      verificarToken, requiereRol('admin'), adminOperativoRoutes);
app.use('/api/admin/horario-atencion', verificarToken, adminHorarioAtencionRoutes);
app.use('/api/admin/feriados',         verificarToken, requiereRol('admin'), adminFeriadosRoutes);
app.use('/api/admin/imagenes',         verificarToken, requiereRol('admin'), adminImagenesRoutes);

// --- Arranque del servidor ---
const startServer = async () => {
  console.log('[index] Verificando conexión a la base de datos...');
  await testConnection();
  app.listen(PORT, () => {
    console.log(`[index] ✅ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`[index] Entorno: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer().catch((err) => {
  console.error('[index] ❌ Error fatal al iniciar el servidor:', err);
  process.exit(1);
});