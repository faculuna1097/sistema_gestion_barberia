// /backend/src/controllers/cortes.js
// Controlador del recurso "corte". La lógica de inserción vive en
// services/cortesService.js (registrarCorte), compartida con la completación de
// turnos del backoffice (turnosService → completarTurnoConCorte). Acá solo se
// valida el body y se mapean los errores tipados del service a respuestas HTTP.

import { registrarCorte } from '../services/cortesService.js';
import { barberoActivoEnTenant } from '../services/barberosService.js';
import { calcularDuracionServicio } from '../services/turnosService.js';
import { esMontoValido } from '../utils/validarNumero.js';
import { esFormaPagoValida } from '../utils/validarPago.js';

/**
 * createCorte
 * POST /api/cortes — registra un corte desde el flujo operativo (iPad).
 * Si viene turno_id, el service lo vincula y marca el turno como 'completado'.
 * Sin turno_id es un walk-in (cliente sin reserva).
 * @param {string}   req.tenant_id        - Inyectado por tenantMiddleware
 * @param {string}   req.body.barbero_id  - UUID del barbero
 * @param {string}   req.body.servicio_id - UUID del servicio
 * @param {number}   req.body.precio      - Precio del servicio al momento del registro
 * @param {string}   req.body.forma_pago  - 'efectivo' | 'mercado_pago'
 * @param {number}   req.body.propina     - Monto de propina (default: 0)
 * @param {string}   [req.body.turno_id]  - UUID del turno asociado (opcional)
 * @returns {JSON} 201 { message, corte_id, monto_total }
 */
export const createCorte = async (req, res) => {
  const { barbero_id, servicio_id, precio, forma_pago, propina, turno_id } = req.body;

  if (!barbero_id || !servicio_id || !forma_pago) {
    return res.status(400).json({
      error: 'Faltan campos requeridos: barbero_id, servicio_id, precio, forma_pago'
    });
  }
  if (!esFormaPagoValida(forma_pago)) {
    return res.status(400).json({ error: "forma_pago debe ser 'efectivo' o 'mercado_pago'" });
  }
  if (!esMontoValido(precio)) {
    return res.status(400).json({ error: 'precio es requerido y debe ser un número >= 0' });
  }
  if (propina !== undefined && !esMontoValido(propina)) {
    return res.status(400).json({ error: 'propina debe ser un número >= 0' });
  }

  try {
    // ── Validar ownership de barbero y servicio (auditoría 2.1) ──────────────
    // Ambos ids llegan del body (client-controlled en el flujo del iPad). El FK
    // compuesto (tenant_id, X) ya lo garantiza a nivel DB; esto lo convierte en
    // un 404 limpio en vez de una violación de FK cruda (500) y documenta la
    // intención en el entry point. completarTurnoConCorte NO pasa por acá: su
    // barbero sale del turno (autoritativo) y no re-valida activo, para no romper
    // el completado de un turno cuyo barbero/servicio se desactivó después.
    if (!(await barberoActivoEnTenant(barbero_id, req.tenant_id))) {
      return res.status(404).json({ error: 'Barbero no encontrado o inactivo' });
    }
    if ((await calcularDuracionServicio(servicio_id, req.tenant_id)) === null) {
      return res.status(404).json({ error: 'Servicio no encontrado o inactivo' });
    }

    const { corte_id, monto_total } = await registrarCorte({
      tenantId: req.tenant_id,
      barberoId: barbero_id,
      servicioId: servicio_id,
      precio,
      formaPago: forma_pago,
      propina,
      turnoId: turno_id,
    });

    res.status(201).json({
      message: 'Corte registrado correctamente',
      corte_id,
      monto_total,
    });

  } catch (err) {
    // Backstop de carrera: el FK compuesto rechazó barbero/servicio de otro
    // tenant entre la validación de arriba y el insert (registrarCorte los
    // traduce a errores tipados). Mismo status que la validación pre-insert.
    if (err.code === 'BARBERO_INVALIDO' || err.code === 'SERVICIO_INVALIDO') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'TURNO_YA_VINCULADO') {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === 'TURNO_INEXISTENTE' || err.code === 'UUID_INVALIDO') {
      return res.status(400).json({ error: err.message });
    }
    console.error('[cortes] Error en createCorte:', err);
    res.status(500).json({ error: 'Error al registrar el corte' });
  }
};
