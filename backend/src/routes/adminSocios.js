// /backend/src/routes/adminSocios.js
// Rutas admin de socios (dueños del negocio) bajo /api/admin/socios.
// Solo lectura: los socios se cargan por SQL, no hay pantalla de alta.
// Solo admin: requiereRol('admin') se aplica en index.js.

import { Router } from 'express';
import { getSocios } from '../controllers/socios.js';

const router = Router();

router.get('/', getSocios);

export default router;
