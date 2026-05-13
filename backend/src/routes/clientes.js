// /backend/src/routes/clientes.js
// Rutas de búsqueda de clientes del backoffice (/api/admin/clientes).
// Acepta ambos roles — no requiere requiereRol.

import { Router } from 'express';
import { getClientes } from '../controllers/clientes.js';

const router = Router();

// GET /api/admin/clientes?busqueda=X
router.get('/', getClientes);

export default router;
