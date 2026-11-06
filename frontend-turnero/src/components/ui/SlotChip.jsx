// /frontend-turnero/src/components/ui/SlotChip.jsx
// Chip de horario clickable. Lo usa SelectorDiaHorario ("¿Cuándo?" y la
// reprogramación de la gestión).

import { theme } from '../../theme/tokens.js';
import { useHover } from '../../hooks/useHover.js';
import { fmtHora } from '../../utils/fecha.js';

/**
 * ALTO_SLOT
 * Alto fijo del chip, en px. El skeleton de los horarios usa el mismo, así
 * no salta al reemplazarlo.
 */
export const ALTO_SLOT = 48;

/**
 * SlotChip
 * Botón con la hora del slot; ocupa el ancho de su celda de la grilla.
 * Estados: normal, hover (solo con mouse, ver useHover), seleccionado.
 * @param {string} props.iso - ISO timestamp del slot
 * @param {boolean} [props.selected=false]
 * @param {Function} props.onClick
 */
function SlotChip({ iso, selected = false, onClick }) {
  const [hover, eventosHover] = useHover();

  // Resolución del color de border: selected > hover > default.
  const borderColor = selected
    ? theme.accent
    : (hover ? theme.mutedSoft : theme.hairline);

  return (
    <button
      type="button"
      onClick={onClick}
      {...eventosHover}
      aria-pressed={selected}
      className="tt-presionable"
      style={{
        background: selected ? theme.accent : theme.surface,
        color: selected ? theme.accentInk : theme.ink,
        border: `1px solid ${borderColor}`,
        borderRadius: theme.radius,
        width: '100%',
        height: ALTO_SLOT,
        padding: 0,
        fontFamily: theme.body,
        fontWeight: theme.weightMedium,
        fontSize: theme.sizeBody,
        cursor: 'pointer',
        // `transform` acompaña al achique de tt-presionable (index.css) al tocar.
        transition: `background ${theme.transitionFast}, border-color ${theme.transitionFast}, transform ${theme.transitionFast}`,
      }}
    >
      {fmtHora(iso)}
    </button>
  );
}

export default SlotChip;
