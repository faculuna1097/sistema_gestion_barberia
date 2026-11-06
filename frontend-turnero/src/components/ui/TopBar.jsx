// /frontend-turnero/src/components/ui/TopBar.jsx
// Barra superior fina con botón "← Volver" + slot derecho opcional.

import { theme } from '../../theme/tokens.js';

/**
 * TopBar
 * Header navegacional liviano. Si no se pasa onVolver, queda vacío a la izquierda.
 * @param {Function} [props.onVolver] - Callback al clickear el botón Volver
 * @param {string} [props.label='Volver'] - Texto del botón
 * @param {ReactNode} [props.right] - Slot a la derecha (ej: acción secundaria)
 */
function TopBar({ onVolver, label = 'Volver', right }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      // 8 arriba + el botón de 44: el texto queda donde estaba con el botón de
      // ~37. El minHeight mantiene ese alto aunque no haya botón.
      padding: '8px 16px 0',
      minHeight: 52,
    }}>
      {onVolver ? (
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            // Touch target mínimo de 44 px de alto (sistema de diseño §5.4).
            minHeight: 44,
            padding: '0 12px 0 8px',
            background: 'transparent',
            border: 'none',
            color: theme.inkSoft,
            cursor: 'pointer',
            fontFamily: theme.body,
            fontSize: 14,
            fontWeight: theme.weightMedium,
            borderRadius: 999,
          }}
        >
          {/* Chevron izquierdo */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {label}
        </button>
      ) : <span/>}

      {right || <span/>}
    </div>
  );
}

export default TopBar;
