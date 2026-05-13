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
import planillasRouter  from './routes/planillas.js';
import cajaRouter       from './routes/caja.js';
import gestionRouter    from './routes/gestion.js';
import balancesRouter   from './routes/balances.js';
import inicioRoutes     from './routes/inicio.js';
import authRoutes       from './routes/auth.js';
import authBarberoRoutes from './routes/authBarbero.js';
import turneroRoutes    from './routes/turnero.js';

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
// /api/ventas y /api/gastos son rutas MIXTAS:
// POST es público (flujos operativos). GET /mensual y DELETE /:id requieren token.
// La protección se aplica a nivel de router en routes/ventas.js y routes/gastos.js.
app.use('/api/ventas',     ventaRoutes);
app.use('/api/gastos',     gastoRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS PROTEGIDAS — solo accesibles desde el panel admin con JWT válido
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/planillas', verificarToken, planillasRouter);
app.use('/api/caja',      verificarToken, cajaRouter);
app.use('/api/inicio',    verificarToken, inicioRoutes);
app.use('/api/balances',  verificarToken, balancesRouter);
// GET /api/gestion/negocio es público — App.jsx lo llama al arrancar para cargar
// el logo, antes de que el usuario se autentique. El resto de /gestion requiere token.
app.use('/api/gestion', (req, res, next) => {
  if (req.method === 'GET' && req.path === '/negocio') return next();
  verificarToken(req, res, next);
}, gestionRouter);

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