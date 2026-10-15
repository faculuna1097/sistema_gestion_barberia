// /backend/src/routes/descansos.js
// Rutas de descansos del backoffice (/api/admin/descansos).
// Acepta roles admin y barbero — el scoping se resuelve en el handler.
// Para liberar un descanso se usa DELETE /api/admin/suspensiones/:id.

import { Router } from 'express';
import { postDescanso } from '../controllers/descansos.js';

const router = Router();

// POST   /api/admin/descansos
router.post('/', postDescanso);

export default router;
