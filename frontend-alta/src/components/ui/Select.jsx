// /frontend-alta/src/components/ui/Select.jsx
// Select nativo con el aspecto de Field: rótulo arriba, borde, foco indigo y
// error debajo.
// Copia del primitivo del panel (frontend/src/components/ui/Select.jsx), mismo
// aspecto. Suma lo que el panel no tiene y este formulario exige
// (sistema_de_disenio.md §5.2 y §8, divergencia de API permitida):
//   - label con htmlFor, aria-invalid y aria-describedby (useId), y el error en texto;
//   - una opción vacía para "todavía no se eligió" (`placeholder`);
//   - letra en sizeInput (16): con 15 px Safari hace zoom al enfocarlo en el iPhone;
//   - la flecha propia (Lucide), porque `appearance: none` saca la del navegador;
//   - `ref`, `name` y `autoComplete`.

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { estiloEtiquetaCampo, MARGEN_SCROLL_CAMPO } from './estilos.js';

/**
 * Select
 * @param {string} props.label - Rótulo (eyebrow en mayúsculas)
 * @param {string} props.value - '' si todavía no se eligió
 * @param {Function} props.onChange - Recibe el valor nuevo (no el evento)
 * @param {Array<{valor: string, etiqueta: string}>} props.opciones
 * @param {string} [props.placeholder] - Texto de la opción vacía (no se puede volver a elegir)
 * @param {Function} [props.onBlur]
 * @param {string} [props.error] - Mensaje de error debajo
 * @param {string} [props.name]
 * @param {string} [props.autoComplete]
 * @param {Object} [props.ref] - Ref al <select>; React 19 lo pasa como prop
 * @returns {JSX.Element}
 */
function Select({ label, value, onChange, opciones, placeholder, onBlur, error, name, autoComplete, ref }) {
  const [focus, setFocus] = useState(false);
  const selectId = useId();
  const errorId = useId();

  let borde = theme.hairline;
  if (focus) borde = theme.accent;
  if (error) borde = theme.danger;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={selectId} style={estiloEtiquetaCampo}>{label}</label>

      <div style={{ position: 'relative' }}>
        <select
          ref={ref}
          id={selectId}
          name={name}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => { setFocus(false); if (onBlur) onBlur(); }}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          style={{
            width: '100%',
            minHeight: 48,
            padding: '12px 40px 12px 14px',
            appearance: 'none',
            WebkitAppearance: 'none',
            background: theme.surface,
            border: `1px solid ${borde}`,
            borderRadius: theme.radius,
            fontFamily: theme.body,
            fontSize: theme.sizeInput,
            // Sin elegir, el texto de la opción vacía va en gris, como un placeholder.
            color: value ? theme.ink : theme.muted,
            cursor: 'pointer',
            outline: 'none',
            transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
            boxShadow: focus ? `0 0 0 3px ${theme.accent}26` : 'none',
            scrollMarginBottom: MARGEN_SCROLL_CAMPO,
          }}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor} style={{ color: theme.ink }}>{o.etiqueta}</option>
          ))}
        </select>
        <ChevronDown
          size={20}
          strokeWidth={1.75}
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: theme.muted,
            pointerEvents: 'none',
          }}
        />
      </div>

      {error && (
        <span id={errorId} style={{ fontFamily: theme.body, fontSize: theme.sizeBody, lineHeight: 1.4, color: theme.danger }}>
          {error}
        </span>
      )}
    </div>
  );
}

export default Select;
