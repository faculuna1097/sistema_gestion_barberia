// /backend/src/routes/turnero.js
// Rutas públicas del turnero. Sin verificarToken — solo tenantMiddleware
// (que ya corre globalmente desde index.js).
// Cobertura: decisiones_turnero.md.

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
import {
  limiterReserva, limiterReservaRafaga, limiterGestion, limiterGestionRafaga,
} from '../middlewares/rateLimitMiddleware.js';

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
// backstop global).
router.post('/turnos',                      limiterReservaRafaga, limiterReserva, crearTurno);
// Ver el turno es una lectura: sin límite propio, como los GET de arriba.
router.get('/turnos/:token',                getTurnoPorToken);
// Cancelar y reprogramar exigen el token_gestion, pero quien reserva lo recibe
// en la respuesta: el token solo no frena el abuso, y cada llamada que sale bien
// manda un mail [auditoría 2026-11, Z3-01]. Mismo esquema doble que la reserva
// (3/min y 10/h, contando solo las que salen bien), con un contador compartido
// entre las dos rutas.
router.post('/turnos/:token/cancelar',      limiterGestionRafaga, limiterGestion, cancelarTurno);
router.post('/turnos/:token/reprogramar',   limiterGestionRafaga, limiterGestion, reprogramarTurno);

export default router;
