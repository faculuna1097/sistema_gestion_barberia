// /backend/src/routes/alta.js
// Rutas del formulario de alta de clientes (frontend-alta). Sin tenant ni token
// de sesión: el acceso es el token del link (el id de la solicitud), que valida
// cada controller. Se montan en index.js antes de tenantMiddleware y del log de
// acceso global, así el body (nombres, mails y teléfonos del cliente) no queda
// en los logs.
// Cobertura: plan_alta_clientes.md §5.5.

import { Router } from 'express';
import {
  obtenerSolicitud,
  guardarBorrador,
  consultarSubdominio,
  enviarSolicitud,
} from '../controllers/alta.js';
import { limiterAlta, limiterAltaEnvio } from '../middlewares/rateLimitMiddleware.js';
import { enmascararTokensEnRuta } from '../utils/sanitizarLogs.js';

const router = Router();

/**
 * logAccesoAlta
 * Log de acceso propio de /api/alta (el global de index.js no lo ve, porque va
 * después). Escribe una línea al terminar cada respuesta: método, ruta con el
 * token enmascarado, status y duración. Nunca el body, que trae datos del
 * cliente. Saltea los PUT exitosos: son el autoguardado (uno cada pocos segundos
 * por cliente) y no aportan para diagnosticar.
 * @param {Object} req - Request de Express.
 * @param {Object} res - Response de Express.
 * @param {Function} next - Siguiente middleware.
 * @returns {void}
 */
const logAccesoAlta = (req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => {
    if (req.method === 'PUT' && res.statusCode < 400) return;
    console.log(`[alta] ${req.method} ${enmascararTokensEnRuta(req.originalUrl)} → ${res.statusCode} (${Date.now() - inicio} ms)`);
  });
  next();
};

router.use(logAccesoAlta);

// Lectura, autoguardado y chequeo del subdominio: holgado, el formulario guarda
// solo mientras el cliente completa.
router.get('/:token',                    limiterAlta, obtenerSolicitud);
router.put('/:token',                    limiterAlta, guardarBorrador);
router.get('/:token/subdominio/:valor',  limiterAlta, consultarSubdominio);
// El envío es una vez por solicitud y dispara un mail: estricto.
router.post('/:token/enviar',            limiterAltaEnvio, enviarSolicitud);

// Cualquier otra ruta bajo /api/alta termina acá. Sin esto, seguiría de largo
// hasta el log de acceso global, que escribe el body.
router.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

export default router;
