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
import authRoutes       from './routes/auth.js';
import authBarberoRoutes from './routes/authBarbero.js';
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
import { requiereRol } from './middlewares/requiereRolMiddleware.js';
import { getNegocio } from './controllers/gestion.js';

console.log('[index] Iniciando Barbershop Manager API...');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middlewares globales ---
// DESPUÉS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin === 'http://localhost:5173') return callback(null, true);
    if (origin.endsWith('.barbermanager.app')) return callback(null, true);
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
// RUTAS PÚBLICAS — accesibles sin token (flujos operativos + auth)
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth/barbero', authBarberoRoutes);
app.use('/api/auth',       authRoutes);
app.use('/api/turnero',    turneroRoutes);
app.use('/api/barberos',   barberoRoutes);
app.use('/api/servicios',  servicioRoutes);
app.use('/api/productos',  productoRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/cortes',     corteRoutes);
// GET /api/turnos — turnos del día de un barbero para el flujo operativo (iPad).
// Lo consume FlujoCorte para ofrecer registrar un corte vinculado a un turno.
app.use('/api/turnos',     turnosOperativoRoutes);
// GET /api/negocio — datos públicos del negocio (nombre, logo).
// Lo consume App.jsx antes del login para mostrar el logo del tenant.
app.get('/api/negocio',    getNegocio);
// /api/ventas y /api/gastos son rutas MIXTAS:
// POST es público (flujos operativos). GET /mensual y DELETE /:id requieren token.
// La protección se aplica a nivel de router en routes/ventas.js y routes/gastos.js.
app.use('/api/ventas',     ventaRoutes);
app.use('/api/gastos',     gastoRoutes);

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

console.log('[index] Rutas registradas correctamente');

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
  console.error('[index] ❌ Error fatal al iniciar el servidor:', err.message);
  process.exit(1);
});