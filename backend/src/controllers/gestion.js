// /backend/src/controllers/gestion.js
// Controlador para la sección Gestión del panel admin.
// Maneja ABM de barberos, servicios, productos, datos del negocio y cambio de PIN admin.
// Todas las funciones usan req.tenant_id, inyectado por tenantMiddleware
// en rutas públicas (desde .env) y por verificarToken en rutas protegidas (desde JWT).

import { query } from '../config/db.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// ─── BARBEROS ────────────────────────────────────────────────────────────────

/**
 * getBarberos
 * Devuelve todos los barberos del tenant ordenados por nombre.
 * @param {string} req.tenant_id - Inyectado por verificarToken
 * @returns {JSON} Array de barberos con id, nombre, comision_tipo, comision_valor, activo
 */
export const getBarberos = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre, comision_tipo, comision_valor, activo
       FROM barbero
       WHERE tenant_id = $1
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[gestion] Error en getBarberos:', err);
    res.status(500).json({ error: 'Error al obtener barberos' });
  }
};

/**
 * crearBarbero
 * Crea un nuevo barbero con PIN hasheado con bcrypt.
 * @param {string} req.tenant_id          - Inyectado por verificarToken
 * @param {string} req.body.nombre        - Nombre del barbero
 * @param {string} req.body.pin           - PIN de 4 dígitos (se hashea antes de guardar)
 * @param {number} req.body.comision_valor - Porcentaje de comisión (0-100)
 * @returns {JSON} Barbero creado sin PIN
 */
export const crearBarbero = async (req, res) => {
  const { nombre, pin, comision_valor } = req.body;

  if (!nombre || !pin || comision_valor === undefined) {
    return res.status(400).json({ error: 'nombre, pin y comision_valor son requeridos' });
  }
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'El PIN debe ser exactamente 4 dígitos numéricos' });
  }

  try {
    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
    const result = await query(
      `INSERT INTO barbero (tenant_id, nombre, pin, comision_tipo, comision_valor, activo)
       VALUES ($1, $2, $3, 'porcentaje', $4, true)
       RETURNING id, nombre, comision_tipo, comision_valor, activo`,
      [req.tenant_id, nombre.trim(), pinHash, Number(comision_valor)]
    );
    console.log('[gestion] crearBarbero completado | barbero_id:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error en crearBarbero:', err);
    res.status(500).json({ error: 'Error al crear barbero' });
  }
};

/**
 * editarBarbero
 * Edita nombre, comision_valor y/o activo de un barbero.
 * Si se envía un nuevo PIN, lo hashea antes de guardar.
 * @param {string}  req.params.id          - UUID del barbero
 * @param {string}  req.tenant_id          - Inyectado por verificarToken
 * @param {string}  req.body.nombre        - Nombre del barbero
 * @param {number}  req.body.comision_valor - Porcentaje de comisión
 * @param {boolean} req.body.activo        - Estado activo/inactivo
 * @param {string}  req.body.pin           - Nuevo PIN opcional (4 dígitos)
 * @returns {JSON} Barbero actualizado sin PIN
 */
export const editarBarbero = async (req, res) => {
  const { id } = req.params;
  const { nombre, comision_valor, activo, pin } = req.body;

  if (!nombre || comision_valor === undefined || activo === undefined) {
    return res.status(400).json({ error: 'nombre, comision_valor y activo son requeridos' });
  }

  try {
    let result;

    if (pin) {
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: 'El PIN debe ser exactamente 4 dígitos numéricos' });
      }
      const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
      result = await query(
        `UPDATE barbero
         SET nombre = $1, comision_valor = $2, activo = $3, pin = $4
         WHERE id = $5 AND tenant_id = $6
         RETURNING id, nombre, comision_tipo, comision_valor, activo`,
        [nombre.trim(), Number(comision_valor), activo, pinHash, id, req.tenant_id]
      );
    } else {
      result = await query(
        `UPDATE barbero
         SET nombre = $1, comision_valor = $2, activo = $3
         WHERE id = $4 AND tenant_id = $5
         RETURNING id, nombre, comision_tipo, comision_valor, activo`,
        [nombre.trim(), Number(comision_valor), activo, id, req.tenant_id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }
    console.log('[gestion] editarBarbero completado | barbero_id:', result.rows[0].id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error en editarBarbero:', err);
    res.status(500).json({ error: 'Error al editar barbero' });
  }
};

// ─── SERVICIOS ───────────────────────────────────────────────────────────────

/**
 * getServicios
 * Devuelve todos los servicios del tenant ordenados por nombre.
 * @param {string} req.tenant_id - Inyectado por verificarToken
 * @returns {JSON} Array de servicios con id, nombre, precio, activo
 */
export const getServicios = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre, precio, activo
       FROM servicio
       WHERE tenant_id = $1
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[gestion] Error en getServicios:', err);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
};

/**
 * crearServicio
 * Crea un nuevo servicio para el tenant.
 * @param {string} req.tenant_id    - Inyectado por verificarToken
 * @param {string} req.body.nombre  - Nombre del servicio
 * @param {number} req.body.precio  - Precio del servicio
 * @returns {JSON} Servicio creado
 */
export const crearServicio = async (req, res) => {
  const { nombre, precio } = req.body;

  if (!nombre || precio === undefined) {
    return res.status(400).json({ error: 'nombre y precio son requeridos' });
  }

  try {
    const result = await query(
      `INSERT INTO servicio (tenant_id, nombre, precio, activo)
       VALUES ($1, $2, $3, true)
       RETURNING id, nombre, precio, activo`,
      [req.tenant_id, nombre.trim(), Number(precio)]
    );
    console.log('[gestion] crearServicio completado | servicio_id:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error en crearServicio:', err);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
};

/**
 * editarServicio
 * Edita nombre, precio y/o activo de un servicio.
 * @param {string}  req.params.id    - UUID del servicio
 * @param {string}  req.tenant_id    - Inyectado por verificarToken
 * @param {string}  req.body.nombre  - Nombre del servicio
 * @param {number}  req.body.precio  - Precio del servicio
 * @param {boolean} req.body.activo  - Estado activo/inactivo
 * @returns {JSON} Servicio actualizado
 */
export const editarServicio = async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, activo } = req.body;

  if (!nombre || precio === undefined || activo === undefined) {
    return res.status(400).json({ error: 'nombre, precio y activo son requeridos' });
  }

  try {
    const result = await query(
      `UPDATE servicio
       SET nombre = $1, precio = $2, activo = $3
       WHERE id = $4 AND tenant_id = $5
       RETURNING id, nombre, precio, activo`,
      [nombre.trim(), Number(precio), activo, id, req.tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    console.log('[gestion] editarServicio completado | servicio_id:', result.rows[0].id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error en editarServicio:', err);
    res.status(500).json({ error: 'Error al editar servicio' });
  }
};

// ─── PRODUCTOS ───────────────────────────────────────────────────────────────

/**
 * getProductos
 * Devuelve todos los productos del tenant ordenados por nombre.
 * @param {string} req.tenant_id - Inyectado por verificarToken
 * @returns {JSON} Array de productos con id, nombre, precio, stock_actual, stock_minimo, activo
 */
export const getProductos = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre, precio, stock_actual, stock_minimo, activo
       FROM producto
       WHERE tenant_id = $1
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[gestion] Error en getProductos:', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

/**
 * crearProducto
 * Crea un nuevo producto. stock_actual arranca en `agregar_stock` (stock inicial,
 * default 0). Stock inicial y datos del producto se persisten en una sola sentencia
 * INSERT (atómica por definición — ver convención §6: sin BEGIN/COMMIT).
 * @param {string} req.tenant_id          - Inyectado por verificarToken
 * @param {string} req.body.nombre        - Nombre del producto
 * @param {number} req.body.precio        - Precio del producto
 * @param {number} req.body.stock_minimo  - Stock mínimo para alertas (default: 0)
 * @param {number} req.body.agregar_stock - Stock inicial con el que ingresa (default 0, >= 0)
 * @returns {JSON} Producto creado
 */
export const crearProducto = async (req, res) => {
  const { nombre, precio, stock_minimo, agregar_stock } = req.body;

  if (!nombre || precio === undefined) {
    return res.status(400).json({ error: 'nombre y precio son requeridos' });
  }

  // agregar_stock es el stock inicial (opcional). Si viene, debe ser un número >= 0.
  const delta = Number(agregar_stock ?? 0);
  if (!Number.isFinite(delta) || delta < 0) {
    return res.status(400).json({ error: 'agregar_stock debe ser un número mayor o igual a 0' });
  }

  try {
    const result = await query(
      `INSERT INTO producto (tenant_id, nombre, precio, stock_actual, stock_minimo, activo)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, nombre, precio, stock_actual, stock_minimo, activo`,
      [req.tenant_id, nombre.trim(), Number(precio), delta, Number(stock_minimo ?? 0)]
    );
    console.log('[gestion] crearProducto completado | producto_id:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error en crearProducto:', err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

/**
 * editarProducto
 * Edita nombre, precio, stock_minimo y/o activo, y opcionalmente suma unidades
 * al stock con `agregar_stock` (delta aditivo). Datos y delta de stock se aplican
 * en una sola sentencia UPDATE (atómica por definición — convención §6: sin
 * BEGIN/COMMIT). stock_actual nunca se setea directo, solo se incrementa.
 * @param {string}  req.params.id          - UUID del producto
 * @param {string}  req.tenant_id          - Inyectado por verificarToken
 * @param {string}  req.body.nombre        - Nombre del producto
 * @param {number}  req.body.precio        - Precio del producto
 * @param {number}  req.body.stock_minimo  - Stock mínimo para alertas
 * @param {boolean} req.body.activo        - Estado activo/inactivo
 * @param {number}  req.body.agregar_stock - Unidades a sumar al stock actual (default 0, >= 0)
 * @returns {JSON} Producto actualizado
 */
export const editarProducto = async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, stock_minimo, activo, agregar_stock } = req.body;

  if (!nombre || precio === undefined || activo === undefined) {
    return res.status(400).json({ error: 'nombre, precio y activo son requeridos' });
  }

  // agregar_stock es opcional (delta a sumar al stock actual). Si viene, debe ser >= 0.
  const delta = Number(agregar_stock ?? 0);
  if (!Number.isFinite(delta) || delta < 0) {
    return res.status(400).json({ error: 'agregar_stock debe ser un número mayor o igual a 0' });
  }

  try {
    const result = await query(
      `UPDATE producto
       SET nombre = $1, precio = $2, stock_minimo = $3, activo = $4,
           stock_actual = stock_actual + $5
       WHERE id = $6 AND tenant_id = $7
       RETURNING id, nombre, precio, stock_actual, stock_minimo, activo`,
      [nombre.trim(), Number(precio), Number(stock_minimo ?? 0), activo, delta, id, req.tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    console.log('[gestion] editarProducto completado | producto_id:', result.rows[0].id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error en editarProducto:', err);
    res.status(500).json({ error: 'Error al editar producto' });
  }
};

// ─── DATOS DEL NEGOCIO ────────────────────────────────────────────────────────

/**
 * getNegocio
 * Devuelve los datos del tenant (nombre_negocio, booking_url).
 * Ruta pública — req.tenant_id viene del tenantMiddleware (desde .env).
 * El logo NO viaja acá: se sirve por GET /negocio/imagenes (tenant_imagen tipo='logo').
 * @param {string} req.tenant_id - Inyectado por tenantMiddleware
 * @returns {JSON} { nombre_negocio, booking_url }
 */
export const getNegocio = async (req, res) => {
  try {
    const result = await query(
      `SELECT nombre_negocio, booking_url FROM tenant WHERE id = $1`,
      [req.tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error en getNegocio:', err);
    res.status(500).json({ error: 'Error al obtener datos del negocio' });
  }
};

export const editarNegocio = async (req, res) => {
  const { nombre_negocio, booking_url } = req.body;

  if (!nombre_negocio) {
    return res.status(400).json({ error: 'nombre_negocio es requerido' });
  }

  try {
    const result = await query(
      `UPDATE tenant
       SET nombre_negocio = $1,
           booking_url    = $2
       WHERE id = $3
       RETURNING nombre_negocio, booking_url`,
      [nombre_negocio.trim(), booking_url ? booking_url.trim() : null, req.tenant_id]
    );
    console.log('[gestion] editarNegocio completado | nombre:', result.rows[0].nombre_negocio);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error en editarNegocio:', err);
    res.status(500).json({ error: 'Error al editar negocio' });
  }
};

// ─── PIN ADMIN ────────────────────────────────────────────────────────────────

/**
 * cambiarPinAdmin
 * Verifica el PIN actual con bcrypt y guarda el nuevo PIN hasheado.
 * @param {string} req.tenant_id        - Inyectado por verificarToken
 * @param {string} req.body.pin_actual  - PIN actual para verificación
 * @param {string} req.body.pin_nuevo   - Nuevo PIN de 4 dígitos
 * @returns {JSON} { ok: true }
 */
export const cambiarPinAdmin = async (req, res) => {
  const { pin_actual, pin_nuevo } = req.body;

  if (!pin_actual || !pin_nuevo) {
    return res.status(400).json({ error: 'pin_actual y pin_nuevo son requeridos' });
  }
  if (!/^\d{4}$/.test(pin_nuevo)) {
    return res.status(400).json({ error: 'El nuevo PIN debe ser exactamente 4 dígitos numéricos' });
  }

  try {
    const tenantResult = await query(
      `SELECT pin_admin FROM tenant WHERE id = $1`,
      [req.tenant_id]
    );
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    const pinCorrecto = await bcrypt.compare(pin_actual, tenantResult.rows[0].pin_admin);
    if (!pinCorrecto) {
      console.log('[gestion] cambiarPinAdmin — PIN actual incorrecto | cambio rechazado');
      return res.status(401).json({ error: 'El PIN actual es incorrecto' });
    }

    const nuevoPinHash = await bcrypt.hash(pin_nuevo, SALT_ROUNDS);
    await query(
      `UPDATE tenant SET pin_admin = $1 WHERE id = $2`,
      [nuevoPinHash, req.tenant_id]
    );

    console.log('[gestion] cambiarPinAdmin completado');
    res.json({ ok: true });
  } catch (err) {
    console.error('[gestion] Error en cambiarPinAdmin:', err);
    res.status(500).json({ error: 'Error al cambiar el PIN' });
  }
};