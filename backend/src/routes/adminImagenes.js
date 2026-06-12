// /backend/src/routes/adminImagenes.js
// Rutas del backoffice para las imágenes del tenant (fotos del local,
// cortes de ejemplo, logos). Se monta bajo /api/admin/imagenes.
// Exclusivo de admin (el middleware de rol se aplica en index.js).

import { Router } from 'express';
import express from 'express';
import { getImagenes, postImagen, deleteImagen } from '../controllers/imagenes.js';

const router = Router();

// El POST recibe la imagen como binario crudo, no como JSON. express.raw()
// la deja en req.body como Buffer. Limita a 1 MB: red de seguridad por si la
// compresión del frontend fallara (Storage también lo limita en el bucket).
const parsearImagen = express.raw({ type: 'image/webp', limit: '1mb' });

// GET /api/admin/imagenes — lista las imágenes del tenant
router.get('/', getImagenes);

// POST /api/admin/imagenes?tipo=...&orden=... — sube/reemplaza una imagen
router.post('/', parsearImagen, postImagen);

// DELETE /api/admin/imagenes/:id — elimina una imagen
router.delete('/:id', deleteImagen);

export default router;
