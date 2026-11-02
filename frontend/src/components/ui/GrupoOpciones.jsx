// /frontend/src/components/ui/GrupoOpciones.jsx
// Campo de opción única donde cada opción es un botón, en vez de una lista
// desplegable. Lo usan el alta de movimientos de Caja (tipo, dueño, forma de
// pago) y el modal de completar turno de SeccionTurnero (forma de pago).

import { theme } from '../../theme/tokens.js';
import { estiloEtiquetaCampo } from './estilos.js';

/**
 * GrupoOpciones
 * Rótulo + botones de opción única. El botón activo se tinta; con muchas
 * opciones el grupo pasa a varias filas sin desbordar. Touch target de 44 px.
 *
 * @param {object} props
 * @param {string} props.label - Rótulo del grupo (también su nombre accesible)
 * @param {Array<{value: string, label: string, tonoBg?: string, tonoFg?: string}>} props.opciones
 *   `tonoBg` / `tonoFg`: fondo y color de texto/borde del botón activo.
 *   Por defecto `accentSoft` / `accent`. Para las formas de pago, usar
 *   `OPCIONES_FORMA_PAGO_TONO` (tonosFormaPago.js).
 * @param {string|null} props.value - Valor elegido; null si no hay ninguno
 * @param {(value: string) => void} props.onChange - Recibe el value de la opción tocada
 * @returns {JSX.Element}
 */
function GrupoOpciones({ label, opciones, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={estiloEtiquetaCampo}>{label}</span>
      <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {opciones.map((o) => {
          const activo = o.value === value;
          const tonoBg = o.tonoBg ?? theme.accentSoft;
          const tonoFg = o.tonoFg ?? theme.accent;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={activo}
              style={{
                // Base 0 + mínimo max-content: los botones de una fila quedan
                // del mismo ancho mientras entren, y bajan de fila cuando no.
                flex: '1 1 0',
                minWidth: 'max-content',
                maxWidth: '100%',
                minHeight: 44,
                padding: '10px 12px',
                background: activo ? tonoBg : theme.surface,
                border: `1px solid ${activo ? tonoFg : theme.hairline}`,
                borderRadius: theme.radius,
                color: activo ? tonoFg : theme.inkSoft,
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                fontWeight: activo ? theme.weightHeading : theme.weightMedium,
                overflowWrap: 'anywhere',
                cursor: 'pointer',
                transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}, color ${theme.transitionFast}`,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default GrupoOpciones;
