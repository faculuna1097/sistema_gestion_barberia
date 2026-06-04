// /backend/src/controllers/authPanel.js
// Controlador de login unificado del panel de gestión (el iPad del mostrador).
// Recibe solo { pin } y resuelve el rol según a quién pertenezca ese PIN dentro
// del tenant del subdominio (req.tenant_id):
//   - Si matchea el pin_admin → rol 'admin' (con chequeo de suscripción → 402).
//   - Si no, y matchea el PIN de exactamente un barbero ACTIVO → rol 'barbero'
//     (sin chequeo de suscripción: el bloqueo apunta al dueño, no al empleado).
//   - Si no matchea nada → 401 genérico.
//
// Los PINs están hasheados con bcrypt (no determinista), así que "qué barbero
// tiene este PIN" se resuelve trayendo los hashes del tenant y comparando uno
// por uno. Costo: 1 + N bcrypt.compare por login (N = barberos activos). Es un
// login esporádico, así que es aceptable.
//
// PRE-REQUISITO: unicidad de PIN dentro del tenant (ver utils/pin.js). El orden
// admin-first evita que un barbero que comparta PIN con el admin escale a admin;
// la unicidad evita el caso ambiguo. Si igual aparecieran >1 matches de barbero
// (datos sin sanear), se responde 401 genérico sin adivinar a quién loguear.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { evaluarSuscripcion } from '../utils/suscripcion.js';

/**
 * loginPanel
 * Autentica al panel por PIN, resolviendo el rol (admin o barbero) según el PIN.
 * Mensaje 401 genérico ("PIN incorrecto") en todos los caminos de fallo para no
 * filtrar si el tenant existe ni a quién pertenece un PIN.
 *
 * @param {Request}  req - body: { pin }; tenant_id inyectado por tenantMiddleware.
 * @param {Response} res - 200 { token, rol, aviso_pago? , barbero? } | 400 | 401 | 402 | 500.
 */
export async function loginPanel(req, res) {
  const { pin } = req.body;
  const tenant_id = req.tenant_id;

  if (!pin) {
    return res.status(400).json({ error: 'PIN requerido' });
  }

  try {
    // ── Path admin ────────────────────────────────────────────────────────
    const tenantRes = await query(
      'SELECT pin_admin, suscripcion_vigente_hasta FROM tenant WHERE id = $1 AND activo = true',
      [tenant_id]
    );

    // Tenant inexistente o inactivo. tenantMiddleware ya lo habría rechazado;
    // chequeo defensivo con mensaje genérico para no filtrar su estado.
    if (tenantRes.rows.length === 0) {
      console.warn('[authPanel] loginPanel — tenant no encontrado o inactivo | tenant:', tenant_id);
      return res.status(401).json({ error: 'PIN incorrecto' });
    }

    const { pin_admin: pinAdmin, suscripcion_vigente_hasta } = tenantRes.rows[0];

    if (pinAdmin && await bcrypt.compare(pin, pinAdmin)) {
      // El PIN es el del admin → evaluar suscripción antes de emitir el token.
      const { bloqueado, aviso_pago } = evaluarSuscripcion(suscripcion_vigente_hasta);

      if (bloqueado) {
        console.warn('[authPanel] loginPanel — suscripción vencida | tenant:', tenant_id);
        return res.status(402).json({ error: 'suscripcion_vencida' });
      }

      const token = jwt.sign(
        { tenant_id, rol: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      console.log('[authPanel] loginPanel completado | rol: admin | tenant:', tenant_id);
      return res.json({ token, rol: 'admin', aviso_pago });
    }

    // ── Path barbero ──────────────────────────────────────────────────────
    // No matcheó el admin: buscar entre los barberos ACTIVOS del tenant.
    // El path barbero NO chequea suscripción (D2): el bloqueo apunta al dueño.
    const barberosRes = await query(
      `SELECT id, nombre, pin
         FROM barbero
        WHERE tenant_id = $1 AND activo = true`,
      [tenant_id]
    );

    const matches = [];
    for (const barbero of barberosRes.rows) {
      if (barbero.pin && await bcrypt.compare(pin, barbero.pin)) {
        matches.push(barbero);
      }
    }

    // >1 match: no debería ocurrir con la unicidad aplicada (Fase 1/2). No se
    // adivina a quién loguear; se responde 401 genérico y se loguea para auditar.
    if (matches.length > 1) {
      console.warn('[authPanel] loginPanel — PIN ambiguo (>1 match) | tenant:', tenant_id, '| matches:', matches.length);
      return res.status(401).json({ error: 'PIN incorrecto' });
    }

    if (matches.length === 1) {
      const { id, nombre } = matches[0];
      const token = jwt.sign(
        { tenant_id, rol: 'barbero', barbero_id: id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      console.log('[authPanel] loginPanel completado | rol: barbero | barbero_id:', id);
      return res.json({ token, rol: 'barbero', barbero: { id, nombre } });
    }

    // 0 matches: ni admin ni barbero.
    console.warn('[authPanel] loginPanel — PIN no reconocido | tenant:', tenant_id);
    return res.status(401).json({ error: 'PIN incorrecto' });

  } catch (err) {
    console.error('[authPanel] Error en loginPanel:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
