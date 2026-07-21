// /backend/src/controllers/ventas.js
import { query } from '../config/db.js';
import { esMontoValido, esCantidadValida } from '../utils/validarNumero.js';
import { esFormaPagoValida } from '../utils/validarPago.js';
import { aplicarMutacionesStock } from '../utils/stock.js';
import { TZ } from '../utils/constantes.js';

export const createVenta = async (req, res) => {
  const { producto_id, cantidad, precio_unitario, forma_pago } = req.body;

  if (!producto_id || !forma_pago) {
    return res.status(400).json({
      error: 'Faltan campos requeridos: producto_id, cantidad, precio_unitario, forma_pago'
    });
  }
  if (!esFormaPagoValida(forma_pago)) {
    return res.status(400).json({ error: "forma_pago debe ser 'efectivo' o 'mercado_pago'" });
  }
  if (!esCantidadValida(cantidad)) {
    return res.status(400).json({ error: 'cantidad es requerida y debe ser un entero >= 1' });
  }
  if (!esMontoValido(precio_unitario)) {
    return res.status(400).json({ error: 'precio_unitario es requerido y debe ser un número >= 0' });
  }

  let ventaId = null;

  try {
    const stockResult = await query(
      `SELECT stock_actual FROM producto WHERE id = $1 AND tenant_id = $2`,
      [producto_id, req.tenant_id]
    );

    if (!stockResult.rows.length) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const stockActual = stockResult.rows[0].stock_actual;

    if (stockActual < cantidad) {
      console.warn('[ventas] createVenta — stock insuficiente | disponible:', stockActual, '| solicitado:', cantidad);
      return res.status(400).json({
        error: `Stock insuficiente. Disponible: ${stockActual}`
      });
    }

    const ventaResult = await query(
      `INSERT INTO venta (tenant_id, producto_id, cantidad, precio_unitario, forma_pago)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.tenant_id, producto_id, cantidad, precio_unitario, forma_pago]
    );

    ventaId = ventaResult.rows[0].id;

    // Descuento de stock vía helper central (auditoría 6.2/4.2): escritura relativa
    // no idempotente (no reintenta). Si falla, el catch de abajo borra la venta ya
    // insertada — el cleanup compensatorio original de createVenta.
    await aplicarMutacionesStock([{ producto_id, delta: -cantidad }], req.tenant_id);

    console.log('[ventas] createVenta completado | venta_id:', ventaId);
    res.status(201).json({
      message: 'Venta registrada correctamente',
      venta_id: ventaId,
      monto_total: cantidad * precio_unitario
    });

  } catch (err) {
    console.error('[ventas] Error en createVenta | venta_id al momento del fallo:', ventaId, '| error:', err);

    if (ventaId) {
      await query('DELETE FROM venta WHERE id = $1', [ventaId]).catch((cleanupErr) => {
        console.error('[ventas] createVenta — error en cleanup:', cleanupErr);
      });
    }

    res.status(500).json({ error: 'Error al registrar la venta' });
  }
};

export const getVentasMensual = async (req, res) => {
  const mes = req.query.mes || new Date().toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "El parámetro 'mes' debe tener formato YYYY-MM" });
  }

  try {
    const resultadoVentas = await query(
      `SELECT
         v.id,
         v.producto_id,
         TO_CHAR(v.timestamp AT TIME ZONE $3, 'DD/MM/YYYY') AS fecha,
         p.nombre                                            AS producto_nombre,
         v.cantidad,
         v.precio_unitario,
         (v.cantidad * v.precio_unitario)                    AS total,
         v.forma_pago
       FROM venta v
       JOIN producto p ON v.producto_id = p.id
       WHERE v.tenant_id = $1
         AND TO_CHAR(v.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
       ORDER BY v.timestamp DESC`,
      [req.tenant_id, mes, TZ]
    );

    const resultadoTotales = await query(
      `SELECT
         p.nombre                              AS producto_nombre,
         SUM(v.cantidad)                       AS cantidad_total,
         SUM(v.cantidad * v.precio_unitario)   AS monto_total
       FROM venta v
       JOIN producto p ON v.producto_id = p.id
       WHERE v.tenant_id = $1
         AND TO_CHAR(v.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
       GROUP BY p.nombre
       ORDER BY monto_total DESC`,
      [req.tenant_id, mes, TZ]
    );

    const totalGeneral = resultadoTotales.rows.reduce(
      (acc, row) => acc + parseFloat(row.monto_total), 0
    );

    return res.status(200).json({
      ventas: resultadoVentas.rows,
      totalesPorProducto: resultadoTotales.rows,
      totalGeneral,
    });

  } catch (err) {
    console.error('[ventas] Error en getVentasMensual:', err);
    return res.status(500).json({ error: 'Error interno al obtener las ventas del mes' });
  }
};

export const deleteVenta = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Falta el parámetro id' });
  }

  try {
    const ventaResult = await query(
      `SELECT producto_id, cantidad FROM venta WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenant_id]
    );

    if (ventaResult.rows.length === 0) {
      console.warn('[ventas] deleteVenta — venta no encontrada | id:', id);
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const { producto_id, cantidad } = ventaResult.rows[0];

    // Orden con compensación (auditoría 6.2): restauramos el stock PRIMERO y
    // borramos la venta DESPUÉS. Si el DELETE falla, revertimos el restore (delta
    // conocido) — no hace falta reconstruir la fila de venta para compensar. Al
    // revés (borrar y luego restaurar) un fallo dejaría el stock corto sin arreglo.
    const revertirStock = await aplicarMutacionesStock([{ producto_id, delta: cantidad }], req.tenant_id);
    let delRes;
    try {
      delRes = await query('DELETE FROM venta WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
    } catch (err) {
      await revertirStock();
      throw err;
    }

    // Si el DELETE no borró nada, la fila desapareció entre el SELECT y el DELETE
    // (borrado concurrente). El otro borrado ya restauró el stock, así que el
    // restore que acabamos de aplicar sobra → lo revertimos para no doble-sumar.
    if (delRes.rowCount === 0) {
      await revertirStock();
      console.warn('[ventas] deleteVenta — venta ya no existía al borrar (carrera) | id:', id);
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    console.log('[ventas] deleteVenta completado | venta_id:', id);
    return res.status(200).json({ eliminado: true, id });

  } catch (err) {
    console.error('[ventas] Error en deleteVenta:', err);
    return res.status(500).json({ error: 'Error interno al eliminar la venta' });
  }
};

export const updateVenta = async (req, res) => {
  const { id } = req.params;

  const { producto_id, cantidad, precio_unitario, forma_pago } = req.body;

  if (!producto_id || !forma_pago) {
    return res.status(400).json({
      error: 'Faltan campos requeridos: producto_id, cantidad, precio_unitario, forma_pago'
    });
  }
  if (!esCantidadValida(cantidad)) {
    return res.status(400).json({ error: 'cantidad es requerida y debe ser un entero >= 1' });
  }
  if (!esMontoValido(precio_unitario)) {
    return res.status(400).json({ error: 'precio_unitario es requerido y debe ser un número >= 0' });
  }
  if (!esFormaPagoValida(forma_pago)) {
    return res.status(400).json({ error: "forma_pago debe ser 'efectivo' o 'mercado_pago'" });
  }

  try {
    const ventaOriginal = await query(
      `SELECT producto_id, cantidad FROM venta WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenant_id]
    );

    if (ventaOriginal.rows.length === 0) {
      console.warn('[ventas] updateVenta — venta no encontrada | id:', id);
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const { producto_id: productoIdViejo, cantidad: cantidadVieja } = ventaOriginal.rows[0];

    const stockResult = await query(
      `SELECT stock_actual FROM producto WHERE id = $1 AND tenant_id = $2`,
      [producto_id, req.tenant_id]
    );

    if (stockResult.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const stockActual = stockResult.rows[0].stock_actual;
    const mismoProducto = producto_id === productoIdViejo;
    const stockDisponible = mismoProducto ? stockActual + cantidadVieja : stockActual;

    if (stockDisponible < cantidad) {
      console.warn('[ventas] updateVenta — stock insuficiente | disponible:', stockDisponible, '| solicitado:', cantidad);
      return res.status(400).json({
        error: `Stock insuficiente. Disponible: ${stockDisponible}`
      });
    }

    // Ajuste de stock como mutaciones netas (auditoría 6.2): en vez de
    // restaurar-viejo + descontar-nuevo (2 writes siempre), si el producto no
    // cambió lo colapsamos a un solo UPDATE por el delta neto (menos ventana de
    // inconsistencia). Con producto distinto, dos productos → dos mutaciones.
    const mutaciones = mismoProducto
      ? (cantidadVieja === cantidad ? [] : [{ producto_id, delta: cantidadVieja - cantidad }])
      : [
          { producto_id: productoIdViejo, delta: cantidadVieja }, // restaurar viejo
          { producto_id, delta: -cantidad },                      // descontar nuevo
        ];

    // Stock primero; la fila de venta al final. Si el UPDATE de la fila falla,
    // compensamos el stock (deltas conocidos) antes de propagar — así no hace
    // falta reconstruir la fila para revertir.
    const revertirStock = await aplicarMutacionesStock(mutaciones, req.tenant_id);
    try {
      await query(
        `UPDATE venta
         SET producto_id = $1, cantidad = $2, precio_unitario = $3, forma_pago = $4
         WHERE id = $5 AND tenant_id = $6`,
        [producto_id, cantidad, precio_unitario, forma_pago, id, req.tenant_id]
      );
    } catch (err) {
      await revertirStock();
      throw err;
    }

    console.log('[ventas] updateVenta completado | venta_id:', id);
    return res.status(200).json({ id, producto_id, cantidad, precio_unitario, forma_pago });

  } catch (err) {
    console.error('[ventas] Error en updateVenta:', err);
    return res.status(500).json({ error: 'Error interno al editar la venta' });
  }
};