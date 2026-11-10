// /frontend-alta/src/components/SelectorComision.jsx
// La comisión de un barbero (o la de todos): una barra que salta de 5 en 5,
// de 0 a 100, con botones de - y + a los costados para el ajuste fino con el
// pulgar (pantalla 5).
// La barra es un <input type="range"> nativo con el aspecto de la clase
// al-rango (index.css): el arrastre, el teclado (flechas, Inicio, Fin) y el
// lector de pantalla vienen con él.
// Vive en components/ y no en ui/: el paso y el tope son los de la comisión
// (utils/equipo.js).

import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { COMISION_MAXIMA } from '../utils/validaciones.js';
import { COMISION_POR_DEFECTO, PASO_COMISION, pasoComision } from '../utils/equipo.js';
import BotonPaso from './BotonPaso.jsx';

/**
 * SelectorComision
 * Arriba, el nombre y el % en grande; abajo, [-] barra [+]. Un valor que vino
 * guardado fuera de la barra (ej. 120, o 37) se muestra tal cual y la barra
 * queda en el punto más cercano: el primer toque lo lleva a uno válido.
 * @param {string} props.etiqueta - Nombre visible ("Todos", "Juan")
 * @param {number} props.valor - El % actual
 * @param {Function} props.onCambiar - Recibe el % nuevo (entero, múltiplo de 5)
 * @param {string} [props.errorId] - id del texto de error que describe a la barra
 * @param {Object} [props.ref] - Ref a la barra (para llevarle el foco a un error)
 * @returns {JSX.Element}
 */
function SelectorComision({ etiqueta, valor, onCambiar, errorId, ref }) {
  const etiquetaId = useId();
  const valido = Number.isFinite(valor);
  const enBarra = Math.min(Math.max(valido ? valor : COMISION_POR_DEFECTO, 0), COMISION_MAXIMA);
  const texto = valido ? `${valor} %` : '—';

  return (
    <div role="group" aria-labelledby={etiquetaId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span id={etiquetaId} style={{
          minWidth: 0,
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: theme.ink,
          overflowWrap: 'anywhere',
        }}>
          {etiqueta}
        </span>
        {/* El valor lo lee el lector desde la barra (aria-valuetext): acá solo se ve. */}
        <span aria-hidden="true" style={{
          flexShrink: 0,
          fontFamily: theme.body,
          fontSize: theme.sizeHeading,
          fontWeight: theme.weightHeading,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
          color: theme.ink,
        }}>
          {texto}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BotonPaso
          etiqueta={`${etiqueta}: ${PASO_COMISION} % menos`}
          deshabilitado={valido && valor <= 0}
          onClick={() => onCambiar(pasoComision(valor, -1))}
          describedBy={errorId}
        >
          <Minus size={20} strokeWidth={1.75} aria-hidden="true" />
        </BotonPaso>
        <input
          ref={ref}
          type="range"
          className="al-rango"
          min={0}
          max={COMISION_MAXIMA}
          step={PASO_COMISION}
          value={enBarra}
          onChange={(e) => onCambiar(Number(e.target.value))}
          aria-labelledby={etiquetaId}
          aria-valuetext={texto}
          aria-invalid={errorId ? 'true' : undefined}
          aria-describedby={errorId}
          style={{ flex: 1, minWidth: 0, '--al-relleno': enBarra / COMISION_MAXIMA }}
        />
        <BotonPaso
          etiqueta={`${etiqueta}: ${PASO_COMISION} % más`}
          deshabilitado={valido && valor >= COMISION_MAXIMA}
          onClick={() => onCambiar(pasoComision(valor, 1))}
          describedBy={errorId}
        >
          <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
        </BotonPaso>
      </div>
    </div>
  );
}

export default SelectorComision;
