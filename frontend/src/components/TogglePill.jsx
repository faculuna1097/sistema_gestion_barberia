// /frontend/src/components/TogglePill.jsx
// Pill binaria de filtro (toggle on/off). Hoy usada en SeccionCaja para
// "Solo Barberos".
//
// Decisiones de rediseño:
// - Sin dot: el cambio de color (muted ↔ accent) ya comunica el estado;
//   sumar un dot agregaba ruido sin info.
// - Radius normal (theme.radius = 10), no stadium 20 — más sobrio para
//   el admin compacto.
// - Hover sólo en el inactivo (el activo no necesita feedback adicional).

import { useState } from 'react';
import { theme } from '../theme/tokens.js';

/**
 * TogglePill
 * @param {object} props
 * @param {boolean} props.activo - Estado actual.
 * @param {() => void} props.onToggle - Callback al alternar el estado.
 * @param {string} props.labelOn - Texto cuando está activo (y default cuando inactivo).
 * @param {string} [props.labelOff] - Texto opcional cuando está inactivo (default: labelOn).
 */
export default function TogglePill({ activo, onToggle, labelOn, labelOff }) {
  const [hover, setHover] = useState(false);

  const texto = activo ? labelOn : (labelOff ?? labelOn);

  const estilo = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: theme.radius,
    fontFamily: theme.body,
    fontSize: theme.sizeBody,
    fontWeight: theme.weightMedium,
    letterSpacing: '-0.005em',
    cursor: 'pointer',
    transition: `background ${theme.transitionFast}, color ${theme.transitionFast}, border-color ${theme.transitionFast}`,
    background: activo
      ? theme.accentSoft
      : (hover ? theme.surfaceAlt : theme.surface),
    color: activo ? theme.accent : theme.muted,
    border: `1px solid ${activo ? theme.accentSoft : theme.hairline}`,
    whiteSpace: 'nowrap',
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={estilo}
    >
      {texto}
    </button>
  );
}
