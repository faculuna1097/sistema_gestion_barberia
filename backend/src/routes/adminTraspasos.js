// /backend/src/routes/adminTraspasos.js
// Rutas del traspaso de turnos entre barberos bajo /api/admin/traspasos (F2 de
// mejoras operativas). Solo rol barbero: requiereRol('barbero') se aplica en
// index.js, y el admin recibe 403 (el admin no interviene en los traspasos).

import { Router } from 'express';
import {
  getTraspasos, getCandidatos, postTraspaso, retirarTraspaso, rechazarTraspaso, postAceptarTraspaso,
} from '../controllers/traspasos.js';

const router = Router();

router.get('/',               getTraspasos);
router.get('/candidatos',     getCandidatos);
router.post('/',              postTraspaso);
router.post('/:id/retirar',   retirarTraspaso);
router.post('/:id/rechazar',  rechazarTraspaso);
router.post('/:id/aceptar',   postAceptarTraspaso);

export default router;
