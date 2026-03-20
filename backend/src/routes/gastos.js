// /backend/src/routes/gastos.js
// Ruta mixta:
//   POST /        — público (FlujoGasto, sin token)
//   GET /mensual  — protegida (panel admin, requiere JWT)
//   DELETE /:id   — protegida (panel admin, requiere JWT)

import { Router } from 'express';
import { verificarToken } from '../middlewares/authMiddleware.js';
import { createGasto, getGastosMensual, deleteGasto } from '../controllers/gastos.js';

const router = Router();

router.post('/',         createGasto);                      // público — flujo operativo
router.get('/mensual',   verificarToken, getGastosMensual); // protegido — panel admin
router.delete('/:id',    verificarToken, deleteGasto);      // protegido — panel admin

export default router;
