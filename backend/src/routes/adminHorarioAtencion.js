// /backend/src/routes/adminHorarioAtencion.js
// Rutas del backoffice para el horario semanal de atención del tenant.
// Se monta bajo /api/admin/horario-atencion. Exclusivo de admin
// (el middleware de rol se aplica en index.js).

import { Router } from 'express';
import { getHorarioAtencion, putHorarioAtencion } from '../controllers/horarioAtencion.js';

const router = Router();

// GET /api/admin/horario-atencion — horario semanal completo (7 días)
router.get('/', getHorarioAtencion);

// PUT /api/admin/horario-atencion — reemplaza el horario completo
router.put('/', putHorarioAtencion);

export default router;
