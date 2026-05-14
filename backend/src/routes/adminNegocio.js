// /backend/src/routes/adminNegocio.js
// Rutas admin de configuración del negocio bajo /api/admin/negocio.
// Reusan los handlers de controllers/gestion.js (sin duplicar código).
// Solo admin: requiereRol('admin') se aplica en index.js.

import { Router } from 'express';
import { editarNegocio, cambiarPinAdmin } from '../controllers/gestion.js';

const router = Router();

// PUT /api/admin/negocio — editar nombre/logo del negocio
router.put('/',           editarNegocio);

// PUT /api/admin/negocio/pin-admin — cambiar PIN del admin
router.put('/pin-admin',  cambiarPinAdmin);

export default router;
