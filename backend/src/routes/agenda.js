// /backend/src/routes/agenda.js
// Ruta de la Agenda del día (/api/admin/agenda).
// Acepta roles admin y barbero — el scoping se resuelve en el handler.

import { Router } from 'express';
import { getAgenda } from '../controllers/agenda.js';

const router = Router();

// GET    /api/admin/agenda?fecha=YYYY-MM-DD&barbero_id=X  (barbero_id solo admin)
router.get('/', getAgenda);

export default router;
