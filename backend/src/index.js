// /backend/src/index.js
// Punto de entrada del servidor Express.
// Responsabilidad: arrancar el servidor y registrar las rutas principales.
// No contiene lógica de negocio — eso vive en /routes y /controllers.

import express from 'express';
import cors from 'cors';
import { testConnection } from './config/db.js';

// --- Importación de rutas ---
import barberoRoutes from './routes/barberos.js';
import servicioRoutes from './routes/servicios.js';
import productoRoutes from './routes/productos.js';
import corteRoutes from './routes/cortes.js';
import ventaRoutes from './routes/ventas.js';
import gastoRoutes from './routes/gastos.js';
import categoriaRoutes from './routes/categorias.js';
import planillasRouter from "./routes/planillas.js";
import cajaRouter from './routes/caja.js';
import gestionRouter from './routes/gestion.js';
import balancesRouter from './routes/balances.js';
import inicioRoutes from './routes/inicio.js';



console.log('[index] Iniciando Barbershop Manager API...');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middlewares globales ---
app.use(cors());
app.use(express.json());

// Middleware de logging global — loguea cada request que llega al servidor
app.use((req, res, next) => {
  console.log(`[index] ${req.method} ${req.url}`, req.body && Object.keys(req.body).length ? '— body:' : '', req.body && Object.keys(req.body).length ? req.body : '');
  next();
});

// --- Ruta de salud (health check) ---
app.get('/api/health', (req, res) => {
  console.log('[index] Health check solicitado');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Registro de rutas por recurso ---
app.use('/api/barberos', barberoRoutes);
app.use('/api/servicios', servicioRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/cortes', corteRoutes);
app.use('/api/ventas', ventaRoutes);
app.use('/api/gastos', gastoRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use("/api/planillas", planillasRouter);
app.use('/api/caja', cajaRouter);
app.use('/api/gestion', gestionRouter);
app.use('/api/balances', balancesRouter);
app.use('/api/inicio', inicioRoutes);



console.log('[index] Rutas registradas: /api/barberos, /api/servicios, /api/productos, /api/cortes, /api/ventas, /api/gastos, /api/categorias, /api/gestion');

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