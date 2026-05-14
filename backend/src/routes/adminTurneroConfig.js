// /backend/src/routes/adminTurneroConfig.js
// Rutas admin de configuración del turnero bajo /api/admin/turnero/config.
// Solo admin: requiereRol('admin') se aplica en index.js.

import { Router } from 'express';
import { getConfig, putConfig } from '../controllers/turneroConfig.js';

const router = Router();

// GET /api/admin/turnero/config — leer configuración actual
router.get('/', getConfig);

// PUT /api/admin/turnero/config — actualizar configuración
router.put('/', putConfig);

export default router;
