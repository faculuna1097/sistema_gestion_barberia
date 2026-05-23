// /backend/src/controllers/imagenes.js
// Controller del backoffice para las imágenes del tenant (fotos del local,
// cortes de ejemplo, logos). Cada tenant tiene cupo fijo por tipo.
// Las imágenes viven en Supabase Storage; la tabla tenant_imagen solo guarda
// la ruta. Ver storageService.js para el acceso a Storage.

import { query } from '../config/db.js';
import { construirPath, urlPublica, subirImagen, eliminarImagen } from '../services/storageService.js';

// Cupo máximo de imágenes por tipo. El "orden" de cada imagen es su slot:
// va de 1 al límite del tipo. La constraint UNIQUE(tenant,tipo,orden) en la
// DB impide superar el cupo aunque la validación de acá fallara.
const LIMITES_POR_TIPO = { local: 2, corte: 4, logo: 2 };
const TIPOS_VALIDOS = Object.keys(LIMITES_POR_TIPO);

/**
 * GET /api/admin/imagenes
 * Lista todas las imágenes del tenant con su URL pública ya armada.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} array [{ id, tipo, orden, url }]
 */
export const getImagenes = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, tipo, orden, storage_path
         FROM tenant_imagen
        WHERE tenant_id = $1
        ORDER BY tipo, orden`,
      [req.tenant_id]
    );
    const imagenes = result.rows.map((row) => ({
      id: row.id,
      tipo: row.tipo,
      orden: row.orden,
      url: urlPublica(row.storage_path),
    }));
    res.json(imagenes);
  } catch (err) {
    console.error('[imagenes] Error en getImagenes:', err);
    res.status(500).json({ error: 'Error al obtener las imágenes' });
  }
};

/**
 * POST /api/admin/imagenes?tipo=corte&orden=2
 * Sube una imagen a un slot (tipo + orden). Si el slot ya tenía una imagen,
 * la reemplaza (sube la nueva y borra el archivo viejo de Storage).
 * El body es el binario WebP crudo — lo parsea express.raw() en la ruta.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @param {string} req.query.tipo - 'local' | 'corte' | 'logo'
 * @param {string} req.query.orden - slot dentro del tipo (1..límite)
 * @param {Buffer} req.body - contenido WebP de la imagen
 * @returns {JSON} 201 { id, tipo, orden, url } | 400
 */
export const postImagen = async (req, res) => {
  const { tipo } = req.query;
  const orden = Number(req.query.orden);

  // --- Validación de parámetros ---
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: `tipo inválido — debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` });
  }
  if (!Number.isInteger(orden) || orden < 1 || orden > LIMITES_POR_TIPO[tipo]) {
    return res.status(400).json({
      error: `orden inválido — para tipo "${tipo}" debe ser un entero entre 1 y ${LIMITES_POR_TIPO[tipo]}`,
    });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'No se recibió la imagen (body vacío o no es WebP)' });
  }

  try {
    // --- ¿El slot ya estaba ocupado? ---
    const existente = await query(
      `SELECT id, storage_path FROM tenant_imagen
        WHERE tenant_id = $1 AND tipo = $2 AND orden = $3`,
      [req.tenant_id, tipo, orden]
    );

    // --- Subir el archivo nuevo a Storage ---
    const nuevoPath = construirPath(req.tenant_id, tipo);
    await subirImagen(nuevoPath, req.body);

    let fila;
    if (existente.rows.length > 0) {
      // Reemplazo: actualizar la fila y borrar el archivo viejo de Storage.
      const result = await query(
        `UPDATE tenant_imagen SET storage_path = $1
          WHERE id = $2
        RETURNING id, tipo, orden, storage_path`,
        [nuevoPath, existente.rows[0].id]
      );
      fila = result.rows[0];
      await eliminarImagen(existente.rows[0].storage_path);
    } else {
      // Slot nuevo: insertar la fila.
      const result = await query(
        `INSERT INTO tenant_imagen (tenant_id, tipo, orden, storage_path)
         VALUES ($1, $2, $3, $4)
       RETURNING id, tipo, orden, storage_path`,
        [req.tenant_id, tipo, orden, nuevoPath]
      );
      fila = result.rows[0];
    }

    console.log('[imagenes] postImagen completado | imagen_id:', fila.id);
    res.status(201).json({
      id: fila.id,
      tipo: fila.tipo,
      orden: fila.orden,
      url: urlPublica(fila.storage_path),
    });
  } catch (err) {
    console.error('[imagenes] Error en postImagen:', err);
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
};

/**
 * DELETE /api/admin/imagenes/:id
 * Borra una imagen: la fila de la tabla y el archivo de Storage.
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @param {string} req.params.id - UUID de la imagen
 * @returns {JSON} 200 { ok: true } | 404
 */
export const deleteImagen = async (req, res) => {
  try {
    // El filtro por tenant_id evita que un tenant borre imágenes de otro.
    const result = await query(
      `DELETE FROM tenant_imagen
        WHERE id = $1 AND tenant_id = $2
      RETURNING storage_path`,
      [req.params.id, req.tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    await eliminarImagen(result.rows[0].storage_path);
    console.log('[imagenes] deleteImagen completado | imagen_id:', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[imagenes] Error en deleteImagen:', err);
    res.status(500).json({ error: 'Error al eliminar la imagen' });
  }
};
