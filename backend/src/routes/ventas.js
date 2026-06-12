// /backend/src/routes/ventas.js
// Todos los endpoints requieren JWT válido (verificarToken se aplica a nivel
// app.use en index.js). Acá solo se declara qué rol puede acceder a cada uno.
//
// - POST  /              → operativo o admin (crea venta desde el iPad o desde el panel)
// - GET   /mensual       → admin (consulta de historial)
// - DELETE/PUT /:id      → admin (gestión de movimientos pasados)

import { Router } from 'express';
import { requiereRol } from '../middlewares/requiereRolMiddleware.js';
import { createVenta, getVentasMensual, deleteVenta, updateVenta } from '../controllers/ventas.js';

const router = Router();

router.post('/',        requiereRol('operativo', 'admin'), createVenta);
router.get('/mensual',  requiereRol('admin'),              getVentasMensual);
router.delete('/:id',   requiereRol('admin'),              deleteVenta);
router.put('/:id',      requiereRol('admin'),              updateVenta);

export default router;
