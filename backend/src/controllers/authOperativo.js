// /backend/src/controllers/authOperativo.js
// Controlador de autenticación del modo operativo (iPad del local).
// Recibe { usuario, password } y, si coinciden con las credenciales operativas
// del tenant del subdominio (columnas tenant.operativo_usuario y
// tenant.operativo_password_hash), devuelve un JWT con rol='operativo'.
// La app de gestión usa ese token para llamar a los endpoints operativos
// (POST /api/cortes, /api/ventas, /api/gastos y GET /api/turnos), que pasan
// a estar protegidos por verificarToken + requiereRol('operativo', 'admin').
//
// Un solo usuario operativo por tenant. Si en el futuro se necesita
// multiusuario (uno por empleado), se migra a una tabla usuario_operativo
// sin romper este diseño.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

/**
 * loginOperativo
 * Autentica al modo operativo por (usuario, password) dentro del tenant del
 * subdominio. Mensaje 401 genérico en todos los caminos de fallo para no
 * filtrar si el tenant tiene credenciales seteadas, si el usuario existe, etc.
 *
 * @param {Request}  req - body: { usuario, password }; tenant_id inyectado por tenantMiddleware.
 * @param {Response} res - 200 { token } | 400 | 401 | 500.
 */
export async function loginOperativo(req, res) {
  console.log('[authOperativo] loginOperativo — request recibido | tenant:', req.tenant_id);
  const { usuario, password } = req.body;
  const tenant_id = req.tenant_id;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'usuario y password son requeridos' });
  }

  try {
    const resultado = await query(
      `SELECT operativo_usuario, operativo_password_hash, operativo_token_version
         FROM tenant
        WHERE id = $1 AND activo = true`,
      [tenant_id]
    );

    // Tenant inexistente o inactivo. En la práctica tenantMiddleware ya lo
    // habría rechazado antes, pero el chequeo defensivo no cuesta nada.
    if (resultado.rows.length === 0) {
      console.log('[authOperativo] loginOperativo — tenant no encontrado o inactivo | tenant:', tenant_id);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const { operativo_usuario, operativo_password_hash, operativo_token_version } = resultado.rows[0];

    // Tenant sin credenciales operativas seteadas. Mensaje genérico para no
    // exponer ese estado a un atacante.
    if (!operativo_usuario || !operativo_password_hash) {
      console.log('[authOperativo] loginOperativo — tenant sin credenciales operativas seteadas | tenant:', tenant_id);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Comparación de usuario case-sensitive (decisión del plan §2.8).
    const usuarioCorrecto = usuario === operativo_usuario;
    const passwordCorrecta = await bcrypt.compare(password, operativo_password_hash);

    if (!usuarioCorrecto || !passwordCorrecta) {
      console.log('[authOperativo] loginOperativo — credenciales incorrectas | tenant:', tenant_id);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // tv (token version) permite invalidar todos los tokens operativos del
    // tenant al cambiar la password operativa: adminOperativo incrementa
    // operativo_token_version, y authMiddleware rechaza cualquier token con
    // tv distinto al actual.
    const token = jwt.sign(
      { tenant_id, rol: 'operativo', tv: operativo_token_version },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('[authOperativo] loginOperativo — completado | tenant:', tenant_id);
    return res.json({ token });

  } catch (err) {
    console.error('[authOperativo] Error en loginOperativo:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
