// /backend/src/routes/planillas.js
// Define las rutas HTTP para los endpoints de planillas semanales.

import { Router } from "express";
import { getDetalleSemanal, getResumenSemanal } from "../controllers/planillas.js";

const router = Router();

// GET /api/planillas/detalle-semanal?semana=YYYY-WNN
router.get("/detalle-semanal", getDetalleSemanal);

// GET /api/planillas/resumen-semanal?semana=YYYY-WNN
router.get("/resumen-semanal", getResumenSemanal);

export default router;
