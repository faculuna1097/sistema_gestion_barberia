// /frontend/src/components/ui/InputTiempo.jsx
// Input nativo de tiempo/fecha estilado para igualar a Field (border hairline,
// focus ring indigo). Field no cubre los types nativos time/date/datetime-local
// (que abren pickers propios del navegador). Promovido desde TabBarberos al
// aparecer el 2do uso real en BloqueHorarioAtencion (§7.1, deuda #37).

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * InputTiempo
 * Input nativo (type="time" | "datetime-local" | "date") estilado como Field.
 * El picker lo aporta el navegador; este primitivo solo unifica la apariencia.
 *
 * @param {object} props
 * @param {'time'|'datetime-local'|'date'} props.type - Tipo de input nativo
 * @param {string} props.value - Valor controlado (formato según `type`)
 * @param {(v: string) => void} props.onChange - Recibe el string nuevo (no el evento)
 * @param {string} props.ariaLabel - Etiqueta accesible obligatoria
 * @param {boolean} [props.invalid=false] - Marca el input con border de error
 * @param {boolean} [props.full=false] - Si ocupa el 100% del ancho del padre
 * @param {string} [props.min] - Cota mínima nativa (ej. 'YYYY-MM-DD' para date)
 * @param {string} [props.max] - Cota máxima nativa
 * @param {string} [props.step] - Paso del picker (ej. '1800' = 30 min para time)
 * @param {boolean} [props.disabled=false]
 * @returns {JSX.Element}
 */
function InputTiempo({
  type,
  value,
  onChange,
  ariaLabel,
  invalid = false,
  full = false,
  min,
  max,
  step,
  disabled = false,
}) {
  const [focus, setFocus] = useState(false);
  const borderColor = invalid ? theme.danger : (focus ? theme.accent : theme.hairline);

  return (
    <input
      type={type}
      value={value}
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: full ? '100%' : 'auto',
        padding: '10px 12px',
        background: disabled ? theme.surfaceAlt : theme.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: theme.radius,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        color: disabled ? theme.muted : theme.ink,
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? 'not-allowed' : 'text',
        outline: 'none',
        transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
        boxShadow: focus ? `0 0 0 3px ${theme.accent}26` : 'none',
      }}
    />
  );
}

export default InputTiempo;
