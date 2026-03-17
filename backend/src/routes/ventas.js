// /backend/src/routes/ventas.js
import { Router } from 'express';
import { createVenta, getVentasMensual, deleteVenta } from '../controllers/ventas.js';

const router = Router();

router.post('/',        createVenta);
router.get('/mensual',  getVentasMensual);
router.delete('/:id',   deleteVenta);

export default router;
