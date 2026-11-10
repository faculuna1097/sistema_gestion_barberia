// /frontend-alta/src/components/ui/estilos.js
// Estilos compartidos entre primitivos que no son un componente propio.
// Va en un .js aparte para que los .jsx exporten solo componentes
// (react-refresh/only-export-components).
// Copia de frontend/src/components/ui/estilos.js (estiloEtiquetaCampo), más
// MARGEN_SCROLL_CAMPO del turnero (frontend-turnero/src/components/ui/estilos.js).

import { theme } from '../../theme/tokens.js';

/**
 * estiloEtiquetaCampo
 * Rótulo de un campo de formulario: mono, sizeMicro, mayúsculas, muted. Lo usan
 * Field y los rótulos sueltos de un formulario, para que todos se vean iguales.
 */
export const estiloEtiquetaCampo = {
  fontFamily: theme.mono,
  fontWeight: theme.weightMedium,
  fontSize: theme.sizeMicro,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.muted,
};

/**
 * estiloSoloLector
 * Texto que no se ve pero lee el lector de pantalla (el patrón "visually
 * hidden"): ej. "capítulo 2 de 4" junto al nombre del capítulo.
 */
export const estiloSoloLector = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * MARGEN_SCROLL_CAMPO
 * `scroll-margin-bottom` del input de un campo: cuando el navegador lo trae a la
 * vista al enfocarlo (Tab, el "siguiente" del teclado), deja visible también lo
 * que va debajo: el espacio de 6 px y la ayuda o el error, de hasta dos
 * renglones de 14 px × 1,4. El pie fijo ya se descuenta aparte
 * (StickyFooter → scroll-padding-bottom).
 */
export const MARGEN_SCROLL_CAMPO = 46;
