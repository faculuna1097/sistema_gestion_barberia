// /backend/src/controllers/caja.js
import { query } from '../config/db.js';
import { aplicarMutacionesStock } from '../utils/stock.js';
import { TZ } from '../utils/constantes.js';
import { esMontoPositivo } from '../utils/validarNumero.js';
import { esFormaPagoValida } from '../utils/validarPago.js';
import { esFechaISO, esFechaFutura, hoyISO } from '../utils/validarFecha.js';
import {
  TIPOS_MOVIMIENTO_EXTRA,
  MAX_DESCRIPCION_MOVIMIENTO,
  esTipoMovimientoExtra,
  sentidoDeMovimiento,
} from '../utils/movimientos.js';
import { socioActivoEnTenant } from '../services/sociosService.js';

/**
 * getMovimientosDia
 * Devuelve todos los movimientos del día (cortes, ventas, gastos y movimientos
 * extra) ordenados por timestamp descendente. Cada fila trae `sentido`
 * ('entrada' | 'salida') ya resuelto, para que el front no decida por tipo, y
 * `monto` como número.
 * @param {string} req.query.fecha - Fecha en formato YYYY-MM-DD (default: hoy en timezone AR)
 * @param {string} req.tenant_id  - Inyectado por tenantMiddleware
 * @returns {JSON} { movimientos: [...] } — 400 si `fecha` viene y no es una fecha válida
 */
export const getMovimientosDia = async (req, res) => {
  if (req.query.fecha && !esFechaISO(req.query.fecha)) {
    return res.status(400).json({ error: 'fecha debe tener formato YYYY-MM-DD' });
  }
  const fecha = req.query.fecha || hoyISO();

  try {
    // Las cuatro consultas son independientes: corren en paralelo.
    const [cortesResult, ventasResult, gastosResult, extrasResult] = await Promise.all([
    // ── Query 1: Cortes del día ──────────────────────────────────────────────
    query(
      `SELECT
         c.id,
         c.timestamp,
         TO_CHAR(c.timestamp AT TIME ZONE $2, 'HH24:MI') AS hora,
         b.nombre  AS barbero_nombre,
         s.nombre  AS detalle,
         c.monto_total AS monto,
         c.forma_pago,
         c.turno_id,
         b.comision_valor,
         'corte' AS tipo
       FROM corte c
       JOIN barbero b  ON c.barbero_id  = b.id
       JOIN servicio s ON c.servicio_id = s.id
       WHERE c.tenant_id = $1
         AND DATE(c.timestamp AT TIME ZONE $2) = $3::date
       ORDER BY c.timestamp ASC`,
      [req.tenant_id, TZ, fecha]
    ),

    // ── Query 2: Ventas del día ──────────────────────────────────────────────
    query(
      `SELECT
         v.id,
         v.timestamp,
         TO_CHAR(v.timestamp AT TIME ZONE $2, 'HH24:MI') AS hora,
         NULL AS barbero_nombre,
         p.nombre || ' x' || v.cantidad AS detalle,
         (v.precio_unitario * v.cantidad) AS monto,
         v.forma_pago,
         NULL AS comision_valor,
         'venta' AS tipo
       FROM venta v
       JOIN producto p ON v.producto_id = p.id
       WHERE v.tenant_id = $1
         AND DATE(v.timestamp AT TIME ZONE $2) = $3::date
       ORDER BY v.timestamp ASC`,
      [req.tenant_id, TZ, fecha]
    ),

    // ── Query 3: Gastos del día ──────────────────────────────────────────────
    query(
      `SELECT
         g.id,
         g.timestamp,
         TO_CHAR(g.timestamp AT TIME ZONE $2, 'HH24:MI') AS hora,
         NULL AS barbero_nombre,
         cg.nombre || ': ' || g.descripcion AS detalle,
         g.monto AS monto,
         g.forma_pago,
         NULL AS comision_valor,
         'gasto' AS tipo
       FROM gasto g
       JOIN categoria_gasto cg ON g.categoria_id = cg.id
       WHERE g.tenant_id = $1
         AND DATE(g.timestamp AT TIME ZONE $2) = $3::date
       ORDER BY g.timestamp ASC`,
      [req.tenant_id, TZ, fecha]
    ),

    // ── Query 4: Movimientos extra del día (aportes, retiros, otros ingresos) ─
    // detalle: nombre del socio (+ ' — descripción' si la fila tiene); sin
    // socio, la descripción. El join repite tenant_id como defensa en profundidad.
    query(
      `SELECT
         me.id,
         me.timestamp,
         TO_CHAR(me.timestamp AT TIME ZONE $2, 'HH24:MI') AS hora,
         NULL AS barbero_nombre,
         CASE
           WHEN s.nombre IS NULL THEN me.descripcion
           WHEN me.descripcion IS NULL OR BTRIM(me.descripcion) = '' THEN s.nombre
           ELSE s.nombre || ' — ' || me.descripcion
         END AS detalle,
         me.monto AS monto,
         me.forma_pago,
         NULL AS comision_valor,
         me.tipo AS tipo
       FROM movimiento_extra me
       LEFT JOIN socio s ON s.id = me.socio_id AND s.tenant_id = me.tenant_id
       WHERE me.tenant_id = $1
         AND DATE(me.timestamp AT TIME ZONE $2) = $3::date
       ORDER BY me.timestamp ASC`,
      [req.tenant_id, TZ, fecha]
    ),
    ]);

    // ── Merge, sentido y orden cronológico (más reciente primero) ────────────
    // pg devuelve los NUMERIC como string: la API expone el monto como número,
    // igual que el 201 de crearMovimientoExtra.
    const movimientos = [
      ...cortesResult.rows,
      ...ventasResult.rows,
      ...gastosResult.rows,
      ...extrasResult.rows,
    ]
      .map((m) => ({ ...m, monto: Number(m.monto), sentido: sentidoDeMovimiento(m.tipo) }))
      .sort((b, a) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({ movimientos });

  } catch (err) {
    console.error('[caja] Error en getMovimientosDia:', err);
    res.status(500).json({ error: 'Error al obtener movimientos del día' });
  }
};

/**
 * crearMovimientoExtra
 * Registra un aporte de capital, un retiro de socio u otro ingreso. Qué campos
 * exige cada tipo sale de `requiereSocio` en TIPOS_MOVIMIENTO_EXTRA: los tipos
 * con socio guardan descripcion = NULL y los demás socio_id = NULL (lo que
 * venga de más en el body se ignora).
 * @param {string} req.body.tipo          - 'aporte_capital' | 'retiro_socio' | 'otro_ingreso'
 * @param {number|string} req.body.monto  - Número > 0 (el signo lo da el tipo)
 * @param {string} req.body.forma_pago    - 'efectivo' | 'mercado_pago'
 * @param {string} [req.body.socio_id]    - UUID del socio; requerido si el tipo lleva socio
 * @param {string} [req.body.descripcion] - Requerida si el tipo no lleva socio (1 a 200 caracteres)
 * @param {string} req.body.fecha         - YYYY-MM-DD, requerida y no futura (hora argentina)
 * @param {string} req.tenant_id          - Inyectado por tenantMiddleware
 * @returns {JSON} 201 { id, tipo, socio_id, descripcion, monto, forma_pago, timestamp } (monto como número)
 *   400 si falla una validación; 404 si el socio no existe, es de otro tenant o está inactivo.
 */
export const crearMovimientoExtra = async (req, res) => {
  const { tipo, monto, forma_pago, socio_id, descripcion, fecha } = req.body || {};

  if (!esTipoMovimientoExtra(tipo)) {
    return res.status(400).json({ error: "tipo debe ser 'aporte_capital', 'retiro_socio' u 'otro_ingreso'" });
  }
  if (!esMontoPositivo(monto)) {
    return res.status(400).json({ error: 'monto es requerido y debe ser un número mayor a 0' });
  }
  if (!esFormaPagoValida(forma_pago)) {
    return res.status(400).json({ error: "forma_pago debe ser 'efectivo' o 'mercado_pago'" });
  }

  const { requiereSocio } = TIPOS_MOVIMIENTO_EXTRA[tipo];
  if (requiereSocio && !socio_id) {
    return res.status(400).json({ error: 'socio_id es requerido para aportes y retiros' });
  }

  const descripcionLimpia = typeof descripcion === 'string' ? descripcion.trim() : '';
  if (!requiereSocio
      && (descripcionLimpia.length === 0 || descripcionLimpia.length > MAX_DESCRIPCION_MOVIMIENTO)) {
    return res.status(400).json({
      error: `descripcion es requerida en un otro ingreso (máximo ${MAX_DESCRIPCION_MOVIMIENTO} caracteres)`,
    });
  }

  // fecha es obligatoria: el front la precarga con hoy, así que si llega
  // vacía es porque se borró a mano. No se asume ninguna por defecto.
  if (!esFechaISO(fecha)) {
    return res.status(400).json({ error: 'fecha es requerida y debe tener formato YYYY-MM-DD' });
  }
  if (esFechaFutura(fecha)) {
    return res.status(400).json({ error: 'fecha no puede ser futura' });
  }

  try {
    // Única validación que consulta la base: va después de las que solo miran
    // el body, para no gastar una query en un pedido mal formado.
    if (requiereSocio && !(await socioActivoEnTenant(socio_id, req.tenant_id))) {
      return res.status(404).json({ error: 'Socio no encontrado o inactivo' });
    }

    // timestamp: si la fecha es hoy, el instante real (NOW()); si es un día
    // pasado, el mediodía de ese día en hora argentina.
    const resultado = await query(
      `INSERT INTO movimiento_extra (tenant_id, tipo, socio_id, descripcion, monto, forma_pago, "timestamp")
       VALUES (
         $1, $2, $3, $4, $5, $6,
         CASE
           WHEN $7::date = (NOW() AT TIME ZONE $8)::date THEN NOW()
           ELSE ($7::date + TIME '12:00') AT TIME ZONE $8
         END
       )
       RETURNING id, tipo, socio_id, descripcion, monto, forma_pago, "timestamp"`,
      [
        req.tenant_id,
        tipo,
        requiereSocio ? socio_id : null,
        requiereSocio ? null : descripcionLimpia,
        monto,
        forma_pago,
        fecha,
        TZ,
      ]
    );

    // pg devuelve los NUMERIC como string: la API expone el monto como número.
    const movimientoCreado = { ...resultado.rows[0], monto: Number(resultado.rows[0].monto) };
    console.log('[caja] crearMovimientoExtra completado | id:', movimientoCreado.id, '| tipo:', movimientoCreado.tipo);
    return res.status(201).json(movimientoCreado);

  } catch (err) {
    // Red de seguridad del FK compuesto (tenant_id, socio_id): el socio se borró
    // o cambió entre el chequeo y el INSERT.
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Socio no encontrado o inactivo' });
    }
    console.error('[caja] Error en crearMovimientoExtra:', err);
    return res.status(500).json({ error: 'Error interno al registrar el movimiento' });
  }
};

/**
 * eliminarMovimiento
 * Elimina un registro del día por tipo e id.
 * - corte: borra el corte y, si completaba un turno, lo devuelve a 'reservado'
 * - venta: restaura stock_actual del producto, luego borra venta
 * - gasto: borra directo
 * - aporte_capital / retiro_socio / otro_ingreso: borra directo de movimiento_extra
 * @param {string} req.params.tipo - 'corte' | 'venta' | 'gasto' | 'aporte_capital' | 'retiro_socio' | 'otro_ingreso'
 * @param {string} req.params.id   - UUID del registro
 * @param {string} req.tenant_id   - Inyectado por tenantMiddleware
 * @returns {JSON} { ok: true } — 404 si el registro no existe en el tenant; 400 si el tipo es inválido
 */
export const eliminarMovimiento = async (req, res) => {
  const { tipo, id } = req.params;

  try {
    if (tipo === 'corte') {
      // Recuperamos el turno vinculado (si lo hay) antes de borrar el corte, y
      // de paso validamos existencia (404 si no existe en este tenant).
      const corteResult = await query(
        'SELECT turno_id FROM corte WHERE id = $1 AND tenant_id = $2',
        [id, req.tenant_id]
      );
      if (corteResult.rows.length === 0) {
        return res.status(404).json({ error: 'Corte no encontrado' });
      }
      const { turno_id } = corteResult.rows[0];

      // Orden con compensación (auditoría 6.2): revertimos el turno PRIMERO y
      // borramos el corte DESPUÉS. Si el DELETE del corte falla, devolvemos el
      // turno a 'completado' (compensación con delta de estado conocido). Al revés
      // (borrar corte y luego revertir turno) un fallo dejaría un turno 'completado'
      // huérfano sin corte, y compensarlo exigiría reconstruir la fila del corte.
      //
      // El guard estado = 'completado' hace el revert defensivo (espejo del
      // registro, que solo completa turnos 'reservado'): nunca toca turnos
      // cancelados/no_asistio. Estas escrituras son de VALOR FIJO (idempotentes),
      // así que el retry-once de query() es seguro (no aplica la excepción de 4.2).
      let turnoRevertido = false;
      if (turno_id) {
        const turnoResult = await query(
          `UPDATE turno SET estado = 'reservado'
           WHERE id = $1 AND tenant_id = $2 AND estado = 'completado'`,
          [turno_id, req.tenant_id]
        );
        turnoRevertido = turnoResult.rowCount > 0;
        if (!turnoRevertido) {
          console.warn('[caja] eliminarMovimiento — turno no revertido (no existe, otro tenant, o no estaba completado) | turno_id:', turno_id);
        } else {
          console.log('[caja] eliminarMovimiento — turno revertido a reservado | turno_id:', turno_id);
        }
      }

      try {
        await query('DELETE FROM corte WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      } catch (err) {
        // Compensa el revert del turno si el borrado del corte falló. El guard
        // estado = 'reservado' evita pisar un cambio concurrente.
        if (turnoRevertido) {
          await query(
            `UPDATE turno SET estado = 'completado'
             WHERE id = $1 AND tenant_id = $2 AND estado = 'reservado'`,
            [turno_id, req.tenant_id]
          ).catch((compErr) => {
            console.error('[caja] eliminarMovimiento — error compensando revert de turno (best-effort) | turno_id:', turno_id, '| error:', compErr);
          });
        }
        throw err;
      }
      console.log('[caja] eliminarMovimiento — corte eliminado | id:', id);

    } else if (tipo === 'venta') {
      const ventaResult = await query(
        'SELECT producto_id, cantidad FROM venta WHERE id = $1 AND tenant_id = $2',
        [id, req.tenant_id]
      );
      if (ventaResult.rows.length === 0) {
        return res.status(404).json({ error: 'Venta no encontrada' });
      }
      const { producto_id, cantidad } = ventaResult.rows[0];

      // Restaurar stock primero (helper con compensación) y borrar la venta
      // después; si el DELETE falla, revertimos el restore (auditoría 6.2).
      const revertirStock = await aplicarMutacionesStock([{ producto_id, delta: cantidad }], req.tenant_id);
      console.log('[caja] eliminarMovimiento — stock restaurado | producto_id:', producto_id, '| cantidad:', cantidad);
      let ventaDelRes;
      try {
        ventaDelRes = await query('DELETE FROM venta WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      } catch (err) {
        await revertirStock();
        throw err;
      }
      // Igual que deleteVenta: si el DELETE no borró nada (fila desaparecida entre
      // el SELECT y el DELETE por un borrado concurrente), el restore que ya
      // aplicamos sobra → lo revertimos para no doble-sumar el stock.
      if (ventaDelRes.rowCount === 0) {
        await revertirStock();
        console.warn('[caja] eliminarMovimiento — venta ya no existía al borrar (carrera) | id:', id);
        return res.status(404).json({ error: 'Venta no encontrada' });
      }
      console.log('[caja] eliminarMovimiento — venta eliminada | id:', id);

    } else if (tipo === 'gasto') {
      const gastoDelRes = await query('DELETE FROM gasto WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
      // Contrato consistente con las ramas corte/venta: 404 si no borró nada
      // (id inexistente o de otro tenant) en vez de un 200 engañoso.
      if (gastoDelRes.rowCount === 0) {
        return res.status(404).json({ error: 'Gasto no encontrado' });
      }
      console.log('[caja] eliminarMovimiento — gasto eliminado | id:', id);

    } else if (esTipoMovimientoExtra(tipo)) {
      // El filtro por tipo evita borrar, por ejemplo, un retiro desde la URL de un aporte.
      const extraDelRes = await query(
        'DELETE FROM movimiento_extra WHERE id = $1 AND tenant_id = $2 AND tipo = $3',
        [id, req.tenant_id, tipo]
      );
      if (extraDelRes.rowCount === 0) {
        return res.status(404).json({ error: 'Movimiento no encontrado' });
      }
      console.log('[caja] eliminarMovimiento — movimiento extra eliminado | id:', id, '| tipo:', tipo);

    } else {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    res.json({ ok: true });

  } catch (err) {
    console.error(`[caja] Error en eliminarMovimiento (${tipo}):`, err);
    res.status(500).json({ error: `Error al eliminar ${tipo}` });
  }
};
