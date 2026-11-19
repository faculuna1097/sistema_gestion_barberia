// /backend/src/routes/adminSocios.js
// Rutas admin de socios (dueños del negocio) bajo /api/admin/socios: la lista
// (el selector de Caja y, con ?incluir_inactivos=true, la pestaña Gestión →
// Socios), el alta y la edición. No hay DELETE: los socios tienen movimientos.
// Solo admin: requiereRol('admin') se aplica en index.js.

import { Router } from 'express';
import { getSocios, crearSocio, editarSocio } from '../controllers/socios.js';

const router = Router();

router.get('/',       getSocios);
router.post('/',      crearSocio);
router.patch('/:id',  editarSocio);

export default router;
