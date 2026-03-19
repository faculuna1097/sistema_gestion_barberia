import { Router } from 'express';
import { verificarPin } from '../controllers/auth.js';

const router = Router();

router.post('/verificar-pin', verificarPin);

export default router;