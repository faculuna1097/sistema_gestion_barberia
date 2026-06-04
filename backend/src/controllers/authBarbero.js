// /backend/src/controllers/authBarbero.js
// Controlador de autenticación de la app del barbero.
// Recibe { barbero_id, pin } y, si coincide con un barbero activo del tenant
// del subdominio (req.tenant_id), devuelve un JWT con rol='barbero' y
// barbero_id en el payload. La app del barbero usa ese token para llamar a
// los endpoints del backoffice (/api/admin/*), donde el scoping por rol se
// resuelve dentro de cada controller.
//
// La selección del barbero se hace antes del PIN porque los PINs se repiten
// entre barberos del mismo tenant. La app muestra una lista (consumida desde
// GET /api/barberos), el barbero toca el suyo, y entonces ingresa el PIN.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

/**
 * loginBarbero
 * Autentica a un barbero por (barbero_id, pin) dentro del tenant del subdominio.
 *
 * @param {Request}  req - body: { barbero_id, pin }; tenant_id inyectado por tenantMiddleware.
 * @param {Response} res - 200 { token, barbero: { id, nombre } } | 400 | 401 | 500.
 */
export async function loginBarbero(req, res) {
  const { barbero_id, pin } = req.body;
  const tenant_id = req.tenant_id;

  if (!barbero_id || !pin) {
    return res.status(400).json({ error: 'barbero_id y pin son requeridos' });
  }

  try {
    const resultado = await query(
      `SELECT id, nombre, pin
         FROM barbero
        WHERE id = $1 AND tenant_id = $2 AND activo = true`,
      [barbero_id, tenant_id]
    );

    // Mensaje genérico para no filtrar si el barbero_id existe o no.
    if (resultado.rows.length === 0) {
      console.warn('[authBarbero] loginBarbero — barbero no encontrado o inactivo | barbero_id:', barbero_id);
      return res.status(401).json({ error: 'Usuario o PIN incorrecto' });
    }

    const { id, nombre, pin: pinHasheado } = resultado.rows[0];
    const pinCorrecto = await bcrypt.compare(pin, pinHasheado);

    if (!pinCorrecto) {
      console.warn('[authBarbero] loginBarbero — PIN incorrecto | barbero_id:', barbero_id);
      return res.status(401).json({ error: 'Usuario o PIN incorrecto' });
    }

    const token = jwt.sign(
      { tenant_id, rol: 'barbero', barbero_id: id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('[authBarbero] loginBarbero completado | barbero_id:', id);
    return res.json({ token, barbero: { id, nombre } });

  } catch (err) {
    console.error('[authBarbero] Error en loginBarbero:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
