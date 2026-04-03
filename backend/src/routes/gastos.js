// /backend/src/routes/gastos.js
import { Router } from 'express';
import { verificarToken } from '../middlewares/authMiddleware.js';
import { createGasto, getGastosMensual, deleteGasto, updateGasto } from '../controllers/gastos.js';

const router = Router();

router.post('/',         createGasto);                      // público — flujo operativo
router.get('/mensual',   verificarToken, getGastosMensual); // protegido — panel admin
router.delete('/:id',    verificarToken, deleteGasto);      // protegido — panel admin
router.put('/:id',       verificarToken, updateGasto);      // protegido — panel admin

export default router;