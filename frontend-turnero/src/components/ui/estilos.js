// /frontend-turnero/src/components/ui/estilos.js
// Estilos compartidos entre primitivos y pantallas que no son un componente
// propio. Va en un .js aparte para que los .jsx exporten solo componentes
// (react-refresh/only-export-components). Mismo criterio que el
// `estiloEtiquetaCampo` del panel.

import { theme } from '../../theme/tokens.js';

/**
 * estiloEyebrow
 * Rótulo chico en mono y mayúsculas, en `muted`: las etiquetas de los campos,
 * el eyebrow de ScreenHeader, los encabezados de la grilla de días, el rótulo
 * "Barbero" de "¿Cuándo?", la duración de un servicio, la fecha de la gestión
 * del turno y el rótulo de SummaryRow. Cada lugar suma lo suyo (márgenes,
 * alineación) con un spread: `{ ...estiloEyebrow, marginBottom: 8 }`.
 */
export const estiloEyebrow = {
  fontFamily: theme.mono,
  fontWeight: theme.weightMedium,
  fontSize: theme.sizeMicro,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.muted,
};

/**
 * MARGEN_SCROLL_CAMPO
 * `scroll-margin-bottom` del input de un campo (Field, CampoTelefono): cuando
 * el navegador lo trae a la vista al enfocarlo (Tab, el "siguiente" del
 * teclado), deja visible también lo que va debajo: el espacio de 6 px y la
 * ayuda o el error, de hasta dos renglones de 14 px × 1,4. El pie fijo ya se
 * descuenta aparte (StickyFooter → scroll-padding-bottom).
 */
export const MARGEN_SCROLL_CAMPO = 46;
