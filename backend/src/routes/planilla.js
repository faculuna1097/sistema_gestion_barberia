// /backend/src/routes/planilla.js
// Rutas de planilla semanal del backoffice (/api/admin/planilla).
// Acepta roles admin y barbero — el scoping se resuelve en cada handler.

import { Router } from 'express';
import { getPlanilla, getResumen } from '../controllers/planilla.js';

const router = Router();

// GET /api/admin/planilla?semana=YYYY-MM-DD&barbero_id=X
router.get('/', getPlanilla);

// GET /api/admin/planilla/resumen?semana=YYYY-MM-DD&barbero_id=X
router.get('/resumen', getResumen);

export default router;
