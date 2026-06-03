// /backend/src/controllers/authAdmin.js
// Controlador de autenticación del admin.
// Verifica el PIN contra la DB y devuelve un JWT con rol='admin' si es correcto.
// Si la suscripción del tenant venció y ya pasó el día 10 del mes (en TZ
// Argentina), devuelve 402 antes de emitir el token. Si está en días 5–10 sin
// renovar, emite el token con aviso_pago=true.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { evaluarSuscripcion } from '../utils/suscripcion.js';

/**
 * loginAdmin
 * Autentica al admin del tenant por PIN. Mensaje 401 genérico ("PIN incorrecto")
 * en todos los caminos de fallo de credenciales para no filtrar si el tenant
 * existe o no. Si el PIN es correcto, evalúa el estado de la suscripción en
 * TZ Argentina y decide entre 402 (bloqueo), 200+aviso_pago (días 5–10) o
 * 200 limpio.
 *
 * @param {Request}  req - body: { pin }; tenant_id inyectado por tenantMiddleware.
 * @param {Response} res - 200 { token, aviso_pago } | 400 | 401 | 402 | 500.
 */
export async function loginAdmin(req, res) {
  const { pin } = req.body;
  const tenant_id = req.tenant_id;

  if (!pin) {
    return res.status(400).json({ error: 'PIN requerido' });
  }

  try {
    const resultado = await query(
      'SELECT pin_admin, suscripcion_vigente_hasta FROM tenant WHERE id = $1 AND activo = true',
      [tenant_id]
    );

    // Tenant inexistente o inactivo. En la práctica tenantMiddleware ya lo
    // habría rechazado antes, pero el chequeo defensivo no cuesta nada.
    // Mensaje genérico para no filtrar el estado del tenant.
    if (resultado.rows.length === 0) {
      console.warn('[authAdmin] loginAdmin — tenant no encontrado o inactivo | tenant:', tenant_id);
      return res.status(401).json({ error: 'PIN incorrecto' });
    }

    const { pin_admin: pinHasheado, suscripcion_vigente_hasta } = resultado.rows[0];
    const pinCorrecto = await bcrypt.compare(pin, pinHasheado);

    if (!pinCorrecto) {
      console.warn('[authAdmin] loginAdmin — PIN incorrecto | tenant:', tenant_id);
      return res.status(401).json({ error: 'PIN incorrecto' });
    }

    // Estado de la suscripción del tenant (días 5–10 → aviso, día 11+ → bloqueo),
    // evaluado en TZ Argentina. Ver utils/suscripcion.js.
    const { bloqueado, aviso_pago } = evaluarSuscripcion(suscripcion_vigente_hasta);

    if (bloqueado) {
      console.warn('[authAdmin] loginAdmin — suscripción vencida | tenant:', tenant_id);
      return res.status(402).json({ error: 'suscripcion_vencida' });
    }

    const token = jwt.sign(
      { tenant_id, rol: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('[authAdmin] loginAdmin completado | tenant:', tenant_id);
    return res.json({ token, aviso_pago });

  } catch (err) {
    console.error('[authAdmin] Error en loginAdmin:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
