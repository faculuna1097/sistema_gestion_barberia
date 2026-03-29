// /backend/src/controllers/auth.js
// Controlador de autenticación.
// Verifica el PIN del admin contra la DB y devuelve un JWT si es correcto.
// Si la suscripción del tenant está vencida (y ya pasó el día 10 del mes),
// devuelve 402 antes de emitir el token.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

const TZ = 'America/Argentina/Buenos_Aires';

export async function verificarPin(req, res) {
  console.log('[auth] verificarPin — request recibido');
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

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    const { pin_admin: pinHasheado, suscripcion_vigente_hasta } = resultado.rows[0];
    const pinCorrecto = await bcrypt.compare(pin, pinHasheado);

    if (!pinCorrecto) {
      console.log('[auth] verificarPin — PIN incorrecto para tenant:', tenant_id);
      return res.status(401).json({ error: 'PIN incorrecto' });
    }

    // ── Fechas en timezone argentino ───────────────────────────────────────
    const ahoraArg = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
    const diaDelMes = ahoraArg.getDate();
    const year = ahoraArg.getFullYear();
    const month = String(ahoraArg.getMonth() + 1).padStart(2, '0');
    const primerDiaMesStr = `${year}-${month}-01`;

    const vigenteHastaStr = suscripcion_vigente_hasta
      ? new Date(suscripcion_vigente_hasta).toISOString().slice(0, 10)
      : null;

    const suscripcionNoRenovada = vigenteHastaStr === null || vigenteHastaStr < primerDiaMesStr;

    // ── Bloqueo: día 11+ sin renovar ──────────────────────────────────────
    if (diaDelMes > 10 && suscripcionNoRenovada) {
      console.log('[auth] verificarPin — suscripción vencida para tenant:', tenant_id);
      return res.status(402).json({ error: 'suscripcion_vencida' });
    }

    // ── Aviso: días 5–10 sin renovar ──────────────────────────────────────
    const aviso_pago = diaDelMes >= 5 && diaDelMes <= 10 && suscripcionNoRenovada;

    const token = jwt.sign(
      { tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    console.log('[auth] verificarPin — completado | token emitido para tenant:', tenant_id,
      '| aviso_pago:', aviso_pago);
    return res.json({ token, aviso_pago });

  } catch (err) {
    console.error('[auth] Error en verificarPin:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}