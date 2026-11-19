// /backend/src/routes/adminNegocio.js
// Rutas admin de configuración del negocio bajo /api/admin/negocio.
// Reusan los handlers de controllers/gestion.js (sin duplicar código).
// Solo admin: requiereRol('admin') se aplica en index.js.

import { Router } from 'express';
import { getNegocioAdmin, editarNegocio, editarContactoNegocio, cambiarPinAdmin } from '../controllers/gestion.js';

const router = Router();

// GET /api/admin/negocio — datos del negocio con el contacto del dueño (el GET
// público /api/negocio usa getNegocio, sin el contacto)
router.get('/',           getNegocioAdmin);

// PUT /api/admin/negocio — editar nombre y booking_url del negocio
router.put('/',           editarNegocio);

// PUT /api/admin/negocio/contacto — mail y celular del dueño y teléfono del local
router.put('/contacto',   editarContactoNegocio);

// PUT /api/admin/negocio/pin-admin — cambiar PIN del admin
router.put('/pin-admin',  cambiarPinAdmin);

export default router;
