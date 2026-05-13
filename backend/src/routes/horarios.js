// /backend/src/routes/horarios.js
// Rutas de horarios semanales del backoffice (/api/admin/horarios).
// Acepta roles admin y barbero — el scoping se resuelve en cada handler.

import { Router } from 'express';
import { getHorarios, putHorarios } from '../controllers/horarios.js';

const router = Router();

// GET /api/admin/horarios/:barbero_id
router.get('/:barbero_id', getHorarios);

// PUT /api/admin/horarios/:barbero_id — reemplaza completo
router.put('/:barbero_id', putHorarios);

export default router;
