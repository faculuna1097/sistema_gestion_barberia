// /backend/src/routes/adminHorarioAtencion.js
// Rutas del backoffice para el horario semanal de atención del tenant.
// Se monta bajo /api/admin/horario-atencion. El control de rol es por método
// (verificarToken se aplica en index.js):
//   - GET: admin + barbero. El turnero del barbero en el panel lee la jornada
//     del local para definir el rango de la agenda; es lectura inocua.
//   - PUT: solo admin. Modificar el horario del local es exclusivo del dueño.

import { Router } from 'express';
import { getHorarioAtencion, putHorarioAtencion } from '../controllers/horarioAtencion.js';
import { requiereRol } from '../middlewares/requiereRolMiddleware.js';

const router = Router();

// GET /api/admin/horario-atencion — horario semanal completo (7 días)
router.get('/', requiereRol('admin', 'barbero'), getHorarioAtencion);

// PUT /api/admin/horario-atencion — reemplaza el horario completo
router.put('/', requiereRol('admin'), putHorarioAtencion);

export default router;
