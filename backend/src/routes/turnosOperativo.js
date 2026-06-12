// /backend/src/routes/turnosOperativo.js
// Ruta pública del flujo operativo (/api/turnos).
// Sin auth — la consume FlujoCorte (modo iPad) para listar los turnos del día.
// No confundir con /api/admin/turnos (backoffice, con JWT).

import { Router } from 'express';
import { getTurnosOperativos } from '../controllers/turnosOperativo.js';

const router = Router();

// GET /api/turnos?barbero_id=...&fecha=YYYY-MM-DD
router.get('/', getTurnosOperativos);

export default router;
