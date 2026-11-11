// /frontend-alta/src/components/CampoAgregarNombre.jsx
// Un nombre que se suma a una lista: el campo y el botón "Agregar" en una sola
// caja (plan §5.2: "Nombre y Enter: aparece su avatar"). Lo usan los barberos
// (pantalla 5) y los dueños que no cortan (pantalla 6).
// Enter, con algo escrito, agrega; con el campo vacío, es el "Seguir" de la
// pantalla (como en el resto de los campos de texto). Después de agregar, el
// campo queda vacío y con el foco, listo para el siguiente.
// Cumple las tres reglas de Field (sistema_de_disenio.md §5.2): label
// asociada, aria-invalid y aria-describedby.
//
// Después de cada "Agregar" (salga bien o no) el campo se trae a la vista por
// encima del "Seguir": la fila nueva lo empuja hacia abajo, y un error no
// cambia el foco (el navegador no scrollea solo).

import { useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { alPresionarEnter } from '../utils/teclado.js';
import { useHover } from '../hooks/useHover.js';
import { estiloEtiquetaCampo, MARGEN_SCROLL_CAMPO } from './ui/estilos.js';

/**
 * CampoAgregarNombre
 * @param {string} props.label - Rótulo del campo ("Nombre del barbero")
 * @param {string} props.valor - Lo escrito (controlado por la pantalla)
 * @param {Function} props.onCambiar - Recibe el texto
 * @param {Function} props.onAgregar - "Agregar" o Enter con algo escrito
 * @param {Function} props.onEnterVacio - Enter con el campo vacío (el "Seguir")
 * @param {string} [props.error] - Por qué no se pudo agregar (o el error de la lista vacía)
 * @param {string} [props.helper] - Ayuda debajo, si no hay error
 * @param {number} [props.maxLength]
 * @param {boolean} [props.autoFocus=false]
 * @param {Object} [props.ref] - Ref al <input>
 * @returns {JSX.Element}
 */
function CampoAgregarNombre({
  label, valor, onCambiar, onAgregar, onEnterVacio, error, helper, maxLength, autoFocus = false, ref,
}) {
  const inputId = useId();
  const textoId = useId();
  const [foco, setFoco] = useState(false);
  const [hover, eventosHover] = useHover();
  const texto = error || helper;
  const hayTexto = valor.trim() !== '';
  const inputRef = useRef(null);

  /**
   * conRef — guarda el <input> acá y en el ref de la pantalla.
   * @param {HTMLInputElement|null} el
   */
  const conRef = (el) => {
    inputRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  /**
   * agregar — llama a onAgregar y, después del render, trae el campo a la vista.
   */
  const agregar = () => {
    onAgregar();
    requestAnimationFrame(() => inputRef.current?.scrollIntoView({ block: 'nearest' }));
  };

  let borde = theme.hairline;
  if (foco) borde = theme.accent;
  if (error) borde = theme.danger;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={inputId} style={estiloEtiquetaCampo}>{label}</label>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 4px 4px 14px',
        background: theme.surface,
        border: `1px solid ${borde}`,
        borderRadius: theme.radius,
        boxShadow: foco ? `0 0 0 3px ${theme.accent}26` : 'none',
        transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
      }}>
        <input
          ref={conRef}
          id={inputId}
          type="text"
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          onKeyDown={(e) => alPresionarEnter(hayTexto ? agregar : onEnterVacio)(e)}
          autoComplete="off"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          // Con algo escrito, Enter agrega ("enter"); vacío, sigue ("next").
          enterKeyHint={hayTexto ? 'enter' : 'next'}
          maxLength={maxLength}
          autoFocus={autoFocus}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={texto ? textoId : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            // 10 + 24 (16 × 1,5) + 10 = 44: el toque cómodo dentro de la caja.
            padding: '10px 0',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: theme.body,
            // sizeInput (16): con menos, Safari hace zoom al enfocar en el iPhone.
            fontSize: theme.sizeInput,
            color: theme.ink,
            scrollMarginBottom: MARGEN_SCROLL_CAMPO,
          }}
        />
        <button
          type="button"
          onClick={agregar}
          {...eventosHover}
          className="al-presionable"
          style={{
            minHeight: 44,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 14px 0 10px',
            background: hover ? theme.accent : theme.accentSoft,
            color: hover ? theme.accentInk : theme.accent,
            border: 'none',
            borderRadius: theme.radiusSm,
            fontFamily: theme.body,
            fontSize: theme.sizeBody,
            fontWeight: theme.weightMedium,
            cursor: 'pointer',
            transition: `background ${theme.transitionFast}, color ${theme.transitionFast}, transform ${theme.transitionFast}`,
          }}
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Agregar
        </button>
      </div>
      {texto && (
        <span id={textoId} style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          lineHeight: 1.4,
          color: error ? theme.danger : theme.muted,
          textWrap: 'pretty',
        }}>
          {texto}
        </span>
      )}
    </div>
  );
}

export default CampoAgregarNombre;
