// /frontend-turnero/src/components/ui/SlotChip.jsx
// Chip de horario clickable. Usado en SeleccionHorario (wizard) y GestionTurno (reprog).

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';
import { fmtHora } from '../../utils/fecha.js';

/**
 * SlotChip
 * Botón cuadrado con la hora del slot. Estados: normal, hover, seleccionado.
 * @param {string} props.iso - ISO timestamp del slot
 * @param {boolean} [props.selected=false]
 * @param {Function} props.onClick
 */
function SlotChip({ iso, selected = false, onClick }) {
  const [hover, setHover] = useState(false);

  // Resolución del color de border: selected > hover > default.
  const borderColor = selected
    ? theme.accent
    : (hover ? theme.mutedSoft : theme.hairline);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="tt-presionable"
      style={{
        background: selected ? theme.accent : theme.surface,
        color: selected ? theme.accentInk : theme.ink,
        border: `1px solid ${borderColor}`,
        borderRadius: theme.radius,
        padding: '14px 0',
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
