// /backend/src/routes/adminProductos.js
// Rutas admin de productos bajo /api/admin/productos.
// Reusan los handlers de controllers/gestion.js (sin duplicar código).
// Solo admin: requiereRol('admin') se aplica en index.js.

import { Router } from 'express';
import {
  getProductos, crearProducto, editarProducto,
} from '../controllers/gestion.js';

const router = Router();

router.get('/',                    getProductos);
router.post('/',                   crearProducto);
router.put('/:id',                 editarProducto);

export default router;
