// /frontend-barbero/src/components/ui/SearchInput.jsx
// Input de búsqueda con ícono lupa a la izquierda y botón × a la derecha
// (visible sólo cuando hay texto). Pensado para listas filtrables.

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { theme } from '../../theme/tokens.js';

/**
 * SearchInput
 * Caja de búsqueda controlada. Muestra siempre la lupa; muestra × solo si hay texto.
 * @param {string} props.value
 * @param {(nuevo: string) => void} props.onChange - Recibe el string nuevo, no el evento.
 * @param {string} [props.placeholder='Buscar...']
 * @param {string} [props.ariaLabel='Buscar'] - Label accesible (no hay label visible).
 */
function SearchInput({ value, onChange, placeholder = 'Buscar...', ariaLabel = 'Buscar' }) {
  const [focus, setFocus] = useState(false);
  const tieneTexto = value && value.length > 0;

  const borderColor = focus ? theme.accent : theme.hairline;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: theme.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: theme.radius,
        padding: '0 10px',
        boxShadow: focus ? `0 0 0 3px ${theme.accent}26` : 'none',
        transition: `border-color ${theme.transitionFast}, box-shadow ${theme.transitionFast}`,
      }}
    >
      <Search
        size={18}
        strokeWidth={1.75}
        color={theme.muted}
        aria-hidden="true"
      />

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          minWidth: 0,
          padding: '12px 0',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: theme.body,
          fontSize: 15,
          color: theme.ink,
        }}
      />

      {tieneTexto && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: theme.muted,
            borderRadius: 999,
          }}
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default SearchInput;
