// /frontend/src/components/ui/tonosFormaPago.js
// Colores de cada forma de pago: efectivo en success, Mercado Pago en accent.
// Los usan BadgeFormaPago y los grupos de botones de forma de pago
// (GrupoOpciones en Caja y en el modal de completar turno). Los nombres viven
// en utils/formato.js (OPCIONES_FORMA_PAGO); acá solo se decide el color.
// Va aparte de BadgeFormaPago.jsx para que ese archivo exporte solo el
// componente (react-refresh/only-export-components).

import { theme } from '../../theme/tokens.js';
import { OPCIONES_FORMA_PAGO } from '../../utils/formato.js';

/**
 * TONOS_FORMA_PAGO
 * Fondo (`bg`, el *Soft del color) y color de texto/borde (`fg`) por código de
 * forma de pago.
 */
export const TONOS_FORMA_PAGO = {
  efectivo:     { bg: theme.successSoft, fg: theme.success },
  mercado_pago: { bg: theme.accentSoft,  fg: theme.accent  },
};

/**
 * OPCIONES_FORMA_PAGO_TONO
 * Las formas de pago listas para GrupoOpciones: { value, label, tonoBg, tonoFg }.
 */
export const OPCIONES_FORMA_PAGO_TONO = OPCIONES_FORMA_PAGO.map((o) => ({
  ...o,
  tonoBg: TONOS_FORMA_PAGO[o.value].bg,
  tonoFg: TONOS_FORMA_PAGO[o.value].fg,
}));
