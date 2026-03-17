// backend/src/routes/gestion.js
// Define todas las rutas de la sección Gestión del panel admin.

import { Router } from 'express';
import {
  getBarberos, crearBarbero, editarBarbero,
  getServicios, crearServicio, editarServicio,
  getProductos, crearProducto, editarProducto, agregarStock,
  getNegocio, editarNegocio,
  cambiarPinAdmin,
} from '../controllers/gestion.js';

const router = Router();

// ── Barberos ──────────────────────────────────────────────────────────────────
router.get('/barberos',          getBarberos);
router.post('/barberos',         crearBarbero);
router.put('/barberos/:id',      editarBarbero);

// ── Servicios ─────────────────────────────────────────────────────────────────
router.get('/servicios',         getServicios);
router.post('/servicios',        crearServicio);
router.put('/servicios/:id',     editarServicio);

// ── Productos ─────────────────────────────────────────────────────────────────
router.get('/productos',         getProductos);
router.post('/productos',        crearProducto);
router.put('/productos/:id',     editarProducto);
router.put('/productos/:id/agregar-stock', agregarStock);

// ── Datos del negocio ─────────────────────────────────────────────────────────
router.get('/negocio',           getNegocio);
router.put('/negocio',           editarNegocio);

// ── PIN admin ─────────────────────────────────────────────────────────────────
router.put('/pin-admin',         cambiarPinAdmin);

export default router;
