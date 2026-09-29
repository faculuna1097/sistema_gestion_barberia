// backend/src/routes/caja.js
// Rutas de la sección Caja del panel admin.
// Solo admin: requiereRol('admin') se aplica en index.js.
import { Router } from 'express';
import { getMovimientosDia, eliminarMovimiento } from '../controllers/caja.js';

const router = Router();

router.get('/movimientos-dia', getMovimientosDia);
router.delete('/movimientos/:tipo/:id', eliminarMovimiento);


export default router;