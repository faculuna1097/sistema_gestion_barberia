// /backend/src/controllers/adminOperativo.js
// Controlador para que el admin modifique las credenciales del modo operativo
// (columnas tenant.operativo_usuario y tenant.operativo_password_hash) desde
// el panel de gestión. Solo accesible con JWT de rol 'admin' (validado por
// verificarToken + requiereRol('admin') en index.js).
//
// Diseño: usuario y password del body son opcionales — el admin puede cambiar
// solo uno o ambos. Si un campo viene vacío o ausente, no se modifica en la DB.
// El frontend (TabSeguridad) expone cada cambio en su propio modal dedicado
// (usuario por un lado, password por otro), así que en la práctica cada request
// trae un solo campo; el endpoint igual soporta ambos a la vez.
//
// Re-autenticación (deuda #35): además del JWT admin, el body debe traer
// pin_admin, que se verifica con bcrypt contra tenant.pin_admin antes de tocar
// la DB. Cambiar credenciales operativas es sensible y un panel abierto sin
// vigilancia no debe permitirlo sin reto. Ver actualizarCredencialesOperativas.
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
 * Re-autenticación (deuda #35): aunque la ruta ya exige JWT de rol admin,
 * cambiar credenciales operativas es una acción sensible — un panel admin
 * abierto sin vigilancia permitiría a un tercero con acceso físico cambiarlas
 * sin reto. Por eso se exige el PIN de administrador en el body y se verifica
 * con bcrypt antes de tocar la DB (mismo patrón que cambiarPinAdmin).
 *
 * @param {Request}  req - body: { usuario?, password?, pin_admin }; tenant_id y rol inyectados por middlewares.
 * @param {Response} res - 204 No Content | 400 | 401 | 404 | 500.
 */
export async function actualizarCredencialesOperativas(req, res) {
  const { usuario, password, pin_admin } = req.body;
  const tenant_id = req.tenant_id;

  // Falsy (undefined, null, '') significa "no modificar este campo".
  const cambiarUsuario  = !!usuario;
  const cambiarPassword = !!password;

  if (!cambiarUsuario && !cambiarPassword) {
    return res.status(400).json({ error: 'Debe enviar usuario y/o password para modificar' });
  }

  if (!pin_admin) {
    return res.status(400).json({ error: 'El PIN de administrador es requerido' });
  }

  if (cambiarUsuario && usuario.length < 3) {
    return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' });
  }

  if (cambiarPassword && password.length < 8) {
    return res.status(400).json({ error: 'La password debe tener al menos 8 caracteres' });
  }

  try {
    // Re-autenticación: verificar el PIN admin contra el hash del tenant antes
    // de cualquier modificación. Si no coincide, se rechaza sin tocar la DB.
    const tenantResult = await query(
      'SELECT pin_admin FROM tenant WHERE id = $1',
      [tenant_id]
    );
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    const pinCorrecto = await bcrypt.compare(pin_admin, tenantResult.rows[0].pin_admin);
    if (!pinCorrecto) {
      console.log('[adminOperativo] actualizarCredencialesOperativas — PIN admin incorrecto | cambio rechazado | tenant:', tenant_id);
      return res.status(401).json({ error: 'El PIN de administrador es incorrecto' });
    }

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
