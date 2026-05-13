// /backend/src/routes/turnero.js
// Rutas públicas del turnero. Sin verificarToken — solo tenantMiddleware
// (que ya corre globalmente desde index.js).
// Cobertura: plan_turnero_v2.md sección 4.

import { Router } from 'express';
import {
  getTenant,
  getServicios,
  getBarberos,
  getDisponibilidad,
  crearTurno,
  getTurnoPorToken,
  cancelarTurno,
  reprogramarTurno,
} from '../controllers/turnero.js';

const router = Router();

router.get('/tenant',                       getTenant);
router.get('/servicios',                    getServicios);
router.get('/barberos',                     getBarberos);
router.get('/disponibilidad',               getDisponibilidad);

router.post('/turnos',                      crearTurno);
router.get('/turnos/:token',                getTurnoPorToken);
router.post('/turnos/:token/cancelar',      cancelarTurno);
router.post('/turnos/:token/reprogramar',   reprogramarTurno);

export default router;
