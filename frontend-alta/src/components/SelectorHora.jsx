// /frontend-alta/src/components/SelectorHora.jsx
// Una hora que se ajusta con botones de - y + de a 30 minutos (plan §5.2:
// tocar antes que escribir). Lo usan la pantalla del horario del local (4) y,
// en la fase 4, los horarios a medida de cada barbero.
// Vive en components/ y no en ui/: sus horas son las del formulario (en punto
// o y media, utils/horas.js).

import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { theme } from '../theme/tokens.js';
import { useHover } from '../hooks/useHover.js';
import { estiloEtiquetaCampo } from './ui/estilos.js';
import { PASO_MINUTOS, HORA_MINIMA, HORA_MAXIMA, minutosEntre, sumarMinutos } from '../utils/horas.js';

/**
 * BotonPaso
 * Botón cuadrado de 44 × 44 con el - o el +.
 * @param {ReactNode} props.children - El ícono
 * @param {string} props.etiqueta - aria-label ("Abren: 30 minutos antes")
 * @param {boolean} props.deshabilitado - En el tope del rango
 * @param {Function} props.onClick
 * @param {string} [props.describedBy] - id del texto de error
 * @param {Object} [props.ref] - Ref al <button>
 * @returns {JSX.Element}
 */
function BotonPaso({ children, etiqueta, deshabilitado, onClick, describedBy, ref }) {
  const [hover, eventosHover] = useHover();
  return (
    <button
      ref={ref}
      type="button"
      onClick={deshabilitado ? undefined : onClick}
      {...eventosHover}
      disabled={deshabilitado}
      aria-label={etiqueta}
      aria-describedby={describedBy}
      className="al-presionable"
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        background: hover && !deshabilitado ? theme.surfaceAlt : theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        color: deshabilitado ? theme.mutedSoft : theme.ink,
        cursor: deshabilitado ? 'not-allowed' : 'pointer',
        transition: `background ${theme.transitionFast}, transform ${theme.transitionFast}`,
      }}
    >
      {children}
    </button>
  );
}

/**
 * SelectorHora
 * Rótulo arriba y, debajo, [-] HH:MM [+]. La hora no baja de `min` ni sube de
 * `max`: en el tope, el botón se apaga (el rango nunca queda al revés, así que
 * ese error no se puede dar desde acá).
 * La hora es una región `aria-live`: el lector anuncia el valor nuevo después
 * de cada toque.
 * @param {string} props.etiqueta - Rótulo visible ("Abren")
 * @param {string} props.valor - 'HH:MM'
 * @param {Function} props.onCambiar - Recibe la hora nueva 'HH:MM'
 * @param {string} [props.min=HORA_MINIMA] - La más temprana que se puede elegir
 * @param {string} [props.max=HORA_MAXIMA] - La más tarde que se puede elegir
 * @param {string} [props.errorId] - id del texto de error que describe a este control
 * @param {Object} [props.refPrimero] - Ref al botón "-" (para llevarle el foco a un error)
 * @returns {JSX.Element}
 */
function SelectorHora({
  etiqueta, valor, onCambiar, min = HORA_MINIMA, max = HORA_MAXIMA, errorId, refPrimero,
}) {
  const etiquetaId = useId();
  const puedeBajar = minutosEntre(min, valor) >= PASO_MINUTOS;
  const puedeSubir = minutosEntre(valor, max) >= PASO_MINUTOS;

  return (
    <div role="group" aria-labelledby={etiquetaId} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span id={etiquetaId} style={estiloEtiquetaCampo}>{etiqueta}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <BotonPaso
          ref={refPrimero}
          etiqueta={`${etiqueta}: 30 minutos antes`}
          deshabilitado={!puedeBajar}
          onClick={() => onCambiar(sumarMinutos(valor, -PASO_MINUTOS))}
          describedBy={errorId}
        >
          <Minus size={20} strokeWidth={1.75} aria-hidden="true" />
        </BotonPaso>
        <output
          aria-live="polite"
          style={{
            flex: 1,
            minWidth: 64,
            textAlign: 'center',
            fontFamily: theme.body,
            fontSize: theme.sizeHeading,
            fontWeight: theme.weightHeading,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
            color: theme.ink,
          }}
        >
          {valor}
        </output>
        <BotonPaso
          etiqueta={`${etiqueta}: 30 minutos después`}
          deshabilitado={!puedeSubir}
          onClick={() => onCambiar(sumarMinutos(valor, PASO_MINUTOS))}
          describedBy={errorId}
        >
          <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
        </BotonPaso>
      </div>
    </div>
  );
}

export default SelectorHora;
