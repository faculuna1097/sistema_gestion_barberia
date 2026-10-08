// /frontend-turnero/src/components/ui/Field.jsx
// Input de formulario con label superior, helper opcional y estado invalid.

import { useId, useState } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * Field
 * Input de texto controlado con label + helper + invalid state.
 * Accesibilidad (sistema de diseño §5.2): la label va asociada al input por
 * `htmlFor`; con error, el input lleva `aria-invalid` y `aria-describedby`
 * apunta al texto del error (si no, al del helper), así el lector de pantalla
 * lo lee al entrar al campo.
 * @param {string} props.label - Texto de la label superior (eyebrow uppercase)
 * @param {string} props.value
 * @param {Function} props.onChange - Recibe el string nuevo (no el evento)
 * @param {Function} [props.onBlur]
 * @param {string} [props.placeholder]
 * @param {string} [props.type='text'] - text|email|tel|password|number
 * @param {string} [props.name] - name del <input> (ayuda al autocompletado del navegador)
 * @param {string} [props.autoComplete] - Token de autocompletado HTML (ej. 'name', 'email', 'tel')
 * @param {string} [props.inputMode] - Teclado virtual sugerido (ej. 'tel', 'email', 'numeric')
 * @param {boolean} [props.invalid=false] - Marca el field con border de error
 * @param {string} [props.helper] - Texto auxiliar bajo el input
 * @param {string} [props.error] - Si está presente, reemplaza al helper en rojo
 * @param {Object} [props.ref] - Ref al <input> (ej. para enfocarlo); React 19 lo pasa como prop
 */
function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  name,
  autoComplete,
  inputMode,
  invalid = false,
  helper,
  error,
  ref,
}) {
  const [focus, setFocus] = useState(false);

  // Ids para asociar label, input y texto de abajo.
  const inputId = useId();
  const textoId = useId();
  const conError = Boolean(invalid || error);
  const texto = error || helper;

  // Color de border según prioridad: error/invalid > focus > default.
  const borderColor = conError
    ? theme.danger
    : (focus ? theme.accent : theme.hairline);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Label superior en estilo "eyebrow" (uppercase + mono) */}
      <label htmlFor={inputId} style={{
        fontFamily: theme.mono,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeMicro,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}>{label}</label>

      <input
        ref={ref}
        id={inputId}
        type={type}
        name={name}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); if (onBlur) onBlur(); }}
        aria-invalid={conError ? 'true' : undefined}
        aria-describedby={texto ? textoId : undefined}
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

      {/* Helper o error (uno u otro): el error es texto, no solo el borde rojo */}
      {texto && (
        <span id={textoId} style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          lineHeight: 1.4,
          color: error ? theme.danger : theme.muted,
        }}>{texto}</span>
      )}
    </div>
  );
}

export default Field;
