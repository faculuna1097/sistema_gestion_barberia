// /backend/src/routes/ventas.js
// Ruta mixta:
//   POST /        — público (FlujoVenta, sin token)
//   GET /mensual  — protegida (panel admin, requiere JWT)
//   DELETE /:id   — protegida (panel admin, requiere JWT)

import { Router } from 'express';
import { verificarToken } from '../middlewares/authMiddleware.js';
import { createVenta, getVentasMensual, deleteVenta } from '../controllers/ventas.js';

const router = Router();

router.post('/',        createVenta);                       // público — flujo operativo
router.get('/mensual',  verificarToken, getVentasMensual);  // protegido — panel admin
router.delete('/:id',   verificarToken, deleteVenta);       // protegido — panel admin

export default router;
