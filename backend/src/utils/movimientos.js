// /backend/src/utils/movimientos.js
// Semántica central de los movimientos de plata. Es la ÚNICA fuente del backend
// que decide si un movimiento entra o sale y si afecta el resultado del negocio:
// ningún otro archivo compara contra nombres de tipo, todos consultan este mapa
// o sus helpers. Ver docs/plan_movimientos_extra.md §5.

// Tipos de la tabla movimiento_extra (espeja su CHECK de `tipo`).
//   sentido:         'entrada' | 'salida' — hacia dónde se mueve la plata.
//   afectaResultado: true si cuenta para la ganancia (Balance neto); false si es
//                    un movimiento de capital (plata de o para los dueños).
//   requiereSocio:   true si el movimiento se carga contra un socio; false si
//                    lleva descripción escrita en su lugar.
export const TIPOS_MOVIMIENTO_EXTRA = {
  aporte_capital: { sentido: 'entrada', afectaResultado: false, requiereSocio: true  },
  retiro_socio:   { sentido: 'salida',  afectaResultado: false, requiereSocio: true  },
  otro_ingreso:   { sentido: 'entrada', afectaResultado: true,  requiereSocio: false },
};

// Largo máximo de la descripción escrita de un movimiento extra.
export const MAX_DESCRIPCION_MOVIMIENTO = 200;

// Sentido de los movimientos que nacen en sus propias tablas (corte, venta, gasto).
const SENTIDO_MOVIMIENTOS_BASE = {
  corte: 'entrada',
  venta: 'entrada',
  gasto: 'salida',
};

/**
 * esTipoMovimientoExtra
 * Indica si un valor es uno de los tipos de movimiento_extra.
 * Usa Object.hasOwn y no `in`: `'toString' in {}` da true (propiedad heredada).
 * @param {*} valor - Valor recibido del body o de la URL.
 * @returns {boolean} true si es string y es clave propia de TIPOS_MOVIMIENTO_EXTRA.
 */
export function esTipoMovimientoExtra(valor) {
  return typeof valor === 'string' && Object.hasOwn(TIPOS_MOVIMIENTO_EXTRA, valor);
}

/**
 * sentidoDeMovimiento
 * Resuelve si un movimiento es entrada o salida de plata. Cubre los tipos base
 * (corte, venta, gasto) y los tres de movimiento_extra.
 * @param {string} tipo - Tipo del movimiento.
 * @returns {'entrada'|'salida'} Sentido del movimiento.
 * @throws {Error} Si el tipo no es conocido: es un bug, no un caso de negocio.
 */
export function sentidoDeMovimiento(tipo) {
  if (typeof tipo === 'string' && Object.hasOwn(SENTIDO_MOVIMIENTOS_BASE, tipo)) {
    return SENTIDO_MOVIMIENTOS_BASE[tipo];
  }
  if (esTipoMovimientoExtra(tipo)) {
    return TIPOS_MOVIMIENTO_EXTRA[tipo].sentido;
  }
  throw new Error(`[movimientos] sentidoDeMovimiento — tipo de movimiento desconocido: ${tipo}`);
}

/**
 * resumirMovimientosExtra
 * Reduce totales por tipo de movimiento_extra a los tres números que usa
 * Balances. La clasificación sale del mapa, no del nombre del tipo:
 *   - afectaResultado → suma a otrosIngresos (con signo según sentido);
 *   - si no, entrada → aportes y salida → retiros.
 * Acepta varias filas del mismo tipo (las acumula).
 * @param {Array<{tipo: string, total: number|string}>} filas - Totales por tipo;
 *   `total` puede venir como string numérico (NUMERIC de pg).
 * @returns {{otrosIngresos: number, aportes: number, retiros: number}} Totales en números.
 * @throws {Error} Si una fila trae un tipo que no es de movimiento_extra.
 */
export function resumirMovimientosExtra(filas) {
  const resumen = { otrosIngresos: 0, aportes: 0, retiros: 0 };

  for (const { tipo, total } of filas) {
    if (!esTipoMovimientoExtra(tipo)) {
      throw new Error(`[movimientos] resumirMovimientosExtra — tipo de movimiento desconocido: ${tipo}`);
    }
    const { sentido, afectaResultado } = TIPOS_MOVIMIENTO_EXTRA[tipo];
    const monto = Number(total);

    if (afectaResultado) {
      resumen.otrosIngresos += sentido === 'entrada' ? monto : -monto;
    } else if (sentido === 'entrada') {
      resumen.aportes += monto;
    } else {
      resumen.retiros += monto;
    }
  }

  return resumen;
}
