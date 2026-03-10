// /backend/src/routes/gastos.js
import { Router } from 'express';
import { createGasto } from '../controllers/gastos.js';

const router = Router();
router.post('/', createGasto);
export default router;