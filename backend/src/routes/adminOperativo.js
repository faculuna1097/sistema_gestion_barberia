// /backend/src/routes/adminOperativo.js
// Rutas admin para gestionar las credenciales del modo operativo.
// Se montan bajo /api/admin/operativo en index.js con verificarToken +
// requiereRol('admin') a nivel app.use.

import { Router } from 'express';
import {
  obtenerCredencialesOperativas,
  actualizarCredencialesOperativas,
} from '../controllers/adminOperativo.js';

const router = Router();

router.get('/credenciales', obtenerCredencialesOperativas);
router.put('/credenciales', actualizarCredencialesOperativas);

export default router;
