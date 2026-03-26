// /backend/src/controllers/auth.js
// Controlador de autenticación.
// Verifica el PIN del admin contra la DB y devuelve un JWT si es correcto.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

/**
 * verificarPin
 * Recibe { pin } en el body, compara contra pin_admin del tenant con bcrypt.
 * Si es correcto, devuelve un JWT firmado con el tenant_id.
 * @param {string} req.body.pin - PIN de 4 dígitos ingresado por el usuario
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 */
export async function verificarPin(req, res) {
  console.log('[auth] Request recibido: verificar PIN');
  const { pin } = req.body;
  const tenant_id = req.tenant_id;

  if (!pin) {
    return res.status(400).json({ error: 'PIN requerido' });
  }

  try {
    const resultado = await query(
      'SELECT pin_admin FROM tenant WHERE id = $1 AND activo = true',
      [tenant_id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    const pinHasheado = resultado.rows[0].pin_admin;
    const pinCorrecto = await bcrypt.compare(pin, pinHasheado);

    if (!pinCorrecto) {
      console.log('[auth] PIN incorrecto para tenant:', tenant_id);
      return res.status(401).json({ error: 'PIN incorrecto' });
    }

    const token = jwt.sign(
      { tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    console.log('[auth] PIN verificado correctamente — token emitido para tenant:', tenant_id);
    return res.json({ token });

  } catch (err) {
    console.error('[auth] Error al verificar PIN:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}