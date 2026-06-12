// /backend/src/routes/authOperativo.js
// Rutas de autenticación del modo operativo (iPad del local).
// Se montan bajo /api/auth/operativo en index.js, sin verificarToken
// (solo pasa por tenantMiddleware como toda la API).

import { Router } from 'express';
import { loginOperativo } from '../controllers/authOperativo.js';

const router = Router();

router.post('/login', loginOperativo);

export default router;
