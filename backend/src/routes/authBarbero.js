// /backend/src/routes/authBarbero.js
// Rutas de autenticación de la app del barbero.
// Se montan bajo /api/auth/barbero en index.js, sin verificarToken
// (solo pasa por tenantMiddleware como toda la API).

import { Router } from 'express';
import { loginBarbero } from '../controllers/authBarbero.js';

const router = Router();

router.post('/login', loginBarbero);

export default router;
