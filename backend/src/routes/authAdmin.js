// /backend/src/routes/authAdmin.js
// Rutas de autenticación del admin (panel de gestión).
// Se montan bajo /api/auth/admin en index.js, sin verificarToken
// (solo pasa por tenantMiddleware como toda la API).

import { Router } from 'express';
import { loginAdmin } from '../controllers/authAdmin.js';

const router = Router();

router.post('/login', loginAdmin);

export default router;
