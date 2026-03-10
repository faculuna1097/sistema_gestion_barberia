// =============================================
// index.js — Servidor principal de Barbershop Manager API
// Inicializa Express, configura middlewares y registra las rutas
// =============================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importar rutas
const healthRouter = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ────────────────────────────────────────────────
// cors: permite requests desde el frontend React (localhost:5173)
app.use(cors());

// express.json: permite recibir y parsear JSON en el body de los requests
app.use(express.json());

// ── Rutas ──────────────────────────────────────────────────────
// Todas las rutas de la API empiezan con /api
app.use('/api/health', healthRouter);

// Ruta raíz — útil para confirmar que el servidor está vivo
app.get('/', (req, res) => {
  res.json({ message: 'Barbershop Manager API v1.0' });
});

// ── Iniciar servidor ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});