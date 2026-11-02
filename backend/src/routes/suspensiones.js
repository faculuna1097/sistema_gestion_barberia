// /backend/src/routes/suspensiones.js
// Rutas de suspensiones del backoffice (/api/admin/suspensiones).
// Acepta roles admin y barbero — el scoping se resuelve en cada handler.

import { Router } from 'express';
import { getSuspensiones, postSuspension, postLiberarSuspension } from '../controllers/suspensiones.js';

const router = Router();

// GET    /api/admin/suspensiones?barbero_id=X
router.get('/', getSuspensiones);

// POST   /api/admin/suspensiones
router.post('/', postSuspension);

// POST   /api/admin/suspensiones/:id/liberar  (libera, no borra: ver postLiberarSuspension)
router.post('/:id/liberar', postLiberarSuspension);

// DELETE /api/admin/suspensiones/:id  (alias de liberar para los fronts anteriores;
// se saca en un deploy posterior al merge, ver estado_actual.md)
router.delete('/:id', postLiberarSuspension);

export default router;
