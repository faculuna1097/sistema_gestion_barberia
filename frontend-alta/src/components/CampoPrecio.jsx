// /frontend-alta/src/components/CampoPrecio.jsx
// El precio de un servicio o de un producto (pantallas 9 y 10): un entero en
// pesos con el "$" al costado y el punto de los miles mientras se escribe
// ("8.000"), con teclado numérico y el tope de PRECIO_MAXIMO (utils/precio.js).
// Cumple las tres reglas de Field (sistema_de_disenio.md §5.2): label
// asociada, aria-invalid y aria-describedby.
//
// Al reformatear, el cursor queda detrás de los mismos dígitos que tenía a su
// izquierda: corregir un número en el medio no lo manda al final.
//
// Si se escribe una coma (los centavos), lo de después se sigue viendo
// mientras se escribe, no cuenta para el precio y se va al salir del campo,
// con el aviso "Los precios van sin centavos". Si desapareciera al instante,
// los dígitos siguientes se pegarían al entero.

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { theme } from '../theme/tokens.js';
import { fmtPrecioEnCampo, leerPrecioEscrito, posicionTrasDigitos } from '../utils/precio.js';
import { estiloEtiquetaCampo, MARGEN_SCROLL_CAMPO } from './ui/estilos.js';

// Aviso cuando se escribe una coma: el precio va sin centavos y lo de después
// de la coma se descarta. Es solo del front (no es una regla del backend).
const TEXTO_SIN_CENTAVOS = 'Los precios van sin centavos.';

/**
 * CampoPrecio
 * @param {string} props.label - Rótulo ("Precio")
 * @param {number|null} props.valor - El precio, o null si está vacío
 * @param {Function} props.onCambiar - Recibe el precio nuevo (number o null)
 * @param {Function} [props.onBlur]
 * @param {Function} [props.onKeyDown] - Ej. Enter para seguir
 * @param {string} [props.error] - Mensaje de validaciones.js
 * @param {string} [props.etiquetaLector] - aria-label más completo que el rótulo ("Precio de Corte")
 * @param {boolean} [props.autoFocus=false]
 * @param {Object} [props.ref] - Ref al <input>
 * @returns {JSX.Element}
 */
function CampoPrecio({ label, valor, onCambiar, onBlur, onKeyDown, error, etiquetaLector, autoFocus = false, ref }) {
  const inputId = useId();
  const textoId = useId();
  const [foco, setFoco] = useState(false);
  // Lo escrito desde la coma (",50"), solo mientras se está en el campo.
  const [decimales, setDecimales] = useState('');
  const inputRef = useRef(null);
  // Dónde estaba el cursor en la última tecla: { digitos } (dígitos enteros a
  // su izquierda) o { enDecimales } (posición desde la coma). El efecto de
  // abajo lo pone ahí después del render con el texto reformateado.
  const cursorRef = useRef(null);
  const entero = fmtPrecioEnCampo(valor);
  const texto = `${entero}${decimales}`;

  useLayoutEffect(() => {
    const input = inputRef.current;
    const cursor = cursorRef.current;
    if (cursor === null || !input || document.activeElement !== input) return;
    cursorRef.current = null;
    const posicion = cursor.enDecimales !== undefined
      ? entero.length + cursor.enDecimales
      : posicionTrasDigitos(entero, cursor.digitos);
    input.setSelectionRange(posicion, posicion);
  });

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
   * cambiar — interpreta la tecla (leerPrecioEscrito) y guarda el precio.
   * @param {Event} e
   */
  const cambiar = (e) => {
    const crudo = e.target.value;
    const leido = leerPrecioEscrito(crudo);
    if (!leido) return;   // pasó el tope de dígitos: la tecla no entra
    const seleccion = e.target.selectionStart ?? crudo.length;
    const coma = crudo.indexOf(',');
    cursorRef.current = coma !== -1 && seleccion > coma
      ? { enDecimales: seleccion - coma }
      : { digitos: crudo.slice(0, seleccion).replace(/\D/g, '').length };
    setDecimales(leido.decimales);
    onCambiar(leido.precio);
  };

  const ayuda = error || (decimales ? TEXTO_SIN_CENTAVOS : null);
  let borde = theme.hairline;
  if (foco) borde = theme.accent;
  if (error) borde = theme.danger;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label htmlFor={inputId} style={estiloEtiquetaCampo}>{label}</label>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 14px',
        background: theme.surface,
        border: `1px solid ${borde}`,
        borderRadius: theme.radius,
        boxShadow: foco ? `0 0 0 3px ${theme.accent}26` : 'none',
        transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
      }}>
        <span aria-hidden="true" style={{ fontFamily: theme.body, fontSize: theme.sizeInput, color: theme.muted }}>$</span>
        <input
          ref={conRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="next"
          value={texto}
          onChange={cambiar}
          onFocus={() => setFoco(true)}
          onBlur={() => { setFoco(false); setDecimales(''); onBlur?.(); }}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          aria-label={etiquetaLector}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={ayuda ? textoId : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '12px 0',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: theme.body,
            // sizeInput (16): con menos, Safari hace zoom al enfocar en el iPhone.
            fontSize: theme.sizeInput,
            fontVariantNumeric: 'tabular-nums',
            color: theme.ink,
            scrollMarginBottom: MARGEN_SCROLL_CAMPO,
          }}
        />
      </div>
      {ayuda && (
        <span id={textoId} aria-live="polite" style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          lineHeight: 1.4,
          color: error ? theme.danger : theme.muted,
          textWrap: 'pretty',
        }}>
          {ayuda}
        </span>
      )}
    </div>
  );
}

export default CampoPrecio;
