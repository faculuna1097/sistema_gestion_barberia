// backend/src/routes/caja.js
import { Router } from 'express';
import { getMovimientosDia, eliminarMovimiento } from '../controllers/caja.js';

const router = Router();

router.get('/movimientos-dia', getMovimientosDia);
router.delete('/movimientos/:tipo/:id', eliminarMovimiento);


export default router;