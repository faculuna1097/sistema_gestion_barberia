// /frontend-alta/src/components/ui/BotonOpcion.jsx
// Una opción de una pregunta de respuesta única, como botón grande: "Sí,
// todos" / "No…" en los horarios del equipo (pantalla 7), y "Igual al local" /
// "Otro horario" de cada barbero. En la fase 5 sirve para el largo del turno y
// "¿Vendés productos?". Primitivo propio de este front.
//
// La elegida se ve con el acento suave, el borde del acento y una tilde (el
// color nunca va solo), y lo dice `aria-pressed`. Si la elección hace avanzar
// de pantalla, la tilde aparece apenas se toca (useEleccionConPausa).

import { Check } from 'lucide-react';
import { theme } from '../../theme/tokens.js';
import { useHover } from '../../hooks/useHover.js';
import { prefiereMenosMovimiento } from '../../utils/movimiento.js';

/**
 * BotonOpcion
 * @param {boolean} props.elegida
 * @param {Function} props.onClick
 * @param {ReactNode} props.children - El texto de la opción
 * @param {string} [props.descripcion] - Una línea debajo, en muted
 * @param {boolean} [props.compacta=false] - 44 px de alto y el texto centrado,
 *   para dos opciones lado a lado; si no, 56 px y a lo ancho
 * @param {string} [props.describedBy] - id del texto de error del grupo
 * @param {Object} [props.ref] - Ref al <button> (para llevarle el foco)
 * @returns {JSX.Element}
 */
function BotonOpcion({ elegida, onClick, children, descripcion, compacta = false, describedBy, ref }) {
  const [hover, eventosHover] = useHover();
  const transicion = prefiereMenosMovimiento()
    ? `transform ${theme.transitionFast}`
    : `background ${theme.transitionFast}, border-color ${theme.transitionFast}, transform ${theme.transitionFast}`;

  let fondo = hover ? theme.surfaceAlt : theme.surface;
  if (elegida) fondo = theme.accentSoft;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      {...eventosHover}
      aria-pressed={elegida}
      aria-describedby={describedBy}
      className="al-presionable"
      style={{
        width: '100%',
        minHeight: compacta ? 44 : 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: compacta ? 'center' : 'space-between',
        gap: compacta ? 6 : 12,
        padding: compacta ? '8px 12px' : '12px 16px',
        background: fondo,
        border: `1px solid ${elegida ? theme.accent : theme.hairline}`,
        borderRadius: theme.radius,
        textAlign: compacta ? 'center' : 'left',
        cursor: 'pointer',
        transition: transicion,
      }}
    >
      {compacta && elegida && <Check size={16} strokeWidth={2} aria-hidden="true" style={{ color: theme.accent, flexShrink: 0 }} />}
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{
          fontFamily: theme.body,
          fontSize: theme.sizeBody,
          fontWeight: theme.weightMedium,
          color: elegida ? theme.accent : theme.ink,
        }}>
          {children}
        </span>
        {descripcion && (
          <span style={{ fontFamily: theme.body, fontSize: theme.sizeBody, color: theme.muted }}>
            {descripcion}
          </span>
        )}
      </span>
      {!compacta && (
        // El círculo de la elección: vacío, o lleno con la tilde.
        <span aria-hidden="true" style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          border: `1.5px solid ${elegida ? theme.accent : theme.muted}`,
          background: elegida ? theme.accent : theme.surface,
          color: theme.accentInk,
        }}>
          {elegida && <Check size={14} strokeWidth={2.5} />}
        </span>
      )}
    </button>
  );
}

export default BotonOpcion;
