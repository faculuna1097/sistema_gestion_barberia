// /backend/src/routes/barberos.js
// Define las rutas HTTP del recurso "barbero".
// El router no contiene lógica — delega todo al controlador.

import { Router } from 'express';
import { getBarberos } from '../controllers/barberos.js';

const router = Router();

// GET /api/barberos → devuelve todos los barberos activos del tenant
router.get('/', getBarberos);

export default router;