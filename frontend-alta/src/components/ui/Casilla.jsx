// /frontend-alta/src/components/ui/Casilla.jsx
// Opción de sí o no al lado de un campo, con forma de botón: "Sin número" en
// la dirección (pantalla 2) y, en la fase 5, "es el mismo número para
// llamadas" (pantalla 11). Primitivo propio de este front.
//
// Por dentro es un <input type="checkbox"> nativo, invisible y encima de todo
// el botón: el toque, el teclado (Espacio), el lector de pantalla y el foco
// vienen con él. Lo que se ve es propio: una caja con borde que se llena con el
// acento y una tilde, sobre un fondo que pasa al acento suave al marcarla. La
// casilla nativa del navegador se ve distinta en cada sistema y muy básica.

import { useState } from 'react';
import { Check } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { useHover } from '../../hooks/useHover.js';
import { prefiereMenosMovimiento } from '../../utils/movimiento.js';

/**
 * Casilla
 * @param {boolean} props.marcada
 * @param {Function} props.onCambiar - Recibe el valor nuevo (true/false)
 * @param {ReactNode} props.children - El texto de la opción
 * @param {string} [props.name]
 * @returns {JSX.Element}
 */
function Casilla({ marcada, onCambiar, children, name }) {
  const [hover, eventosHover] = useHover();
  // Anillo de foco solo con teclado (:focus-visible), como el resto del front.
  const [focoTeclado, setFocoTeclado] = useState(false);
  const transicion = prefiereMenosMovimiento() ? 'none' : `background ${theme.transitionFast}, border-color ${theme.transitionFast}`;

  let fondo = hover ? theme.surfaceAlt : theme.surface;
  if (marcada) fondo = theme.accentSoft;

  return (
    <label
      {...eventosHover}
      className="al-presionable"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 44,
        padding: '0 14px 0 12px',
        background: fondo,
        border: `1px solid ${marcada ? theme.accent : theme.hairline}`,
        borderRadius: theme.radius,
        outline: focoTeclado ? `2px solid ${theme.accent}` : 'none',
        outlineOffset: 2,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: theme.weightMedium,
        color: marcada ? theme.accent : theme.ink,
        cursor: 'pointer',
        transition: `${transicion}, transform ${theme.transitionFast}`,
      }}
    >
      <input
        type="checkbox"
        name={name}
        checked={marcada}
        onChange={(e) => onCambiar(e.target.checked)}
        onFocus={(e) => setFocoTeclado(e.target.matches(':focus-visible'))}
        onBlur={() => setFocoTeclado(false)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          margin: 0,
          opacity: 0,
          cursor: 'pointer',
        }}
      />
      {/* La caja dibujada; el estado lo dice el checkbox de arriba. */}
      <span aria-hidden="true" style={{
        width: 20,
        height: 20,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radiusSm,
        // Sin marcar, el borde en muted (5:1): un control necesita 3:1 para verse.
        border: `1.5px solid ${marcada ? theme.accent : theme.muted}`,
        background: marcada ? theme.accent : theme.surface,
        color: theme.accentInk,
        transition: transicion,
      }}>
        {marcada && <Check size={14} strokeWidth={2.5} />}
      </span>
      {children}
    </label>
  );
}

export default Casilla;
