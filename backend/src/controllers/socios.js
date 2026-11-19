// /backend/src/controllers/socios.js
// Socios (dueños del negocio) del panel admin: el selector de Caja y la pestaña
// Gestión → Socios (alta, edición, vínculo con un barbero y activar/desactivar).
// Los socios no se borran: tienen movimientos (aportes y retiros) asociados.
//
// Sin transacciones (Session Pooler): cada escritura es una sola sentencia que
// lleva sus chequeos en el WHERE, y una lectura posterior solo decide qué error
// devolver (convenciones_tecnicas.md §2 y §6).

import { query } from '../config/db.js';
import { esUUID } from '../utils/validarUuid.js';
import { MAX_NOMBRE } from '../utils/validarTexto.js';
import { barberoEnTenant } from '../services/barberosService.js';

const SOCIO_NO_ENCONTRADO   = 'Socio no encontrado';
const BARBERO_NO_ENCONTRADO = 'Barbero no encontrado';
const MENSAJE_BARBERO_YA_VINCULADO = 'Ese barbero ya está vinculado a otro socio';

// Las filas que devuelven la lista, el alta y la edición: el socio con el nombre
// de su barbero (null si no tiene). `s` es el alias de la fila de socio.
const COLUMNAS_SOCIO = `s.id, s.nombre, s.activo, s.barbero_id, b.nombre AS barbero_nombre`;
const JOIN_BARBERO   = `LEFT JOIN barbero b ON b.id = s.barbero_id AND b.tenant_id = s.tenant_id`;

/**
 * validarNombreSocio
 * Valida y normaliza el nombre de un socio (mismo tope que los nombres de una
 * reserva: MAX_NOMBRE).
 * @param {*} nombre - req.body.nombre
 * @returns {{ error: string, campo: 'nombre' } | { nombre: string }} El error para
 *   responder 400, o el nombre recortado.
 */
const validarNombreSocio = (nombre) => {
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    return { error: 'nombre es requerido', campo: 'nombre' };
  }
  const recortado = nombre.trim();
  if (recortado.length > MAX_NOMBRE) {
    return { error: `nombre no puede superar los ${MAX_NOMBRE} caracteres`, campo: 'nombre' };
  }
  return { nombre: recortado };
};

/**
 * buscarSocioPorNombre
 * Busca un socio del tenant con ese nombre, sin distinguir mayúsculas. Solo arma
 * el 409 de nombre repetido después de una escritura que no se hizo.
 * @param {string} tenantId
 * @param {string} nombre - Ya recortado
 * @param {string|null} [excluirId=null] - El socio que se está editando
 * @returns {Promise<{ id: string, activo: boolean } | null>}
 */
const buscarSocioPorNombre = async (tenantId, nombre, excluirId = null) => {
  const result = await query(
    `SELECT id, activo FROM socio
     WHERE tenant_id = $1 AND lower(nombre) = lower($2)
       AND ($3::uuid IS NULL OR id <> $3::uuid)
     LIMIT 1`,
    [tenantId, nombre, excluirId]
  );
  return result.rows[0] ?? null;
};

/**
 * responderNombreRepetido
 * Responde el 409 de nombre repetido con el socio que ya tiene ese nombre, para
 * que el front ofrezca reactivarlo si está inactivo.
 * @param {object} res - Response de Express
 * @param {{ id: string, activo: boolean } | null} existente
 * @returns {object} La respuesta
 */
const responderNombreRepetido = (res, existente) => res.status(409).json({
  error: existente && !existente.activo
    ? 'Ya hay un socio inactivo con ese nombre'
    : 'Ya hay un socio con ese nombre',
  codigo: 'socio_nombre_repetido',
  socio_id: existente?.id ?? null,
  activo: existente?.activo ?? null,
});

/**
 * getSocios
 * Lista los socios del tenant.
 * - Sin query: los activos, ordenados por nombre, como [{ id, nombre }]. Lo usa
 *   el selector de dueño al cargar un aporte o un retiro en Caja.
 * - Con `?incluir_inactivos=true`: todos, primero los activos y cada grupo por
 *   nombre, como [{ id, nombre, activo, barbero_id, barbero_nombre }]. Lo usa la
 *   pestaña Gestión → Socios.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @param {string} [req.query.incluir_inactivos] - 'true' para la lista completa
 * @returns {JSON} El array de socios
 */
export const getSocios = async (req, res) => {
  try {
    if (req.query.incluir_inactivos === 'true') {
      const result = await query(
        `SELECT ${COLUMNAS_SOCIO}
         FROM socio s
         ${JOIN_BARBERO}
         WHERE s.tenant_id = $1
         ORDER BY s.activo DESC, s.nombre ASC`,
        [req.tenant_id]
      );
      return res.json(result.rows);
    }

    const result = await query(
      `SELECT id, nombre
       FROM socio
       WHERE tenant_id = $1 AND activo = true
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    return res.json(result.rows);

  } catch (err) {
    console.error('[socios] Error en getSocios:', err);
    return res.status(500).json({ error: 'Error al obtener los socios' });
  }
};

/**
 * crearSocio
 * Da de alta un socio activo, con o sin barbero vinculado. El chequeo de nombre
 * repetido (sin distinguir mayúsculas) va en la misma sentencia que el INSERT.
 * @param {string} req.tenant_id         - Inyectado por tenantMiddleware
 * @param {string} req.body.nombre       - Nombre del socio
 * @param {string|null} [req.body.barbero_id] - Barbero del local (activo o no) que es este socio
 * @returns {JSON} 201 con { id, nombre, activo, barbero_id, barbero_nombre };
 *   400 { error, campo } si el nombre no vale; 404 si el barbero no es del local;
 *   409 { codigo: 'socio_nombre_repetido', socio_id, activo } o
 *   409 { codigo: 'barbero_ya_vinculado' }
 */
export const crearSocio = async (req, res) => {
  const validado = validarNombreSocio(req.body.nombre);
  if (validado.error) {
    return res.status(400).json({ error: validado.error, campo: validado.campo });
  }
  const { nombre } = validado;
  const barberoId = req.body.barbero_id ?? null;

  try {
    if (barberoId !== null && !(await barberoEnTenant(barberoId, req.tenant_id))) {
      return res.status(404).json({ error: BARBERO_NO_ENCONTRADO });
    }

    const result = await query(
      `WITH nuevo AS (
         INSERT INTO socio (tenant_id, nombre, barbero_id)
         SELECT $1::uuid, $2::text, $3::uuid
         WHERE NOT EXISTS (
           SELECT 1 FROM socio WHERE tenant_id = $1::uuid AND lower(nombre) = lower($2::text)
         )
         RETURNING *
       )
       SELECT ${COLUMNAS_SOCIO}
       FROM nuevo s
       ${JOIN_BARBERO}`,
      [req.tenant_id, nombre, barberoId]
    );

    if (result.rows.length === 0) {
      return responderNombreRepetido(res, await buscarSocioPorNombre(req.tenant_id, nombre));
    }
    console.log('[socios] crearSocio completado | socio_id:', result.rows[0].id);
    return res.status(201).json(result.rows[0]);

  } catch (err) {
    if (err.code === '23505' && err.constraint === 'socio_barbero_id_key') {
      return res.status(409).json({ error: MENSAJE_BARBERO_YA_VINCULADO, codigo: 'barbero_ya_vinculado' });
    }
    // Dos altas con el mismo nombre exacto a la vez: el UNIQUE frena la segunda.
    if (err.code === '23505' && err.constraint === 'socio_tenant_nombre_key') {
      return responderNombreRepetido(res, await buscarSocioPorNombre(req.tenant_id, nombre));
    }
    console.error('[socios] Error en crearSocio:', err);
    return res.status(500).json({ error: 'Error al crear el socio' });
  }
};

/**
 * editarSocio
 * Cambia el nombre, el barbero vinculado y/o el estado de un socio. Los campos
 * que no vienen quedan como están. Todo va en un solo UPDATE:
 * - desactivar (activo: false) también desvincula el barbero;
 * - reactivar (activo: true sobre uno inactivo) lo deja sin barbero, salvo que
 *   el mismo pedido traiga uno;
 * - no deja desactivar al último socio activo del local, ni repetir un nombre,
 *   ni vincular un barbero a un socio que queda inactivo.
 * Si el UPDATE no toca nada, una lectura posterior decide qué error devolver.
 * @param {string}  req.params.id          - UUID del socio
 * @param {string}  req.tenant_id          - Inyectado por tenantMiddleware
 * @param {string}  [req.body.nombre]      - Nombre nuevo
 * @param {string|null} [req.body.barbero_id] - Barbero nuevo; null desvincula
 * @param {boolean} [req.body.activo]      - Estado nuevo
 * @returns {JSON} 200 con { id, nombre, activo, barbero_id, barbero_nombre };
 *   400 { error, campo }; 404 socio o barbero; 409 con `codigo`:
 *   'socio_nombre_repetido' (más socio_id y activo), 'barbero_ya_vinculado',
 *   'ultimo_socio' o 'socio_inactivo'
 */
export const editarSocio = async (req, res) => {
  const { id } = req.params;
  if (!esUUID(id)) {
    return res.status(404).json({ error: SOCIO_NO_ENCONTRADO });
  }

  const { activo } = req.body;
  const cambiaNombre  = req.body.nombre !== undefined;
  const cambiaBarbero = req.body.barbero_id !== undefined;
  const barberoId     = cambiaBarbero ? req.body.barbero_id : null;

  if (!cambiaNombre && !cambiaBarbero && activo === undefined) {
    return res.status(400).json({ error: 'nombre, barbero_id o activo es requerido' });
  }
  if (activo !== undefined && typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'activo debe ser true o false', campo: 'activo' });
  }
  let nombre = null;
  if (cambiaNombre) {
    const validado = validarNombreSocio(req.body.nombre);
    if (validado.error) {
      return res.status(400).json({ error: validado.error, campo: validado.campo });
    }
    nombre = validado.nombre;
  }
  if (activo === false && barberoId !== null) {
    return res.status(400).json({
      error: 'Un socio inactivo no puede tener un barbero vinculado',
      campo: 'barbero_id',
    });
  }

  try {
    if (barberoId !== null && !(await barberoEnTenant(barberoId, req.tenant_id))) {
      return res.status(404).json({ error: BARBERO_NO_ENCONTRADO });
    }

    // $3 nombre (null = no cambia), $4 activo (null = no cambia),
    // $5 si cambia el barbero, $6 el barbero nuevo (null = desvincular).
    const result = await query(
      `WITH cambiado AS (
         UPDATE socio s SET
           nombre = COALESCE($3::text, s.nombre),
           activo = COALESCE($4::boolean, s.activo),
           barbero_id = CASE
             WHEN $4::boolean = false THEN NULL
             WHEN $5::boolean THEN $6::uuid
             WHEN $4::boolean = true AND s.activo = false THEN NULL
             ELSE s.barbero_id
           END
         WHERE s.id = $1::uuid AND s.tenant_id = $2::uuid
           -- Nombre repetido (sin distinguir mayúsculas), sin contarse a sí mismo.
           AND ($3::text IS NULL OR NOT EXISTS (
             SELECT 1 FROM socio o
             WHERE o.tenant_id = s.tenant_id AND o.id <> s.id AND lower(o.nombre) = lower($3::text)
           ))
           -- El último socio activo no se desactiva.
           AND ($4::boolean IS DISTINCT FROM false OR s.activo = false OR EXISTS (
             SELECT 1 FROM socio o
             WHERE o.tenant_id = s.tenant_id AND o.id <> s.id AND o.activo = true
           ))
           -- Un barbero solo se vincula a un socio que queda activo.
           AND ($6::uuid IS NULL OR COALESCE($4::boolean, s.activo) = true)
         RETURNING s.*
       )
       SELECT ${COLUMNAS_SOCIO}
       FROM cambiado s
       ${JOIN_BARBERO}`,
      [id, req.tenant_id, nombre, activo ?? null, cambiaBarbero, barberoId]
    );

    if (result.rows.length > 0) {
      console.log('[socios] editarSocio completado | socio_id:', id);
      return res.json(result.rows[0]);
    }

    // No se tocó nada: la lectura solo decide el error.
    const actual = await query(
      `SELECT activo FROM socio WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenant_id]
    );
    if (actual.rows.length === 0) {
      return res.status(404).json({ error: SOCIO_NO_ENCONTRADO });
    }
    if (nombre !== null) {
      const existente = await buscarSocioPorNombre(req.tenant_id, nombre, id);
      if (existente) return responderNombreRepetido(res, existente);
    }
    if (activo === false) {
      return res.status(409).json({
        error: 'No se puede desactivar al único socio activo del local',
        codigo: 'ultimo_socio',
      });
    }
    if (barberoId !== null) {
      return res.status(409).json({
        error: 'Para vincular un barbero, el socio tiene que estar activo',
        codigo: 'socio_inactivo',
      });
    }
    // Otro cambio se cruzó entre el UPDATE y la lectura.
    return res.status(409).json({ error: 'El socio cambió mientras guardabas. Volvé a intentar.' });

  } catch (err) {
    if (err.code === '23505' && err.constraint === 'socio_barbero_id_key') {
      return res.status(409).json({ error: MENSAJE_BARBERO_YA_VINCULADO, codigo: 'barbero_ya_vinculado' });
    }
    if (err.code === '23505' && err.constraint === 'socio_tenant_nombre_key') {
      return responderNombreRepetido(res, await buscarSocioPorNombre(req.tenant_id, nombre, id));
    }
    console.error('[socios] Error en editarSocio:', err);
    return res.status(500).json({ error: 'Error al editar el socio' });
  }
};
