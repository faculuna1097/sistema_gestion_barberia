// /backend/src/index.js
// Punto de entrada del servidor Express.
// Responsabilidad: arrancar el servidor y registrar las rutas principales.
// No contiene lógica de negocio — eso vive en /routes y /controllers.

import express from 'express';
import cors from 'cors';
import { testConnection } from './config/db.js';
import { verificarToken } from './middlewares/authMiddleware.js';
import { tenantMiddleware } from './middlewares/tenantMiddleware.js';

// --- Importación de rutas ---
import barberoRoutes    from './routes/barberos.js';
import servicioRoutes   from './routes/servicios.js';
import productoRoutes   from './routes/productos.js';
import corteRoutes      from './routes/cortes.js';
import ventaRoutes      from './routes/ventas.js';    // mixto: POST público, resto protegido (ver routes/ventas.js)
import gastoRoutes      from './routes/gastos.js';    // mixto: POST público, resto protegido (ver routes/gastos.js)
import categoriaRoutes  from './routes/categorias.js';
import planillasRouter  from './routes/planillas.js';
import cajaRouter       from './routes/caja.js';
import gestionRouter    from './routes/gestion.js';
import balancesRouter   from './routes/balances.js';
import inicioRoutes     from './routes/inicio.js';
import authRoutes       from './routes/auth.js';

console.log('[index] Iniciando Barbershop Manager API...');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middlewares globales ---
app.use(cors());
app.use(express.json());

// tenantMiddleware — corre en TODAS las rutas antes que cualquier controller.
// Establece req.tenant_id desde .env. En rutas protegidas, verificarToken
// lo sobreescribe con el valor del JWT.
app.use(tenantMiddleware);

// Middleware de logging global — loguea cada request que llega al servidor
app.use((req, res, next) => {
  console.log(
    `[index] ${req.method} ${req.url}`,
    req.body && Object.keys(req.body).length ? '— body:' : '',
    req.body && Object.keys(req.body).length ? req.body : ''
  );
  next();
});

// --- Ruta de salud (health check) ---
app.get('/api/health', (req, res) => {
  console.log('[index] Health check solicitado');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS PÚBLICAS — accesibles sin token (flujos operativos + auth)
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);       // login — nunca proteger
app.use('/api/barberos',  barberoRoutes);    // usado en FlujoCorte
app.use('/api/servicios', servicioRoutes);   // usado en FlujoCorte
app.use('/api/productos', productoRoutes);   // usado en FlujoVenta
app.use('/api/categorias', categoriaRoutes); // usado en FlujoGasto
app.use('/api/cortes',    corteRoutes);      // POST desde FlujoCorte
// Nota: /api/ventas y /api/gastos son rutas MIXTAS.
// El POST es público (flujos operativos). GET /mensual y DELETE /:id requieren token.
// La protección se aplica a nivel de router en routes/ventas.js y routes/gastos.js.
app.use('/api/ventas',    ventaRoutes);
app.use('/api/gastos',    gastoRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS PROTEGIDAS — solo accesibles desde el panel admin con JWT válido
// verificarToken inyecta req.tenant_id antes de que llegue al controller
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/planillas', verificarToken, planillasRouter);
app.use('/api/caja',      verificarToken, cajaRouter);
app.use('/api/inicio',    verificarToken, inicioRoutes);
app.use('/api/balances',  verificarToken, balancesRouter);
// GET /api/gestion/negocio es público — App.jsx lo llama al arrancar para cargar el logo,
// antes de que el usuario se autentique. PUT /negocio y el resto de /gestion sí requieren token.
app.use('/api/gestion', (req, res, next) => {
  if (req.method === 'GET' && req.path === '/negocio') return next();
  verificarToken(req, res, next);
}, gestionRouter);

console.log('[index] Rutas registradas — públicas: auth, barberos, servicios, productos, cortes, ventas, gastos, categorias');
console.log('[index] Rutas protegidas (JWT): planillas, caja, inicio, balances, gestion');
console.log('[index] Rutas mixtas (POST público / resto protegido): ventas, gastos');

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
