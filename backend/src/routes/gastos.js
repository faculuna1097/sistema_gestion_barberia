// /backend/src/routes/gastos.js
// Todos los endpoints requieren JWT válido (verificarToken se aplica a nivel
// app.use en index.js). Acá solo se declara qué rol puede acceder a cada uno.
//
// - POST  /              → operativo o admin (crea gasto desde el iPad o desde el panel)
// - GET   /mensual       → admin (consulta de historial)
// - DELETE/PUT /:id      → admin (gestión de movimientos pasados)

import { Router } from 'express';
import { requiereRol } from '../middlewares/requiereRolMiddleware.js';
import { createGasto, getGastosMensual, deleteGasto, updateGasto } from '../controllers/gastos.js';

const router = Router();

router.post('/',        requiereRol('operativo', 'admin'), createGasto);
router.get('/mensual',  requiereRol('admin'),              getGastosMensual);
router.delete('/:id',   requiereRol('admin'),              deleteGasto);
router.put('/:id',      requiereRol('admin'),              updateGasto);

export default router;
