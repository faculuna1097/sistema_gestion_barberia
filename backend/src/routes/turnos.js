// /backend/src/routes/turnos.js
// Rutas de gestión de turnos del backoffice (/api/admin/turnos).
// Acepta roles admin y barbero — el scoping se resuelve en cada handler.

import { Router } from 'express';
import { getTurnos, crearTurnoAdmin, patchEstado, completarTurno, deleteTurno } from '../controllers/turnos.js';

const router = Router();

// GET    /api/admin/turnos?fecha=YYYY-MM-DD  o  ?desde=...&hasta=...&barbero_id=...
router.get('/', getTurnos);

// POST   /api/admin/turnos   — reserva manual
router.post('/', crearTurnoAdmin);

// PATCH  /api/admin/turnos/:id/estado  — completado | no_asistio (solo cambia estado)
router.patch('/:id/estado', patchEstado);

// POST   /api/admin/turnos/:id/completar  — completa + registra el corte (forma_pago, precio, propina)
router.post('/:id/completar', completarTurno);

// DELETE /api/admin/turnos/:id  — cancela
router.delete('/:id', deleteTurno);

export default router;
