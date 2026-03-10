// /backend/src/routes/servicios.js
import { Router } from 'express';
import { getServicios } from '../controllers/servicios.js';

const router = Router();
router.get('/', getServicios);

export default router;