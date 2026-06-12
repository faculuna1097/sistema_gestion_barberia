// /backend/src/routes/suspensiones.js
// Rutas de suspensiones del backoffice (/api/admin/suspensiones).
// Acepta roles admin y barbero — el scoping se resuelve en cada handler.

import { Router } from 'express';
import { getSuspensiones, postSuspension, deleteSuspension } from '../controllers/suspensiones.js';

const router = Router();

// GET    /api/admin/suspensiones?barbero_id=X
router.get('/', getSuspensiones);

// POST   /api/admin/suspensiones
router.post('/', postSuspension);

// DELETE /api/admin/suspensiones/:id
router.delete('/:id', deleteSuspension);

export default router;
