// /backend/src/routes/authRecuperar.js
// Recuperación por mail de la contraseña del iPad y del PIN de admin.
// Se monta bajo /api/auth/recuperar en index.js, con limiterLogin y sin
// verificarToken (solo pasa por tenantMiddleware como toda la API).

import { Router } from 'express';
import { solicitarRecuperacion, validarRecuperacion, usarRecuperacion } from '../controllers/authRecuperar.js';

const router = Router();

router.post('/solicitar', solicitarRecuperacion);
router.post('/validar',   validarRecuperacion);
router.post('/usar',      usarRecuperacion);

export default router;
