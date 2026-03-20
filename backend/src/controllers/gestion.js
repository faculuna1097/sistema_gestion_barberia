// backend/src/controllers/gestion.js
// Controlador para la sección Gestión del panel admin.
// Maneja ABM de barberos, servicios, productos, datos del negocio y cambio de PIN admin.
//
// Todas las funciones usan req.tenant_id, inyectado por tenantMiddleware
// en rutas públicas (desde .env) y por verificarToken en rutas protegidas (desde JWT).

import { query } from '../config/db.js';
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 10;

// ─── BARBEROS ────────────────────────────────────────────────────────────────

/**
 * getBarberos — devuelve todos los barberos del tenant ordenados por nombre.
 * GET /api/gestion/barberos
 * req.tenant_id inyectado por verificarToken
 */
export const getBarberos = async (req, res) => {
  console.log('[gestion] GET barberos — tenant:', req.tenant_id);
  try {
    const result = await query(
      `SELECT id, nombre, comision_tipo, comision_valor, activo
       FROM barbero
       WHERE tenant_id = $1
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    console.log('[gestion] Barberos obtenidos:', result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error('[gestion] Error al obtener barberos:', err);
    res.status(500).json({ error: 'Error al obtener barberos' });
  }
};

/**
 * crearBarbero — crea un nuevo barbero con PIN hasheado.
 * POST /api/gestion/barberos
 * req.tenant_id inyectado por verificarToken
 * Body: { nombre, pin, comision_valor }
 */
export const crearBarbero = async (req, res) => {
  console.log('[gestion] POST barberos — body:', { ...req.body, pin: '***' }, '| tenant:', req.tenant_id);
  const { nombre, pin, comision_valor } = req.body;

  if (!nombre || !pin || comision_valor === undefined) {
    return res.status(400).json({ error: 'nombre, pin y comision_valor son requeridos' });
  }
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
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
    console.log('[gestion] Barbero creado:', result.rows[0].id, result.rows[0].nombre);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error al crear barbero:', err);
    res.status(500).json({ error: 'Error al crear barbero' });
  }
};

/**
 * editarBarbero — edita nombre, comision_valor y/o activo de un barbero.
 * Si se envía un nuevo PIN, lo hashea antes de guardar.
 * PUT /api/gestion/barberos/:id
 * req.tenant_id inyectado por verificarToken
 * Body: { nombre, comision_valor, activo, pin? }
 */
export const editarBarbero = async (req, res) => {
  console.log('[gestion] PUT barberos/:id — id:', req.params.id, '| body:', { ...req.body, pin: req.body.pin ? '***' : undefined }, '| tenant:', req.tenant_id);
  const { id } = req.params;
  const { nombre, comision_valor, activo, pin } = req.body;

  if (!nombre || comision_valor === undefined || activo === undefined) {
    return res.status(400).json({ error: 'nombre, comision_valor y activo son requeridos' });
  }

  try {
    let result;

    if (pin) {
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
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
    console.log('[gestion] Barbero editado:', result.rows[0].id, result.rows[0].nombre);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error al editar barbero:', err);
    res.status(500).json({ error: 'Error al editar barbero' });
  }
};

// ─── SERVICIOS ───────────────────────────────────────────────────────────────

/**
 * getServicios — devuelve todos los servicios del tenant ordenados por nombre.
 * GET /api/gestion/servicios
 * req.tenant_id inyectado por verificarToken
 */
export const getServicios = async (req, res) => {
  console.log('[gestion] GET servicios — tenant:', req.tenant_id);
  try {
    const result = await query(
      `SELECT id, nombre, precio, activo
       FROM servicio
       WHERE tenant_id = $1
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    console.log('[gestion] Servicios obtenidos:', result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error('[gestion] Error al obtener servicios:', err);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
};

/**
 * crearServicio — crea un nuevo servicio.
 * POST /api/gestion/servicios
 * req.tenant_id inyectado por verificarToken
 * Body: { nombre, precio }
 */
export const crearServicio = async (req, res) => {
  console.log('[gestion] POST servicios — body:', req.body, '| tenant:', req.tenant_id);
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
    console.log('[gestion] Servicio creado:', result.rows[0].id, result.rows[0].nombre);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error al crear servicio:', err);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
};

/**
 * editarServicio — edita nombre, precio y/o activo de un servicio.
 * PUT /api/gestion/servicios/:id
 * req.tenant_id inyectado por verificarToken
 * Body: { nombre, precio, activo }
 */
export const editarServicio = async (req, res) => {
  console.log('[gestion] PUT servicios/:id — id:', req.params.id, '| body:', req.body, '| tenant:', req.tenant_id);
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
    console.log('[gestion] Servicio editado:', result.rows[0].id, result.rows[0].nombre);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error al editar servicio:', err);
    res.status(500).json({ error: 'Error al editar servicio' });
  }
};

// ─── PRODUCTOS ───────────────────────────────────────────────────────────────

/**
 * getProductos — devuelve todos los productos del tenant.
 * GET /api/gestion/productos
 * req.tenant_id inyectado por verificarToken
 */
export const getProductos = async (req, res) => {
  console.log('[gestion] GET productos — tenant:', req.tenant_id);
  try {
    const result = await query(
      `SELECT id, nombre, precio, stock_actual, stock_minimo, activo
       FROM producto
       WHERE tenant_id = $1
       ORDER BY nombre ASC`,
      [req.tenant_id]
    );
    console.log('[gestion] Productos obtenidos:', result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error('[gestion] Error al obtener productos:', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

/**
 * crearProducto — crea un nuevo producto. stock_actual arranca en 0.
 * POST /api/gestion/productos
 * req.tenant_id inyectado por verificarToken
 * Body: { nombre, precio, stock_minimo }
 */
export const crearProducto = async (req, res) => {
  console.log('[gestion] POST productos — body:', req.body, '| tenant:', req.tenant_id);
  const { nombre, precio, stock_minimo } = req.body;

  if (!nombre || precio === undefined) {
    return res.status(400).json({ error: 'nombre y precio son requeridos' });
  }

  try {
    const result = await query(
      `INSERT INTO producto (tenant_id, nombre, precio, stock_actual, stock_minimo, activo)
       VALUES ($1, $2, $3, 0, $4, true)
       RETURNING id, nombre, precio, stock_actual, stock_minimo, activo`,
      [req.tenant_id, nombre.trim(), Number(precio), Number(stock_minimo ?? 0)]
    );
    console.log('[gestion] Producto creado:', result.rows[0].id, result.rows[0].nombre);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error al crear producto:', err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

/**
 * editarProducto — edita nombre, precio, stock_minimo y/o activo. NO toca stock_actual.
 * PUT /api/gestion/productos/:id
 * req.tenant_id inyectado por verificarToken
 * Body: { nombre, precio, stock_minimo, activo }
 */
export const editarProducto = async (req, res) => {
  console.log('[gestion] PUT productos/:id — id:', req.params.id, '| body:', req.body, '| tenant:', req.tenant_id);
  const { id } = req.params;
  const { nombre, precio, stock_minimo, activo } = req.body;

  if (!nombre || precio === undefined || activo === undefined) {
    return res.status(400).json({ error: 'nombre, precio y activo son requeridos' });
  }

  try {
    const result = await query(
      `UPDATE producto
       SET nombre = $1, precio = $2, stock_minimo = $3, activo = $4
       WHERE id = $5 AND tenant_id = $6
       RETURNING id, nombre, precio, stock_actual, stock_minimo, activo`,
      [nombre.trim(), Number(precio), Number(stock_minimo ?? 0), activo, id, req.tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    console.log('[gestion] Producto editado:', result.rows[0].id, result.rows[0].nombre);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error al editar producto:', err);
    res.status(500).json({ error: 'Error al editar producto' });
  }
};

/**
 * agregarStock — suma unidades al stock_actual de un producto.
 * PUT /api/gestion/productos/:id/agregar-stock
 * req.tenant_id inyectado por verificarToken
 * Body: { cantidad }
 */
export const agregarStock = async (req, res) => {
  console.log('[gestion] PUT productos/:id/agregar-stock — id:', req.params.id, '| body:', req.body, '| tenant:', req.tenant_id);
  const { id } = req.params;
  const { cantidad } = req.body;

  if (!cantidad || Number(cantidad) <= 0) {
    return res.status(400).json({ error: 'cantidad debe ser un número mayor a 0' });
  }

  try {
    const result = await query(
      `UPDATE producto
       SET stock_actual = stock_actual + $1
       WHERE id = $2 AND tenant_id = $3
       RETURNING id, nombre, stock_actual`,
      [Number(cantidad), id, req.tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    console.log('[gestion] Stock actualizado:', result.rows[0].nombre, '— nuevo stock:', result.rows[0].stock_actual);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error al agregar stock:', err);
    res.status(500).json({ error: 'Error al agregar stock' });
  }
};

// ─── DATOS DEL NEGOCIO ────────────────────────────────────────────────────────

/**
 * getNegocio — devuelve los datos del tenant (nombre_negocio, logo).
 * GET /api/gestion/negocio
 * Ruta pública — req.tenant_id viene del tenantMiddleware (desde .env).
 */
export const getNegocio = async (req, res) => {
  console.log('[gestion] GET negocio — tenant:', req.tenant_id);
  try {
    const result = await query(
      `SELECT nombre_negocio, logo FROM tenant WHERE id = $1`,
      [req.tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    console.log('[gestion] Datos del negocio obtenidos:', result.rows[0].nombre_negocio);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error al obtener datos del negocio:', err);
    res.status(500).json({ error: 'Error al obtener datos del negocio' });
  }
};

/**
 * editarNegocio — actualiza el nombre del negocio.
 * PUT /api/gestion/negocio
 * req.tenant_id inyectado por verificarToken
 * Body: { nombre_negocio }
 */
export const editarNegocio = async (req, res) => {
  console.log('[gestion] PUT negocio — body:', req.body, '| tenant:', req.tenant_id);
  const { nombre_negocio } = req.body;

  if (!nombre_negocio) {
    return res.status(400).json({ error: 'nombre_negocio es requerido' });
  }

  try {
    const result = await query(
      `UPDATE tenant SET nombre_negocio = $1 WHERE id = $2
       RETURNING nombre_negocio`,
      [nombre_negocio.trim(), req.tenant_id]
    );
    console.log('[gestion] Nombre del negocio actualizado:', result.rows[0].nombre_negocio);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error al editar negocio:', err);
    res.status(500).json({ error: 'Error al editar negocio' });
  }
};

// ─── PIN ADMIN ────────────────────────────────────────────────────────────────

/**
 * cambiarPinAdmin — verifica el PIN actual y guarda el nuevo hasheado.
 * PUT /api/gestion/pin-admin
 * req.tenant_id inyectado por verificarToken
 * Body: { pin_actual, pin_nuevo }
 */
export const cambiarPinAdmin = async (req, res) => {
  console.log('[gestion] PUT pin-admin — solicitado cambio de PIN admin | tenant:', req.tenant_id);
  const { pin_actual, pin_nuevo } = req.body;

  if (!pin_actual || !pin_nuevo) {
    return res.status(400).json({ error: 'pin_actual y pin_nuevo son requeridos' });
  }
  if (pin_nuevo.length !== 4 || !/^\d{4}$/.test(pin_nuevo)) {
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

    const pinHash = tenantResult.rows[0].pin_admin;
    const pinCorrecto = await bcrypt.compare(pin_actual, pinHash);

    if (!pinCorrecto) {
      console.log('[gestion] PIN actual incorrecto — cambio rechazado');
      return res.status(401).json({ error: 'El PIN actual es incorrecto' });
    }

    const nuevoPinHash = await bcrypt.hash(pin_nuevo, SALT_ROUNDS);
    await query(
      `UPDATE tenant SET pin_admin = $1 WHERE id = $2`,
      [nuevoPinHash, req.tenant_id]
    );

    console.log('[gestion] PIN admin actualizado exitosamente');
    res.json({ ok: true });
  } catch (err) {
    console.error('[gestion] Error al cambiar PIN admin:', err);
    res.status(500).json({ error: 'Error al cambiar el PIN' });
  }
};
