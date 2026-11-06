// /backend/src/controllers/gastos.js
import { query } from '../config/db.js';
import { esMontoValido, mensajeMontoInvalido } from '../utils/validarNumero.js';
import { esFormaPagoValida } from '../utils/validarPago.js';
import { esUUID } from '../utils/validarUuid.js';
import { TZ, MAX_DESCRIPCION_GASTO } from '../utils/constantes.js';
import { categoriaEnTenant } from '../services/categoriasService.js';
import { eliminarGasto } from '../services/movimientosService.js';

/**
 * POST /api/gastos
 * Registra un gasto. Roles: operativo (iPad) o admin (panel).
 * @param {string} req.body.categoria_id - UUID de una categoría de gasto del tenant
 * @param {string} req.body.descripcion - Hasta MAX_DESCRIPCION_GASTO caracteres
 * @param {number} req.body.monto - Monto, >= 0
 * @param {string} req.body.forma_pago - 'efectivo' o 'mercado_pago'
 * @returns {JSON} 201 con la fila creada; 400 si falta un campo o no es válido;
 *   404 si la categoría no es del tenant
 */
export const createGasto = async (req, res) => {
  const { categoria_id, descripcion, monto, forma_pago } = req.body;

  if (!categoria_id || !descripcion || !forma_pago) {
    return res.status(400).json({ error: 'Faltan campos requeridos: categoria_id, descripcion, monto, forma_pago' });
  }
  if (typeof descripcion !== 'string' || descripcion.length > MAX_DESCRIPCION_GASTO) {
    return res.status(400).json({ error: `descripcion debe ser un texto de hasta ${MAX_DESCRIPCION_GASTO} caracteres` });
  }
  if (!esMontoValido(monto)) {
    return res.status(400).json({ error: mensajeMontoInvalido('monto') });
  }
  if (!esFormaPagoValida(forma_pago)) {
    return res.status(400).json({ error: "forma_pago debe ser 'efectivo' o 'mercado_pago'" });
  }

  try {
    // Única validación que consulta la base: va después de las que solo miran el
    // body. El FK compuesto (tenant_id, categoria_id) rechazaría igual una
    // categoría de otro tenant, pero con un 500; esto la convierte en un 404.
    if (!(await categoriaEnTenant(categoria_id, req.tenant_id))) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const resultado = await query(
      `INSERT INTO gasto (tenant_id, categoria_id, descripcion, monto, forma_pago)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.tenant_id, categoria_id, descripcion, monto, forma_pago]
    );

    // monto como número: pg entrega el NUMERIC como string (convención §4).
    const gastoCreado = { ...resultado.rows[0], monto: Number(resultado.rows[0].monto) };
    console.log('[gastos] createGasto completado | gasto_id:', gastoCreado.id);
    return res.status(201).json(gastoCreado);

  } catch (err) {
    console.error('[gastos] Error en createGasto:', err);
    return res.status(500).json({ error: 'Error interno al registrar el gasto' });
  }
};

/**
 * GET /api/gastos/mensual
 * Gastos de un mes, del más reciente al más viejo, con los totales por categoría
 * y el total general. Los gastos sin categoría salen como 'Sin categoría'. Rol: admin.
 * @param {string} [req.query.mes] - Mes 'YYYY-MM'; por defecto, el actual en hora argentina
 * @returns {JSON} { gastos, totalesPorCategoria, totalGeneral }; 400 si `mes` no tiene el formato
 */
export const getGastosMensual = async (req, res) => {
  const mes = req.query.mes || new Date().toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "El parámetro 'mes' debe tener formato YYYY-MM" });
  }

  try {
    const [resultadoGastos, resultadoTotales] = await Promise.all([
      query(
        `SELECT
           g.id,
           g.categoria_id,
           TO_CHAR(g.timestamp AT TIME ZONE $3, 'DD/MM/YYYY') AS fecha,
           TO_CHAR(g.timestamp AT TIME ZONE $3, 'HH24:MI')    AS hora,
           COALESCE(cg.nombre, 'Sin categoría') AS categoria_nombre,
           g.descripcion,
           g.monto,
           g.forma_pago
         FROM gasto g
         LEFT JOIN categoria_gasto cg ON g.categoria_id = cg.id
         WHERE g.tenant_id = $1
           AND TO_CHAR(g.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
         ORDER BY g.timestamp DESC`,
        [req.tenant_id, mes, TZ]
      ),
      query(
        `SELECT
           COALESCE(cg.nombre, 'Sin categoría') AS categoria_nombre,
           SUM(g.monto)                          AS total,
           COUNT(g.id)                           AS cantidad
         FROM gasto g
         LEFT JOIN categoria_gasto cg ON g.categoria_id = cg.id
         WHERE g.tenant_id = $1
           AND TO_CHAR(g.timestamp AT TIME ZONE $3, 'YYYY-MM') = $2
         GROUP BY cg.nombre
         ORDER BY total DESC`,
        [req.tenant_id, mes, TZ]
      ),
    ]);

    // Montos como número: pg entrega el NUMERIC como string (convención §4).
    const gastos = resultadoGastos.rows.map((g) => ({ ...g, monto: Number(g.monto) }));
    const totalesPorCategoria = resultadoTotales.rows.map((t) => ({ ...t, total: Number(t.total) }));
    const totalGeneral = totalesPorCategoria.reduce((acc, t) => acc + t.total, 0);

    return res.status(200).json({ gastos, totalesPorCategoria, totalGeneral });

  } catch (err) {
    console.error('[gastos] Error en getGastosMensual:', err);
    return res.status(500).json({ error: 'Error interno al obtener los gastos del mes' });
  }
};

/**
 * DELETE /api/gastos/:id
 * Borra un gasto del tenant. Rol: admin.
 * @param {string} req.params.id - UUID del gasto
 * @returns {JSON} { eliminado: true, id }; 404 si el gasto no existe en el tenant o
 *   el id está mal formado
 */
export const deleteGasto = async (req, res) => {
  const { id } = req.params;

  if (!esUUID(id)) {
    return res.status(404).json({ error: 'Gasto no encontrado' });
  }

  try {
    if (!(await eliminarGasto(id, req.tenant_id))) {
      console.warn('[gastos] deleteGasto — gasto no encontrado | id:', id);
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    console.log('[gastos] deleteGasto completado | gasto_id:', id);
    return res.status(200).json({ eliminado: true, id });

  } catch (err) {
    console.error('[gastos] Error en deleteGasto:', err);
    return res.status(500).json({ error: 'Error interno al eliminar el gasto' });
  }
};

/**
 * PUT /api/gastos/:id
 * Edita la categoría, la descripción, el monto y la forma de pago de un gasto. Rol: admin.
 * @param {string} req.params.id - UUID del gasto
 * @param {string} req.body.categoria_id - UUID de una categoría de gasto del tenant
 *   (puede estar inactiva: un gasto viejo se tiene que poder editar)
 * @param {string} req.body.descripcion - Hasta MAX_DESCRIPCION_GASTO caracteres
 * @param {number} req.body.monto - Monto, >= 0
 * @param {string} req.body.forma_pago - 'efectivo' o 'mercado_pago'
 * @returns {JSON} { id, categoria_id, descripcion, monto, forma_pago }; 400 si falta un
 *   campo o no es válido; 404 si el gasto no existe en el tenant, el id está mal
 *   formado o la categoría no es del tenant
 */
export const updateGasto = async (req, res) => {
  const { id } = req.params;

  if (!esUUID(id)) {
    return res.status(404).json({ error: 'Gasto no encontrado' });
  }

  const { categoria_id, descripcion, monto, forma_pago } = req.body;

  if (!categoria_id || !descripcion || !forma_pago) {
    return res.status(400).json({
      error: 'Faltan campos requeridos: categoria_id, descripcion, monto, forma_pago'
    });
  }
  if (typeof descripcion !== 'string' || descripcion.length > MAX_DESCRIPCION_GASTO) {
    return res.status(400).json({ error: `descripcion debe ser un texto de hasta ${MAX_DESCRIPCION_GASTO} caracteres` });
  }
  if (!esMontoValido(monto)) {
    return res.status(400).json({ error: mensajeMontoInvalido('monto') });
  }
  if (!esFormaPagoValida(forma_pago)) {
    return res.status(400).json({ error: "forma_pago debe ser 'efectivo' o 'mercado_pago'" });
  }

  try {
    if (!(await categoriaEnTenant(categoria_id, req.tenant_id))) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const resultado = await query(
      `UPDATE gasto
       SET categoria_id = $1, descripcion = $2, monto = $3, forma_pago = $4
       WHERE id = $5 AND tenant_id = $6
       RETURNING id, categoria_id, descripcion, monto, forma_pago`,
      [categoria_id, descripcion, monto, forma_pago, id, req.tenant_id]
    );

    if (resultado.rows.length === 0) {
      console.warn('[gastos] updateGasto — gasto no encontrado | id:', id);
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    console.log('[gastos] updateGasto completado | gasto_id:', id);
    // monto como número, igual que createGasto (convenciones §4).
    return res.status(200).json({ ...resultado.rows[0], monto: Number(resultado.rows[0].monto) });

  } catch (err) {
    console.error('[gastos] Error en updateGasto:', err);
    return res.status(500).json({ error: 'Error interno al editar el gasto' });
  }
};