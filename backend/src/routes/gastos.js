// /backend/src/routes/gastos.js
import { Router } from 'express';
import { createGasto, getGastosMensual, deleteGasto } from '../controllers/gastos.js';

const router = Router();

router.post('/',          createGasto);
router.get('/mensual',    getGastosMensual);
router.delete('/:id',     deleteGasto);

export default router;
