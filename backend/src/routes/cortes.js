// /backend/src/routes/cortes.js
import { Router } from 'express';
import { createCorte } from '../controllers/cortes.js';

const router = Router();
router.post('/', createCorte);
export default router;