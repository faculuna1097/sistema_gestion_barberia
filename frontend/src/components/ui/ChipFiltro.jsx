// /frontend/src/components/ui/ChipFiltro.jsx
// Chip de filtro multi-opción (radius pill).
// Estado inactivo: ghost con border `hairline` + texto `inkSoft`.
// Estado activo:  tinted con `accentSoft` + border y texto en `accent`.
//
// `aria-pressed` refleja el estado activo (es un toggle de filtro,
// no una opción dentro de un radiogroup — cada chip se "presiona" o no).
//
// Variante `size`:
//   - 'md' (default): padding 6/12, weight pasa a `heading` cuando está activo.
//                     Para filtros primarios (ej. barberos).
//   - 'sm':           padding 4/10, weight queda en `medium` siempre.
//                     Para filtros secundarios (ej. estado de un turno),
//                     donde la jerarquía visual debe ser menor.

import { useState } from 'react';
import { theme } from '../../theme/tokens.js';

/**
 * ChipFiltro
 * @param {object} props
 * @param {string}   props.label   - Texto del chip.
 * @param {boolean}  props.activo  - Estado del filtro (refleja `aria-pressed`).
 * @param {Function} props.onClick - Callback al togglear.
 * @param {'md'|'sm'} [props.size='md'] - Tamaño del chip.
 */
function ChipFiltro({ label, activo, onClick, size = 'md' }) {
  const [hover, setHover] = useState(false);

  const dims = size === 'sm'
    ? { padding: '4px 10px' }
    : { padding: '6px 12px' };

  // En sm el weight queda fijo en medium (jerarquía secundaria).
  // En md el activo sube a heading.
  const weight = size === 'sm'
    ? theme.weightMedium
    : (activo ? theme.weightHeading : theme.weightMedium);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={activo}
      style={{
        ...dims,
        borderRadius: 999,
        border: `1px solid ${activo ? theme.accent : theme.hairline}`,
        background: activo ? theme.accentSoft : (hover ? theme.surfaceAlt : 'transparent'),
        color: activo ? theme.accent : theme.inkSoft,
        fontFamily: theme.body,
        fontSize: theme.sizeBody,
        fontWeight: weight,
        letterSpacing: '-0.005em',
        cursor: 'pointer',
        transition: `background ${theme.transitionFast}, color ${theme.transitionFast}, border-color ${theme.transitionFast}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

export default ChipFiltro;
