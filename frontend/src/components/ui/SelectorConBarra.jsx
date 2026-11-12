// /frontend/src/components/ui/SelectorConBarra.jsx
// Un valor que se elige con una barra que salta de a pasos, con botones de - y
// + a los costados para el ajuste fino (en el iPad, con el dedo). Arriba, el
// rótulo del campo (como el de Field) y el valor a la vista.
//
// Copia adaptada del SelectorConBarra de frontend-alta (sistema_de_disenio.md
// §8: se duplica, no se comparte), con la densidad compacta del panel: el
// rótulo es el eyebrow mono de Field y el valor va en sizeBody.
// Lo usa la comisión del barbero (Gestión → Barberos). Está en ui/ porque es
// genérico (rango, paso y formato por props): el largo del turno de
// Gestión → Turnero es el mismo control en el formulario de alta.
//
// La barra es un <input type="range"> nativo con el aspecto de la clase
// om-rango (index.css): el arrastre, el teclado (flechas, Inicio, Fin) y el
// lector de pantalla vienen con él.

import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { estiloEtiquetaCampo } from './estilos.js';

/**
 * pasoEnBarra (interna)
 * El valor después de un toque de - o +: salta al punto de la barra anterior o
 * siguiente (contando desde `min` de a `paso`), sin salir de min a max. Un valor
 * guardado fuera de la barra queda en el punto que corresponde (con la
 * comisión, un 37 pasa a 35 o 40; un 120 baja a 100).
 * @param {number|null} valor - El valor actual (puede no ser un número)
 * @param {number} sentido - -1 (menos) o +1 (más)
 * @param {{ min: number, max: number, paso: number, porDefecto: number }} rango
 * @returns {number} Un punto de la barra.
 */
function pasoEnBarra(valor, sentido, { min, max, paso, porDefecto }) {
  const actual = (Number.isFinite(valor) ? valor : porDefecto) - min;
  const siguiente = sentido > 0
    ? Math.floor(actual / paso) * paso + paso
    : Math.ceil(actual / paso) * paso - paso;
  return Math.min(Math.max(siguiente + min, min), max);
}

/**
 * dentroDeBarra (interna)
 * Dónde dibujar la perilla para un valor: el mismo, el extremo más cercano si
 * está afuera, o `porDefecto` si no es un número.
 * @param {number|null} valor
 * @param {{ min: number, max: number, porDefecto: number }} rango
 * @returns {number}
 */
function dentroDeBarra(valor, { min, max, porDefecto }) {
  return Math.min(Math.max(Number.isFinite(valor) ? valor : porDefecto, min), max);
}

/**
 * BotonPaso (interno)
 * Botón cuadrado de 44 × 44 (el alto de un Field) con el - o el +.
 * aria-disabled y no `disabled`: al llegar al tope con el teclado, el botón
 * conserva el foco (con `disabled` se iría al principio del modal).
 * @param {object} props
 * @param {React.ReactNode} props.children - El ícono (Minus o Plus de 16)
 * @param {string} props.etiqueta - aria-label ("Comisión: 5 % menos")
 * @param {boolean} props.deshabilitado - En el tope del rango
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function BotonPaso({ children, etiqueta, deshabilitado, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={deshabilitado ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-disabled={deshabilitado || undefined}
      aria-label={etiqueta}
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
        transition: `background ${theme.transitionFast}`,
      }}
    >
      {children}
    </button>
  );
}

/**
 * SelectorConBarra
 * Campo de formulario con una barra de a pasos. Un valor que vino guardado
 * fuera de la barra (ej. una comisión de 37) se muestra tal cual y la perilla
 * queda en el punto más cercano: el primer movimiento lo lleva a uno válido.
 *
 * @param {object} props
 * @param {string} props.etiqueta - Rótulo del campo ("Comisión")
 * @param {number|null} props.valor - El valor actual
 * @param {(valor: number) => void} props.onCambiar - Recibe el valor nuevo (siempre un punto de la barra)
 * @param {number} props.min
 * @param {number} props.max
 * @param {number} props.paso
 * @param {number} props.porDefecto - Dónde va la perilla si `valor` no es un número
 * @param {(valor: number) => string} props.formatear - Texto del valor ("35 %")
 * @param {string} props.unidadPaso - Cuánto mueve cada botón, para su etiqueta ("5 %")
 * @param {string} [props.error] - Texto de error bajo la barra (como en Field)
 * @returns {JSX.Element}
 */
function SelectorConBarra({
  etiqueta, valor, onCambiar, min, max, paso, porDefecto, formatear, unidadPaso, error,
}) {
  const etiquetaId = useId();
  const errorId = useId();
  const rango = { min, max, paso, porDefecto };
  const valido = Number.isFinite(valor);
  const enBarra = dentroDeBarra(valor, rango);
  const texto = valido ? formatear(valor) : '—';

  return (
    <div role="group" aria-labelledby={etiquetaId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span id={etiquetaId} style={estiloEtiquetaCampo}>{etiqueta}</span>
        {/* El valor lo lee el lector desde la barra (aria-valuetext): acá solo se ve. */}
        <span aria-hidden="true" style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightHeading,
          fontVariantNumeric: 'tabular-nums',
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
        >
          <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
        </BotonPaso>
        <input
          type="range"
          className="om-rango"
          min={min}
          max={max}
          step={paso}
          value={enBarra}
          onChange={(e) => onCambiar(Number(e.target.value))}
          aria-labelledby={etiquetaId}
          aria-valuetext={texto}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          style={{ flex: 1, minWidth: 0, '--om-relleno': (enBarra - min) / (max - min) }}
        />
        <BotonPaso
          etiqueta={`${etiqueta}: ${unidadPaso} más`}
          deshabilitado={valido && valor >= max}
          onClick={() => onCambiar(pasoEnBarra(valor, 1, rango))}
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        </BotonPaso>
      </div>

      {error && (
        <span id={errorId} style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          color: theme.danger,
        }}>{error}</span>
      )}
    </div>
  );
}

export default SelectorConBarra;
