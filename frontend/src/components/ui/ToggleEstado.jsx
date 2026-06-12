// /frontend/src/components/ui/ToggleEstado.jsx
// Par de chips clickables Activo / Inactivo para usar dentro de un form modal.
// Promovido desde TabServicios al aparecer el segundo uso en TabProductos
// (regla §7.1 del sistema de diseño). Próximos usos esperados: TabBarberos.
//
// Layout: label "Estado" a la izquierda + chips al extremo derecho del row
// (justifyContent: space-between). Para integrar dentro de un Field-like
// stack vertical, envolver afuera.

import { theme } from '../../theme/tokens.js';

const OPCIONES = [
  { v: true,  label: 'Activo' },
  { v: false, label: 'Inactivo' },
];

/**
 * ToggleEstado
 * Selector binario activo / inactivo con par de chips. Diseñado para usar
 * dentro de un modal de edición — comparte el lenguaje visual de ChipFiltro
 * pero la semántica es selección de estado, no filtro.
 *
 * @param {object} props
 * @param {boolean} props.value
 * @param {(v: boolean) => void} props.onChange
 * @param {string} [props.label='Estado'] - Texto del eyebrow a la izquierda.
 */
function ToggleEstado({ value, onChange, label = 'Estado' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <span style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}>{label}</span>

      <div style={{ display: 'flex', gap: 6 }}>
        {OPCIONES.map((op) => {
          const activo = value === op.v;
          return (
            <button
              key={String(op.v)}
              type="button"
              onClick={() => onChange(op.v)}
              aria-pressed={activo}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: `1px solid ${activo ? theme.accent : theme.hairline}`,
                background: activo ? theme.accentSoft : 'transparent',
                color: activo ? theme.accent : theme.inkSoft,
                fontFamily: theme.body,
                fontSize: theme.sizeBody,
                fontWeight: activo ? theme.weightHeading : theme.weightMedium,
                cursor: 'pointer',
                transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}, color ${theme.transitionFast}`,
              }}
            >
              {op.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ToggleEstado;
