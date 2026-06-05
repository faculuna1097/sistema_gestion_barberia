// /frontend-turnero/src/components/ui/Field.jsx
// Input de formulario con label superior, helper opcional y estado invalid.

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * Field
 * Input de texto controlado con label + helper + invalid state.
 * @param {string} props.label - Texto de la label superior (eyebrow uppercase)
 * @param {string} props.value
 * @param {Function} props.onChange - Recibe el string nuevo (no el evento)
 * @param {Function} [props.onBlur]
 * @param {string} [props.placeholder]
 * @param {string} [props.type='text'] - text|email|tel|password|number
 * @param {boolean} [props.invalid=false] - Marca el field con border de error
 * @param {string} [props.helper] - Texto auxiliar bajo el input
 * @param {string} [props.error] - Si está presente, reemplaza al helper en rojo
 */
function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  invalid = false,
  helper,
  error,
}) {
  const [focus, setFocus] = useState(false);

  // Color de border según prioridad: error/invalid > focus > default.
  const borderColor = (invalid || error)
    ? theme.danger
    : (focus ? theme.accent : theme.hairline);

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Label superior en estilo "eyebrow" (uppercase + mono) */}
      <span style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}>{label}</span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); if (onBlur) onBlur(); }}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: theme.surface,
          border: `1px solid ${borderColor}`,
          borderRadius: theme.radius,
          fontFamily: theme.body,
          fontSize: theme.sizeInput,
          color: theme.ink,
          transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
          boxShadow: focus ? `0 0 0 3px ${theme.accent}26` : 'none',
        }}
      />

      {/* Helper o error (uno u otro) */}
      {error ? (
        <span style={{
          fontFamily: theme.body,
          fontSize: 12,
          color: theme.danger,
        }}>{error}</span>
      ) : helper ? (
        <span style={{
          fontFamily: theme.body,
          fontSize: 12,
          color: theme.muted,
        }}>{helper}</span>
      ) : null}
    </label>
  );
}

export default Field;
