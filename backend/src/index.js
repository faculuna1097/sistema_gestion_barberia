// /backend/src/index.js
// Punto de entrada del servidor Express.
// Responsabilidad: arrancar el servidor y registrar las rutas principales.
// No contiene lógica de negocio — eso vive en /routes y /controllers.

import express from 'express';
import cors from 'cors';
import { testConnection } from './config/db.js';

// --- Importación de rutas ---
// Cada archivo de rutas agrupa los endpoints de un recurso
import barberoRoutes from './routes/barberos.js';
import servicioRoutes from './routes/servicios.js';
import productoRoutes from './routes/productos.js';
import corteRoutes from './routes/cortes.js';
import ventaRoutes from './routes/ventas.js';
import gastoRoutes from './routes/gastos.js';

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middlewares globales ---
// cors: permite que el frontend (en otro puerto) haga requests al backend
// express.json(): parsea el body de los POST/PUT como JSON automáticamente
app.use(cors());
app.use(express.json());

// --- Ruta de salud (health check) ---
// Sirve para verificar que el servidor está corriendo sin tocar la DB
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Registro de rutas por recurso ---
// Cada prefijo agrupa todos los endpoints de ese recurso
app.use('/api/barberos', barberoRoutes);
app.use('/api/servicios', servicioRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/cortes', corteRoutes);
app.use('/api/ventas', ventaRoutes);
app.use('/api/gastos', gastoRoutes);

// --- Arranque del servidor ---
const startServer = async () => {
  await testConnection(); // verifica conexión a PostgreSQL antes de abrir el puerto
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
};

startServer();