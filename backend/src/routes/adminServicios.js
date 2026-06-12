// /backend/src/routes/adminServicios.js
// Rutas admin de servicios bajo /api/admin/servicios.
// Reusan los handlers de controllers/gestion.js (sin duplicar código).
// Solo admin: requiereRol('admin') se aplica en index.js.

import { Router } from 'express';
import { getServicios, crearServicio, editarServicio } from '../controllers/gestion.js';

const router = Router();

router.get('/',      getServicios);
router.post('/',     crearServicio);
router.put('/:id',   editarServicio);

export default router;
