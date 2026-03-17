// backend/src/controllers/gestion.js
// Controlador para la sección Gestión del panel admin.
// Maneja ABM de barberos, servicios, productos, datos del negocio y cambio de PIN admin.

import { query } from '../config/db.js';
import bcrypt from 'bcrypt';

const TENANT_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
const SALT_ROUNDS = 10;

// ─── BARBEROS ────────────────────────────────────────────────────────────────

/**
 * getBarberos — devuelve todos los barberos del tenant ordenados por nombre.
 * GET /api/gestion/barberos
 */
export const getBarberos = async (req, res) => {
  console.log('[gestion] GET barberos — tenant:', TENANT_ID);
  try {
    const result = await query(
      `SELECT id, nombre, comision_tipo, comision_valor, activo
       FROM barbero
       WHERE tenant_id = $1
       ORDER BY nombre ASC`,
      [TENANT_ID]
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
 * Body: { nombre, pin, comision_valor }
 * comision_tipo siempre es 'porcentaje'.
 */
export const crearBarbero = async (req, res) => {
  console.log('[gestion] POST barberos — body:', { ...req.body, pin: '***' });
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
      [TENANT_ID, nombre.trim(), pinHash, Number(comision_valor)]
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
 * Body: { nombre, comision_valor, activo, pin? }
 */
export const editarBarbero = async (req, res) => {
  console.log('[gestion] PUT barberos/:id — id:', req.params.id, '| body:', { ...req.body, pin: req.body.pin ? '***' : undefined });
  const { id } = req.params;
  const { nombre, comision_valor, activo, pin } = req.body;

  if (!nombre || comision_valor === undefined || activo === undefined) {
    return res.status(400).json({ error: 'nombre, comision_valor y activo son requeridos' });
  }

  try {
    let result;

    if (pin) {
      // Si se envía PIN nuevo, lo validamos y hasheamos
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: 'El PIN debe ser exactamente 4 dígitos numéricos' });
      }
      const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
      result = await query(
        `UPDATE barbero
         SET nombre = $1, comision_valor = $2, activo = $3, pin = $4
         WHERE id = $5 AND tenant_id = $6
         RETURNING id, nombre, comision_tipo, comision_valor, activo`,
        [nombre.trim(), Number(comision_valor), activo, pinHash, id, TENANT_ID]
      );
    } else {
      // Sin cambio de PIN
      result = await query(
        `UPDATE barbero
         SET nombre = $1, comision_valor = $2, activo = $3
         WHERE id = $4 AND tenant_id = $5
         RETURNING id, nombre, comision_tipo, comision_valor, activo`,
        [nombre.trim(), Number(comision_valor), activo, id, TENANT_ID]
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
 */
export const getServicios = async (req, res) => {
  console.log('[gestion] GET servicios — tenant:', TENANT_ID);
  try {
    const result = await query(
      `SELECT id, nombre, precio, activo
       FROM servicio
       WHERE tenant_id = $1
       ORDER BY nombre ASC`,
      [TENANT_ID]
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
 * Body: { nombre, precio }
 */
export const crearServicio = async (req, res) => {
  console.log('[gestion] POST servicios — body:', req.body);
  const { nombre, precio } = req.body;

  if (!nombre || precio === undefined) {
    return res.status(400).json({ error: 'nombre y precio son requeridos' });
  }

  try {
    const result = await query(
      `INSERT INTO servicio (tenant_id, nombre, precio, activo)
       VALUES ($1, $2, $3, true)
       RETURNING id, nombre, precio, activo`,
      [TENANT_ID, nombre.trim(), Number(precio)]
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
 * Body: { nombre, precio, activo }
 */
export const editarServicio = async (req, res) => {
  console.log('[gestion] PUT servicios/:id — id:', req.params.id, '| body:', req.body);
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
      [nombre.trim(), Number(precio), activo, id, TENANT_ID]
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
 * getProductos — devuelve todos los productos del tenant ordenados por nombre.
 * Incluye stock_actual (solo lectura) y stock_minimo (editable).
 * GET /api/gestion/productos
 */
export const getProductos = async (req, res) => {
  console.log('[gestion] GET productos — tenant:', TENANT_ID);
  try {
    const result = await query(
      `SELECT id, nombre, precio, stock_actual, stock_minimo, activo
       FROM producto
       WHERE tenant_id = $1
       ORDER BY nombre ASC`,
      [TENANT_ID]
    );
    console.log('[gestion] Productos obtenidos:', result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error('[gestion] Error al obtener productos:', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

/**
 * crearProducto — crea un nuevo producto.
 * POST /api/gestion/productos
 * Body: { nombre, precio, stock_minimo }
 * stock_actual arranca en 0.
 */
export const crearProducto = async (req, res) => {
  console.log('[gestion] POST productos — body:', req.body);
  const { nombre, precio, stock_minimo } = req.body;

  if (!nombre || precio === undefined) {
    return res.status(400).json({ error: 'nombre y precio son requeridos' });
  }

  try {
    const result = await query(
      `INSERT INTO producto (tenant_id, nombre, precio, stock_actual, stock_minimo, activo)
       VALUES ($1, $2, $3, 0, $4, true)
       RETURNING id, nombre, precio, stock_actual, stock_minimo, activo`,
      [TENANT_ID, nombre.trim(), Number(precio), Number(stock_minimo ?? 0)]
    );
    console.log('[gestion] Producto creado:', result.rows[0].id, result.rows[0].nombre);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[gestion] Error al crear producto:', err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

/**
 * editarProducto — edita nombre, precio, stock_minimo y/o activo de un producto.
 * NO toca stock_actual directamente.
 * PUT /api/gestion/productos/:id
 * Body: { nombre, precio, stock_minimo, activo }
 */
export const editarProducto = async (req, res) => {
  console.log('[gestion] PUT productos/:id — id:', req.params.id, '| body:', req.body);
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
      [nombre.trim(), Number(precio), Number(stock_minimo ?? 0), activo, id, TENANT_ID]
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
 * Opción B: el admin no edita el número directamente, sino que indica
 * cuántas unidades ingresaron. El backend hace stock_actual = stock_actual + cantidad.
 * PUT /api/gestion/productos/:id/agregar-stock
 * Body: { cantidad }
 */
export const agregarStock = async (req, res) => {
  console.log('[gestion] PUT productos/:id/agregar-stock — id:', req.params.id, '| body:', req.body);
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
      [Number(cantidad), id, TENANT_ID]
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
 */
export const getNegocio = async (req, res) => {
  console.log('[gestion] GET negocio — tenant:', TENANT_ID);
  try {
    const result = await query(
      `SELECT nombre_negocio, logo FROM tenant WHERE id = $1`,
      [TENANT_ID]
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
 * Body: { nombre_negocio }
 */
export const editarNegocio = async (req, res) => {
  console.log('[gestion] PUT negocio — body:', req.body);
  const { nombre_negocio } = req.body;

  if (!nombre_negocio) {
    return res.status(400).json({ error: 'nombre_negocio es requerido' });
  }

  try {
    const result = await query(
      `UPDATE tenant SET nombre_negocio = $1 WHERE id = $2
       RETURNING nombre_negocio`,
      [nombre_negocio.trim(), TENANT_ID]
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
 * Body: { pin_actual, pin_nuevo }
 * El PIN actual se verifica con bcrypt contra el hash guardado en tenant.pin_admin.
 */
export const cambiarPinAdmin = async (req, res) => {
  // NUNCA loguear los PINs
  console.log('[gestion] PUT pin-admin — solicitado cambio de PIN admin');
  const { pin_actual, pin_nuevo } = req.body;

  if (!pin_actual || !pin_nuevo) {
    return res.status(400).json({ error: 'pin_actual y pin_nuevo son requeridos' });
  }
  if (pin_nuevo.length !== 4 || !/^\d{4}$/.test(pin_nuevo)) {
    return res.status(400).json({ error: 'El nuevo PIN debe ser exactamente 4 dígitos numéricos' });
  }

  try {
    // Obtener el hash del PIN actual
    const tenantResult = await query(
      `SELECT pin_admin FROM tenant WHERE id = $1`,
      [TENANT_ID]
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

    // PIN actual correcto — hashear y guardar el nuevo
    const nuevoPinHash = await bcrypt.hash(pin_nuevo, SALT_ROUNDS);
    await query(
      `UPDATE tenant SET pin_admin = $1 WHERE id = $2`,
      [nuevoPinHash, TENANT_ID]
    );

    console.log('[gestion] PIN admin actualizado exitosamente');
    res.json({ ok: true });
  } catch (err) {
    console.error('[gestion] Error al cambiar PIN admin:', err);
    res.status(500).json({ error: 'Error al cambiar el PIN' });
  }
};
