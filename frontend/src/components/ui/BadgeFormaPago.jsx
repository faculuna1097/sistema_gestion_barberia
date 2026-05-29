// /frontend/src/components/BadgeFormaPago.jsx
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

import { theme } from '../../theme/tokens.js';

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

const variantes = {
  efectivo:     { background: theme.successSoft, color: theme.success, label: 'Efectivo' },
  mercado_pago: { background: theme.accentSoft,  color: theme.accent,  label: 'Mercado Pago' },
};

/**
 * BadgeFormaPago
 * @param {object} props
 * @param {'efectivo'|'mercado_pago'|string} props.forma - Código de forma de pago.
 */
export default function BadgeFormaPago({ forma }) {
  const variante = variantes[forma] ?? {
    background: theme.surfaceAlt,
    color: theme.muted,
    label: forma || '—',
  };
  return (
    <span style={{ ...estiloBase, background: variante.background, color: variante.color }}>
      {variante.label}
    </span>
  );
}
