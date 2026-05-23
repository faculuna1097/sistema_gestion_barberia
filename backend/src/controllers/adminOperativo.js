// /backend/src/controllers/adminOperativo.js
// Controlador para que el admin modifique las credenciales del modo operativo
// (columnas tenant.operativo_usuario y tenant.operativo_password_hash) desde
// el panel de gestión. Solo accesible con JWT de rol 'admin' (validado por
// verificarToken + requiereRol('admin') en index.js).
//
// Diseño: ambos campos del body (usuario, password) son opcionales — el admin
// puede cambiar solo uno o ambos. Si un campo viene vacío o ausente, no se
// modifica en la DB.
//
// Nota de UX (a reflejar en el frontend): el campo password debe mostrarse
// con placeholder/aviso "Dejar vacío para no modificar" para que el usuario
// entienda que pisar una password requiere escribir la nueva.
//
// Cambio de password ⇒ invalidación inmediata de tokens operativos viejos:
// se incrementa tenant.operativo_token_version en el mismo UPDATE.
// authOperativo firma el JWT con tv = operativo_token_version, y
// authMiddleware rechaza los tokens cuyo tv no coincida con el actual.
// Cambiar solo el usuario NO invalida tokens (un rename no compromete
// credenciales). Mantener consistente con esa semántica.

import bcrypt from 'bcrypt';
import { query } from '../config/db.js';

/**
 * obtenerCredencialesOperativas
 * Devuelve el usuario operativo actual del tenant. NUNCA devuelve el hash
 * de la password (no es reversible y exponerlo no aportaría nada).
 * Usado por el panel admin para precargar el campo "Usuario" antes de editar.
 *
 * @param {Request}  req - tenant_id inyectado por tenantMiddleware.
 * @param {Response} res - 200 { usuario: string|null } | 404 | 500.
 */
export async function obtenerCredencialesOperativas(req, res) {
  try {
    const resultado = await query(
      'SELECT operativo_usuario FROM tenant WHERE id = $1',
      [req.tenant_id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    return res.json({ usuario: resultado.rows[0].operativo_usuario });
  } catch (err) {
    console.error('[adminOperativo] Error en obtenerCredencialesOperativas:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * actualizarCredencialesOperativas
 * Actualiza usuario y/o password operativos del tenant del request.
 * String vacío en un campo significa "no modificar" (silencioso).
 *
 * @param {Request}  req - body: { usuario?, password? }; tenant_id y rol inyectados por middlewares.
 * @param {Response} res - 204 No Content | 400 | 500.
 */
export async function actualizarCredencialesOperativas(req, res) {
  const { usuario, password } = req.body;
  const tenant_id = req.tenant_id;

  // Falsy (undefined, null, '') significa "no modificar este campo".
  const cambiarUsuario  = !!usuario;
  const cambiarPassword = !!password;

  if (!cambiarUsuario && !cambiarPassword) {
    return res.status(400).json({ error: 'Debe enviar usuario y/o password para modificar' });
  }

  if (cambiarUsuario && usuario.length < 3) {
    return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' });
  }

  if (cambiarPassword && password.length < 8) {
    return res.status(400).json({ error: 'La password debe tener al menos 8 caracteres' });
  }

  try {
    // UPDATE dinámico: solo las columnas que efectivamente vienen.
    // Se arman arrays paralelos de SET clauses y de valores, y se concatena.
    const setClauses = [];
    const valores    = [];
    let   indice     = 1;

    if (cambiarUsuario) {
      setClauses.push(`operativo_usuario = $${indice++}`);
      valores.push(usuario);
    }

    if (cambiarPassword) {
      const hash = await bcrypt.hash(password, 10);
      setClauses.push(`operativo_password_hash = $${indice++}`);
      valores.push(hash);
      // Invalida todos los JWT operativos emitidos antes de este cambio.
      setClauses.push('operativo_token_version = operativo_token_version + 1');
    }

    valores.push(tenant_id);
    const sql = `UPDATE tenant SET ${setClauses.join(', ')} WHERE id = $${indice}`;

    await query(sql, valores);

    console.log('[adminOperativo] actualizarCredencialesOperativas completado | tenant:', tenant_id);
    return res.status(204).end();

  } catch (err) {
    console.error('[adminOperativo] Error en actualizarCredencialesOperativas:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
