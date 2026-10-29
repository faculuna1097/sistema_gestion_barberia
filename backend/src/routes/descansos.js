// /backend/src/routes/descansos.js
// Rutas de descansos del backoffice (/api/admin/descansos).
// Acepta roles admin y barbero — el scoping se resuelve en el handler.
// Para liberar un descanso se usa DELETE /api/admin/suspensiones/:id.

import { Router } from 'express';
import { getDescansos, postDescanso } from '../controllers/descansos.js';

const router = Router();

// GET    /api/admin/descansos?desde=&hasta=&barbero_id=  (barbero_id solo admin)
router.get('/', getDescansos);
// POST   /api/admin/descansos
router.post('/', postDescanso);

export default router;
