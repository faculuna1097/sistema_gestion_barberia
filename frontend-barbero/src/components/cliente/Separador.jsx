// /frontend-barbero/src/components/cliente/Separador.jsx
// Línea fina con un texto en el medio ("o cargá el cliente"), entre el botón
// "Sin datos" y el SelectorCliente. Lo usan el wizard y la hoja del atajo.

import { theme } from '../../theme/tokens.js';

/**
 * Separador
 * Dos líneas hairline con un texto corto en el medio.
 * @param {string} props.texto
 * @returns {JSX.Element}
 */
export default function Separador({ texto }) {
  const linea = { flex: 1, height: 1, background: theme.hairline };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={linea} />
      <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>{texto}</span>
      <div style={linea} />
    </div>
  );
}
