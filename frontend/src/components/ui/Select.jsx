// /frontend/src/components/ui/Select.jsx
// Select nativo estilado con tokens. Eyebrow label arriba, focus ring indigo.
// Pareja visual de Field para selects cerrados.

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * Select
 * Select nativo con label eyebrow y estilos consistentes con Field.
 *
 * @param {object} props
 * @param {string} props.label - Texto del label (eyebrow uppercase)
 * @param {string|number} props.value
 * @param {(v: string) => void} props.onChange - Recibe el valor nuevo (no el evento)
 * @param {Array<{value: string|number, label: string}>} props.options
 * @param {boolean} [props.disabled=false]
 */
function Select({ label, value, onChange, options, disabled = false }) {
  const [focus, setFocus] = useState(false);

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}>{label}</span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: disabled ? theme.surfaceAlt : theme.surface,
          border: `1px solid ${focus ? theme.accent : theme.hairline}`,
          borderRadius: theme.radius,
          fontFamily: theme.body,
          fontSize: 15,
          color: disabled ? theme.muted : theme.ink,
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.7 : 1,
          transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
          boxShadow: focus ? `0 0 0 3px ${theme.accent}26` : 'none',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export default Select;
