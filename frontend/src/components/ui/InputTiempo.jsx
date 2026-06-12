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
 * Modo etiquetado: si se pasa `label`, el input se auto-envuelve en un
 * `<label>` con eyebrow mono (espejo de `Field`), asociación implícita →
 * no hace falta `ariaLabel` (la label visible da el nombre accesible). Sin
 * `label`, renderiza el input pelado y `ariaLabel` es obligatorio. Esto pliega
 * el wrapper "eyebrow + InputTiempo" que vivía duplicado en TabBarberos
 * (sub-componente `CampoTiempo`) y BloqueFeriados (inline) — deuda #41.
 *
 * @param {object} props
 * @param {'time'|'datetime-local'|'date'} props.type - Tipo de input nativo
 * @param {string} props.value - Valor controlado (formato según `type`)
 * @param {(v: string) => void} props.onChange - Recibe el string nuevo (no el evento)
 * @param {string} [props.label] - Si está, el input se etiqueta con eyebrow superior (modo Field)
 * @param {string} [props.ariaLabel] - Etiqueta accesible. Obligatoria solo en modo pelado (sin `label`)
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
  label,
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

  const input = (
    <input
      type={type}
      value={value}
      aria-label={label ? undefined : ariaLabel}
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

  // Modo pelado: sin label, el caller provee su propia etiqueta vía ariaLabel.
  if (!label) return input;

  // Modo etiquetado: eyebrow superior idéntico al de Field; el <label> envuelve
  // al input (asociación implícita) → sin aria-label para no pisar el nombre visible.
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
      {input}
    </label>
  );
}

export default InputTiempo;
