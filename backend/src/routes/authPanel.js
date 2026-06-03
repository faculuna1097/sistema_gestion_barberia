// /backend/src/routes/authPanel.js
// Rutas del login unificado del panel de gestión.
// Se montan bajo /api/auth/panel en index.js, sin verificarToken
// (solo pasa por tenantMiddleware como toda la API).

import { Router } from 'express';
import { loginPanel } from '../controllers/authPanel.js';

const router = Router();

router.post('/login', loginPanel);

export default router;
