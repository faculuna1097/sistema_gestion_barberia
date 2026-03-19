// backend/src/routes/inicio.js
// Rutas para la sección Inicio del panel de administrador.

import { Router } from 'express';
import { getResumenDia, getComparativoMes, getStockBajo } from '../controllers/inicio.js';

const router = Router();

router.get('/resumen-dia',      getResumenDia);
router.get('/comparativo-mes',  getComparativoMes);
router.get('/stock-bajo',       getStockBajo);

export default router;
