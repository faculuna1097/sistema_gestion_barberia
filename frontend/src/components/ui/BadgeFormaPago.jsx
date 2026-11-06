// /frontend/src/components/ui/BadgeFormaPago.jsx
// Pill que indica la forma de pago de un movimiento (efectivo / mercado pago).
//
// Variante de diseño: solo texto, sin íconos. El contexto en la tabla
// (columna "Forma de pago") ya comunica la categoría, sumar íconos satura.
// Pendiente: si aparece un caso fuera de tabla donde el badge sale aislado,
// evaluar volver a la variante con íconos (billete Lucide para efectivo,
// logo MP real para Mercado Pago).
//
// Forma desconocida: en vez de caer silenciosamente a "Mercado Pago" como
// antes (bug que ocultaba datos malformados), se renderiza el valor crudo
// con estilos neutros — el dueño ve que algo está raro.
//
// El nombre sale de formatPago (utils/formato.js) y el color de
// tonosFormaPago.js: este archivo solo arma la pill.

import { theme } from '../../theme/tokens.js';
import { formatPago } from '../../utils/formato.js';
import { TONOS_FORMA_PAGO } from './tonosFormaPago.js';

const estiloBase = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: theme.radiusSm,
  fontFamily: theme.body,
  fontSize: theme.sizeMicro,
  fontWeight: theme.weightMedium,
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
};

/**
 * BadgeFormaPago
 * @param {object} props
 * @param {'efectivo'|'mercado_pago'|string} props.forma - Código de forma de pago.
 */
export default function BadgeFormaPago({ forma }) {
  // Neutra con neutralSoft (no surfaceAlt, que es el hover de las filas).
  const tono = TONOS_FORMA_PAGO[forma] ?? { bg: theme.neutralSoft, fg: theme.inkSoft };
  return (
    <span style={{ ...estiloBase, background: tono.bg, color: tono.fg }}>
      {formatPago(forma)}
    </span>
  );
}
