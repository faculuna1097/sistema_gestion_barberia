// /backend/src/routes/ventas.js
import { Router } from 'express';
import { verificarToken } from '../middlewares/authMiddleware.js';
import { createVenta, getVentasMensual, deleteVenta, updateVenta } from '../controllers/ventas.js';

const router = Router();

router.post('/',        createVenta);                       // público — flujo operativo
router.get('/mensual',  verificarToken, getVentasMensual);  // protegido — panel admin
router.delete('/:id',   verificarToken, deleteVenta);       // protegido — panel admin
router.put('/:id',      verificarToken, updateVenta);       // protegido — panel admin

export default router;