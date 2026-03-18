// /backend/src/routes/balances.js
// Define las rutas del módulo Balances.

import { Router } from 'express';
import { getBalanceMensual, getBalanceHistorico } from '../controllers/balances.js';

const router = Router();

// GET /api/balances/mensual?mes=YYYY-MM
router.get('/mensual', getBalanceMensual);

// GET /api/balances/historico?cantidad=12
router.get('/historico', getBalanceHistorico);

export default router;
