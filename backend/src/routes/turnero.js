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
  getDiasDisponibles,
  crearTurno,
  getTurnoPorToken,
  cancelarTurno,
  reprogramarTurno,
} from '../controllers/turnero.js';
import { limiterReserva, limiterReservaRafaga } from '../middlewares/rateLimitMiddleware.js';

const router = Router();

router.get('/tenant',                       getTenant);
router.get('/servicios',                    getServicios);
router.get('/barberos',                     getBarberos);
router.get('/disponibilidad',               getDisponibilidad);
router.get('/dias-disponibles',             getDiasDisponibles);

// La reserva es la única escritura anónima sin credencial previa: crea un turno
// real y dispara un mail → rate limit doble [auditoría 3.1]: ráfaga (3/min)
// primero, después el techo horario (10/h). Los GET de arriba quedan sin límite
// propio a propósito (el wizard navega con muchas lecturas; los cubre el
// backstop global). Cancelar/reprogramar exigen token_gestion válido.
router.post('/turnos',                      limiterReservaRafaga, limiterReserva, crearTurno);
router.get('/turnos/:token',                getTurnoPorToken);
router.post('/turnos/:token/cancelar',      cancelarTurno);
router.post('/turnos/:token/reprogramar',   reprogramarTurno);

export default router;
