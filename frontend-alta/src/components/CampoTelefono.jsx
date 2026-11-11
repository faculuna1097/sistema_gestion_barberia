// /frontend-alta/src/components/CampoTelefono.jsx
// Un teléfono: [país | número] en una sola caja, con el número formateándose
// mientras se escribe (pantallas 11 y 12: el WhatsApp y el teléfono del local
// y el celular del dueño). Copia del CampoTelefono del turnero
// (frontend-turnero/src/screens/ConfirmarTurno.jsx), que allá es local de una
// pantalla; acá lo usan tres campos, así que vive en components/. Suma lo que
// piden estas pantallas: ayuda debajo, `name`/`autoComplete` por campo, Enter
// y autoFocus.
// Cumple las tres reglas de Field (sistema_de_disenio.md §5.2): label
// asociada, aria-invalid y aria-describedby. La lógica de lo que se escribe
// vive en utils/contacto.js (escribirTelefono).
// Se dibuja con libphonenumber-js ya cargada (utils/libTelefono.js): lo
// asegura Formulario, que no muestra las pantallas de Contacto sin ella.

import { useId, useState } from 'react';
import { theme } from '../theme/tokens.js';
import { PAISES } from '../utils/telefono.js';
import { libTelefono } from '../utils/libTelefono.js';
import { estiloEtiquetaCampo, MARGEN_SCROLL_CAMPO } from './ui/estilos.js';

/**
 * CampoTelefono
 * @param {string} props.label - Rótulo (eyebrow), asociado al input
 * @param {string} props.pais - ISO del país elegido (ej. 'AR')
 * @param {Function} props.onCambiarPais - Recibe el ISO nuevo
 * @param {string} props.valor - Número nacional ya formateado (lo que se ve)
 * @param {Function} props.onCambiar - Recibe el valor crudo del input
 * @param {Function} [props.onBlur]
 * @param {Function} [props.onKeyDown]
 * @param {string} [props.error] - Pinta el borde de rojo y va como texto debajo
 * @param {string} [props.helper] - Ayuda debajo, si no hay error
 * @param {string} [props.name]
 * @param {string} [props.autoComplete='tel']
 * @param {string} [props.placeholder]
 * @param {boolean} [props.autoFocus=false]
 * @param {Object} [props.ref] - Ref al <input> del número
 * @returns {JSX.Element}
 */
function CampoTelefono({
  label, pais, onCambiarPais, valor, onCambiar, onBlur, onKeyDown, error, helper, name,
  autoComplete = 'tel', placeholder, autoFocus = false, ref,
}) {
  const [foco, setFoco] = useState(false);
  // El anillo de foco extra solo con teclado (:focus-visible), como Casilla:
  // al tocar, alcanza con el borde y la sombra del acento (igual que Field).
  const [focoTeclado, setFocoTeclado] = useState(false);
  const inputId = useId();
  const textoId = useId();
  const texto = error || helper;
  const { getCountryCallingCode } = libTelefono();

  // Borde: error > foco > normal.
  let borde = theme.hairline;
  if (foco) borde = theme.accent;
  if (error) borde = theme.danger;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={inputId} style={estiloEtiquetaCampo}>{label}</label>

      {/* La caja agrupa país y número como un solo campo. El outline repite el
          *:focus-visible global (solo con teclado): con error el borde no
          cambia y el select y el input lo anulan, así que el foco se marca acá. */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        background: theme.surface,
        border: `1px solid ${borde}`,
        borderRadius: theme.radius,
        transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
        boxShadow: foco ? `0 0 0 3px ${theme.accent}26` : 'none',
        outline: focoTeclado ? `2px solid ${theme.accent}` : 'none',
        outlineOffset: 2,
        overflow: 'hidden',
      }}>
        {/* El país, con un select nativo: en el celular abre la lista del sistema. */}
        <select
          aria-label={`País de ${label.toLowerCase()}`}
          value={pais}
          onChange={(e) => onCambiarPais(e.target.value)}
          onFocus={(e) => { setFoco(true); setFocoTeclado(e.target.matches(':focus-visible')); }}
          onBlur={() => { setFoco(false); setFocoTeclado(false); }}
          style={{
            minHeight: 46,
            border: 'none',
            background: 'transparent',
            padding: '12px 8px 12px 14px',
            fontFamily: theme.body,
            fontSize: theme.sizeInput,
            color: theme.ink,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {PAISES.map((p) => (
            <option key={p.iso} value={p.iso} title={p.nombre}>
              {p.bandera} +{getCountryCallingCode(p.iso)}
            </option>
          ))}
        </select>

        <span aria-hidden="true" style={{ width: 1, background: theme.hairline, alignSelf: 'stretch' }} />

        <input
          ref={ref}
          id={inputId}
          type="tel"
          inputMode="tel"
          name={name}
          autoComplete={autoComplete}
          enterKeyHint="next"
          value={valor}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onCambiar(e.target.value)}
          onFocus={(e) => { setFoco(true); setFocoTeclado(e.target.matches(':focus-visible')); }}
          onBlur={() => { setFoco(false); setFocoTeclado(false); onBlur?.(); }}
          onKeyDown={onKeyDown}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={texto ? textoId : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            padding: '12px 14px',
            fontFamily: theme.body,
            fontSize: theme.sizeInput,
            fontVariantNumeric: 'tabular-nums',
            color: theme.ink,
            outline: 'none',
            scrollMarginBottom: MARGEN_SCROLL_CAMPO,
          }}
        />
      </div>

      {texto && (
        <span id={textoId} style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          lineHeight: 1.4,
          color: error ? theme.danger : theme.muted,
          textWrap: 'pretty',
        }}>{texto}</span>
      )}
    </div>
  );
}

export default CampoTelefono;
