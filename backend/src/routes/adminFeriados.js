// /backend/src/routes/adminFeriados.js
// Rutas del backoffice para los feriados puntuales del tenant.
// Se monta bajo /api/admin/feriados. Exclusivo de admin
// (el middleware de rol se aplica en index.js).

import { Router } from 'express';
import { getFeriados, postFeriado, deleteFeriado } from '../controllers/feriados.js';

const router = Router();

// GET /api/admin/feriados — lista de feriados (?desde=YYYY-MM-DD opcional)
router.get('/', getFeriados);

// POST /api/admin/feriados — carga un feriado (con cascada de cancelación)
router.post('/', postFeriado);

// DELETE /api/admin/feriados/:id — elimina un feriado
router.delete('/:id', deleteFeriado);

export default router;
