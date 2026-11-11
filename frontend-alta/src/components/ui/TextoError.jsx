// /frontend-alta/src/components/ui/TextoError.jsx
// El texto de error de un control que no es un Field (los días, los botones
// de hora, el link): el mismo aspecto que el error de Field (sizeBody, danger)
// y un id para que el control lo apunte con aria-describedby
// (sistema_de_disenio.md §5.2). Primitivo propio de este front.

import { theme } from '../../theme/tokens.js';

/**
 * TextoError
 * @param {string} props.id - Lo referencia el aria-describedby del control
 * @param {ReactNode} props.children - El mensaje (de utils/validaciones.js)
 * @returns {JSX.Element}
 */
function TextoError({ id, children }) {
  return (
    <p id={id} style={{
      fontFamily: theme.body,
      fontSize: theme.sizeBody,
      lineHeight: 1.4,
      color: theme.danger,
      textWrap: 'pretty',
    }}>
      {children}
    </p>
  );
}

export default TextoError;
