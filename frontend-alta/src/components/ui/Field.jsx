// /frontend-alta/src/components/ui/Field.jsx
// Input de formulario con label superior, helper opcional y estado invalid.
// Copia del primitivo del panel (frontend/src/components/ui/Field.jsx), mismo
// aspecto. Suma lo que el panel no tiene y este formulario exige
// (plan_alta_clientes.md §5.4, sistema_de_disenio.md §5.2), igual que el Field
// del turnero:
//   - label asociada con htmlFor, aria-invalid y aria-describedby (useId);
//   - `ref`, `name` e `id`, para llevar el foco al campo del primer error;
//   - scroll-margin-bottom, para que al enfocarlo también se vea el error;
//   - `onKeyDown` (Enter avanza de pantalla) y `autoFocus` (fase 3).

import { useId, useState } from 'react';
import { theme } from '../../theme/tokens.js';
import { estiloEtiquetaCampo, MARGEN_SCROLL_CAMPO } from './estilos.js';

/**
 * Field
 * Input de texto controlado con label + helper + invalid state.
 * Con error, el input lleva `aria-invalid` y `aria-describedby` apunta al texto
 * del error (si no, al del helper), así el lector de pantalla lo lee al entrar.
 * @param {string} props.label - Texto de la label superior (eyebrow uppercase)
 * @param {string} props.value
 * @param {Function} props.onChange - Recibe el string nuevo (no el evento)
 * @param {Function} [props.onBlur]
 * @param {string} [props.placeholder]
 * @param {string} [props.type='text'] - text|email|tel|password|number
 * @param {string} [props.id] - id del <input>; si no viene, se genera uno
 * @param {string} [props.name] - name del <input> (ayuda al autocompletado del navegador)
 * @param {boolean} [props.invalid=false] - Marca el field con border de error
 * @param {string} [props.helper] - Texto auxiliar bajo el input
 * @param {string} [props.error] - Si está presente, reemplaza al helper en rojo
 * @param {boolean} [props.disabled=false] - Deshabilita el input
 * @param {string} [props.autoComplete] - Hint para password managers / autofill
 * @param {string} [props.autoCapitalize] - Hint de capitalización (mobile keyboards)
 * @param {string} [props.autoCorrect] - 'on'|'off' (Safari)
 * @param {boolean} [props.spellCheck] - Habilita / deshabilita corrector ortográfico
 * @param {string} [props.inputMode] - Hint de teclado virtual: 'numeric'|'decimal'|'tel'|'email'|etc.
 * @param {string} [props.enterKeyHint] - Tecla Enter del teclado virtual: 'next'|'done'|etc.
 * @param {number} [props.maxLength] - Tope de caracteres; sin él, no hay tope
 * @param {Function} [props.onKeyDown] - Recibe el evento de teclado (ej. Enter para seguir)
 * @param {boolean} [props.autoFocus=false] - Enfoca el input al montarse
 * @param {Object} [props.ref] - Ref al <input>; React 19 lo pasa como prop
 * @returns {JSX.Element}
 */
function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  id,
  name,
  invalid = false,
  helper,
  error,
  disabled = false,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  inputMode,
  enterKeyHint,
  maxLength,
  onKeyDown,
  autoFocus = false,
  ref,
}) {
  const [focus, setFocus] = useState(false);

  // Ids para asociar label, input y texto de abajo.
  const idGenerado = useId();
  const inputId = id ?? idGenerado;
  const textoId = useId();
  const conError = Boolean(invalid || error);
  const texto = error || helper;

  const borderColor = conError
    ? theme.danger
    : (focus ? theme.accent : theme.hairline);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={inputId} style={estiloEtiquetaCampo}>{label}</label>

      <input
        ref={ref}
        id={inputId}
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        maxLength={maxLength}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); if (onBlur) onBlur(); }}
        aria-invalid={conError ? 'true' : undefined}
        aria-describedby={texto ? textoId : undefined}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: disabled ? theme.surfaceAlt : theme.surface,
          border: `1px solid ${borderColor}`,
          borderRadius: theme.radius,
          fontFamily: theme.body,
          // sizeInput (16): con menos, Safari hace zoom al enfocar en el iPhone.
          fontSize: theme.sizeInput,
          color: disabled ? theme.muted : theme.ink,
          opacity: disabled ? 0.7 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
          transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
          boxShadow: focus ? `0 0 0 3px ${theme.accent}26` : 'none',
          scrollMarginBottom: MARGEN_SCROLL_CAMPO,
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
