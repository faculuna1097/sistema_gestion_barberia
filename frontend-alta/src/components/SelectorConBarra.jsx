// /frontend-alta/src/components/SelectorConBarra.jsx
// Un valor que se elige con una barra que salta de a pasos, con botones de -
// y + a los costados para el ajuste fino con el pulgar. Arriba, el nombre y
// el valor en grande. Lo usan la comisión (SelectorComision, pantalla 5) y el
// largo del turno (pantalla 8). Salió de SelectorComision en la fase 5, al
// tener un segundo uso.
// La barra es un <input type="range"> nativo con el aspecto de la clase
// al-rango (index.css): el arrastre, el teclado (flechas, Inicio, Fin) y el
// lector de pantalla vienen con él.

import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { dentroDeBarra, pasoEnBarra } from '../utils/barra.js';
import BotonPaso from './BotonPaso.jsx';

/**
 * SelectorConBarra
 * Un valor guardado fuera de la barra (ej. una comisión de 120, o de 37) se
 * muestra tal cual y la perilla queda en el punto más cercano: el primer
 * toque lo lleva a uno válido.
 * @param {string} props.etiqueta - Nombre visible ("Todos", "Juan", "Turnos cada")
 * @param {number|null} props.valor - El valor actual
 * @param {Function} props.onCambiar - Recibe el valor nuevo (siempre un punto de la barra)
 * @param {number} props.min
 * @param {number} props.max
 * @param {number} props.paso
 * @param {number} props.porDefecto - Dónde va la perilla sin valor
 * @param {Function} props.formatear - (valor) => texto ("50 %", "30 min")
 * @param {string} props.unidadPaso - Cuánto mueve cada botón, para su etiqueta ("5 %", "5 minutos")
 * @param {Function} [props.onKeyDown] - De la barra (ej. Enter para seguir)
 * @param {string} [props.errorId] - id del texto de error que describe a la barra
 * @param {Object} [props.ref] - Ref a la barra (para llevarle el foco a un error)
 * @returns {JSX.Element}
 */
function SelectorConBarra({
  etiqueta, valor, onCambiar, min, max, paso, porDefecto, formatear, unidadPaso, onKeyDown, errorId, ref,
}) {
  const etiquetaId = useId();
  const rango = { min, max, paso, porDefecto };
  const valido = Number.isFinite(valor);
  const enBarra = dentroDeBarra(valor, rango);
  const texto = valido ? formatear(valor) : '—';

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
          etiqueta={`${etiqueta}: ${unidadPaso} menos`}
          deshabilitado={valido && valor <= min}
          onClick={() => onCambiar(pasoEnBarra(valor, -1, rango))}
          describedBy={errorId}
        >
          <Minus size={20} strokeWidth={1.75} aria-hidden="true" />
        </BotonPaso>
        <input
          ref={ref}
          type="range"
          className="al-rango"
          min={min}
          max={max}
          step={paso}
          value={enBarra}
          onChange={(e) => onCambiar(Number(e.target.value))}
          onKeyDown={onKeyDown}
          aria-labelledby={etiquetaId}
          aria-valuetext={texto}
          aria-invalid={errorId ? 'true' : undefined}
          aria-describedby={errorId}
          style={{ flex: 1, minWidth: 0, '--al-relleno': (enBarra - min) / (max - min) }}
        />
        <BotonPaso
          etiqueta={`${etiqueta}: ${unidadPaso} más`}
          deshabilitado={valido && valor >= max}
          onClick={() => onCambiar(pasoEnBarra(valor, 1, rango))}
          describedBy={errorId}
        >
          <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
        </BotonPaso>
      </div>
    </div>
  );
}

export default SelectorConBarra;
