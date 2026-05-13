// /backend/src/routes/adminBarberos.js
// Rutas admin de barberos bajo /api/admin/barberos.
// Reusan los handlers de controllers/gestion.js (sin duplicar código).
// Solo admin: requiereRol('admin') se aplica en index.js.

import { Router } from 'express';
import { getBarberos, crearBarbero, editarBarbero } from '../controllers/gestion.js';

const router = Router();

router.get('/',      getBarberos);
router.post('/',     crearBarbero);
router.put('/:id',   editarBarbero);

export default router;
