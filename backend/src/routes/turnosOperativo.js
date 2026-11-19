// /backend/src/routes/turnosOperativo.js
// Rutas del flujo operativo (/api/turnos). En index.js se montan con
// verificarToken + requiereRol('operativo', 'admin'): las usan el iPad y el panel.
// No confundir con /api/admin/turnos (backoffice: admin y barbero).

import { Router } from 'express';
import { getTurnosOperativos, getTurnosSinCobrar } from '../controllers/turnosOperativo.js';

const router = Router();

// GET /api/turnos?barbero_id=...&fecha=YYYY-MM-DD
router.get('/', getTurnosOperativos);

// GET /api/turnos/sin-cobrar — aviso de turnos reservados que ya terminaron (F3)
router.get('/sin-cobrar', getTurnosSinCobrar);

export default router;
