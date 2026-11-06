// /frontend/src/components/ui/estilos.js
// Estilos compartidos entre primitivos que no son un componente propio.
// Va en un .js aparte para que los .jsx exporten solo componentes
// (react-refresh/only-export-components).

import { theme } from '../../theme/tokens.js';

/**
 * estiloEtiquetaCampo
 * Rótulo de un campo de formulario: mono, sizeMicro, mayúsculas, muted. Lo usan
 * Field, GrupoOpciones y los rótulos sueltos de un formulario (ej. "Precio" en
 * el modal de completar turno), para que todos se vean iguales.
 */
export const estiloEtiquetaCampo = {
  fontFamily: theme.mono,
  fontWeight: theme.weightMedium,
  fontSize: theme.sizeMicro,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.muted,
};
