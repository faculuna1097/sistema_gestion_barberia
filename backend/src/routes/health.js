// =============================================
// health.js — Ruta de verificación del sistema
// GET /api/health → confirma que el servidor y la DB responden
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * GET /api/health
 * Verifica que el servidor esté activo y que la conexión a la DB funcione.
 * Útil para diagnóstico y para confirmar que el setup está correcto.
 * @returns {Object} status, timestamp del servidor y de la DB
 */
router.get('/', async (req, res) => {
  try {
    // Consulta mínima para verificar que la DB responde
    const result = await db.query('SELECT NOW() as db_time');
    
    res.json({
      status: 'ok',
      server_time: new Date().toISOString(),
      db_time: result.rows[0].db_time,
      message: 'Barbershop Manager API funcionando correctamente'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'No se pudo conectar a la base de datos',
      error: error.message
    });
  }
});

module.exports = router;