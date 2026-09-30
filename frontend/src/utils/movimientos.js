// /frontend/src/utils/movimientos.js
// Catálogo de tipos de movimiento de plata para el front. Lo usan Caja
// (etiqueta de la tabla, Excel y formulario de alta) y Balances.
//
// El front NO decide si un movimiento suma o resta: eso llega resuelto desde el
// backend en el campo `sentido` de cada fila. Acá solo viven los textos y qué
// campo pide cada tipo en el formulario.
//
// `requiereSocio` y MAX_DESCRIPCION_MOVIMIENTO espejan a
// backend/src/utils/movimientos.js: si cambian allá, cambian acá.
// Ver docs/plan_movimientos_extra.md §5.

// Label corto de cada tipo de movimiento (etiqueta de la tabla y Excel).
const LABELS_TIPO_MOVIMIENTO = {
  corte:          'Corte',
  venta:          'Venta',
  gasto:          'Gasto',
  retiro_socio:   'Retiro',
  aporte_capital: 'Aporte',
  otro_ingreso:   'Otro ingreso',
};

/**
 * labelTipoMovimiento
 * Devuelve el label corto de un tipo de movimiento.
 * @param {string} tipo - Tipo de movimiento ('corte', 'retiro_socio', etc.).
 * @returns {string} Label legible; si el tipo no se conoce, el valor crudo
 *   (así un dato inesperado queda a la vista en vez de disfrazarse de otro tipo).
 */
export function labelTipoMovimiento(tipo) {
  return LABELS_TIPO_MOVIMIENTO[tipo] ?? tipo;
}

// Tipos que se cargan desde el formulario "Registrar movimiento", en el orden
// en que se muestran.
//   requiereSocio: true → el formulario pide el dueño; false → pide descripción.
export const OPCIONES_TIPO_MOVIMIENTO_EXTRA = [
  { value: 'retiro_socio',   label: 'Retiro',            requiereSocio: true  },
  { value: 'aporte_capital', label: 'Aporte de capital', requiereSocio: true  },
  { value: 'otro_ingreso',   label: 'Otro ingreso',      requiereSocio: false },
];

// Largo máximo de la descripción escrita de un movimiento extra.
export const MAX_DESCRIPCION_MOVIMIENTO = 200;
