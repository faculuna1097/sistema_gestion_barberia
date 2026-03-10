// /backend/src/routes/ventas.js
import { Router } from 'express';
import { createVenta } from '../controllers/ventas.js';

const router = Router();
router.post('/', createVenta);
export default router;