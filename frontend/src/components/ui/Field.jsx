// /frontend/src/components/ui/Field.jsx
// Input de formulario con label superior, helper opcional y estado invalid.
//
// Accesibilidad (sistema_de_disenio.md §5.2): la label va asociada con
// htmlFor/id (useId), el input lleva aria-invalid con error y aria-describedby
// apuntando a la ayuda o al error.
//
// Contraseña con ojo (`revelable`, desde el 2026-11-13, F6 de
// plan_mejoras_operativas.md): con type="password", un botón dentro de la caja
// del input muestra u oculta lo escrito. Va adentro de la caja (comparte borde y
// foco) y por eso es una prop de Field y no un componente aparte.

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { estiloEtiquetaCampo } from './estilos.js';

// Lado del botón del ojo: el touch target mínimo (§5.4).
const LADO_BOTON_OJO = 44;

/**
 * BotonOjo
 * Botón "Mostrar / Ocultar contraseña" dentro de la caja del input, a la derecha.
 * @param {Object} props
 * @param {boolean} props.visible - Si la contraseña se está mostrando.
 * @param {string} props.queSeMuestra - Para el nombre accesible: "contraseña" o "PIN".
 * @param {Function} props.onClick - Alterna la visibilidad.
 * @param {string} props.controla - id del input que controla (aria-controls).
 * @param {boolean} props.disabled
 * @returns {JSX.Element}
 */
function BotonOjo({ visible, queSeMuestra, onClick, controla, disabled }) {
  const Icono = visible ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${queSeMuestra}`}
      aria-pressed={visible}
      aria-controls={controla}
      style={{
        position: 'absolute',
        top: '50%',
        right: 2,
        transform: 'translateY(-50%)',
        width: LADO_BOTON_OJO,
        height: LADO_BOTON_OJO,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: theme.radius,
        color: theme.muted,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icono size={20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

/**
 * Field
 * Input de texto controlado con label + helper + invalid state.
 * @param {string} props.label - Texto de la label superior (eyebrow uppercase)
 * @param {string} props.value
 * @param {Function} props.onChange - Recibe el string nuevo (no el evento)
 * @param {Function} [props.onBlur]
 * @param {string} [props.placeholder]
 * @param {string} [props.type='text'] - text|email|tel|password|number
 * @param {boolean|string} [props.revelable=false] - Con type="password", suma el
 *   botón ojo para mostrar u ocultar lo escrito. `true` lo nombra "Mostrar
 *   contraseña"; un texto cambia qué se nombra (ej. revelable="PIN" → "Mostrar
 *   PIN"). No cambia el autoComplete.
 * @param {boolean} [props.invalid=false] - Marca el field con border de error
 * @param {string} [props.helper] - Texto auxiliar bajo el input
 * @param {string} [props.error] - Si está presente, reemplaza al helper en rojo
 * @param {boolean} [props.disabled=false] - Deshabilita el input
 * @param {string} [props.name] - name del input (password managers)
 * @param {string} [props.autoComplete] - Hint para password managers / autofill
 * @param {string} [props.autoCapitalize] - Hint de capitalización (mobile keyboards)
 * @param {string} [props.autoCorrect] - 'on'|'off' (Safari)
 * @param {boolean} [props.spellCheck] - Habilita / deshabilita corrector ortográfico
 * @param {string} [props.inputMode] - Hint de teclado virtual: 'numeric'|'decimal'|'tel'|'email'|etc.
 *   Usar con type="text" para abrir teclados específicos (numpad en iPad) sin
 *   los efectos colaterales de type="number" (acepta 'e', botones spin).
 * @param {number} [props.maxLength] - Tope de caracteres; sin él, no hay tope
 * @param {boolean} [props.autoFocus] - Enfoca el input al montarse
 */
function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  revelable = false,
  invalid = false,
  helper,
  error,
  disabled = false,
  name,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  inputMode,
  maxLength,
  autoFocus,
}) {
  const [focus, setFocus] = useState(false);
  const [visible, setVisible] = useState(false);
  const id = useId();
  const idAyuda = `${id}-ayuda`;

  const conOjo = Boolean(revelable) && type === 'password';
  const queSeMuestra = typeof revelable === 'string' ? revelable : 'contraseña';
  const tipoInput = conOjo && visible ? 'text' : type;
  const textoAyuda = error || helper;

  const borderColor = (invalid || error)
    ? theme.danger
    : (focus ? theme.accent : theme.hairline);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={estiloEtiquetaCampo}>{label}</label>

      <div style={{ position: 'relative' }}>
        <input
          id={id}
          name={name}
          type={tipoInput}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          spellCheck={spellCheck}
          inputMode={inputMode}
          maxLength={maxLength}
          autoFocus={autoFocus}
          aria-invalid={invalid || error ? true : undefined}
          aria-describedby={textoAyuda ? idAyuda : undefined}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => { setFocus(false); if (onBlur) onBlur(); }}
          style={{
            width: '100%',
            padding: '12px 14px',
            // Lugar para el ojo, así lo escrito no queda debajo del botón.
            paddingRight: conOjo ? LADO_BOTON_OJO + 4 : 14,
            background: disabled ? theme.surfaceAlt : theme.surface,
            border: `1px solid ${borderColor}`,
            borderRadius: theme.radius,
            fontFamily: theme.body,
            // sizeInput (16): con menos, Safari hace zoom al enfocar en el iPad.
            fontSize: theme.sizeInput,
            color: disabled ? theme.muted : theme.ink,
            opacity: disabled ? 0.7 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
            transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
            boxShadow: focus ? `0 0 0 3px ${theme.accent}26` : 'none',
          }}
        />
        {conOjo && (
          <BotonOjo
            visible={visible}
            queSeMuestra={queSeMuestra}
            onClick={() => setVisible((v) => !v)}
            controla={id}
            disabled={disabled}
          />
        )}
      </div>

      {textoAyuda && (
        <span id={idAyuda} style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: error ? theme.danger : theme.muted,
        }}>{textoAyuda}</span>
      )}
    </div>
  );
}

export default Field;
